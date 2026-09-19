import { describe, it, expect } from "vitest";

import { validateBackupPayload } from "@/lib/server/backup-repository";

describe("validateBackupPayload", () => {
  it("returns true for valid payload", () => {
    const valid = {
      meta: {
        appName: "LaundryTrack",
        version: "1.0",
        exportedAt: new Date().toISOString(),
        exportedBy: "Admin",
        tableRecordCounts: {},
      },
      data: {
        settings: [],
        service_types: [],
        add_ons: [],
        loyalty_members: [],
        transactions: [],
      },
    };

    expect(validateBackupPayload(valid)).toBe(true);
  });

  it("returns false if meta is missing", () => {
    expect(validateBackupPayload({ data: {} })).toBe(false);
  });

  it("returns false if appName is not LaundryTrack", () => {
    const payload = {
      meta: { appName: "OtherApp", version: "1.0", exportedAt: "now" },
      data: { settings: [], transactions: [], loyalty_members: [] },
    };
    expect(validateBackupPayload(payload)).toBe(false);
  });

  it("returns false if data arrays are missing", () => {
    const payload = {
      meta: { appName: "LaundryTrack", version: "1.0", exportedAt: "now" },
      data: { settings: "not-an-array" },
    };
    expect(validateBackupPayload(payload)).toBe(false);
  });

  it("returns false for null or undefined", () => {
    expect(validateBackupPayload(null)).toBe(false);
    expect(validateBackupPayload(undefined)).toBe(false);
    expect(validateBackupPayload("string")).toBe(false);
  });
});
