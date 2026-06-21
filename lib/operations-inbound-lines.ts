import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";

export const operationsAssignedInboundLineSelect = {
  stallId: true,
  tongTypeId: true,
  quantity: true,
  mcDeliveryMode: true,
  freightAmount: true,
  freightRate: true,
  currency: true,
  paymentMode: true,
  billingCompany: true,
  consigneeId: true,
  paymentParty: true,
  mySegmentFreightRate: true,
  mySegmentFreightAmount: true,
  thFreightRate: true,
  thFreightAmount: true,
  dualPaymentWtlRate: true,
  dualPaymentWtlAmount: true,
  dualPaymentWtlConsigneeId: true,
  tongType: { select: { isBox: true } },
  stall: { select: { market: { select: { code: true } } } },
  session: {
    select: {
      shipperId: true,
      pickupLocation: true,
      shipper: {
        select: { code: true, name: true, pickupLocation: true, shipperKind: true },
      },
    },
  },
  dispatchLines: {
    where: {
      dispatchOrder: {
        status: { notIn: ["draft", "cancelled"] },
      },
    },
    orderBy: { dispatchOrder: { date: "desc" } },
    take: 1,
    select: {
      dispatchOrder: { select: { date: true } },
    },
  },
} as const satisfies Prisma.InboundLineSelect;

export type OperationsAssignedInboundLine =
  Prisma.InboundLineGetPayload<{
    select: typeof operationsAssignedInboundLineSelect;
  }>;

export async function fetchOperationsAssignedInboundLines(
  year: number,
  month: number
) {
  const { start, end } = getMonthDateRange(year, month);

  return prisma.inboundLine.findMany({
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
    select: operationsAssignedInboundLineSelect,
  });
}
