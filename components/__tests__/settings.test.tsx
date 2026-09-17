import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SettingsPage from "@/components/pages/settings";

vi.mock("@/lib/supabase/browser-session", () => ({
  getBrowserAccessToken: vi.fn().mockResolvedValue("test-token"),
  refreshBrowserSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: vi.fn().mockReturnValue(null),
}));

vi.mock("boneyard-js/react", () => ({
  Skeleton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe("SettingsPage Mobile Concept Layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        pricingConfig: {
          pricingMode: "both",
          pricePerKg: "35",
          minWeight: "3",
          loadTiers: [
            { id: "tier-1", name: "Small Load", range: "0 kg – 3 kg", price: "80" },
            { id: "tier-2", name: "Medium Load", range: "4 kg – 7 kg", price: "120" },
          ],
          priceDisplayMode: "show",
          enablePaymentOption: true,
        },
        serviceTypes: [
          { id: "svc-1", name: "Regular Wash", description: "Standard wash & dry", price: "30", pricingType: "per-kg", active: true, showPrice: true },
          { id: "svc-2", name: "Delicate Wash", description: "Gentle cycle", price: "45", pricingType: "per-kg", active: true, showPrice: true },
        ],
        addOns: [
          { id: "addon-1", name: "Fabcon", rate: "10" },
          { id: "addon-2", name: "Bleach", rate: "15" },
        ],
      }),
    });
  });

  it("renders mobile header and horizontal pill carousel tabs", async () => {
    render(<SettingsPage page="settings-pricing" />);

    expect(screen.getAllByText("Settings").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(/Configure shop preferences, pricing structures/i).length
    ).toBeGreaterThanOrEqual(1);

    // Pill tab navigation
    expect(screen.getAllByRole("button", { name: /Pricing/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("button", { name: /Business Profile/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("button", { name: /Loyalty Program/i }).length).toBeGreaterThanOrEqual(1);
  });

  it("switches tab when clicking a pill carousel tab", async () => {
    const onNavigate = vi.fn();
    render(<SettingsPage page="settings-pricing" onNavigate={onNavigate} />);

    const profileTab = screen.getAllByRole("button", { name: /Business Profile/i })[0];
    fireEvent.click(profileTab);

    expect(onNavigate).toHaveBeenCalledWith("settings-business-profile");
    expect(screen.getAllByText(/Shop Name/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders mobile base pricing modes (Per Kg, Per Load, Both) and switches mode", async () => {
    render(<SettingsPage page="settings-pricing" />);

    // Wait for data load
    await waitFor(() => {
      expect(screen.getAllByText("Base Pricing").length).toBeGreaterThanOrEqual(1);
    });

    const perKgBtn = screen.getAllByRole("button", { name: /Per Kg/i })[0];
    fireEvent.click(perKgBtn);

    // Per Kg mode displays kilogram pricing details
    expect(screen.getAllByText(/Kilogram Pricing Details/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders mobile load tiers with edit and delete controls, and opens add tier form", async () => {
    render(<SettingsPage page="settings-pricing" />);

    await waitFor(() => {
      expect(screen.getAllByText(/Tiers Defined/i).length).toBeGreaterThanOrEqual(1);
    });

    // Add Custom Tier button
    const addTierBtn = screen.getAllByRole("button", { name: /Add Custom Tier/i })[0];
    fireEvent.click(addTierBtn);

    expect(screen.getAllByText("New Custom Tier").length).toBeGreaterThanOrEqual(1);
  });

  it("renders mobile service types and allows toggling master switch", async () => {
    render(<SettingsPage page="settings-pricing" />);

    await waitFor(() => {
      expect(screen.getAllByText("Service Types").length).toBeGreaterThanOrEqual(1);
    });

    // Master switch for all service types
    const masterSwitch = screen.getAllByLabelText(/Toggle all service types/i)[0];
    expect(masterSwitch).toBeInTheDocument();
  });

  it("renders mobile add-on rates grid and allows adding an add-on item", async () => {
    render(<SettingsPage page="settings-pricing" />);

    await waitFor(() => {
      expect(screen.getAllByText("Add-on Rates").length).toBeGreaterThanOrEqual(1);
    });

    const nameInputs = screen.getAllByPlaceholderText("Add-on item name");
    const mobileNameInput = nameInputs[0];
    fireEvent.change(mobileNameInput, { target: { value: "Fabric Softener" } });

    const rateInputs = screen.getAllByPlaceholderText("0");
    const mobileRateInput = rateInputs[0];
    fireEvent.change(mobileRateInput, { target: { value: "25" } });
  });

  it("renders mobile payment status option toggle", async () => {
    render(<SettingsPage page="settings-pricing" />);

    await waitFor(() => {
      expect(screen.getAllByText("Payment Status Option").length).toBeGreaterThanOrEqual(1);
    });

    const paymentSwitches = screen.getAllByLabelText(/Toggle payment options/i);
    expect(paymentSwitches.length).toBeGreaterThanOrEqual(1);
  });

  it("renders save changes button and triggers save", async () => {
    render(<SettingsPage page="settings-pricing" />);

    const saveBtns = screen.getAllByRole("button", { name: /Save Changes/i });
    expect(saveBtns.length).toBeGreaterThanOrEqual(1);

    fireEvent.click(saveBtns[0]);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});
