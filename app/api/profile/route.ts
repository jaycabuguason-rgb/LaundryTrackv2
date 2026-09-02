import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAuthRequest } from "@/lib/server/request-auth";
import { createAuditLog } from "@/lib/server/audit-log-repository";
import { getRequestIp } from "@/lib/server/request-meta";

export async function PUT(request: Request) {
  try {
    const actor = await requireAuthRequest(request);
    const body = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : undefined;
    const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 50) : undefined;

    if (name !== undefined && name.length === 0) {
      return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdminClient();

    // 1. Update profiles table if it exists
    const updatePayload: Record<string, string> = {};
    if (name !== undefined) updatePayload.full_name = name;
    if (phone !== undefined) updatePayload.phone_number = phone;

    if (Object.keys(updatePayload).length > 0) {
      try {
        await supabaseAdmin
          .from("profiles")
          .update(updatePayload)
          .eq("id", actor.id);
      } catch {
        // Table might not exist in some environments; ignore error
      }

      // 2. Update auth user metadata
      try {
        await supabaseAdmin.auth.admin.updateUserById(actor.id, {
          user_metadata: {
            ...(name !== undefined ? { full_name: name, name } : {}),
            ...(phone !== undefined ? { phone_number: phone, phone } : {}),
          },
        });
      } catch {
        // Ignore metadata update error
      }
    }

    // 3. Log audit event
    await createAuditLog({
      action: "settings_changed",
      summary: "Updated user profile details",
      details: `Updated profile for ${actor.name} (${actor.email}): ${name ? `Name: ${name} ` : ""}${phone ? `Phone: ${phone}` : ""}`,
      staffProfileId: actor.id,
      staffName: name ?? actor.name,
      staffRole: actor.role,
      ipAddress: getRequestIp(request),
      metadata: {
        source: "api/profile",
      },
    }).catch(() => undefined);

    return NextResponse.json({
      success: true,
      profile: {
        name: name ?? actor.name,
        phone: phone ?? actor.phone,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update profile.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
