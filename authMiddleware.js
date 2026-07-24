import jwt from "jsonwebtoken";
import crypto from "crypto";
import db from "./db.js";

export function protect(req, res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Please log in",
    });
  }

  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET);

    next();
  } catch {
    return res.status(401).json({
      message: "Invalid session",
    });
  }
}

export function admin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      message: "Admin access required",
    });
  }

  next();
}

export function allowRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "You do not have permission for this action",
      });
    }

    next();
  };
}

export async function tableDevice(req, res, next) {
  const key = String(req.headers["x-device-key"] || "").trim();

  if (!key || key.length < 32) {
    return res.status(401).json({
      message: "This tablet is not registered",
    });
  }

  try {
    const hash = crypto.createHash("sha256").update(key).digest("hex");

    const [rows] = await db.query(
      `SELECT id, restaurant_id, table_number, name
       FROM table_devices
       WHERE key_hash = ?
       AND active = 1
       LIMIT 1`,
      [hash],
    );

    if (!rows.length) {
      return res.status(401).json({
        message: "Invalid or disabled tablet key",
      });
    }

    req.device = rows[0];

    await db.query(
      `UPDATE table_devices
       SET last_seen_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [rows[0].id],
    );

    next();
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Unable to verify this tablet",
    });
  }
}
