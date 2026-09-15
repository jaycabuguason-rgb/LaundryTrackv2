"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { UserProfile } from "@/lib/auth";

export function useStaffPresence(currentProfile?: UserProfile | null) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [onlineKeys, setOnlineKeys] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (currentProfile) {
      if (currentProfile.id) initial.add(currentProfile.id.toLowerCase());
      if (currentProfile.username) initial.add(currentProfile.username.toLowerCase());
      if (currentProfile.email) initial.add(currentProfile.email.toLowerCase());
    }
    return initial;
  });

  const profileRef = useRef(currentProfile);
  useEffect(() => {
    profileRef.current = currentProfile;
  }, [currentProfile]);

  useEffect(() => {
    // Keep current profile in online keys without unnecessary state re-allocations
    if (currentProfile) {
      setOnlineKeys((prev) => {
        const id = currentProfile.id?.toLowerCase();
        const username = currentProfile.username?.toLowerCase();
        const email = currentProfile.email?.toLowerCase();
        if (
          (!id || prev.has(id)) &&
          (!username || prev.has(username)) &&
          (!email || prev.has(email))
        ) {
          return prev;
        }
        const next = new Set(prev);
        if (id) next.add(id);
        if (username) next.add(username);
        if (email) next.add(email);
        return next;
      });
    }

    if (!supabase || typeof supabase.channel !== "function") {
      return undefined;
    }

    const presenceKey =
      currentProfile?.id ||
      currentProfile?.username ||
      currentProfile?.email ||
      `session-${Math.random().toString(36).slice(2, 9)}`;

    const channel = supabase.channel("laundrytrack-staff-presence", {
      config: {
        presence: {
          key: presenceKey.toLowerCase(),
        },
      },
    });

    const updatePresenceFromState = () => {
      const state = channel.presenceState();
      const keys = new Set<string>();

      const activeProfile = profileRef.current;
      if (activeProfile) {
        if (activeProfile.id) keys.add(activeProfile.id.toLowerCase());
        if (activeProfile.username) keys.add(activeProfile.username.toLowerCase());
        if (activeProfile.email) keys.add(activeProfile.email.toLowerCase());
      }

      for (const [key, presences] of Object.entries(state)) {
        keys.add(key.toLowerCase());
        if (Array.isArray(presences)) {
          for (const p of presences) {
            const item = p as Record<string, unknown>;
            if (typeof item.id === "string") keys.add(item.id.toLowerCase());
            if (typeof item.username === "string") keys.add(item.username.toLowerCase());
            if (typeof item.email === "string") keys.add(item.email.toLowerCase());
          }
        }
      }

      setOnlineKeys(keys);
    };

    channel
      .on("presence", { event: "sync" }, updatePresenceFromState)
      .on("presence", { event: "join" }, updatePresenceFromState)
      .on("presence", { event: "leave" }, updatePresenceFromState)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && profileRef.current) {
          const prof = profileRef.current;
          await channel.track({
            id: prof.id,
            username: prof.username,
            email: prof.email,
            role: prof.role,
            onlineAt: new Date().toISOString(),
          }).catch(() => undefined);
        }
      });

    return () => {
      void channel.untrack().catch(() => undefined);
      if (typeof supabase.removeChannel === "function") {
        void supabase.removeChannel(channel);
      }
    };
  }, [supabase, currentProfile?.id, currentProfile?.username, currentProfile?.email]);

  const isStaffOnline = useCallback(
    (staff: { id?: string; username?: string; email?: string; isActive?: boolean }): boolean => {
      if (staff.isActive === false) {
        return false;
      }
      const id = staff.id?.toLowerCase();
      const username = staff.username?.toLowerCase();
      const email = staff.email?.toLowerCase();

      if (id && onlineKeys.has(id)) return true;
      if (username && onlineKeys.has(username)) return true;
      if (email && onlineKeys.has(email)) return true;

      return false;
    },
    [onlineKeys]
  );

  return { onlineKeys, isStaffOnline };
}
