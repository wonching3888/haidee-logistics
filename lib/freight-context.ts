import type { PickupLocation } from "@/lib/constants/pickup-locations";
import {
  buildInboundFreightMaps,
  defaultExchangeRate,
  serializeOperationalSettings,
  type InboundFreightContext,
} from "@/lib/inbound-freight";
import { getCurrentYearMonth } from "@/lib/freight-rates";
import { prisma } from "@/lib/prisma";

export async function loadInboundFreightContext(
  shipperId: string,
  stallIds: string[],
  tongTypeIds: string[],
  asOfDate: Date,
  pickupLocation: PickupLocation
): Promise<{ ctx: InboundFreightContext; shipperCurrency: string }> {
  const yearMonth = getCurrentYearMonth(asOfDate);
  const uniqueStallIds = Array.from(new Set(stallIds));

  const [
    shipper,
    stalls,
    exchangeRateRow,
    shipperRates,
    paymentRelations,
    tongTypes,
    operationalRow,
  ] = await Promise.all([
    prisma.shipper.findUnique({
      where: { id: shipperId },
      select: { id: true, currency: true, company: true },
    }),
    uniqueStallIds.length > 0
      ? prisma.stall.findMany({
          where: { id: { in: uniqueStallIds } },
          include: {
            market: { select: { id: true, code: true } },
            consignee: { select: { id: true, billingCompany: true } },
          },
        })
      : Promise.resolve([]),
    prisma.exchangeRate.findUnique({ where: { yearMonth } }),
    prisma.freightRate.findMany({ where: { shipperId } }),
    prisma.paymentRelation.findMany({
      where: { shipperId },
      select: {
        consigneeId: true,
        paymentMode: true,
        dualPayment: true,
        secondaryConsigneeId: true,
        secondaryPaymentMode: true,
      },
    }),
    tongTypeIds.length > 0
      ? prisma.tongType.findMany({
          where: { id: { in: Array.from(new Set(tongTypeIds)) } },
          select: { id: true, isBox: true },
        })
      : Promise.resolve([]),
    prisma.freightOperationalSettings.findUnique({ where: { id: "default" } }),
  ]);

  if (!shipper) {
    throw new Error("寄货人不存在 Shipper not found");
  }

  const consigneeIds = Array.from(
    new Set(
      [
        ...stalls
          .map((stall) => stall.consigneeId)
          .filter((id): id is string => Boolean(id)),
        ...paymentRelations
          .map((relation) => relation.secondaryConsigneeId)
          .filter((id): id is string => Boolean(id)),
      ]
    )
  );

  const consigneeRates =
    consigneeIds.length > 0
      ? await prisma.consigneeFreightRate.findMany({
          where: { consigneeId: { in: consigneeIds } },
        })
      : [];

  const { shipperRatesByMarket, consigneeRatesByConsigneeMarket } =
    buildInboundFreightMaps({
      shipperRates,
      consigneeRates,
      asOfDate,
    });

  const consignees = new Map<string, { billingCompany: string }>();
  for (const stall of stalls) {
    if (stall.consignee) {
      consignees.set(stall.consignee.id, {
        billingCompany: stall.consignee.billingCompany,
      });
    }
  }

  const operational = serializeOperationalSettings(operationalRow);

  return {
    shipperCurrency: shipper.currency,
    ctx: {
      shipper,
      exchangeRate: defaultExchangeRate(
        exchangeRateRow ? Number(exchangeRateRow.rate) : null
      ),
      pickupLocation,
      operationalSettings: {
        mcThirdPartyRateTong: operational.mcThirdPartyRateTong,
        mcThirdPartyRateBox: operational.mcThirdPartyRateBox,
        mySegmentRateTong: operational.mySegmentRateTong,
        mySegmentRateBox: operational.mySegmentRateBox,
      },
      stalls: new Map(
        stalls.map((stall) => [
          stall.id,
          {
            marketId: stall.marketId,
            marketCode: stall.market?.code ?? "",
            consigneeId: stall.consigneeId,
          },
        ])
      ),
      consignees,
      paymentRelations: new Map(
        paymentRelations.map((relation) => [
          `${shipperId}:${relation.consigneeId}`,
          {
            paymentMode: relation.paymentMode,
            dualPayment: relation.dualPayment,
            secondaryConsigneeId: relation.secondaryConsigneeId,
            secondaryPaymentMode: relation.secondaryPaymentMode,
          },
        ])
      ),
      shipperRatesByMarket,
      consigneeRatesByConsigneeMarket,
      tongTypes: new Map(tongTypes.map((tong) => [tong.id, { isBox: tong.isBox }])),
    },
  };
}
