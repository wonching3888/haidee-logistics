-- Truck operating cost fields + fuel price settings

ALTER TABLE trucks ADD COLUMN IF NOT EXISTS country VARCHAR NOT NULL DEFAULT 'MY';
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS fuel_efficiency_km_per_l DECIMAL(10, 2);
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS annual_mileage_km INTEGER;

CREATE TABLE IF NOT EXISTS truck_cost_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id UUID NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  annual_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS fuel_prices (
  id VARCHAR PRIMARY KEY DEFAULT 'default',
  myr_per_liter DECIMAL(10, 4) NOT NULL DEFAULT 2.05,
  thb_per_liter DECIMAL(10, 4) NOT NULL DEFAULT 35.00,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO fuel_prices (id, myr_per_liter, thb_per_liter)
VALUES ('default', 2.05, 35.00)
ON CONFLICT (id) DO NOTHING;
