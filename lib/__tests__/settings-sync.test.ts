import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  syncServerSettingsToClient,
  loadPricingConfig,
  loadServiceTypes,
  loadAddOns,
  loadLoyaltySettings,
  loadBusinessProfile,
  LS_PRICING_CONFIG,
} from "@/lib/settings-store";

describe("syncServerSettingsToClient", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("fetches settings from /api/settings and persists them to localStorage", async () => {
    const mockPricing = {
      pricePerKg: "45",
      minWeight: "3",
      pricingMode: "per-kg" as const,
      loadTiers: [],
      priceDisplayMode: "show" as const,
      enablePaymentOption: false,
    };
    const mockServices = [
      { id: "s1", name: "Wash & Fold", description: "", price: "50", pricingType: "per-kg" as const, active: true, showPrice: true },
    ];
    const mockAddOns = [
      { id: "a1", name: "Softener", rate: "20" },
    ];
    const mockLoyalty = {
      enabled: false,
      washesPerReward: "5",
      rewardDescription: "Discount",
    };
    const mockBusiness = {
      shopName: "Cloud Laundry",
      tagline: "Fast & Clean",
      address: "123 Main St",
      contactNumber: "09123456789",
      email: "info@cloudlaundry.com",
      receiptFooter: "Thank you",
      pickupInstructions: "Present claim code",
      logoDataUrl: "",
      receiptPaperWidth: "80mm" as const,
      receiptShowLogo: true,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        pricingConfig: mockPricing,
        serviceTypes: mockServices,
        addOns: mockAddOns,
        loyaltySettings: mockLoyalty,
        businessProfile: mockBusiness,
      }),
    } as Response);

    const success = await syncServerSettingsToClient();
    expect(success).toBe(true);

    const pricing = loadPricingConfig();
    expect(pricing.pricePerKg).toBe("45");
    expect(pricing.enablePaymentOption).toBe(false);

    const services = loadServiceTypes();
    expect(services.length).toBe(1);
    expect(services[0].name).toBe("Wash & Fold");

    const addOns = loadAddOns();
    expect(addOns.length).toBe(1);
    expect(addOns[0].name).toBe("Softener");

    const loyalty = loadLoyaltySettings();
    expect(loyalty.enabled).toBe(false);

    const business = loadBusinessProfile();
    expect(business.shopName).toBe("Cloud Laundry");
  });

  it("returns false gracefully if the API call fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network Error"));

    const success = await syncServerSettingsToClient();
    expect(success).toBe(false);
  });
});
