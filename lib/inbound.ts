import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toDateInputValue } from "@/lib/inbound-utils";

export const SESSION_NO_MAX_RETRIES = 5;

export type { InboundLineInput } from "@/lib/inbound-utils";
export {
  computeMarketTotals,
  formatInboundDate,
  toDateInputValue,
  parseDateInput,
} from "@/lib/inbound-utils";

export function isSessionNoUniqueViolation(error: unknown): boolean {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    (error as { code: string }).code !== "P2002"
  ) {
    return false;
  }

  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  if (!Array.isArray(target)) return false;

  return target.some(
    (field) => field === "session_no" || field === "sessionNo"
  );
}

export async function generateSessionNo(
  date: Date,
  tx: Prisma.TransactionClient = prisma
): Promise<string> {
  const dateStr = toDateInputValue(date).replace(/-/g, "");
  const prefix = `IN-${dateStr}-`;

  const existing = await tx.inboundSession.findMany({
    where: { sessionNo: { startsWith: prefix } },
    select: { sessionNo: true },
  });

  let next = 1;
  for (const { sessionNo } of existing) {
    if (!sessionNo) continue;
    const parsed = parseInt(sessionNo.slice(prefix.length), 10);
    if (!Number.isNaN(parsed) && parsed >= next) {
      next = parsed + 1;
    }
  }

  return `${prefix}${String(next).padStart(3, "0")}`;
}
