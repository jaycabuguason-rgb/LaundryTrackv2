import { describe, it, expect } from "vitest";
import { formatArrivalDateTime } from "@/lib/format-arrival-time";

describe("formatArrivalDateTime", () => {
  it("returns em dash for null/undefined/empty", () => {
    expect(formatArrivalDateTime(null)).toBe("—");
    expect(formatArrivalDateTime(undefined)).toBe("—");
    expect(formatArrivalDateTime("")).toBe("—");
  });

  it("formats ISO string to YYYY-MM-DD HH:MM", () => {
    const iso = "2026-05-04T14:30:00.000Z";
    const result = formatArrivalDateTime(iso);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it("formats Date object", () => {
    const d = new Date(2026, 0, 15, 9, 5); // Jan 15 09:05 local
    expect(formatArrivalDateTime(d)).toBe("2026-01-15 09:05");
  });

  it("preserves already-formatted string if invalid date", () => {
    expect(formatArrivalDateTime("2026-05-04 14:30 confirmed")).toBe("2026-05-04 14:30");
  });

  it("returns em dash for invalid unparseable string", () => {
    expect(formatArrivalDateTime("not-a-date")).toBe("—");
  });

  it("pads month/day/hours/minutes", () => {
    const d = new Date(2026, 0, 2, 3, 4);
    expect(formatArrivalDateTime(d)).toBe("2026-01-02 03:04");
  });
});
