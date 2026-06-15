import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { resolveSessionPickupLocation } from "@/lib/constants/pickup-locations";
import { loadInboundFreightContext } from "@/lib/freight-context";
import {
  classifyInboundFreightGap,
  computeInboundLineFreight,
  normalizeMcDeliveryMode,
} from "@/lib/inbound-freight";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";

async function main() {
  const { start, end } = getMonthDateRange(2026, 6);

  const shipper = await prisma.shipper.findUnique({
    where: { code: "3001-008" },
    select: { id: true, code: true, name: true, currency: true, company: true },
  });
  if (!shipper) {
    console.log("SOPHON (3001-008) not found");
    return;
  }

  const nkl = await prisma.consignee.findUnique({
    where: { code: "3000-N001" },
    select: { id: true, code: true, name: true, billingCompany: true },
  });

  const paymentRelations = await prisma.paymentRelation.findMany({
    where: { shipperId: shipper.id },
    include: {
      consignee: { select: { code: true, name: true, billingCompany: true } },
    },
  });

  const nklRates = nkl
    ? await prisma.consigneeFreightRate.findMany({
        where: { consigneeId: nkl.id },
        include: { market: { select: { code: true, name: true } } },
        orderBy: [{ market: { code: "asc" } }, { effectiveDate: "desc" }],
      })
    : [];

  const ktLines = await prisma.inboundLine.findMany({
    where: {
      session: { shipperId: shipper.id },
      stall: { market: { code: "KT" } },
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
      id: true,
      quantity: true,
      mcDeliveryMode: true,
      stallId: true,
      tongTypeId: true,
      stall: {
        select: {
          id: true,
          code: true,
          name: true,
          consigneeId: true,
          consignee: {
            select: { id: true, code: true, name: true, billingCompany: true },
          },
          market: { select: { code: true, name: true } },
        },
      },
      tongType: { select: { code: true, isBox: true } },
      session: {
        select: {
          pickupLocation: true,
          shipper: { select: { pickupLocation: true } },
        },
      },
    },
  });

  const allSophonJune = await prisma.inboundLine.findMany({
    where: {
      session: { shipperId: shipper.id },
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
      quantity: true,
      stall: {
        select: {
          code: true,
          name: true,
          consignee: { select: { code: true, name: true } },
          market: { select: { code: true } },
        },
      },
    },
  });

  const freightChecks: object[] = [];
  if (ktLines.length > 0) {
    const pickupLocation = resolveSessionPickupLocation(
      ktLines[0]?.session.pickupLocation,
      ktLines[0]?.session.shipper.pickupLocation
    );
    const { ctx } = await loadInboundFreightContext(
      shipper.id,
      Array.from(new Set(ktLines.map((l) => l.stallId))),
      Array.from(new Set(ktLines.map((l) => l.tongTypeId))),
      end,
      pickupLocation
    );

    for (const line of ktLines) {
      const marketCode = line.stall.market?.code ?? "";
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
      const gap = classifyInboundFreightGap(
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
      freightChecks.push({
        lineId: line.id,
        stallCode: line.stall.code,
        stallName: line.stall.name,
        market: marketCode,
        consignee: line.stall.consignee
          ? `${line.stall.consignee.code} ${line.stall.consignee.name}`
          : null,
        tongType: line.tongType.code,
        isBox: line.tongType.isBox,
        quantity: line.quantity,
        paymentMode: snapshot.paymentMode,
        paymentParty: snapshot.paymentParty,
        billingCompany: snapshot.billingCompany,
        freightAmount: snapshot.freightAmount,
        gapReason: gap,
      });
    }
  }

  const ktStalls = await prisma.stall.findMany({
    where: { market: { code: "KT" }, active: true },
    select: {
      code: true,
      name: true,
      consignee: { select: { code: true, name: true } },
    },
    orderBy: { code: "asc" },
  });

  console.log(
    JSON.stringify(
      {
        shipper,
        nkl,
        paymentRelations: paymentRelations.map((r) => ({
          consignee: `${r.consignee.code} ${r.consignee.name}`,
          paymentMode: r.paymentMode,
          dualPayment: r.dualPayment,
        })),
        nklConsigneeRates: nklRates.map((r) => ({
          market: r.market.code,
          rateTong: r.rateTong != null ? Number(r.rateTong) : null,
          rateBox: r.rateBox != null ? Number(r.rateBox) : null,
          rateTongThai:
            r.rateTongThai != null ? Number(r.rateTongThai) : null,
          rateBoxThai: r.rateBoxThai != null ? Number(r.rateBoxThai) : null,
          sstApplicable: r.sstApplicable,
          permitPerTrip:
            r.permitPerTrip != null ? Number(r.permitPerTrip) : null,
          effectiveDate: r.effectiveDate,
        })),
        juneSophonByMarket: Object.entries(
          allSophonJune.reduce<Record<string, { qty: number; stalls: string[] }>>(
            (acc, line) => {
              const m = line.stall.market?.code ?? "?";
              acc[m] ??= { qty: 0, stalls: [] };
              acc[m].qty += line.quantity;
              const label = `${line.stall.code}${line.stall.name ? ` (${line.stall.name})` : ""} → ${line.stall.consignee?.code ?? "NO_CONSIGNEE"}`;
              if (!acc[m].stalls.includes(label)) acc[m].stalls.push(label);
              return acc;
            },
            {}
          )
        ),
        ktJuneLines: ktLines.map((l) => ({
          stall: l.stall.code,
          stallName: l.stall.name,
          consignee: l.stall.consignee
            ? `${l.stall.consignee.code} ${l.stall.consignee.name}`
            : null,
          qty: l.quantity,
          tong: l.tongType.code,
        })),
        freightChecks,
        allKtStalls: ktStalls,
      },
      null,
      2
    )
  );
}

main().finally(() => prisma.$disconnect());
