/**
 * Step 1-a: Read-only driver_vouchers migration readiness report.
 * Run: npx tsx --env-file=.env --env-file=.env.local scripts/_report-driver-voucher-migration-readonly.ts
 *
 * Does NOT modify schema or data.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("=== Driver Voucher Migration Readiness (READ-ONLY) ===\n");
  console.log(`Report time: ${new Date().toISOString()}\n`);

  const total = await prisma.driverVoucher.count();
  console.log(`1) Total vouchers: ${total}\n`);

  if (total === 0) {
    console.log("No driver_vouchers rows. UNIQUE(trip_id) can be added with no dedup.\n");
    return;
  }

  // ── Duplicate trip_id ─────────────────────────────────────────────────────
  const duplicateGroups = await prisma.$queryRaw<
    Array<{ trip_id: string; cnt: bigint }>
  >(Prisma.sql`
    SELECT trip_id, COUNT(*)::bigint AS cnt
    FROM driver_vouchers
    GROUP BY trip_id
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC, trip_id
  `);

  const duplicateTripCount = duplicateGroups.length;
  const rowsInDuplicateTrips = duplicateGroups.reduce(
    (sum, g) => sum + Number(g.cnt),
    0
  );
  const extraRowsFromDupes = rowsInDuplicateTrips - duplicateTripCount;

  console.log("2) trip_id duplicates (UNIQUE constraint readiness)");
  console.log(`   Distinct trip_id with COUNT > 1: ${duplicateTripCount}`);
  console.log(`   Total rows involved in duplicates: ${rowsInDuplicateTrips}`);
  console.log(
    `   Extra rows to resolve before UNIQUE (rows - distinct trip_ids): ${extraRowsFromDupes}`
  );

  if (duplicateGroups.length > 0) {
    console.log("\n   Duplicate groups (trip_id → count):");
    for (const g of duplicateGroups) {
      console.log(`     ${g.trip_id} → ${g.cnt}`);
    }

    const dupeDetails = await prisma.$queryRaw<
      Array<{
        id: string;
        trip_id: string;
        voucher_no: string;
        trip_date: Date;
        lorry: string;
        driver_name: string;
        belanja: number | null;
        has_actual: boolean;
        updated_at: Date;
        created_at: Date;
      }>
    >(Prisma.sql`
      SELECT
        v.id,
        v.trip_id,
        v.voucher_no,
        v.trip_date,
        v.lorry,
        v.driver_name,
        v.belanja,
        (
          v.chop_border_actual IS NOT NULL
          OR v.parking_actual IS NOT NULL
          OR v.kpb_actual IS NOT NULL
          OR v.fish_check_actual IS NOT NULL
          OR v.upah_turun_actual IS NOT NULL
          OR v.upah_naik_tong_actual IS NOT NULL
          OR v.minyak_moto_actual IS NOT NULL
          OR v.other_actual IS NOT NULL
        ) AS has_actual,
        v.updated_at,
        v.created_at
      FROM driver_vouchers v
      WHERE v.trip_id IN (
        SELECT trip_id FROM driver_vouchers GROUP BY trip_id HAVING COUNT(*) > 1
      )
      ORDER BY v.trip_id, v.updated_at DESC, v.created_at DESC
    `);

    console.log("\n   Detail rows in duplicate trip_id groups:");
    let currentTrip = "";
    for (const row of dupeDetails) {
      if (row.trip_id !== currentTrip) {
        currentTrip = row.trip_id;
        console.log(`\n   --- trip_id: ${row.trip_id} ---`);
      }
      console.log(
        `     id=${row.id} | ${row.voucher_no} | ${row.trip_date.toISOString().slice(0, 10)} | ${row.lorry} | ${row.driver_name} | belanja=${row.belanja ?? "null"} | has_actual=${row.has_actual} | updated=${row.updated_at.toISOString()}`
      );
    }
  } else {
    console.log("   ✓ No duplicate trip_id — UNIQUE can be added directly.\n");
  }

  // ── Migration status buckets (mutually exclusive) ─────────────────────────
  const buckets = await prisma.$queryRaw<
    Array<{
      bucket: string;
      cnt: bigint;
    }>
  >(Prisma.sql`
    WITH classified AS (
      SELECT
        id,
        CASE
          WHEN (
            chop_border_actual IS NOT NULL
            OR parking_actual IS NOT NULL
            OR kpb_actual IS NOT NULL
            OR fish_check_actual IS NOT NULL
            OR upah_turun_actual IS NOT NULL
            OR upah_naik_tong_actual IS NOT NULL
            OR minyak_moto_actual IS NOT NULL
            OR other_actual IS NOT NULL
            OR (belanja IS NOT NULL AND belanja > 0)
          ) THEN 'confirmed'
          WHEN (
            chop_border_amt IS NOT NULL
            OR parking_amt IS NOT NULL
            OR kpb_amt IS NOT NULL
            OR fish_check_amt IS NOT NULL
            OR upah_turun_amt IS NOT NULL
            OR upah_naik_tong_amt IS NOT NULL
          ) THEN 'draft_amt_only'
          ELSE 'empty_shell'
        END AS bucket
      FROM driver_vouchers
    )
    SELECT bucket, COUNT(*)::bigint AS cnt
    FROM classified
    GROUP BY bucket
    ORDER BY bucket
  `);

  const bucketMap = Object.fromEntries(
    buckets.map((b) => [b.bucket, Number(b.cnt)])
  );
  const confirmedCount = bucketMap.confirmed ?? 0;
  const draftAmtOnly = bucketMap.draft_amt_only ?? 0;
  const emptyShell = bucketMap.empty_shell ?? 0;
  const classifiedSum = confirmedCount + draftAmtOnly + emptyShell;

  console.log("\n3) Historical status migration preview (mutually exclusive)");
  console.log(
    `   → confirmed (any *Actual non-null OR belanja > 0): ${confirmedCount}`
  );
  console.log(`   → draft (only *Amt, no actual/belanja):       ${draftAmtOnly}`);
  console.log(`   → empty_shell (no amt, no actual):            ${emptyShell}`);
  console.log(`   Sum: ${classifiedSum} (total ${total})`);

  // ── Supplemental breakdown ────────────────────────────────────────────────
  const actualFieldCounts = await prisma.$queryRaw<
    Array<{ field_name: string; non_null_cnt: bigint }>
  >(Prisma.sql`
    SELECT 'chop_border_actual' AS field_name, COUNT(*)::bigint FROM driver_vouchers WHERE chop_border_actual IS NOT NULL
    UNION ALL SELECT 'parking_actual', COUNT(*)::bigint FROM driver_vouchers WHERE parking_actual IS NOT NULL
    UNION ALL SELECT 'kpb_actual', COUNT(*)::bigint FROM driver_vouchers WHERE kpb_actual IS NOT NULL
    UNION ALL SELECT 'fish_check_actual', COUNT(*)::bigint FROM driver_vouchers WHERE fish_check_actual IS NOT NULL
    UNION ALL SELECT 'upah_turun_actual', COUNT(*)::bigint FROM driver_vouchers WHERE upah_turun_actual IS NOT NULL
    UNION ALL SELECT 'upah_naik_tong_actual', COUNT(*)::bigint FROM driver_vouchers WHERE upah_naik_tong_actual IS NOT NULL
    UNION ALL SELECT 'minyak_moto_actual', COUNT(*)::bigint FROM driver_vouchers WHERE minyak_moto_actual IS NOT NULL
    UNION ALL SELECT 'other_actual', COUNT(*)::bigint FROM driver_vouchers WHERE other_actual IS NOT NULL
    UNION ALL SELECT 'belanja > 0', COUNT(*)::bigint FROM driver_vouchers WHERE belanja IS NOT NULL AND belanja > 0
    ORDER BY field_name
  `);

  console.log("\n4) Non-null *Actual / belanja field counts (may overlap across rows):");
  for (const row of actualFieldCounts) {
    const n = Number(row.non_null_cnt);
    console.log(`   ${row.field_name}: ${n}`);
  }

  const amtOnlySamples = await prisma.driverVoucher.findMany({
    where: {
      AND: [
        {
          OR: [
            { chopBorderActual: null },
          ],
        },
        { parkingActual: null },
        { kpbActual: null },
        { fishCheckActual: null },
        { upahTurunActual: null },
        { upahNaikTongActual: null },
        { minyakMotoActual: null },
        { otherActual: null },
        { OR: [{ belanja: null }, { belanja: 0 }] },
        {
          OR: [
            { chopBorderAmt: { not: null } },
            { parkingAmt: { not: null } },
            { kpbAmt: { not: null } },
            { fishCheckAmt: { not: null } },
            { upahTurunAmt: { not: null } },
            { upahNaikTongAmt: { not: null } },
          ],
        },
      ],
    },
    select: {
      id: true,
      voucherNo: true,
      tripId: true,
      tripDate: true,
      lorry: true,
      chopBorderAmt: true,
      parkingAmt: true,
      belanja: true,
    },
    take: 10,
    orderBy: { tripDate: "desc" },
  });

  if (draftAmtOnly > 0) {
    console.log(`\n5) Sample draft_amt_only rows (up to 10):`);
    for (const v of amtOnlySamples) {
      console.log(
        `   ${v.voucherNo} | ${v.tripDate.toISOString().slice(0, 10)} | ${v.lorry} | chop=${v.chopBorderAmt} park=${v.parkingAmt} belanja=${v.belanja}`
      );
    }
  }

  const emptySamples = await prisma.driverVoucher.findMany({
    where: {
      chopBorderActual: null,
      parkingActual: null,
      kpbActual: null,
      fishCheckActual: null,
      upahTurunActual: null,
      upahNaikTongActual: null,
      minyakMotoActual: null,
      otherActual: null,
      OR: [{ belanja: null }, { belanja: 0 }],
      chopBorderAmt: null,
      parkingAmt: null,
      kpbAmt: null,
      fishCheckAmt: null,
      upahTurunAmt: null,
      upahNaikTongAmt: null,
    },
    select: {
      id: true,
      voucherNo: true,
      tripId: true,
      tripDate: true,
      duitJalan: true,
      minyakMotoEnabled: true,
      minyakMotoAmt: true,
    },
    take: 10,
    orderBy: { createdAt: "desc" },
  });

  if (emptyShell > 0) {
    console.log(`\n6) Sample empty_shell rows (up to 10):`);
    for (const v of emptySamples) {
      console.log(
        `   ${v.voucherNo} | ${v.tripDate.toISOString().slice(0, 10)} | duitJalan=${v.duitJalan} | moto=${v.minyakMotoEnabled}/${v.minyakMotoAmt}`
      );
    }
  }

  // ── Summary for decision ──────────────────────────────────────────────────
  console.log("\n=== Decision summary ===");
  if (duplicateTripCount === 0) {
    console.log("UNIQUE(trip_id): SAFE to add without dedup.");
  } else {
    console.log(
      `UNIQUE(trip_id): BLOCKED until ${extraRowsFromDupes} duplicate row(s) resolved (see groups above).`
    );
    console.log(
      "Suggested keep rule for ①-b: per trip_id keep row with has_actual=true, else highest belanja, else latest updated_at."
    );
  }
  console.log(
    `Migration: ${confirmedCount} → status='confirmed' (+ cost_applied_at=updated_at)`
  );
  console.log(`Migration: ${draftAmtOnly} → status='draft'`);
  console.log(`Migration: ${emptyShell} → status='draft' (empty shell)`);
  console.log("\n(Dry-run only — no schema or data changes made.)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
