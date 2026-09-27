import express from "express";
import bcrypt from "bcryptjs";
import pool from "../db.js";
import { protect, admin, allowRoles } from "../authMiddleware.js";
const router = express.Router();
router.get("/", protect, allowRoles("admin", "manager"), async (req, res) => {
  try {
    const [users] = await pool.query(
      `
          SELECT
            id,
            name,
            email,
            role,
            created_at
          FROM users
          WHERE restaurant_id = ?
          ORDER BY
            FIELD(role, 'admin', 'manager', 'waiter', 'kitchen'),
            name
        `,
      [req.user.restaurantId],
    );
    res.json(users);
  } catch (error) {
    console.error("List users error:", error);
    res.status(500).json({
      message: "Unable to load staff accounts",
    });
  }
});
router.post("/", protect, allowRoles("admin", "manager"), async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "")
    .trim()
    .toLowerCase();
  const password = String(req.body.password || "");
  const role = String(req.body.role || "").toLowerCase();
  if (!name || !email || !password || !role) {
    return res.status(400).json({
      message: "Name, email, password and role are required",
    });
  }
  if (password.length < 8) {
    return res.status(400).json({
      message: "Password must contain at least 8 characters",
    });
  }
  const adminRoles = ["manager", "waiter", "kitchen"];
  const managerRoles = ["waiter", "kitchen"];
  const allowedRoles = req.user.role === "admin" ? adminRoles : managerRoles;
  if (!allowedRoles.includes(role)) {
    return res.status(403).json({
      message: "You cannot create this type of account",
    });
  }
  try {
    const [existing] = await pool.query(
      `
          SELECT id
          FROM users
          WHERE email = ?
          LIMIT 1
        `,
      [email],
    );
    if (existing.length > 0) {
      return res.status(409).json({
        message: "An account with this email already exists",
      });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await pool.query(
      `
          INSERT INTO users (
            restaurant_id,
            name,
            email,
            password,
            role
          )
          VALUES (?, ?, ?, ?, ?)
        `,
      [req.user.restaurantId, name, email, passwordHash, role],
    );
    res.status(201).json({
      id: result.insertId,
      name,
      email,
      role,
      message: "Staff account created",
    });
  } catch (error) {
    console.error("Create user error:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "An account with this email already exists",
      });
    }
    res.status(500).json({
      message: "Unable to create staff account",
    });
  }
});
router.patch("/:id/password", protect, admin, async (req, res) => {
  const userId = Number(req.params.id);
  const password = String(req.body.password || "");
  if (!Number.isInteger(userId) || userId < 1) {
    return res.status(400).json({
      message: "Invalid staff account",
    });
  }
  if (password.length < 8) {
    return res.status(400).json({
      message: "Password must contain at least 8 characters",
    });
  }
  try {
    const [users] = await pool.query(
      `
          SELECT id, name, role
          FROM users
          WHERE id = ?
            AND restaurant_id = ?
          LIMIT 1
        `,
      [userId, req.user.restaurantId],
    );
    if (users.length === 0) {
      return res.status(404).json({
        message: "Staff account not found",
      });
    }
    const targetUser = users[0];
    if (targetUser.role === "admin") {
      return res.status(403).json({
        message: "Admin passwords cannot be reset here",
      });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await pool.query(
      `
          UPDATE users
          SET password_hash = ?
          WHERE id = ?
            AND restaurantId = ?
        `,
      [passwordHash, userId, req.user.restaurantId],
    );
    res.json({
      message: `${targetUser.name}'s password was reset`,
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      message: "Unable to reset the password",
    });
  }
});
router.delete("/:id", protect, admin, async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId < 1) {
    return res.status(400).json({
      message: "Invalid staff account",
    });
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [users] = await connection.query(
      `
          SELECT id, name, role
          FROM users
          WHERE id = ?
            AND restaurant_id = ?
          LIMIT 1
          FOR UPDATE
        `,
      [userId, req.user.restaurantId],
    );
    if (users.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        message: "Staff account not found",
      });
    }
    const targetUser = users[0];
    if (targetUser.role === "admin") {
      await connection.rollback();
      return res.status(403).json({
        message: "The administrator account cannot be removed",
      });
    }
    await connection.query(
      `
          UPDATE orders
          SET waiter_id = NULL
          WHERE waiter_id = ?
            AND restaurantId = ?
        `,
      [userId, req.user.restaurantId],
    );
    await connection.query(
      `
          DELETE FROM users
          WHERE id = ?
            AND restaurantId = ?
        `,
      [userId, req.user.restaurantId],
    );
    await connection.commit();
    res.json({
      message: `${targetUser.name}'s account was removed`,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Delete user error:", error);
    res.status(500).json({
      message: "Unable to remove the staff account",
    });
  } finally {
    connection.release();
  }
});
export default router;
