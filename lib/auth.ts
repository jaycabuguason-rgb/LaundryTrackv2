export type UserRole = "admin" | "staff";

export interface UserProfile {
  id?: string;
  name: string;
  email: string;
  username: string;
  phone: string;
  role: UserRole;
  avatarUrl?: string;
}
