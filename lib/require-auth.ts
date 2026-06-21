import { getCurrentUser } from "@/lib/auth";
import { canWrite } from "@/lib/auth-roles";
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

/** Require a role that may write business data. Not wired into actions yet. */
export async function requireWrite(): Promise<AppUser> {
  const user = await requireUser();
  if (!canWrite(user.role)) {
    throw new Error("无权限 Unauthorized");
  }
  return user;
}
