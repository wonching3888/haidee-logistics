/**
 * DRY RUN: preview quantity_suggested recalc for all July tong_exports.
 * Run: npx tsx --env-file=.env.local scripts/_preview-sync-suggested-july.ts
 */
import "dotenv/config";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { toDateInputValue } from "../lib/inbound-utils";
import { loadCrateExportDayInput } from "../lib/crate-export-day-context";
import {
  buildInboundDueIndexFromDayInput,
  lookupInboundDue,
} from "../lib/crate-export-inbound-due";
import { isLocationPoolShipperCode } from "../lib/constants/location-pool-shippers";
import { isCrateStockAgentShipper } from "../lib/constants/shipper-kind";
import { loadCrateStockAgentMembershipByMemberId } from "../lib/crate-stock-agent-membership-service";
import { resolveCustomerCrateStockAccount } from "../lib/customer-crate-stock-account";

const JULY_START = "2026-07-01";
const TODAY = toDateInputValue(new Date());

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

type LinePreview = {
  tongCode: string;
  oldSuggested: number;
  newSuggested: number;
  actual: number;
  match: "一致" | "不一致";
  wouldCreate: boolean;
  wouldDelete: boolean;
};

type ExportPreview = {
  exportNo: string;
  date: string;
  shipperName: string;
  thVehiclePlate: string;
  location: string;
  lines: LinePreview[];
  oldEqualsNew: boolean;
  hasFilterBugPattern: boolean;
  hasMismatchAfterRecalc: boolean;
};

async function resolveExportStockLocation(
  exportNo: string,
  shipperId: string,
  areaNote: string | null
): Promise<string> {
  const agentMembership = await loadCrateStockAgentMembershipByMemberId();
  const shipper = await prisma.shipper.findUnique({
    where: { id: shipperId },
    select: { isMultiOriginCustomer: true },
  });
  const account = resolveCustomerCrateStockAccount({
    operationalShipperId: shipperId,
    location: areaNote?.trim() ?? "",
    isMultiOriginCustomer: shipper?.isMultiOriginCustomer ?? false,
    agentMembershipByMemberId: agentMembership,
  });
  const ledger = await prisma.customerCrateLedger.findFirst({
    where: {
      changeType: "export",
      notes: { contains: exportNo },
      shipperId: account.shipperId,
    },
    select: { location: true },
    orderBy: { createdAt: "asc" },
  });
  return ledger?.location?.trim() ?? areaNote?.trim() ?? "";
}

async function main() {
  const startDate = new Date(`${JULY_START}T00:00:00.000Z`);
  const endDate = new Date(`${TODAY}T23:59:59.999Z`);

  const allRows = await prisma.tongExport.findMany({
    where: { date: { gte: startDate, lte: endDate } },
    include: {
      shipper: { select: { name: true, code: true, shipperKind: true } },
      tongType: { select: { code: true, displayOrder: true, isBox: true } },
    },
    orderBy: [
      { date: "asc" },
      { exportNo: "asc" },
      { tongType: { displayOrder: "asc" } },
    ],
  });

  const byExportNo = new Map<string, typeof allRows>();
  for (const row of allRows) {
    const exportNo = row.exportNo?.trim();
    if (!exportNo) continue;
    const list = byExportNo.get(exportNo) ?? [];
    list.push(row);
    byExportNo.set(exportNo, list);
  }

  const dueIndexCache = new Map<
    string,
    ReturnType<typeof buildInboundDueIndexFromDayInput>
  >();

  const previews: ExportPreview[] = [];

  for (const [exportNo, rows] of [...byExportNo.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    const first = rows[0];
    const dateInput = toDateInputValue(first.date);

    let dueIndex = dueIndexCache.get(dateInput);
    if (!dueIndex) {
      const dayInput = await loadCrateExportDayInput(dateInput);
      dueIndex = buildInboundDueIndexFromDayInput(dayInput);
      dueIndexCache.set(dateInput, dueIndex);
    }

    const location = await resolveExportStockLocation(
      exportNo,
      first.shipperId,
      first.areaNote
    );
    const isAgentReceipt =
      isCrateStockAgentShipper(first.shipper) ||
      isLocationPoolShipperCode(first.shipper.code);
    const dueByCode = lookupInboundDue(dueIndex, {
      shipperId: first.shipperId,
      location,
      isAgentReceipt,
    });

    const codes = new Set<string>([
      ...Object.keys(dueByCode),
      ...rows
        .filter(
          (r) =>
            !r.tongType.isBox &&
            (r.quantityActual > 0 || (r.quantitySuggested ?? 0) > 0)
        )
        .map((r) => r.tongType.code),
    ]);

    const lines: LinePreview[] = [];
    for (const code of [...codes].sort()) {
      const existing = rows.find((r) => r.tongType.code === code);
      const newSuggested = dueByCode[code] ?? 0;
      const oldSuggested = existing?.quantitySuggested ?? 0;
      const actual = existing?.quantityActual ?? 0;
      const wouldDelete = !!existing && newSuggested === 0 && actual === 0;
      const wouldCreate = !existing && newSuggested > 0;

      if (wouldDelete) continue;

      lines.push({
        tongCode: code,
        oldSuggested,
        newSuggested,
        actual,
        match: newSuggested === actual ? "一致" : "不一致",
        wouldCreate,
        wouldDelete,
      });
    }

    const oldEqualsNew = lines.every((l) => l.oldSuggested === l.newSuggested);
    const hasFilterBugPattern = lines.some(
      (l) => l.oldSuggested === 0 && l.newSuggested !== 0
    );
    const hasMismatchAfterRecalc = lines.some((l) => l.match === "不一致");

    previews.push({
      exportNo,
      date: dateInput,
      shipperName: first.shipper.name,
      thVehiclePlate: first.thVehiclePlate ?? "",
      location,
      lines,
      oldEqualsNew,
      hasFilterBugPattern,
      hasMismatchAfterRecalc,
    });
  }

  const totalExports = previews.length;
  const totalLines = previews.reduce((n, p) => n + p.lines.length, 0);
  const oldCorrect = previews.filter((p) => p.oldEqualsNew).length;
  const filterBugAffected = previews.filter((p) => p.hasFilterBugPattern).length;
  const mismatchExports = previews.filter((p) => p.hasMismatchAfterRecalc);

  const knownMismatch = new Set(["TE-20260704-012"]);

  console.log("=== JULY SUGGESTED SYNC — DRY RUN PREVIEW ===");
  console.log(`Period: ${JULY_START} → ${TODAY}`);
  console.log(`Total export receipts: ${totalExports}`);
  console.log(`Total bucket lines: ${totalLines}\n`);

  console.log("--- SUMMARY ---");
  console.log(`旧值正确（新旧 Suggested 相同）: ${oldCorrect} / ${totalExports} 笔`);
  console.log(
    `旧值=0 但新值≠0（filter bug 影响）: ${filterBugAffected} 笔`
  );
  console.log(
    `重算后不一致（新 Suggested ≠ Actual）: ${mismatchExports.length} 笔\n`
  );

  console.log("--- FULL COMPARISON TABLE ---\n");
  for (const p of previews) {
    console.log(
      `${p.exportNo} | ${p.date} | ${p.shipperName} | ${p.thVehiclePlate} | loc=${p.location || "(空)"}`
    );
    for (const l of p.lines) {
      const flags = [
        l.oldSuggested !== l.newSuggested ? "Δ" : "",
        l.wouldCreate ? "NEW" : "",
      ]
        .filter(Boolean)
        .join(" ");
      console.log(
        `  ${l.tongCode}: old=${l.oldSuggested} new=${l.newSuggested} actual=${l.actual} → ${l.match}${flags ? ` [${flags}]` : ""}`
      );
    }
    console.log("");
  }

  console.log("--- MISMATCH LIST (新 Suggested ≠ Actual) ---\n");
  for (const p of mismatchExports) {
    const mismatchedLines = p.lines.filter((l) => l.match === "不一致");
    console.log(
      `${p.exportNo} | ${p.shipperName} | ${p.thVehiclePlate}`
    );
    for (const l of mismatchedLines) {
      console.log(
        `  ${l.tongCode}: new=${l.newSuggested} actual=${l.actual} (diff=${l.newSuggested - l.actual})`
      );
    }
    console.log("");
  }

  const newlyRevealed = mismatchExports.filter(
    (p) => !knownMismatch.has(p.exportNo)
  );
  console.log("--- NEWLY REVEALED MISMATCHES (beyond TE-012) ---\n");
  if (newlyRevealed.length === 0) {
    console.log("无。除已知 TE-20260704-012 外，无新增不一致案例。\n");
  } else {
    for (const p of newlyRevealed) {
      console.log(`${p.exportNo} | ${p.shipperName}`);
      for (const l of p.lines.filter((x) => x.match === "不一致")) {
        console.log(
          `  ${l.tongCode}: new=${l.newSuggested} actual=${l.actual}`
        );
      }
    }
    console.log("");
  }

  if (filterBugAffected > 0) {
    console.log("--- FILTER BUG CASES (old=0, new≠0) ---\n");
    for (const p of previews.filter((x) => x.hasFilterBugPattern)) {
      console.log(`${p.exportNo} | ${p.shipperName}`);
      for (const l of p.lines.filter(
        (x) => x.oldSuggested === 0 && x.newSuggested !== 0
      )) {
        console.log(
          `  ${l.tongCode}: old=0 new=${l.newSuggested} actual=${l.actual}`
        );
      }
    }
    console.log("");
  }

  const outDir = join(process.cwd(), "scripts", "_output");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "july-suggested-sync-dry-run.json");
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        period: { from: JULY_START, to: TODAY },
        summary: {
          totalExports,
          totalLines,
          oldCorrect,
          filterBugAffected,
          mismatchCount: mismatchExports.length,
          newlyRevealedCount: newlyRevealed.length,
        },
        previews,
        mismatchExportNos: mismatchExports.map((p) => p.exportNo),
        newlyRevealedExportNos: newlyRevealed.map((p) => p.exportNo),
      },
      null,
      2
    )
  );
  console.log(`JSON saved: ${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
