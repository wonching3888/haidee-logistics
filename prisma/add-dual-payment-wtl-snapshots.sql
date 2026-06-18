ALTER TABLE inbound_lines
  ADD COLUMN IF NOT EXISTS dual_payment_wtl_rate DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS dual_payment_wtl_amount DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS dual_payment_wtl_consignee_id UUID REFERENCES consignees(id);
