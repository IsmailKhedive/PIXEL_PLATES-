

USE pixel_plates;

CREATE TABLE IF NOT EXISTS table_devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  restaurant_id INT NOT NULL,
  table_number VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  key_hash CHAR(64) NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NULL,

  UNIQUE KEY uq_table_device (
    restaurant_id,
    table_number
  ),

  FOREIGN KEY (restaurant_id)
    REFERENCES restaurants(id)
    ON DELETE CASCADE
);

DELIMITER //

DROP PROCEDURE IF EXISTS migrate_pixel_plates_001//

CREATE PROCEDURE migrate_pixel_plates_001()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'menu_items'
      AND COLUMN_NAME = 'image_url'
  ) THEN
    ALTER TABLE menu_items
      ADD COLUMN image_url VARCHAR(500) NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'orders'
      AND COLUMN_NAME = 'waiter_id'
      AND IS_NULLABLE = 'NO'
  ) THEN
    ALTER TABLE orders
      MODIFY waiter_id INT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'orders'
      AND COLUMN_NAME = 'device_id'
  ) THEN
    ALTER TABLE orders
      ADD COLUMN device_id INT NULL
      AFTER waiter_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'orders'
      AND COLUMN_NAME = 'payment_status'
  ) THEN
    ALTER TABLE orders
      ADD COLUMN payment_status VARCHAR(20)
      NOT NULL DEFAULT 'Unpaid'
      AFTER status;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'orders'
      AND COLUMN_NAME = 'payment_method'
  ) THEN
    ALTER TABLE orders
      ADD COLUMN payment_method VARCHAR(30) NULL
      AFTER payment_status;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'orders'
      AND COLUMN_NAME = 'paid_at'
  ) THEN
    ALTER TABLE orders
      ADD COLUMN paid_at TIMESTAMP NULL
      AFTER payment_method;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'orders'
      AND CONSTRAINT_NAME = 'fk_orders_device'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT fk_orders_device
      FOREIGN KEY (device_id)
      REFERENCES table_devices(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'orders'
      AND INDEX_NAME = 'idx_orders_device'
  ) THEN
    CREATE INDEX idx_orders_device
      ON orders(device_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'orders'
      AND INDEX_NAME = 'idx_orders_payment'
  ) THEN
    CREATE INDEX idx_orders_payment
      ON orders(
        restaurant_id,
        payment_status,
        created_at
      );
  END IF;
END//

DELIMITER ;

CALL migrate_pixel_plates_001();

DROP PROCEDURE migrate_pixel_plates_001;