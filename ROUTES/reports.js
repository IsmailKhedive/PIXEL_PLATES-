import { Router } from "express";
import db from "../db.js";
import { protect, allowRoles, admin } from "../authMiddleware.js";

const router = Router();

function getDays(value) {
  const requestedDays = Number(value) || 30;

  return Math.min(365, Math.max(1, requestedDays));
}

function csvValue(value) {
  const text = String(value ?? "");

  return `"${text.replace(/"/g, '""')}"`;
}

router.get(
  "/sales",
  protect,
  allowRoles("admin", "manager"),
  async (req, res) => {
    const days = getDays(req.query.days);

    try {
      const [summary] = await db.query(
        `SELECT
           COUNT(*) AS orders,

           COALESCE(
             SUM(total),
             0
           ) AS gross_sales,

           COALESCE(
             SUM(
               CASE
                 WHEN payment_status = 'Paid'
                 THEN total
                 ELSE 0
               END
             ),
             0
           ) AS paid_sales,

           COALESCE(
             SUM(
               CASE
                 WHEN payment_status = 'Unpaid'
                 THEN total
                 ELSE 0
               END
             ),
             0
           ) AS outstanding

         FROM orders

         WHERE restaurant_id = ?
         AND created_at >=
           DATE_SUB(
             CURRENT_DATE,
             INTERVAL ? DAY
           )`,
        [req.user.restaurantId, days],
      );

      const [daily] = await db.query(
        `SELECT
           DATE(created_at) AS day,
           COUNT(*) AS orders,
           COALESCE(SUM(total), 0) AS sales

         FROM orders

         WHERE restaurant_id = ?
         AND created_at >=
           DATE_SUB(
             CURRENT_DATE,
             INTERVAL ? DAY
           )

         GROUP BY DATE(created_at)
         ORDER BY day`,
        [req.user.restaurantId, days],
      );

      const [payments] = await db.query(
        `SELECT
           COALESCE(
             payment_method,
             'Unpaid'
           ) AS method,

           COUNT(*) AS orders,
           COALESCE(SUM(total), 0) AS total

         FROM orders

         WHERE restaurant_id = ?
         AND created_at >=
           DATE_SUB(
             CURRENT_DATE,
             INTERVAL ? DAY
           )

         GROUP BY COALESCE(
           payment_method,
           'Unpaid'
         )`,
        [req.user.restaurantId, days],
      );

      res.json({
        days,
        summary: summary[0],
        daily,
        payments,
      });
    } catch (error) {
      console.error("Sales report error:", error);

      res.status(500).json({
        message: "Unable to load the sales report",
      });
    }
  },
);

router.get("/sales/export", protect, admin, async (req, res) => {
  const days = getDays(req.query.days);

  try {
    const [orders] = await db.query(
      `SELECT
           o.id AS order_id,
           o.created_at,
           o.table_number,

           COALESCE(
             u.name,
             'Table tablet'
           ) AS served_by,

           o.status,
           o.payment_status,

           COALESCE(
             o.payment_method,
             ''
           ) AS payment_method,

           o.total,
           o.order_note

         FROM orders o

         LEFT JOIN users u
           ON u.id = o.waiter_id

         WHERE o.restaurant_id = ?
         AND o.created_at >=
           DATE_SUB(
             CURRENT_DATE,
             INTERVAL ? DAY
           )

         ORDER BY o.created_at DESC`,
      [req.user.restaurantId, days],
    );

    const headings = [
      "Order ID",
      "Date and Time",
      "Table",
      "Served By",
      "Order Status",
      "Payment Status",
      "Payment Method",
      "Total",
      "Order Note",
    ];

    const rows = orders.map((order) => [
      order.order_id,

      order.created_at ? new Date(order.created_at).toISOString() : "",

      order.table_number,
      order.served_by,
      order.status,
      order.payment_status,
      order.payment_method,
      order.total,
      order.order_note || "",
    ]);

    const csv = [headings, ...rows]
      .map((row) => row.map(csvValue).join(","))
      .join("\r\n");

    const date = new Date().toISOString().slice(0, 10);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="pixel-plates-sales-${date}.csv"`,
    );

    res.send(`\uFEFF${csv}`);
  } catch (error) {
    console.error("Sales export error:", error);

    res.status(500).json({
      message: "Unable to download the sales report",
    });
  }
});

export default router;
