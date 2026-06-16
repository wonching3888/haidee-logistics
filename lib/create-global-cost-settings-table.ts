import { prisma } from "@/lib/prisma";

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS global_cost_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key VARCHAR(50) NOT NULL UNIQUE,
  value_myr DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  label VARCHAR(100),
  notes VARCHAR(200),
  updated_at TIMESTAMP DEFAULT NOW()
);
`;

const SEED_DATA_SQL = `
INSERT INTO global_cost_settings (key, value_myr, label, notes) VALUES
('border_pass', 0.00, 'Border Pass', '每趟/车'),
('epermit', 30.00, 'EPERMIT Chrg', '估算2张×RM15/趟'),
('dagang_net', 10.80, 'Dagang Net Fee', '估算2张×RM5.40/趟'),
('forwarding_outbound', 80.00, 'Forwarding 出货 Outbound', 'Zaewe，出货趟'),
('forwarding_return', 60.00, 'Forwarding 回空桶 Return', 'Zaewe，回空桶趟'),
('lkim_maqis_per_crate', 2.50, 'LKIM-MAQIS费（MYR/桶）', '当月派车总桶数 × 费率'),
('lkim_maqis_per_box', 1.00, 'LKIM-MAQIS费（MYR/盒）', '当月派车总箱数 × 费率'),
('fuel_price_myr', 2.05, 'Diesel Price (MYR/L)', '统一油价，每月更新'),
('songkhla_rate_tong', 0.00, '宋卡段车力/桶 (THB)', '泰国段车力费率'),
('songkhla_rate_box', 0.00, '宋卡段车力/盒 (THB)', '泰国段车力费率'),
('pattani_rate_tong', 0.00, '北大年段车力/桶 (THB)', '泰国段车力费率'),
('pattani_rate_box', 0.00, '北大年段车力/盒 (THB)', '泰国段车力费率')
ON CONFLICT (key) DO NOTHING;
`;

const DROP_ROUTE_GLOBAL_COLUMNS_SQL = [
  "ALTER TABLE route_masters DROP COLUMN IF EXISTS border_pass_fee",
  "ALTER TABLE route_masters DROP COLUMN IF EXISTS epermit_charge",
  "ALTER TABLE route_masters DROP COLUMN IF EXISTS dagang_net_fee",
  "ALTER TABLE route_masters DROP COLUMN IF EXISTS forwarding_charges",
  "ALTER TABLE route_masters DROP COLUMN IF EXISTS forwarding_outbound",
  "ALTER TABLE route_masters DROP COLUMN IF EXISTS forwarding_return",
];

export async function createGlobalCostSettingsTable() {
  await prisma.$executeRawUnsafe(CREATE_TABLE_SQL);
  await prisma.$executeRawUnsafe(SEED_DATA_SQL);

  for (const statement of DROP_ROUTE_GLOBAL_COLUMNS_SQL) {
    await prisma.$executeRawUnsafe(statement);
  }
}

export function isMissingGlobalCostSettingsTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message) : "";
  return (
    code === "P2021" ||
    message.includes("global_cost_settings") ||
    message.includes("does not exist")
  );
}
