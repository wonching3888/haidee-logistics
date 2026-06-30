import { getCurrentUser } from "@/lib/auth";
import type { AppUser, StoredUserRole } from "@/types";

/** SADAO gate absolute stock adjustments (/tong/stock edit) — admin only. */
export function canAdjustSadaoGateStock(role: StoredUserRole): boolean {
  return role === "admin";
}

export async function requireSadaoGateStockAdmin(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user || !canAdjustSadaoGateStock(user.role)) {
    throw new Error("无权限 Unauthorized");
  }
  return user;
}
