"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  LayoutDashboard,
  PackageSearch,
  TableProperties,
  BarChart3,
  Truck,
  FileText,
  Download,
  Upload,
  Package,
  History,
  Search,
  Settings,
  Users,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SettingsSidebarMenu } from "@/components/shared/SettingsSidebarMenu";
import type { UserRole } from "@/types";

interface NavItem {
  href: string;
  label: string;
  labelEn: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

interface NavLinkChild {
  href: string;
  label: string;
  labelEn: string;
  isActive: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "总览", labelEn: "Dashboard", icon: LayoutDashboard },
  { href: "/inbound", label: "进货录入", labelEn: "Inbound", icon: PackageSearch },
  { href: "/summary", label: "每日总单", labelEn: "Daily Summary", icon: TableProperties },
  { href: "/search", label: "查询", labelEn: "Search", icon: Search },
  { href: "/dispatch", label: "派车调度", labelEn: "Dispatch", icon: Truck },
  { href: "/documents", label: "文件生成", labelEn: "Documents", icon: FileText },
  { href: "/crate/import", label: "空桶回收", labelEn: "Crate Import", icon: Download },
  { href: "/crate/export", label: "空桶归还", labelEn: "Crate Export", icon: Upload },
  { href: "/crate/stock", label: "桶库存", labelEn: "Crate Stock", icon: Package },
  {
    href: "/crate/customer-stock",
    label: "顾客桶库存",
    labelEn: "Customer Crate Stock",
    icon: Users,
  },
  { href: "/history", label: "修改记录", labelEn: "History", icon: History },
];

const REPORTS_CHILDREN: Omit<NavLinkChild, "isActive">[] = [
  { href: "/reports/market", label: "市场报表", labelEn: "Market Report" },
  { href: "/reports/crate", label: "桶型报表", labelEn: "Crate Report" },
];

interface SidebarProps {
  role: UserRole;
  isOpen?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ role, isOpen = false, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || role === "admin");
  const isAdmin = role === "admin";

  const reportsActive = pathname.startsWith("/reports/");
  const [reportsOpen, setReportsOpen] = useState(reportsActive);

  const settingsActive = pathname.startsWith("/settings");
  const [settingsOpen, setSettingsOpen] = useState(settingsActive);

  useEffect(() => {
    if (reportsActive) {
      setReportsOpen(true);
    }
  }, [reportsActive]);

  useEffect(() => {
    if (settingsActive) {
      setSettingsOpen(true);
    }
  }, [settingsActive]);

  const summaryIndex = items.findIndex((item) => item.href === "/summary");
  const beforeReports = items.slice(0, summaryIndex + 1);
  const afterReports = items.slice(summaryIndex + 1);

  return (
    <aside
      className={cn(
        "flex h-full w-60 shrink-0 flex-col bg-haidee-navy text-white shadow-lg",
        "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:transition-transform max-md:duration-300",
        isOpen ? "max-md:translate-x-0" : "max-md:-translate-x-full",
        "md:relative md:translate-x-0"
      )}
    >
      <div className="border-b border-white/10 px-5 py-5">
        <p className="text-sm font-semibold leading-tight">海利物流有限公司</p>
        <p className="mt-0.5 text-xs text-white/60">HAI DEE LOGISTICS CO.,LTD</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="m-0 list-none space-y-1 p-0">
          {beforeReports.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          ))}

          <ExpandableNavGroup
            label="报表"
            labelEn="Reports"
            icon={BarChart3}
            open={reportsOpen}
            onToggle={() => setReportsOpen((open) => !open)}
            groupActive={reportsActive}
            onNavigate={onNavigate}
            items={REPORTS_CHILDREN.map((child) => ({
              ...child,
              isActive:
                pathname === child.href ||
                pathname.startsWith(`${child.href}/`),
            }))}
          />

          {afterReports.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          ))}

          {isAdmin && (
            <ExpandableNavGroup
              label="系统设置"
              labelEn="Settings"
              icon={Settings}
              open={settingsOpen}
              onToggle={() => setSettingsOpen((open) => !open)}
              groupActive={settingsActive}
              onNavigate={onNavigate}
              submenu={
                <Suspense fallback={null}>
                  <SettingsSidebarMenu onNavigate={onNavigate} />
                </Suspense>
              }
            />
          )}
        </ul>
      </nav>

      <div className="border-t border-white/10 px-5 py-4">
        <p className="text-center text-[10px] text-white/40">
          © 2026 DMC SYSTEM
          <br />
          All Rights Reserved.
        </p>
      </div>
    </aside>
  );
}

function ExpandableNavGroup({
  label,
  labelEn,
  icon: Icon,
  open,
  onToggle,
  groupActive,
  items,
  submenu,
  onNavigate,
}: {
  label: string;
  labelEn: string;
  icon: React.ComponentType<{ className?: string }>;
  open: boolean;
  onToggle: () => void;
  groupActive: boolean;
  items?: NavLinkChild[];
  submenu?: React.ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
          groupActive
            ? "bg-haidee-accent/20 text-haidee-accent"
            : "text-white/75 hover:bg-white/10 hover:text-white"
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="flex-1 text-left">
          {label} <span className="text-xs text-white/50">{labelEn}</span>
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />
        )}
      </button>

      {open &&
        (submenu ??
          (items && (
            <ul className="m-0 mt-1 list-none space-y-1 p-0 pl-4">
              {items.map((child) => (
                <li key={child.href}>
                  <SidebarSubLink
                    href={child.href}
                    label={child.label}
                    labelEn={child.labelEn}
                    isActive={child.isActive}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          )))}
    </li>
  );
}

function SidebarSubLink({
  href,
  label,
  labelEn,
  isActive,
  onNavigate,
}: NavLinkChild & { onNavigate?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex min-h-[40px] items-center rounded-lg px-3 py-2 text-sm transition-colors",
        isActive
          ? "bg-haidee-accent/20 text-haidee-accent"
          : "text-white/70 hover:bg-white/10 hover:text-white"
      )}
    >
      <span>
        {label} <span className="text-xs text-white/50">{labelEn}</span>
      </span>
    </Link>
  );
}

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const isActive =
    pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        className={cn(
          "flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
          isActive
            ? "bg-haidee-accent/20 text-haidee-accent"
            : "text-white/75 hover:bg-white/10 hover:text-white"
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span>
          {item.label}{" "}
          <span className="text-xs text-white/50">{item.labelEn}</span>
        </span>
      </Link>
    </li>
  );
}
