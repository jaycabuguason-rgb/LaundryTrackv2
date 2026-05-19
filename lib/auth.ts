export type UserRole = "admin" | "staff";

export interface UserProfile {
  name: string;
  email: string;
  username: string;
  phone: string;
  role: UserRole;
  avatarUrl?: string;
}

export interface StaffAccount {
  username: string;
  password: string;
  profile: Omit<UserProfile, "role">;
}

// Staff auth remains local demo data until staff accounts are migrated to Supabase.
export const staffAccounts: StaffAccount[] = [
  {
    username: "staff01",
    password: "staff123",
    profile: {
      name: "Staff One",
      email: "staff01@laundrytrack.ph",
      username: "staff01",
      phone: "+63 912 000 0001",
    },
  },
  {
    username: "staff02",
    password: "staff456",
    profile: {
      name: "Staff Two",
      email: "staff02@laundrytrack.ph",
      username: "staff02",
      phone: "+63 912 000 0002",
    },
  },
];

export function authenticateStaff(username: string, password: string): UserProfile | null {
  const login = username.trim().toLowerCase();
  const account = staffAccounts.find(
    (candidate) =>
      (
        candidate.username.toLowerCase() === login
        || candidate.profile.email.toLowerCase() === login
      )
      && candidate.password === password,
  );

  if (!account) {
    return null;
  }

  return { ...account.profile, role: "staff" };
}
