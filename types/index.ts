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

/** UI local language — English is always shown alongside. */
export type UserLanguage = "zh" | "th";

export interface AppUser {
  id: string;
  email: string;
  name: string | null;
  role: StoredUserRole;
  language: UserLanguage;
}
