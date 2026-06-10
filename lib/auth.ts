import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/types";

export async function getCurrentUser(): Promise<AppUser | null> {
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
      role: dbUser.role as AppUser["role"],
    };
  }

  return {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.name ?? null,
    role: "clerk",
  };
}
