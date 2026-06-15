import type { PaymentMode } from "@/lib/constants/freight-settings";
import { DEFAULT_EXCHANGE_RATE } from "@/lib/constants/freight-settings";
import type { PickupLocation } from "@/lib/constants/pickup-locations";
import { usesThSegmentSplit } from "@/lib/constants/pickup-locations";
import {
  convertMyrToThb,
  convertThbToMyr,
  decimalToNumber,
  pickEffectiveRates,
} from "@/lib/freight-rates";

export type McDeliveryMode = "self" | "third_party";

export interface OperationalFreightSettings {
  mcThirdPartyRateTong: number | null;
  mcThirdPartyRateBox: number | null;
  mySegmentRateTong: number | null;
  mySegmentRateBox: number | null;
}

export interface InboundLineFreightInput {
  stallId: string;
  tongTypeId: string;
  quantity: number;
  mcDeliveryMode?: McDeliveryMode | null;
}

export interface InboundLineFreightSnapshot {
  consigneeId: string | null;
  paymentParty: "shipper" | "consignee";
  paymentMode: PaymentMode;
  currency: string;
  billingCompany: string;
  freightRate: number | null;
  freightAmount: number | null;
  exchangeRate: number;
  mcDeliveryMode: McDeliveryMode | null;
  thirdPartyFee: number | null;
  mySegmentFreightRate: number | null;
  mySegmentFreightAmount: number | null;
  thFreightRate: number | null;
  thFreightAmount: number | null;
}

interface RateRow {
  marketId: string;
  effectiveDate: Date;
  rateTong: unknown;
  rateBox: unknown;
  currency?: string;
}

interface ConsigneeRateRow {
  consigneeId: string;
  marketId: string;
  effectiveDate: Date;
  rateTong: unknown;
  rateBox: unknown;
}

export interface InboundFreightContext {
  shipper: {
    id: string;
    currency: string;
    company: string;
  };
  exchangeRate: number;
  pickupLocation: PickupLocation;
  operationalSettings: OperationalFreightSettings;
  stalls: Map<
    string,
    {
      marketId: string | null;
      marketCode: string;
      consigneeId: string | null;
    }
  >;
  consignees: Map<string, { billingCompany: string }>;
  paymentRelations: Map<string, { paymentMode: string }>;
  shipperRatesByMarket: Map<
    string,
    { rateTong: number | null; rateBox: number | null; currency: string }
  >;
  consigneeRatesByConsigneeMarket: Map<
    string,
    { rateTong: number | null; rateBox: number | null }
  >;
  tongTypes: Map<string, { isBox: boolean }>;
}

function relationKey(shipperId: string, consigneeId: string) {
  return `${shipperId}:${consigneeId}`;
}

function resolvePaymentMode(
  shipperId: string,
  consigneeId: string | null | undefined,
  relations: Map<string, { paymentMode: string }>
): PaymentMode {
  if (!consigneeId) return "1a";
  const relation = relations.get(relationKey(shipperId, consigneeId));
  const mode = relation?.paymentMode;
  if (mode === "1a" || mode === "1b" || mode === "2" || mode === "3") {
    return mode;
  }
  return "1a";
}

function usesConsigneeRate(paymentMode: PaymentMode) {
  return paymentMode === "2" || paymentMode === "3";
}

function resolveCurrency(
  paymentMode: PaymentMode,
  shipperCurrency: string,
  rateCurrency?: string
) {
  if (paymentMode === "1a") return "THB";
  if (paymentMode === "1b" || paymentMode === "2") return "MYR";
  if (paymentMode === "3") return rateCurrency ?? shipperCurrency;
  return shipperCurrency;
}

function pickUnitRate(
  isBox: boolean,
  rate: { rateTong: number | null; rateBox: number | null } | undefined
) {
  if (!rate) return null;
  const value = isBox ? rate.rateBox : rate.rateTong;
  return value ?? null;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function mcThirdPartyUnitRate(
  isBox: boolean,
  settings: OperationalFreightSettings
) {
  return pickUnitRate(isBox, {
    rateTong: settings.mcThirdPartyRateTong,
    rateBox: settings.mcThirdPartyRateBox,
  });
}

function mySegmentUnitRate(isBox: boolean, settings: OperationalFreightSettings) {
  return pickUnitRate(isBox, {
    rateTong: settings.mySegmentRateTong,
    rateBox: settings.mySegmentRateBox,
  });
}

function customerUnitRateInThb(
  unitRate: number,
  currency: string,
  exchangeRate: number
) {
  if (currency === "MYR") {
    return roundMoney(convertMyrToThb(unitRate, exchangeRate));
  }
  return unitRate;
}

export function buildInboundFreightMaps(input: {
  shipperRates: RateRow[];
  consigneeRates: ConsigneeRateRow[];
  asOfDate: Date;
}) {
  const shipperEffective = pickEffectiveRates(
    input.shipperRates.map((rate) => ({
      marketId: rate.marketId,
      effectiveDate: rate.effectiveDate,
      rateTong: decimalToNumber(rate.rateTong),
      rateBox: decimalToNumber(rate.rateBox),
    })),
    input.asOfDate
  );

  const shipperRatesByMarket = new Map<
    string,
    { rateTong: number | null; rateBox: number | null; currency: string }
  >();
  for (const [marketId, rate] of Array.from(shipperEffective.entries())) {
    const original = input.shipperRates.find((row) => row.marketId === marketId);
    shipperRatesByMarket.set(marketId, {
      rateTong: rate.rateTong,
      rateBox: rate.rateBox,
      currency: original?.currency ?? "THB",
    });
  }

  const consigneeRatesByConsigneeMarket = new Map<
    string,
    { rateTong: number | null; rateBox: number | null }
  >();

  const consigneeIds = Array.from(
    new Set(input.consigneeRates.map((rate) => rate.consigneeId))
  );
  for (const consigneeId of consigneeIds) {
    const rows = input.consigneeRates.filter(
      (rate) => rate.consigneeId === consigneeId
    );
    const effective = pickEffectiveRates(
      rows.map((rate) => ({
        marketId: rate.marketId,
        effectiveDate: rate.effectiveDate,
        rateTong: decimalToNumber(rate.rateTong),
        rateBox: decimalToNumber(rate.rateBox),
      })),
      input.asOfDate
    );
    for (const [marketId, rate] of Array.from(effective.entries())) {
      consigneeRatesByConsigneeMarket.set(`${consigneeId}:${marketId}`, {
        rateTong: rate.rateTong,
        rateBox: rate.rateBox,
      });
    }
  }

  return { shipperRatesByMarket, consigneeRatesByConsigneeMarket };
}

export function computeInboundLineFreight(
  line: InboundLineFreightInput,
  ctx: InboundFreightContext
): InboundLineFreightSnapshot {
  const stall = ctx.stalls.get(line.stallId);
  const marketId = stall?.marketId ?? null;
  const marketCode = stall?.marketCode ?? "";
  const consigneeId = stall?.consigneeId ?? null;
  const isBox = ctx.tongTypes.get(line.tongTypeId)?.isBox ?? false;
  const paymentMode = resolvePaymentMode(
    ctx.shipper.id,
    consigneeId,
    ctx.paymentRelations
  );
  const consigneePays = usesConsigneeRate(paymentMode);
  const paymentParty: "shipper" | "consignee" = consigneePays
    ? "consignee"
    : "shipper";

  const shipperRate = marketId
    ? ctx.shipperRatesByMarket.get(marketId)
    : undefined;
  const consigneeRate =
    consigneeId && marketId
      ? ctx.consigneeRatesByConsigneeMarket.get(`${consigneeId}:${marketId}`)
      : undefined;

  const activeRate = consigneePays ? consigneeRate : shipperRate;
  const unitRate = pickUnitRate(isBox, activeRate);
  const currency = consigneePays
    ? "MYR"
    : resolveCurrency(
        paymentMode,
        ctx.shipper.currency,
        shipperRate?.currency
      );

  const billingCompany = consigneePays
    ? ctx.consignees.get(consigneeId!)?.billingCompany ?? "haidee"
    : ctx.shipper.company;

  const isMcMarket = marketCode === MC_MARKET_CODE;
  const mcDeliveryMode: McDeliveryMode | null = isMcMarket
    ? line.mcDeliveryMode ?? "self"
    : null;

  let freightAmount: number | null = null;
  let thirdPartyFee: number | null = null;

  if (line.quantity > 0 && unitRate != null) {
    const baseAmount = roundMoney(line.quantity * unitRate);
    if (isMcMarket && !consigneePays && mcDeliveryMode === "self") {
      freightAmount = 0;
      thirdPartyFee = null;
    } else if (isMcMarket && !consigneePays && mcDeliveryMode === "third_party") {
      freightAmount = 0;
      const mcRate = mcThirdPartyUnitRate(isBox, ctx.operationalSettings);
      if (mcRate != null) {
        thirdPartyFee = roundMoney(line.quantity * mcRate);
      }
    } else {
      freightAmount = baseAmount;
    }
  } else if (isMcMarket && !consigneePays) {
    freightAmount = 0;
    if (mcDeliveryMode === "third_party" && line.quantity > 0) {
      const mcRate = mcThirdPartyUnitRate(isBox, ctx.operationalSettings);
      if (mcRate != null) {
        thirdPartyFee = roundMoney(line.quantity * mcRate);
      }
    }
  }

  let mySegmentFreightRate: number | null = null;
  let mySegmentFreightAmount: number | null = null;
  let thFreightRate: number | null = null;
  let thFreightAmount: number | null = null;

  if (
    !isMcMarket &&
    usesThSegmentSplit(ctx.pickupLocation) &&
    line.quantity > 0 &&
    unitRate != null
  ) {
    const myRate = mySegmentUnitRate(isBox, ctx.operationalSettings);
    if (myRate != null) {
      mySegmentFreightRate = myRate;
      mySegmentFreightAmount = roundMoney(line.quantity * myRate);

      const customerThb = customerUnitRateInThb(
        unitRate,
        currency,
        ctx.exchangeRate
      );
      const myThb = roundMoney(convertMyrToThb(myRate, ctx.exchangeRate));
      const thUnit = roundMoney(customerThb - myThb);
      thFreightRate = thUnit;
      thFreightAmount = roundMoney(line.quantity * thUnit);
    }
  }

  return {
    consigneeId,
    paymentParty,
    paymentMode,
    currency,
    billingCompany,
    freightRate: unitRate,
    freightAmount,
    exchangeRate: ctx.exchangeRate,
    mcDeliveryMode,
    thirdPartyFee,
    mySegmentFreightRate,
    mySegmentFreightAmount,
    thFreightRate,
    thFreightAmount,
  };
}

export type InboundFreightGapReason =
  | "no_market_on_stall"
  | "stall_missing_consignee"
  | "no_shipper_rate"
  | "shipper_missing_tong_rate"
  | "shipper_missing_box_rate"
  | "no_consignee_rate"
  | "consignee_missing_tong_rate"
  | "consignee_missing_box_rate"
  | "mc_self_delivery"
  | "mc_third_party_customer_zero";

export function classifyInboundFreightGap(
  line: InboundLineFreightInput,
  ctx: InboundFreightContext,
  snapshot: InboundLineFreightSnapshot
): InboundFreightGapReason | null {
  if ((snapshot.freightAmount ?? 0) > 0) return null;

  const stall = ctx.stalls.get(line.stallId);
  const marketId = stall?.marketId ?? null;
  const marketCode = stall?.marketCode ?? "";
  const consigneeId = stall?.consigneeId ?? null;
  const isBox = ctx.tongTypes.get(line.tongTypeId)?.isBox ?? false;
  const isMcMarket = marketCode === MC_MARKET_CODE;
  const mcDeliveryMode: McDeliveryMode | null = isMcMarket
    ? line.mcDeliveryMode ?? "self"
    : null;

  if (!marketId) return "no_market_on_stall";

  if (isMcMarket && mcDeliveryMode === "self" && !usesConsigneeRate(snapshot.paymentMode)) {
    return "mc_self_delivery";
  }
  if (
    isMcMarket &&
    mcDeliveryMode === "third_party" &&
    !usesConsigneeRate(snapshot.paymentMode)
  ) {
    return "mc_third_party_customer_zero";
  }

  const expectsConsigneePayment = Array.from(ctx.paymentRelations.values()).some(
    (relation) => relation.paymentMode === "2" || relation.paymentMode === "3"
  );
  if (expectsConsigneePayment && !consigneeId) {
    return "stall_missing_consignee";
  }

  const consigneePays = usesConsigneeRate(snapshot.paymentMode);
  const shipperRate = ctx.shipperRatesByMarket.get(marketId);
  const consigneeRate =
    consigneeId && marketId
      ? ctx.consigneeRatesByConsigneeMarket.get(`${consigneeId}:${marketId}`)
      : undefined;
  const activeRate = consigneePays ? consigneeRate : shipperRate;

  if (consigneePays) {
    if (!activeRate) return "no_consignee_rate";
    if (isBox && activeRate.rateBox == null) return "consignee_missing_box_rate";
    if (!isBox && activeRate.rateTong == null) {
      return "consignee_missing_tong_rate";
    }
    return null;
  }

  if (!activeRate) return "no_shipper_rate";
  if (isBox && activeRate.rateBox == null) return "shipper_missing_box_rate";
  if (!isBox && activeRate.rateTong == null) return "shipper_missing_tong_rate";
  return null;
}

export function isMissingRateGap(reason: InboundFreightGapReason) {
  return (
    reason !== "mc_self_delivery" && reason !== "mc_third_party_customer_zero"
  );
}

export function freightAmountMyrEquivalent(
  snapshot: InboundLineFreightSnapshot
) {
  if (snapshot.freightAmount == null) return null;
  if (snapshot.currency === "MYR") return snapshot.freightAmount;
  return roundMoney(
    convertThbToMyr(snapshot.freightAmount, snapshot.exchangeRate)
  );
}

export function defaultExchangeRate(rate: number | null | undefined) {
  return rate && rate > 0 ? rate : DEFAULT_EXCHANGE_RATE;
}

export const MC_MARKET_CODE = "MC";

export function normalizeMcDeliveryMode(
  marketCode: string,
  value?: string | null
): McDeliveryMode | null {
  if (marketCode !== MC_MARKET_CODE) return null;
  return value === "third_party" ? "third_party" : "self";
}

export function serializeOperationalSettings(row: {
  mcThirdPartyRateTong: unknown;
  mcThirdPartyRateBox: unknown;
  mySegmentRateTong: unknown;
  mySegmentRateBox: unknown;
  driverAllowancePerCrate?: unknown;
} | null): OperationalFreightSettings & { driverAllowancePerCrate: number | null } {
  return {
    mcThirdPartyRateTong: decimalToNumber(row?.mcThirdPartyRateTong),
    mcThirdPartyRateBox: decimalToNumber(row?.mcThirdPartyRateBox),
    mySegmentRateTong: decimalToNumber(row?.mySegmentRateTong),
    mySegmentRateBox: decimalToNumber(row?.mySegmentRateBox),
    driverAllowancePerCrate: decimalToNumber(row?.driverAllowancePerCrate),
  };
}
