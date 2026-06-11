"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PackageSearch,
  TableProperties,
  Truck,
  FileText,
  Download,
  Upload,
  Package,
  History,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

interface NavItem {
  href: string;
  label: string;
  labelEn: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
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
  { href: "/settings", label: "系统设置", labelEn: "Settings", icon: Settings, adminOnly: true },
];

interface SidebarProps {
  role: UserRole;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || role === "admin");

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col bg-haidee-navy text-white shadow-lg">
      <div className="border-b border-white/10 px-5 py-5">
        <p className="text-sm font-semibold leading-tight">海利物流有限公司</p>
        <p className="mt-0.5 text-xs text-white/60">HAI DEE LOGISTICS CO.,LTD</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="m-0 list-none space-y-1 p-0">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
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
          })}
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
