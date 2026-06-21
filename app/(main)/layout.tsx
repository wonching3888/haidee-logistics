import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { AppShell } from "@/components/shared/AppShell";
import { canAccessPage } from "@/lib/page-access";
import { getDefaultRoute } from "@/lib/routes";

export const maxDuration = 60;

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePageUser();
  const pathname = headers().get("x-pathname") ?? "";

  if (pathname && !canAccessPage(user.role, pathname)) {
    redirect(getDefaultRoute(user.role));
  }

  return (
    <AppShell user={user} role={user.role}>
      {children}
    </AppShell>
  );
}
