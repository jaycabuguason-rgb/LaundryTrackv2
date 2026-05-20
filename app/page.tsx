"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import LoginPage from "@/components/pages/login";
import StaffLoginPage from "@/components/pages/staff-login";
import {
  getCurrentAdminProfile,
  isSupabaseAdminAuthConfigured,
  signInAdmin,
  signOutAdmin,
} from "@/lib/admin-auth";
import { authenticateStaff, type UserProfile } from "@/lib/auth";
import { setBrowserSessionCache } from "@/lib/supabase/browser-session";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isOnline } from "@/lib/network-status";

// Legacy type alias kept for ChangePasswordPage compat
export interface AdminProfile {
  name: string;
  email: string;
  username: string;
  phone: string;
}

type AuthView = "role-select" | "admin-login" | "staff-login" | "app";
const AUTH_VIEW_STORAGE_KEY = "laundrytrack-auth-view";
const LAST_PROFILE_KEY = "laundrytrack-last-profile";

const AppShell = dynamic(() => import("@/components/app-shell"), {
  loading: () => null,
});

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof data === "object" && data && "error" in data && typeof data.error === "string"
        ? data.error
        : "Request failed.";
    throw new Error(message);
  }
  return data as T;
}

export default function Home() {
  const [view, setView] = useState<AuthView>("role-select");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const setStoredView = useCallback((nextView: AuthView) => {
    if (typeof window === "undefined") {
      return;
    }

    if (nextView === "app") {
      window.sessionStorage.removeItem(AUTH_VIEW_STORAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(AUTH_VIEW_STORAGE_KEY, nextView);
  }, []);

  const syncAdminSession = useCallback(async () => {
    const storedView =
      typeof window === "undefined"
        ? null
        : window.sessionStorage.getItem(AUTH_VIEW_STORAGE_KEY);
    const initialView: AuthView =
      storedView === "admin-login" || storedView === "staff-login" || storedView === "role-select"
        ? storedView
        : "role-select";

    if (!isSupabaseAdminAuthConfigured()) {
      setView(initialView);
      setAuthLoading(false);
      return;
    }

    const profile = await getCurrentAdminProfile().catch(() => null);
    const fallbackProfileRaw =
      typeof window !== "undefined"
        ? window.localStorage.getItem(LAST_PROFILE_KEY)
        : null;
    let parsedFallback: UserProfile | null = null;
    if (fallbackProfileRaw) {
      try {
        parsedFallback = JSON.parse(fallbackProfileRaw) as UserProfile;
      } catch {
        parsedFallback = null;
      }
    }
    const effectiveProfile = profile ?? (!isOnline() ? parsedFallback : null);

    if (profile && typeof window !== "undefined") {
      window.localStorage.setItem(LAST_PROFILE_KEY, JSON.stringify(profile));
    }

    if (!profile && typeof window !== "undefined" && isOnline()) {
      window.localStorage.removeItem(LAST_PROFILE_KEY);
    }

    setView(effectiveProfile ? "app" : initialView);
    setUserProfile(effectiveProfile);
    setAuthLoading(false);
  }, []);

  useEffect(() => {
    void syncAdminSession();
  }, [syncAdminSession]);

  const handleAdminLogin = async (credentials: { email: string; password: string }) => {
    const profile = await signInAdmin(credentials.email, credentials.password);
    setUserProfile(profile);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LAST_PROFILE_KEY, JSON.stringify(profile));
    }
    setView("app");
    setStoredView("app");
  };

  const handleStaffLogin = async (credentials: { login: string; password: string }) => {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      const profile = authenticateStaff(credentials.login, credentials.password);
      if (!profile) {
        throw new Error("Invalid username or password.");
      }

      setUserProfile(profile);
      setView("app");
      setStoredView("app");
      return;
    }

    const response = await fetch("/api/staff/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(credentials),
    });

    const data = await readJson<{ accessToken: string; refreshToken: string }>(response);
    const { data: sessionData, error } = await supabase.auth.setSession({
      access_token: data.accessToken,
      refresh_token: data.refreshToken,
    });

    if (error) {
      throw new Error(error.message);
    }

    setBrowserSessionCache(sessionData.session ?? null);

    const profile = await getCurrentAdminProfile();
    if (!profile) {
      throw new Error("Unable to load your staff profile.");
    }

    setUserProfile(profile);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LAST_PROFILE_KEY, JSON.stringify(profile));
    }
    setView("app");
    setStoredView("app");
  };

  const handleSignOut = () => {
    if (isSupabaseAdminAuthConfigured()) {
      void signOutAdmin();
    }
    setUserProfile(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(LAST_PROFILE_KEY);
    }
    setView("role-select");
    setStoredView("role-select");
  };

  if (authLoading) {
    return (
      <div className="relative isolate min-h-screen flex items-center justify-center bg-[#0c249c] px-4">
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative z-10 w-full max-w-sm">
          <div className="bg-card rounded-2xl shadow-lg border border-border px-8 py-10 text-center">
            <p className="text-sm font-semibold text-foreground">Loading LaundryTrack...</p>
            <p className="text-xs text-muted-foreground mt-2">
              Checking your Supabase admin session.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (view === "role-select") {
    return (
      <div className="relative isolate min-h-screen flex items-center justify-center bg-[#0c249c] px-4">
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative z-10 w-full max-w-sm">
          <div className="bg-card rounded-2xl shadow-lg border border-border px-8 py-10 text-center">
            <div className="flex flex-col items-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-md mb-3">
                <svg viewBox="0 0 24 24" className="w-7 h-7 text-primary-foreground fill-none stroke-current stroke-[1.5]">
                  <rect x="2" y="3" width="20" height="18" rx="2" />
                  <circle cx="12" cy="13" r="4" />
                  <line x1="6" y1="7" x2="6" y2="7" strokeLinecap="round" strokeWidth="2" />
                  <line x1="9" y1="7" x2="9" y2="7" strokeLinecap="round" strokeWidth="2" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-foreground tracking-tight">LaundryTrack</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Sunshine Laundry Shop</p>
            </div>

            <p className="text-sm font-medium text-foreground mb-6">Sign in as</p>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  setView("admin-login");
                  setStoredView("admin-login");
                }}
                className="w-full rounded-xl border-2 border-primary bg-primary/5 hover:bg-primary/10 transition-colors px-5 py-3 text-center group cursor-pointer"
              >
                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">Admin</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setView("staff-login");
                  setStoredView("staff-login");
                }}
                className="w-full rounded-xl border-2 border-border hover:border-primary/40 bg-muted/30 hover:bg-primary/5 transition-colors px-5 py-3 text-center group cursor-pointer"
              >
                <p className="text-sm font-semibold text-foreground">Staff</p>
              </button>
            </div>
          </div>

          <p className="text-center text-[11px] text-white/50 mt-5">
            &copy; {new Date().getFullYear()} LaundryTrack. All rights reserved.
          </p>
        </div>
      </div>
    );
  }

  if (view === "admin-login") {
    return (
      <LoginPage
        onLogin={handleAdminLogin}
        onBack={() => {
          setView("role-select");
          setStoredView("role-select");
        }}
        authConfigured={isSupabaseAdminAuthConfigured()}
      />
    );
  }

  if (view === "staff-login") {
    return (
      <StaffLoginPage
        onLogin={handleStaffLogin}
        authConfigured={isSupabaseAdminAuthConfigured()}
        onSwitchToAdmin={() => {
          setView("admin-login");
          setStoredView("admin-login");
        }}
      />
    );
  }

  if (!userProfile) {
    return null;
  }

  return (
    <AppShell
      onSignOut={handleSignOut}
      adminProfile={userProfile}
      onProfileUpdate={(updates) => {
        setUserProfile((prev) => {
          if (!prev) return prev;
          const next = { ...prev, ...updates };
          // Keep localStorage in sync so the updated avatar/profile is
          // immediately available on this device even before next page load.
          if (typeof window !== "undefined") {
            window.localStorage.setItem(LAST_PROFILE_KEY, JSON.stringify(next));
          }
          return next;
        });
      }}
    />
  );
}
