-- Report query performance indexes (phase 2)
CREATE INDEX IF NOT EXISTS "dispatch_orders_date_status_idx"
ON "dispatch_orders"("date", "status");

CREATE INDEX IF NOT EXISTS "inbound_lines_dispatch_status_idx"
ON "inbound_lines"("dispatch_status");

CREATE INDEX IF NOT EXISTS "inbound_lines_session_id_idx"
ON "inbound_lines"("session_id");

CREATE INDEX IF NOT EXISTS "dispatch_lines_inbound_line_id_idx"
ON "dispatch_lines"("inbound_line_id");

CREATE INDEX IF NOT EXISTS "inbound_sessions_date_status_idx"
ON "inbound_sessions"("date", "status");

CREATE INDEX IF NOT EXISTS "freight_rates_shipper_id_idx"
ON "freight_rates"("shipper_id");

CREATE INDEX IF NOT EXISTS "payment_relations_shipper_id_idx"
ON "payment_relations"("shipper_id");

CREATE INDEX IF NOT EXISTS "consignee_freight_rates_consignee_id_idx"
ON "consignee_freight_rates"("consignee_id");
