import type { StoredUserRole } from "@/types";

/** Fallback when role landing path cannot be resolved (or client action was aborted). */
export const AUTHED_LANDING_FALLBACK = "/dashboard";

/** Role-specific landing page after authentication. */
export function getDefaultRoute(role: StoredUserRole): string {
  switch (role) {
    case "clerk":
    case "thai_accounting":
      return "/inbound";
    case "admin":
    case "my_accounting":
    case "viewer":
    case "accounting":
    case "owner":
      return "/dashboard";
    default:
      return "/dashboard";
  }
}

/** @deprecated Use getDefaultRoute(role) for role-aware redirects. */
export const DEFAULT_AUTHED_ROUTE = "/dashboard";
