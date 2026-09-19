import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireAdminRequest = vi.fn();
const mockCreateAuditLog = vi.fn();
const mockGetRequestIp = vi.fn().mockReturnValue("127.0.0.1");
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();

const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
}));

mockSelect.mockReturnValue({ order: mockOrder });
mockOrder.mockReturnValue({ limit: mockLimit });
mockLimit.mockResolvedValue({ data: [{ ticket_id: "TKT-0010" }] });
mockInsert.mockResolvedValue({ error: null });

vi.mock("@/lib/server/request-auth", () => ({
  requireAdminRequest: (...args: unknown[]) => mockRequireAdminRequest(...args),
  getAuthErrorStatus: (err: unknown) => {
    if (err instanceof Error) {
      if (err.message.includes("token") || err.message.includes("session")) return 401;
      if (err.message.includes("Admin")) return 403;
    }
    return null;
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({
    from: mockFrom,
  }),
}));

vi.mock("@/lib/server/audit-log-repository", () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));

vi.mock("@/lib/server/request-meta", () => ({
  getRequestIp: (...args: unknown[]) => mockGetRequestIp(...args),
}));

import { POST } from "@/app/api/transactions/import/route";

describe("POST /api/transactions/import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
    mockLimit.mockResolvedValue({ data: [{ ticket_id: "TKT-0010" }] });
  });

  it("returns 200 and imports valid rows", async () => {
    mockRequireAdminRequest.mockResolvedValue({ id: "admin-1", name: "Admin", role: "admin" });
    mockCreateAuditLog.mockResolvedValue({});

    const request = new Request("http://localhost:3000/api/transactions/import", {
      method: "POST",
      body: JSON.stringify({
        rows: [
          { customerName: "Maria Santos", washType: "Wash & Dry", weight: 5, fee: 150, status: "Received" },
          { customerName: "Juan Dela Cruz", washType: "Wash Only", weight: 3, fee: 90, status: "Claimed" },
        ],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.importedCount).toBe(2);
    expect(data.skippedCount).toBe(0);
  });

  it("skips rows with missing customerName", async () => {
    mockRequireAdminRequest.mockResolvedValue({ id: "admin-1", name: "Admin", role: "admin" });
    mockCreateAuditLog.mockResolvedValue({});

    const request = new Request("http://localhost:3000/api/transactions/import", {
      method: "POST",
      body: JSON.stringify({
        rows: [
          { customerName: "", washType: "Regular", fee: 50 },
          { customerName: "Valid Customer", washType: "Regular", fee: 100 },
        ],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.importedCount).toBe(1);
    expect(data.skippedCount).toBe(1);
    expect(data.skippedRows).toEqual([1]);
  });

  it("returns 400 when rows is not an array", async () => {
    mockRequireAdminRequest.mockResolvedValue({ id: "admin-1", name: "Admin", role: "admin" });

    const request = new Request("http://localhost:3000/api/transactions/import", {
      method: "POST",
      body: JSON.stringify({ invalid: true }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 403 for non-admin", async () => {
    mockRequireAdminRequest.mockRejectedValue(new Error("Admin access is required."));

    const request = new Request("http://localhost:3000/api/transactions/import", {
      method: "POST",
      body: JSON.stringify({ rows: [] }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
  });
});
