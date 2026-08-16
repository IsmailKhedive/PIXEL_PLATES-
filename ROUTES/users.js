import { Router } from "express";
import bcrypt from "bcryptjs";

import db from "../db.js";

import { protect, allowRoles } from "../authMiddleware.js";

const router = Router();

/*
 * Administrators and managers can view
 * the restaurant staff directory.
 */
router.get("/", protect, allowRoles("admin", "manager"), async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT
           id,
           name,
           email,
           role
         FROM users
         WHERE restaurant_id = ?
         ORDER BY
           FIELD(
             role,
             'admin',
             'manager',
             'waiter',
             'kitchen'
           ),
           name`,
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
 * Admin:
 * - Can create every staff role.
 *
 * Manager:
 * - Can create waiter and kitchen accounts.
 * - Cannot create managers or administrators.
 */
router.post("/", protect, allowRoles("admin", "manager"), async (req, res) => {
  const name = String(req.body.name || "").trim();

  const email = String(req.body.email || "")
    .trim()
    .toLowerCase();

  const password = String(req.body.password || "");

  const role = String(req.body.role || "");

  const adminRoles = ["admin", "manager", "waiter", "kitchen"];

  const managerRoles = ["waiter", "kitchen"];

  const allowedRoles = req.user.role === "admin" ? adminRoles : managerRoles;

  if (
    !name ||
    name.length > 100 ||
    !email ||
    email.length > 120 ||
    password.length < 8 ||
    !allowedRoles.includes(role)
  ) {
    return res.status(400).json({
      message:
        req.user.role === "manager"
          ? "Managers can only create waiter and kitchen accounts"
          : "Provide a valid name, email, role, and password of at least 8 characters",
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
