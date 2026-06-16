-- Performance indexes for PnL query paths
CREATE INDEX IF NOT EXISTS "dispatch_orders_date_idx"
ON "dispatch_orders"("date");

CREATE INDEX IF NOT EXISTS "dispatch_lines_dispatch_order_id_idx"
ON "dispatch_lines"("dispatch_order_id");
