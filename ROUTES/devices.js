import { Router } from "express";
import crypto from "crypto";
import db from "../db.js";
import { protect, admin } from "../authMiddleware.js";

const router = Router();

router.use(protect, admin);


router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         id,
         table_number,
         name,
         active,
         created_at,
         last_seen_at
       FROM table_devices
       WHERE restaurant_id = ?
       ORDER BY table_number`,
      [req.user.restaurantId],
    );

    res.json(rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Unable to load registered tablets",
    });
  }
});


router.post("/", async (req, res) => {
  const tableNumber = String(req.body.tableNumber || "").trim();

  const name = String(req.body.name || `Table ${tableNumber}`).trim();

  if (!tableNumber || tableNumber.length > 20 || !name || name.length > 100) {
    return res.status(400).json({
      message: "Enter a valid table number and device name",
    });
  }

  const key = crypto.randomBytes(32).toString("base64url");

  const hash = crypto.createHash("sha256").update(key).digest("hex");

  try {
    const [result] = await db.query(
      `INSERT INTO table_devices
         (restaurant_id, table_number, name, key_hash)
       VALUES (?, ?, ?, ?)`,
      [req.user.restaurantId, tableNumber, name, hash],
    );

    res.status(201).json({
      id: result.insertId,
      key,
      customerUrl: `/customer.html?key=${encodeURIComponent(key)}`,
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "That table already has a device",
      });
    }

    console.error(error);

    res.status(500).json({
      message: "Unable to register the tablet",
    });
  }
});


router.patch("/:id", async (req, res) => {
  try {
    const [result] = await db.query(
      `UPDATE table_devices
       SET active = ?
       WHERE id = ?
       AND restaurant_id = ?`,
      [req.body.active ? 1 : 0, req.params.id, req.user.restaurantId],
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        message: "Tablet not found",
      });
    }

    res.sendStatus(204);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Unable to update the tablet",
    });
  }
});

export default router;
