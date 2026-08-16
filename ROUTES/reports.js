import { Router } from "express";
import db from "../db.js";

import { protect, allowRoles } from "../authMiddleware.js";

const router = Router();

router.get("/sales", protect, allowRoles("admin", "manager"), async (req, res) => {
  const requestedDays = Number(req.query.days) || 30;

  const days = Math.min(365, Math.max(1, requestedDays));

  try {
    const [summary] = await db.query(
      `SELECT
         COUNT(*) AS orders,
         COALESCE(SUM(total), 0) AS gross_sales,
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
       AND created_at >= DATE_SUB(
         CURRENT_DATE,
         INTERVAL ? DAY
       )`,
      [req.user.restaurantId, days],
    );

    const [daily] = await db.query(
      `SELECT
         DATE(created_at) AS day,
         COUNT(*) AS orders,
         SUM(total) AS sales
       FROM orders
       WHERE restaurant_id = ?
       AND created_at >= DATE_SUB(
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
         SUM(total) AS total
       FROM orders
       WHERE restaurant_id = ?
       AND created_at >= DATE_SUB(
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
    console.error(error);

    res.status(500).json({
      message: "Unable to load the sales report",
    });
  }
});

export default router;
