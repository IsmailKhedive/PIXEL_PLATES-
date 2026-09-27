import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../db.js";
const router = Router();
router.post("/login", async (req, res) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password || "");
    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }
    const [rows] = await db.query(
      `SELECT
         u.id,
         u.restaurant_id,
         u.name,
         u.email,
         u.password,
         u.role,
         r.name AS restaurant_name
       FROM users u
       JOIN restaurants r
         ON r.id = u.restaurant_id
       WHERE u.email = ?
       LIMIT 1`,
      [email],
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        message: "Incorrect email or password",
      });
    }
    if (
  ![
    "admin",
    "manager",
    "waiter",
    "kitchen"
  ].includes(user.role)
) {
      return res.status(401).json({
        message: "Invalid user role",
      });
    }
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured");
    }
    const token = jwt.sign(
      {
        id: user.id,
        restaurantId: user.restaurant_id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "8h",
      },
    );
    res.json({
      token,
      user: {
        name: user.name,
        role: user.role,
        restaurantId: user.restaurant_id,
        restaurantName: user.restaurant_name,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Unable to sign in",
    });
  }
});
export default router;
