import {
  classifyInboundFreightGap,
  computeInboundLineFreight,
  isWrongZeroFreightSnapshot,
  normalizeMcDeliveryMode,
  type InboundFreightGapReason,
} from "@/lib/inbound-freight";
import { isLogisticsPartnerShipper } from "@/lib/constants/shipper-kind";
import { rateAsOfForSessionDate } from "@/lib/constants/rate-effective-date";
import { loadInboundFreightContext } from "@/lib/freight-context";
import { resolveSessionPickupLocation } from "@/lib/constants/pickup-locations";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import { formatDisplayDate, toDateInputValue } from "@/lib/date-utils";
import { decimalToNumber } from "@/lib/freight-rates";
import { prisma } from "@/lib/prisma";

export type BillingGapReasonCategory =
  | "no_shipper_rate"
  | "shipper_missing_box_rate"
  | "stall_missing_consignee"
  | "zero_amount_with_rate"
  | "other";

export const ZERO_AMOUNT_WITH_RATE_LABEL = "运费快照为 0 但重算有价";

export interface UnpricedInboundLine {
  lineId: string;
  sessionCode: string;
  businessDate: string;
  shipperCode: string;
  shipperName: string;
  consigneeCode: string | null;
  consigneeName: string | null;
  partyLabel: string;
  marketCode: string;
  mode: string;
  gapReason: BillingGapReasonCategory;
  gapReasonLabel: string;
}

const GAP_REASON_LABELS: Record<InboundFreightGapReason, string> = {
  no_market_on_stall: "档口未关联市场",
  stall_missing_consignee: "档口未绑定收货人",
  no_shipper_rate: "寄货人费率未设定",
  shipper_missing_tong_rate: "寄货人桶型费率缺失",
  shipper_missing_box_rate: "寄货人箱型费率缺失",
  no_consignee_rate: "收货人费率未设定",
  consignee_missing_tong_rate: "收货人桶型费率缺失",
  consignee_missing_box_rate: "收货人箱型费率缺失",
  mc_self_delivery: "MC 自送（客户运费为 0）",
  mc_third_party_customer_zero: "MC 第三方代送（客户运费为 0）",
};

export function invoiceModeFromTags(
  paymentMode: string | null,
  currency: string | null,
  billingCompany: string | null
): string {
  const pm = paymentMode ?? "";
  const cur = (currency ?? "").toUpperCase();
  const bc = (billingCompany ?? "").toLowerCase();
  if (pm === "1a" && bc === "haidee" && cur === "THB") return "1a";
  if (pm === "1b" && bc === "haidee" && cur === "MYR") return "1b";
  if (pm === "2" && bc === "haidee" && cur === "MYR") return "2";
  if (pm === "3" && bc === "wtl" && cur === "MYR") return "3";
  if (bc === "wtl" && cur === "MYR" && pm !== "3") return "4";
  return "other";
}

export function toBillingGapReasonCategory(
  reason: InboundFreightGapReason | null
): BillingGapReasonCategory {
  if (reason === "no_shipper_rate" || reason === "no_consignee_rate") {
    return "no_shipper_rate";
  }
  if (
    reason === "shipper_missing_box_rate" ||
    reason === "consignee_missing_box_rate"
  ) {
    return "shipper_missing_box_rate";
  }
  if (reason === "stall_missing_consignee") {
    return "stall_missing_consignee";
  }
  return "other";
}

export function billingGapReasonLabel(
  reason: InboundFreightGapReason | BillingGapReasonCategory | null
): string {
  if (reason === "zero_amount_with_rate") return ZERO_AMOUNT_WITH_RATE_LABEL;
  if (reason == null) return "未知原因";
  return GAP_REASON_LABELS[reason as InboundFreightGapReason] ?? "其他";
}

function formatPartyLabel(input: {
  mode: string;
  shipperCode: string;
  shipperName: string;
  consigneeCode: string | null;
  consigneeName: string | null;
}) {
  const shipper = `${input.shipperName} (${input.shipperCode})`;
  if (input.mode === "2" || input.mode === "3") {
    const consignee =
      input.consigneeName && input.consigneeCode
        ? `${input.consigneeName} (${input.consigneeCode})`
        : "—";
    return `${consignee} ← ${shipper}`;
  }
  return shipper;
}

export async function findUnpricedInboundLines(input: {
  year: number;
  month: number;
}): Promise<UnpricedInboundLine[]> {
  const { start, end } = getMonthDateRange(input.year, input.month);

  const lines = await prisma.inboundLine.findMany({
    where: {
      session: {
        status: "confirmed",
        date: { gte: start, lte: end },
      },
      OR: [
        {
          freightAmount: null,
          OR: [
            { paymentMode: { not: null } },
            { currency: { not: null } },
            { billingCompany: { not: null } },
          ],
        },
        { freightAmount: 0 },
      ],
    },
    include: {
      session: {
        select: {
          date: true,
          sessionNo: true,
          shipperId: true,
          pickupLocation: true,
          shipper: {
            select: {
              code: true,
              name: true,
              pickupLocation: true,
              shipperKind: true,
            },
          },
        },
      },
      stall: { include: { market: { select: { code: true } } } },
      tongType: { select: { isBox: true } },
      consignee: { select: { code: true, name: true } },
    },
    orderBy: [{ session: { date: "asc" } }, { createdAt: "asc" }],
  });

  const billableLines = lines.filter(
    (line) => !isLogisticsPartnerShipper(line.session.shipper)
  );

  const ctxCache = new Map<
    string,
    Awaited<ReturnType<typeof loadInboundFreightContext>>["ctx"]
  >();

  const results: UnpricedInboundLine[] = [];

  for (const line of billableLines) {
    const market = line.stall.market?.code ?? "";
    const asOfDate = rateAsOfForSessionDate(line.session.date);
    const storedAmount = decimalToNumber(line.freightAmount);
    const pickup = resolveSessionPickupLocation(
      line.session.pickupLocation,
      line.session.shipper.pickupLocation
    );
    const ctxKey = `${line.session.shipperId}|${toDateInputValue(asOfDate)}|${pickup}`;
    if (!ctxCache.has(ctxKey)) {
      const shipperLines = billableLines.filter(
        (l) =>
          l.session.shipperId === line.session.shipperId &&
          rateAsOfForSessionDate(l.session.date).getTime() === asOfDate.getTime() &&
          resolveSessionPickupLocation(
            l.session.pickupLocation,
            l.session.shipper.pickupLocation
          ) === pickup
      );
      const { ctx } = await loadInboundFreightContext(
        line.session.shipperId,
        shipperLines.map((l) => l.stallId),
        shipperLines.map((l) => l.tongTypeId),
        asOfDate,
        pickup
      );
      ctxCache.set(ctxKey, ctx);
    }
    const ctx = ctxCache.get(ctxKey)!;
    const mcMode = normalizeMcDeliveryMode(market, line.mcDeliveryMode);
    const snap = computeInboundLineFreight(
      {
        stallId: line.stallId,
        tongTypeId: line.tongTypeId,
        quantity: line.quantity,
        mcDeliveryMode: mcMode,
      },
      ctx
    );
    const recomputedAmount = snap.freightAmount ?? 0;

    if (storedAmount === 0) {
      if (!isWrongZeroFreightSnapshot(storedAmount, recomputedAmount)) {
        continue;
      }
      const mode = invoiceModeFromTags(
        line.paymentMode,
        line.currency,
        line.billingCompany
      );
      const shipperCode = line.session.shipper.code;
      const shipperName = line.session.shipper.name;
      const consigneeCode = line.consignee?.code ?? null;
      const consigneeName = line.consignee?.name ?? null;
      results.push({
        lineId: line.id,
        sessionCode: line.session.sessionNo ?? "",
        businessDate: formatDisplayDate(line.session.date),
        shipperCode,
        shipperName,
        consigneeCode,
        consigneeName,
        partyLabel: formatPartyLabel({
          mode,
          shipperCode,
          shipperName,
          consigneeCode,
          consigneeName,
        }),
        marketCode: market,
        mode,
        gapReason: "zero_amount_with_rate",
        gapReasonLabel: ZERO_AMOUNT_WITH_RATE_LABEL,
      });
      continue;
    }

    const rawGap = classifyInboundFreightGap(
      {
        stallId: line.stallId,
        tongTypeId: line.tongTypeId,
        quantity: line.quantity,
        mcDeliveryMode: mcMode,
      },
      ctx,
      snap
    );
    const gapCategory = toBillingGapReasonCategory(rawGap);
    const mode = invoiceModeFromTags(
      line.paymentMode,
      line.currency,
      line.billingCompany
    );
    const shipperCode = line.session.shipper.code;
    const shipperName = line.session.shipper.name;
    const consigneeCode = line.consignee?.code ?? null;
    const consigneeName = line.consignee?.name ?? null;

    results.push({
      lineId: line.id,
      sessionCode: line.session.sessionNo ?? "",
      businessDate: formatDisplayDate(line.session.date),
      shipperCode,
      shipperName,
      consigneeCode,
      consigneeName,
      partyLabel: formatPartyLabel({
        mode,
        shipperCode,
        shipperName,
        consigneeCode,
        consigneeName,
      }),
      marketCode: market,
      mode,
      gapReason: gapCategory,
      gapReasonLabel: billingGapReasonLabel(rawGap),
    });
  }

  return results;
}
