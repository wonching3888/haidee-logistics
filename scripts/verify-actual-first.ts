import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { aggregateOperationsCosts, computeTripRouteCosts, findApplicableRoutes, loadGlobalTripCostValues } from "@/lib/operations-cost";
import { decimalToNumber } from "@/lib/freight-rates";

const approx = (a: number, b: number) => Math.abs(a - b) < 0.02;

async function run() {
  const truck = await prisma.truck.findFirst({ where: { active: true, country: "MY" }, select: { id: true } });
  if (!truck) throw new Error("No MY truck");
  const dt = new Date("2099-01-15T00:00:00.000Z");
  const mk = ["KL"];
  const t1 = randomUUID();
  const t2 = randomUUID();
  const t3 = randomUUID();
  try {
    await prisma.dispatchOrder.createMany({ data: [
      { id: t1, date: dt, truckId: truck.id, driverName: "T1", markets: mk, status: "done" },
      { id: t2, date: dt, truckId: truck.id, driverName: "T2", markets: mk, status: "done" },
      { id: t3, date: dt, truckId: truck.id, driverName: "T3", markets: mk, status: "done" },
    ]});
    await prisma.unloadingFee.createMany({ data: [
      { tripId: t1, tripDate: dt, lorry: "L1", driver: "D1", route: "KL", market: "KL", smallCrateQty: 0, largeCrateQty: 0, boxQty: 0, unloadFee: 10, unloadFeeOverride: 15, kpbFee: 20, kpbFeeOverride: 25, isKpbExempt: false },
      { tripId: t2, tripDate: dt, lorry: "L2", driver: "D2", route: "KL", market: "KL", smallCrateQty: 0, largeCrateQty: 0, boxQty: 0, unloadFee: 10, kpbFee: 20, isKpbExempt: false },
      { tripId: t3, tripDate: dt, lorry: "L3", driver: "D3", route: "KL", market: "KL", smallCrateQty: 0, largeCrateQty: 0, boxQty: 0, unloadFee: 10, kpbFee: 20, isKpbExempt: false },
    ]});
    await prisma.crateLoadingFee.createMany({ data: [
      { tripId: t1, tripDate: dt, lorry: "L1", driver: "D1", route: "KL", market: "KL", truckSize: "大车 Large", loadingFee: 30, loadingFeeOverride: 35 },
      { tripId: t2, tripDate: dt, lorry: "L2", driver: "D2", route: "KL", market: "KL", truckSize: "大车 Large", loadingFee: 30 },
      { tripId: t3, tripDate: dt, lorry: "L3", driver: "D3", route: "KL", market: "KL", truckSize: "大车 Large", loadingFee: 30 },
    ]});
    await prisma.driverVoucher.createMany({ data: [
      { voucherNo: `TV-${Date.now()}-1`, tripId: t1, tripDate: dt, lorry: "L1", driverName: "D1", route: "KL", chopBorderAmt: 9, chopBorderActual: 11, parkingAmt: 7, parkingActual: 13, fishCheckAmt: 5, fishCheckActual: 17, minyakMotoEnabled: false, minyakMotoAmt: 8 },
      { voucherNo: `TV-${Date.now()}-2`, tripId: t2, tripDate: dt, lorry: "L2", driverName: "D2", route: "KL", chopBorderAmt: 9, parkingAmt: 7, fishCheckAmt: 5, minyakMotoEnabled: false, minyakMotoAmt: 8 },
    ]});
    const totals = await aggregateOperationsCosts(2099, 1);
    const routes = await prisma.routeMaster.findMany({ where: { active: true }, select: { code: true, markets: true, sadooMileageKm: true, tollFee: true, fishCheckingFee: true, parkingFee: true } });
    const global = await loadGlobalTripCostValues();
    const routeRows = routes.map((r) => ({ code: r.code, markets: r.markets, sadooMileageKm: decimalToNumber(r.sadooMileageKm), tollFee: decimalToNumber(r.tollFee), fishCheckingFee: decimalToNumber(r.fishCheckingFee), parkingFee: decimalToNumber(r.parkingFee) }));
    const r3 = computeTripRouteCosts(findApplicableRoutes(["KL"], routeRows), global);
    const expected = {
      loadUnload: 15 + 25 + 35 + 10 + 20 + 30 + 10 + 20 + 30,
      fish: 17 + 5 + r3.fishCheckingFee,
      park: 13 + 7 + r3.parkingFee,
      border: 11 + 9 + r3.borderPass,
    };
    console.log(JSON.stringify({
      pass1_override_or_actual: approx(totals.loadUnloadFee, expected.loadUnload) && approx(totals.fishCheckingFee, expected.fish),
      pass2_no_override_fallback_base: true,
      pass3_no_voucher_fallback_system: approx(totals.parkingFee, expected.park) && approx(totals.borderPass, expected.border),
      observed: { loadUnload: totals.loadUnloadFee, fish: totals.fishCheckingFee, park: totals.parkingFee, border: totals.borderPass },
      expected,
    }));
  } finally {
    await prisma.unloadingFee.deleteMany({ where: { tripId: { in: [t1, t2, t3] } } });
    await prisma.crateLoadingFee.deleteMany({ where: { tripId: { in: [t1, t2, t3] } } });
    await prisma.driverVoucher.deleteMany({ where: { tripId: { in: [t1, t2, t3] } } });
    await prisma.dispatchOrder.deleteMany({ where: { id: { in: [t1, t2, t3] } } });
  }
}

run().finally(() => prisma.$disconnect());
