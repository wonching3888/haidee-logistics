"use client";

import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { AppUser } from "@/types";

interface HeaderProps {
  user: AppUser;
}

export function Header({ user }: HeaderProps) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const roleLabel = user.role === "admin" ? "管理员 Admin" : "书记 Clerk";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-haidee-border bg-white px-6">
      <div>
        <h1 className="text-base font-semibold text-haidee-text">
          海利物流管理系统
        </h1>
        <p className="text-xs text-haidee-muted">HAI DEE Logistics Management System</p>
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
