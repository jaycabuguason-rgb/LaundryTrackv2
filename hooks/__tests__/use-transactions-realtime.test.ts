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

    (globalThis.fetch as any).mockClear();

    await act(async () => {
      channelCallbacks["INSERT"]?.({ new: null });
    });

    // Fallback refresh should have fired
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/transactions", expect.any(Object));
  });
});
