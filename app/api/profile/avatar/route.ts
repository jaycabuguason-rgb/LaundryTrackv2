import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const BUCKET = "avatars";
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  try {
    // Parse the multipart form
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    // Type narrowing — FormData file entries implement the File/Blob interface
    const blob = file as File;

    if (blob.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File is too large. Maximum size is 5 MB." },
        { status: 413 },
      );
    }

    // Only allow images
    if (!blob.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files are allowed." },
        { status: 415 },
      );
    }

    // Derive file extension from mime type
    const ext = blob.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";

    // Get the authenticated user from the Authorization header
    const authHeader = req.headers.get("authorization");
    const supabaseAdmin = getSupabaseAdminClient();

    let userId: string;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !user) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }
      userId = user.id;
    } else {
      return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
    }

    // Upload to Supabase Storage — overwrite same path so old photo is replaced
    const storagePath = `${userId}/avatar.${ext}`;
    const arrayBuffer = await blob.arrayBuffer();

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, arrayBuffer, {
        contentType: blob.type,
        upsert: true, // replace if exists
      });

    if (uploadError) {
      console.error("[avatar-upload] Storage error:", uploadError);
      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 },
      );
    }

    // Build the public URL
    const { data: publicUrlData } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    const avatarUrl = publicUrlData.publicUrl;

    // Also persist in Supabase user metadata so it survives localStorage clear
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { avatar_url: avatarUrl },
    });

    return NextResponse.json({ avatarUrl });
  } catch (err) {
    console.error("[avatar-upload] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
