import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canAccessSettings } from "@/lib/auth-roles";
import { getDefaultRoute } from "@/lib/routes";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user || !canAccessSettings(user.role)) {
    redirect(getDefaultRoute(user?.role ?? "clerk"));
  }

  return <>{children}</>;
}
