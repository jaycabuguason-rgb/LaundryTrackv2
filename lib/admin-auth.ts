"use client";

import type { User } from "@supabase/supabase-js";

import type { UserProfile } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  getBrowserSessionUser,
  setBrowserSessionCache,
} from "@/lib/supabase/browser-session";
import { isOnline } from "@/lib/network-status";

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone_number: string | null;
  username: string | null;
  role: string | null;
  is_active: boolean | null;
};

function getRoleFromAuthUser(user: User): "admin" | "staff" {
  const appMetadataRole =
    typeof user.app_metadata?.role === "string" ? user.app_metadata.role.toLowerCase() : null;

  return appMetadataRole === "admin" ? "admin" : "staff";
}

function mapSupabaseUserToProfile(user: User, profile: ProfileRow | null): UserProfile {
  const email = user.email ?? "";
  const fallbackName = email.split("@")[0] || "Admin";

  return {
    name:
      profile?.full_name
      ?? (typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : null)
      ?? fallbackName,
    email,
    username:
      profile?.username
      ?? (typeof user.user_metadata.username === "string" ? user.user_metadata.username : null)
      ?? fallbackName,
    phone:
      profile?.phone_number
      ?? (typeof user.user_metadata.phone_number === "string" ? user.user_metadata.phone_number : ""),
    role:
      profile?.role === "admin"
        ? "admin"
        : profile?.role === "staff"
          ? "staff"
          : getRoleFromAuthUser(user),
    avatarUrl:
      typeof user.user_metadata.avatar_url === "string"
        ? user.user_metadata.avatar_url
        : undefined,
  };
}

async function fetchOwnProfile(userId: string): Promise<ProfileRow | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,full_name,phone_number,username,role,is_active")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.warn('Error fetching profile:', error.message);
      return null;
    }

    return data as ProfileRow | null;
  } catch (err) {
    console.error('Unexpected error fetching profile:', err);
    return null;
  }
}

async function requireAuthenticatedUser() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase admin authentication is not configured.");
  }

  const user = await getBrowserSessionUser();
  if (!user?.email) {
    throw new Error("No active admin session was found.");
  }

  return { supabase, user };
}

async function reauthenticateWithPassword(email: string, password: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase admin authentication is not configured.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error("Current password is incorrect.");
  }

  setBrowserSessionCache(data.session ?? null);
}

export function isSupabaseAdminAuthConfigured(): boolean {
  return Boolean(getSupabaseBrowserClient());
}

export async function getCurrentAdminProfile(): Promise<UserProfile | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return null;
  }

  try {
    let user = await getBrowserSessionUser();
    if (!user) {
      return null;
    }

    // Use getUser() (server request) instead of the cached session JWT so that
    // updated user_metadata (e.g. avatar_url saved by the admin API) is always
    // reflected — even on other devices that have an older cached token.
    if (isOnline()) {
      try {
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          user = data.user;
        }
      } catch {
        // Non-fatal — fall back to cached session user
      }
    }

    let profile: ProfileRow | null = null;
    try {
      profile = await fetchOwnProfile(user.id);
    } catch (error) {
      if (isOnline()) {
        console.warn('Failed to fetch profile:', error);
      }
    }

    if (profile?.is_active === false) {
      await supabase.auth.signOut();
      setBrowserSessionCache(null);
      return null;
    }

    return mapSupabaseUserToProfile(user, profile);
  } catch (error) {
    console.error('Error getting current admin profile:', error);
    return null;
  }
}

export async function signInAdmin(email: string, password: string): Promise<UserProfile> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase admin authentication is not configured.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error("Supabase did not return a user session.");
  }

  setBrowserSessionCache(data.session ?? null);

  const profile = await fetchOwnProfile(data.user.id);
  if (profile?.is_active === false) {
    await supabase.auth.signOut();
    setBrowserSessionCache(null);
    throw new Error("This account is inactive.");
  }

  const mappedProfile = mapSupabaseUserToProfile(data.user, profile);
  if (mappedProfile.role !== "admin") {
    await supabase.auth.signOut();
    setBrowserSessionCache(null);
    throw new Error("This account does not have admin access.");
  }

  return mappedProfile;
}

export async function signOutAdmin(): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return;
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }

  setBrowserSessionCache(null);
}

export async function updateAdminIdentity(input: {
  currentPassword: string;
  newEmail?: string;
  newUsername?: string;
}): Promise<UserProfile> {
  const { supabase, user } = await requireAuthenticatedUser();
  await reauthenticateWithPassword(user.email ?? "", input.currentPassword);

  const nextEmail = input.newEmail?.trim();
  const nextUsername = input.newUsername?.trim();

  if (nextEmail && nextEmail.toLowerCase() !== (user.email ?? "").toLowerCase()) {
    const { error } = await supabase.auth.updateUser({ email: nextEmail });
    if (error) {
      throw new Error(error.message);
    }
  }

  if (nextUsername !== undefined) {
    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        username: nextUsername || null,
      },
    });

    if (metadataError) {
      throw new Error(metadataError.message);
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ username: nextUsername || null })
      .eq("id", user.id);

    if (profileError) {
      throw new Error(profileError.message);
    }
  }

  const refreshedProfile = await getCurrentAdminProfile();
  if (!refreshedProfile) {
    throw new Error("Unable to refresh your admin profile after saving.");
  }

  if (nextEmail) {
    refreshedProfile.email = nextEmail;
  }

  if (nextUsername !== undefined) {
    refreshedProfile.username = nextUsername;
  }

  return refreshedProfile;
}

export async function updateAdminPassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const { supabase, user } = await requireAuthenticatedUser();
  await reauthenticateWithPassword(user.email ?? "", input.currentPassword);

  const { error } = await supabase.auth.updateUser({
    password: input.newPassword,
  });

  if (error) {
    throw new Error(error.message);
  }
}
