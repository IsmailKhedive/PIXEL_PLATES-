USE pixel_plates;
DELIMITER //
DROP PROCEDURE IF EXISTS migrate_pixel_plates_002//
CREATE PROCEDURE migrate_pixel_plates_002()
BEGIN 
  ALTER TABLE users
    MODIFY COLUMN role ENUM(
      'admin',
      'manager',
      'waiter',
      'kitchen'
    ) NOT NULL DEFAULT 'waiter';
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'orders'
      AND COLUMN_NAME = 'order_note'
  ) THEN
    ALTER TABLE orders
      ADD COLUMN order_note VARCHAR(500) NULL
      AFTER device_id;
  END IF;
  UPDATE menu_items
  SET category =
    CASE LOWER(TRIM(category))
      WHEN 'main' THEN 'Main dishes'
      WHEN 'mains' THEN 'Main dishes'
      WHEN 'main dish' THEN 'Main dishes'
      WHEN 'main dishes' THEN 'Main dishes'
      WHEN 'starter' THEN 'Appetizer'
      WHEN 'starters' THEN 'Appetizer'
      WHEN 'appetizer' THEN 'Appetizer'
      WHEN 'appetizers' THEN 'Appetizer'
      WHEN 'drink' THEN 'Drinks'
      WHEN 'drinks' THEN 'Drinks'
      WHEN 'dessert' THEN 'Desserts'
      WHEN 'desserts' THEN 'Desserts'
      WHEN 'extra' THEN 'Extras'
      WHEN 'extras' THEN 'Extras'
      WHEN 'chef pick' THEN 'Chef''s picks'
      WHEN 'chef picks' THEN 'Chef''s picks'
      WHEN 'chef''s pick' THEN 'Chef''s picks'
      WHEN 'chef''s picks' THEN 'Chef''s picks'
      ELSE category
    END;
END//
DELIMITER ;
CALL migrate_pixel_plates_002();
DROP PROCEDURE IF EXISTS migrate_pixel_plates_002;