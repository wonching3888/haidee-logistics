import {
  canAccessAutocountExport,
  canAccessCashBook,
  canAccessDriverExpenses,
  canAccessSettings,
  canAccessThaiCost,
  canAccessThaiCostMonthlySummary,
  canViewDriverPayroll,
  canViewStaffPayroll,
  canViewInvoiceAmounts,
  canViewInvoiceCollections,
  canViewPnlOperations,
  canWrite,
} from "@/lib/auth-roles";
import type { StoredUserRole } from "@/types";

/** Modification history — admin / MY accounting (+ legacy accounting). */
export function canAccessHistory(role: StoredUserRole): boolean {
  switch (role) {
    case "admin":
    case "my_accounting":
    case "accounting":
      return true;
    default:
      return false;
  }
}

export type PageAccessGate =
  | "authenticated"
  | "write"
  | "invoice"
  | "pnl"
  | "payroll"
  | "staff-payroll"
  | "settings"
  | "history"
  | "driver-expenses"
  | "invoice-collections"
  | "autocount-export"
  | "thai-cost"
  | "cash-book";

function normalizePathname(pathname: string): string {
  const path = pathname.split("?")[0].replace(/\/$/, "") || "/";
  return path;
}

const THAI_COST_MONTHLY_SUMMARY_PATHS = [
  "/thai-cost/sadao-summary",
  "/thai-cost/songkhla-summary",
  "/thai-cost/pattani-summary",
  "/thai-cost/monthly-summary",
] as const;

/** Clerk cannot access monthly summary tabs; thai_accounting/admin can. */
export function isThaiCostMonthlySummaryPath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return THAI_COST_MONTHLY_SUMMARY_PATHS.some(
    (p) => path === p || path.startsWith(`${p}/`)
  );
}

/** Resolve which access gate applies to a path under `(main)`. */
export function resolvePageGate(pathname: string): PageAccessGate | null {
  const path = normalizePathname(pathname);

  if (path === "/settings" || path.startsWith("/settings/")) {
    return "settings";
  }
  if (path === "/driver-payroll" || path.startsWith("/driver-payroll/")) {
    return "payroll";
  }
  if (path === "/staff-payroll" || path.startsWith("/staff-payroll/")) {
    return "staff-payroll";
  }
  if (path === "/history" || path.startsWith("/history/")) {
    return "history";
  }
  if (path.startsWith("/documents/driver-expenses")) {
    return "driver-expenses";
  }
  if (
    path === "/financial/invoice-collections" ||
    path.startsWith("/financial/invoice-collections/") ||
    path === "/financial/bank-reconciliation" ||
    path.startsWith("/financial/bank-reconciliation/")
  ) {
    return "invoice-collections";
  }
  if (
    path === "/financial/autocount-export" ||
    path.startsWith("/financial/autocount-export/")
  ) {
    return "autocount-export";
  }
  if (path === "/thai-cost" || path.startsWith("/thai-cost/")) {
    return "thai-cost";
  }
  if (
    path === "/financial/cash-book" ||
    path.startsWith("/financial/cash-book/")
  ) {
    return "cash-book";
  }

  if (
    path.startsWith("/documents/monthly-invoice") ||
    path.startsWith("/documents/partner-trip-invoice") ||
    path.startsWith("/documents/crate-return-invoice") ||
    /^\/charter\/[^/]+\/invoice(\/|$)/.test(path)
  ) {
    return "invoice";
  }

  if (path.startsWith("/documents/ar-invoice-listing")) {
    return "autocount-export";
  }

  if (
    path === "/dashboard" ||
    path.startsWith("/dashboard/") ||
    path === "/operations" ||
    path.startsWith("/operations/") ||
    path === "/reports/pnl" ||
    path.startsWith("/reports/pnl/") ||
    path === "/reports/market" ||
    path.startsWith("/reports/market/") ||
    path === "/reports/crate-rental" ||
    path.startsWith("/reports/crate-rental/") ||
    path === "/reports/crate" ||
    path.startsWith("/reports/crate/") ||
    path === "/reports/crate-return-market" ||
    path.startsWith("/reports/crate-return-market/") ||
    path === "/reports/crate-return-type" ||
    path.startsWith("/reports/crate-return-type/") ||
    path === "/market-report" ||
    path.startsWith("/market-report/")
  ) {
    return "pnl";
  }

  if (path === "/dispatch") {
    return "authenticated";
  }
  if (path.startsWith("/dispatch/")) {
    return "write";
  }
  if (path === "/summary" || path.startsWith("/summary/")) {
    return "authenticated";
  }

  if (
    path === "/crate/stock-anomalies" ||
    path.startsWith("/crate/stock-anomalies/")
  ) {
    return "settings";
  }

  if (
    path === "/inbound" ||
    path.startsWith("/inbound/") ||
    path === "/search" ||
    path.startsWith("/search/") ||
    path === "/crate" ||
    path.startsWith("/crate/") ||
    path === "/tong" ||
    path.startsWith("/tong/")
  ) {
    return "write";
  }

  if (path.startsWith("/charter")) {
    return "write";
  }

  if (path === "/documents" || path.startsWith("/documents/")) {
    return "write";
  }

  return null;
}

export function canAccessPage(role: StoredUserRole, pathname: string): boolean {
  const gate = resolvePageGate(pathname);
  if (gate === null) {
    return true;
  }

  switch (gate) {
    case "authenticated":
      return true;
    case "write":
      return canWrite(role);
    case "invoice":
      return canViewInvoiceAmounts(role);
    case "pnl":
      return canViewPnlOperations(role);
    case "payroll":
      return canViewDriverPayroll(role);
    case "staff-payroll":
      return canViewStaffPayroll(role);
    case "driver-expenses":
      return canAccessDriverExpenses(role);
    case "invoice-collections":
      return canViewInvoiceCollections(role);
    case "autocount-export":
      return canAccessAutocountExport(role);
    case "thai-cost":
      if (isThaiCostMonthlySummaryPath(pathname)) {
        return canAccessThaiCostMonthlySummary(role);
      }
      return canAccessThaiCost(role);
    case "cash-book":
      return canAccessCashBook(role);
    case "settings":
      return canAccessSettings(role);
    case "history":
      return canAccessHistory(role);
    default:
      return false;
  }
}

/** Filter sidebar / nav leaf items by the same rules as page access gates. */
export function filterNavItemsByAccess<T extends { href: string }>(
  role: StoredUserRole,
  items: readonly T[]
): T[] {
  return items.filter((item) => canAccessPage(role, item.href));
}

/** Return a nav group with accessible children only, or null if none remain. */
export function filterNavGroupByAccess<
  T extends { href: string },
  G extends { id: string; messageKey: string; icon: unknown; children: T[] },
>(role: StoredUserRole, group: G): (G & { children: T[] }) | null {
  const children = filterNavItemsByAccess(role, group.children);
  if (children.length === 0) {
    return null;
  }
  return { ...group, children };
}
