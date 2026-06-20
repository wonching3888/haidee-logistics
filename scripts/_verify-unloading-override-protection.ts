/**
 * End-to-end verification: override protection on dispatch sync/cancel.
 * Creates isolated test data, validates, then cleans up.
 * Usage: npx tsx scripts/_verify-unloading-override-protection.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "../lib/prisma";
import {
  effectiveKpbFee,
  effectiveUnloadFee,
  lineSubtotal,
} from "../lib/unloading-calculator";
import { resolveTripLoadUnloadCost } from "../lib/unloading-trip-cost";
import {
  getUnloadingRatesByMarket,
  handleUnloadingFeesOnDispatchCancel,
  syncUnloadingFeeEstimatesForTrip,
  tripHasVoucherUnloadingActuals,
} from "../lib/driver-expense-service";

const TEST_TAG = `TEST-OVERRIDE-${Date.now()}`;
const TEST_DATE = new Date("2099-06-01T00:00:00.000Z");

type StepResult = { step: string; pass: boolean; detail: unknown };
const results: StepResult[] = [];

function pass(step: string, detail: unknown) {
  results.push({ step, pass: true, detail });
  console.log(`✓ ${step}`, JSON.stringify(detail));
}

function fail(step: string, detail: unknown): never {
  results.push({ step, pass: false, detail });
  console.error(`✗ ${step}`, JSON.stringify(detail));
  throw new Error(`FAILED: ${step}`);
}

async function releaseDispatch(dispatchId: string, inboundLineIds: string[]) {
  await prisma.dispatchLine.deleteMany({ where: { dispatchOrderId: dispatchId } });
  if (inboundLineIds.length > 0) {
    await prisma.inboundLine.updateMany({
      where: { id: { in: inboundLineIds } },
      data: { dispatchStatus: "unassigned", truckId: null },
    });
  }
  await prisma.dispatchOrder.delete({ where: { id: dispatchId } }).catch(() => {});
}

async function assignDispatch(
  dispatchId: string,
  truckId: string,
  lineIds: string[]
) {
  await prisma.dispatchLine.createMany({
    data: lineIds.map((inboundLineId) => ({ dispatchOrderId: dispatchId, inboundLineId })),
  });
  await prisma.inboundLine.updateMany({
    where: { id: { in: lineIds } },
    data: { dispatchStatus: "assigned", truckId },
  });
}

async function findOrCreateTestLines(truckId: string) {
  const unassigned = await prisma.inboundLine.findMany({
    where: {
      dispatchStatus: "unassigned",
      quantity: { gt: 0 },
      session: { status: "confirmed" },
      stall: { market: { code: { in: ["KL", "MC"] } } },
    },
    include: {
      stall: { include: { market: true } },
      tongType: true,
    },
    take: 8,
    orderBy: { createdAt: "desc" },
  });
  if (unassigned.length >= 2) {
    return { lines: unassigned, createdSessionId: null as string | null };
  }

  // Fallback: create isolated test inbound session + lines
  const [shipper, stall, tongType] = await Promise.all([
    prisma.shipper.findFirst({
      where: { active: true },
      select: { id: true, pickupLocation: true },
    }),
    prisma.stall.findFirst({
      where: { market: { code: "KL" }, active: true },
      include: { market: true },
    }),
    prisma.tongType.findFirst({
      where: { code: "WTL", active: true },
    }),
  ]);
  if (!shipper || !stall || !tongType) {
    fail("setup-fixtures", "missing shipper/stall/tongType for synthetic lines");
  }

  const session = await prisma.inboundSession.create({
    data: {
      date: TEST_DATE,
      shipperId: shipper.id,
      pickupLocation: shipper.pickupLocation,
      status: "confirmed",
      sessionNo: `${TEST_TAG}-IN`,
    },
  });

  const createdLines = await prisma.inboundLine.createManyAndReturn({
    data: [
      {
        sessionId: session.id,
        stallId: stall.id,
        tongTypeId: tongType.id,
        quantity: 25,
        isBox: false,
        dispatchStatus: "unassigned",
      },
      {
        sessionId: session.id,
        stallId: stall.id,
        tongTypeId: tongType.id,
        quantity: 15,
        isBox: false,
        dispatchStatus: "unassigned",
      },
    ],
  });

  const lines = await prisma.inboundLine.findMany({
    where: { id: { in: createdLines.map((l) => l.id) } },
    include: {
      stall: { include: { market: true } },
      tongType: true,
    },
  });

  return { lines, createdSessionId: session.id };
}

async function main() {
  const lineIds: string[] = [];
  const originalQuantities = new Map<string, number>();
  const dispatchIds: string[] = [];
  let voucherId: string | undefined;
  let createdSessionId: string | null = null;
  let syntheticLineIds: string[] = [];

  try {
    const truck = await prisma.truck.findFirst({
      where: { active: true, country: "MY" },
      select: { id: true, plate: true, type: true },
    });
    if (!truck) fail("setup-truck", "no active MY truck");

    const { lines, createdSessionId: sessionId } = await findOrCreateTestLines(
      truck.id
    );
    createdSessionId = sessionId;
    if (sessionId) syntheticLineIds = lines.map((l) => l.id);
    if (lines.length < 2) fail("setup-lines", "not enough lines for test");

    for (const line of lines) {
      lineIds.push(line.id);
      originalQuantities.set(line.id, line.quantity);
    }

    const markets = [
      ...new Set(
        lines.map((l) => l.stall.market?.code).filter((c): c is string => Boolean(c))
      ),
    ];

    const dispatch = await prisma.dispatchOrder.create({
      data: {
        dispatchNo: TEST_TAG,
        date: TEST_DATE,
        truckId: truck.id,
        driverName: "TEST-OVERRIDE-DRIVER",
        markets,
        status: "dispatched",
      },
    });
    dispatchIds.push(dispatch.id);
    await assignDispatch(dispatch.id, truck.id, lineIds);

    // (a) auto sync
    const feesAfterSync = await syncUnloadingFeeEstimatesForTrip(dispatch.id);
    if (feesAfterSync.length === 0) fail("a-auto-sync", "no rows");
    pass("a-auto-sync", {
      dispatchNo: TEST_TAG,
      rowCount: feesAfterSync.length,
      markets: feesAfterSync.map((r) => r.market),
    });

    const targetRow = feesAfterSync.find((r) => r.market === "KL") ?? feesAfterSync[0];
    const originalUnloadEstimate = targetRow.unloadFee;
    const originalKpbEstimate = targetRow.kpbFee;
    const SIMULATED_ACTUAL_UNLOAD = 99.99;
    const SIMULATED_ACTUAL_KPB = 11.11;

    // (b) simulate actual via override
    await prisma.unloadingFee.update({
      where: { id: targetRow.id },
      data: {
        unloadFeeOverride: SIMULATED_ACTUAL_UNLOAD,
        kpbFeeOverride: SIMULATED_ACTUAL_KPB,
      },
    });
    pass("b-set-override", {
      feeId: targetRow.id,
      market: targetRow.market,
      unloadFeeOverride: SIMULATED_ACTUAL_UNLOAD,
      kpbFeeOverride: SIMULATED_ACTUAL_KPB,
    });

    // (c) modify quantity
    const firstLine = lines[0];
    const newQty = firstLine.quantity + 10;
    await prisma.inboundLine.update({
      where: { id: firstLine.id },
      data: { quantity: newQty },
    });
    pass("c-modify-quantity", {
      inboundLineId: firstLine.id,
      from: firstLine.quantity,
      to: newQty,
    });

    // (d) re-sync — override must survive
    const feesAfterResync = await syncUnloadingFeeEstimatesForTrip(dispatch.id);
    const rowAfter = feesAfterResync.find((r) => r.id === targetRow.id);
    if (!rowAfter) fail("d-resync", "target fee row missing");

    if (
      rowAfter.unloadFeeOverride !== SIMULATED_ACTUAL_UNLOAD ||
      rowAfter.kpbFeeOverride !== SIMULATED_ACTUAL_KPB
    ) {
      fail("d-override-preserved", {
        unloadFeeOverride: rowAfter.unloadFeeOverride,
        kpbFeeOverride: rowAfter.kpbFeeOverride,
      });
    }

    pass("d-override-preserved", {
      unloadFeeBefore: originalUnloadEstimate,
      unloadFeeAfter: rowAfter.unloadFee,
      kpbFeeBefore: originalKpbEstimate,
      kpbFeeAfter: rowAfter.kpbFee,
      unloadFeeOverride: rowAfter.unloadFeeOverride,
      kpbFeeOverride: rowAfter.kpbFeeOverride,
      estimateFieldsUpdated:
        rowAfter.unloadFee !== originalUnloadEstimate ||
        rowAfter.kpbFee !== originalKpbEstimate ||
        rowAfter.smallCrateQty !== targetRow.smallCrateQty,
    });

    // (e) cost reads use override
    const effectiveUnload = effectiveUnloadFee(rowAfter);
    const effectiveKpb = effectiveKpbFee(rowAfter);

    if (effectiveUnload !== SIMULATED_ACTUAL_UNLOAD) {
      fail("e-effective-unload", { expected: SIMULATED_ACTUAL_UNLOAD, actual: effectiveUnload });
    }
    if (!rowAfter.isKpbExempt && effectiveKpb !== SIMULATED_ACTUAL_KPB) {
      fail("e-effective-kpb", { expected: SIMULATED_ACTUAL_KPB, actual: effectiveKpb });
    }

    const rates = await getUnloadingRatesByMarket();
    const dispatchForEstimate = await prisma.dispatchOrder.findUnique({
      where: { id: dispatch.id },
      select: {
        truck: { select: { type: true } },
        lines: {
          select: {
            inboundLine: {
              select: {
                dispatchStatus: true,
                quantity: true,
                stall: {
                  select: { code: true, market: { select: { code: true } } },
                },
                tongType: { select: { code: true, isBox: true } },
              },
            },
          },
        },
      },
    });

    const tripCost = resolveTripLoadUnloadCost({
      unloadingRows: feesAfterResync,
      loadingRows: [],
      dispatchEstimate: dispatchForEstimate,
      ratesByMarket: rates,
    });

    const expectedTripCost = feesAfterResync.reduce(
      (sum, row) =>
        sum +
        lineSubtotal({
          unloadFee: row.unloadFee,
          kpbFee: row.kpbFee,
          unloadFeeOverride: row.unloadFeeOverride,
          kpbFeeOverride: row.kpbFeeOverride,
          isKpbExempt: row.isKpbExempt,
        }),
      0
    );

    if (Math.abs(tripCost - expectedTripCost) > 0.02) {
      fail("e-trip-cost", { tripCost, expectedTripCost });
    }

    pass("e-cost-reads-override", {
      effectiveUnload,
      effectiveKpb,
      tripCost: Math.round(tripCost * 100) / 100,
      notUsingRawEstimate:
        effectiveUnload !== rowAfter.unloadFee ||
        (!rowAfter.isKpbExempt && effectiveKpb !== rowAfter.kpbFee),
    });

    // (f1) cancel with override only (no voucher) — hard delete fees
    if (await tripHasVoucherUnloadingActuals(dispatch.id)) {
      fail("f1-no-voucher-yet", "voucher should not exist before f1 cancel");
    }

    await prisma.dispatchOrder.update({
      where: { id: dispatch.id },
      data: { status: "cancelled" },
    });
    const cancel1 = await handleUnloadingFeesOnDispatchCancel(dispatch.id);
    const feeCount1 = await prisma.unloadingFee.count({ where: { tripId: dispatch.id } });

    if (!cancel1.deleted || cancel1.keptForActuals || feeCount1 !== 0) {
      fail("f1-cancel-override-only", { cancel1, feeCount1 });
    }
    pass("f1-cancel-override-only-deletes-fees", { cancel1, feeCount1 });

    await releaseDispatch(dispatch.id, lineIds);

    // restore qty before second test
    await prisma.inboundLine.update({
      where: { id: firstLine.id },
      data: { quantity: firstLine.quantity },
    });

    // (f2) cancel with voucher actual — keep fees
    const dispatch2 = await prisma.dispatchOrder.create({
      data: {
        dispatchNo: `${TEST_TAG}-V`,
        date: TEST_DATE,
        truckId: truck.id,
        driverName: "TEST-VOUCHER-DRIVER",
        markets,
        status: "dispatched",
      },
    });
    dispatchIds.push(dispatch2.id);
    await assignDispatch(dispatch2.id, truck.id, lineIds);

    const fees2 = await syncUnloadingFeeEstimatesForTrip(dispatch2.id);
    const voucher = await prisma.driverVoucher.create({
      data: {
        voucherNo: `${TEST_TAG}-VCH`,
        tripId: dispatch2.id,
        tripDate: TEST_DATE,
        lorry: truck.plate,
        driverName: "TEST-VOUCHER-DRIVER",
        route: "KL",
        upahTurunActual: 150,
        kpbActual: 50,
      },
    });
    voucherId = voucher.id;

    await prisma.dispatchOrder.update({
      where: { id: dispatch2.id },
      data: { status: "cancelled" },
    });
    const cancel2 = await handleUnloadingFeesOnDispatchCancel(dispatch2.id);
    const feeCount2 = await prisma.unloadingFee.count({ where: { tripId: dispatch2.id } });

    if (cancel2.deleted || !cancel2.keptForActuals || feeCount2 !== fees2.length) {
      fail("f2-cancel-with-voucher", { cancel2, feeCount2, expected: fees2.length });
    }
    pass("f2-cancel-with-voucher-keeps-fees", {
      cancel2,
      feeCount2,
      voucherNo: voucher.voucherNo,
    });

    await releaseDispatch(dispatch2.id, lineIds);
    await prisma.unloadingFee.deleteMany({ where: { tripId: dispatch2.id } });
    await prisma.driverVoucher.delete({ where: { id: voucher.id } });
    voucherId = undefined;

    console.log("\n=== ALL OVERRIDE PROTECTION CHECKS PASSED ===\n");
  } finally {
    console.log("Cleaning up test data...");

    if (voucherId) {
      await prisma.driverVoucher.delete({ where: { id: voucherId } }).catch(() => {});
    }

    const orphans = await prisma.dispatchOrder.findMany({
      where: { dispatchNo: { startsWith: "TEST-OVERRIDE-" } },
      select: { id: true },
    });
    for (const d of orphans) {
      await prisma.unloadingFee.deleteMany({ where: { tripId: d.id } });
      await prisma.driverVoucher.deleteMany({ where: { tripId: d.id } });
      await prisma.dispatchLine.deleteMany({ where: { dispatchOrderId: d.id } });
      await prisma.dispatchOrder.delete({ where: { id: d.id } }).catch(() => {});
    }

    if (lineIds.length) {
      await prisma.inboundLine.updateMany({
        where: { id: { in: lineIds } },
        data: { dispatchStatus: "unassigned", truckId: null },
      });
      for (const [id, qty] of originalQuantities) {
        if (!syntheticLineIds.includes(id)) {
          await prisma.inboundLine.update({ where: { id }, data: { quantity: qty } });
        }
      }
    }

    if (syntheticLineIds.length) {
      await prisma.inboundLine.deleteMany({ where: { id: { in: syntheticLineIds } } });
    }
    if (createdSessionId) {
      await prisma.inboundSession.delete({ where: { id: createdSessionId } }).catch(() => {});
    }

    pass("g-cleanup", {
      restoredLines: lineIds.length,
      deletedOrphanDispatches: orphans.length,
      deletedSyntheticSession: createdSessionId,
    });
  }

  console.log(
    JSON.stringify({ allPassed: results.every((r) => r.pass), results }, null, 2)
  );
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
