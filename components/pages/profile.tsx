"use client";

import { useState } from "react";
import { Camera, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { getBrowserAccessToken } from "@/lib/supabase/browser-session";
import type { UserProfile } from "@/lib/auth";

const FILE_INPUT_ID = "profile-avatar-file-input";

interface ProfilePageProps {
  userProfile: UserProfile;
  shopName?: string;
  contactNumber?: string;
  onAvatarUpdate?: (avatarUrl: string) => void;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-foreground font-medium">{value}</p>
    </div>
  );
}

export default function ProfilePage({ userProfile, shopName, contactNumber, onAvatarUpdate }: ProfilePageProps) {
  const isStaff = userProfile.role === "staff";
  const [uploading, setUploading] = useState(false);
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | undefined>(userProfile.avatarUrl);

  const initials = userProfile.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Immediately show a local preview
    const previewUrl = URL.createObjectURL(file);
    setLocalAvatarUrl(previewUrl);
    setUploading(true);

    try {
      const token = await getBrowserAccessToken();
      if (!token) {
        throw new Error("You must be signed in to upload a photo.");
      }

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const json = await res.json() as { avatarUrl?: string; error?: string };

      if (!res.ok || !json.avatarUrl) {
        throw new Error(json.error ?? "Upload failed.");
      }

      // Replace the blob preview with the permanent Supabase URL
      setLocalAvatarUrl(json.avatarUrl);
      onAvatarUpdate?.(json.avatarUrl);

      toast({
        title: "Photo updated",
        description: "Your profile photo has been saved.",
      });
    } catch (err) {
      // Revert to the previous avatar on failure
      setLocalAvatarUrl(userProfile.avatarUrl);
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      // Reset the input so the same file can be re-selected
      const input = document.getElementById(FILE_INPUT_ID) as HTMLInputElement | null;
      if (input) input.value = "";
    }
  };

  return (
    <div className="w-full max-w-2xl space-y-4 md:space-y-6">
      {/* File input — positioned off-screen, NOT display:none, so Chrome allows label clicks */}
      {!isStaff && (
        <input
          id={FILE_INPUT_ID}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleFileChange}
          disabled={uploading}
        />
      )}

      {/* Avatar card */}
      <Card className="border border-border shadow-none">
        <CardContent className="pt-6 pb-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 md:gap-5">
            <div className="relative shrink-0">
              {/* Avatar — photo or initials */}
              <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-semibold select-none overflow-hidden">
                {localAvatarUrl ? (
                  <img
                    src={localAvatarUrl}
                    alt={userProfile.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  initials
                )}
                {/* Uploading overlay */}
                {uploading && (
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
              </div>

              {/* Camera overlay — admin only, using label so Chrome opens file picker reliably */}
              {!isStaff && (
                <label
                  htmlFor={uploading ? undefined : FILE_INPUT_ID}
                  className={`absolute bottom-0 right-0 w-7 h-7 rounded-full bg-card border border-border shadow flex items-center justify-center hover:bg-accent transition-colors ${uploading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <Camera className="w-3.5 h-3.5 text-muted-foreground" />
                </label>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground text-base">{userProfile.name}</p>
              <p className="text-sm text-muted-foreground">{userProfile.email}</p>
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                {isStaff ? (
                  <Badge
                    variant="secondary"
                    className="text-[11px] px-2 py-0.5 bg-teal-100 text-teal-700 border-teal-200"
                  >
                    Staff
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="text-[11px] px-2 py-0.5 bg-primary text-primary-foreground"
                  >
                    Admin
                  </Badge>
                )}
                <span className="text-[11px] text-muted-foreground">{shopName || "LaundryTrack"}</span>
              </div>
            </div>

            {/* Upload Photo button — admin only, label approach for Chrome */}
            {!isStaff && (
              <div className="ml-auto shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={uploading}
                  asChild
                  className="text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <label htmlFor={uploading ? undefined : FILE_INPUT_ID} className="flex items-center gap-1.5">
                    {uploading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Camera className="w-3.5 h-3.5" />
                    )}
                    {uploading ? "Uploading…" : "Upload Photo"}
                  </label>
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Login Information */}
      <Card className="border border-border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Login Information</CardTitle>
          <CardDescription className="text-xs">
            {isStaff
              ? "Your current account credentials as registered by the admin."
              : "These values reflect your current login credentials. Update them from Settings → Change Password."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          <InfoRow label="Full Name"     value={userProfile.name} />
          <InfoRow label="Username"      value={userProfile.username || "—"} />
          <InfoRow label="Email Address" value={userProfile.email} />
          <InfoRow label="Phone Number"  value={contactNumber || userProfile.phone || "—"} />
        </CardContent>
      </Card>

      {/* Account Details */}
      <Card className="border border-border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Account Details</CardTitle>
          <CardDescription className="text-xs">
            These fields are managed by the system and cannot be changed here.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          <InfoRow label="Role"      value={isStaff ? "Staff" : "Admin"} />
          <InfoRow label="Shop Name" value={shopName || "LaundryTrack"} />
        </CardContent>
      </Card>

      {/* Staff-only info note */}
      {isStaff && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
          <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            To update your profile information or change your password, please contact your administrator.
          </p>
        </div>
      )}
    </div>
  );
}
