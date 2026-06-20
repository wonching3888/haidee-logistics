/**
 * Backfill auto-estimated unloading_fee rows for dispatched orders missing fees.
 * Usage: npx tsx scripts/backfill-unloading-estimates-dispatched.ts [--from=2026-06-01] [--to=2026-06-30]
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "../lib/prisma";
import { syncUnloadingFeeEstimatesForTrip } from "../lib/driver-expense-service";

function parseArgs() {
  const from =
    process.argv.find((a) => a.startsWith("--from="))?.split("=")[1] ??
    "2026-06-01";
  const to =
    process.argv.find((a) => a.startsWith("--to="))?.split("=")[1] ??
    "2026-06-30";
  return { from, to };
}

async function main() {
  const { from, to } = parseArgs();
  const dispatches = await prisma.dispatchOrder.findMany({
    where: {
      status: { notIn: ["draft", "cancelled"] },
      date: {
        gte: new Date(`${from}T00:00:00.000Z`),
        lte: new Date(`${to}T23:59:59.999Z`),
      },
    },
    select: { id: true, dispatchNo: true },
    orderBy: [{ date: "asc" }, { dispatchNo: "asc" }],
  });

  let synced = 0;
  for (const dispatch of dispatches) {
    const before = await prisma.unloadingFee.count({
      where: { tripId: dispatch.id },
    });
    const rows = await syncUnloadingFeeEstimatesForTrip(dispatch.id);
    if (before === 0 && rows.length > 0) {
      console.log(`${dispatch.dispatchNo ?? dispatch.id}: ${rows.length} rows`);
    }
    synced += 1;
  }

  console.log(
    JSON.stringify({ from, to, dispatchCount: dispatches.length, synced })
  );
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
