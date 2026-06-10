import { prisma } from "@/lib/prisma";

export { formatDODate, paginateRows, ROWS_PER_PAGE } from "@/lib/document-utils";

export async function getDONumber(dispatchOrderId: string): Promise<string> {
  const order = await prisma.dispatchOrder.findUnique({
    where: { id: dispatchOrderId },
    select: { createdAt: true },
  });
  if (!order) return "D0000000";

  const count = await prisma.dispatchOrder.count({
    where: { createdAt: { lte: order.createdAt } },
  });
  return `D${String(24459 + count).padStart(7, "0")}`;
}
