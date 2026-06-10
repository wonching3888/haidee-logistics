import { prisma } from "@/lib/prisma";
import { toDateInputValue } from "@/lib/inbound-utils";

export async function generateDispatchNo(date: Date): Promise<string> {
  const dateStr = toDateInputValue(date).replace(/-/g, "");
  const prefix = `DO-${dateStr}-`;
  const count = await prisma.dispatchOrder.count({
    where: { dispatchNo: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}
