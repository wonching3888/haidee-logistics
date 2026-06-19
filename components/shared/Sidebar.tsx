"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useLayoutEffect, useMemo, useState } from "react";
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  FileText,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SettingsSidebarMenu } from "@/components/shared/SettingsSidebarMenu";
import type { UserRole } from "@/types";
import { canAccessDriverPayroll, canViewOperationsDashboard } from "@/lib/auth-roles";
import {
  MAIN_NAV_CRATE,
  MAIN_NAV_DASHBOARD,
  MAIN_NAV_HISTORY,
  MAIN_NAV_OPERATIONS,
  MAIN_NAV_REPORTS_BASE,
  MAIN_NAV_REPORTS_DRIVER_PAYROLL,
  MAIN_NAV_REPORTS_OPERATIONS,
  MAIN_NAV_REPORTS_PNL,
  isGroupActive,
  isPathActive,
  type MainNavGroup,
  type MainNavLink,
} from "@/lib/constants/main-nav";

/** Documents submenu rendered by Sidebar — keep all items in this file. */
const DOCUMENTS_SIDEBAR_CHILDREN: MainNavLink[] = [
  { href: "/documents", label: "文件生成", labelEn: "Documents" },
  {
    href: "/documents/monthly-invoice",
    label: "月结账单",
    labelEn: "Monthly Invoice",
  },
  {
    href: "/documents/partner-trip-invoice",
    label: "合作伙伴车力单",
    labelEn: "Partner Trip Invoice",
  },
  {
    href: "/documents/crate-return-invoice",
    label: "回收桶月结单",
    labelEn: "Crate Return Invoice",
  },
  {
    href: "/documents/driver-expenses",
    label: "司机费用单",
    labelEn: "Driver Expenses",
  },
];

const DOCUMENTS_SIDEBAR_GROUP: MainNavGroup = {
  id: "documents",
  label: "文件",
  labelEn: "Documents",
  icon: FileText,
  children: DOCUMENTS_SIDEBAR_CHILDREN,
};

const SIDEBAR_BG = "bg-[#9DC08B]";
const SIDEBAR_TEXT = "text-[#0d1a0d]";
const SIDEBAR_LABEL_MUTED = "text-[#0d1a0d] font-semibold";
const SIDEBAR_NAV_ACTIVE = "bg-[#5A8950] font-bold text-[#FFFFFF]";
const SIDEBAR_NAV_INACTIVE =
  "font-semibold text-[#0d1a0d] hover:bg-[#5A8950]/25 hover:text-[#0d1a0d]";
const SIDEBAR_ACTIVE_LABEL_MUTED = "text-[#FFFFFF] font-bold";

interface SidebarProps {
  role: UserRole;
  isOpen?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ role, isOpen = false, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const isAdmin = role === "admin";
  const showDriverPayroll = canAccessDriverPayroll(role);
  const showOperations = canViewOperationsDashboard(role);

  const navGroups = useMemo<MainNavGroup[]>(
    () => [
      MAIN_NAV_OPERATIONS,
      DOCUMENTS_SIDEBAR_GROUP,
      MAIN_NAV_CRATE,
      {
        id: "reports",
        label: "报表",
        labelEn: "Reports",
        icon: BarChart3,
        children: [
          ...MAIN_NAV_REPORTS_BASE,
          ...(showOperations
            ? [MAIN_NAV_REPORTS_OPERATIONS, MAIN_NAV_REPORTS_PNL]
            : []),
          ...(showDriverPayroll ? [MAIN_NAV_REPORTS_DRIVER_PAYROLL] : []),
        ],
      },
    ],
    [showDriverPayroll, showOperations]
  );

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useLayoutEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const group of navGroups) {
        if (isGroupActive(pathname, group)) {
          next[group.id] = true;
        }
      }
      if (pathname.startsWith("/settings")) {
        next.settings = true;
      }
      return next;
    });
  }, [pathname, navGroups]);

  function toggleGroup(id: string) {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <aside
      className={cn(
        "flex h-full w-60 shrink-0 flex-col shadow-lg",
        SIDEBAR_BG,
        SIDEBAR_TEXT,
        "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:transition-transform max-md:duration-300",
        isOpen ? "max-md:translate-x-0" : "max-md:-translate-x-full",
        "md:relative md:translate-x-0"
      )}
    >
      <div className="border-b border-[#1a2e1a]/15 px-6 py-7">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            width={48}
            height={48}
            alt="WTL Logo"
            style={{ mixBlendMode: "multiply" }}
          />
          <div>
            <p className="text-[16px] font-bold leading-tight text-[#1a2e1a]">
              海利物流有限公司
            </p>
            <p className="mt-1 text-[13px] font-normal leading-snug text-[#2d4a2d]">
              HAI DEE LOGISTICS CO.,LTD
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="m-0 list-none space-y-1 p-0">
          <NavLink
            item={MAIN_NAV_DASHBOARD}
            pathname={pathname}
            onNavigate={onNavigate}
          />

          {navGroups.map((group) => (
            <ExpandableNavGroup
              key={group.id}
              group={group}
              open={openGroups[group.id] ?? false}
              onToggle={() => toggleGroup(group.id)}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          ))}

          <NavLink
            item={MAIN_NAV_HISTORY}
            pathname={pathname}
            onNavigate={onNavigate}
          />

          {isAdmin && (
            <ExpandableNavGroup
              group={{
                id: "settings",
                label: "系统设置",
                labelEn: "Settings",
                icon: Settings,
                children: [],
              }}
              open={openGroups.settings ?? false}
              onToggle={() => toggleGroup("settings")}
              pathname={pathname}
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

      <div className="border-t border-[#1a2e1a]/15 px-5 py-4">
        <p className="text-center text-[10px] text-[#2d4a2d]/70">
          © 2026 DMC SYSTEM
          <br />
          All Rights Reserved.
        </p>
      </div>
    </aside>
  );
}

function ExpandableNavGroup({
  group,
  open,
  onToggle,
  pathname,
  onNavigate,
  submenu,
}: {
  group: MainNavGroup;
  open: boolean;
  onToggle: () => void;
  pathname: string;
  onNavigate?: () => void;
  submenu?: React.ReactNode;
}) {
  const Icon = group.icon;
  const groupActive =
    group.id === "settings"
      ? pathname.startsWith("/settings")
      : isGroupActive(pathname, group);

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
          groupActive ? SIDEBAR_NAV_ACTIVE : SIDEBAR_NAV_INACTIVE
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="flex-1 text-left">
          {group.label}{" "}
          <span
            className={cn(
              "text-xs",
              groupActive ? SIDEBAR_ACTIVE_LABEL_MUTED : SIDEBAR_LABEL_MUTED
            )}
          >
            {group.labelEn}
          </span>
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />
        )}
      </button>

      {open &&
        (submenu ?? (
          <ul className="m-0 mt-1 list-none space-y-1 p-0 pl-4">
            {group.children.map((child) => (
              <li key={child.href}>
                <SidebarSubLink
                  href={child.href}
                  label={child.label}
                  labelEn={child.labelEn}
                  isActive={isPathActive(pathname, child.href)}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        ))}
    </li>
  );
}

function SidebarSubLink({
  href,
  label,
  labelEn,
  isActive,
  onNavigate,
}: MainNavLink & { isActive: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex min-h-[40px] items-center rounded-lg px-3 py-2 text-sm transition-colors",
        isActive ? SIDEBAR_NAV_ACTIVE : SIDEBAR_NAV_INACTIVE
      )}
    >
      <span>
        {label}{" "}
        <span
          className={cn(
            "text-xs",
            isActive ? SIDEBAR_ACTIVE_LABEL_MUTED : SIDEBAR_LABEL_MUTED
          )}
        >
          {labelEn}
        </span>
      </span>
    </Link>
  );
}

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: MainNavLink & { icon: React.ComponentType<{ className?: string }> };
  pathname: string;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const active = isPathActive(pathname, item.href);

  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        className={cn(
          "flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
          active ? SIDEBAR_NAV_ACTIVE : SIDEBAR_NAV_INACTIVE
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span>
          {item.label}{" "}
          <span
            className={cn(
              "text-xs",
              active ? SIDEBAR_ACTIVE_LABEL_MUTED : SIDEBAR_LABEL_MUTED
            )}
          >
            {item.labelEn}
          </span>
        </span>
      </Link>
    </li>
  );
}
