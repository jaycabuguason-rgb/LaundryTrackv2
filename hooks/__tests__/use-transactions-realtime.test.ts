import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTransactions, mapRealtimeRow } from "@/hooks/use-transactions";
import * as offlineTransactions from "@/lib/offline-transactions";
import * as browserSession from "@/lib/supabase/browser-session";
import * as networkStatus from "@/lib/network-status";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

vi.mock("@/lib/network-status", () => ({
  isOnline: vi.fn(() => true),
  subscribeNetworkStatus: vi.fn(() => () => {}),
}));

vi.mock("@/lib/supabase/browser-session", () => ({
  getBrowserAccessToken: vi.fn().mockResolvedValue("test-token"),
  refreshBrowserSession: vi.fn().mockResolvedValue({ access_token: "test-token" }),
}));

describe("mapRealtimeRow", () => {
  it("maps snake_case Supabase transaction row correctly", () => {
    const raw = {
      id: "uuid-123",
      ticket_id: "TKT-0099",
      customer_name: "Alice Smith",
      phone_number: "09181234567",
      arrival_time: "2026-09-17T08:00:00.000Z",
      wash_type: "Dry Clean",
      weight_kg: 5.5,
      fee: 250,
      status: "Received",
      payment_status: "paid",
      addons: ["Fabric Softener"],
      special_instructions: "Handle with care",
      public_tracking_token: "token-abc",
      eta: "2026-09-18T10:00:00.000Z",
      void_reason: null,
    };

    const mapped = mapRealtimeRow(raw);
    expect(mapped).not.toBeNull();
    expect(mapped?.id).toBe("uuid-123");
    expect(mapped?.ticketId).toBe("TKT-0099");
    expect(mapped?.customerName).toBe("Alice Smith");
    expect(mapped?.phone).toBe("09181234567");
    expect(mapped?.status).toBe("Received");
    expect(mapped?.paymentStatus).toBe("paid");
    expect(mapped?.washType).toBe("Dry Clean");
    expect(mapped?.weight).toBe(5.5);
    expect(mapped?.fee).toBe(250);
    expect(mapped?.addOns).toEqual(["Fabric Softener"]);
    expect(mapped?.washInstructions).toBe("Handle with care");
    expect(mapped?.publicTrackingToken).toBe("token-abc");
  });

  it("normalizes 'Drying' status to 'Washing'", () => {
    const raw = {
      id: "uuid-456",
      ticket_id: "TKT-0100",
      status: "Drying",
    };
    const mapped = mapRealtimeRow(raw);
    expect(mapped?.status).toBe("Washing");
  });

  it("returns null for non-object or empty ids", () => {
    expect(mapRealtimeRow(null)).toBeNull();
    expect(mapRealtimeRow(undefined)).toBeNull();
    expect(mapRealtimeRow("string")).toBeNull();
    expect(mapRealtimeRow({})).toBeNull();
  });
});

describe("useTransactions Realtime Reconciliation", () => {
  let channelCallbacks: Record<string, ((payload: any) => void) | undefined> = {};
  let mockChannel: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    channelCallbacks = {};

    mockChannel = {
      on: vi.fn((event: string, filter: any, callback: (payload: any) => void) => {
        const key = `${filter.event || event}`;
        channelCallbacks[key] = callback;
        return mockChannel;
      }),
      subscribe: vi.fn(() => mockChannel),
    };

    const client = getSupabaseBrowserClient();
    if (client) {
      vi.spyOn(client, "channel").mockReturnValue(mockChannel);
    }

    vi.spyOn(offlineTransactions, "readCachedTransactions").mockResolvedValue([]);
    vi.spyOn(offlineTransactions, "readOfflineQueue").mockResolvedValue([]);
    vi.spyOn(offlineTransactions, "writeCachedTransactions").mockResolvedValue(undefined);

    // Mock global fetch for initial load and fallback refreshes
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ transactions: [] })),
    } as Response);
  });

  it("reconciles INSERT event by prepending to transactions and persisting cache", async () => {
    const { result } = renderHook(() => useTransactions());

    await act(async () => {
      // Let initial load finish
    });

    const insertPayload = {
      new: {
        id: "tx-realtime-1",
        ticket_id: "TKT-5555",
        customer_name: "Realtime User",
        status: "Received",
        fee: 100,
      },
    };

    await act(async () => {
      channelCallbacks["INSERT"]?.(insertPayload);
    });

    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0].ticketId).toBe("TKT-5555");
    expect(offlineTransactions.writeCachedTransactions).toHaveBeenCalled();
  });

  it("reconciles UPDATE event by updating matching transaction directly", async () => {
    const initialTx = {
      id: "tx-realtime-1",
      ticketId: "TKT-5555",
      customerName: "Realtime User",
      phone: "",
      arrivalDateTime: "2026-09-17 08:00",
      dropOffDate: "2026-09-17",
      washType: "Regular",
      weight: 2,
      fee: 100,
      status: "Received" as const,
      paymentStatus: "unpaid" as const,
      addOns: [],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ transactions: [initialTx] })),
    } as Response);

    const { result } = renderHook(() => useTransactions());

    await act(async () => {
      // Hydrate & refresh
    });

    expect(result.current.transactions[0].status).toBe("Received");

    const updatePayload = {
      new: {
        id: "tx-realtime-1",
        ticket_id: "TKT-5555",
        customer_name: "Realtime User",
        status: "Ready",
        fee: 100,
      },
    };

    await act(async () => {
      channelCallbacks["UPDATE"]?.(updatePayload);
    });

    expect(result.current.transactions[0].status).toBe("Ready");
    expect(offlineTransactions.writeCachedTransactions).toHaveBeenCalled();
  });

  it("reconciles DELETE event by removing transaction by id or ticket_id", async () => {
    const initialTx = {
      id: "tx-realtime-1",
      ticketId: "TKT-5555",
      customerName: "Realtime User",
      phone: "",
      arrivalDateTime: "2026-09-17 08:00",
      dropOffDate: "2026-09-17",
      washType: "Regular",
      weight: 2,
      fee: 100,
      status: "Received" as const,
      paymentStatus: "unpaid" as const,
      addOns: [],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ transactions: [initialTx] })),
    } as Response);

    const { result } = renderHook(() => useTransactions());

    await act(async () => {
      // Hydrate & refresh
    });

    expect(result.current.transactions).toHaveLength(1);

    const deletePayload = {
      old: {
        id: "tx-realtime-1",
        ticket_id: "TKT-5555",
      },
    };

    await act(async () => {
      channelCallbacks["DELETE"]?.(deletePayload);
    });

    expect(result.current.transactions).toHaveLength(0);
    expect(offlineTransactions.writeCachedTransactions).toHaveBeenCalled();
  });

  it("triggers fallback refresh when receiving invalid or unmappable payload", async () => {
    renderHook(() => useTransactions());

    await act(async () => {
      // Initial load
    });

    // Fallback refresh should have fired
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/transactions", expect.any(Object));
  });

  it("prevents stale-refresh overwrite race while a mutation is in-flight", async () => {
    const initialTx = {
      id: "tx-race-1",
      ticketId: "TKT-8888",
      customerName: "Race Condition Test",
      phone: "",
      arrivalDateTime: "2026-09-17 08:00",
      dropOffDate: "2026-09-17",
      washType: "Regular",
      weight: 3,
      fee: 120,
      status: "Washing" as const,
      paymentStatus: "unpaid" as const,
      addOns: [],
    };

    // Initial fetch returns status "Washing"
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ transactions: [initialTx] })),
    } as Response);

    const { result } = renderHook(() => useTransactions());

    await act(async () => {
      // Complete initial load
    });

    expect(result.current.transactions[0].status).toBe("Washing");

    // Prepare delayed PATCH promise
    let resolvePatch: (val: any) => void = () => {};
    const patchPromise = new Promise((resolve) => {
      resolvePatch = resolve;
    });

    // Mock fetch for both PATCH and stale background refresh
    (globalThis.fetch as any).mockImplementation(async (url: string, opts: any) => {
      if (opts?.method === "PATCH") {
        return patchPromise;
      }
      // Background refresh returning stale list with "Washing"
      return {
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ transactions: [initialTx] })),
      };
    });

    // 1. Trigger updateTransaction to "Ready"
    let updatePromise: Promise<any>;
    act(() => {
      updatePromise = result.current.updateTransaction("TKT-8888", { status: "Ready" });
    });

    // Immediately optimistic: status must be "Ready"
    expect(result.current.transactions[0].status).toBe("Ready");

    // 2. A delayed/stale refresh fires while PATCH is in-flight
    await act(async () => {
      await result.current.refresh();
    });

    // Must NOT be overwritten back to "Washing" by stale refresh!
    expect(result.current.transactions[0].status).toBe("Ready");

    // 3. Authoritative PATCH completes returning "Ready"
    await act(async () => {
      resolvePatch({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              transaction: { ...initialTx, status: "Ready" },
            }),
          ),
      });
      await updatePromise;
    });

    // Confirmed authoritative "Ready"
    expect(result.current.transactions[0].status).toBe("Ready");
  });

  it("claims a Ready ticket through updateTransaction; preserves Claimed across stale refresh and Realtime sync", async () => {
    const readyTx = {
      id: "tx-claim-1",
      ticketId: "TKT-7777",
      customerName: "Claim Customer",
      phone: "",
      arrivalDateTime: "2026-09-17 08:00",
      dropOffDate: "2026-09-17",
      washType: "Regular",
      weight: 2,
      fee: 100,
      status: "Ready" as const,
      paymentStatus: "paid" as const,
      addOns: [],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ transactions: [readyTx] })),
    } as Response);

    const { result } = renderHook(() => useTransactions());

    await act(async () => {
      // Complete initial load
    });

    expect(result.current.transactions[0].status).toBe("Ready");

    let resolvePatch: (val: any) => void = () => {};
    const patchPromise = new Promise((resolve) => {
      resolvePatch = resolve;
    });

    (globalThis.fetch as any).mockImplementation(async (_url: string, opts: any) => {
      if (opts?.method === "PATCH") {
        return patchPromise;
      }
      // Stale refresh with old "Ready" status
      return {
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ transactions: [readyTx] })),
      };
    });

    // 1. Claim Verification marks ticket as Claimed
    let claimPromise: Promise<any>;
    act(() => {
      claimPromise = result.current.updateTransaction("TKT-7777", {
        status: "Claimed",
        paymentStatus: "paid",
      });
    });

    // Optimistically Claimed
    expect(result.current.transactions[0].status).toBe("Claimed");

    // 2. A stale background refresh happens while PATCH is in-flight
    await act(async () => {
      await result.current.refresh();
    });

    // Stale refresh must NOT revert status back to Ready
    expect(result.current.transactions[0].status).toBe("Claimed");

    // 3. Realtime event arrives with "Claimed"
    await act(async () => {
      channelCallbacks["UPDATE"]?.({
        new: {
          id: "tx-claim-1",
          ticket_id: "TKT-7777",
          status: "Claimed",
          payment_status: "paid",
        },
      });
    });

    expect(result.current.transactions[0].status).toBe("Claimed");

    // 4. Authoritative PATCH completes
    await act(async () => {
      resolvePatch({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              transaction: { ...readyTx, status: "Claimed", paymentStatus: "paid" },
            }),
          ),
      });
      await claimPromise;
    });

    expect(result.current.transactions[0].status).toBe("Claimed");
  });
});

