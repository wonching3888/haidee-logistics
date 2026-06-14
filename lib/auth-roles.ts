import type { UserRole } from "@/types";

export const USER_ROLES: UserRole[] = ["admin", "clerk", "accounting", "owner"];

export function isUserRole(value: string): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}

/** Operation clerk — cannot view freight billing details */
export function isOperationClerk(role: UserRole) {
  return role === "clerk";
}

export function canViewFreightInfo(role: UserRole) {
  return role === "admin" || role === "accounting" || role === "owner";
}

export function canAccessSettings(role: UserRole) {
  return role === "admin";
}

export function canAccessDriverPayroll(role: UserRole) {
  return role === "admin" || role === "accounting";
}

export function getRoleLabel(role: UserRole) {
  switch (role) {
    case "admin":
      return "管理员 Admin";
    case "accounting":
      return "会计 Accounting";
    case "owner":
      return "老板 Owner";
    default:
      return "书记 Operation";
  }
}
