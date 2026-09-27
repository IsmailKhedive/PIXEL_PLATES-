import { Router } from "express";
import db from "../db.js";
import { protect, allowRoles } from "../authMiddleware.js";

const router = Router();
function calculateSellingPrice(item) {
  const normalPrice = Number(item.price);
  const discount = Number(item.discount_percent || 0);

  const now = new Date();
  const hasStarted =
    !item.promotion_start || now >= new Date(item.promotion_start);

  const hasNotEnded =
    !item.promotion_end || now <= new Date(item.promotion_end);

  const promotionActive =
    Boolean(item.featured) &&
    discount > 0 &&
    discount <= 100 &&
    hasStarted &&
    hasNotEnded;

  if (!promotionActive) {
    return normalPrice;
  }

  return Math.round(normalPrice * (1 - discount / 100));
}
router.get(
  "/",
  protect,
  allowRoles("admin", "manager", "kitchen", "waiter"),
  async (req, res) => {
    try {
      const waiterFilter =
        req.user.role === "waiter" ? "AND o.waiter_id = ?" : "";

      const parameters =
        req.user.role === "waiter"
          ? [req.user.restaurantId, req.user.id]
          : [req.user.restaurantId];

      const [rows] = await db.query(
        `SELECT
           o.id,
           o.table_number,
           o.order_note,
           o.total,
           o.status,
           o.payment_status,
           o.payment_method,
           o.created_at,
           COALESCE(
             u.name,
             'Table tablet'
           ) AS waiter_name,
           oi.item_name,
           oi.price,
           oi.quantity
         FROM orders o
         LEFT JOIN users u
           ON u.id = o.waiter_id
         LEFT JOIN order_items oi
           ON oi.order_id = o.id
         WHERE o.restaurant_id = ?
         ${waiterFilter}
         ORDER BY o.created_at DESC, oi.id`,
        parameters,
      );

      const orders = [];
      const orderMap = new Map();

      for (const row of rows) {
        if (!orderMap.has(row.id)) {
          const order = {
            id: row.id,
            table_number: row.table_number,
            order_note: row.order_note,
            total: row.total,
            status: row.status,
            payment_status: row.payment_status,
            payment_method: row.payment_method,
            created_at: row.created_at,
            waiter_name: row.waiter_name,
            items: [],
          };

          orderMap.set(row.id, order);
          orders.push(order);
        }

        if (row.item_name) {
          orderMap.get(row.id).items.push({
            item_name: row.item_name,
            price: row.price,
            quantity: row.quantity,
          });
        }
      }

      res.json(orders);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Unable to load orders",
      });
    }
  },
);

router.post("/", protect, allowRoles("admin", "manager", "waiter"), async (req, res) => {
  const tableNumber = String(req.body.tableNumber || "").trim();
  const orderNote = String(req.body.orderNote || "").trim();

  if (orderNote.length > 500) {
    return res.status(400).json({
      message: "Order note must be 500 characters or less",
    });
  }
  const requestedItems = Array.isArray(req.body.items) ? req.body.items : [];

  if (!tableNumber || !requestedItems.length) {
    return res.status(400).json({
      message: "Table and order items are required",
    });
  }

  if (tableNumber.length > 20) {
    return res.status(400).json({
      message: "The table number is too long",
    });
  }

  const quantities = new Map();

  for (const item of requestedItems) {
    const id = Number(item.id);
    const quantity = Number(item.quantity);

    if (!Number.isInteger(id) || !Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({
        message: "Order contains an invalid item or quantity",
      });
    }

    quantities.set(id, (quantities.get(id) || 0) + quantity);
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const ids = [...quantities.keys()];
    const placeholders = ids.map(() => "?").join(",");

    const [menuItems] = await connection.query(
      `SELECT
           id,
           name,
           price,
           stock
         FROM menu_items
         WHERE restaurant_id = ?
         AND active = 1
         AND id IN (${placeholders})
         FOR UPDATE`,
      [req.user.restaurantId, ...ids],
    );

    if (menuItems.length !== ids.length) {
      const error = new Error("One or more menu items are unavailable");

      error.status = 400;
      throw error;
    }

    let total = 0;

    for (const item of menuItems) {
      const quantity = quantities.get(item.id);

      if (item.stock < quantity) {
        const error = new Error(`${item.name} only has ${item.stock} left`);

        error.status = 409;
        throw error;
      }

      total += Number(item.price) * quantity;
    }
    const [order] = await connection.query(
      `INSERT INTO orders
     (
       restaurant_id,
       table_number,
       waiter_id,
       order_note,
       total
     )
   VALUES (?, ?, ?, ?, ?)`,
      [
        req.user.restaurantId,
        tableNumber,
        req.user.id,
        orderNote || null,
        total,
      ],
    );

    for (const item of menuItems) {
      const quantity = quantities.get(item.id);

      await connection.query(
        `INSERT INTO order_items
             (
               order_id,
               item_name,
               price,
               quantity
             )
           VALUES (?, ?, ?, ?)`,
        [order.insertId, item.name, item.price, quantity],
      );

      await connection.query(
        `UPDATE menu_items
           SET stock = stock - ?
           WHERE id = ?`,
        [quantity, item.id],
      );
    }

    await connection.commit();

    res.status(201).json({
      id: order.insertId,
      total,
    });
  } catch (error) {
    await connection.rollback();

    console.error(error);

    res.status(error.status || 500).json({
      message: error.status ? error.message : "Unable to create the order",
    });
  } finally {
    connection.release();
  }
});

router.patch(
  "/:id",
  protect,
  allowRoles("admin", "manager", "kitchen"),
  async (req, res) => {
    const transitions = {
      New: "Preparing",
      Preparing: "Ready",
      Ready: "Completed",
    };

    try {
      const [rows] = await db.query(
        `SELECT status
         FROM orders
         WHERE id = ?
         AND restaurant_id = ?`,
        [req.params.id, req.user.restaurantId],
      );

      if (!rows.length) {
        return res.status(404).json({
          message: "Order not found",
        });
      }

      if (transitions[rows[0].status] !== req.body.status) {
        return res.status(400).json({
          message: "Invalid order status change",
        });
      }

      await db.query(
        `UPDATE orders
         SET status = ?
         WHERE id = ?
         AND restaurant_id = ?`,
        [req.body.status, req.params.id, req.user.restaurantId],
      );

      res.sendStatus(204);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Unable to update order status",
      });
    }
  },
);

router.patch("/:id/payment", protect, allowRoles("admin", "manager"), async (req, res) => {
  const status = String(req.body.status || "");

  const method = String(req.body.method || "");

  const validStatuses = ["Unpaid", "Paid"];

  const validMethods = ["Cash", "Card", "Mobile Money"];

  if (
    !validStatuses.includes(status) ||
    (status === "Paid" && !validMethods.includes(method))
  ) {
    return res.status(400).json({
      message: "Select a valid payment status and method",
    });
  }

  try {
    const [result] = await db.query(
      `UPDATE orders
         SET
           payment_status = ?,
           payment_method = ?,
           paid_at =
             CASE
               WHEN ? = 'Paid'
               THEN CURRENT_TIMESTAMP
               ELSE NULL
             END
         WHERE id = ?
         AND restaurant_id = ?`,
      [
        status,
        status === "Paid" ? method : null,
        status,
        req.params.id,
        req.user.restaurantId,
      ],
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    res.sendStatus(204);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Unable to record payment",
    });
  }
});

export default router;
