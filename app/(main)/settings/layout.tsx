import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { DEFAULT_AUTHED_ROUTE } from "@/lib/routes";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    redirect(DEFAULT_AUTHED_ROUTE);
  }

  return <>{children}</>;
}
