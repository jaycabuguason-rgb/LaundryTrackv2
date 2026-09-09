import { describe, it, expect } from "vitest";
import { normalizeBusinessProfile, DEFAULT_BUSINESS_PROFILE } from "@/lib/business-profile";

describe("business-profile", () => {
  it("returns defaults for null/undefined", () => {
    expect(normalizeBusinessProfile(null)).toEqual(DEFAULT_BUSINESS_PROFILE);
    expect(normalizeBusinessProfile(undefined)).toEqual(DEFAULT_BUSINESS_PROFILE);
  });

  it("merges partial over defaults", () => {
    const result = normalizeBusinessProfile({ shopName: "Test Shop" });
    expect(result.shopName).toBe("Test Shop");
    expect(result.tagline).toBe(DEFAULT_BUSINESS_PROFILE.tagline);
    expect(result.address).toBe(DEFAULT_BUSINESS_PROFILE.address);
  });

  it("preserves new fields like receiptPaperWidth", () => {
    const result = normalizeBusinessProfile({ receiptPaperWidth: "58mm" });
    expect(result.receiptPaperWidth).toBe("58mm");
    expect(result.receiptShowLogo).toBe(true); // default
  });

  it("handles empty partial object", () => {
    expect(normalizeBusinessProfile({})).toEqual(DEFAULT_BUSINESS_PROFILE);
  });

  it("does not mutate defaults", () => {
    const before = { ...DEFAULT_BUSINESS_PROFILE };
    normalizeBusinessProfile({ shopName: "Mutated" });
    expect(DEFAULT_BUSINESS_PROFILE).toEqual(before);
  });
});
