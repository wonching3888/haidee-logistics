/**
 * Verify/fix JIT RANONG IN-20260615-003 (4 lines, Phase 1.5b wrong snapshot).
 * HISTORICAL ARCHIVE — completed 2026-06-18. Re-run requires restoring
 * temporary hooks (__BACKFILL_USER__, BACKFILL_SKIP_REVALIDATE, freightRateAsOfDate).
 *
 * Note: payment snapshots were already corrected by backfill-373-rate-gap on 2026-06-17;
 * this script archives backup + idempotent verify/resave.
 *
 * Usage: node --env-file=.env.local ./node_modules/tsx/dist/cli.mjs scripts/backfill-jit-ranong-06015-snapshots.ts [--step=audit|backup|resave|verify|all]
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../lib/prisma";
import type { AppUser } from "../types";
import { decimalToNumber } from "../lib/freight-rates";
import { getMonthlyInvoiceModeConfig } from "../lib/constants/monthly-invoice";
import { buildMonthlyInvoiceData } from "../lib/monthly-invoice";
import { buildPnlPeriodSummary } from "../lib/pnl-report";
import { getMonthDateRange } from "../lib/reports/period-report-shared";

const SHIPPER_CODE = "3001-0004";
const SESSION_NO = "IN-20260615-003";
const RATE_AS_OF_DATE = "2026-06-15";
const YEAR = 2026;
const MONTH = 6;

const BACKUP_PATH = join(
  process.cwd(),
  "scripts",
  "backup-jit-ranong-4-rows-2026-06-18.json"
);

const PRIOR_373_BACKUP = join(
  process.cwd(),
  "scripts",
  "backup-373-rows-rate-gap-2026-06-17.json"
);

const LINE_IDS = [
  "75797f12-ecfe-4fc8-84c4-34f2c347bd90",
  "d39f44cc-f809-47bc-9324-7a24a514952c",
  "2053711e-c195-4df5-8382-160f0302ec4c",
  "1ef18dda-b1de-4d2b-bc6c-5e5633bd3105",
] as const;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function stepArg() {
  const arg = process.argv.find((a) => a.startsWith("--step="));
  return arg?.split("=")[1] ?? "all";
}

function serializeLine(
  line: Awaited<ReturnType<typeof fetchTargetLines>>[number]
) {
  return {
    id: line.id,
    sessionId: line.sessionId,
    sessionNo: line.session.sessionNo,
    sessionDate: line.session.date.toISOString().slice(0, 10),
    shipperCode: line.session.shipper.code,
    marketCode: line.stall.market?.code ?? "",
    stallCode: line.stall.code,
    quantity: line.quantity,
    dispatchStatus: line.dispatchStatus,
    paymentParty: line.paymentParty,
    paymentMode: line.paymentMode,
    currency: line.currency,
    billingCompany: line.billingCompany,
    freightRate: decimalToNumber(line.freightRate),
    freightAmount: decimalToNumber(line.freightAmount),
    createdAt: line.createdAt.toISOString(),
  };
}

async function fetchTargetLines() {
  return prisma.inboundLine.findMany({
    where: { id: { in: [...LINE_IDS] } },
    include: {
      session: {
        select: {
          id: true,
          sessionNo: true,
          date: true,
          status: true,
          shipperId: true,
          thVehiclePlate: true,
          areaNote: true,
          pickupLocation: true,
          shipper: {
            select: {
              code: true,
              name: true,
              paymentParty: true,
              currency: true,
              company: true,
            },
          },
        },
      },
      stall: { include: { market: { select: { code: true } } } },
      tongType: { select: { code: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

function isCorrectSnapshot(line: {
  paymentMode: string | null;
  paymentParty: string | null;
  currency: string | null;
  billingCompany: string | null;
  freightAmount: unknown;
}) {
  return (
    line.paymentMode === "2" &&
    line.paymentParty === "consignee" &&
    line.currency === "MYR" &&
    line.billingCompany === "haidee" &&
    (decimalToNumber(line.freightAmount) ?? 0) > 0
  );
}

async function fetchSessionMode2Invoice(sessionNo: string) {
  const mode = getMonthlyInvoiceModeConfig("2");
  if (!mode) throw new Error("mode 2 config missing");
  const { start, end } = getMonthDateRange(YEAR, MONTH);
  const rawLines = await prisma.inboundLine.findMany({
    where: {
      paymentMode: mode.paymentMode,
      billingCompany: mode.billingCompany,
      currency: mode.currency,
      freightAmount: { gt: 0 },
      session: { status: "confirmed", date: { gte: start, lte: end }, sessionNo },
    },
    include: {
      session: {
        select: {
          date: true,
          sessionNo: true,
          shipper: { select: { id: true, code: true, name: true } },
        },
      },
      stall: { include: { market: { select: { code: true } } } },
      tongType: { select: { code: true, isBox: true } },
      consignee: { select: { id: true, code: true, name: true } },
    },
  });

  const mapped = rawLines.map((line) => ({
    sessionDate: line.session.date,
    sessionNo: line.session.sessionNo,
    stallMarketCode: line.stall.market?.code ?? "",
    stallCode: line.stall.code,
    stallName: line.stall.name,
    tongTypeCode: line.tongType.code,
    quantity: line.quantity,
    freightRate: decimalToNumber(line.freightRate),
    freightAmount: decimalToNumber(line.freightAmount),
    isBox: line.isBox,
    shipperId: line.session.shipper.id,
    shipperCode: line.session.shipper.code,
    shipperName: line.session.shipper.name,
    consigneeId: line.consigneeId ?? line.consignee?.id ?? null,
    consigneeCode: line.consignee?.code ?? null,
    consigneeName: line.consignee?.name ?? null,
  }));

  const consigneeIds = [
    ...new Set(mapped.map((l) => l.consigneeId).filter(Boolean)),
  ] as string[];

  const invoices = [];
  for (const customerId of consigneeIds) {
    const data = buildMonthlyInvoiceData({
      mode,
      year: YEAR,
      month: MONTH,
      periodLabel: `${YEAR}年${MONTH}月`,
      customerId,
      rawLines: mapped,
    });
    if (data) {
      const lineCount = data.sections.reduce(
        (sum, s) => sum + s.lines.length,
        0
      );
      invoices.push({
        consigneeCode: data.customerCode,
        consigneeName: data.customerName,
        lineCount,
        grandTotalMyr: data.grandTotalAmount,
      });
    }
  }

  return { rawLineCount: mapped.length, invoices };
}

async function setupAuthMock() {
  const admin =
    (await prisma.user.findFirst({
      where: { role: "admin" },
      orderBy: { createdAt: "asc" },
    })) ??
    (await prisma.user.findFirst({ orderBy: { createdAt: "asc" } }));
  if (!admin) throw new Error("No user found for auth mock");

  (globalThis as { __BACKFILL_USER__?: AppUser }).__BACKFILL_USER__ = {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: "admin",
  };
}

async function stepAudit() {
  const shipper = await prisma.shipper.findUnique({
    where: { code: SHIPPER_CODE },
    select: {
      code: true,
      name: true,
      paymentParty: true,
      currency: true,
      company: true,
      createdAt: true,
    },
  });

  const lines = await fetchTargetLines();
  const wrong = lines.filter((l) => !isCorrectSnapshot(l));

  let prior373: unknown = null;
  if (existsSync(PRIOR_373_BACKUP)) {
    const backup = JSON.parse(readFileSync(PRIOR_373_BACKUP, "utf8")) as {
      lines: Array<{
        id: string;
        paymentMode: string;
        currency: string;
        freightAmount: number | null;
      }>;
    };
    prior373 = backup.lines
      .filter((l) => LINE_IDS.includes(l.id as (typeof LINE_IDS)[number]))
      .map((l) => ({
        id: l.id,
        paymentMode: l.paymentMode,
        currency: l.currency,
        freightAmount: l.freightAmount,
      }));
  }

  console.log(
    JSON.stringify(
      {
        shipper,
        lineCount: lines.length,
        alreadyCorrect: wrong.length === 0,
        wrongLineCount: wrong.length,
        wrongSamples: wrong.map(serializeLine),
        prior373BeforeFix: prior373,
        rootCause:
          "Phase 1.5b window (6/15 ~10:04 UTC): MYR consignee-payer shipper saved as 1a/THB before payment relations applied; fixed by 373-rate-gap resave 2026-06-17",
      },
      null,
      2
    )
  );
}

async function stepBackup() {
  const lines = await fetchTargetLines();
  const pnlBefore = await buildPnlPeriodSummary({ year: YEAR, month: MONTH });

  const payload = {
    exportedAt: new Date().toISOString(),
    criteria: `JIT RANONG ${SESSION_NO} — 4 lines (audit dim 3.6)`,
    lineCount: lines.length,
    lines: lines.map(serializeLine),
    pnlJune2026: {
      revenueMyr: pnlBefore.periodSummary.revenueMyr,
      costMyr: pnlBefore.periodSummary.costMyr,
      grossProfitMyr: pnlBefore.periodSummary.grossProfitMyr,
    },
  };

  writeFileSync(BACKUP_PATH, JSON.stringify(payload, null, 2));
  console.log(`Backup written: ${BACKUP_PATH}`);
}

async function stepResave() {
  const lines = await fetchTargetLines();
  const needsFix = lines.some((l) => !isCorrectSnapshot(l));
  if (!needsFix) {
    console.log("All 4 lines already correct — skipping resave");
    return;
  }

  const session = await prisma.inboundSession.findFirst({
    where: { sessionNo: SESSION_NO },
    include: {
      lines: {
        include: {
          stall: { include: { market: { select: { code: true } } } },
          tongType: { select: { code: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!session) throw new Error(`Session not found: ${SESSION_NO}`);

  await setupAuthMock();
  process.env.BACKFILL_SKIP_REVALIDATE = "1";
  const { saveInboundSession } = await import("../app/actions/inbound");

  const inputLines = session.lines
    .filter((l) => l.quantity > 0)
    .map((l) => ({
      stallId: l.stallId,
      tongTypeId: l.tongTypeId,
      quantity: l.quantity,
      lineId: l.id,
      mcDeliveryMode:
        (l.mcDeliveryMode as "self" | "third_party" | null) ?? undefined,
    }));

  const result = await saveInboundSession({
    date: session.date.toISOString().slice(0, 10),
    shipperId: session.shipperId,
    thVehiclePlate: session.thVehiclePlate ?? undefined,
    areaNote: session.areaNote ?? undefined,
    pickupLocation: session.pickupLocation,
    lines: inputLines,
    asDraft: false,
    sessionId: session.id,
    freightRateAsOfDate: RATE_AS_OF_DATE,
  });

  console.log(result.ok ? "Resave OK" : `Resave FAIL: ${result.error}`);
}

async function stepVerify() {
  const lines = await fetchTargetLines();
  const allCorrect = lines.every((l) => isCorrectSnapshot(l));
  const mode2Invoice = await fetchSessionMode2Invoice(SESSION_NO);

  const freightTotal = round2(
    lines.reduce((s, l) => s + (decimalToNumber(l.freightAmount) ?? 0), 0)
  );

  let pnlBefore = null;
  if (existsSync(BACKUP_PATH)) {
    pnlBefore = (
      JSON.parse(readFileSync(BACKUP_PATH, "utf8")) as {
        pnlJune2026: {
          revenueMyr: number;
          costMyr: number;
          grossProfitMyr: number;
        };
      }
    ).pnlJune2026;
  }
  const pnlAfter = await buildPnlPeriodSummary({ year: YEAR, month: MONTH });

  console.log(
    JSON.stringify(
      {
        allCorrect,
        lines: lines.map(serializeLine),
        freightTotalMyr: freightTotal,
        mode2Invoice,
        pnlJune2026: {
          before: pnlBefore,
          after: {
            revenueMyr: pnlAfter.periodSummary.revenueMyr,
            costMyr: pnlAfter.periodSummary.costMyr,
            grossProfitMyr: pnlAfter.periodSummary.grossProfitMyr,
          },
        },
      },
      null,
      2
    )
  );

  if (!allCorrect) throw new Error("JIT lines still have wrong snapshots");
  if (mode2Invoice.rawLineCount !== 4) {
    throw new Error(`Expected 4 Mode 2 invoice lines, got ${mode2Invoice.rawLineCount}`);
  }
}

async function main() {
  const step = stepArg();
  if (step === "audit" || step === "all") await stepAudit();
  if (step === "backup" || step === "all") await stepBackup();
  if (step === "resave" || step === "all") await stepResave();
  if (step === "verify" || step === "all") await stepVerify();

  delete (globalThis as { __BACKFILL_USER__?: AppUser }).__BACKFILL_USER__;
  delete process.env.BACKFILL_SKIP_REVALIDATE;
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
