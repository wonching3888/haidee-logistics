"use server";

import { getCurrentUser } from "@/lib/auth";
import { canViewFreightInfo } from "@/lib/auth-roles";
import {
  findUnpricedInboundLines,
  type UnpricedInboundLine,
} from "@/lib/unpriced-inbound";
import type { UserRole } from "@/types";

async function requireFreightViewer() {
  const user = await getCurrentUser();
  if (!user || !canViewFreightInfo(user.role as UserRole)) {
    throw new Error("无权限查看未定价行 Unauthorized");
  }
  return user;
}

function parseYearMonth(year: number, month: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("无效年份 Invalid year");
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("无效月份 Invalid month");
  }
}

export async function getUnpricedInboundForMonth(
  year: number,
  month: number
): Promise<{ lines: UnpricedInboundLine[]; count: number }> {
  await requireFreightViewer();
  parseYearMonth(year, month);
  const lines = await findUnpricedInboundLines({ year, month });
  return { lines, count: lines.length };
}
