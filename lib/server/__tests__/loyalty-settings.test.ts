import { describe, it, expect, beforeEach } from "vitest";
import { getLoyaltySettings, getPublicLoyaltyMemberRecord, awardClaimStamp } from "../loyalty-repository";
import { saveSettings } from "../laundry-repository";

describe("Loyalty Program Settings & Public Exposure", () => {
  beforeEach(async () => {
    // Reset to default enabled
    await saveSettings("loyalty_settings", {
      enabled: true,
      washesPerReward: 7,
      rewardDescription: "Free wash",
    });
  });

  it("returns loyalty_enabled: true when loyalty program is enabled", async () => {
    const settings = await getLoyaltySettings();
    expect(settings.loyalty_enabled).toBe(true);
    expect(settings.washes_per_reward).toBe(7);
  });

  it("returns loyalty_enabled: false when loyalty program is disabled", async () => {
    await saveSettings("loyalty_settings", {
      enabled: false,
      washesPerReward: 10,
      rewardDescription: "50 pesos load",
    });

    const settings = await getLoyaltySettings();
    expect(settings.loyalty_enabled).toBe(false);
  });

  it("returns null for getPublicLoyaltyMemberRecord when loyalty program is disabled", async () => {
    // Disable loyalty
    await saveSettings("loyalty_settings", {
      enabled: false,
      washesPerReward: 7,
      rewardDescription: "Free wash",
    });

    // Even if a valid member identifier is passed, it returns null
    const result = await getPublicLoyaltyMemberRecord("Maria Santos");
    expect(result).toBeNull();
  });

  it("refuses to award claim stamp when loyalty program is disabled", async () => {
    // Disable loyalty
    await saveSettings("loyalty_settings", {
      enabled: false,
      washesPerReward: 7,
      rewardDescription: "Free wash",
    });

    const result = await awardClaimStamp("tx-123", "09171234567", null);
    expect(result).toEqual({
      stamped: false,
      reason: "Loyalty program is disabled",
    });
  });
});
