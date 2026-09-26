import { describe, it, expect } from "vitest";
import { getLoyaltySettings, setMockLoyaltySettings } from "../loyalty-repository";
import { saveSettings } from "../laundry-repository";

describe("Loyalty Settings Server Repository", () => {
  it("returns loyalty_enabled: false when loyalty_settings is saved with enabled: false", async () => {
    await saveSettings("loyalty_settings", {
      enabled: false,
      washesPerReward: 7,
      rewardDescription: "Free wash",
    });

    const settings = await getLoyaltySettings();
    expect(settings.loyalty_enabled).toBe(false);
  });

  it("returns loyalty_enabled: true when loyalty_settings is saved with enabled: true", async () => {
    await setMockLoyaltySettings({
      enabled: true,
      washesPerReward: 7,
      rewardDescription: "Free wash",
    });

    const settings = await getLoyaltySettings();
    expect(settings.loyalty_enabled).toBe(true);
  });
});
