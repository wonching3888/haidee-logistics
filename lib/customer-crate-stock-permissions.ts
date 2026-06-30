import { getCurrentUser } from "@/lib/auth";
import type { AppUser, StoredUserRole } from "@/types";

/** Customer crate stock page — agent management + manual stock edits (admin + 书记 clerk). */
export function canEditCustomerCrateStock(role: StoredUserRole): boolean {
  return role === "admin" || role === "clerk";
}

export async function requireCustomerCrateStockEdit(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user || !canEditCustomerCrateStock(user.role)) {
    throw new Error("无权限 Unauthorized");
  }
  return user;
}
