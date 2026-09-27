ALTER TABLE menu_items
  ADD COLUMN promotional_label VARCHAR(50) NULL
    AFTER category,
  ADD COLUMN description VARCHAR(500) NULL
    AFTER promotional_label,
  ADD COLUMN discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0
    AFTER price,
  ADD COLUMN promotion_start DATETIME NULL
    AFTER discount_percent,
  ADD COLUMN promotion_end DATETIME NULL
    AFTER promotion_start,
  ADD COLUMN featured TINYINT(1) NOT NULL DEFAULT 0
    AFTER promotion_end;
CREATE INDEX idx_menu_promotions
  ON menu_items (
    restaurant_id,
    featured,
    promotion_start,
    promotion_end
  );