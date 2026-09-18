import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuditLogs, mapRealtimeAuditRow } from "@/hooks/use-audit-logs";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/browser-session", () => ({
  getBrowserAccessToken: vi.fn().mockResolvedValue("test-token"),
  refreshBrowserSession: vi.fn().mockResolvedValue({ access_token: "test-token" }),
}));

describe("mapRealtimeAuditRow", () => {
  it("maps snake_case audit log row with correlation ID correctly", () => {
    const raw = {
      id: "log-uuid-1",
      created_at: "2026-09-18T10:00:00.000Z",
      staff_name: "Juan Dela Cruz",
      staff_role: "staff",
      action: "claim_scanned",
      summary: "Scanned ticket TKT-0010",
      notes: "Via QR Scan",
      ticket_id: "TKT-0010",
      customer_name: "Ana Reyes",
      payment_status: "paid",
      ip_address: "192.168.1.1",
      metadata: {
        correlationId: "corr_9999",
      },
    };

    const mapped = mapRealtimeAuditRow(raw);
    expect(mapped).not.toBeNull();
    expect(mapped?.id).toBe("log-uuid-1");
    expect(mapped?.timestamp).toBe("2026-09-18T10:00:00.000Z");
    expect(mapped?.staffName).toBe("Juan Dela Cruz");
    expect(mapped?.staffRole).toBe("Staff");
    expect(mapped?.action).toBe("claim_scanned");
    expect(mapped?.summary).toBe("Scanned ticket TKT-0010");
    expect(mapped?.details).toBe("Via QR Scan");
    expect(mapped?.ticketId).toBe("TKT-0010");
    expect(mapped?.customerName).toBe("Ana Reyes");
    expect(mapped?.paymentStatus).toBe("paid");
    expect(mapped?.clientCorrelationId).toBe("corr_9999");
  });

  it("returns null for non-object or invalid record", () => {
    expect(mapRealtimeAuditRow(null)).toBeNull();
    expect(mapRealtimeAuditRow(undefined)).toBeNull();
    expect(mapRealtimeAuditRow("string")).toBeNull();
    expect(mapRealtimeAuditRow({})).toBeNull();
  });
});

describe("useAuditLogs Realtime Reconciliation & Optimistic Updates", () => {
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

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ auditLogs: [] }),
    } as Response);
  });

  it("prepends an incoming Realtime INSERT row from another session", async () => {
    const { result } = renderHook(() => useAuditLogs());

    await act(async () => {
      // Allow initial load
    });

    const insertPayload = {
      new: {
        id: "log-realtime-1",
        created_at: "2026-09-18T11:00:00.000Z",
        staff_name: "Staff B",
        staff_role: "staff",
        action: "claim_scanned",
        summary: "Scanned ticket TKT-0077",
        ticket_id: "TKT-0077",
      },
    };

    await act(async () => {
      channelCallbacks["INSERT"]?.(insertPayload);
    });

    expect(result.current.auditLogs).toHaveLength(1);
    expect(result.current.auditLogs[0].id).toBe("log-realtime-1");
    expect(result.current.auditLogs[0].ticketId).toBe("TKT-0077");
  });

  it("creates an optimistic pending row on logVerificationEvent and replaces it upon server response", async () => {
    const serverLog = {
      id: "log-server-123",
      timestamp: "2026-09-18T11:05:00.000Z",
      staffName: "Staff A",
      staffRole: "Staff",
      action: "claim_scanned",
      summary: "Scanned ticket TKT-0088",
      details: "Via QR Scan",
      ticketId: "TKT-0088",
    };

    let resolveFetch: (val: any) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    globalThis.fetch = vi.fn().mockImplementation((url, init) => {
      if (init?.method === "POST") {
        return fetchPromise;
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ auditLogs: [] }),
      });
    });

    const { result } = renderHook(() => useAuditLogs());

    await act(async () => {
      // Initial load
    });

    let logPromise: Promise<any>;
    act(() => {
      logPromise = result.current.logVerificationEvent({
        action: "claim_scanned",
        ticketId: "TKT-0088",
        summary: "Scanned ticket TKT-0088",
        details: "Via QR Scan",
      });
    });

    // Immediately after calling, an optimistic pending row must exist
    expect(result.current.auditLogs).toHaveLength(1);
    expect(result.current.auditLogs[0].ticketId).toBe("TKT-0088");
    expect(result.current.auditLogs[0].isPending).toBe(true);
    expect(result.current.auditLogs[0].id).toMatch(/^temp_corr_/);

    // Resolve POST
    await act(async () => {
      resolveFetch!({
        ok: true,
        json: () => Promise.resolve({ auditLog: serverLog }),
      });
      await logPromise;
    });

    // Optimistic entry is replaced with server entry, no duplicates
    expect(result.current.auditLogs).toHaveLength(1);
    expect(result.current.auditLogs[0].id).toBe("log-server-123");
    expect(result.current.auditLogs[0].isPending).toBeFalsy();
  });

  it("reconciles Realtime INSERT by correlation ID if Realtime arrives before POST resolves", async () => {
    let capturedCorrelationId = "";
    globalThis.fetch = vi.fn().mockImplementation((url, init) => {
      if (init?.method === "POST") {
        const body = JSON.parse(init.body);
        capturedCorrelationId = body.correlationId;
        // Never resolve POST to simulate slower HTTP response
        return new Promise(() => {});
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ auditLogs: [] }),
      });
    });

    const { result } = renderHook(() => useAuditLogs());

    await act(async () => {
      // Initial load
    });

    act(() => {
      void result.current.logVerificationEvent({
        action: "claim_denied",
        ticketId: "TKT-0099",
        details: "Wrong person",
      });
    });

    expect(result.current.auditLogs).toHaveLength(1);
    expect(result.current.auditLogs[0].isPending).toBe(true);

    const correlationId = result.current.auditLogs[0].clientCorrelationId;
    // Realtime delivers the INSERT row with the matching correlationId
    const realtimeRow = {
      new: {
        id: "log-realtime-persisted",
        created_at: "2026-09-18T11:10:00.000Z",
        staff_name: "Staff",
        staff_role: "staff",
        action: "claim_denied",
        summary: "claim_denied for TKT-0099",
        notes: "Wrong person",
        ticket_id: "TKT-0099",
        metadata: {
          correlationId,
        },
      },
    };

    await act(async () => {
      channelCallbacks["INSERT"]?.(realtimeRow);
    });

    // The pending entry is replaced, total count remains exactly 1
    expect(result.current.auditLogs).toHaveLength(1);
    expect(result.current.auditLogs[0].id).toBe("log-realtime-persisted");
    expect(result.current.auditLogs[0].action).toBe("claim_denied");
    expect(result.current.auditLogs[0].isPending).toBeFalsy();
  });

  it("ignores duplicate Realtime events when row ID already exists", async () => {
    const { result } = renderHook(() => useAuditLogs());

    await act(async () => {
      // Initial load
    });

    const payload = {
      new: {
        id: "duplicate-id-1",
        action: "claim_scanned",
        ticket_id: "TKT-0001",
      },
    };

    await act(async () => {
      channelCallbacks["INSERT"]?.(payload);
    });
    expect(result.current.auditLogs).toHaveLength(1);

    // Fire duplicate INSERT
    await act(async () => {
      channelCallbacks["INSERT"]?.(payload);
    });
    expect(result.current.auditLogs).toHaveLength(1);
  });

  it("marks optimistic entry as unsaved if POST fails", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url, init) => {
      if (init?.method === "POST") {
        return Promise.reject(new Error("Network disconnect"));
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ auditLogs: [] }),
      });
    });

    const { result } = renderHook(() => useAuditLogs());

    await act(async () => {
      // Initial load
    });

    await act(async () => {
      await result.current.logVerificationEvent({
        action: "claim_scanned",
        ticketId: "TKT-0050",
      });
    });

    expect(result.current.auditLogs).toHaveLength(1);
    expect(result.current.auditLogs[0].isPending).toBe(false);
    expect(result.current.auditLogs[0].isUnsaved).toBe(true);
  });

  it("falls back to safe refresh on malformed Realtime payload", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ auditLogs: [] }),
    });
    globalThis.fetch = fetchSpy;

    renderHook(() => useAuditLogs());

    await act(async () => {
      // Initial load
    });

    fetchSpy.mockClear();

    // Send malformed payload
    await act(async () => {
      channelCallbacks["INSERT"]?.({ new: "not-an-object" });
    });

    // Should trigger fallback refresh
    expect(fetchSpy).toHaveBeenCalledWith("/api/audit-logs", expect.any(Object));
  });
});
