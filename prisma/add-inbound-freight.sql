-- Phase 1.5b: inbound freight snapshots + stall consignee link

ALTER TABLE stalls ADD COLUMN IF NOT EXISTS consignee_id UUID REFERENCES consignees(id);

ALTER TABLE inbound_sessions ADD COLUMN IF NOT EXISTS shipper_currency VARCHAR;

ALTER TABLE inbound_lines ADD COLUMN IF NOT EXISTS consignee_id UUID REFERENCES consignees(id);
ALTER TABLE inbound_lines ADD COLUMN IF NOT EXISTS payment_party VARCHAR;
ALTER TABLE inbound_lines ADD COLUMN IF NOT EXISTS payment_mode VARCHAR;
ALTER TABLE inbound_lines ADD COLUMN IF NOT EXISTS currency VARCHAR;
ALTER TABLE inbound_lines ADD COLUMN IF NOT EXISTS billing_company VARCHAR;
ALTER TABLE inbound_lines ADD COLUMN IF NOT EXISTS freight_rate DECIMAL(10,2);
ALTER TABLE inbound_lines ADD COLUMN IF NOT EXISTS freight_amount DECIMAL(10,2);
ALTER TABLE inbound_lines ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(10,4);
ALTER TABLE inbound_lines ADD COLUMN IF NOT EXISTS mc_delivery_mode VARCHAR;
ALTER TABLE inbound_lines ADD COLUMN IF NOT EXISTS third_party_fee DECIMAL(10,2);
