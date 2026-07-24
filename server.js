import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./ROUTES/auth.js";
import menuRoutes from "./ROUTES/menu.js";
import ordersRoutes from "./ROUTES/orders.js";
import usersRoutes from "./ROUTES/users.js";
import devicesRoutes from "./ROUTES/devices.js";
import reportsRoutes from "./ROUTES/reports.js";
import customerRoutes from "./ROUTES/customer.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "6mb" }));
app.use(express.static("PUBLIC"));

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/devices", devicesRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/customer", customerRoutes);

app.use("/api", (req, res) => {
  res.status(404).json({ message: "API endpoint not found" });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ message: "Unexpected server error" });
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Pixel Plates running on http://localhost:${port}`);
});
