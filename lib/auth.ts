import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { isUserRole } from "@/lib/auth-roles";
import type { AppUser } from "@/types";

export async function getCurrentUser(): Promise<AppUser | null> {
  const backfillUser = (globalThis as { __BACKFILL_USER__?: AppUser })
    .__BACKFILL_USER__;
  if (backfillUser) return backfillUser;

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.email) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
  });

  if (dbUser) {
    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: isUserRole(dbUser.role) ? dbUser.role : "clerk",
    };
  }

  return {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.name ?? null,
    role: "clerk",
  };
}
