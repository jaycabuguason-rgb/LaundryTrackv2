import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireAuthRequest = vi.fn();
const mockListAuditLogs = vi.fn();
const mockCreateAuditLog = vi.fn();
const mockGetRequestIp = vi.fn().mockReturnValue("127.0.0.1");

vi.mock("@/lib/server/request-auth", () => ({
  requireAuthRequest: (...args: unknown[]) => mockRequireAuthRequest(...args),
  getAuthErrorStatus: (err: unknown) => {
    if (err instanceof Error && (err.message.includes("token") || err.message.includes("session"))) {
      return 401;
    }
    return null;
  },
}));

vi.mock("@/lib/server/audit-log-repository", () => ({
  listAuditLogs: (...args: unknown[]) => mockListAuditLogs(...args),
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));

vi.mock("@/lib/server/request-meta", () => ({
  getRequestIp: (...args: unknown[]) => mockGetRequestIp(...args),
}));

import { GET, POST } from "@/app/api/audit-logs/route";

describe("Audit Logs API Route Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/audit-logs", () => {
    it("returns 200 and audit logs for authenticated staff", async () => {
      mockRequireAuthRequest.mockResolvedValue({
        id: "staff-1",
        name: "Staff Member",
        role: "staff",
      });
      mockListAuditLogs.mockResolvedValue([
        {
          id: "log-1",
          action: "claim_verified",
          summary: "Verified claim for TKT-0001",
          ticketId: "TKT-0001",
        },
      ]);

      const request = new Request("http://localhost:3000/api/audit-logs");
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.auditLogs).toHaveLength(1);
      expect(data.auditLogs[0].ticketId).toBe("TKT-0001");
      expect(mockRequireAuthRequest).toHaveBeenCalledWith(request);
    });

    it("returns 401 when not authenticated", async () => {
      mockRequireAuthRequest.mockRejectedValue(new Error("Missing authorization token."));

      const request = new Request("http://localhost:3000/api/audit-logs");
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Missing authorization token.");
    });
  });

  describe("POST /api/audit-logs", () => {
    it("creates an audit log with correlation ID and returns 201", async () => {
      mockRequireAuthRequest.mockResolvedValue({
        id: "staff-2",
        name: "Counter Staff",
        role: "staff",
      });

      const fakeEntry = {
        id: "log-2",
        timestamp: "2026-09-18T10:00:00.000Z",
        staffName: "Counter Staff",
        staffRole: "Staff",
        action: "claim_scanned",
        summary: "Scanned ticket TKT-0005",
        details: "Via QR Scan",
        ticketId: "TKT-0005",
        customerName: "Maria Santos",
        paymentStatus: "paid",
        clientCorrelationId: "corr_12345",
      };

      mockCreateAuditLog.mockResolvedValue(fakeEntry);

      const request = new Request("http://localhost:3000/api/audit-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "claim_scanned",
          ticketId: "TKT-0005",
          summary: "Scanned ticket TKT-0005",
          details: "Via QR Scan",
          customerName: "Maria Santos",
          paymentStatus: "paid",
          correlationId: "corr_12345",
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.auditLog).toEqual(fakeEntry);
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "claim_scanned",
          ticketId: "TKT-0005",
          staffName: "Counter Staff",
          staffRole: "staff",
          staffProfileId: "staff-2",
          metadata: expect.objectContaining({
            correlationId: "corr_12345",
            source: "api/audit-logs#post",
          }),
        }),
      );
    });

    it("returns 400 when action is missing", async () => {
      mockRequireAuthRequest.mockResolvedValue({
        id: "staff-2",
        name: "Staff",
        role: "staff",
      });

      const request = new Request("http://localhost:3000/api/audit-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: "TKT-0001" }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Action is required.");
    });

    it("returns 401 when unauthenticated", async () => {
      mockRequireAuthRequest.mockRejectedValue(new Error("Your session is invalid or has expired."));

      const request = new Request("http://localhost:3000/api/audit-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim_scanned" }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
    });
  });
});
