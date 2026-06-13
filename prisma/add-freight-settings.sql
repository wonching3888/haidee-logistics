-- Phase 1.5a: freight rate master data + exchange rates

ALTER TABLE freight_rates DROP CONSTRAINT IF EXISTS freight_rates_shipper_id_market_id_key;
ALTER TABLE freight_rates
  ADD CONSTRAINT freight_rates_shipper_id_market_id_effective_date_key
  UNIQUE (shipper_id, market_id, effective_date);

CREATE TABLE IF NOT EXISTS consignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR NOT NULL UNIQUE,
  name VARCHAR NOT NULL,
  billing_company VARCHAR NOT NULL DEFAULT 'haidee',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consignee_freight_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consignee_id UUID NOT NULL REFERENCES consignees(id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES markets(id),
  rate_tong DECIMAL(10,2),
  rate_box DECIMAL(10,2),
  effective_date DATE NOT NULL,
  UNIQUE (consignee_id, market_id, effective_date)
);

CREATE TABLE IF NOT EXISTS payment_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipper_id UUID NOT NULL REFERENCES shippers(id) ON DELETE CASCADE,
  consignee_id UUID NOT NULL REFERENCES consignees(id) ON DELETE CASCADE,
  payment_mode VARCHAR NOT NULL,
  UNIQUE (shipper_id, consignee_id)
);

CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month VARCHAR NOT NULL UNIQUE,
  rate DECIMAL(10,4) NOT NULL DEFAULT 8.20,
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
