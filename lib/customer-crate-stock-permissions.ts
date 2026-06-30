import { getCurrentUser } from "@/lib/auth";
import type { AppUser, StoredUserRole } from "@/types";

/** Manual stock edits for operational (non-agent) customers — admin + 书记 clerk. */
export function canEditCustomerCrateStock(role: StoredUserRole): boolean {
  return role === "admin" || role === "clerk";
}

/** Agent create / join / remove / agent stock edits — admin only. */
export function canManageCrateStockAgents(role: StoredUserRole): boolean {
  return role === "admin";
}

export async function requireCustomerCrateStockEdit(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user || !canEditCustomerCrateStock(user.role)) {
    throw new Error("无权限 Unauthorized");
  }
  return user;
}

export async function requireCrateStockAgentAdmin(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user || !canManageCrateStockAgents(user.role)) {
    throw new Error("无权限 Unauthorized");
  }
  return user;
}
