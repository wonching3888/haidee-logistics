/**
 * Import THB July 2026 historical cash-book rows from scripts/data/thb_july_import.csv.
 *
 * Default: --dry-run (no writes).
 * Apply:   --apply [--rv-account=CODE]   (requires explicit OK from human after dry-run)
 *
 * Does NOT read thb_july_excluded_reference.csv.
 *
 * Usage:
 *   BACKFILL_SKIP_REVALIDATE=1 npx tsx scripts/_import-thb-july-2026-cash-book.ts --dry-run
 *   BACKFILL_SKIP_REVALIDATE=1 npx tsx scripts/_import-thb-july-2026-cash-book.ts --apply --rv-account=XXXX-0000
 */

import { createReadStream } from "fs";
import { createInterface } from "readline";
import { resolve } from "path";
import { randomUUID } from "crypto";
import { config } from "dotenv";
import { findCashBookAccount } from "@/lib/constants/cash-book-accounts";
import { nextPaymentVoucherNo } from "@/lib/cash-book/payment-voucher-no";
import { nextReceiptVoucherNo } from "@/lib/cash-book/receipt-voucher-no";
import { parseDateInput, toDateInputValue } from "@/lib/date-utils";
import { prisma } from "@/lib/prisma";

config({ path: ".env.local" });

const CSV_PATH = resolve(
  process.cwd(),
  "scripts/data/thb_july_import.csv"
);
const BOOK = "THB" as const;
const TARGET_JULY13_BALANCE = 63188;
const EXPECTED_OPENING = 219073;

type DocType = "PV" | "RV";

type CsvRow = {
  lineNo: number;
  date: string;
  docType: DocType;
  accountCode: string;
  description: string;
  amount: number;
  note: string;
};

function parseArgs(argv: string[]) {
  const apply = argv.includes("--apply");
  let rvAccount = "";
  for (const a of argv) {
    if (a.startsWith("--rv-account=")) rvAccount = a.slice("--rv-account=".length).trim();
  }
  return { dryRun: !apply, apply, rvAccount };
}

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

async function readCsv(path: string): Promise<CsvRow[]> {
  const rl = createInterface({
    input: createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  const rows: CsvRow[] = [];
  let lineNo = 0;
  let header: string[] | null = null;
  for await (const raw of rl) {
    lineNo++;
    const line = raw.replace(/^\uFEFF/, "").trimEnd();
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    if (!header) {
      header = cols.map((c) => c.trim().toLowerCase());
      continue;
    }
    const get = (name: string) => {
      const idx = header!.indexOf(name);
      return idx >= 0 ? (cols[idx] ?? "").trim() : "";
    };
    const docType = get("doc_type").toUpperCase();
    if (docType !== "PV" && docType !== "RV") {
      throw new Error(`Line ${lineNo}: invalid doc_type ${docType}`);
    }
    const amount = Number(get("amount"));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(`Line ${lineNo}: invalid amount ${get("amount")}`);
    }
    rows.push({
      lineNo,
      date: get("date"),
      docType,
      accountCode: get("account_code"),
      description: get("description"),
      amount: roundMoney(amount),
      note: get("note"),
    });
  }
  return rows;
}

function resolveAccountCode(row: CsvRow, rvAccount: string): string {
  if (row.docType === "RV") {
    return (row.accountCode || rvAccount).trim();
  }
  return row.accountCode.trim();
}

async function main() {
  const argv = process.argv.slice(2);
  const { dryRun, apply, rvAccount } = parseArgs(argv);
  if (apply && dryRun) {
    throw new Error("internal arg parse error");
  }

  console.log("=== THB July 2026 cash-book import ===");
  console.log("csv:", CSV_PATH);
  console.log("mode:", apply ? "APPLY (writes)" : "DRY-RUN (no writes)");
  if (rvAccount) console.log("rv-account override:", rvAccount);

  const rows = await readCsv(CSV_PATH);
  console.log(`rows loaded: ${rows.length}`);

  const issues: string[] = [];
  for (const row of rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
      issues.push(`L${row.lineNo}: bad date ${row.date}`);
    }
    const code = resolveAccountCode(row, rvAccount);
    if (!code) {
      issues.push(
        `L${row.lineNo}: ${row.docType} missing account_code` +
          (row.docType === "RV"
            ? " (CSV blank — pass --rv-account=CODE)"
            : "")
      );
      continue;
    }
    const account = findCashBookAccount(BOOK, code);
    if (!account) {
      issues.push(
        `L${row.lineNo}: account ${code} not on THB chart (${row.docType})`
      );
    }
  }

  // Group by account
  const byAccount = new Map<
    string,
    { n: number; amount: number; types: Set<string> }
  >();
  for (const row of rows) {
    const code = resolveAccountCode(row, rvAccount) || "(empty)";
    const cur = byAccount.get(code) ?? {
      n: 0,
      amount: 0,
      types: new Set<string>(),
    };
    cur.n += 1;
    cur.amount = roundMoney(cur.amount + row.amount);
    cur.types.add(row.docType);
    byAccount.set(code, cur);
  }

  const pvSum = roundMoney(
    rows.filter((r) => r.docType === "PV").reduce((s, r) => s + r.amount, 0)
  );
  const rvSum = roundMoney(
    rows.filter((r) => r.docType === "RV").reduce((s, r) => s + r.amount, 0)
  );
  const afterImportOnly = roundMoney(EXPECTED_OPENING - pvSum + rvSum);

  console.log("\n--- Planned creates (one voucher per CSV row) ---");
  for (const row of rows) {
    const code = resolveAccountCode(row, rvAccount) || "(empty)";
    const account = findCashBookAccount(BOOK, code);
    console.log(
      [
        `L${row.lineNo}`,
        row.date,
        row.docType,
        code,
        account?.name ?? "UNKNOWN",
        row.amount.toFixed(2),
        JSON.stringify(row.description),
        row.note ? `note=${JSON.stringify(row.note)}` : "",
      ]
        .filter(Boolean)
        .join(" | ")
    );
  }

  console.log("\n--- By account ---");
  console.log("account\tcount\tamount\tdoc_types");
  for (const code of [...byAccount.keys()].sort()) {
    const g = byAccount.get(code)!;
    console.log(
      `${code}\t${g.n}\t${g.amount.toFixed(2)}\t${[...g.types].sort().join(",")}`
    );
  }

  console.log("\n--- Totals ---");
  console.log(`PV count=${rows.filter((r) => r.docType === "PV").length} sum=${pvSum.toFixed(2)}`);
  console.log(`RV count=${rows.filter((r) => r.docType === "RV").length} sum=${rvSum.toFixed(2)}`);
  console.log(`Assumed opening ${EXPECTED_OPENING.toFixed(2)}`);
  console.log(
    `Projected closing after THIS import only: ${afterImportOnly.toFixed(2)}`
  );
  console.log(
    `Target July-13 book balance (user): ${TARGET_JULY13_BALANCE.toFixed(2)}`
  );
  console.log(
    `Gap vs target: ${roundMoney(afterImportOnly - TARGET_JULY13_BALANCE).toFixed(2)}` +
      ` (= sum of thb_july_excluded_reference.csv if settled later via 6500/6502 todos)`
  );

  if (issues.length) {
    console.log("\n--- BLOCKING ISSUES ---");
    for (const i of issues) console.log("!", i);
  } else {
    console.log("\n--- Validation: OK (all account codes resolve on THB chart) ---");
  }

  if (!apply) {
    console.log(
      "\nDRY-RUN complete. No database writes. Wait for human OK before --apply."
    );
    await prisma.$disconnect();
    if (issues.length) process.exit(2);
    return;
  }

  if (issues.length) {
    throw new Error(`Refuse --apply while ${issues.length} blocking issue(s) remain`);
  }

  const actor =
    (await prisma.user.findFirst({
      where: { email: "admin@haideelogistics.com" },
      select: { id: true, email: true },
    })) ??
    (await prisma.user.findFirst({
      where: { role: "admin" },
      select: { id: true, email: true },
    }));
  if (!actor) throw new Error("No admin user for createdBy/confirmedBy");

  console.log("\nAPPLY actor:", actor.email, actor.id);

  // Sequential creates so voucher numbers stay ordered; confirmedAt = date + row index ms
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const date = parseDateInput(row.date);
    const code = resolveAccountCode(row, rvAccount);
    const account = findCashBookAccount(BOOK, code)!;
    const confirmedAt = new Date(date.getTime() + i * 1000); // 1s steps for sortKey

    if (row.docType === "PV") {
      const voucherNo = await nextPaymentVoucherNo(date);
      const id = randomUUID();
      await prisma.cashBookPaymentVoucher.create({
        data: {
          id,
          voucherNo,
          book: BOOK,
          voucherDate: date,
          paidTo: row.description.slice(0, 200) || "HISTORY",
          paymentMethod: "CASH",
          status: "confirmed",
          confirmedAt,
          confirmedBy: actor.id,
          totalAmount: row.amount,
          createdBy: actor.id,
          preparedBy: "JULY2026_IMPORT",
          approvedBy: "JULY2026_IMPORT",
          lines: {
            create: [
              {
                id: randomUUID(),
                lineOrder: 0,
                accountCode: account.code,
                accountName: account.name,
                particulars: row.description,
                amount: row.amount,
              },
            ],
          },
        },
      });
      console.log(`CREATED ${voucherNo} PV ${row.amount} ${account.code}`);
    } else {
      const voucherNo = await nextReceiptVoucherNo(date);
      const id = randomUUID();
      await prisma.cashBookReceiptVoucher.create({
        data: {
          id,
          voucherNo,
          book: BOOK,
          voucherDate: date,
          receivedFrom: row.description.slice(0, 200) || "HISTORY",
          accountCode: account.code,
          accountName: account.name,
          amount: row.amount,
          notes: row.note || row.description,
          status: "confirmed",
          confirmedAt,
          confirmedBy: actor.id,
          createdBy: actor.id,
          preparedBy: "JULY2026_IMPORT",
          approvedBy: "JULY2026_IMPORT",
        },
      });
      console.log(`CREATED ${voucherNo} RV ${row.amount} ${account.code}`);
    }
  }

  console.log("\nAPPLY complete.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
