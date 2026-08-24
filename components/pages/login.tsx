"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2, WashingMachine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LoginPageProps {
  onLogin: (credentials: { email: string; password: string }) => Promise<void> | void;
  onBack?: () => void;
  authConfigured?: boolean;
}

export default function LoginPage({
  onLogin,
  onBack,
  authConfigured = true,
}: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    setSubmitting(true);
    try {
      await onLogin({
        email,
        password,
      });
      setError(null);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Invalid email or password.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      void handleLogin();
    }
  };

  return (
    <div className="relative isolate min-h-screen flex items-center justify-center bg-[#0c249c] px-4">
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative z-10 w-full max-w-sm">
        <div className="bg-card rounded-2xl shadow-lg border border-border px-8 py-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-md mb-3">
              <WashingMachine className="w-7 h-7 text-primary-foreground" />
            </div>
            <h2 className="text-lg font-bold text-foreground tracking-tight">LaundryTrack</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Sunshine Laundry Shop</p>
          </div>

          <div className="flex items-center justify-center gap-2 mb-6">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors absolute left-8 cursor-pointer"
                aria-label="Back to role selection"
              >
                &larr; Back
              </button>
            )}
            <h1 className="text-base font-semibold text-foreground text-center">Admin Login</h1>
          </div>

          {!authConfigured && (
            <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
              Supabase admin auth is not configured yet. Add your project keys to `.env.local`.
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive font-medium text-center">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError(null);
                }}
                onKeyDown={handleKeyDown}
                className={error && !email.trim() ? "border-destructive focus-visible:ring-destructive" : ""}
                autoComplete="email"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-foreground">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError(null);
                  }}
                  onKeyDown={handleKeyDown}
                  className={`pr-10 ${error && !password.trim() ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="w-4 h-4 rounded border-input accent-primary cursor-pointer"
              />
              <span className="text-xs text-muted-foreground">Remember me</span>
            </label>

            <Button
              className="w-full mt-1 cursor-pointer"
              onClick={() => void handleLogin()}
              disabled={submitting || !authConfigured}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing In...
                </>
              ) : (
                "Login"
              )}
            </Button>

            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-[11px] text-muted-foreground">
              Admin access is managed in Supabase. Use the admin email and password created for your project.
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-white/50 mt-5">
          &copy; {new Date().getFullYear()} LaundryTrack. All rights reserved.
        </p>
      </div>
    </div>
  );
}
