ALTER TABLE route_masters
  ADD COLUMN IF NOT EXISTS forwarding_outbound DECIMAL(10,2) DEFAULT 80.00,
  ADD COLUMN IF NOT EXISTS forwarding_return DECIMAL(10,2) DEFAULT 60.00;

UPDATE route_masters
SET forwarding_outbound = COALESCE(forwarding_outbound, forwarding_charges, 80.00),
    forwarding_return = COALESCE(forwarding_return, 60.00);

UPDATE route_masters
SET
  toll_fee = 0,
  border_pass_fee = 0,
  fish_checking_fee = 0,
  kpb_fee = 0,
  parking_fee = 0,
  epermit_charge = 30.00,
  dagang_net_fee = 10.80,
  forwarding_outbound = 80.00,
  forwarding_return = 60.00;
