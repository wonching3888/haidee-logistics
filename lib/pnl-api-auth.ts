import { getCurrentUser } from "@/lib/auth";
import { canViewOperationsDashboard } from "@/lib/auth-roles";
import type { UserRole } from "@/types";

export async function requirePnlApiAccess() {
  const user = await getCurrentUser();
  if (!user || !canViewOperationsDashboard(user.role as UserRole)) {
    return null;
  }
  return user;
}
