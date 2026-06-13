"use client";

import { useRouter } from "next/navigation";
import { LogOut, Menu, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { getRoleLabel } from "@/lib/auth-roles";
import type { AppUser } from "@/types";

interface HeaderProps {
  user: AppUser;
  onMenuToggle?: () => void;
}

export function Header({ user, onMenuToggle }: HeaderProps) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const roleLabel = getRoleLabel(user.role);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-haidee-border bg-white px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-haidee-text hover:bg-haidee-surface md:hidden"
          aria-label="打开菜单 Open menu"
          onClick={onMenuToggle}
        >
          <Menu className="h-6 w-6" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-haidee-text">
            海利物流管理系统
          </h1>
          <p className="truncate text-xs text-haidee-muted">
            HAI DEE Logistics Management System
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-haidee-muted">
          <User className="h-4 w-4" />
          <span>{user.name ?? user.email}</span>
          <span className="rounded bg-haidee-navy2 px-2 py-0.5 text-xs text-white">
            {roleLabel}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSignOut}
          className="min-h-[44px] gap-2 border-haidee-border text-haidee-muted hover:text-haidee-text"
        >
          <LogOut className="h-4 w-4" />
          登出 Sign Out
        </Button>
      </div>
    </header>
  );
}
