"use client";

import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

let cachedSession: Session | null | undefined;
let pendingSession: Promise<Session | null> | null = null;
let subscribedClient: SupabaseClient | null = null;
let authSubscription: { unsubscribe: () => void } | null = null;

function ensureAuthSubscription(supabase: SupabaseClient) {
  if (subscribedClient === supabase && authSubscription) {
    return;
  }

  authSubscription?.unsubscribe();

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    cachedSession = session;
  });

  subscribedClient = supabase;
  authSubscription = data.subscription;
}

export function setBrowserSessionCache(session: Session | null) {
  cachedSession = session;
}

export async function getBrowserSession(): Promise<Session | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return null;
  }

  ensureAuthSubscription(supabase);

  if (cachedSession !== undefined) {
    return cachedSession;
  }

  if (!pendingSession) {
    pendingSession = supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          console.warn('Failed to get session:', error.message);
          cachedSession = null;
          return null;
        }

        cachedSession = data.session;
        return data.session;
      })
      .catch((err) => {
        console.error('Unexpected error getting session:', err);
        cachedSession = null;
        return null;
      })
      .finally(() => {
        pendingSession = null;
      });
  }

  return pendingSession;
}

export async function refreshBrowserSession(): Promise<Session | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return null;
  }

  ensureAuthSubscription(supabase);

  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      console.warn('Session refresh failed:', error.message);
      cachedSession = null;
      return null;
    }

    cachedSession = data.session;
    return data.session;
  } catch (err) {
    console.error('Unexpected error during session refresh:', err);
    cachedSession = null;
    return null;
  }
}

export async function getBrowserAccessToken(): Promise<string | null> {
  const session = await getBrowserSession();
  return session?.access_token ?? null;
}

export async function getBrowserSessionUser(): Promise<User | null> {
  const session = await getBrowserSession();
  return session?.user ?? null;
}

export function clearBrowserSession(): void {
  cachedSession = null;
  pendingSession = null;
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('supabase.auth.token');
  }
}
