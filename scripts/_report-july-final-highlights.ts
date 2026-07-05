import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { toDateInputValue } from "../lib/inbound-utils";
import {
  crateExportHasSuggestedActualMismatch,
  resolveCrateExportListMismatch,
} from "../lib/crate-export-list";
import { loadCrateExportMismatchWhitelistShipperIds } from "../lib/crate-export-mismatch-whitelist-service";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const whitelist = await loadCrateExportMismatchWhitelistShipperIds();
  const rows = await prisma.tongExport.findMany({
    where: {
      date: {
        gte: new Date("2026-07-01T00:00:00.000Z"),
        lte: new Date(`${toDateInputValue(new Date())}T23:59:59.999Z`),
      },
    },
    include: {
      shipper: { select: { id: true, name: true } },
      tongType: { select: { code: true } },
    },
    orderBy: [{ exportNo: "asc" }],
  });

  const byExport = new Map<
    string,
    {
      exportNo: string;
      date: string;
      shipperName: string;
      shipperId: string;
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
      shipperName: row.shipper.name,
      shipperId: row.shipperId,
      thVehiclePlate: row.thVehiclePlate,
      lines: [line],
    });
  }

  const highlighted = [...byExport.values()].filter((entry) =>
    resolveCrateExportListMismatch(entry.lines, entry.shipperId, whitelist)
  );

  console.log(`Final highlighted (July): ${highlighted.length}\n`);
  for (const e of highlighted) {
    console.log(`${e.exportNo} | ${e.shipperName} | ${e.thVehiclePlate}`);
    for (const l of e.lines) {
      if (l.quantitySuggested !== l.quantityActual) {
        console.log(
          `  ${l.tongCode}: suggested=${l.quantitySuggested} actual=${l.quantityActual}`
        );
      }
    }
  }

  const out = path.join(
    process.cwd(),
    "scripts",
    "_output",
    "july-final-highlight-list.json"
  );
  fs.writeFileSync(out, JSON.stringify(highlighted, null, 2));
  console.log(`\nSaved: ${out}`);
}

main().finally(() => prisma.$disconnect());
