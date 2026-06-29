import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ClipboardList,
  PackageSearch,
  FileText,
  Package,
  History,
  Settings,
  BarChart3,
  Landmark,
} from "lucide-react";
import type { MessageKey } from "@/lib/i18n/messages";

export interface MainNavLink {
  href: string;
  messageKey: MessageKey;
}

export interface MainNavGroup {
  id: string;
  messageKey: MessageKey;
  icon: LucideIcon;
  children: MainNavLink[];
}

export const MAIN_NAV_DASHBOARD: MainNavLink & { icon: LucideIcon } = {
  href: "/dashboard",
  messageKey: "nav.dashboard",
  icon: LayoutDashboard,
};

export const MAIN_NAV_SUMMARY: MainNavLink & { icon: LucideIcon } = {
  href: "/summary",
  messageKey: "nav.summary",
  icon: ClipboardList,
};

export const MAIN_NAV_OPERATIONS: MainNavGroup = {
  id: "operations",
  messageKey: "nav.operations",
  icon: PackageSearch,
  children: [
    { href: "/inbound", messageKey: "nav.inbound" },
    { href: "/dispatch", messageKey: "nav.dispatch" },
    { href: "/charter", messageKey: "nav.charter" },
    { href: "/search", messageKey: "nav.search" },
  ],
};

export const MAIN_NAV_DOCUMENTS_GENERATE: MainNavLink = {
  href: "/documents",
  messageKey: "nav.documentsGenerate",
};

export const MAIN_NAV_DOCUMENTS_MONTHLY_INVOICE: MainNavLink = {
  href: "/documents/monthly-invoice",
  messageKey: "nav.monthlyInvoice",
};

export const MAIN_NAV_FINANCIAL_DRIVER_EXPENSES: MainNavLink = {
  href: "/documents/driver-expenses",
  messageKey: "nav.driverExpenses",
};

/** @deprecated Use MAIN_NAV_FINANCIAL_DRIVER_EXPENSES */
export const MAIN_NAV_DOCUMENTS_DRIVER_EXPENSES = MAIN_NAV_FINANCIAL_DRIVER_EXPENSES;

export const MAIN_NAV_DOCUMENTS_PARTNER_TRIP_INVOICE: MainNavLink = {
  href: "/documents/partner-trip-invoice",
  messageKey: "nav.partnerTripInvoice",
};

export const MAIN_NAV_DOCUMENTS_CRATE_RETURN_INVOICE: MainNavLink = {
  href: "/documents/crate-return-invoice",
  messageKey: "nav.crateReturnInvoice",
};

export const MAIN_NAV_DOCUMENTS: MainNavGroup = {
  id: "documents",
  messageKey: "nav.documents",
  icon: FileText,
  children: [
    MAIN_NAV_DOCUMENTS_GENERATE,
    MAIN_NAV_DOCUMENTS_MONTHLY_INVOICE,
    MAIN_NAV_DOCUMENTS_PARTNER_TRIP_INVOICE,
    MAIN_NAV_DOCUMENTS_CRATE_RETURN_INVOICE,
  ],
};

export const MAIN_NAV_FINANCIAL_DRIVER_PAYROLL: MainNavLink = {
  href: "/driver-payroll",
  messageKey: "nav.driverPayroll",
};

/** @deprecated Use MAIN_NAV_FINANCIAL_DRIVER_PAYROLL */
export const MAIN_NAV_REPORTS_DRIVER_PAYROLL = MAIN_NAV_FINANCIAL_DRIVER_PAYROLL;

export const MAIN_NAV_FINANCIAL_INVOICE_COLLECTIONS: MainNavLink = {
  href: "/financial/invoice-collections",
  messageKey: "nav.invoiceCollections",
};

export const MAIN_NAV_FINANCIAL_AUTOCOUNT_EXPORT: MainNavLink = {
  href: "/financial/autocount-export",
  messageKey: "nav.autocountExport",
};

export const MAIN_NAV_FINANCIAL_CONTROL: MainNavGroup = {
  id: "financial-control",
  messageKey: "nav.financialControl",
  icon: Landmark,
  children: [
    MAIN_NAV_FINANCIAL_DRIVER_EXPENSES,
    MAIN_NAV_FINANCIAL_DRIVER_PAYROLL,
    MAIN_NAV_FINANCIAL_INVOICE_COLLECTIONS,
    MAIN_NAV_FINANCIAL_AUTOCOUNT_EXPORT,
  ],
};

export const MAIN_NAV_CRATE: MainNavGroup = {
  id: "crate",
  messageKey: "nav.crate",
  icon: Package,
  children: [
    { href: "/crate/import", messageKey: "nav.crateImport" },
    { href: "/crate/export", messageKey: "nav.crateExport" },
    { href: "/crate/stock", messageKey: "nav.crateStock" },
    {
      href: "/crate/customer-stock",
      messageKey: "nav.customerCrateStock",
    },
  ],
};

export const MAIN_NAV_REPORTS_CRATE_RENTAL: MainNavLink = {
  href: "/reports/crate-rental",
  messageKey: "nav.crateRental",
};

export const MAIN_NAV_REPORTS_BASE: MainNavLink[] = [
  { href: "/reports/market", messageKey: "nav.marketReport" },
  { href: "/reports/crate", messageKey: "nav.crateReport" },
  MAIN_NAV_REPORTS_CRATE_RENTAL,
];

export const MAIN_NAV_REPORTS_OPERATIONS: MainNavLink = {
  href: "/operations",
  messageKey: "nav.operationsReport",
};

export const MAIN_NAV_REPORTS_PNL: MainNavLink = {
  href: "/reports/pnl",
  messageKey: "nav.pnl",
};

export const MAIN_NAV_REPORTS: MainNavGroup = {
  id: "reports",
  messageKey: "nav.reports",
  icon: BarChart3,
  children: [
    ...MAIN_NAV_REPORTS_BASE,
    MAIN_NAV_REPORTS_OPERATIONS,
    MAIN_NAV_REPORTS_PNL,
  ],
};

export const MAIN_NAV_HISTORY: MainNavLink & { icon: LucideIcon } = {
  href: "/history",
  messageKey: "nav.history",
  icon: History,
};

export const MAIN_NAV_SETTINGS: MainNavGroup = {
  id: "settings",
  messageKey: "nav.settings",
  icon: Settings,
  children: [{ href: "/settings", messageKey: "nav.settings" }],
};

export function isPathActive(pathname: string, href: string) {
  if (href === "/documents") {
    return (
      pathname === "/documents" ||
      (pathname.startsWith("/documents/") &&
        !pathname.startsWith("/documents/monthly-invoice") &&
        !pathname.startsWith("/documents/partner-trip-invoice") &&
        !pathname.startsWith("/documents/crate-return-invoice") &&
        !pathname.startsWith("/documents/driver-expenses"))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isGroupActive(pathname: string, group: MainNavGroup) {
  return group.children.some((child) => isPathActive(pathname, child.href));
}
