"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getMarketDisplayName } from "@/lib/constants/market-names";
import {
  DEFAULT_EXCHANGE_RATE,
  isBillingCompany,
  isPaymentMode,
} from "@/lib/constants/freight-settings";
import {
  DEFAULT_FUEL_PRICES,
} from "@/lib/constants/truck-cost";
import {
  buildRateMatrix,
  decimalToNumber,
  getCurrentYearMonth,
  getFreightMarketCodes,
  resolveEffectiveDateInput,
} from "@/lib/freight-rates";
import { sortMarkets } from "@/lib/markets";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new Error("无权限 Unauthorized");
  }
  return user;
}

function serializeMarkets(
  markets: { id: string; code: string; name: string }[]
) {
  const freightCodes = getFreightMarketCodes();
  const sortedCodes = sortMarkets(
    markets.map((market) => market.code),
    freightCodes
  ).filter((code) => freightCodes.includes(code as (typeof freightCodes)[number]));

  return sortedCodes.map((code) => {
    const market = markets.find((item) => item.code === code)!;
    return {
      id: market.id,
      code: market.code,
      name: getMarketDisplayName(market.code),
    };
  });
}

export async function getFreightSettingsData() {
  await requireAdmin();

  const [
    shippers,
    consignees,
    markets,
    shipperRates,
    consigneeRates,
    paymentRelations,
    exchangeRates,
    fuelPriceRow,
  ] = await Promise.all([
    prisma.shipper.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, currency: true },
    }),
    prisma.consignee.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        billingCompany: true,
        active: true,
      },
    }),
    prisma.market.findMany({
      where: { active: true },
      select: { id: true, code: true, name: true },
    }),
    prisma.freightRate.findMany({
      select: {
        shipperId: true,
        marketId: true,
        rateTong: true,
        rateBox: true,
        effectiveDate: true,
      },
    }),
    prisma.consigneeFreightRate.findMany({
      select: {
        consigneeId: true,
        marketId: true,
        rateTong: true,
        rateBox: true,
        effectiveDate: true,
      },
    }),
    prisma.paymentRelation.findMany({
      include: {
        shipper: { select: { id: true, name: true, code: true } },
        consignee: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ shipper: { name: "asc" } }, { consignee: { name: "asc" } }],
    }),
    prisma.exchangeRate.findMany({
      orderBy: { yearMonth: "desc" },
    }),
    prisma.fuelPrice.findUnique({ where: { id: "default" } }),
  ]);

  const freightMarkets = serializeMarkets(markets);
  const marketIdsByCode = new Map(
    freightMarkets.map((market) => [market.code, market.id])
  );

  const shipperRateRows = shippers.map((shipper) => {
    const rates = shipperRates
      .filter((rate) => rate.shipperId === shipper.id)
      .map((rate) => ({
        marketId: rate.marketId,
        effectiveDate: rate.effectiveDate,
        rateTong: decimalToNumber(rate.rateTong),
        rateBox: decimalToNumber(rate.rateBox),
      }));

    return {
      ...shipper,
      matrix: buildRateMatrix({
        entityId: shipper.id,
        rates,
        marketIdsByCode,
      }).cells,
    };
  });

  const consigneeRateRows = consignees
    .filter((consignee) => consignee.active)
    .map((consignee) => {
      const rates = consigneeRates
        .filter((rate) => rate.consigneeId === consignee.id)
        .map((rate) => ({
          marketId: rate.marketId,
          effectiveDate: rate.effectiveDate,
          rateTong: decimalToNumber(rate.rateTong),
          rateBox: decimalToNumber(rate.rateBox),
        }));

      return {
        ...consignee,
        matrix: buildRateMatrix({
          entityId: consignee.id,
          rates,
          marketIdsByCode,
        }).cells,
      };
    });

  const currentYearMonth = getCurrentYearMonth();
  const currentExchangeRate = exchangeRates.find(
    (item) => item.yearMonth === currentYearMonth
  );

  return {
    freightMarkets,
    shippers: shipperRateRows,
    consignees: consigneeRateRows,
    allConsignees: consignees,
    allShippers: shippers,
    paymentRelations: paymentRelations.map((relation) => ({
      id: relation.id,
      shipperId: relation.shipperId,
      shipperName: relation.shipper.name,
      shipperCode: relation.shipper.code,
      consigneeId: relation.consigneeId,
      consigneeName: relation.consignee.name,
      consigneeCode: relation.consignee.code,
      paymentMode: relation.paymentMode,
    })),
    exchangeRates: exchangeRates.map((item) => ({
      id: item.id,
      yearMonth: item.yearMonth,
      rate: decimalToNumber(item.rate) ?? DEFAULT_EXCHANGE_RATE,
    })),
    exchangeAlert: {
      currentYearMonth,
      missing: !currentExchangeRate,
      currentRate: currentExchangeRate
        ? decimalToNumber(currentExchangeRate.rate)
        : null,
    },
    fuelPrice: {
      myrPerLiter:
        decimalToNumber(fuelPriceRow?.myrPerLiter) ??
        DEFAULT_FUEL_PRICES.myrPerLiter,
      thbPerLiter:
        decimalToNumber(fuelPriceRow?.thbPerLiter) ??
        DEFAULT_FUEL_PRICES.thbPerLiter,
    },
  };
}

export async function saveShipperFreightRates(input: {
  shipperId: string;
  rates: { marketId: string; rateTong?: number | null; rateBox?: number | null }[];
  immediate: boolean;
  scheduledDate?: string;
}) {
  await requireAdmin();

  const shipper = await prisma.shipper.findUnique({
    where: { id: input.shipperId },
    select: { id: true, currency: true, active: true },
  });
  if (!shipper?.active) {
    throw new Error("寄货人不存在或已停用 Shipper not found or inactive");
  }

  const effectiveDate = resolveEffectiveDateInput({
    immediate: input.immediate,
    scheduledDate: input.scheduledDate,
  });

  await prisma.$transaction(
    input.rates.map((rate) =>
      prisma.freightRate.upsert({
        where: {
          shipperId_marketId_effectiveDate: {
            shipperId: input.shipperId,
            marketId: rate.marketId,
            effectiveDate,
          },
        },
        create: {
          shipperId: input.shipperId,
          marketId: rate.marketId,
          rateTong: rate.rateTong ?? null,
          rateBox: rate.rateBox ?? null,
          currency: shipper.currency,
          effectiveDate,
        },
        update: {
          rateTong: rate.rateTong ?? null,
          rateBox: rate.rateBox ?? null,
          currency: shipper.currency,
        },
      })
    )
  );

  revalidatePath("/settings");
}

export async function saveConsignee(input: {
  id?: string;
  code: string;
  name: string;
  billingCompany: string;
  active: boolean;
}) {
  await requireAdmin();

  if (!isBillingCompany(input.billingCompany)) {
    throw new Error("无效的开单公司 Invalid billing company");
  }

  const data = {
    code: input.code.trim(),
    name: input.name.trim(),
    billingCompany: input.billingCompany,
    active: input.active,
  };

  if (input.id) {
    await prisma.consignee.update({ where: { id: input.id }, data });
  } else {
    await prisma.consignee.create({ data });
  }

  revalidatePath("/settings");
}

export async function deleteConsignee(id: string) {
  await requireAdmin();
  await prisma.consignee.update({
    where: { id },
    data: { active: false },
  });
  revalidatePath("/settings");
}

export async function saveConsigneeFreightRates(input: {
  consigneeId: string;
  rates: { marketId: string; rateTong?: number | null; rateBox?: number | null }[];
  immediate: boolean;
  scheduledDate?: string;
}) {
  await requireAdmin();

  const consignee = await prisma.consignee.findUnique({
    where: { id: input.consigneeId },
    select: { id: true, active: true },
  });
  if (!consignee?.active) {
    throw new Error("收货人不存在或已停用 Consignee not found or inactive");
  }

  const effectiveDate = resolveEffectiveDateInput({
    immediate: input.immediate,
    scheduledDate: input.scheduledDate,
  });

  await prisma.$transaction(
    input.rates.map((rate) =>
      prisma.consigneeFreightRate.upsert({
        where: {
          consigneeId_marketId_effectiveDate: {
            consigneeId: input.consigneeId,
            marketId: rate.marketId,
            effectiveDate,
          },
        },
        create: {
          consigneeId: input.consigneeId,
          marketId: rate.marketId,
          rateTong: rate.rateTong ?? null,
          rateBox: rate.rateBox ?? null,
          effectiveDate,
        },
        update: {
          rateTong: rate.rateTong ?? null,
          rateBox: rate.rateBox ?? null,
        },
      })
    )
  );

  revalidatePath("/settings");
}

export async function savePaymentRelation(input: {
  id?: string;
  shipperId: string;
  consigneeId: string;
  paymentMode: string;
}) {
  await requireAdmin();

  if (!isPaymentMode(input.paymentMode)) {
    throw new Error("无效的付款模式 Invalid payment mode");
  }

  const data = {
    shipperId: input.shipperId,
    consigneeId: input.consigneeId,
    paymentMode: input.paymentMode,
  };

  if (input.id) {
    await prisma.paymentRelation.update({ where: { id: input.id }, data });
  } else {
    await prisma.paymentRelation.create({ data });
  }

  revalidatePath("/settings");
}

export async function deletePaymentRelation(id: string) {
  await requireAdmin();
  await prisma.paymentRelation.delete({ where: { id } });
  revalidatePath("/settings");
}

export async function saveExchangeRate(input: {
  id?: string;
  yearMonth: string;
  rate: number;
}) {
  await requireAdmin();

  const yearMonth = input.yearMonth.trim();
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    throw new Error("月份格式应为 YYYY-MM Month format must be YYYY-MM");
  }
  if (!Number.isFinite(input.rate) || input.rate <= 0) {
    throw new Error("汇率必须大于 0 Exchange rate must be greater than 0");
  }

  if (input.id) {
    await prisma.exchangeRate.update({
      where: { id: input.id },
      data: { yearMonth, rate: input.rate },
    });
  } else {
    await prisma.exchangeRate.upsert({
      where: { yearMonth },
      create: { yearMonth, rate: input.rate },
      update: { rate: input.rate },
    });
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

export async function saveFuelPrice(input: {
  myrPerLiter: number;
  thbPerLiter: number;
}) {
  await requireAdmin();

  if (!Number.isFinite(input.myrPerLiter) || input.myrPerLiter <= 0) {
    throw new Error("马来西亚油价必须大于 0 MYR fuel price must be greater than 0");
  }
  if (!Number.isFinite(input.thbPerLiter) || input.thbPerLiter <= 0) {
    throw new Error("泰国油价必须大于 0 THB fuel price must be greater than 0");
  }

  await prisma.fuelPrice.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      myrPerLiter: input.myrPerLiter,
      thbPerLiter: input.thbPerLiter,
    },
    update: {
      myrPerLiter: input.myrPerLiter,
      thbPerLiter: input.thbPerLiter,
    },
  });

  revalidatePath("/settings");
}
