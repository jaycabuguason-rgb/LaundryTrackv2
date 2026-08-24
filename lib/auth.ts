export type UserRole = "admin" | "staff";

export interface UserProfile {
  name: string;
  email: string;
  username: string;
  phone: string;
  role: UserRole;
  avatarUrl?: string;
}
