import {
  classifyInboundFreightGap,
  hasAnyFreightRevenue,
  inboundLineStoredSnapshot,
  isMissingRateGap,
  normalizeMcDeliveryMode,
  type InboundFreightGapReason,
  type InboundLineFreightSnapshot,
} from "@/lib/inbound-freight";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";
import { loadExchangeRate } from "@/lib/exchange-rate";
import {
  fetchOperationsAssignedInboundLines,
  type OperationsAssignedInboundLine,
} from "@/lib/operations-inbound-lines";
import {
  getOperationsFreightContext,
  preloadOperationsFreightContexts,
} from "@/lib/operations-freight-preload";
import {
  dualPaymentWtlRevenueMyr,
  lineRevenueMyr,
  operationsFreightIncomeMyr,
  shouldExcludeWtlSstFromRevenue,
} from "@/lib/wtl-revenue";
import { convertThbToMyr } from "@/lib/freight-rates";
import { isLogisticsPartnerShipper } from "@/lib/constants/shipper-kind";
import { aggregatePartnerFreightIncomeMyr } from "@/lib/partner-freight";
import { aggregateCrateReturnIncomeMyr } from "@/lib/crate-return-billing";
import { aggregateMonthlyInvoiceExtraChargesMyr } from "@/lib/monthly-invoice-extra-charges";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
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
  mode1aMyr: number;
  mode1bMyr: number;
  mode2Myr: number;
  wtlMode3Myr: number;
  wtlShipperMyr: number;
  freightRevenueMyr: number;
  partnerFreightMyr: number;
  crateReturnIncomeMyr: number;
  monthlyInvoiceExtraChargesMyr: number;
  lineCount: number;
  missingRateLineCount: number;
  missingRateQuantity: number;
  gapReasons: Partial<Record<InboundFreightGapReason, number>>;
  warningSamples: OperationsIncomeWarningSample[];
  /**
   * Dual-payment (bilateral billing) lines where ONE leg is fully priced
   * (already counted in the totals above) but the OTHER leg has a rate gap.
   * Kept separate from missingRateLineCount/warningSamples so a partially
   * gapped line — which is already contributing real revenue — doesn't
   * inflate the "zero revenue" data-quality count.
   */
  dualPaymentPartialGapLineCount: number;
  dualPaymentPartialGapQuantity: number;
  dualPaymentPartialGapReasons: Partial<Record<InboundFreightGapReason, number>>;
  dualPaymentPartialGapSamples: OperationsIncomeWarningSample[];
}

const WARNING_SAMPLE_LIMIT = 8;

function resolveLineDispatchDate(
  line: OperationsAssignedInboundLine,
  monthEnd: Date
): Date {
  return line.dispatchLines[0]?.dispatchOrder.date ?? monthEnd;
}

function accumulateStoredLineBuckets(
  totals: {
    mode1aThb: number;
    mode1aMyr: number;
    mode1bMyr: number;
    mode2Myr: number;
    wtlMode3Myr: number;
    wtlShipperMyr: number;
  },
  snapshot: InboundLineFreightSnapshot,
  exchangeRate: number,
  tripDate: Date
) {
  if (snapshot.freightAmount == null || snapshot.freightAmount <= 0) {
    const dualOnly = dualPaymentWtlRevenueMyr(
      snapshot,
      shouldExcludeWtlSstFromRevenue(tripDate)
    );
    if (dualOnly > 0) {
      totals.wtlMode3Myr += dualOnly;
    }
    return;
  }

  const excludeSst = shouldExcludeWtlSstFromRevenue(tripDate);

  if (snapshot.paymentMode === "1a" && snapshot.currency === "THB") {
    totals.mode1aThb += snapshot.freightAmount;
    totals.mode1aMyr += roundMoney(
      convertThbToMyr(snapshot.freightAmount, exchangeRate)
    );
  } else {
    const freightIncome = operationsFreightIncomeMyr(snapshot, tripDate);
    if (freightIncome > 0) {
      if (
        snapshot.paymentMode === "1b" &&
        snapshot.currency === "MYR" &&
        snapshot.billingCompany === "wtl"
      ) {
        totals.wtlShipperMyr += freightIncome;
      } else if (snapshot.paymentMode === "1b" && snapshot.currency === "MYR") {
        totals.mode1bMyr += freightIncome;
      } else if (snapshot.paymentMode === "2" && snapshot.currency === "MYR") {
        totals.mode2Myr += freightIncome;
      } else if (snapshot.paymentMode === "3" && snapshot.currency === "MYR") {
        totals.wtlMode3Myr += freightIncome;
      }
    }
  }

  const dualIncome = dualPaymentWtlRevenueMyr(snapshot, excludeSst);
  if (dualIncome > 0) {
    totals.wtlMode3Myr += dualIncome;
  }
}

export async function aggregateOperationsIncome(
  year: number,
  month: number,
  preloadedLines?: OperationsAssignedInboundLine[]
): Promise<OperationsIncomeResult> {
  const { end } = getMonthDateRange(year, month);
  const monthlyEx = await loadExchangeRate(year, month);

  const lines =
    preloadedLines ?? (await fetchOperationsAssignedInboundLines(year, month));

  const freightCache = await preloadOperationsFreightContexts(lines, end);

  const linesByShipper = new Map<string, typeof lines>();
  for (const line of lines) {
    const shipperId = line.session.shipperId;
    const group = linesByShipper.get(shipperId) ?? [];
    group.push(line);
    linesByShipper.set(shipperId, group);
  }

  const totals = {
    mode1aThb: 0,
    mode1aMyr: 0,
    mode1bMyr: 0,
    mode2Myr: 0,
    wtlMode3Myr: 0,
    wtlShipperMyr: 0,
  };
  let freightRevenueMyr = 0;
  const gapReasons: Partial<Record<InboundFreightGapReason, number>> = {};
  const warningSamples: OperationsIncomeWarningSample[] = [];
  let missingRateLineCount = 0;
  let missingRateQuantity = 0;
  const dualPaymentPartialGapReasons: Partial<Record<InboundFreightGapReason, number>> = {};
  const dualPaymentPartialGapSamples: OperationsIncomeWarningSample[] = [];
  let dualPaymentPartialGapLineCount = 0;
  let dualPaymentPartialGapQuantity = 0;

  for (const shipperLines of Array.from(linesByShipper.values())) {
    for (const line of shipperLines) {
      if (isLogisticsPartnerShipper(line.session.shipper)) {
        continue;
      }
      const tripDate = resolveLineDispatchDate(line, end);
      const marketCode = line.stall.market?.code ?? "";
      const snapshot = inboundLineStoredSnapshot(line, monthlyEx, marketCode);

      // A dual-payment line can have real revenue on ONE leg while the other
      // leg is empty — freightAmount alone must not decide "this line has no
      // revenue" anymore. hasAnyFreightRevenue looks at both legs.
      if (!hasAnyFreightRevenue(snapshot)) {
        const ctx = getOperationsFreightContext(
          freightCache,
          line,
          end,
          shipperLines
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
        continue;
      }

      freightRevenueMyr += lineRevenueMyr(snapshot, monthlyEx, tripDate);
      accumulateStoredLineBuckets(totals, snapshot, monthlyEx, tripDate);

      // This line's revenue is already fully counted above. If it's a
      // dual-payment line where only ONE leg priced, still surface the gap
      // on the other leg — but as a separate, non-blocking note, not as a
      // "zero revenue" line (it isn't one).
      const hasPrimary = (snapshot.freightAmount ?? 0) > 0;
      const hasDual = (snapshot.dualPaymentWtlAmount ?? 0) > 0;
      if (!hasPrimary || !hasDual) {
        const ctx = getOperationsFreightContext(
          freightCache,
          line,
          end,
          shipperLines
        );
        const partialGapReason = classifyInboundFreightGap(
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
        if (partialGapReason) {
          dualPaymentPartialGapReasons[partialGapReason] =
            (dualPaymentPartialGapReasons[partialGapReason] ?? 0) + 1;
          dualPaymentPartialGapLineCount += 1;
          dualPaymentPartialGapQuantity += line.quantity;
          if (dualPaymentPartialGapSamples.length < WARNING_SAMPLE_LIMIT) {
            dualPaymentPartialGapSamples.push({
              shipperCode: line.session.shipper.code,
              shipperName: line.session.shipper.name,
              marketCode,
              quantity: line.quantity,
              reason: partialGapReason,
            });
          }
        }
      }
    }
  }

  const partnerFreightMyr = await aggregatePartnerFreightIncomeMyr(year, month);
  const crateReturnIncomeMyr = await aggregateCrateReturnIncomeMyr(year, month);
  const monthlyInvoiceExtraChargesMyr =
    await aggregateMonthlyInvoiceExtraChargesMyr(year, month);

  return {
    mode1aThb: roundMoney(totals.mode1aThb),
    mode1aMyr: roundMoney(totals.mode1aMyr),
    mode1bMyr: roundMoney(totals.mode1bMyr),
    mode2Myr: roundMoney(totals.mode2Myr),
    wtlMode3Myr: roundMoney(totals.wtlMode3Myr),
    wtlShipperMyr: roundMoney(totals.wtlShipperMyr),
    freightRevenueMyr: roundMoney(freightRevenueMyr),
    partnerFreightMyr,
    crateReturnIncomeMyr,
    monthlyInvoiceExtraChargesMyr,
    lineCount: lines.length,
    missingRateLineCount,
    missingRateQuantity,
    gapReasons,
    warningSamples,
    dualPaymentPartialGapLineCount,
    dualPaymentPartialGapQuantity,
    dualPaymentPartialGapReasons,
    dualPaymentPartialGapSamples,
  };
}
