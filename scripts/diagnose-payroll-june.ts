import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import { decimalToNumber } from "@/lib/freight-rates";

async function main() {
  const year = 2026;
  const month = 6;
  const yearMonth = `${year}-${String(month).padStart(2, "0")}`;
  const { start, end } = getMonthDateRange(year, month);

  const [drivers, allDispatches, payrollMonths] = await Promise.all([
    prisma.driver.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.dispatchOrder.findMany({
      where: { date: { gte: start, lte: end } },
      select: { id: true, driverName: true, status: true, date: true, markets: true },
      orderBy: [{ date: "asc" }],
    }),
    prisma.driverPayrollMonth.findMany({
      where: { yearMonth },
      include: { trips: true, driver: { select: { name: true } } },
    }),
  ]);

  const nonCancelled = allDispatches.filter((d) => d.status !== "cancelled");
  const dispatched = allDispatches.filter((d) => d.status === "dispatched");
  const driverNames = new Set(drivers.map((d) => d.name.trim()));

  const unmatchedDriverNames = new Map<string, number>();
  for (const order of nonCancelled) {
    const name = (order.driverName ?? "").trim();
    if (!name) {
      unmatchedDriverNames.set("(empty)", (unmatchedDriverNames.get("(empty)") ?? 0) + 1);
      continue;
    }
    if (!driverNames.has(name)) {
      unmatchedDriverNames.set(name, (unmatchedDriverNames.get(name) ?? 0) + 1);
    }
  }

  const payrollByDriver = new Map(
    payrollMonths.map((pm) => [pm.driver.name, pm])
  );

  const rows = drivers.map((driver) => {
    const exact = nonCancelled.filter(
      (d) => (d.driverName ?? "").trim() === driver.name.trim()
    );
    const pm = payrollByDriver.get(driver.name);
    const tripCount = pm?.trips.length ?? 0;
    const allowanceTotal = (pm?.trips ?? []).reduce(
      (sum, t) => sum + (decimalToNumber(t.tripAllowance) ?? 0),
      0
    );
    return {
      driver: driver.name,
      dispatchExact: exact.length,
      payrollTrips: tripCount,
      tripAllowanceTotal: Math.round(allowanceTotal * 100) / 100,
      mismatch: exact.length !== tripCount,
    };
  });

  console.log(
    JSON.stringify(
      {
        dateRange: { start: start.toISOString(), end: end.toISOString() },
        totals: {
          allDispatches: allDispatches.length,
          nonCancelled: nonCancelled.length,
          dispatched: dispatched.length,
          activeDrivers: drivers.length,
        },
        statusBreakdown: Object.fromEntries(
          [...new Set(allDispatches.map((d) => d.status))].map((status) => [
            status,
            allDispatches.filter((d) => d.status === status).length,
          ])
        ),
        unmatchedDriverNamesOnDispatches: Object.fromEntries(unmatchedDriverNames),
        driversWithMismatch: rows.filter((r) => r.mismatch),
        driversWithZeroAllowanceButDispatches: rows.filter(
          (r) => r.dispatchExact > 0 && r.tripAllowanceTotal === 0
        ),
        sampleRows: rows.slice(0, 20),
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
