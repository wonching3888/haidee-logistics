import { prisma } from "@/lib/prisma";
import { toDateInputValue } from "@/lib/date-utils";

export async function generateCharterNo(date: Date): Promise<string> {
  const dateStr = toDateInputValue(date).replace(/-/g, "");
  const prefix = `CH-${dateStr}-`;
  const count = await prisma.charterTrip.count({
    where: { charterNo: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}
