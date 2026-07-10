import { toDateInputValue } from "@/lib/date-utils";
import { prisma } from "@/lib/prisma";

export async function nextReceiptVoucherNo(voucherDate: Date): Promise<string> {
  const dateStr = toDateInputValue(voucherDate).replace(/-/g, "");
  const prefix = `RV-${dateStr}-`;
  const latest = await prisma.cashBookReceiptVoucher.findFirst({
    where: { voucherNo: { startsWith: prefix } },
    orderBy: { voucherNo: "desc" },
    select: { voucherNo: true },
  });

  let seq = 1;
  if (latest) {
    const tail = latest.voucherNo.slice(prefix.length);
    const parsed = Number(tail);
    if (Number.isFinite(parsed)) seq = parsed + 1;
  }

  return `${prefix}${String(seq).padStart(3, "0")}`;
}
