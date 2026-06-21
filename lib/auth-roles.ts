import type { LegacyUserRole, StoredUserRole, UserRole } from "@/types";

/** Roles selectable when creating/editing users in Settings. */
export const USER_ROLES: UserRole[] = [
  "admin",
  "clerk",
  "thai_accounting",
  "my_accounting",
  "viewer",
];

/** Deprecated values that may still exist in the database. */
export const LEGACY_USER_ROLES: LegacyUserRole[] = ["accounting", "owner"];

export const ALL_STORED_USER_ROLES: StoredUserRole[] = [
  ...USER_ROLES,
  ...LEGACY_USER_ROLES,
];

export function isUserRole(value: string): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}

export function isLegacyUserRole(value: string): value is LegacyUserRole {
  return LEGACY_USER_ROLES.includes(value as LegacyUserRole);
}

export function isStoredUserRole(value: string): value is StoredUserRole {
  return isUserRole(value) || isLegacyUserRole(value);
}

/** Operation clerk — cannot view freight billing details */
export function isOperationClerk(role: StoredUserRole) {
  return role === "clerk";
}

// ─── Permission matrix (canonical 5 roles) ─────────────────────────────────
// Legacy `accounting` / `owner` are handled separately on legacy can* helpers below.
// These functions define the target model; pages/actions are not wired to them yet.

/** admin/clerk/thai_acct/my_acct ✓ · viewer ✗ · legacy accounting ✓ · legacy owner ✗ */
export function canWrite(role: StoredUserRole): boolean {
  switch (role) {
    case "admin":
    case "clerk":
    case "thai_accounting":
    case "my_accounting":
    case "accounting":
      return true;
    case "viewer":
    case "owner":
      return false;
    default:
      return false;
  }
}

/** admin/my_acct ✓ · clerk/thai_acct/viewer ✗ */
export function canViewFreightOnEntry(role: StoredUserRole): boolean {
  switch (role) {
    case "admin":
    case "my_accounting":
      return true;
    case "clerk":
    case "thai_accounting":
    case "viewer":
      return false;
    default:
      return false;
  }
}

/** admin/thai_acct/my_acct ✓ · clerk partial (see note) · viewer ✗ */
export function canAccessAllDocuments(role: StoredUserRole): boolean {
  switch (role) {
    case "admin":
    case "thai_accounting":
    case "my_accounting":
      return true;
    case "clerk":
      // Partial: operational D/O docs only — enforced today via existing routes, not this flag.
      return false;
    case "viewer":
      return false;
    default:
      return false;
  }
}

/** admin/thai/my ✓ · clerk/viewer/owner ✗ · legacy accounting ✓ */
export function canViewInvoiceAmounts(role: StoredUserRole): boolean {
  switch (role) {
    case "admin":
    case "thai_accounting":
    case "my_accounting":
    case "accounting":
      return true;
    case "clerk":
    case "viewer":
    case "owner":
      return false;
    default:
      return false;
  }
}

/** admin/my/viewer ✓ · clerk/thai ✗ · legacy owner/accounting ✓ (owner read-only) */
export function canViewPnlOperations(role: StoredUserRole): boolean {
  switch (role) {
    case "admin":
    case "my_accounting":
    case "viewer":
    case "owner":
    case "accounting":
      return true;
    case "clerk":
    case "thai_accounting":
      return false;
    default:
      return false;
  }
}

/** admin/my ✓ · all others ✗ · legacy accounting ✓ */
export function canViewDriverPayroll(role: StoredUserRole): boolean {
  switch (role) {
    case "admin":
    case "my_accounting":
    case "accounting":
      return true;
    case "clerk":
    case "thai_accounting":
    case "viewer":
    case "owner":
      return false;
    default:
      return false;
  }
}

/** admin only */
export function canAccessSettings(role: StoredUserRole): boolean {
  return role === "admin";
}

// ─── Legacy compatibility (still used by pages/actions today) ────────────────

export function canViewFreightInfo(role: StoredUserRole) {
  return (
    role === "admin" ||
    role === "accounting" ||
    role === "owner" ||
    role === "my_accounting"
  );
}

export function canAccessDriverPayroll(role: StoredUserRole) {
  return (
    role === "admin" || role === "accounting" || role === "my_accounting"
  );
}

export function canViewOperationsDashboard(role: StoredUserRole) {
  return (
    role === "admin" ||
    role === "accounting" ||
    role === "owner" ||
    role === "my_accounting" ||
    role === "viewer"
  );
}

export function getRoleLabel(role: StoredUserRole) {
  switch (role) {
    case "admin":
      return "管理员 Admin";
    case "clerk":
      return "书记 Operation";
    case "thai_accounting":
      return "泰国会计 Thai Accounting";
    case "my_accounting":
      return "马来西亚会计 MY Accounting";
    case "viewer":
      return "只读 Viewer";
    case "accounting":
      return "会计 Accounting (legacy)";
    case "owner":
      return "老板 Owner (legacy)";
    default:
      return role;
  }
}
