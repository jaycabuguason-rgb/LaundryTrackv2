import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/server/audit-log-repository";
import { getSettings, saveSettings } from "@/lib/server/laundry-repository";
import { getRequestActor, requireAuthRequest } from "@/lib/server/request-auth";
import { getRequestIp } from "@/lib/server/request-meta";
import type { PricingConfig, ServiceType, AddOn, LoyaltySettings } from "@/lib/settings-store";

export async function GET(request: Request) {
  try {
    await requireAuthRequest(request);
    const [pricingConfig, serviceTypes, addOns, loyaltySettings] = await Promise.all([
      getSettings<PricingConfig>("pricing_config"),
      getSettings<ServiceType[]>("service_types"),
      getSettings<AddOn[]>("addons"),
      getSettings<LoyaltySettings>("loyalty_settings"),
    ]);

    return NextResponse.json({
      pricingConfig,
      serviceTypes,
      addOns,
      loyaltySettings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load pricing settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await requireAuthRequest(request);
    const raw = await request.json();
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const body: {
      pricingConfig?: PricingConfig;
      serviceTypes?: ServiceType[];
      addOns?: AddOn[];
      loyaltySettings?: LoyaltySettings;
    } = {};
    if (raw.pricingConfig != null && typeof raw.pricingConfig === "object") body.pricingConfig = raw.pricingConfig as PricingConfig;
    if (Array.isArray(raw.serviceTypes)) body.serviceTypes = raw.serviceTypes as ServiceType[];
    if (Array.isArray(raw.addOns)) body.addOns = raw.addOns as AddOn[];
    if (raw.loyaltySettings != null && typeof raw.loyaltySettings === "object") body.loyaltySettings = raw.loyaltySettings as LoyaltySettings;

    const updates: Array<Promise<unknown>> = [];

    if (body.pricingConfig) {
      updates.push(saveSettings("pricing_config", body.pricingConfig));
    }
    if (body.serviceTypes) {
      updates.push(saveSettings("service_types", body.serviceTypes));
    }
    if (body.addOns) {
      updates.push(saveSettings("addons", body.addOns));
    }
    if (body.loyaltySettings) {
      updates.push(saveSettings("loyalty_settings", body.loyaltySettings));
    }

    await Promise.all(updates);

    await createAuditLog({
      action: "settings_changed",
      summary: "Updated pricing and service settings",
      details: `Pricing mode: ${body.pricingConfig?.pricingMode ?? "unchanged"} | Service types: ${body.serviceTypes?.length ?? "unchanged"} | Add-ons: ${body.addOns?.length ?? "unchanged"}`,
      staffProfileId: actor?.id ?? null,
      staffName: actor?.name ?? null,
      staffRole: actor?.role ?? null,
      ipAddress: getRequestIp(request),
      metadata: {
        source: "api/settings/pricing",
      },
    }).catch(() => undefined);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save pricing settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
