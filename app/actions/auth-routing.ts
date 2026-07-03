"use server";

import { getCurrentUser } from "@/lib/auth";
import { AUTHED_LANDING_FALLBACK, getDefaultRoute } from "@/lib/routes";

/** Landing path for the current session (login success / auth redirect). */
export async function getAuthedLandingPath(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) {
    return "/login";
  }
  return getDefaultRoute(user.role) ?? AUTHED_LANDING_FALLBACK;
}
