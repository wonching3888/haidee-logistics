/** Canonical assignable roles (Settings dropdown). */
export type UserRole =
  | "admin"
  | "clerk"
  | "thai_accounting"
  | "my_accounting"
  | "viewer";

/** Deprecated DB values — still readable until admins reassign users. */
export type LegacyUserRole = "accounting" | "owner";

/** Any role string persisted in `users.role`. */
export type StoredUserRole = UserRole | LegacyUserRole;

export interface AppUser {
  id: string;
  email: string;
  name: string | null;
  role: StoredUserRole;
}
