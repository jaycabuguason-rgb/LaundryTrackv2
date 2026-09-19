import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireAdminRequest = vi.fn();
const mockExportDatabaseBackup = vi.fn();
const mockRestoreDatabaseBackup = vi.fn();
const mockValidateBackupPayload = vi.fn();
const mockCreateAuditLog = vi.fn();
const mockGetRequestIp = vi.fn().mockReturnValue("127.0.0.1");

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

vi.mock("@/lib/server/backup-repository", () => ({
  exportDatabaseBackup: (...args: unknown[]) => mockExportDatabaseBackup(...args),
  restoreDatabaseBackup: (...args: unknown[]) => mockRestoreDatabaseBackup(...args),
  validateBackupPayload: (...args: unknown[]) => mockValidateBackupPayload(...args),
}));

vi.mock("@/lib/server/audit-log-repository", () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));

vi.mock("@/lib/server/request-meta", () => ({
  getRequestIp: (...args: unknown[]) => mockGetRequestIp(...args),
}));

import { GET } from "@/app/api/backup/export/route";
import { POST } from "@/app/api/backup/restore/route";

describe("Backup API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/backup/export", () => {
    it("returns 200 with backup payload for admin", async () => {
      mockRequireAdminRequest.mockResolvedValue({ id: "admin-1", name: "Admin", role: "admin" });
      mockExportDatabaseBackup.mockResolvedValue({
        meta: { appName: "LaundryTrack", version: "1.0", tableRecordCounts: { transactions: 5 } },
        data: {},
      });
      mockCreateAuditLog.mockResolvedValue({});

      const response = await GET(new Request("http://localhost:3000/api/backup/export"));
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.meta.appName).toBe("LaundryTrack");
    });

    it("returns 403 for non-admin", async () => {
      mockRequireAdminRequest.mockRejectedValue(new Error("Admin access is required."));
      const response = await GET(new Request("http://localhost:3000/api/backup/export"));
      expect(response.status).toBe(403);
    });

    it("returns 401 when unauthenticated", async () => {
      mockRequireAdminRequest.mockRejectedValue(new Error("Missing authorization token."));
      const response = await GET(new Request("http://localhost:3000/api/backup/export"));
      expect(response.status).toBe(401);
    });
  });

  describe("POST /api/backup/restore", () => {
    it("returns 200 on successful restore", async () => {
      mockRequireAdminRequest.mockResolvedValue({ id: "admin-1", name: "Admin", role: "admin" });
      mockValidateBackupPayload.mockReturnValue(true);
      mockRestoreDatabaseBackup.mockResolvedValue({
        settingsRestored: 2,
        membersRestored: 3,
        transactionsRestored: 10,
        serviceTypesRestored: 1,
        addOnsRestored: 1,
      });
      mockCreateAuditLog.mockResolvedValue({});

      const validPayload = {
        meta: { appName: "LaundryTrack", version: "1.0", exportedAt: "2026-01-01" },
        data: { settings: [], transactions: [], loyalty_members: [] },
      };

      const request = new Request("http://localhost:3000/api/backup/restore", {
        method: "POST",
        body: JSON.stringify(validPayload),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.result.transactionsRestored).toBe(10);
    });

    it("returns 400 for invalid backup payload", async () => {
      mockRequireAdminRequest.mockResolvedValue({ id: "admin-1", name: "Admin", role: "admin" });
      mockValidateBackupPayload.mockReturnValue(false);

      const request = new Request("http://localhost:3000/api/backup/restore", {
        method: "POST",
        body: JSON.stringify({ invalid: true }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain("Invalid backup file");
    });
  });
});
