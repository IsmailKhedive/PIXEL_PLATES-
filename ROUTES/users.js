import { Router } from "express";
import bcrypt from "bcryptjs";

import db from "../db.js";
import { protect, admin } from "../authMiddleware.js";

const router = Router();

/*
 * Only administrators may view staff accounts.
 */
router.get("/", protect, admin, async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT
           id,
           name,
           email,
           role
         FROM users
         WHERE restaurant_id = ?
         ORDER BY name`,
      [req.user.restaurantId],
    );

    res.json(users);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Unable to load staff accounts",
    });
  }
});

/*
 * Only administrators may create staff accounts.
 */
router.post("/", protect, admin, async (req, res) => {
  const name = String(req.body.name || "").trim();

  const email = String(req.body.email || "")
    .trim()
    .toLowerCase();

  const password = String(req.body.password || "");

  const role = String(req.body.role || "");

  const validRoles = ["admin", "waiter", "kitchen"];

  if (
    !name ||
    name.length > 100 ||
    !email ||
    email.length > 120 ||
    password.length < 8 ||
    !validRoles.includes(role)
  ) {
    return res.status(400).json({
      message:
        "Provide a name, email, role, and password of at least 8 characters",
    });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    await db.query(
      `INSERT INTO users
           (
             restaurant_id,
             name,
             email,
             password,
             role
           )
         VALUES (?, ?, ?, ?, ?)`,
      [req.user.restaurantId, name, email, passwordHash, role],
    );

    res.sendStatus(201);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "That email address is already in use",
      });
    }

    console.error(error);

    res.status(500).json({
      message: "Unable to create the staff account",
    });
  }
});

export default router;
