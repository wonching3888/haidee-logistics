/**
 * Apply migration, seed whitelist, bulk-write July suggested, final verification.
 * Run: npx tsx --env-file=.env.local scripts/_apply-july-suggested-bulk.ts
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { prisma as appPrisma } from "../lib/prisma";
import { toDateInputValue } from "../lib/inbound-utils";
import { syncCrateExportSuggestedForContexts } from "../lib/crate-export-sync-suggested";
import {
  addCrateExportMismatchWhitelistEntry,
  listCrateExportMismatchWhitelist,
  loadCrateExportMismatchWhitelistShipperIds,
} from "../lib/crate-export-mismatch-whitelist-service";
import { loadLocationPoolShipperIds } from "../lib/location-pool-shippers-service";
import {
  crateExportHasSuggestedActualMismatch,
  resolveCrateExportListMismatch,
} from "../lib/crate-export-list";

const JULY_START = "2026-07-01";
const TODAY = toDateInputValue(new Date());

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function applyMigration() {
  const sqlPath = path.join(
    process.cwd(),
    "prisma/migrations/20260705140000_crate_export_mismatch_whitelist/migration.sql"
  );
  const sql = fs.readFileSync(sqlPath, "utf8");
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    await prisma.$executeRawUnsafe(stmt);
    console.log("migration:", stmt.slice(0, 70).replace(/\s+/g, " "));
  }
}

async function seedWhitelist() {
  const poolIds = await loadLocationPoolShipperIds();
  const thaiTong = await prisma.shipper.findFirst({
    where: { name: "THAI TONG FISHERY" },
    select: { id: true, name: true, code: true },
  });
  if (!thaiTong) throw new Error("THAI TONG FISHERY shipper not found");

  const seeds = [
    {
      shipperId: thaiTong.id,
      note: "VIO full-truck policy — skip mismatch highlight",
    },
    {
      shipperId: poolIds.PATTANI,
      note: "北大年 pool — warehouse judgment, not inbound-mechanical",
    },
    {
      shipperId: poolIds.SONGKHLA,
      note: "宋卡 pool — warehouse judgment, not inbound-mechanical",
    },
  ];

  for (const seed of seeds) {
    await addCrateExportMismatchWhitelistEntry(seed);
    const shipper = await prisma.shipper.findUnique({
      where: { id: seed.shipperId },
      select: { name: true, code: true },
    });
    console.log(`whitelist seed: ${shipper?.name} (${shipper?.code})`);
  }
}

async function snapshotJulyExports() {
  const start = new Date(`${JULY_START}T00:00:00.000Z`);
  const end = new Date(`${TODAY}T23:59:59.999Z`);
  return prisma.tongExport.findMany({
    where: { date: { gte: start, lte: end } },
    include: { tongType: { select: { code: true } } },
    orderBy: [{ exportNo: "asc" }, { tongType: { displayOrder: "asc" } }],
  });
}

function summarizeRows(
  rows: Awaited<ReturnType<typeof snapshotJulyExports>>
) {
  const actualTotal = rows.reduce((n, r) => n + r.quantityActual, 0);
  const suggestedTotal = rows.reduce(
    (n, r) => n + (r.quantitySuggested ?? 0),
    0
  );
  const exportNos = new Set(
    rows.map((r) => r.exportNo?.trim()).filter(Boolean) as string[]
  );
  return {
    lineCount: rows.length,
    exportCount: exportNos.size,
    actualTotal,
    suggestedTotal,
  };
}

async function bulkSyncJuly() {
  const start = new Date(`${JULY_START}T00:00:00.000Z`);
  const end = new Date(`${TODAY}T23:59:59.999Z`);
  const rows = await prisma.tongExport.findMany({
    where: { date: { gte: start, lte: end } },
    select: { shipperId: true, date: true },
  });

  const contextMap = new Map<string, { dateInput: string; shipperId: string }>();
  for (const row of rows) {
    const dateInput = toDateInputValue(row.date);
    const key = `${dateInput}|${row.shipperId}`;
    contextMap.set(key, { dateInput, shipperId: row.shipperId });
  }

  const contexts = [...contextMap.values()];
  console.log(`sync contexts: ${contexts.length}`);
  const { updatedExportNos } = await syncCrateExportSuggestedForContexts(
    contexts,
    appPrisma
  );
  console.log(`updated export receipts: ${updatedExportNos.length}`);
  return updatedExportNos;
}

async function buildJulyHighlightReport() {
  const whitelist = await loadCrateExportMismatchWhitelistShipperIds();
  const start = new Date(`${JULY_START}T00:00:00.000Z`);
  const end = new Date(`${TODAY}T23:59:59.999Z`);

  const rows = await prisma.tongExport.findMany({
    where: { date: { gte: start, lte: end } },
    include: {
      shipper: { select: { id: true, name: true, code: true } },
      tongType: { select: { code: true } },
    },
    orderBy: [{ date: "asc" }, { exportNo: "asc" }],
  });

  const byExport = new Map<
    string,
    {
      exportNo: string;
      date: string;
      shipperId: string;
      shipperName: string;
      thVehiclePlate: string;
      lines: {
        tongCode: string;
        quantitySuggested: number;
        quantityActual: number;
      }[];
    }
  >();

  for (const row of rows) {
    const exportNo = row.exportNo?.trim();
    if (!exportNo) continue;
    const line = {
      tongCode: row.tongType.code,
      quantitySuggested: row.quantitySuggested ?? 0,
      quantityActual: row.quantityActual,
    };
    const existing = byExport.get(exportNo);
    if (existing) {
      existing.lines.push(line);
      continue;
    }
    byExport.set(exportNo, {
      exportNo,
      date: toDateInputValue(row.date),
      shipperId: row.shipperId,
      shipperName: row.shipper.name,
      thVehiclePlate: row.thVehiclePlate,
      lines: [line],
    });
  }

  const highlighted: typeof byExport extends Map<string, infer V> ? V[] : never =
    [];
  const whitelistedButMismatch: typeof highlighted = [];

  for (const entry of byExport.values()) {
    const rawMismatch = crateExportHasSuggestedActualMismatch(entry.lines);
    const listMismatch = resolveCrateExportListMismatch(
      entry.lines,
      entry.shipperId,
      whitelist
    );
    if (rawMismatch && whitelist.has(entry.shipperId)) {
      whitelistedButMismatch.push(entry);
    }
    if (listMismatch) {
      highlighted.push(entry);
    }
  }

  highlighted.sort((a, b) => a.exportNo.localeCompare(b.exportNo));
  whitelistedButMismatch.sort((a, b) => a.exportNo.localeCompare(b.exportNo));

  return { highlighted, whitelistedButMismatch, whitelist };
}

async function main() {
  console.log("=== STEP 1: Migration ===");
  await applyMigration();

  console.log("\n=== STEP 2: Before snapshot ===");
  const before = summarizeRows(await snapshotJulyExports());
  console.log(before);

  console.log("\n=== STEP 3: Seed whitelist ===");
  await seedWhitelist();
  const whitelistRows = await listCrateExportMismatchWhitelist();
  for (const row of whitelistRows) {
    console.log(`  ${row.shipperName} | ${row.shipperId} | ${row.note ?? ""}`);
  }

  console.log("\n=== STEP 4: Bulk sync July suggested ===");
  const updated = await bulkSyncJuly();

  console.log("\n=== STEP 5: After snapshot ===");
  const after = summarizeRows(await snapshotJulyExports());
  console.log(after);

  if (after.actualTotal !== before.actualTotal) {
    throw new Error(
      `ACTUAL TOTAL CHANGED ${before.actualTotal} -> ${after.actualTotal}`
    );
  }
  if (after.lineCount !== before.lineCount) {
    console.warn(
      `line count changed ${before.lineCount} -> ${after.lineCount} (may be zero-row cleanup)`
    );
  }

  console.log("\n=== STEP 6: Final highlight list (whitelist applied) ===");
  const report = await buildJulyHighlightReport();
  console.log(`Still highlighted: ${report.highlighted.length} receipts\n`);
  for (const entry of report.highlighted) {
    console.log(
      `${entry.exportNo} | ${entry.date} | ${entry.shipperName} | ${entry.thVehiclePlate}`
    );
    for (const line of entry.lines) {
      if (line.quantitySuggested === line.quantityActual) continue;
      console.log(
        `  ${line.tongCode}: suggested=${line.quantitySuggested} actual=${line.quantityActual}`
      );
    }
  }

  console.log(
    `\nWhitelisted suppressed: ${report.whitelistedButMismatch.length} receipts`
  );
  for (const entry of report.whitelistedButMismatch) {
    console.log(`  ${entry.exportNo} | ${entry.shipperName}`);
  }

  const outDir = path.join(process.cwd(), "scripts", "_output");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "july-suggested-bulk-apply-report.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        before,
        after,
        updatedExportNos: updated,
        whitelist: whitelistRows,
        highlighted: report.highlighted,
        whitelistedSuppressed: report.whitelistedButMismatch,
      },
      null,
      2
    )
  );
  console.log(`\nReport saved: ${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
