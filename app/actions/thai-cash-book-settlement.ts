"use server";

import { getCurrentUser } from "@/lib/auth";
import { canAccessCashBook } from "@/lib/auth-roles";
import {
  isThaiSettlementLinkedPaymentVoucher,
  listThaiSettlementPendingConfirm,
  type ThaiSettlementPendingConfirmItem,
} from "@/lib/cash-book/thai-cash-book-settlement";

async function requireCashBookRead() {
  const user = await getCurrentUser();
  if (!user || !canAccessCashBook(user.role)) {
    throw new Error("无权限 Unauthorized");
  }
  return user;
}

export async function getThaiSettlementPendingConfirm(input?: {
  fromDate?: string;
  toDate?: string;
}): Promise<ThaiSettlementPendingConfirmItem[]> {
  await requireCashBookRead();
  return listThaiSettlementPendingConfirm(input);
}

export async function getPaymentVoucherThaiSettlementLink(
  paymentVoucherId: string
): Promise<boolean> {
  await requireCashBookRead();
  return isThaiSettlementLinkedPaymentVoucher(paymentVoucherId);
}
