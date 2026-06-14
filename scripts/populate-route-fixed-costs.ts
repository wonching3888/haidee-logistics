import "dotenv/config";
import { prisma } from "../lib/prisma";

const MIGRATION_SQL = `
ALTER TABLE route_masters
  ADD COLUMN IF NOT EXISTS forwarding_outbound DECIMAL(10,2) DEFAULT 80.00,
  ADD COLUMN IF NOT EXISTS forwarding_return DECIMAL(10,2) DEFAULT 60.00;
`;

const POPULATE_SQL = `
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
`;

async function main() {
  await prisma.$executeRawUnsafe(MIGRATION_SQL);

  try {
    await prisma.$executeRawUnsafe(`
      UPDATE route_masters
      SET forwarding_outbound = COALESCE(forwarding_outbound, forwarding_charges, 80.00),
          forwarding_return = COALESCE(forwarding_return, 60.00);
    `);
  } catch {
    // forwarding_charges column may be absent after schema sync
  }

  await prisma.$executeRawUnsafe(POPULATE_SQL);

  const routes = await prisma.routeMaster.findMany({
    orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
    select: {
      code: true,
      name: true,
      tollFee: true,
      borderPassFee: true,
      fishCheckingFee: true,
      kpbFee: true,
      parkingFee: true,
      epermitCharge: true,
      dagangNetFee: true,
      forwardingOutbound: true,
      forwardingReturn: true,
    },
  });

  console.log(JSON.stringify({ ok: true, count: routes.length, routes }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
