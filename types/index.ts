export type UserRole = "admin" | "clerk" | "accounting" | "owner";

export interface AppUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}
