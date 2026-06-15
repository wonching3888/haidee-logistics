import { prisma } from "@/lib/prisma";
import { resolveSessionPickupLocation } from "@/lib/constants/pickup-locations";
import type { PaymentMode } from "@/lib/constants/freight-settings";
import { loadInboundFreightContext } from "@/lib/freight-context";
import {
  classifyInboundFreightGap,
  computeInboundLineFreight,
  isMissingRateGap,
  normalizeMcDeliveryMode,
  type InboundFreightGapReason,
} from "@/lib/inbound-freight";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function addIncomeAmount(
  totals: {
    mode1aThb: number;
    mode1bMyr: number;
    mode2Myr: number;
    wtlMode3Myr: number;
  },
  paymentMode: PaymentMode,
  amount: number,
  currency: string
) {
  if (amount <= 0) return;

  if (paymentMode === "1a" && currency === "THB") {
    totals.mode1aThb += amount;
    return;
  }
  if (paymentMode === "1b" && currency === "MYR") {
    totals.mode1bMyr += amount;
    return;
  }
  if (paymentMode === "2" && currency === "MYR") {
    totals.mode2Myr += amount;
    return;
  }
  if (paymentMode === "3" && currency === "MYR") {
    totals.wtlMode3Myr += amount;
  }
}

export interface OperationsIncomeWarningSample {
  shipperCode: string;
  shipperName: string;
  marketCode: string;
  quantity: number;
  reason: InboundFreightGapReason;
}

export interface OperationsIncomeResult {
  mode1aThb: number;
  mode1bMyr: number;
  mode2Myr: number;
  wtlMode3Myr: number;
  lineCount: number;
  missingRateLineCount: number;
  missingRateQuantity: number;
  gapReasons: Partial<Record<InboundFreightGapReason, number>>;
  warningSamples: OperationsIncomeWarningSample[];
}

const WARNING_SAMPLE_LIMIT = 8;

export async function aggregateOperationsIncome(
  year: number,
  month: number
): Promise<OperationsIncomeResult> {
  const { start, end } = getMonthDateRange(year, month);

  const lines = await prisma.inboundLine.findMany({
    where: {
      dispatchStatus: "assigned",
      dispatchLines: {
        some: {
          dispatchOrder: {
            date: { gte: start, lte: end },
            status: { notIn: ["draft", "cancelled"] },
          },
        },
      },
    },
    select: {
      stallId: true,
      tongTypeId: true,
      quantity: true,
      mcDeliveryMode: true,
      session: {
        select: {
          shipperId: true,
          pickupLocation: true,
          shipper: { select: { code: true, name: true, pickupLocation: true } },
        },
      },
    },
  });

  const linesByShipper = new Map<string, typeof lines>();
  for (const line of lines) {
    const shipperId = line.session.shipperId;
    const group = linesByShipper.get(shipperId) ?? [];
    group.push(line);
    linesByShipper.set(shipperId, group);
  }

  const totals = {
    mode1aThb: 0,
    mode1bMyr: 0,
    mode2Myr: 0,
    wtlMode3Myr: 0,
  };
  const gapReasons: Partial<Record<InboundFreightGapReason, number>> = {};
  const warningSamples: OperationsIncomeWarningSample[] = [];
  let missingRateLineCount = 0;
  let missingRateQuantity = 0;

  for (const [shipperId, shipperLines] of Array.from(linesByShipper.entries())) {
    const stallIds = Array.from(new Set(shipperLines.map((line) => line.stallId)));
    const tongTypeIds = Array.from(
      new Set(shipperLines.map((line) => line.tongTypeId))
    );
    const pickupLocation = resolveSessionPickupLocation(
      shipperLines[0]?.session.pickupLocation,
      shipperLines[0]?.session.shipper.pickupLocation
    );

    const { ctx } = await loadInboundFreightContext(
      shipperId,
      stallIds,
      tongTypeIds,
      end,
      pickupLocation
    );

    for (const line of shipperLines) {
      const marketCode = ctx.stalls.get(line.stallId)?.marketCode ?? "";
      const snapshot = computeInboundLineFreight(
        {
          stallId: line.stallId,
          tongTypeId: line.tongTypeId,
          quantity: line.quantity,
          mcDeliveryMode: normalizeMcDeliveryMode(
            marketCode,
            line.mcDeliveryMode
          ),
        },
        ctx
      );

      const gapReason = classifyInboundFreightGap(
        {
          stallId: line.stallId,
          tongTypeId: line.tongTypeId,
          quantity: line.quantity,
          mcDeliveryMode: normalizeMcDeliveryMode(
            marketCode,
            line.mcDeliveryMode
          ),
        },
        ctx,
        snapshot
      );

      if (gapReason) {
        gapReasons[gapReason] = (gapReasons[gapReason] ?? 0) + 1;
        if (isMissingRateGap(gapReason)) {
          missingRateLineCount += 1;
          missingRateQuantity += line.quantity;
          if (warningSamples.length < WARNING_SAMPLE_LIMIT) {
            warningSamples.push({
              shipperCode: line.session.shipper.code,
              shipperName: line.session.shipper.name,
              marketCode,
              quantity: line.quantity,
              reason: gapReason,
            });
          }
        }
      }

      if (snapshot.freightAmount == null || snapshot.freightAmount <= 0) {
        continue;
      }

      addIncomeAmount(
        totals,
        snapshot.paymentMode,
        snapshot.freightAmount,
        snapshot.currency
      );
    }
  }

  return {
    mode1aThb: roundMoney(totals.mode1aThb),
    mode1bMyr: roundMoney(totals.mode1bMyr),
    mode2Myr: roundMoney(totals.mode2Myr),
    wtlMode3Myr: roundMoney(totals.wtlMode3Myr),
    lineCount: lines.length,
    missingRateLineCount,
    missingRateQuantity,
    gapReasons,
    warningSamples,
  };
}
