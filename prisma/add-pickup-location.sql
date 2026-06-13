-- Add pickup location to shippers (customer master) and inbound sessions (per-trip override)
ALTER TABLE shippers
  ADD COLUMN IF NOT EXISTS pickup_location TEXT NOT NULL DEFAULT 'SADAO';

ALTER TABLE inbound_sessions
  ADD COLUMN IF NOT EXISTS pickup_location TEXT;
