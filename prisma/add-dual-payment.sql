-- Dual payment: primary shipper mode (1a) + secondary WTL mode (3) on same line.

ALTER TABLE payment_relations
  ADD COLUMN IF NOT EXISTS dual_payment BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE payment_relations
  ADD COLUMN IF NOT EXISTS secondary_consignee_id UUID REFERENCES consignees(id);

ALTER TABLE payment_relations
  ADD COLUMN IF NOT EXISTS secondary_payment_mode VARCHAR;
