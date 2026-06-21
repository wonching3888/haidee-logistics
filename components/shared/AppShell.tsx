"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/shared/Sidebar";
import { Header } from "@/components/shared/Header";
import type { AppUser, StoredUserRole } from "@/types";

interface AppShellProps {
  user: AppUser;
  role: StoredUserRole;
  children: React.ReactNode;
}

export function AppShell({ user, role, children }: AppShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen" style={{ overflow: "hidden" }}>
      {menuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-label="关闭菜单 Close menu"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div className="no-print">
      <Sidebar
        role={role}
        isOpen={menuOpen}
        onNavigate={() => setMenuOpen(false)}
      />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="no-print">
          <Header user={user} onMenuToggle={() => setMenuOpen((open) => !open)} />
        </div>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-auto bg-haidee-surface p-4 md:p-6">
          {children}
        </main>
        <footer className="no-print shrink-0 border-t border-haidee-border bg-white px-6 py-2 text-center text-xs text-haidee-muted">
          © 2026 DMC SYSTEM. All Rights Reserved.
        </footer>
      </div>
    </div>
  );
}
