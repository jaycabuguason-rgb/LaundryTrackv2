import { NextResponse } from "next/server";

import { normalizeBusinessProfile, type BusinessProfile } from "@/lib/business-profile";
import { createAuditLog } from "@/lib/server/audit-log-repository";
import { getBusinessProfile, saveBusinessProfile } from "@/lib/server/laundry-repository";
import { getRequestActor } from "@/lib/server/request-auth";
import { getRequestIp } from "@/lib/server/request-meta";

export async function GET() {
  try {
    const profile = await getBusinessProfile();
    return NextResponse.json({ profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load business profile.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await getRequestActor(request);
    const body = (await request.json()) as Partial<BusinessProfile>;
    const profile = await saveBusinessProfile(normalizeBusinessProfile(body));

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
