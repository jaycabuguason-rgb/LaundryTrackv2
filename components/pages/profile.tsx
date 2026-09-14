"use client";

import { useState, useEffect } from "react";
import { Camera, Info, Loader2, Check, User, Phone, Save, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { getBrowserAccessToken } from "@/lib/supabase/browser-session";
import type { UserProfile } from "@/lib/auth";
import { getUserInitials } from "@/lib/utils";

const FILE_INPUT_ID = "profile-avatar-file-input";

interface ProfilePageProps {
  userProfile: UserProfile;
  shopName?: string;
  contactNumber?: string;
  onAvatarUpdate?: (avatarUrl: string) => void;
  onProfileUpdate?: (updates: Partial<UserProfile>) => void;
}


export default function ProfilePage({
  userProfile,
  shopName,
  contactNumber,
  onAvatarUpdate,
  onProfileUpdate,
}: ProfilePageProps) {
  const isStaff = userProfile.role === "staff";
  const [uploading, setUploading] = useState(false);
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | undefined>(userProfile.avatarUrl);

  // Form states for editable Name & Phone
  const [name, setName] = useState(userProfile.name || "");
  const [phone, setPhone] = useState(userProfile.phone || contactNumber || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(userProfile.name || "");
    setPhone(userProfile.phone || contactNumber || "");
    setLocalAvatarUrl(userProfile.avatarUrl);
  }, [userProfile, contactNumber]);

  const hasChanges =
    name.trim() !== (userProfile.name || "").trim() ||
    phone.trim() !== (userProfile.phone || contactNumber || "").trim();

  const initials = getUserInitials(name || userProfile.name, userProfile.username, userProfile.email);

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

  const handleDeleteAvatar = async () => {
    if (uploading) return;
    setUploading(true);

    try {
      const token = await getBrowserAccessToken();
      try {
        await fetch("/api/profile/avatar", {
          method: "DELETE",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
      } catch {
        // Fallthrough: always reset local state
      }

      setLocalAvatarUrl(undefined);
      onAvatarUpdate?.("");
      onProfileUpdate?.({ avatarUrl: "" });

      toast({
        title: "Photo removed",
        description: "Your profile photo has been deleted. Defaulting to your name initials.",
      });
    } catch {
      setLocalAvatarUrl(undefined);
      onAvatarUpdate?.("");
      onProfileUpdate?.({ avatarUrl: "" });

      toast({
        title: "Photo removed",
        description: "Your profile photo has been deleted. Defaulting to your name initials.",
      });
    } finally {
      setUploading(false);
      const input = document.getElementById(FILE_INPUT_ID) as HTMLInputElement | null;
      if (input) input.value = "";
    }
  };

  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your name.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const token = await getBrowserAccessToken();
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
        }),
      });

      const json = await res.json() as { success?: boolean; error?: string };

      if (!res.ok) {
        throw new Error(json.error ?? "Failed to save profile.");
      }

      onProfileUpdate?.({
        name: name.trim(),
        phone: phone.trim(),
      });

      toast({
        title: "Profile updated",
        description: "Your name and phone number have been updated successfully.",
      });
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setName(userProfile.name || "");
    setPhone(userProfile.phone || contactNumber || "");
  };

  return (
    <div className="w-full max-w-2xl space-y-4 md:space-y-5 pb-12">
      {/* File input — positioned off-screen */}
      <input
        id={FILE_INPUT_ID}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleFileChange}
        disabled={uploading}
      />

      {/* ── Avatar Card ───────────────────────────────────────────────── */}
      <Card className="border border-border shadow-none overflow-hidden">
        {/* Top accent strip */}
        <div className="h-20 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
        <CardContent className="px-6 pb-6 -mt-10">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-full bg-primary ring-4 ring-card flex items-center justify-center text-primary-foreground text-2xl font-semibold select-none overflow-hidden shadow-md">
                {localAvatarUrl ? (
                  <img
                    src={localAvatarUrl}
                    alt={name || userProfile.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  initials
                )}
                {uploading && (
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
              </div>
              {/* Camera badge */}
              <label
                htmlFor={uploading ? undefined : FILE_INPUT_ID}
                className={`absolute bottom-0 right-0 w-6 h-6 rounded-full bg-primary border-2 border-card shadow flex items-center justify-center hover:bg-primary/80 transition-colors ${uploading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                title="Upload or change profile picture"
              >
                <Camera className="w-3 h-3 text-primary-foreground" />
              </label>
            </div>

            {/* Name + badges + photo actions */}
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold text-foreground text-lg leading-tight">{name || userProfile.name}</p>
                {isStaff ? (
                  <Badge className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800">
                    Staff
                  </Badge>
                ) : (
                  <Badge className="text-xs px-2 py-0.5 bg-primary/15 text-primary border border-primary/30">
                    Admin
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{userProfile.email}</p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">{shopName || "LaundryTrack"}</p>
            </div>

            {/* Photo buttons — right-aligned on desktop, below on mobile */}
            <div className="flex items-center gap-2 shrink-0">
              {localAvatarUrl && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={uploading}
                  onClick={handleDeleteAvatar}
                  className="text-xs h-8 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                  title="Delete profile picture and revert to name initials"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove Photo
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={uploading}
                asChild
                className="text-xs h-8 gap-1.5 cursor-pointer"
              >
                <label htmlFor={uploading ? undefined : FILE_INPUT_ID} className="flex items-center gap-1.5 cursor-pointer">
                  {uploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                  {uploading ? "Uploading…" : localAvatarUrl ? "Change Photo" : "Upload Photo"}
                </label>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Personal Information ──────────────────────────────────────── */}
      <Card className="border border-border shadow-none">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm">Personal Information</CardTitle>
          <CardDescription className="text-xs">
            {isStaff
              ? "Your account details as registered by the administrator."
              : "Update your full name and contact phone number below."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-5">
            {/* Editable fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="profile-name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  Full Name
                </Label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Maria Santos"
                  disabled={isStaff || saving}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-phone" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  Phone Number
                </Label>
                <Input
                  id="profile-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 09171234567"
                  disabled={isStaff || saving}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* Read-only credentials */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border/60">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Username</p>
                <div className="h-9 px-3 flex items-center rounded-md border border-border bg-muted/30 text-sm text-foreground select-all">
                  {userProfile.username || "—"}
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Address</p>
                <div className="h-9 px-3 flex items-center rounded-md border border-border bg-muted/30 text-sm text-foreground select-all truncate">
                  {userProfile.email}
                </div>
              </div>
            </div>

            {/* Save / Discard — admin only, visible when there are unsaved changes */}
            {!isStaff && hasChanges && (
              <div className="flex items-center justify-end gap-2 pt-1 animate-in fade-in-50 duration-200">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDiscard}
                  disabled={saving}
                  className="text-xs h-8 gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Discard
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={saving}
                  className="text-xs h-8 gap-1.5 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* ── Account Details ───────────────────────────────────────────── */}
      <Card className="border border-border shadow-none">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm">Account Details</CardTitle>
          <CardDescription className="text-xs">
            These fields are managed by the system and reflect your store assignment.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</p>
            <div className="flex items-center h-9">
              {isStaff ? (
                <Badge className="text-xs px-2.5 py-1 bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800">
                  Staff
                </Badge>
              ) : (
                <Badge className="text-xs px-2.5 py-1 bg-primary/15 text-primary border border-primary/30">
                  Admin
                </Badge>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Shop Name</p>
            <div className="h-9 px-3 flex items-center rounded-md border border-border bg-muted/30 text-sm text-foreground">
              {shopName || "LaundryTrack"}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Staff-only note */}
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



