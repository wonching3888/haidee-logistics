/**
 * Backfill Mode 3 billing gap snapshots (2026-06):
 * A) POR PATTANI (3001-P004) dual-payment WTL fields
 * B) JIAB IN-20260615-026 freightAmount=540
 *
 * Run: npx tsx --env-file=.env.local scripts/backfill-mode3-gap-snapshots.ts --step=all
 * Steps: backup-a | resave-a | verify-a | backup-b | resave-b | verify-b | verify-final | all
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../lib/prisma";
import type { AppUser } from "../types";
import { decimalToNumber } from "../lib/freight-rates";
import { getMonthDateRange } from "../lib/reports/period-report-shared";
import {
  buildMonthlyInvoiceCustomerSummaries,
  type RawInvoiceLine,
} from "../lib/monthly-invoice";
import { getMonthlyInvoiceModeConfig } from "../lib/constants/monthly-invoice";
import { aggregateOperationsIncome } from "../lib/operations-income";

const YEAR = 2026;
const MONTH = 6;
const POR_SHIPPER_CODE = "3001-P004";
const JIAB_SESSION_NO = "IN-20260615-026";
const RATE_AS_OF_DATE = "2026-06-15";

const BACKUP_A_PATH = join(
  process.cwd(),
  "scripts",
  "backup-por-pattani-dual-payment-2026-06.json"
);
const BACKUP_B_PATH = join(
  process.cwd(),
  "scripts",
  "backup-jiab-0615-026-2026-06.json"
);

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function stepArg() {
  const arg = process.argv.find((a) => a.startsWith("--step="));
  return arg?.split("=")[1] ?? "all";
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

function serializeLine(
  line: Awaited<ReturnType<typeof fetchPorDualLines>>[number]
) {
  return {
    id: line.id,
    sessionId: line.sessionId,
    sessionNo: line.session.sessionNo,
    sessionDate: line.session.date.toISOString().slice(0, 10),
    shipperCode: line.session.shipper.code,
    stallCode: line.stall.code,
    marketCode: line.stall.market?.code ?? "",
    tongTypeCode: line.tongType.code,
    quantity: line.quantity,
    paymentMode: line.paymentMode,
    currency: line.currency,
    billingCompany: line.billingCompany,
    freightAmount: decimalToNumber(line.freightAmount),
    dualPaymentWtlRate: decimalToNumber(line.dualPaymentWtlRate),
    dualPaymentWtlAmount: decimalToNumber(line.dualPaymentWtlAmount),
    dualPaymentWtlConsigneeId: line.dualPaymentWtlConsigneeId,
  };
}

async function fetchPorDualLines() {
  const { start, end } = getMonthDateRange(YEAR, MONTH);
  const shipper = await prisma.shipper.findUnique({
    where: { code: POR_SHIPPER_CODE },
    select: { id: true },
  });
  if (!shipper) throw new Error(`Shipper not found: ${POR_SHIPPER_CODE}`);

  return prisma.inboundLine.findMany({
    where: {
      session: {
        shipperId: shipper.id,
        status: "confirmed",
        date: { gte: start, lte: end },
      },
      dispatchStatus: "assigned",
    },
    include: {
      session: {
        select: {
          id: true,
          sessionNo: true,
          date: true,
          shipperId: true,
          pickupLocation: true,
          thVehiclePlate: true,
          areaNote: true,
          shipper: { select: { code: true, name: true } },
        },
      },
      stall: { include: { market: { select: { code: true } } } },
      tongType: { select: { code: true } },
    },
    orderBy: [{ session: { sessionNo: "asc" } }, { createdAt: "asc" }],
  });
}

async function fetchJiabMode3Line() {
  const line = await prisma.inboundLine.findFirst({
    where: {
      session: { sessionNo: JIAB_SESSION_NO },
      paymentMode: "3",
      billingCompany: "wtl",
    },
    include: {
      session: {
        select: {
          id: true,
          sessionNo: true,
          date: true,
          shipperId: true,
          pickupLocation: true,
          thVehiclePlate: true,
          areaNote: true,
          shipper: { select: { code: true, name: true } },
        },
      },
      stall: { include: { market: { select: { code: true } } } },
      tongType: { select: { code: true } },
    },
  });
  if (!line) throw new Error(`Mode 3 line not found in ${JIAB_SESSION_NO}`);
  return line;
}

async function resaveSessions(
  sessions: Array<{
    id: string;
    sessionNo: string | null;
    date: Date;
    shipperId: string;
    pickupLocation: string | null;
    thVehiclePlate: string | null;
    areaNote: string | null;
    lines: Array<{
      id: string;
      stallId: string;
      tongTypeId: string;
      quantity: number;
      mcDeliveryMode: string | null;
    }>;
  }>,
  options?: { freightRateAsOfDate?: string }
) {
  await setupAuthMock();
  process.env.BACKFILL_SKIP_REVALIDATE = "1";
  const { saveInboundSession } = await import("../app/actions/inbound");

  const results: Array<{ sessionNo: string; ok: boolean; error?: string }> = [];

  for (const session of sessions) {
    const lines = session.lines
      .filter((l) => l.quantity > 0)
      .map((l) => ({
        stallId: l.stallId,
        tongTypeId: l.tongTypeId,
        quantity: l.quantity,
        lineId: l.id,
        mcDeliveryMode:
          (l.mcDeliveryMode as "self" | "third_party" | null) ?? undefined,
      }));

    try {
      const result = await saveInboundSession({
        date: session.date.toISOString().slice(0, 10),
        shipperId: session.shipperId,
        thVehiclePlate: session.thVehiclePlate ?? undefined,
        areaNote: session.areaNote ?? undefined,
        pickupLocation: session.pickupLocation,
        lines,
        asDraft: false,
        sessionId: session.id,
        freightRateAsOfDate: options?.freightRateAsOfDate,
      });
      results.push({
        sessionNo: session.sessionNo ?? session.id,
        ok: result.ok,
        error: result.ok ? undefined : result.error,
      });
      console.log(
        result.ok
          ? `  OK ${session.sessionNo}`
          : `  FAIL ${session.sessionNo}: ${result.error}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        sessionNo: session.sessionNo ?? session.id,
        ok: false,
        error: message,
      });
      console.log(`  FAIL ${session.sessionNo}: ${message}`);
    }
  }

  return results;
}

async function stepBackupA() {
  const lines = await fetchPorDualLines();
  const dualCandidates = lines.filter(
    (l) => l.session.shipper.code === POR_SHIPPER_CODE
  );
  const sessionIds = [...new Set(dualCandidates.map((l) => l.sessionId))];

  console.log(
    `\n=== Backup A: POR PATTANI ${dualCandidates.length} lines, ${sessionIds.length} sessions ===`
  );

  const payload = {
    exportedAt: new Date().toISOString(),
    shipperCode: POR_SHIPPER_CODE,
    lineCount: dualCandidates.length,
    sessionIds,
    sessionNos: [
      ...new Set(
        dualCandidates.map((l) => l.session.sessionNo).filter(Boolean)
      ),
    ],
    lines: dualCandidates.map(serializeLine),
  };

  writeFileSync(BACKUP_A_PATH, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Backup written: ${BACKUP_A_PATH}`);
  return payload;
}

async function stepResaveA() {
  const backup = JSON.parse(readFileSync(BACKUP_A_PATH, "utf8")) as {
    sessionIds: string[];
  };

  const sessions = await prisma.inboundSession.findMany({
    where: { id: { in: backup.sessionIds } },
    include: {
      lines: {
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { sessionNo: "asc" },
  });

  console.log(`\n=== Resave A: ${sessions.length} POR PATTANI sessions ===`);
  return resaveSessions(sessions, { freightRateAsOfDate: RATE_AS_OF_DATE });
}

async function stepVerifyA() {
  const backup = JSON.parse(readFileSync(BACKUP_A_PATH, "utf8")) as {
    lines: Array<{ id: string }>;
  };
  const ids = backup.lines.map((l) => l.id);

  const after = await prisma.inboundLine.findMany({
    where: { id: { in: ids } },
    include: {
      session: { select: { sessionNo: true } },
      dualPaymentWtlConsignee: { select: { code: true } },
    },
  });

  const dualSum = round2(
    after.reduce((s, l) => s + (decimalToNumber(l.dualPaymentWtlAmount) ?? 0), 0)
  );
  const withDual = after.filter(
    (l) => (decimalToNumber(l.dualPaymentWtlAmount) ?? 0) > 0
  );

  console.log("\n=== Verify A ===");
  console.log(`Lines with dualPaymentWtlAmount>0: ${withDual.length}/${after.length}`);
  console.log(`dualPaymentWtlAmount sum: ${dualSum} (expected ~1215)`);
  for (const l of withDual) {
    console.log(
      `  ${l.session.sessionNo} qty=${l.quantity} dual=${decimalToNumber(l.dualPaymentWtlAmount)} consignee=${l.dualPaymentWtlConsignee?.code}`
    );
  }

  return { dualSum, withDualCount: withDual.length };
}

async function stepBackupB() {
  const line = await fetchJiabMode3Line();
  console.log(`\n=== Backup B: ${JIAB_SESSION_NO} (mode 3 line ${line.stall.code}) ===`);

  const payload = {
    exportedAt: new Date().toISOString(),
    sessionNo: JIAB_SESSION_NO,
    lines: [serializeLine(line as Awaited<ReturnType<typeof fetchPorDualLines>>[number])],
  };

  writeFileSync(BACKUP_B_PATH, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Backup written: ${BACKUP_B_PATH}`);
  return payload;
}

async function stepResaveB() {
  const line = await fetchJiabMode3Line();
  const session = await prisma.inboundSession.findUnique({
    where: { id: line.sessionId },
    include: { lines: { orderBy: { createdAt: "asc" } } },
  });
  if (!session) throw new Error("JIAB session not found");

  console.log(
    `\n=== Resave B: ${JIAB_SESSION_NO} (full session, target IS14 mode3 line) ===`
  );
  return resaveSessions([session]);
}

async function stepVerifyB() {
  const line = await fetchJiabMode3Line();
  const freight = decimalToNumber(line.freightAmount);

  console.log("\n=== Verify B ===");
  console.log(`stall=${line.stall.code} freightAmount: ${freight} (expected 540)`);
  console.log(
    `paymentMode=${line.paymentMode} billing=${line.billingCompany} currency=${line.currency}`
  );

  return { freight };
}

async function fetchMode3InvoiceTotal() {
  const { start, end } = getMonthDateRange(YEAR, MONTH);
  const config = getMonthlyInvoiceModeConfig("3")!;

  const [primaryLines, dualLines] = await Promise.all([
    prisma.inboundLine.findMany({
      where: {
        paymentMode: "3",
        billingCompany: "wtl",
        currency: "MYR",
        freightAmount: { gt: 0 },
        session: { status: "confirmed", date: { gte: start, lte: end } },
      },
      include: {
        session: {
          select: {
            date: true,
            shipper: { select: { id: true, code: true, name: true } },
          },
        },
        stall: { include: { market: { select: { code: true } } } },
        tongType: { select: { code: true, isBox: true } },
        consignee: { select: { id: true, code: true, name: true } },
        dualPaymentWtlConsignee: { select: { id: true, code: true, name: true } },
      },
    }),
    prisma.inboundLine.findMany({
      where: {
        dualPaymentWtlAmount: { gt: 0 },
        session: { status: "confirmed", date: { gte: start, lte: end } },
      },
      include: {
        session: {
          select: {
            date: true,
            shipper: { select: { id: true, code: true, name: true } },
          },
        },
        stall: { include: { market: { select: { code: true } } } },
        tongType: { select: { code: true, isBox: true } },
        consignee: { select: { id: true, code: true, name: true } },
        dualPaymentWtlConsignee: { select: { id: true, code: true, name: true } },
      },
    }),
  ]);

  const rawLines: RawInvoiceLine[] = [
    ...primaryLines.map((line) => ({
      sessionDate: line.session.date,
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
    })),
    ...dualLines.map((line) => ({
      sessionDate: line.session.date,
      stallMarketCode: line.stall.market?.code ?? "",
      stallCode: line.stall.code,
      stallName: line.stall.name,
      tongTypeCode: line.tongType.code,
      quantity: line.quantity,
      freightRate: decimalToNumber(line.dualPaymentWtlRate),
      freightAmount: decimalToNumber(line.dualPaymentWtlAmount),
      isBox: line.isBox,
      shipperId: line.session.shipper.id,
      shipperCode: line.session.shipper.code,
      shipperName: line.session.shipper.name,
      consigneeId:
        line.dualPaymentWtlConsigneeId ?? line.dualPaymentWtlConsignee?.id ?? null,
      consigneeCode: line.dualPaymentWtlConsignee?.code ?? null,
      consigneeName: line.dualPaymentWtlConsignee?.name ?? null,
    })),
  ];

  const customers = buildMonthlyInvoiceCustomerSummaries(rawLines, config);
  const total = round2(
    customers.reduce((s, c) => s + c.grandTotal, 0)
  );

  return { total, customers, primaryCount: primaryLines.length, dualCount: dualLines.length };
}

async function stepVerifyFinal() {
  const income = await aggregateOperationsIncome(YEAR, MONTH);
  const invoice = await fetchMode3InvoiceTotal();

  const mcMc65 = invoice.customers.find((c) => c.customerCode === "3000-P001");
  const nkl = invoice.customers.find((c) => c.customerCode === "3000-N001");
  const jiabPrimary = await prisma.inboundLine.aggregate({
    where: {
      paymentMode: "3",
      billingCompany: "wtl",
      currency: "MYR",
      freightAmount: { gt: 0 },
      session: {
        shipper: { code: "3001-0003" },
        status: "confirmed",
        date: {
          gte: getMonthDateRange(YEAR, MONTH).start,
          lte: getMonthDateRange(YEAR, MONTH).end,
        },
      },
    },
    _sum: { freightAmount: true },
  });

  console.log("\n=== Final verification ===");
  console.log(
    JSON.stringify(
      {
        opsWtlMode3Myr: income.wtlMode3Myr,
        mode3InvoiceTotalMyr: invoice.total,
        gapToOpsExcludingPermit: round2(
          income.wtlMode3Myr - invoice.total
        ),
        invoiceCustomers: invoice.customers.map((c) => ({
          code: c.customerCode,
          name: c.customerName,
          total: c.grandTotal,
          lines: c.lineCount,
        })),
        mcMc65Total: mcMc65?.grandTotal ?? 0,
        nklTotal: nkl?.grandTotal ?? 0,
        jiabMode3FreightSum: decimalToNumber(jiabPrimary._sum.freightAmount),
        primaryMode3Lines: invoice.primaryCount,
        dualPaymentLines: invoice.dualCount,
      },
      null,
      2
    )
  );
}

async function main() {
  const step = stepArg();

  try {
    if (step === "all" || step === "backup-a") await stepBackupA();
    if (step === "all" || step === "resave-a") await stepResaveA();
    if (step === "all" || step === "verify-a") await stepVerifyA();
    if (step === "all" || step === "backup-b") await stepBackupB();
    if (step === "all" || step === "resave-b") await stepResaveB();
    if (step === "all" || step === "verify-b") await stepVerifyB();
    if (step === "all" || step === "verify-final") await stepVerifyFinal();
  } finally {
    delete (globalThis as { __BACKFILL_USER__?: AppUser }).__BACKFILL_USER__;
    delete process.env.BACKFILL_SKIP_REVALIDATE;
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
