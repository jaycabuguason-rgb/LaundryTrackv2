"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { UserProfile } from "@/lib/auth";

// Shared module-level singleton state to prevent duplicate channels and "cannot add presence callbacks after subscribe()" errors
let sharedChannel: RealtimeChannel | null = null;
let subscriberCount = 0;
let currentOnlineKeys = new Set<string>();
const listeners = new Set<(keys: Set<string>) => void>();
let trackedProfile: UserProfile | null = null;

function notifyListeners() {
  const copy = new Set(currentOnlineKeys);
  listeners.forEach((listener) => listener(copy));
}

function updatePresenceFromState(channel: RealtimeChannel | null) {
  if (!channel || typeof channel.presenceState !== "function") {
    return;
  }
  const state = channel.presenceState();
  const keys = new Set<string>();

  if (trackedProfile) {
    if (trackedProfile.id) keys.add(trackedProfile.id.toLowerCase());
    if (trackedProfile.username) keys.add(trackedProfile.username.toLowerCase());
    if (trackedProfile.email) keys.add(trackedProfile.email.toLowerCase());
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

  currentOnlineKeys = keys;
  notifyListeners();
}

export function useStaffPresence(currentProfile?: UserProfile | null) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [onlineKeys, setOnlineKeys] = useState<Set<string>>(() => {
    const initial = new Set<string>(currentOnlineKeys);
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
    // Register listener for presence updates
    listeners.add(setOnlineKeys);

    // Keep current profile in online keys
    if (currentProfile) {
      trackedProfile = currentProfile;
      const id = currentProfile.id?.toLowerCase();
      const username = currentProfile.username?.toLowerCase();
      const email = currentProfile.email?.toLowerCase();
      if (id) currentOnlineKeys.add(id);
      if (username) currentOnlineKeys.add(username);
      if (email) currentOnlineKeys.add(email);
      notifyListeners();
    }

    if (!supabase || typeof supabase.channel !== "function") {
      return () => {
        listeners.delete(setOnlineKeys);
      };
    }

    subscriberCount++;

    // Only create and subscribe to the channel once across all hook instances
    if (!sharedChannel) {
      // Clean up any stale or dangling channel with the same topic from previous fast-refresh
      if (typeof supabase.getChannels === "function") {
        const existing = supabase
          .getChannels()
          .find((c: RealtimeChannel) => c.topic === "realtime:laundrytrack-staff-presence");
        if (existing && typeof supabase.removeChannel === "function") {
          void supabase.removeChannel(existing);
        }
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

      sharedChannel = channel;

      channel
        .on("presence", { event: "sync" }, () => updatePresenceFromState(channel))
        .on("presence", { event: "join" }, () => updatePresenceFromState(channel))
        .on("presence", { event: "leave" }, () => updatePresenceFromState(channel))
        .subscribe(async (status: string) => {
          if (status === "SUBSCRIBED" && profileRef.current) {
            const prof = profileRef.current;
            await channel
              .track({
                id: prof.id,
                username: prof.username,
                email: prof.email,
                role: prof.role,
                onlineAt: new Date().toISOString(),
              })
              .catch(() => undefined);
          }
        });
    } else if (currentProfile && sharedChannel.state === "joined") {
      void sharedChannel
        .track({
          id: currentProfile.id,
          username: currentProfile.username,
          email: currentProfile.email,
          role: currentProfile.role,
          onlineAt: new Date().toISOString(),
        })
        .catch(() => undefined);
    }

    return () => {
      listeners.delete(setOnlineKeys);
      subscriberCount--;
      if (subscriberCount <= 0) {
        subscriberCount = 0;
        if (sharedChannel) {
          const ch = sharedChannel;
          sharedChannel = null;
          void ch.untrack().catch(() => undefined);
          if (typeof supabase.removeChannel === "function") {
            void supabase.removeChannel(ch);
          }
        }
      }
    };
  }, [supabase, currentProfile]);

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
