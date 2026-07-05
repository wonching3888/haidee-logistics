import { prisma } from "@/lib/prisma";
import { isDriverEligibleForPayrollMonth } from "@/lib/driver-payroll-eligibility";

async function main() {
  const drivers = await prisma.driver.findMany({
    where: { name: { in: ["Pinat", "Din", "Ikmal"] } },
    select: {
      name: true,
      active: true,
      terminationDate: true,
      pcbYtdBalances: { where: { asOfYearMonth: "2026-06" } },
    },
    orderBy: { name: "asc" },
  });

  for (const d of drivers) {
    const b = d.pcbYtdBalances[0];
    console.log({
      name: d.name,
      active: d.active,
      terminationDate: d.terminationDate?.toISOString().slice(0, 10) ?? null,
      ytd202606: b
        ? {
            Y: Number(b.accumulatedGrossY),
            K: Number(b.accumulatedEpfK),
            X: Number(b.accumulatedMtdX),
            source: b.source,
          }
        : null,
      eligibleJune: isDriverEligibleForPayrollMonth(d, 2026, 6),
      eligibleJuly: isDriverEligibleForPayrollMonth(d, 2026, 7),
    });
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
