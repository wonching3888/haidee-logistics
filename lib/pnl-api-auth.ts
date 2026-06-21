import { getCurrentUser } from "@/lib/auth";
import { canViewPnlOperations } from "@/lib/auth-roles";
import type { UserRole } from "@/types";

export async function requirePnlApiAccess() {
  const user = await getCurrentUser();
  if (!user || !canViewPnlOperations(user.role as UserRole)) {
    return null;
  }
  return user;
}
