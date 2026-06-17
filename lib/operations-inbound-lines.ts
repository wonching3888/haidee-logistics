import { prisma } from "@/lib/prisma";
import { getMonthDateRange } from "@/lib/reports/period-report-shared";

export const operationsAssignedInboundLineSelect = {
  stallId: true,
  tongTypeId: true,
  quantity: true,
  mcDeliveryMode: true,
  freightAmount: true,
  currency: true,
  paymentMode: true,
  tongType: { select: { isBox: true } },
  stall: { select: { market: { select: { code: true } } } },
  session: {
    select: {
      shipperId: true,
      pickupLocation: true,
      shipper: {
        select: { code: true, name: true, pickupLocation: true },
      },
    },
  },
} as const;

export type OperationsAssignedInboundLine = Awaited<
  ReturnType<typeof fetchOperationsAssignedInboundLines>
>[number];

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
