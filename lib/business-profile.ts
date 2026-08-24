export interface BusinessProfile {
  shopName: string;
  tagline: string;
  address: string;
  contactNumber: string;
  email: string;
  logoDataUrl: string;
  receiptFooter: string;
  pickupInstructions: string;
}

export const DEFAULT_BUSINESS_PROFILE: BusinessProfile = {
  shopName: "Sunshine Laundry Shop",
  tagline: "Powered by LaundryTrack",
  address: "123 Magsaysay Ave, Brgy. Sta. Cruz, Manila",
  contactNumber: "(02) 8123-4567",
  email: "contact@laundrytrack.ph",
  logoDataUrl: "",
  receiptFooter: "Thank you for choosing Sunshine Laundry Shop!",
  pickupInstructions: "Present this receipt or QR code upon claiming.",
};

export function normalizeBusinessProfile(
  value: Partial<BusinessProfile> | null | undefined,
): BusinessProfile {
  return {
    ...DEFAULT_BUSINESS_PROFILE,
    ...(value ?? {}),
  };
}
