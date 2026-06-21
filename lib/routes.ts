import type { StoredUserRole } from "@/types";

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
