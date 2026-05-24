import { NextResponse } from "next/server";

import { normalizeBusinessProfile, type BusinessProfile } from "@/lib/business-profile";
import { createAuditLog } from "@/lib/server/audit-log-repository";
import { getBusinessProfile, saveBusinessProfile } from "@/lib/server/laundry-repository";
import { getRequestActor, requireAuthRequest } from "@/lib/server/request-auth";
import { getRequestIp } from "@/lib/server/request-meta";

export async function GET(request: Request) {
  try {
    await requireAuthRequest(request);
    const profile = await getBusinessProfile();
    return NextResponse.json({ profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load business profile.";
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
    const sanitized: Partial<BusinessProfile> = {};
    const stringFields: (keyof BusinessProfile)[] = ["shopName", "tagline", "address", "contactNumber", "email", "receiptFooter", "pickupInstructions"];
    for (const field of stringFields) {
      if (raw[field] != null) sanitized[field] = String(raw[field]).trim().slice(0, 1000);
    }
    if (raw.logoDataUrl != null) {
      sanitized.logoDataUrl = String(raw.logoDataUrl).trim();
    }
    const profile = await saveBusinessProfile(normalizeBusinessProfile(sanitized));

    await createAuditLog({
      action: "settings_changed",
      summary: "Updated business profile settings",
      details: `Shop: ${profile.shopName} | Contact: ${profile.contactNumber} | Email: ${profile.email}`,
      staffProfileId: actor?.id ?? null,
      staffName: actor?.name ?? null,
      staffRole: actor?.role ?? null,
      ipAddress: getRequestIp(request),
      metadata: {
        source: "api/settings/business-profile",
      },
    }).catch(() => undefined);

    return NextResponse.json({ profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save business profile.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
