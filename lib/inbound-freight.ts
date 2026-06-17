import type { PaymentMode } from "@/lib/constants/freight-settings";
import {
  DEFAULT_EXCHANGE_RATE,
  WTL_SST_MULTIPLIER,
} from "@/lib/constants/freight-settings";
import type { PickupLocation } from "@/lib/constants/pickup-locations";
import {
  convertThbToMyr,
  decimalToNumber,
  pickEffectiveRates,
} from "@/lib/freight-rates";

export type McDeliveryMode = "self" | "third_party";

export interface OperationalFreightSettings {
  mcThirdPartyRateTong: number | null;
  mcThirdPartyRateBox: number | null;
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
  /** Secondary WTL MYR income when dual_payment relation applies (mode 3). */
  dualPaymentWtlRate?: number | null;
  dualPaymentWtlAmount?: number | null;
}

interface RateRow {
  marketId: string;
  effectiveDate: Date;
  rateTong: unknown;
  rateBox: unknown;
  rateTongThai?: unknown;
  rateBoxThai?: unknown;
  isWtl?: boolean;
  sstApplicable?: boolean;
  currency?: string;
}

interface ConsigneeRateRow {
  consigneeId: string;
  marketId: string;
  effectiveDate: Date;
  rateTong: unknown;
  rateBox: unknown;
  rateTongThai?: unknown;
  rateBoxThai?: unknown;
  sstApplicable?: boolean;
  permitPerTrip?: unknown;
}

export interface ShipperFreightRate {
  rateTong: number | null;
  rateBox: number | null;
  rateTongThai: number | null;
  rateBoxThai: number | null;
  isWtl: boolean;
  sstApplicable: boolean;
  currency: string;
}

export interface ConsigneeFreightRateValues {
  rateTong: number | null;
  rateBox: number | null;
  rateTongThai: number | null;
  rateBoxThai: number | null;
  sstApplicable: boolean;
  permitPerTrip: number | null;
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
  paymentRelations: Map<
    string,
    {
      paymentMode: string;
      dualPayment?: boolean;
      secondaryConsigneeId?: string | null;
      secondaryPaymentMode?: string | null;
    }
  >;
  shipperRatesByMarket: Map<string, ShipperFreightRate>;
  consigneeRatesByConsigneeMarket: Map<string, ConsigneeFreightRateValues>;
  tongTypes: Map<string, { isBox: boolean }>;
}

function relationKey(shipperId: string, consigneeId: string) {
  return `${shipperId}:${consigneeId}`;
}

function defaultShipperPaymentMode(shipperCurrency: string): PaymentMode {
  return shipperCurrency.toUpperCase() === "MYR" ? "1b" : "1a";
}

function resolvePaymentMode(
  shipperId: string,
  consigneeId: string | null | undefined,
  relations: Map<
    string,
    {
      paymentMode: string;
      dualPayment?: boolean;
      secondaryConsigneeId?: string | null;
      secondaryPaymentMode?: string | null;
    }
  >,
  shipperCurrency: string
): PaymentMode {
  if (consigneeId) {
    const relation = relations.get(relationKey(shipperId, consigneeId));
    if (relation?.dualPayment) {
      return "1a";
    }
    const mode = relation?.paymentMode;
    if (mode === "1a" || mode === "1b" || mode === "2" || mode === "3") {
      return mode;
    }
  }
  return defaultShipperPaymentMode(shipperCurrency);
}

function resolveDualPaymentWtlIncome(
  line: InboundLineFreightInput,
  ctx: InboundFreightContext,
  relation:
    | {
        dualPayment?: boolean;
        secondaryConsigneeId?: string | null;
        secondaryPaymentMode?: string | null;
      }
    | undefined,
  marketId: string | null
): { rate: number | null; amount: number | null } {
  if (
    !relation?.dualPayment ||
    relation.secondaryPaymentMode !== "3" ||
    !relation.secondaryConsigneeId ||
    !marketId ||
    line.quantity <= 0
  ) {
    return { rate: null, amount: null };
  }

  const isBox = ctx.tongTypes.get(line.tongTypeId)?.isBox ?? false;
  const consigneeRate = ctx.consigneeRatesByConsigneeMarket.get(
    `${relation.secondaryConsigneeId}:${marketId}`
  );
  const unitRateBase = pickUnitRate(isBox, consigneeRate);
  if (unitRateBase == null) {
    return { rate: null, amount: null };
  }

  const unitRate = applySst(unitRateBase, consigneeRate?.sstApplicable ?? false);

  return {
    rate: unitRate,
    amount: roundMoney(line.quantity * unitRate),
  };
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

function applySst(unitRate: number, sstApplicable: boolean) {
  if (!sstApplicable) return unitRate;
  return roundMoney(unitRate * WTL_SST_MULTIPLIER);
}

function hasWtlThaiSegment(rate: {
  rateTongThai: number | null;
  rateBoxThai: number | null;
}) {
  return rate.rateTongThai != null || rate.rateBoxThai != null;
}

function computeWtlDualSegment(
  isBox: boolean,
  quantity: number,
  thaiRate: { rateTongThai: number | null; rateBoxThai: number | null },
  myRate: {
    rateTong: number | null;
    rateBox: number | null;
    sstApplicable: boolean;
  }
) {
  if (quantity <= 0) {
    return {
      thFreightRate: null as number | null,
      thFreightAmount: null as number | null,
      mySegmentFreightRate: null as number | null,
      mySegmentFreightAmount: null as number | null,
      totalUnitRate: null as number | null,
      totalAmount: null as number | null,
    };
  }

  // Thailand-segment rates are stored in MYR (no SST, no FX conversion).
  const thUnit = pickUnitRate(isBox, {
    rateTong: thaiRate.rateTongThai,
    rateBox: thaiRate.rateBoxThai,
  });
  const myUnitBase = pickUnitRate(isBox, {
    rateTong: myRate.rateTong,
    rateBox: myRate.rateBox,
  });

  let thFreightRate: number | null = null;
  let thFreightAmount: number | null = null;
  let mySegmentFreightRate: number | null = null;
  let mySegmentFreightAmount: number | null = null;

  if (thUnit != null) {
    thFreightRate = thUnit;
    thFreightAmount = roundMoney(quantity * thUnit);
  }
  if (myUnitBase != null) {
    mySegmentFreightRate = applySst(myUnitBase, myRate.sstApplicable);
    mySegmentFreightAmount = roundMoney(quantity * mySegmentFreightRate);
  }

  const totalAmount = roundMoney(
    (thFreightAmount ?? 0) + (mySegmentFreightAmount ?? 0)
  );
  const totalUnitRate =
    thFreightRate != null && mySegmentFreightRate != null
      ? roundMoney(thFreightRate + mySegmentFreightRate)
      : mySegmentFreightRate ?? thFreightRate;

  return {
    thFreightRate,
    thFreightAmount,
    mySegmentFreightRate,
    mySegmentFreightAmount,
    totalUnitRate: totalAmount > 0 ? totalUnitRate : null,
    totalAmount: totalAmount > 0 ? totalAmount : null,
  };
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

  const shipperRatesByMarket = new Map<string, ShipperFreightRate>();
  for (const [marketId, rate] of Array.from(shipperEffective.entries())) {
    const original = input.shipperRates.find((row) => row.marketId === marketId);
    shipperRatesByMarket.set(marketId, {
      rateTong: rate.rateTong,
      rateBox: rate.rateBox,
      rateTongThai: decimalToNumber(original?.rateTongThai),
      rateBoxThai: decimalToNumber(original?.rateBoxThai),
      isWtl: original?.isWtl === true,
      sstApplicable: original?.sstApplicable === true,
      currency: original?.currency ?? "THB",
    });
  }

  const consigneeRatesByConsigneeMarket = new Map<
    string,
    ConsigneeFreightRateValues
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
      const original = rows.find((row) => row.marketId === marketId);
      consigneeRatesByConsigneeMarket.set(`${consigneeId}:${marketId}`, {
        rateTong: rate.rateTong,
        rateBox: rate.rateBox,
        rateTongThai: decimalToNumber(original?.rateTongThai),
        rateBoxThai: decimalToNumber(original?.rateBoxThai),
        sstApplicable: original?.sstApplicable === true,
        permitPerTrip: decimalToNumber(original?.permitPerTrip),
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
  const relation = consigneeId
    ? ctx.paymentRelations.get(relationKey(ctx.shipper.id, consigneeId))
    : undefined;
  const isDualPayment = relation?.dualPayment === true;
  const paymentMode = resolvePaymentMode(
    ctx.shipper.id,
    consigneeId,
    ctx.paymentRelations,
    ctx.shipper.currency
  );
  const consigneePays = !isDualPayment && usesConsigneeRate(paymentMode);
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
  let unitRate = pickUnitRate(isBox, activeRate);
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

  let freightRate: number | null = unitRate;
  let freightAmount: number | null = null;
  let thirdPartyFee: number | null = null;
  let mySegmentFreightRate: number | null = null;
  let mySegmentFreightAmount: number | null = null;
  let thFreightRate: number | null = null;
  let thFreightAmount: number | null = null;

  const isWtlShipperRate =
    !isDualPayment && !consigneePays && shipperRate?.isWtl === true;
  const isWtlConsigneeDual =
    consigneePays && consigneeRate != null && hasWtlThaiSegment(consigneeRate);

  if (isWtlShipperRate && shipperRate && line.quantity > 0) {
    const segments = computeWtlDualSegment(
      isBox,
      line.quantity,
      shipperRate,
      shipperRate
    );
    thFreightRate = segments.thFreightRate;
    thFreightAmount = segments.thFreightAmount;
    mySegmentFreightRate = segments.mySegmentFreightRate;
    mySegmentFreightAmount = segments.mySegmentFreightAmount;
    unitRate = segments.totalUnitRate;
    freightRate = segments.totalUnitRate;
    freightAmount = segments.totalAmount;
  } else if (isWtlConsigneeDual && consigneeRate && line.quantity > 0) {
    const segments = computeWtlDualSegment(
      isBox,
      line.quantity,
      consigneeRate,
      consigneeRate
    );
    thFreightRate = segments.thFreightRate;
    thFreightAmount = segments.thFreightAmount;
    mySegmentFreightRate = segments.mySegmentFreightRate;
    mySegmentFreightAmount = segments.mySegmentFreightAmount;
    unitRate = segments.totalUnitRate;
    freightRate = segments.totalUnitRate;
    freightAmount = segments.totalAmount;
  } else if (
    consigneePays &&
    consigneeRate?.sstApplicable &&
    line.quantity > 0 &&
    unitRate != null
  ) {
    const rateWithSst = applySst(unitRate, true);
    unitRate = rateWithSst;
    freightRate = rateWithSst;
    freightAmount = roundMoney(line.quantity * rateWithSst);
  } else if (line.quantity > 0 && unitRate != null) {
    freightAmount = roundMoney(line.quantity * unitRate);
    freightRate = unitRate;
  }

  if (
    line.quantity > 0 &&
    freightAmount != null &&
    isMcMarket &&
    mcDeliveryMode === "third_party"
  ) {
    const mcRate = mcThirdPartyUnitRate(isBox, ctx.operationalSettings);
    if (mcRate != null) {
      thirdPartyFee = roundMoney(line.quantity * mcRate);
    }
  } else if (
    isMcMarket &&
    mcDeliveryMode === "third_party" &&
    line.quantity > 0 &&
    freightAmount == null
  ) {
    const mcRate = mcThirdPartyUnitRate(isBox, ctx.operationalSettings);
    if (mcRate != null) {
      thirdPartyFee = roundMoney(line.quantity * mcRate);
    }
  }

  const dualWtl = resolveDualPaymentWtlIncome(line, ctx, relation, marketId);

  return {
    consigneeId,
    paymentParty,
    paymentMode,
    currency,
    billingCompany,
    freightRate,
    freightAmount,
    exchangeRate: ctx.exchangeRate,
    mcDeliveryMode,
    thirdPartyFee,
    mySegmentFreightRate,
    mySegmentFreightAmount,
    thFreightRate,
    thFreightAmount,
    dualPaymentWtlRate: dualWtl.rate,
    dualPaymentWtlAmount: dualWtl.amount,
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
  const consigneeId = stall?.consigneeId ?? null;
  const isBox = ctx.tongTypes.get(line.tongTypeId)?.isBox ?? false;

  if (!marketId) return "no_market_on_stall";

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
  driverAllowancePerCrate?: unknown;
} | null): OperationalFreightSettings & { driverAllowancePerCrate: number | null } {
  return {
    mcThirdPartyRateTong: decimalToNumber(row?.mcThirdPartyRateTong),
    mcThirdPartyRateBox: decimalToNumber(row?.mcThirdPartyRateBox),
    driverAllowancePerCrate: decimalToNumber(row?.driverAllowancePerCrate),
  };
}
