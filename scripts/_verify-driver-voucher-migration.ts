/**
 * Step 1-b verification: post-migration driver_vouchers status / indexes.
 * Run: npx tsx --env-file=.env --env-file=.env.local scripts/_verify-driver-voucher-migration.ts
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("=== Driver Voucher Migration Verification ===\n");

  const statusCounts = await prisma.$queryRaw<
    Array<{ status: string; cnt: bigint }>
  >(Prisma.sql`
    SELECT status, COUNT(*)::bigint AS cnt
    FROM driver_vouchers
    GROUP BY status
    ORDER BY status
  `);

  console.log("1) Rows by status:");
  for (const row of statusCounts) {
    console.log(`   ${row.status}: ${String(row.cnt)}`);
  }
  const total = statusCounts.reduce((s, r) => s + Number(r.cnt), 0);
  console.log(`   total: ${total}`);

  const confirmed = await prisma.driverVoucher.findFirst({
    where: { voucherNo: "V-20260611-001" },
    select: {
      id: true,
      voucherNo: true,
      tripId: true,
      status: true,
      costAppliedAt: true,
      updatedAt: true,
      belanja: true,
    },
  });

  console.log("\n2) V-20260611-001 after migration:");
  if (!confirmed) {
    console.log("   ✗ NOT FOUND");
  } else {
    const okStatus = confirmed.status === "confirmed";
    const okCost = confirmed.costAppliedAt != null;
    console.log(`   status=${confirmed.status} ${okStatus ? "✓" : "✗"}`);
    console.log(
      `   cost_applied_at=${confirmed.costAppliedAt?.toISOString() ?? "null"} ${okCost ? "✓" : "✗"}`
    );
    console.log(`   belanja=${confirmed.belanja}`);
    console.log(`   trip_id=${confirmed.tripId}`);
  }

  const indexes = await prisma.$queryRaw<
    Array<{ indexname: string; indexdef: string }>
  >(Prisma.sql`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'driver_vouchers'
    ORDER BY indexname
  `);

  console.log("\n3) driver_vouchers indexes:");
  for (const idx of indexes) {
    console.log(`   ${idx.indexname}`);
  }

  const tripIdUnique = indexes.some(
    (i) =>
      i.indexname === "driver_vouchers_trip_id_key" &&
      i.indexdef.toLowerCase().includes("unique")
  );
  console.log(`\n   trip_id UNIQUE present: ${tripIdUnique ? "✓" : "✗"}`);

  const changeLogTable = await prisma.$queryRaw<
    Array<{ exists: boolean }>
  >(Prisma.sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'driver_voucher_change_logs'
    ) AS exists
  `);
  console.log(
    `\n4) driver_voucher_change_logs table: ${changeLogTable[0]?.exists ? "✓ exists" : "✗ missing"}`
  );

  const changeLogCount = await prisma.driverVoucherChangeLog.count();
  console.log(`   change_log rows: ${changeLogCount} (expected 0 at this step)`);

  let ok = true;
  const confirmedCount = statusCounts.find((r) => r.status === "confirmed");
  if (Number(confirmedCount?.cnt ?? 0) !== 1) ok = false;
  if (!confirmed || confirmed.status !== "confirmed" || !confirmed.costAppliedAt)
    ok = false;
  if (!tripIdUnique) ok = false;
  if (!changeLogTable[0]?.exists) ok = false;

  if (!ok) {
    console.log("\n✗ Verification FAILED");
    process.exit(1);
  }
  console.log("\n✓ All checks passed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
