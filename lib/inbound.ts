import { format } from "date-fns";
import { prisma } from "@/lib/prisma";

export type { InboundLineInput } from "@/lib/inbound-utils";
export {
  computeMarketTotals,
  formatInboundDate,
  toDateInputValue,
  parseDateInput,
} from "@/lib/inbound-utils";

export async function generateSessionNo(date: Date): Promise<string> {
  const dateStr = format(date, "yyyyMMdd");
  const prefix = `IN-${dateStr}-`;
  const count = await prisma.inboundSession.count({
    where: {
      sessionNo: { startsWith: prefix },
      status: "confirmed",
    },
  });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}
