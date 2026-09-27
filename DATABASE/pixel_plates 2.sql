CREATE DATABASE IF NOT EXISTS pixel_plates
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE pixel_plates;
CREATE TABLE IF NOT EXISTS restaurants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  created_at TIMESTAMP
    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  restaurant_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL,
  password VARCHAR(255) NOT NULL,
role ENUM(
  'admin',
  'manager',
  'waiter',
  'kitchen'
) NOT NULL DEFAULT 'waiter',
  created_at TIMESTAMP
    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_restaurant (
    restaurant_id
  ),
  CONSTRAINT fk_users_restaurant
    FOREIGN KEY (restaurant_id)
    REFERENCES restaurants(id)
    ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS menu_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  restaurant_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,
  category VARCHAR(60),
  price DECIMAL(10, 2) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  stock INT NOT NULL DEFAULT 100,
  image_url VARCHAR(500) NULL,
  created_at TIMESTAMP
    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_menu_restaurant_active (
    restaurant_id,
    active
  ),
  CONSTRAINT fk_menu_restaurant
    FOREIGN KEY (restaurant_id)
    REFERENCES restaurants(id)
    ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS table_devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  restaurant_id INT NOT NULL,
  table_number VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  key_hash CHAR(64) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP
    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NULL,
  UNIQUE KEY uq_device_key_hash (
    key_hash
  ),
  UNIQUE KEY uq_table_device (
    restaurant_id,
    table_number
  ),
  CONSTRAINT fk_device_restaurant
    FOREIGN KEY (restaurant_id)
    REFERENCES restaurants(id)
    ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  restaurant_id INT NOT NULL,
  table_number VARCHAR(20) NOT NULL,
  waiter_id INT NULL,
  device_id INT NULL,
  order_note VARCHAR(500) NULL,
  total DECIMAL(10, 2) NOT NULL,
  status ENUM(
    'New',
    'Preparing',
    'Ready',
    'Completed'
  ) NOT NULL DEFAULT 'New',
  payment_status ENUM(
    'Unpaid',
    'Paid'
  ) NOT NULL DEFAULT 'Unpaid',
  payment_method ENUM(
    'Cash',
    'Card',
    'Mobile Money'
  ) NULL,
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP
    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_orders_restaurant_created (
    restaurant_id,
    created_at
  ),
  KEY idx_orders_device (
    device_id
  ),
  KEY idx_orders_payment (
    restaurant_id,
    payment_status,
    created_at
  ),
  CONSTRAINT fk_orders_restaurant
    FOREIGN KEY (restaurant_id)
    REFERENCES restaurants(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_orders_waiter
    FOREIGN KEY (waiter_id)
    REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_orders_device
    FOREIGN KEY (device_id)
    REFERENCES table_devices(id)
    ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  item_name VARCHAR(120) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  quantity INT NOT NULL,
  KEY idx_order_items_order (
    order_id
  ),
  CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id)
    REFERENCES orders(id)
    ON DELETE CASCADE
);