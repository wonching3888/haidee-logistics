export type UserRole = "admin" | "clerk";

export interface AppUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}
