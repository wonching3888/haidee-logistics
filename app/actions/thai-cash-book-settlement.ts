"use server";

import { getCurrentUser } from "@/lib/auth";
import { canAccessCashBook, canWriteCashBook } from "@/lib/auth-roles";
import {
  listThaiDriverTripSettlementTodos,
  listThaiHandlingSettlementTodos,
  listThaiSettlementPendingConfirm,
  settleThaiDriverTripDay,
  settleThaiHandlingDay,
  type ThaiDriverTripTodoItem,
  type ThaiHandlingStation,
  type ThaiHandlingTodoItem,
  type ThaiSettlementPendingConfirmItem,
} from "@/lib/cash-book/thai-cash-book-settlement";
import { revalidatePath } from "next/cache";

async function requireCashBookWrite() {
  const user = await getCurrentUser();
  if (!user || !canAccessCashBook(user.role)) {
    throw new Error("无权限 Unauthorized");
  }
  if (!canWriteCashBook(user.role)) {
    throw new Error("无写入权限 Unauthorized");
  }
  return user;
}

async function requireCashBookRead() {
  const user = await getCurrentUser();
  if (!user || !canAccessCashBook(user.role)) {
    throw new Error("无权限 Unauthorized");
  }
  return user;
}

export async function getThaiHandlingSettlementTodos(input?: {
  fromDate?: string;
  toDate?: string;
}): Promise<ThaiHandlingTodoItem[]> {
  await requireCashBookRead();
  return listThaiHandlingSettlementTodos(input);
}

export async function getThaiDriverTripSettlementTodos(input?: {
  fromDate?: string;
  toDate?: string;
}): Promise<ThaiDriverTripTodoItem[]> {
  await requireCashBookRead();
  return listThaiDriverTripSettlementTodos(input);
}

export async function getThaiSettlementPendingConfirm(input?: {
  fromDate?: string;
  toDate?: string;
}): Promise<ThaiSettlementPendingConfirmItem[]> {
  await requireCashBookRead();
  return listThaiSettlementPendingConfirm(input);
}

export async function settleThaiHandlingDayAction(input: {
  station: ThaiHandlingStation;
  id: string;
}): Promise<{ ok: true; voucherNo: string; paymentVoucherId: string } | { ok: false; error: string }> {
  try {
    const user = await requireCashBookWrite();
    const result = await settleThaiHandlingDay({
      station: input.station,
      id: input.id,
      actorUserId: user.id,
    });
    revalidatePath("/financial/cash-book/thai-settlement");
    return { ok: true, ...result };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "结账失败",
    };
  }
}

export async function settleThaiDriverTripDayAction(input: {
  id: string;
}): Promise<{ ok: true; voucherNo: string; paymentVoucherId: string } | { ok: false; error: string }> {
  try {
    const user = await requireCashBookWrite();
    const result = await settleThaiDriverTripDay({
      id: input.id,
      actorUserId: user.id,
    });
    revalidatePath("/financial/cash-book/thai-settlement");
    return { ok: true, ...result };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "结账失败",
    };
  }
}

export async function settleThaiHandlingDaysBulkAction(input: {
  items: Array<{ station: ThaiHandlingStation; id: string }>;
}): Promise<{
  ok: true;
  settled: Array<{ id: string; voucherNo: string }>;
  errors: Array<{ id: string; error: string }>;
}> {
  const user = await requireCashBookWrite();
  const settled: Array<{ id: string; voucherNo: string }> = [];
  const errors: Array<{ id: string; error: string }> = [];
  for (const item of input.items) {
    try {
      const result = await settleThaiHandlingDay({
        station: item.station,
        id: item.id,
        actorUserId: user.id,
      });
      settled.push({ id: item.id, voucherNo: result.voucherNo });
    } catch (e) {
      errors.push({
        id: item.id,
        error: e instanceof Error ? e.message : "结账失败",
      });
    }
  }
  revalidatePath("/financial/cash-book/thai-settlement");
  return { ok: true, settled, errors };
}

export async function settleThaiDriverTripDaysBulkAction(input: {
  ids: string[];
}): Promise<{
  ok: true;
  settled: Array<{ id: string; voucherNo: string }>;
  errors: Array<{ id: string; error: string }>;
}> {
  const user = await requireCashBookWrite();
  const settled: Array<{ id: string; voucherNo: string }> = [];
  const errors: Array<{ id: string; error: string }> = [];
  for (const id of input.ids) {
    try {
      const result = await settleThaiDriverTripDay({
        id,
        actorUserId: user.id,
      });
      settled.push({ id, voucherNo: result.voucherNo });
    } catch (e) {
      errors.push({
        id,
        error: e instanceof Error ? e.message : "结账失败",
      });
    }
  }
  revalidatePath("/financial/cash-book/thai-settlement");
  return { ok: true, settled, errors };
}
