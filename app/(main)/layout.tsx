import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Sidebar } from "@/components/shared/Sidebar";
import { Header } from "@/components/shared/Header";

export const maxDuration = 60;

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={user.role} />
      <div className="flex min-w-0 flex-1 flex-col overflow-x-auto">
        <Header user={user} />
        <main className="min-w-0 flex-1 overflow-y-auto bg-haidee-surface p-6">
          {children}
        </main>
        <footer className="shrink-0 border-t border-haidee-border bg-white px-6 py-2 text-center text-xs text-haidee-muted">
          © 2026 DMC SYSTEM. All Rights Reserved.
        </footer>
      </div>
    </div>
  );
}
