import { prisma } from "@/lib/prisma";
import { toDateInputValue } from "@/lib/inbound-utils";

export type { InboundLineInput } from "@/lib/inbound-utils";
export {
  computeMarketTotals,
  formatInboundDate,
  toDateInputValue,
  parseDateInput,
} from "@/lib/inbound-utils";

export async function generateSessionNo(date: Date): Promise<string> {
  const dateStr = toDateInputValue(date).replace(/-/g, "");
  const prefix = `IN-${dateStr}-`;
  const count = await prisma.inboundSession.count({
    where: {
      sessionNo: { startsWith: prefix },
      status: "confirmed",
    },
  });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}
