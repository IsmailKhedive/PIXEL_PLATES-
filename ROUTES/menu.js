import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import db from "../db.js";
import { protect, allowRoles } from "../authMiddleware.js";
const router = Router();
const CATEGORY_ALIASES = {
  main: "Main dishes",
  mains: "Main dishes",
  "main dish": "Main dishes",
  "main dishes": "Main dishes",
  starter: "Appetizer",
  starters: "Appetizer",
  appetizer: "Appetizer",
  appetizers: "Appetizer",
  drink: "Drinks",
  drinks: "Drinks",
  dessert: "Desserts",
  desserts: "Desserts",
  extra: "Extras",
  extras: "Extras",
  "chef pick": "Chef's picks",
  "chef picks": "Chef's picks",
  "chef's pick": "Chef's picks",
  "chef's picks": "Chef's picks",
};
function normalizeCategory(value) {
  const suppliedCategory = String(value || "")
    .trim()
    .toLowerCase();
  const category = CATEGORY_ALIASES[suppliedCategory];
  if (!category) {
    const error = new Error("Select a valid menu category");
    error.status = 400;
    throw error;
  }
  return category;
}
router.get("/", protect, async (req, res) => {
  try {
    const includeInactive =
      ["admin", "manager"].includes(req.user.role) && req.query.all === "1";
    const inactiveFilter = includeInactive ? "" : "AND active = 1";
    const [items] = await db.query(
      `SELECT
         id,
         name,
         category,
         price,
         preparation_minutes,
         active,
         stock,
         image_url
       FROM menu_items
       WHERE restaurant_id = ?
       ${inactiveFilter}
       ORDER BY category, name`,
      [req.user.restaurantId],
    );
    res.json(items);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Unable to load the menu",
    });
  }
});
router.post("/", protect, allowRoles("admin", "manager"), async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const category = normalizeCategory(req.body.category);
   const price = Number(req.body.price);
   const preparationMinutes = Number(req.body.preparationMinutes || 15);
   const stock = Number(req.body.stock ?? 0);
    if (
      !name ||
      name.length > 120 ||
      !category ||
      category.length > 60 ||
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      return res.status(400).json({
        message: "Enter a valid name, category, price, and stock quantity",
      });
    }
    const imageUrl = await saveImage(req.body.imageData);
    const [result] = await db.query(
      `INSERT INTO menu_items
           (
             restaurant_id,
             name,
             category,
             price,
             preparation_minutes,
             stock,
             image_url
           )
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.restaurantId, name, category, price, preparationMinutes, stock, imageUrl],
    );
    res.status(201).json({
      id: result.insertId,
    });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({
      message: error.status ? error.message : "Unable to create the menu item",
    });
  }
});
router.patch(
  "/:id",
  protect,
  allowRoles("admin", "manager"),
  async (req, res) => {
    try {
      const allowedFields = [
        "name",
        "category",
        "price",
        "preparation_minutes",
        "stock",
        "active",
      ];
      if (req.body.preparationMinutes !== undefined) {
        req.body.preparation_minutes = req.body.preparationMinutes;
      }
      const updates = [];
      const values = [];
      for (const field of allowedFields) {
        if (req.body[field] === undefined) {
          continue;
        }
        let value = req.body[field];
        if (field === "name") {
          value = String(value).trim();
        }
        if (field === "category") {
          value = normalizeCategory(value);
        }
        if (
          field === "price" ||
          field === "stock" ||
          field === "preparation_minutes"
        ) {
          value = Number(value);
        }
        if (field === "active") {
          value = value ? 1 : 0;
        }
        updates.push(`${field} = ?`);
        values.push(value);
      }
      if (req.body.imageData) {
        const imageUrl = await saveImage(req.body.imageData);
        updates.push("image_url = ?");
        values.push(imageUrl);
      }
      const invalidName =
        req.body.name !== undefined &&
        (!String(req.body.name).trim() ||
          String(req.body.name).trim().length > 120);
      const invalidPrice =
        req.body.price !== undefined &&
        (!Number.isFinite(Number(req.body.price)) ||
          Number(req.body.price) < 0);
      const invalidStock =
        req.body.stock !== undefined &&
        (!Number.isInteger(Number(req.body.stock)) ||
          Number(req.body.stock) < 0);
      if (!updates.length || invalidName || invalidPrice || invalidStock) {
        return res.status(400).json({
          message: "No valid menu changes were supplied",
        });
      }
      const invalidPreparationTime =
        req.body.preparation_minutes !== undefined &&
        (!Number.isInteger(Number(req.body.preparation_minutes)) ||
          Number(req.body.preparation_minutes) < 1 ||
          Number(req.body.preparation_minutes) > 300);
      if (invalidPreparationTime) {
        return res.status(400).json({
          message: "Preparation time must be an integer between 1 and 300",
        });
      }
      if (
  !updates.length ||
  invalidName ||
  invalidPrice ||
  invalidStock ||
  invalidPreparationTime
) {
  return res.status(400).json({
    message: "No valid menu changes were supplied",
  });
}
      values.push(req.params.id, req.user.restaurantId);
      const [result] = await db.query(
        `UPDATE menu_items
         SET ${updates.join(", ")}
         WHERE id = ?
         AND restaurant_id = ?`,
        values,
      );
      if (!result.affectedRows) {
        return res.status(404).json({
          message: "Menu item not found",
        });
      }
      res.sendStatus(204);
    } catch (error) {
      console.error(error);
      res.status(error.status || 500).json({
        message: error.status
          ? error.message
          : "Unable to update the menu item",
      });
    }
  },
);
router.delete(
  "/:id",
  protect,
  allowRoles("admin", "manager"),
  async (req, res) => {
    try {
      const [result] = await db.query(
        `UPDATE menu_items
         SET active = 0
         WHERE id = ?
         AND restaurant_id = ?`,
        [req.params.id, req.user.restaurantId],
      );
      if (!result.affectedRows) {
        return res.status(404).json({
          message: "Menu item not found",
        });
      }
      res.sendStatus(204);
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Unable to hide the menu item",
      });
    }
  },
);
export default router;
async function saveImage(dataUrl) {
  if (!dataUrl) {
    return null;
  }
  const match = String(dataUrl).match(
    /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/,
  );
  if (!match) {
    const error = new Error("Use a JPG, PNG, or WebP image");
    error.status = 400;
    throw error;
  }
  const imageType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
    const error = new Error("Image must be smaller than 5 MB");
    error.status = 400;
    throw error;
  }
  const signatures = {
    jpeg: (value) =>
      value.length >= 3 &&
      value[0] === 0xff &&
      value[1] === 0xd8 &&
      value[2] === 0xff,
    png: (value) =>
      value.length >= 8 &&
      value
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    webp: (value) =>
      value.length >= 12 &&
      value.subarray(0, 4).toString("ascii") === "RIFF" &&
      value.subarray(8, 12).toString("ascii") === "WEBP",
  };
  if (!signatures[imageType](buffer)) {
    const error = new Error("The uploaded file is not a valid image");
    error.status = 400;
    throw error;
  }
  const directory = path.resolve("PUBLIC", "uploads");
  await fs.mkdir(directory, {
    recursive: true,
  });
  const extension = imageType === "jpeg" ? "jpg" : imageType;
  const filename = `${crypto.randomUUID()}.${extension}`;
  await fs.writeFile(path.join(directory, filename), buffer, {
    flag: "wx",
  });
  return `/uploads/${filename}`;
}
