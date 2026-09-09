import { describe, it, expect } from "vitest";
import {
  formatCompactDate,
  formatCompactDateTime,
  formatReadableDate,
  formatReadableDateTime,
} from "@/lib/date-format";

describe("date-format (Asia/Manila)", () => {
  const iso = "2026-04-05T08:14:00.000Z"; // 16:14 Manila (UTC+8)

  it("formatCompactDate returns YYYY-MM-DD in Manila TZ", () => {
    expect(formatCompactDate(iso)).toBe("2026-04-05");
  });

  it("formatCompactDate handles null/invalid", () => {
    expect(formatCompactDate(null)).toBe("");
    expect(formatCompactDate(undefined)).toBe("");
    expect(formatCompactDate("not-a-date")).toBe("");
    expect(formatCompactDate("")).toBe("");
  });

  it("formatCompactDateTime returns YYYY-MM-DD HH:MM", () => {
    const result = formatCompactDateTime(iso);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    // 08:14Z = 16:14 Manila
    expect(result).toBe("2026-04-05 16:14");
  });

  it("formatCompactDateTime handles null/invalid", () => {
    expect(formatCompactDateTime(null)).toBe("");
    expect(formatCompactDateTime("invalid")).toBe("");
  });

  it("formatReadableDate returns localized date", () => {
    const result = formatReadableDate(iso);
    expect(result).toContain("2026");
    expect(result).toContain("Apr");
    expect(formatReadableDate(null)).toBe("");
  });

  it("formatReadableDateTime returns localized datetime", () => {
    const result = formatReadableDateTime(iso);
    expect(result).toContain("2026");
    expect(result.length).toBeGreaterThan(10);
    expect(formatReadableDateTime(undefined)).toBe("");
  });

  it("handles edge: midnight crossing due to TZ", () => {
    // 2026-04-05T16:00Z = 2026-04-06 00:00 Manila
    expect(formatCompactDate("2026-04-05T16:00:00.000Z")).toBe("2026-04-06");
  });
});
