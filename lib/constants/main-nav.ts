import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  PackageSearch,
  FileText,
  Package,
  History,
} from "lucide-react";

export interface MainNavLink {
  href: string;
  label: string;
  labelEn: string;
}

export interface MainNavGroup {
  id: string;
  label: string;
  labelEn: string;
  icon: LucideIcon;
  children: MainNavLink[];
}

export const MAIN_NAV_DASHBOARD: MainNavLink & { icon: LucideIcon } = {
  href: "/dashboard",
  label: "总览",
  labelEn: "Dashboard",
  icon: LayoutDashboard,
};

export const MAIN_NAV_OPERATIONS: MainNavGroup = {
  id: "operations",
  label: "物流操作",
  labelEn: "Operations",
  icon: PackageSearch,
  children: [
    { href: "/inbound", label: "进货录入", labelEn: "Inbound" },
    { href: "/dispatch", label: "派车调度", labelEn: "Dispatch" },
    { href: "/charter", label: "包车", labelEn: "Charter" },
    { href: "/summary", label: "每日总单", labelEn: "Daily Summary" },
    { href: "/search", label: "查询", labelEn: "Search" },
  ],
};

export const MAIN_NAV_DOCUMENTS_GENERATE: MainNavLink = {
  href: "/documents",
  label: "文件生成",
  labelEn: "Documents",
};

export const MAIN_NAV_DOCUMENTS_MONTHLY_INVOICE: MainNavLink = {
  href: "/documents/monthly-invoice",
  label: "月结账单",
  labelEn: "Monthly Invoice",
};

export const MAIN_NAV_DOCUMENTS_DRIVER_EXPENSES: MainNavLink = {
  href: "/documents/driver-expenses",
  label: "司机费用单",
  labelEn: "Driver Expenses",
};

export const MAIN_NAV_DOCUMENTS_PARTNER_TRIP_INVOICE: MainNavLink = {
  href: "/documents/partner-trip-invoice",
  label: "合作伙伴车力单",
  labelEn: "Partner Trip Invoice",
};

export const MAIN_NAV_DOCUMENTS_CRATE_RETURN_INVOICE: MainNavLink = {
  href: "/documents/crate-return-invoice",
  label: "回收桶月结单",
  labelEn: "Crate Return Invoice",
};

export const MAIN_NAV_DOCUMENTS: MainNavGroup = {
  id: "documents",
  label: "文件",
  labelEn: "Documents",
  icon: FileText,
  children: [
    MAIN_NAV_DOCUMENTS_GENERATE,
    MAIN_NAV_DOCUMENTS_MONTHLY_INVOICE,
    MAIN_NAV_DOCUMENTS_PARTNER_TRIP_INVOICE,
    MAIN_NAV_DOCUMENTS_CRATE_RETURN_INVOICE,
    MAIN_NAV_DOCUMENTS_DRIVER_EXPENSES,
  ],
};

export const MAIN_NAV_CRATE: MainNavGroup = {
  id: "crate",
  label: "桶管理",
  labelEn: "Crate Management",
  icon: Package,
  children: [
    { href: "/crate/import", label: "空桶回收", labelEn: "Crate Import" },
    { href: "/crate/export", label: "空桶归还", labelEn: "Crate Export" },
    { href: "/crate/stock", label: "桶库存", labelEn: "Crate Stock" },
    {
      href: "/crate/customer-stock",
      label: "顾客桶库存",
      labelEn: "Customer Crate Stock",
    },
  ],
};

export const MAIN_NAV_REPORTS_CRATE_RENTAL: MainNavLink = {
  href: "/reports/crate-rental",
  label: "租桶月结",
  labelEn: "Crate Rental Statement",
};

export const MAIN_NAV_REPORTS_BASE: MainNavLink[] = [
  { href: "/reports/market", label: "市场报表", labelEn: "Market Report" },
  { href: "/reports/crate", label: "桶型报表", labelEn: "Crate Report" },
  MAIN_NAV_REPORTS_CRATE_RENTAL,
];

export const MAIN_NAV_REPORTS_OPERATIONS: MainNavLink = {
  href: "/operations",
  label: "运营报表",
  labelEn: "Operations",
};

export const MAIN_NAV_REPORTS_PNL: MainNavLink = {
  href: "/reports/pnl",
  label: "损益分析",
  labelEn: "P&L Analysis",
};

export const MAIN_NAV_REPORTS_DRIVER_PAYROLL: MainNavLink = {
  href: "/driver-payroll",
  label: "司机薪资",
  labelEn: "Driver Payroll",
};

export const MAIN_NAV_HISTORY: MainNavLink & { icon: LucideIcon } = {
  href: "/history",
  label: "修改记录",
  labelEn: "History",
  icon: History,
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
