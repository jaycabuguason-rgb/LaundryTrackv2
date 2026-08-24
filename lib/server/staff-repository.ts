import "server-only";

import { setTimeout as delay } from "node:timers/promises";

import { createClient } from "@supabase/supabase-js";

import type {
  CreateStaffAccountInput,
  StaffAccountSummary,
  UpdateStaffAccountInput,
} from "@/lib/staff-contracts";
import { requirePublicSupabaseConfig } from "@/lib/supabase/config";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createTtlCache } from "@/lib/server/ttl-cache";

type StaffProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone_number: string | null;
  username: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

const STAFF_SELECT = "id,email,full_name,phone_number,username,is_active,created_at,updated_at";
const STAFF_SELECT_NO_EMAIL = "id,full_name,phone_number,username,is_active,created_at,updated_at";
const STAFF_LIST_CACHE_TTL_MS = 10_000;
const STAFF_ROW_CACHE_TTL_MS = 10_000;
const staffListCache = createTtlCache<StaffAccountSummary[]>();
const staffRowCache = createTtlCache<StaffAccountSummary>();

function isMissingProfilesEmailColumnError(message: string): boolean {
  return message.toLowerCase().includes("column profiles.email does not exist");
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePhoneNumber(value: string | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized ? normalized : null;
}

function mapRowToStaffAccount(row: StaffProfileRow): StaffAccountSummary {
  return {
    id: row.id,
    fullName: row.full_name ?? "",
    email: row.email ?? "",
    username: row.username ?? "",
    phoneNumber: row.phone_number ?? "",
    isActive: row.is_active !== false,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
  };
}

async function getAuthEmailByUserId(userId: string): Promise<string | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error) {
    throw new Error(error.message);
  }

  return data.user?.email?.trim().toLowerCase() ?? null;
}

async function getAuthEmailsByUserIds(userIds: string[]): Promise<Map<string, string>> {
  const ids = new Set(userIds);
  const result = new Map<string, string>();

  if (ids.size === 0) {
    return result;
  }

  const supabase = getSupabaseAdminClient();
  let page = 1;

  while (ids.size > 0) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw new Error(error.message);
    }

    for (const user of data.users) {
      if (!ids.has(user.id) || !user.email) {
        continue;
      }

      result.set(user.id, user.email.trim().toLowerCase());
      ids.delete(user.id);
    }

    if (data.users.length < 200) {
      break;
    }

    page += 1;
  }

  return result;
}

function validateCreateInput(input: CreateStaffAccountInput) {
  if (!input.fullName.trim()) {
    throw new Error("Full name is required.");
  }
  if (!input.email.trim()) {
    throw new Error("Email is required.");
  }
  if (!input.username.trim()) {
    throw new Error("Username is required.");
  }
  if (!input.password) {
    throw new Error("Password is required.");
  }
  if (input.password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }
}

function validateUpdateInput(input: UpdateStaffAccountInput) {
  if (!input.fullName.trim()) {
    throw new Error("Full name is required.");
  }
  if (!input.email.trim()) {
    throw new Error("Email is required.");
  }
  if (!input.username.trim()) {
    throw new Error("Username is required.");
  }
}

async function getStaffProfileRow(staffId: string): Promise<StaffProfileRow | null> {
  const cachedRow = staffRowCache.get(staffId);
  if (cachedRow) {
    return {
      id: cachedRow.id,
      email: cachedRow.email,
      full_name: cachedRow.fullName,
      phone_number: cachedRow.phoneNumber,
      username: cachedRow.username,
      is_active: cachedRow.isActive,
      created_at: cachedRow.createdAt,
      updated_at: cachedRow.updatedAt,
    };
  }

  const supabase = getSupabaseAdminClient();
  const withEmail = await supabase
    .from("profiles")
    .select(STAFF_SELECT)
    .eq("id", staffId)
    .eq("role", "staff")
    .maybeSingle();

  if (!withEmail.error) {
    return withEmail.data as StaffProfileRow | null;
  }

  if (!isMissingProfilesEmailColumnError(withEmail.error.message)) {
    throw new Error(withEmail.error.message);
  }

  const withoutEmail = await supabase
    .from("profiles")
    .select(STAFF_SELECT_NO_EMAIL)
    .eq("id", staffId)
    .eq("role", "staff")
    .maybeSingle();

  if (withoutEmail.error) {
    throw new Error(withoutEmail.error.message);
  }

  const row = withoutEmail.data as Omit<StaffProfileRow, "email"> | null;
  if (!row) {
    return null;
  }

  return {
    ...row,
    email: await getAuthEmailByUserId(row.id),
  };
}

export async function getStaffAccountById(staffId: string): Promise<StaffAccountSummary | null> {
  const row = await getStaffProfileRow(staffId);
  const staffAccount = row ? mapRowToStaffAccount(row) : null;
  if (staffAccount) {
    staffRowCache.set(staffId, staffAccount, STAFF_ROW_CACHE_TTL_MS);
  }
  return staffAccount;
}

async function waitForStaffProfileRow(staffId: string): Promise<StaffProfileRow> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const row = await getStaffProfileRow(staffId);
    if (row) {
      return row;
    }

    await delay(150);
  }

  throw new Error("The staff profile was created, but the public profile is not ready yet.");
}

export async function listStaffAccounts(): Promise<StaffAccountSummary[]> {
  const cachedStaff = staffListCache.get("staff");
  if (cachedStaff) {
    return cachedStaff;
  }

  const supabase = getSupabaseAdminClient();
  const withEmail = await supabase
    .from("profiles")
    .select(STAFF_SELECT)
    .eq("role", "staff")
    .order("created_at", { ascending: false });

  if (!withEmail.error) {
    const staffAccounts = (withEmail.data as StaffProfileRow[]).map(mapRowToStaffAccount);
    staffListCache.set("staff", staffAccounts, STAFF_LIST_CACHE_TTL_MS);
    for (const staffAccount of staffAccounts) {
      staffRowCache.set(staffAccount.id, staffAccount, STAFF_ROW_CACHE_TTL_MS);
    }
    return staffAccounts;
  }

  if (!isMissingProfilesEmailColumnError(withEmail.error.message)) {
    throw new Error(withEmail.error.message);
  }

  const withoutEmail = await supabase
    .from("profiles")
    .select(STAFF_SELECT_NO_EMAIL)
    .eq("role", "staff")
    .order("created_at", { ascending: false });

  if (withoutEmail.error) {
    throw new Error(withoutEmail.error.message);
  }

  const rows = withoutEmail.data as Omit<StaffProfileRow, "email">[];
  const emailByUserId = await getAuthEmailsByUserIds(rows.map((row) => row.id));

  const staffAccounts = rows.map((row) =>
    mapRowToStaffAccount({
      ...row,
      email: emailByUserId.get(row.id) ?? null,
    }),
  );

  staffListCache.set("staff", staffAccounts, STAFF_LIST_CACHE_TTL_MS);
  for (const staffAccount of staffAccounts) {
    staffRowCache.set(staffAccount.id, staffAccount, STAFF_ROW_CACHE_TTL_MS);
  }

  return staffAccounts;
}

export async function createStaffAccount(input: CreateStaffAccountInput): Promise<StaffAccountSummary> {
  validateCreateInput(input);

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email: normalizeEmail(input.email),
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName.trim(),
      phone_number: normalizePhoneNumber(input.phoneNumber),
      username: normalizeUsername(input.username),
      role: "staff",
      is_active: true,
    },
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? "Unable to create the staff account.");
  }

  const staffAccount = mapRowToStaffAccount(await waitForStaffProfileRow(data.user.id));
  staffListCache.delete("staff");
  staffRowCache.set(staffAccount.id, staffAccount, STAFF_ROW_CACHE_TTL_MS);
  return staffAccount;
}

export async function updateStaffAccount(
  staffId: string,
  input: UpdateStaffAccountInput,
): Promise<StaffAccountSummary> {
  validateUpdateInput(input);

  const currentRow = await getStaffProfileRow(staffId);
  if (!currentRow) {
    throw new Error("That staff account no longer exists.");
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.auth.admin.updateUserById(staffId, {
    email: normalizeEmail(input.email),
    user_metadata: {
      full_name: input.fullName.trim(),
      phone_number: normalizePhoneNumber(input.phoneNumber),
      username: normalizeUsername(input.username),
      role: "staff",
      is_active: input.isActive,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  const staffAccount = mapRowToStaffAccount(await waitForStaffProfileRow(staffId));
  staffListCache.delete("staff");
  staffRowCache.set(staffAccount.id, staffAccount, STAFF_ROW_CACHE_TTL_MS);
  return staffAccount;
}

export async function resetStaffPassword(staffId: string, password: string): Promise<void> {
  if (!password) {
    throw new Error("Password is required.");
  }
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.auth.admin.updateUserById(staffId, {
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  staffRowCache.delete(staffId);
  staffListCache.delete("staff");
}

export async function signInStaffWithIdentifier(login: string, password: string) {
  const identifier = login.trim().toLowerCase();
  if (!identifier) {
    throw new Error("Username or email is required.");
  }
  if (!password) {
    throw new Error("Password is required.");
  }

  const adminSupabase = getSupabaseAdminClient();
  let email = identifier;

  if (!identifier.includes("@")) {
    const withEmail = await adminSupabase
      .from("profiles")
      .select("id,email,is_active")
      .eq("role", "staff")
      .eq("username", identifier)
      .maybeSingle();

    if (withEmail.error && !isMissingProfilesEmailColumnError(withEmail.error.message)) {
      throw new Error(withEmail.error.message);
    }

    let profile: { id: string; email: string | null; is_active: boolean | null } | null = null;

    if (!withEmail.error) {
      profile = withEmail.data as { id: string; email: string | null; is_active: boolean | null } | null;
    } else {
      const withoutEmail = await adminSupabase
        .from("profiles")
        .select("id,is_active")
        .eq("role", "staff")
        .eq("username", identifier)
        .maybeSingle();

      if (withoutEmail.error) {
        throw new Error(withoutEmail.error.message);
      }

      const profileWithoutEmail = withoutEmail.data as { id: string; is_active: boolean | null } | null;
      if (profileWithoutEmail) {
        profile = {
          ...profileWithoutEmail,
          email: await getAuthEmailByUserId(profileWithoutEmail.id),
        };
      }
    }

    if (!profile?.email) {
      throw new Error("Invalid username or password.");
    }
    if (profile.is_active === false) {
      throw new Error("This account is inactive.");
    }

    email = profile.email;
  }

  const { url, publishableKey } = requirePublicSupabaseConfig();
  const authClient = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await authClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session || !data.user) {
    throw new Error(error?.message ?? "Invalid username or password.");
  }

  const row = await getStaffProfileRow(data.user.id);
  if (!row) {
    throw new Error("The staff profile could not be loaded.");
  }
  if (row.is_active === false) {
    throw new Error("This account is inactive.");
  }

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    profile: mapRowToStaffAccount(row),
  };
}
