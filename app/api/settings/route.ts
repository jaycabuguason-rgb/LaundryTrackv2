import { NextResponse } from "next/server";

import { normalizeBusinessProfile } from "@/lib/business-profile";
import { getBusinessProfile, getSettings } from "@/lib/server/laundry-repository";
import { requireAuthRequest } from "@/lib/server/request-auth";
import type { PricingConfig, ServiceType, AddOn, LoyaltySettings } from "@/lib/settings-store";

export async function GET(request: Request) {
  try {
    await requireAuthRequest(request);
    const [pricingConfig, serviceTypes, addOns, loyaltySettings, businessProfile] = await Promise.all([
      getSettings<PricingConfig>("pricing_config"),
      getSettings<ServiceType[]>("service_types"),
      getSettings<AddOn[]>("addons"),
      getSettings<LoyaltySettings>("loyalty_settings"),
      getBusinessProfile(),
    ]);

    return NextResponse.json({
      pricingConfig: pricingConfig ?? null,
      serviceTypes: serviceTypes ?? null,
      addOns: addOns ?? null,
      loyaltySettings: loyaltySettings ?? null,
      businessProfile: businessProfile ? normalizeBusinessProfile(businessProfile) : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
