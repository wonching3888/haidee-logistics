/**
 * Seed mode 1a HUP DEE invoice company for 8 shippers.
 * node --env-file=.env.local ./node_modules/tsx/dist/cli.mjs scripts/seed-shipper-invoice-company-hupdee.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { prisma } from "../lib/prisma";

const HUPDEE_BBL_CODES = [
  "3001-M001", // MEENA
  "3001-A004", // AR MEI - PATTANI
  "3001-A006", // AR MEI - RANONG
  "3001-H007", // HUAT SYARIKAT
] as const;

const HUPDEE_KBANK_CODES = [
  "3001-T002", // TAT KHENG
  "3001-T003", // THAI TONG
  "3001-C002", // CHUN MENG
  "3001-H004", // HENG DEE
] as const;

async function main() {
  const results: Array<{ code: string; invoiceCompany: string; ok: boolean }> = [];

  for (const code of HUPDEE_BBL_CODES) {
    const updated = await prisma.shipper.updateMany({
      where: { code },
      data: { invoiceCompany: "hupdee_bbl" },
    });
    results.push({
      code,
      invoiceCompany: "hupdee_bbl",
      ok: updated.count === 1,
    });
  }

  for (const code of HUPDEE_KBANK_CODES) {
    const updated = await prisma.shipper.updateMany({
      where: { code },
      data: { invoiceCompany: "hupdee_kbank" },
    });
    results.push({
      code,
      invoiceCompany: "hupdee_kbank",
      ok: updated.count === 1,
    });
  }

  console.log(JSON.stringify({ results }, null, 2));

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error("Some shippers were not found or not updated:", failed);
    process.exit(1);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await prisma.$disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
