import "dotenv/config";
import bcrypt from "bcryptjs";

import db from "./db.js";

const restaurantName =
  process.env.SEED_RESTAURANT_NAME || "Pixel Plates Restaurant";

const adminName = process.env.SEED_ADMIN_NAME || "Restaurant Admin";

const adminEmail = String(process.env.SEED_ADMIN_EMAIL || "")
  .trim()
  .toLowerCase();

const adminPassword = process.env.SEED_ADMIN_PASSWORD || "";

if (!adminEmail || adminPassword.length < 8) {
  console.error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env.");

  process.exit(1);
}

const connection = await db.getConnection();

try {
  await connection.beginTransaction();

  const [restaurants] = await connection.query(
    `SELECT id
       FROM restaurants
       WHERE name = ?
       LIMIT 1`,
    [restaurantName],
  );

  let restaurantId = restaurants[0]?.id;

  if (!restaurantId) {
    const [result] = await connection.query(
      `INSERT INTO restaurants (name)
         VALUES (?)`,
      [restaurantName],
    );

    restaurantId = result.insertId;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await connection.query(
    `INSERT INTO users
       (
         restaurant_id,
         name,
         email,
         password,
         role
       )
     VALUES (?, ?, ?, ?, 'admin')
     ON DUPLICATE KEY UPDATE
       restaurant_id = VALUES(restaurant_id),
       name = VALUES(name),
       password = VALUES(password),
       role = 'admin'`,
    [restaurantId, adminName, adminEmail, passwordHash],
  );

  const [menuCount] = await connection.query(
    `SELECT COUNT(*) AS count
       FROM menu_items
       WHERE restaurant_id = ?`,
    [restaurantId],
  );

  if (!menuCount[0].count) {
    await connection.query(
      `INSERT INTO menu_items
         (
           restaurant_id,
           name,
           category,
           price,
           stock
         )
       VALUES
         (?, 'Grilled Chicken', 'Mains', 28000, 30),
         (?, 'Beef Burger', 'Mains', 24000, 25),
         (?, 'Garden Salad', 'Starters', 14000, 20),
         (?, 'Fresh Passion Juice', 'Drinks', 8000, 40)`,
      [restaurantId, restaurantId, restaurantId, restaurantId],
    );
  }

  await connection.commit();

  console.log(`Ready: ${restaurantName}`);

  console.log(`Admin login: ${adminEmail}`);
} catch (error) {
  await connection.rollback();
  console.error(error.message);
  process.exitCode = 1;
} finally {
  connection.release();
  await db.end();
}
