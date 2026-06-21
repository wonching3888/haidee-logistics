import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { isStoredUserRole } from "@/lib/auth-roles";
import { normalizeUserLanguage } from "@/lib/i18n/messages";
import type { AppUser } from "@/types";
import { redirect } from "next/navigation";

export const INACTIVE_SIGN_OUT_PATH = "/api/auth/sign-out";

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
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      language: true,
      active: true,
    },
  });

  if (dbUser) {
    if (!dbUser.active) {
      return null;
    }

    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: isStoredUserRole(dbUser.role) ? dbUser.role : "clerk",
      language: normalizeUserLanguage(dbUser.language),
    };
  }

  return {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.name ?? null,
    role: "clerk",
    language: "zh",
  };
}

/** Page guard: active app user, or clear stale Supabase session before /login. */
export async function requirePageUser(): Promise<AppUser> {
  const appUser = await getCurrentUser();
  if (appUser) {
    return appUser;
  }

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (authUser) {
    redirect(INACTIVE_SIGN_OUT_PATH);
  }

  redirect("/login");
}
