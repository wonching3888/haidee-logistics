import { getCurrentUser } from "@/lib/auth";
import {
  canAccessDriverExpenses,
  canViewPnlOperations,
  canWrite,
} from "@/lib/auth-roles";
import { canAccessHistory } from "@/lib/page-access";
import type { AppUser, UserRole } from "@/types";
/** Require any authenticated user. Not wired into actions yet. */
export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("未登录 Unauthorized");
  }
  return user;
}

/** Require one of the canonical roles. Not wired into actions yet. */
export async function requireRole(roles: UserRole[]): Promise<AppUser> {
  const user = await requireUser();
  if (!roles.includes(user.role as UserRole)) {
    throw new Error("无权限 Unauthorized");
  }
  return user;
}

/** Require a role that may write business data. */
export async function requireWrite(): Promise<AppUser> {
  const user = await requireUser();
  if (!canWrite(user.role)) {
    throw new Error("无权限 Unauthorized");
  }
  return user;
}

/** Require write permission for API routes. Returns null → caller returns 403. */
export async function requireWriteApi(): Promise<AppUser | null> {
  const user = await getCurrentUser();
  if (!user || !canWrite(user.role)) {
    return null;
  }
  return user;
}

/** Require driver-expenses module access for API routes. */
export async function requireDriverExpensesApi(): Promise<AppUser | null> {
  const user = await getCurrentUser();
  if (!user || !canAccessDriverExpenses(user.role)) {
    return null;
  }
  return user;
}

/** Require driver-expenses access plus write for API mutations. */
export async function requireDriverExpensesWriteApi(): Promise<AppUser | null> {
  const user = await requireDriverExpensesApi();
  if (!user || !canWrite(user.role)) {
    return null;
  }
  // Thai accounting: read-only on driver expenses until Step ④ wires save/transition UI.
  if (user.role === "thai_accounting") {
    return null;
  }
  return user;
}

/** Require P&L / operations dashboard read access. */
export async function requirePnlAccess(): Promise<AppUser> {
  const user = await requireUser();
  if (!canViewPnlOperations(user.role)) {
    throw new Error("无权限 Unauthorized");
  }
  return user;
}

/** Require modification history read access. */
export async function requireHistoryAccess(): Promise<AppUser> {
  const user = await requireUser();
  if (!canAccessHistory(user.role)) {
    throw new Error("无权限 Unauthorized");
  }
  return user;
}