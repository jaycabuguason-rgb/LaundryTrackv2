"use client";

// TODO: Replace with real Supabase resetPasswordForEmail() when backend is ready

import { useState, useEffect, useRef, useCallback } from "react";
import {
  WashingMachine,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ForgotPasswordPageProps {
  onBack: () => void;
}

type Step = 1 | "1-success" | 2 | 3 | "success";

// Mock accounts: email → reset code
const MOCK_ACCOUNTS: Record<string, string> = {
  "admin@laundrytrack.ph": "123456",
  "owner@laundrytrack.ph": "654321",
};

const CODE_COUNTDOWN = 300; // 5 minutes
const RESEND_COUNTDOWN = 60;

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local.slice(0, 3)}***@${domain}`;
}

function getStrength(pw: string): 0 | 1 | 2 | 3 {
  const checks = [pw.length >= 8, /[0-9]/.test(pw), /[A-Z]/.test(pw)];
  return checks.filter(Boolean).length as 0 | 1 | 2 | 3;
}

export default function ForgotPasswordPage({ onBack }: ForgotPasswordPageProps) {
  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [email, setEmail] = useState("");
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // Auto-advance countdown after success state
  const [continueCountdown, setContinueCountdown] = useState(2);

  // Step 2
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [step2Error, setStep2Error] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [codeCountdown, setCodeCountdown] = useState(CODE_COUNTDOWN);
  const [resendCountdown, setResendCountdown] = useState(RESEND_COUNTDOWN);
  const [canResend, setCanResend] = useState(false);
  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);
  const codeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step 3
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [step3Error, setStep3Error] = useState<string | null>(null);

  // Success redirect countdown
  const [redirectCountdown, setRedirectCountdown] = useState(5);

  // ── Auto-advance after 1-success state ───────────────────────────────────
  useEffect(() => {
    if (step !== "1-success") return;
    setContinueCountdown(2);
    const t = setInterval(() => {
      setContinueCountdown((c) => {
        if (c <= 1) {
          clearInterval(t);
          setStep(2);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [step]);

  // ── Start countdown timers when entering Step 2 ───────────────────────────
  const startTimers = useCallback(() => {
    // Code expiry
    setCodeCountdown(CODE_COUNTDOWN);
    if (codeTimerRef.current) clearInterval(codeTimerRef.current);
    codeTimerRef.current = setInterval(() => {
      setCodeCountdown((c) => {
        if (c <= 1) { clearInterval(codeTimerRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);

    // Resend cooldown
    setResendCountdown(RESEND_COUNTDOWN);
    setCanResend(false);
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    resendTimerRef.current = setInterval(() => {
      setResendCountdown((c) => {
        if (c <= 1) {
          clearInterval(resendTimerRef.current!);
          setCanResend(true);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    if (step === 2) startTimers();
    return () => {
      if (codeTimerRef.current) clearInterval(codeTimerRef.current);
      if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    };
  }, [step, startTimers]);

  // ── Auto-redirect on success ──────────────────────────────────────────────
  useEffect(() => {
    if (step !== "success") return;
    setRedirectCountdown(5);
    const t = setInterval(() => {
      setRedirectCountdown((c) => {
        if (c <= 1) { clearInterval(t); onBack(); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [step, onBack]);

  // ── Format mm:ss ──────────────────────────────────────────────────────────
  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  }

  // ── Step 1: Send reset code ───────────────────────────────────────────────
  const handleSendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) { setStep1Error("Please enter your email address."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStep1Error("Please enter a valid email address.");
      return;
    }
    setSending(true);
    setStep1Error(null);
    await new Promise((r) => setTimeout(r, 1000));
    setSending(false);

    if (!MOCK_ACCOUNTS[trimmed]) {
      setStep1Error("No account found with this email address.");
      return;
    }

    setEmail(trimmed);
    setStep("1-success");
  };

  const mockCode = MOCK_ACCOUNTS[email] ?? "";

  // ── Step 2: Digit handling ────────────────────────────────────────────────
  const handleDigitChange = (index: number, value: string) => {
    const char = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    setStep2Error(null);
    if (char && index < 5) digitRefs.current[index + 1]?.focus();
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter") handleVerifyCode();
  };

  const handleDigitPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(""));
      digitRefs.current[5]?.focus();
    }
    e.preventDefault();
  };

  const triggerShake = (msg: string) => {
    setStep2Error(msg);
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const handleVerifyCode = () => {
    const code = digits.join("");
    if (code.length < 6) { triggerShake("Please enter the complete 6-digit code."); return; }
    // All same digits check
    if (new Set(code.split("")).size === 1) { triggerShake("Invalid code format."); return; }
    if (code !== mockCode) { triggerShake("Incorrect code. Please try again."); return; }
    setStep2Error(null);
    setStep(3);
  };

  const handleResend = () => {
    if (!canResend) return;
    setDigits(Array(6).fill(""));
    setStep2Error(null);
    startTimers();
    digitRefs.current[0]?.focus();
  };

  // ── Step 3: Strength ──────────────────────────────────────────────────────
  const strengthScore = getStrength(newPassword);
  const strengthLabel = ["", "Weak", "Fair", "Strong"][strengthScore];
  const strengthColor = ["", "bg-red-400", "bg-yellow-400", "bg-green-500"][strengthScore];

  const handleResetPassword = () => {
    if (!newPassword) { setStep3Error("Please enter a new password."); return; }
    if (newPassword.length < 8) { setStep3Error("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setStep3Error("Passwords do not match."); return; }
    setStep3Error(null);
    setNewPassword("");
    setConfirmPassword("");
    setStep("success");
  };

  // ── Shared step indicator ─────────────────────────────────────────────────
  function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
    return (
      <div className="flex items-center justify-center gap-1.5 mb-5">
        {([1, 2, 3] as const).map((n, i) => (
          <div key={n} className="flex items-center gap-1.5">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors
              ${n < current ? "bg-primary text-primary-foreground" :
                n === current ? "bg-primary text-primary-foreground" :
                "border border-muted-foreground/30 text-muted-foreground"}`}>
              {n < current ? <CheckCircle2 className="w-3.5 h-3.5" /> : n}
            </span>
            {i < 2 && (
              <div className={`w-6 h-px ${n < current ? "bg-primary" : "bg-muted-foreground/30"}`} />
            )}
          </div>
        ))}
      </div>
    );
  }

  // ── Shared card wrapper ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0c249c] px-4">
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="bg-card rounded-2xl shadow-lg border border-border px-8 py-10">

          {/* Logo — always visible */}
          <div className="flex flex-col items-center mb-7">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-md mb-3">
              <WashingMachine className="w-7 h-7 text-primary-foreground" />
            </div>
            <h2 className="text-lg font-bold text-foreground tracking-tight">LaundryTrack</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Sunshine Laundry Shop</p>
          </div>

          {/* ── STEP 1: Enter Email ─────────────────────────────────────── */}
          {step === 1 && (
            <>
              <h1 className="text-base font-semibold text-foreground text-center mb-1">Forgot Password</h1>
              <p className="text-xs text-muted-foreground text-center mb-6 leading-relaxed">
                Enter your admin email and we&apos;ll send you a reset code.
              </p>

              {step1Error && (
                <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive font-medium text-center">
                  {step1Error}
                </div>
              )}

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fp-email" className="text-xs font-medium text-foreground">Email Address</Label>
                  <Input
                    id="fp-email"
                    type="email"
                    placeholder="admin@laundrytrack.ph"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setStep1Error(null); }}
                    onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
                    autoComplete="email"
                    disabled={sending}
                  />
                </div>

                <Button className="w-full cursor-pointer" onClick={handleSendCode} disabled={sending}>
                  {sending ? "Sending..." : "Send Reset Code"}
                </Button>

                <button
                  type="button"
                  onClick={onBack}
                  className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Login
                </button>
              </div>
            </>
          )}

          {/* ── STEP 1-SUCCESS: Code Sent ───────────────────────────────── */}
          {step === "1-success" && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Reset Code Sent!</p>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  We&apos;ve sent a 6-digit code to{" "}
                  <span className="font-semibold text-foreground">{maskEmail(email)}</span>
                </p>
              </div>

              {/* Demo hint box */}
              <div className="w-full rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5 text-xs text-blue-800">
                <p className="font-semibold mb-0.5">Demo mode</p>
                <p>Your code is: <span className="font-bold tracking-widest">{mockCode}</span></p>
              </div>

              <Button className="w-full cursor-pointer" onClick={() => setStep(2)}>
                Continue &rarr;
              </Button>

              <p className="text-[11px] text-muted-foreground">
                Auto-continuing in {continueCountdown}s...
              </p>

              <button
                type="button"
                onClick={onBack}
                className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Login
              </button>
            </div>
          )}

          {/* ── STEP 2: Enter Code ─────────────────────────────────────── */}
          {step === 2 && (
            <>
              <StepIndicator current={2} />

              <h1 className="text-base font-semibold text-foreground text-center mb-1">Enter Verification Code</h1>
              <p className="text-xs text-muted-foreground text-center mb-1 leading-relaxed">
                Enter the 6-digit code sent to
              </p>
              <p className="text-xs font-semibold text-foreground text-center mb-1">{maskEmail(email)}</p>

              {/* Expiry countdown */}
              <p className={`text-[11px] text-center mb-5 font-medium ${codeCountdown <= 60 ? "text-destructive" : "text-muted-foreground"}`}>
                Code expires in {formatTime(codeCountdown)}
              </p>

              {step2Error && (
                <div className="mb-3 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive font-medium text-center">
                  {step2Error}
                </div>
              )}

              {/* 6-box OTP input */}
              <div
                className={`flex gap-2 justify-center mb-4 ${shake ? "animate-shake" : ""}`}
                style={shake ? { animation: "shake 0.5s ease-in-out" } : {}}
              >
                <style>{`
                  @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    20% { transform: translateX(-6px); }
                    40% { transform: translateX(6px); }
                    60% { transform: translateX(-4px); }
                    80% { transform: translateX(4px); }
                  }
                `}</style>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => { digitRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(i, e)}
                    onPaste={handleDigitPaste}
                    className={`w-10 h-12 text-center text-base font-bold rounded-lg border-2 bg-background text-foreground outline-none transition-colors
                      ${d ? "border-primary" : "border-border"}
                      focus:border-primary focus:ring-2 focus:ring-primary/20`}
                    aria-label={`Digit ${i + 1}`}
                  />
                ))}
              </div>

              {/* Demo hint */}
              <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800 text-center">
                Demo mode: use code <span className="font-bold tracking-widest">{mockCode}</span>
              </div>

              <div className="flex flex-col gap-3">
                <Button className="w-full cursor-pointer" onClick={handleVerifyCode}>
                  Verify Code
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Didn&apos;t receive a code?{" "}
                  {canResend ? (
                    <button
                      type="button"
                      onClick={handleResend}
                      className="text-primary font-medium hover:underline cursor-pointer"
                    >
                      Resend Code
                    </button>
                  ) : (
                    <span className="font-medium text-muted-foreground">
                      Resend in 0:{String(resendCountdown).padStart(2, "0")}
                    </span>
                  )}
                </p>

                <button
                  type="button"
                  onClick={() => { setDigits(Array(6).fill("")); setStep2Error(null); setStep(1); }}
                  className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
              </div>
            </>
          )}

          {/* ── STEP 3: Reset Password ──────────────────────────────────── */}
          {step === 3 && (
            <>
              <StepIndicator current={3} />

              <h1 className="text-base font-semibold text-foreground text-center mb-1">Reset Password</h1>
              <p className="text-xs text-muted-foreground text-center mb-6 leading-relaxed">
                Enter your new password below.
              </p>

              {step3Error && (
                <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive font-medium text-center">
                  {step3Error}
                </div>
              )}

              <div className="flex flex-col gap-4">
                {/* New password */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fp-new" className="text-xs font-medium text-foreground">New Password</Label>
                  <div className="relative">
                    <Input
                      id="fp-new"
                      type={showNew ? "text" : "password"}
                      placeholder="At least 8 characters"
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setStep3Error(null); }}
                      className="pr-10"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showNew ? "Hide password" : "Show password"}
                    >
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Strength bar */}
                  {newPassword.length > 0 && (
                    <div className="mt-1">
                      <div className="flex gap-1 mb-1.5">
                        {[1, 2, 3].map((level) => (
                          <div key={level} className={`h-1 flex-1 rounded-full transition-colors ${strengthScore >= level ? strengthColor : "bg-muted"}`} />
                        ))}
                      </div>
                      {strengthLabel && (
                        <p className={`text-[11px] font-medium mb-1.5 ${strengthScore === 1 ? "text-red-500" : strengthScore === 2 ? "text-yellow-500" : "text-green-600"}`}>
                          {strengthLabel}
                        </p>
                      )}
                      <ul className="space-y-0.5">
                        {[
                          { met: newPassword.length >= 8, text: "At least 8 characters" },
                          { met: /[0-9]/.test(newPassword), text: "Contains a number" },
                          { met: /[A-Z]/.test(newPassword), text: "Contains uppercase letter" },
                        ].map(({ met, text }) => (
                          <li key={text} className={`text-[11px] flex items-center gap-1 ${met ? "text-green-600" : "text-muted-foreground"}`}>
                            <span>{met ? "✓" : "○"}</span> {text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fp-confirm" className="text-xs font-medium text-foreground">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="fp-confirm"
                      type={showConfirm ? "text" : "password"}
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setStep3Error(null); }}
                      onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
                      className="pr-10"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showConfirm ? "Hide password" : "Show password"}
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button className="w-full cursor-pointer" onClick={handleResetPassword}>
                  Reset Password
                </Button>

                <button
                  type="button"
                  onClick={() => { setStep3Error(null); setStep(2); }}
                  className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
              </div>
            </>
          )}

          {/* ── SUCCESS ─────────────────────────────────────────────────── */}
          {step === "success" && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Password Reset Successful!</p>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  You can now log in with your new password.
                </p>
              </div>

              <Button className="w-full cursor-pointer" onClick={onBack}>
                &rarr; Go to Login
              </Button>

              <p className="text-[11px] text-muted-foreground">
                Redirecting in {redirectCountdown}s...
              </p>
            </div>
          )}

        </div>

        <p className="text-center text-[11px] text-white/50 mt-5">
          &copy; {new Date().getFullYear()} LaundryTrack. All rights reserved.
        </p>
      </div>
    </div>
  );
}
