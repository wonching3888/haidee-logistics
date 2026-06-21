import { requirePageUser } from "@/lib/auth";
import { AppShell } from "@/components/shared/AppShell";

export const maxDuration = 60;

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requirePageUser();

  return (
    <AppShell user={user} role={user.role}>
      {children}
    </AppShell>
  );
}
