import { Router } from "express";
import db from "../db.js";
import { tableDevice } from "../authMiddleware.js";

const router = Router();


router.use(tableDevice);


router.get("/session", async (req, res) => {
  try {
    const [restaurants] = await db.query(
      `SELECT name
       FROM restaurants
       WHERE id = ?`,
      [req.device.restaurant_id],
    );

    res.json({
      tableNumber: req.device.table_number,
      deviceName: req.device.name,
      restaurantName: restaurants[0]?.name,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Unable to load the tablet session",
    });
  }
});


router.get("/menu", async (req, res) => {
  try {
    const [items] = await db.query(
      `SELECT
         id,
         name,
         category,
         price,
         stock,
         image_url
       FROM menu_items
       WHERE restaurant_id = ?
       AND active = 1
       ORDER BY category, name`,
      [req.device.restaurant_id],
    );

    res.json(items);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Unable to load the menu",
    });
  }
});


router.get("/orders", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         o.id,
         o.total,
         o.status,
         o.payment_status,
         o.created_at,
         oi.item_name,
         oi.quantity,
         oi.price
       FROM orders o
       LEFT JOIN order_items oi
         ON oi.order_id = o.id
       WHERE o.device_id = ?
       ORDER BY o.created_at DESC, oi.id`,
      [req.device.id],
    );

    const orders = [];
    const orderMap = new Map();

    for (const row of rows) {
      if (!orderMap.has(row.id)) {
        const order = {
          id: row.id,
          total: row.total,
          status: row.status,
          payment_status: row.payment_status,
          created_at: row.created_at,
          items: [],
        };

        orderMap.set(row.id, order);
        orders.push(order);
      }

      if (row.item_name) {
        orderMap.get(row.id).items.push({
          item_name: row.item_name,
          quantity: row.quantity,
          price: row.price,
        });
      }
    }

    res.json(orders);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Unable to load your orders",
    });
  }
});


router.post("/orders", async (req, res) => {
  const requestedItems = Array.isArray(req.body.items) ? req.body.items : [];

  const quantities = new Map();

  for (const entry of requestedItems) {
    const id = Number(entry.id);
    const quantity = Number(entry.quantity);

    if (!Number.isInteger(id) || !Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({
        message: "Invalid order item",
      });
    }

    quantities.set(id, (quantities.get(id) || 0) + quantity);
  }

  if (!quantities.size) {
    return res.status(400).json({
      message: "Add at least one item",
    });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const ids = [...quantities.keys()];
    const placeholders = ids.map(() => "?").join(",");

  
    const [items] = await connection.query(
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
      [req.device.restaurant_id, ...ids],
    );

    if (items.length !== ids.length) {
      const error = new Error("An item is no longer available");

      error.status = 400;
      throw error;
    }

    let total = 0;

    for (const item of items) {
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
           device_id,
           total
         )
       VALUES (?, ?, NULL, ?, ?)`,
      [req.device.restaurant_id, req.device.table_number, req.device.id, total],
    );

    for (const item of items) {
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
      message: error.status ? error.message : "Unable to place order",
    });
  } finally {
    connection.release();
  }
});

export default router;
