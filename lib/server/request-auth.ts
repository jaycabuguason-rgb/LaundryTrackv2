import "server-only";

import type { User } from "@supabase/supabase-js";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createTtlCache } from "@/lib/server/ttl-cache";

type ViewerProfileRow = {
  full_name: string | null;
  username: string | null;
  phone_number: string | null;
  role: string | null;
  is_active: boolean | null;
};

const REQUEST_ACTOR_CACHE_TTL_MS = 30_000;
const requestActorCache = createTtlCache<RequestActor>();

export type RequestActor = {
  id: string;
  name: string;
  username: string;
  phone: string;
  email: string;
  role: "admin" | "staff";
};

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function getRoleFromAuthUser(user: User): "admin" | "staff" {
  const appMetadataRole =
    typeof user.app_metadata?.role === "string" ? user.app_metadata.role.toLowerCase() : null;
  const userMetadataRole =
    typeof user.user_metadata?.role === "string" ? user.user_metadata.role.toLowerCase() : null;
  const effectiveRole = appMetadataRole ?? userMetadataRole;

  return effectiveRole === "admin" ? "admin" : "staff";
}

async function syncMissingProfileFromAuthUser(user: User): Promise<ViewerProfileRow | null> {
  const supabase = getSupabaseAdminClient();
  const fullName =
    typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim().length > 0
      ? user.user_metadata.full_name.trim()
      : user.email?.split("@")[0] ?? "User";
  const username =
    typeof user.user_metadata?.username === "string" && user.user_metadata.username.trim().length > 0
      ? user.user_metadata.username.trim()
      : user.email?.split("@")[0] ?? "user";
  const phoneNumber =
    typeof user.user_metadata?.phone_number === "string" ? user.user_metadata.phone_number : null;
  const role = getRoleFromAuthUser(user);
  const isActive =
    typeof user.app_metadata?.is_active === "boolean"
      ? user.app_metadata.is_active
      : typeof user.user_metadata?.is_active === "boolean"
        ? user.user_metadata.is_active
        : true;

  const { error: upsertError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      full_name: fullName,
      phone_number: phoneNumber,
      username,
      role,
      is_active: isActive,
    },
    {
      onConflict: "id",
      ignoreDuplicates: true,
    },
  );

  if (upsertError) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name,username,phone_number,role,is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return null;
  }

  return profile as ViewerProfileRow | null;
}

export async function getRequestActor(request: Request): Promise<RequestActor | null> {
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return null;
  }

  const cachedActor = requestActorCache.get(accessToken);
  if (cachedActor) {
    return cachedActor;
  }

  const supabase = getSupabaseAdminClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(accessToken);

  if (userError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name,username,phone_number,role,is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return null;
  }

  const viewerProfile = (profile as ViewerProfileRow | null) ?? await syncMissingProfileFromAuthUser(user);
  if (
    !viewerProfile
    || viewerProfile.is_active === false
    || (viewerProfile.role !== "admin" && viewerProfile.role !== "staff")
  ) {
    return null;
  }

  const actor = {
    id: user.id,
    name: viewerProfile.full_name ?? user.email?.split("@")[0] ?? "User",
    username: viewerProfile.username ?? user.email?.split("@")[0] ?? "user",
    phone: viewerProfile.phone_number ?? "",
    email: user.email ?? "",
    role: viewerProfile.role,
  };

  requestActorCache.set(accessToken, actor, REQUEST_ACTOR_CACHE_TTL_MS);
  return actor;
}

export async function requireAdminRequest(request: Request) {
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    throw new Error("Missing authorization token.");
  }

  const actor = await getRequestActor(request);
  if (!actor) {
    throw new Error("Your session is invalid or has expired.");
  }

  if (actor.role !== "admin") {
    throw new Error("Admin access is required.");
  }

  return actor;
}
