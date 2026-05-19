"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, Save, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { updateAdminIdentity, updateAdminPassword } from "@/lib/admin-auth";
import { cn } from "@/lib/utils";
import type { UserProfile as AdminProfile } from "@/lib/auth";

interface Requirement {
  label: string;
  test: (pw: string) => boolean;
}

const requirements: Requirement[] = [
  { label: "At least 8 characters",          test: (pw) => pw.length >= 8 },
  { label: "At least one uppercase letter",  test: (pw) => /[A-Z]/.test(pw) },
  { label: "At least one number",            test: (pw) => /[0-9]/.test(pw) },
  { label: "At least one special character", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

function getStrength(pw: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  const passed = requirements.filter((r) => r.test(pw)).length;
  if (pw.length === 0) return { level: 0, label: "",       color: "" };
  if (passed <= 1)     return { level: 1, label: "Weak",   color: "bg-red-500" };
  if (passed <= 3)     return { level: 2, label: "Fair",   color: "bg-yellow-500" };
  return                      { level: 3, label: "Strong", color: "bg-green-500" };
}

function PasswordInput({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <Label htmlFor={id} className="text-xs font-medium mb-1.5 block">{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-9 text-sm pr-9"
        />
        <button
          type="button"
          onClick={() => setShow((prev) => !prev)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          tabIndex={-1}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

interface ChangePasswordPageProps {
  adminProfile: AdminProfile;
  onProfileUpdate: (updates: Partial<AdminProfile>) => void;
}

export default function ChangePasswordPage({ adminProfile, onProfileUpdate }: ChangePasswordPageProps) {
  // --- Update Login Credentials state ---
  const [credCurrentEmail, setCredCurrentEmail] = useState(adminProfile.email);
  const [newEmail, setNewEmail]                 = useState("");
  const [newUsername, setNewUsername]           = useState("");
  const [credCurrentPassword, setCredCurrentPassword] = useState("");
  const [credSuccess, setCredSuccess]           = useState(false);
  const [credError, setCredError]               = useState<string | null>(null);
  const [savingCred, setSavingCred]             = useState(false);

  // Keep the "Current Email" field in sync whenever the parent profile updates
  useEffect(() => {
    setCredCurrentEmail(adminProfile.email);
  }, [adminProfile.email]);

  const canSaveCred = credCurrentPassword.trim().length > 0 && (newEmail.trim().length > 0 || newUsername.trim().length > 0);

  const handleCredSave = async () => {
    if (!canSaveCred) return;
    setSavingCred(true);
    setCredError(null);
    try {
      const updatedProfile = await updateAdminIdentity({
        currentPassword: credCurrentPassword,
        newEmail,
        newUsername,
      });
      onProfileUpdate(updatedProfile);
      setNewEmail("");
      setNewUsername("");
      setCredCurrentPassword("");
      setCredSuccess(true);
      setTimeout(() => setCredSuccess(false), 4000);
    } catch (saveError) {
      setCredError(saveError instanceof Error ? saveError.message : "Unable to update your login credentials.");
      setCredSuccess(false);
    } finally {
      setSavingCred(false);
    }
  };

  // --- Change Password state ---
  const [current, setCurrent] = useState("");
  const [newPw, setNewPw]     = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [savingPw, setSavingPw] = useState(false);

  const strength    = getStrength(newPw);
  const allPassed   = requirements.every((r) => r.test(newPw));
  const pwMatch     = newPw.length > 0 && newPw === confirm;
  const canSavePw   = current.length > 0 && allPassed && pwMatch;

  const handleSavePw = async () => {
    if (!canSavePw) return;
    setSavingPw(true);
    setPwError(null);
    try {
      await updateAdminPassword({
        currentPassword: current,
        newPassword: newPw,
      });
      setPwSuccess(true);
      setCurrent("");
      setNewPw("");
      setConfirm("");
      setTimeout(() => setPwSuccess(false), 4000);
    } catch (saveError) {
      setPwError(saveError instanceof Error ? saveError.message : "Unable to update your password.");
      setPwSuccess(false);
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-4 md:space-y-6">

      {/* ── Update Login Credentials ── */}
      <Card className="border border-border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Update Login Credentials</CardTitle>
          <CardDescription className="text-xs">
            Update the email and username used to log in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="cred-current-email" className="text-xs font-medium mb-1.5 block">
              Current Email Address
            </Label>
            <Input
              id="cred-current-email"
              type="email"
              value={credCurrentEmail}
              onChange={(e) => { setCredCurrentEmail(e.target.value); setCredSuccess(false); setCredError(null); }}
              placeholder="Current email address"
              className="h-9 text-sm"
            />
          </div>

          <div>
            <Label htmlFor="cred-new-email" className="text-xs font-medium mb-1.5 block">
              New Email Address
            </Label>
            <Input
              id="cred-new-email"
              type="email"
              value={newEmail}
              onChange={(e) => { setNewEmail(e.target.value); setCredSuccess(false); setCredError(null); }}
              placeholder="Enter new email address"
              className="h-9 text-sm"
            />
          </div>

          <div>
            <Label htmlFor="cred-new-username" className="text-xs font-medium mb-1.5 block">
              New Username <span className="text-muted-foreground">(Optional)</span>
            </Label>
            <Input
              id="cred-new-username"
              type="text"
              value={newUsername}
              onChange={(e) => { setNewUsername(e.target.value); setCredSuccess(false); setCredError(null); }}
              placeholder="Enter new username"
              className="h-9 text-sm"
            />
          </div>

          <PasswordInput
            id="cred-current-password"
            label="Current Password"
            value={credCurrentPassword}
            onChange={(v) => { setCredCurrentPassword(v); setCredSuccess(false); setCredError(null); }}
            placeholder="Enter current password to confirm"
          />

          <Button
            className="w-full cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!canSaveCred || savingCred}
            onClick={() => void handleCredSave()}
          >
            {savingCred ? "Saving..." : "Save Changes"}
          </Button>

          {credSuccess && (
            <p className="text-xs text-green-600 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              Login credentials updated successfully!
            </p>
          )}

          {credError && <p className="text-xs text-destructive">{credError}</p>}
        </CardContent>
      </Card>

      {/* ── Change Password ── */}
      <Card className="border border-border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Change Password</CardTitle>
          <CardDescription className="text-xs">
            Enter your current password, then set a new secure password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PasswordInput
            id="current-pw"
            label="Current Password"
            value={current}
            onChange={setCurrent}
            placeholder="Enter current password"
          />

          <PasswordInput
            id="new-pw"
            label="New Password"
            value={newPw}
            onChange={(v) => { setNewPw(v); setPwSuccess(false); setPwError(null); }}
            placeholder="Enter new password"
          />

          {/* Strength bar */}
          {newPw.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex gap-1 h-1.5">
                {[1, 2, 3].map((seg) => (
                  <div
                    key={seg}
                    className={cn(
                      "flex-1 rounded-full transition-colors duration-300",
                      strength.level >= seg ? strength.color : "bg-muted"
                    )}
                  />
                ))}
              </div>
              {strength.label && (
                <p className={cn(
                  "text-[11px] font-medium",
                  strength.level === 1 && "text-red-500",
                  strength.level === 2 && "text-yellow-600",
                  strength.level === 3 && "text-green-600",
                )}>
                  {strength.label}
                </p>
              )}
            </div>
          )}

          {/* Requirements checklist */}
          <div className="space-y-1.5 p-3 bg-muted/30 rounded-md border border-border">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Requirements</p>
            {requirements.map((req) => {
              const passed = req.test(newPw);
              return (
                <div key={req.label} className="flex items-center gap-2">
                  {passed
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    : <Circle      className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                  }
                  <span className={cn(
                    "text-xs transition-colors",
                    passed ? "text-green-600" : "text-muted-foreground"
                  )}>
                    {req.label}
                  </span>
                </div>
              );
            })}
          </div>

          <PasswordInput
            id="confirm-pw"
            label="Confirm New Password"
            value={confirm}
            onChange={(v) => { setConfirm(v); setPwSuccess(false); setPwError(null); }}
            placeholder="Re-enter new password"
          />

          {confirm.length > 0 && !pwMatch && (
            <p className="text-xs text-destructive">Passwords do not match.</p>
          )}

          <Button
            className="w-full cursor-pointer"
            disabled={!canSavePw || savingPw}
            onClick={() => void handleSavePw()}
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {savingPw ? "Saving..." : "Save New Password"}
          </Button>

          {pwSuccess && (
            <p className="text-xs text-green-600 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              Password changed successfully!
            </p>
          )}

          {pwError && <p className="text-xs text-destructive">{pwError}</p>}
        </CardContent>
      </Card>

    </div>
  );
}
