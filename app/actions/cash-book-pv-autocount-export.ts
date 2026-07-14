"use server";

import { getCurrentUser } from "@/lib/auth";
import { canAccessAutocountExport } from "@/lib/auth-roles";
import { loadCashBookPvAutocountExport } from "@/lib/cash-book/payment-voucher-autocount-export";
import type { UserRole } from "@/types";

async function requireCashBookPvExportAccess() {
  const user = await getCurrentUser();
  if (!user || !canAccessAutocountExport(user.role as UserRole)) {
    throw new Error("无 AutoCount 导出权限 Export access denied");
  }
  return user;
}

export async function exportCashBookPvAutocountCsvAction(input?: {
  fromDate?: string;
  toDate?: string;
}): Promise<{
  ok: true;
  csv: string;
  filename: string;
  rowCount: number;
  pendingAdvanceCount: number;
}> {
  await requireCashBookPvExportAccess();
  const result = await loadCashBookPvAutocountExport({
    fromDate: input?.fromDate?.trim() || undefined,
    toDate: input?.toDate?.trim() || undefined,
  });
  const stamp = new Date().toISOString().slice(0, 10);
  return {
    ok: true,
    csv: result.csv,
    filename: `cash-book-pv-autocount-${stamp}.csv`,
    rowCount: result.rows.length,
    pendingAdvanceCount: result.pendingAdvanceCount,
  };
}
