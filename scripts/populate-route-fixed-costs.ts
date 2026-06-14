import "dotenv/config";
import { prisma } from "../lib/prisma";

/** Legacy script — global fees now live in global_cost_settings. */
async function main() {
  await prisma.$executeRawUnsafe(`
    UPDATE route_masters
    SET
      toll_fee = COALESCE(toll_fee, 0),
      fish_checking_fee = COALESCE(fish_checking_fee, 0),
      kpb_fee = COALESCE(kpb_fee, 0),
      parking_fee = COALESCE(parking_fee, 0);
  `);

  const routes = await prisma.routeMaster.findMany({
    select: {
      code: true,
      tollFee: true,
      fishCheckingFee: true,
      kpbFee: true,
      parkingFee: true,
    },
    orderBy: { code: "asc" },
  });

  console.log(JSON.stringify({ ok: true, routes }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
