import { format } from "date-fns";
import { prisma } from "@/lib/prisma";

export async function generateDispatchNo(date: Date): Promise<string> {
  const dateStr = format(date, "yyyyMMdd");
  const prefix = `DO-${dateStr}-`;
  const count = await prisma.dispatchOrder.count({
    where: { dispatchNo: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}
