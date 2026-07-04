/**
 * Apply Wan PCB restore + generate June 2026 payroll JV rev6 (EPF brackets)
 * + 14 payslips. Plan A: include Naim advance 2500.
 *
 * Run: node --env-file=.env.local --import tsx scripts/_apply-june-2026-epf-rev6.ts
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright";
import { DriverPayslipPrint } from "@/components/driver-payroll/DriverPayslipPrint";
import { payslipWagesTotal } from "@/lib/driver-payslip";
import {
  buildMonthlyDriverJvRows,
  generatePayrollJvCsv,
} from "@/lib/payroll-jv-export";
import {
  payrollJvOutputPath,
  registerPayrollJvExport,
  voidPayrollJvExport,
  readPayrollJvManifest,
} from "@/lib/payroll-jv-export-manifest";
import { applyPayrollOverridePatch } from "@/lib/payroll-override-write";
import {
  buildDriverPayrollSummaryFromRecords,
  type DriverPayrollDriverInput,
} from "@/lib/payroll-fleet";
import { lookupEpfContributions } from "@/lib/constants/epf-brackets";
import { decimalToNumber } from "@/lib/freight-rates";
import type { MaritalStatus } from "@/lib/constants/payroll";
import { prisma } from "@/lib/prisma";
import type { AppUser } from "@/types";

const YEAR = 2026;
const MONTH = 6;
const YEAR_MONTH = "2026-06";
const REV5_FILENAME = "payroll-jv-2026-06-rev5-pcb-override.csv";
const REV6_FILENAME = "payroll-jv-2026-06-rev6-epf-brackets.csv";
const REV5_VOID_REASON =
  "EPF官方分档表修正+Wan PCB恢复+Naim借支更新，替换为rev6";
const WAN_PCB = 11.65;
const WAN_PCB_AUDIT =
  "依据会计原始工资表核实，此前CORNIE的删除操作予以覆盖";

const EXPECTED_EPF: Record<string, { employer: number; employee: number }> = {
  Halim: { employer: 463, employee: 392 },
  Awang: { employer: 624, employee: 528 },
  Azrin: { employer: 533, employee: 451 },
  Wan: { employer: 624, employee: 528 },
  Own: { employer: 541, employee: 458 },
  Rozaime: { employer: 541, employee: 458 },
  Fook: { employer: 588, employee: 498 },
  Faizal: { employer: 606, employee: 513 },
  Akim: { employer: 604, employee: 511 },
  Naim: { employer: 630, employee: 533 },
  Azhar: { employer: 617, employee: 522 },
  Pinat: { employer: 612, employee: 561 },
  Din: { employer: 115, employee: 97 },
  Ikmal: { employer: 601, employee: 509 },
};

const EXPECTED_PCB: Record<string, number> = {
  Wan: 11.65,
  Own: 24.45,
  Fook: 52.55,
  Faizal: 36.2,
  Akim: 41.5,
  Naim: 41.75,
  Azhar: 38.65,
};

const EXPECTED_NET: Record<string, number> = {
  Akim: 2210.14,
  Awang: 1693.02,
  Azhar: 2600.49,
  Azrin: 1280.22,
  Faizal: 2533.4,
  Fook: 2425.3,
  Halim: 1606.5,
  Ikmal: 2033.68,
  Naim: 1684.99,
  Own: 2107.35,
  Pinat: 2405.82,
  Rozaime: 1831.8,
  Wan: 1481.37,
};

const EXPECTED_ADVANCE: Record<string, number> = {
  Awang: 2500,
  Naim: 2500,
  Wan: 2700,
};

function parseCsvRows(raw: string) {
  return raw
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isExpectedDiffRow(row: string) {
  return (
    row.includes("4101-0000") ||
    row.includes("9005-") ||
    row.includes("4104-") ||
    row.includes("3301-NAIM") ||
    row.includes("EPF") ||
    row.includes("实发") ||
    row.includes("Net Pay") ||
    row.includes("借支") ||
    row.includes("Advance")
  );
}

async function resolveActor() {
  const admin = await prisma.user.findFirst({
    where: { role: "admin", active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true },
  });
  if (!admin) throw new Error("No active admin");
  return admin;
}

async function restoreWanPcb(actorUserId: string) {
  const wan = await prisma.driver.findFirst({
    where: { name: "Wan" },
    include: { payrollMonths: { where: { yearMonth: YEAR_MONTH } } },
  });
  const month = wan?.payrollMonths[0];
  if (!month) throw new Error("Wan June month not found");

  const result = await applyPayrollOverridePatch({
    payrollMonthId: month.id,
    actorUserId,
    auditNote: WAN_PCB_AUDIT,
    epfEmployee: decimalToNumber(month.epfEmployeeOverride),
    epfEmployer: decimalToNumber(month.epfEmployerOverride),
    socsoEmployee: decimalToNumber(month.socsoEmployeeOverride),
    socsoEmployer: decimalToNumber(month.socsoEmployerOverride),
    lindung24Jam: decimalToNumber(month.lindung24JamOverride),
    eisEmployee: decimalToNumber(month.eisEmployeeOverride),
    eisEmployer: decimalToNumber(month.eisEmployerOverride),
    pcb: WAN_PCB,
  });

  const after = await prisma.driverPayrollMonth.findUnique({
    where: { id: month.id },
    select: { pcbOverride: true },
  });
  const pcb = decimalToNumber(after?.pcbOverride ?? null);
  if (pcb !== WAN_PCB) {
    throw new Error(`Wan PCB write failed: got ${pcb}`);
  }

  const log = await prisma.payrollChangeLog.findFirst({
    where: {
      payrollMonthId: month.id,
      eventType: "override_update",
      field: "pcbOverride",
      toValue: "11.65",
    },
    orderBy: { changedAt: "desc" },
  });

  console.log(
    `Wan PCB: null → ${pcb} | changed=${result.changed} | log=${log?.id}`
  );
  return { payrollMonthId: month.id, logId: log?.id };
}

async function generateRev6() {
  const result = await buildMonthlyDriverJvRows(YEAR, MONTH);

  console.log(`\nDrivers: ${result.drivers.length}`);
  console.log(
    `Skipped: ${result.skippedDrivers.map((d) => d.driverName).join(", ") || "none"}`
  );
  console.log(`All balanced: ${result.allBalanced}`);

  if (!result.allBalanced) {
    for (const row of result.imbalancedDrivers) {
      console.log(
        `IMBALANCED ${row.driverName}: ${row.debitTotal} vs ${row.creditTotal}`
      );
    }
    throw new Error("JV unbalanced");
  }

  for (const jv of result.drivers) {
    const expEpf = EXPECTED_EPF[jv.driverName];
    const expNet = EXPECTED_NET[jv.driverName];
    const expPcb = EXPECTED_PCB[jv.driverName] ?? 0;
    const ee =
      Math.round((jv.amounts.epfPayable - jv.amounts.epfEmployer) * 100) / 100;

    if (!expEpf) throw new Error(`No expected EPF for ${jv.driverName}`);
    if (jv.amounts.epfEmployer !== expEpf.employer || ee !== expEpf.employee) {
      throw new Error(
        `${jv.driverName} EPF ${jv.amounts.epfEmployer}/${ee} != ${expEpf.employer}/${expEpf.employee}`
      );
    }
    if (jv.amounts.pcb !== expPcb) {
      throw new Error(
        `${jv.driverName} PCB ${jv.amounts.pcb} != ${expPcb}`
      );
    }
    if (jv.amounts.netSalary !== expNet) {
      throw new Error(
        `${jv.driverName} NET ${jv.amounts.netSalary} != ${expNet}`
      );
    }
    const expAdv = EXPECTED_ADVANCE[jv.driverName];
    if (expAdv != null && jv.amounts.advance !== expAdv) {
      throw new Error(
        `${jv.driverName} advance ${jv.amounts.advance} != ${expAdv}`
      );
    }

    console.log(
      `  ${jv.jvNo} ${jv.driverName}: bal=${jv.debitTotal.toFixed(2)} EPF=${jv.amounts.epfEmployer}/${ee} PCB=${jv.amounts.pcb} NET=${jv.amounts.netSalary.toFixed(2)}`
    );
  }

  // Din EPF check (no JV)
  const din = await prisma.driver.findFirst({
    where: { name: "Din" },
    include: {
      payrollMonths: {
        where: { yearMonth: YEAR_MONTH },
        include: { trips: true, extras: true },
      },
    },
  });
  if (din?.payrollMonths[0]) {
    const m = din.payrollMonths[0];
    const summary = buildDriverPayrollSummaryFromRecords({
      driver: {
        id: din.id,
        name: din.name,
        baseSalary: decimalToNumber(din.baseSalary),
        maritalStatus: din.maritalStatus as MaritalStatus | null,
        childCount: din.childCount,
        isSocsoSecondCategory: din.isSocsoSecondCategory,
      },
      trips: m.trips,
      extras: m.extras,
      overrides: m,
    });
    const exp = EXPECTED_EPF.Din;
    if (
      summary.statutory.epfEmployer !== exp.employer ||
      summary.statutory.epfEmployee !== exp.employee
    ) {
      throw new Error(
        `Din EPF ${summary.statutory.epfEmployer}/${summary.statutory.epfEmployee}`
      );
    }
    console.log(
      `  Din (no JV): EPF=${summary.statutory.epfEmployer}/${summary.statutory.epfEmployee}`
    );
  }

  const csv = generatePayrollJvCsv(result);
  const outPath = payrollJvOutputPath(REV6_FILENAME);
  const outDir = payrollJvOutputPath(".");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath, csv, "utf8");

  const rev5Path = payrollJvOutputPath(REV5_FILENAME);
  if (!existsSync(rev5Path)) throw new Error("rev5 missing");
  const rev5Rows = parseCsvRows(readFileSync(rev5Path, "utf8"));
  const rev6Rows = parseCsvRows(csv);
  const rev5Set = new Set(rev5Rows);
  const rev6Set = new Set(rev6Rows);
  const onlyRev5 = rev5Rows.filter((r) => !rev6Set.has(r));
  const onlyRev6 = rev6Rows.filter((r) => !rev5Set.has(r));
  const unexpected = [
    ...onlyRev5.filter((r) => !isExpectedDiffRow(r)),
    ...onlyRev6.filter((r) => !isExpectedDiffRow(r)),
  ];
  if (unexpected.length) {
    console.error("Unexpected diffs:");
    for (const r of unexpected) console.error(`  ${r}`);
    throw new Error("Unexpected rev6 vs rev5 diffs");
  }

  console.log(`\nrev6 vs rev5: -${onlyRev5.length} +${onlyRev6.length} (EPF + Naim advance only)`);
  for (const r of onlyRev5) console.log(`  - ${r}`);
  for (const r of onlyRev6) console.log(`  + ${r}`);

  voidPayrollJvExport({
    yearMonth: YEAR_MONTH,
    filename: REV5_FILENAME,
    voidReason: REV5_VOID_REASON,
    supersededBy: REV6_FILENAME,
    notes: "EPF Third Schedule + Wan PCB 11.65 restore + Naim advance 2500",
  });

  registerPayrollJvExport({
    yearMonth: YEAR_MONTH,
    filename: REV6_FILENAME,
    status: "active",
    revision: 6,
    driverCount: result.drivers.length,
    notes:
      "EPF官方分档表；Pinat 612/561；Wan PCB 11.65 NET 1481.37；Naim借支2500",
  });

  console.log(`Wrote: ${outPath}`);
  return { result, onlyRev5, onlyRev6 };
}

async function regeneratePayslips() {
  const outDir = path.join(process.cwd(), "scripts/_output");
  mkdirSync(outDir, { recursive: true });
  const css = readFileSync(
    path.join(process.cwd(), "components/driver-payroll/driver-payslip-print.css"),
    "utf8"
  );

  const names = Object.keys(EXPECTED_EPF);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });

  for (const name of names) {
    const driver = await prisma.driver.findFirst({
      where: { name },
      include: {
        payrollMonths: {
          where: { yearMonth: YEAR_MONTH },
          include: { trips: true, extras: true },
        },
      },
    });
    if (!driver?.payrollMonths[0]) {
      console.log(`  ${name}: no payroll month — skip payslip`);
      continue;
    }
    const monthRecord = driver.payrollMonths[0];
    const summary = buildDriverPayrollSummaryFromRecords({
      driver: {
        id: driver.id,
        name: driver.name,
        baseSalary: decimalToNumber(driver.baseSalary),
        maritalStatus: driver.maritalStatus as MaritalStatus | null,
        childCount: driver.childCount,
        isSocsoSecondCategory: driver.isSocsoSecondCategory,
      },
      trips: monthRecord.trips,
      extras: monthRecord.extras,
      overrides: monthRecord,
    });

    const exp = EXPECTED_EPF[name];
    if (
      summary.statutory.epfEmployer !== exp.employer ||
      summary.statutory.epfEmployee !== exp.employee
    ) {
      throw new Error(`${name} payslip EPF mismatch`);
    }
    if (name === "Wan") {
      if (summary.statutory.pcb !== WAN_PCB || summary.netSalary !== 1481.37) {
        throw new Error(
          `Wan payslip PCB/NET ${summary.statutory.pcb}/${summary.netSalary}`
        );
      }
    }

    const advances = monthRecord.extras
      .filter((item) => item.type === "advance")
      .map((item) => ({
        date: item.date.toISOString().slice(0, 10),
        amount: decimalToNumber(item.amount) ?? 0,
        note: item.note,
      }));

    const body = renderToStaticMarkup(
      React.createElement(DriverPayslipPrint, {
        year: YEAR,
        month: MONTH,
        driver: {
          payrollName: driver.fullName?.trim() || driver.name,
          name: driver.name,
          icNumber: driver.icNumber,
          baseSalary: decimalToNumber(driver.baseSalary),
          bankName: driver.bankName,
          bankAccount: driver.bankAccount,
        },
        summary,
        advances,
      })
    );

    const slug = name.toLowerCase();
    const htmlPath = path.join(outDir, `payslip-${slug}-june-2026.html`);
    const pngPath = path.join(outDir, `payslip-${slug}-june-2026.png`);
    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><style>
body{margin:0;padding:24px;background:#f1f5f9;font-family:Arial,sans-serif}
.sheet{max-width:210mm;margin:0 auto;background:#fff;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,.08)}
${css}
</style></head><body><div class="sheet">${body}</div></body></html>`;
    writeFileSync(htmlPath, html, "utf8");
    await page.goto(`file:///${htmlPath.replace(/\\/g, "/")}`, {
      waitUntil: "load",
    });
    await page.locator(".driver-payslip-print").screenshot({ path: pngPath });

    console.log(
      `  ${name}: EPF=${summary.statutory.epfEmployer}/${summary.statutory.epfEmployee} PCB=${summary.statutory.pcb} NET=${summary.netSalary.toFixed(2)} wages=${payslipWagesTotal(summary).toFixed(2)}`
    );
  }

  await browser.close();
}

async function preflightSnapshot() {
  console.log("\n=== Preflight snapshot (must match plan A) ===\n");
  const checks: Array<{ name: string; ok: boolean; detail: string }> = [];

  for (const name of Object.keys(EXPECTED_EPF)) {
    const driver = await prisma.driver.findFirst({
      where: { name },
      include: {
        payrollMonths: {
          where: { yearMonth: YEAR_MONTH },
          include: { trips: true, extras: true },
        },
      },
    });
    const m = driver?.payrollMonths[0];
    if (!m) {
      checks.push({ name, ok: false, detail: "no month" });
      continue;
    }
    // Wan PCB still null before restore — expect null now
    const pcb = decimalToNumber(m.pcbOverride);
    const adv = m.extras
      .filter((e) => e.type === "advance")
      .reduce((s, e) => s + (decimalToNumber(e.amount) ?? 0), 0);

    // Simulate with Wan PCB restored for EPF/net check
    const summary = buildDriverPayrollSummaryFromRecords({
      driver: {
        id: driver!.id,
        name: driver!.name,
        baseSalary: decimalToNumber(driver!.baseSalary),
        maritalStatus: driver!.maritalStatus as MaritalStatus | null,
        childCount: driver!.childCount,
        isSocsoSecondCategory: driver!.isSocsoSecondCategory,
      },
      trips: m.trips,
      extras: m.extras,
      overrides: {
        ...m,
        pcbOverride: name === "Wan" ? WAN_PCB : m.pcbOverride,
      },
    });

    const epf = lookupEpfContributions(summary.grossSalary);
    const expEpf = EXPECTED_EPF[name];
    const epfOk =
      epf.employer === expEpf.employer && epf.employee === expEpf.employee;
    const sysOk =
      summary.statutory.epfEmployer === expEpf.employer &&
      summary.statutory.epfEmployee === expEpf.employee;

    let pcbOk = true;
    if (name === "Wan") {
      pcbOk = pcb == null; // must still be null before write
    } else if (name in EXPECTED_PCB) {
      pcbOk = pcb === EXPECTED_PCB[name];
    }

    let advOk = true;
    if (name in EXPECTED_ADVANCE) {
      advOk = adv === EXPECTED_ADVANCE[name];
    }

    const netOk =
      name === "Din" ||
      name === "Wan" ||
      !(name in EXPECTED_NET) ||
      summary.netSalary === EXPECTED_NET[name];
    // Wan net only after PCB restore
    const wanNetOk =
      name !== "Wan" || summary.netSalary === EXPECTED_NET.Wan;

    const ok = epfOk && sysOk && pcbOk && advOk && wanNetOk;
    checks.push({
      name,
      ok,
      detail: `gross=${summary.grossSalary} EPF=${summary.statutory.epfEmployer}/${summary.statutory.epfEmployee} pcbDB=${pcb ?? "null"} adv=${adv} netSim=${summary.netSalary}`,
    });
  }

  for (const c of checks) {
    console.log(`  ${c.ok ? "OK" : "FAIL"} ${c.name}: ${c.detail}`);
  }
  if (checks.some((c) => !c.ok)) {
    throw new Error("Preflight failed — abort write");
  }
  console.log("\nPreflight OK — no unexpected drift\n");
}

async function main() {
  const admin = await resolveActor();
  (globalThis as { __BACKFILL_USER__?: AppUser }).__BACKFILL_USER__ = {
    id: admin.id,
    email: admin.email ?? "admin@system",
    name: admin.name ?? "EPF rev6 apply",
    role: "admin",
    language: "zh",
  };

  console.log(`Actor: ${admin.email}`);

  await preflightSnapshot();

  console.log("=== 1. Restore Wan PCB ===");
  await restoreWanPcb(admin.id);

  console.log("\n=== 2. Generate rev6 ===");
  const { onlyRev5, onlyRev6 } = await generateRev6();

  console.log("\n=== 3. Payslips (14) ===");
  await regeneratePayslips();

  const manifest = readPayrollJvManifest();
  const rev5 = manifest.entries.find((e) => e.filename === REV5_FILENAME);
  const rev6 = manifest.entries.find((e) => e.filename === REV6_FILENAME);

  console.log("\n========== DONE ==========");
  console.log(`rev5: ${rev5?.status} — ${rev5?.voidReason}`);
  console.log(`rev6: ${rev6?.status} revision=${rev6?.revision}`);
  console.log(`diff rows: -${onlyRev5.length} +${onlyRev6.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
