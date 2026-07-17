/**
 * Read-only: JV manifest + which DriverPayrollMonth rows lack epfEmployerOverride.
 * Run: node --env-file=.env.local --import tsx scripts/_audit-epf-override-coverage-readonly.ts
 */
import { readPayrollJvManifest } from "@/lib/payroll-jv-export-manifest";
import { decimalToNumber } from "@/lib/freight-rates";
import { prisma } from "@/lib/prisma";

async function main() {
  const manifest = readPayrollJvManifest();
  console.log("=== JV manifest entries ===");
  for (const e of manifest.entries) {
    console.log(
      `  ${e.status.padEnd(6)} ${e.yearMonth} rev${e.revision} ${e.filename}`
    );
  }
  const active = manifest.entries.filter((e) => e.status === "active");
  const activeMonths = [...new Set(active.map((e) => e.yearMonth))];
  console.log(
    `\nActive yearMonths in manifest: ${activeMonths.join(", ") || "(none)"}`
  );

  const months = await prisma.driverPayrollMonth.findMany({
    select: {
      yearMonth: true,
      epfEmployerOverride: true,
      driver: { select: { name: true } },
    },
    orderBy: [{ yearMonth: "asc" }, { driver: { name: "asc" } }],
  });

  const byYm = new Map<
    string,
    { total: number; withOverride: number; without: string[] }
  >();
  for (const m of months) {
    let row = byYm.get(m.yearMonth);
    if (!row) {
      row = { total: 0, withOverride: 0, without: [] };
      byYm.set(m.yearMonth, row);
    }
    row.total += 1;
    if (decimalToNumber(m.epfEmployerOverride) != null) {
      row.withOverride += 1;
    } else {
      row.without.push(m.driver.name);
    }
  }

  console.log(
    "\n=== DriverPayrollMonth epfEmployerOverride coverage (all months) ==="
  );
  for (const [ym, row] of [...byYm.entries()].sort()) {
    const exposed = row.without.length;
    const activeFlag = activeMonths.includes(ym) ? " [ACTIVE JV]" : "";
    console.log(
      `  ${ym}: ${row.withOverride}/${row.total} have override; ${exposed} exposed${activeFlag}` +
        (exposed ? ` → ${row.without.join(", ")}` : "")
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
