"use client";

import { isOnline } from "@/lib/network-status";

const KEY = "laundrytrack_settings_queue_v1";

export interface OfflineSettingsMutation {
  id: string;
  endpoint: string;
  method: "PUT" | "POST" | "PATCH";
  body: unknown;
  createdAt: string;
  retryCount: number;
  lastError?: string | null;
}

function readQueueSync(): OfflineSettingsMutation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OfflineSettingsMutation[]) : [];
  } catch {
    return [];
  }
}

function writeQueueSync(items: OfflineSettingsMutation[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(items));
}

export async function enqueueSettingsMutation(input: Omit<OfflineSettingsMutation, "id" | "createdAt" | "retryCount">) {
  const queue = readQueueSync();
  queue.push({
    ...input,
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    lastError: null,
  });
  writeQueueSync(queue);
}

export function getSettingsQueueCount(): number {
  return readQueueSync().length;
}

export async function processSettingsQueue(getHeaders: () => Promise<Record<string, string>>) {
  if (!isOnline()) return;
  const queue = readQueueSync();
  if (queue.length === 0) return;

  const remaining: OfflineSettingsMutation[] = [];
  for (const item of queue) {
    try {
      const headers = await getHeaders();
      const response = await fetch(item.endpoint, {
        method: item.method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(item.body),
      });
      if (!response.ok) {
        throw new Error(`Failed (${response.status})`);
      }
    } catch (error) {
      remaining.push({
        ...item,
        retryCount: item.retryCount + 1,
        lastError: error instanceof Error ? error.message : "Failed to sync settings change.",
      });
    }
  }
  writeQueueSync(remaining);
}
