import { describe, it, expect, vi, beforeEach } from "vitest";
import { isOnline, subscribeNetworkStatus } from "@/lib/network-status";

describe("network-status", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("isOnline returns true when window undefined (SSR)", () => {
    // In jsdom, window exists; we test navigator.onLine variations
    const original = window.navigator.onLine;
    Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
    expect(isOnline()).toBe(true);
    Object.defineProperty(window.navigator, "onLine", { value: false, configurable: true });
    expect(isOnline()).toBe(false);
    Object.defineProperty(window.navigator, "onLine", { value: original, configurable: true });
  });

  it("subscribeNetworkStatus fires callbacks on online/offline", () => {
    const cb = vi.fn();
    const unsub = subscribeNetworkStatus(cb);
    window.dispatchEvent(new Event("online"));
    expect(cb).toHaveBeenCalledWith(true);
    window.dispatchEvent(new Event("offline"));
    expect(cb).toHaveBeenCalledWith(false);
    unsub();
  });

  it("unsubscribe removes listeners", () => {
    const cb = vi.fn();
    const unsub = subscribeNetworkStatus(cb);
    unsub();
    cb.mockClear();
    window.dispatchEvent(new Event("online"));
    expect(cb).not.toHaveBeenCalled();
  });
});
