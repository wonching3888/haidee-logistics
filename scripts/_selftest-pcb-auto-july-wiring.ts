/**
 * Self-test: PCB auto wiring from July, June unchanged, override priority, YTD seed.
 * Uses June gross/EPF as July placeholder; cleans up July test artifacts.
 *
 * Run: node --env-file=.env.local --import tsx scripts/_selftest-pcb-auto-july-wiring.ts
 */
import { calculateStatutoryDeductions } from "@/lib/payroll-statutory";
import {
  emptyPcbYtd,
  isPcbAutoCalcMonth,
  loadPcbYtdBalancesAsOf,
  resolvePayrollPcb,
  deletePcbYtdBalancesAsOf,
  upsertPcbYtdBalance,
} from "@/lib/pcb-ytd-balance";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/freight-rates";
import { randomUUID } from "node:crypto";

async function main() {
  console.log("=== PCB auto wiring self-test ===\n");

  // 1) Policy gates
  if (isPcbAutoCalcMonth(2026, 6)) throw new Error("June must not auto-calc");
  if (!isPcbAutoCalcMonth(2026, 7)) throw new Error("July must auto-calc");
  console.log("OK policy: June off, July on");

  // 2) June balances must exist (seed first if missing)
  let juneBalances = await loadPcbYtdBalancesAsOf("2026-06");
  if (juneBalances.size < 14) {
    console.log("Seeding June YTD balances...");
    const { execSync } = await import("node:child_process");
    execSync(
      "node --env-file=.env.local --import tsx scripts/_seed-pcb-ytd-end-of-june-2026.ts",
      { stdio: "inherit" }
    );
    juneBalances = await loadPcbYtdBalancesAsOf("2026-06");
  }
  if (juneBalances.size < 14) {
    throw new Error(`Expected >=14 June balances, got ${juneBalances.size}`);
  }
  console.log(`OK June YTD balances loaded: ${juneBalances.size} drivers`);

  const akim = await prisma.driver.findFirstOrThrow({
    where: { name: "Akim" },
    select: {
      id: true,
      maritalStatus: true,
      spouseWorking: true,
      childCount: true,
    },
  });
  const akimYtd = juneBalances.get(akim.id);
  if (!akimYtd) throw new Error("Akim June YTD missing");

  // 3) June without override → 0 (not auto)
  const juneNone = resolvePayrollPcb({
    year: 2026,
    month: 6,
    grossSalary: 4630,
    epfEmployee: 511,
    maritalStatus: akim.maritalStatus as "married",
    spouseWorking: akim.spouseWorking,
    childCount: akim.childCount,
    ytdBeforeMonth: emptyPcbYtd(),
  });
  if (juneNone.pcb !== 0 || juneNone.source !== "none") {
    throw new Error(`June auto should be none/0, got ${JSON.stringify(juneNone)}`);
  }
  console.log("OK June without override → PCB 0 (source=none)");

  // 4) June with override → override
  const juneOverride = resolvePayrollPcb({
    year: 2026,
    month: 6,
    grossSalary: 4630,
    epfEmployee: 511,
    maritalStatus: "married",
    spouseWorking: true,
    childCount: 2,
    ytdBeforeMonth: emptyPcbYtd(),
    pcbOverride: 41.5,
  });
  if (juneOverride.pcb !== 41.5 || juneOverride.source !== "override") {
    throw new Error("June override failed");
  }
  console.log("OK June override → 41.50");

  // 5) July auto from June YTD (placeholder: same gross/EPF as June)
  const julyAuto = resolvePayrollPcb({
    year: 2026,
    month: 7,
    grossSalary: 4630,
    epfEmployee: 511,
    maritalStatus: akim.maritalStatus as "married",
    spouseWorking: akim.spouseWorking,
    childCount: akim.childCount,
    ytdBeforeMonth: akimYtd,
  });
  if (julyAuto.source !== "auto" || julyAuto.pcb <= 0) {
    throw new Error(`July auto failed: ${JSON.stringify(julyAuto)}`);
  }
  console.log(
    `OK July auto PCB=${julyAuto.pcb.toFixed(2)} (from June YTD Y=${akimYtd.accumulatedGrossY} K=${akimYtd.accumulatedEpfK} X=${akimYtd.accumulatedMtdX})`
  );

  // 6) July override still wins
  const julyOverride = resolvePayrollPcb({
    year: 2026,
    month: 7,
    grossSalary: 4630,
    epfEmployee: 511,
    maritalStatus: "married",
    spouseWorking: true,
    childCount: 2,
    ytdBeforeMonth: akimYtd,
    pcbOverride: 1.11,
  });
  if (julyOverride.pcb !== 1.11 || julyOverride.source !== "override") {
    throw new Error("July override priority failed");
  }
  console.log("OK July override priority → 1.11");

  // 7) statutory path uses engine (not hard-coded 0)
  const statutory = calculateStatutoryDeductions({
    grossSalary: 4630,
    maritalStatus: "married",
    spouseWorking: true,
    childCount: 2,
    payrollYear: 2026,
    payrollMonth: 7,
    pcbYtdBeforeMonth: akimYtd,
  });
  if (statutory.pcb !== julyAuto.pcb) {
    throw new Error(
      `statutory pcb ${statutory.pcb} != resolve ${julyAuto.pcb}`
    );
  }
  console.log("OK calculateStatutoryDeductions wires auto PCB");

  // 8) Locked final wins when no override
  const locked = resolvePayrollPcb({
    year: 2026,
    month: 7,
    grossSalary: 4630,
    epfEmployee: 511,
    maritalStatus: "married",
    spouseWorking: true,
    childCount: 2,
    ytdBeforeMonth: akimYtd,
    pcbLocked: true,
    pcbFinal: 77.77,
  });
  if (locked.pcb !== 77.77 || locked.source !== "locked") {
    throw new Error("locked final failed");
  }
  console.log("OK locked pcbFinal → 77.77");

  // 9) Placeholder July YTD write + cleanup (do not leave test rows)
  const testYm = "2026-07-SELFTEST";
  await upsertPcbYtdBalance({
    driverId: akim.id,
    asOfYearMonth: testYm,
    balance: {
      accumulatedGrossY: 1,
      accumulatedEpfK: 1,
      accumulatedMtdX: 1,
      accumulatedZakatZ: 0,
    },
    source: "manual",
  });
  await deletePcbYtdBalancesAsOf(testYm);
  const gone = await loadPcbYtdBalancesAsOf(testYm);
  if (gone.size !== 0) throw new Error("cleanup failed");
  console.log("OK placeholder YTD write/cleanup");

  // 10) Spot-check June fleet still uses overrides (Akim 41.50), not auto 0
  const { loadFleetPayrollAggregate } = await import("@/lib/payroll-fleet");
  const juneFleet = await loadFleetPayrollAggregate(2026, 6, { sync: false });
  const akimRow = juneFleet.rows.find((r) => r.name === "Akim");
  if (!akimRow) throw new Error("Akim missing from June fleet");
  if (akimRow.pcb !== 41.5) {
    throw new Error(
      `June Akim PCB expected 41.50 (override), got ${akimRow.pcb}`
    );
  }
  console.log("OK June fleet Akim PCB=41.50 (override preserved)");

  console.log("\nAll self-tests passed.");
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
