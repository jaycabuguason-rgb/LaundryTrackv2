"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Search, Eye, EyeOff, Edit, Ban, Printer, ChevronRight, X, QrCode, CalendarIcon,
  Undo2, Redo2, AlertTriangle, Plus, User, Star, Camera, CameraOff,
  ChevronLeft, Check, RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { loyaltyMembers as _seedMembers, statusColors, statusOrder, type Transaction, type PaymentStatus, type LoyaltyMember } from "@/lib/data";
import { useLoyaltyMembers } from "@/hooks/use-loyalty-members";
import { formatReadableDateTime } from "@/lib/date-format";
import {
  type ServiceType,
  type AddOn,
  type PricingMode,
  type PriceDisplayMode,
  type LoadTier,
  loadServiceTypes,
  loadAddOns,
  loadPricingConfig,
} from "@/lib/settings-store";
import type { CreateTransactionInput, UpdateTransactionInput } from "@/lib/transaction-contracts";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { PrintReceiptModal } from "@/components/print-receipt-modal";

// ─────────────────────────────────────────────────────────────────────────────
// QR Scanner (inline, no package)
// ─────────────────────────────────────────────────────────────────────────────
function InlineQRScanner({ onScan, onClose }: { onScan: (v: string) => void; onClose: () => void }) {
  const videoRef  = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef    = useRef<number | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setActive(true);
      const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
      if (!BD) { setError("QR scanning not supported in this browser. Use manual ID entry below."); stop(); return; }
      const det = new BD({ formats: ["qr_code"] });
      const tick = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) { rafRef.current = requestAnimationFrame(tick); return; }
        try {
          const res = await det.detect(videoRef.current);
          if (res.length > 0) {
            const raw = res[0].rawValue;
            const m = raw.match(/member\/([A-Z0-9-]+)/i);
            onScan(m ? m[1].toUpperCase() : raw);
            stop(); return;
          }
        } catch { /* ignore */ }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.toLowerCase().includes("permission") ? "Camera permission denied." : "Could not start camera.");
    }
  }, [onScan, stop]);

  useEffect(() => { start(); return () => stop(); }, [start, stop]);

  return (
    <div className="space-y-2">
      <div className="relative bg-black rounded-xl overflow-hidden aspect-video w-full">
        <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
        {!active && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted/60 backdrop-blur-sm">
            <CameraOff className="w-8 h-8 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Starting camera…</p>
          </div>
        )}
        {active && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-40 h-40">
              <span className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-white" />
              <span className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-white" />
              <span className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-white" />
              <span className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-white" />
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>}
      {active && <p className="text-xs text-center text-muted-foreground">Point camera at member QR code…</p>}
      <Button size="sm" variant="outline" className="w-full" onClick={onClose}>Cancel Scan</Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stamp Card visual
// ─────────────────────────────────────────────────────────────────────────────
const STAMP_MILESTONE = 7;
function StampCard({ count, highlight }: { count: number; highlight?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: STAMP_MILESTONE }).map((_, i) => {
        const filled = i < count % STAMP_MILESTONE || (count > 0 && count % STAMP_MILESTONE === 0 && i < STAMP_MILESTONE);
        const isNew  = highlight && i === (count - 1) % STAMP_MILESTONE;
        return (
          <div key={i} className={cn(
            "w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs transition-all",
            filled
              ? isNew
                ? "bg-yellow-400 border-yellow-500 text-yellow-900 scale-110 shadow"
                : "bg-primary border-primary text-primary-foreground"
              : "bg-muted border-border text-muted-foreground"
          )}>
            {filled ? <Star className="w-3.5 h-3.5 fill-current" /> : <span className="text-[9px]">{i + 1}</span>}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────���───────
// Member Card
// ──────────────────────────────────────────────────────────���──────────────────
function MemberCard({ member, onClear, stampAfter }: { member: LoyaltyMember; onClear?: () => void; stampAfter?: boolean }) {
  const completedCycles = Math.floor(member.stampCount / STAMP_MILESTONE);
  const currentStamp    = member.stampCount % STAMP_MILESTONE;
  const newStamp        = stampAfter ? currentStamp + 1 : currentStamp;
  const willUnlock      = stampAfter && newStamp >= STAMP_MILESTONE;

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
            <Star className="w-4.5 h-4.5 text-primary fill-primary/30" />
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">{member.name}</p>
            <p className="text-xs text-muted-foreground">{member.phone}</p>
          </div>
        </div>
        {onClear && (
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground" onClick={onClear}>
            <RefreshCw className="w-3 h-3" /> Change
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5 text-xs">
        <div className="bg-background/70 rounded-md p-2">
          <p className="text-muted-foreground text-[10px]">Member ID</p>
          <p className="font-mono font-medium text-foreground">{member.id}</p>
        </div>
        <div className="bg-background/70 rounded-md p-2">
          <p className="text-muted-foreground text-[10px]">Member Since</p>
          <p className="font-medium text-foreground">{member.dateJoined}</p>
        </div>
        <div className="bg-background/70 rounded-md p-2 col-span-2">
          <p className="text-muted-foreground text-[10px] mb-1.5">
            Stamps — {stampAfter ? newStamp : currentStamp} of {STAMP_MILESTONE}
            {completedCycles > 0 && <span className="ml-1 text-primary">({completedCycles} reward{completedCycles > 1 ? "s" : ""} completed)</span>}
          </p>
          <StampCard count={stampAfter ? member.stampCount + 1 : member.stampCount} highlight={stampAfter} />
        </div>
      </div>
      {willUnlock && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 flex items-center gap-2 text-xs text-yellow-800">
          <span className="text-base">🎉</span>
          <span><strong>Reward unlocked!</strong> This transaction completes the stamp card.</span>
        </div>
      )}
      {!stampAfter && completedCycles > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-800">
          {completedCycles} reward{completedCycles > 1 ? "s" : ""} ready to redeem!
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// New Transaction Wizard
// ─────────────────────────────────────────────────────────────────────────────
type CustomerType = "walkin" | "loyalty";

interface WizardForm {
  customerType: CustomerType;
  customerName: string;
  phone: string;
  arrivalDateTime: string;
  loyaltyMember: LoyaltyMember | null;
  washType: string;
  weight: string;
  numberOfLoads: string;
  addOns: string[];
  washInstructions: string;
  paymentStatus: PaymentStatus;
}

// Wash types and add-ons are loaded dynamically from settings (see wizard state below)

function NewTransactionWizard({
  open,
  onClose,
  onSubmit,
  loyaltyEnabled = true,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (txn: Omit<Transaction, "id" | "ticketId">) => void;
  loyaltyEnabled?: boolean;
}) {
  // Dynamic settings loaded from shared store
  const { members: loyaltyMembers } = useLoyaltyMembers();
  const [serviceTypes, setServiceTypes]   = useState<ServiceType[]>([]);
  const [svcEnabled, setSvcEnabled]       = useState(true);
  const [basePerKg, setBasePerKg]         = useState("0");
  const [addOnOptions, setAddOnOptions]   = useState<AddOn[]>([]);
  const [minWeight, setMinWeightSetting]  = useState("0");
  const [pricingMode, setPricingModeSetting] = useState<PricingMode>("per-kg");
  const [loadTiers, setLoadTiersSetting]  = useState<LoadTier[]>([]);
  // For "both" mode — which method staff picks for this transaction (persisted across opens)
  const [chargingMode, setChargingMode] = useState<"per-kg" | "per-load">(() => {
    if (typeof window === "undefined") return "per-kg";
    return (sessionStorage.getItem("lt_charging_mode") as "per-kg" | "per-load") || "per-kg";
  });
  const updateChargingMode = (mode: "per-kg" | "per-load") => {
    setChargingMode(mode);
    if (typeof window !== "undefined") sessionStorage.setItem("lt_charging_mode", mode);
  };
  // For per-load mode — selected tier id
  const [selectedTierId, setSelectedTierId] = useState<string>("");
  // Price display mode from settings
  const [priceDisplayMode, setPriceDisplayMode] = useState<PriceDisplayMode>("show");

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardForm>({
    customerType: "walkin",
    customerName: "",
    phone: "",
    arrivalDateTime: format(new Date(), "yyyy-MM-dd HH:mm"),
    loyaltyMember: null,
    washType: "",
    weight: "",
    numberOfLoads: "1",
    addOns: [],
    washInstructions: "",
    paymentStatus: "unpaid",
  });

  // Loyalty search state
  const [memberSearch, setMemberSearch]     = useState("");
  const [memberSearchRes, setMemberSearchRes] = useState<LoyaltyMember[]>([]);
  const [manualId, setManualId]             = useState("");
  const [manualError, setManualError]       = useState("");
  const [showScanner, setShowScanner]       = useState(false);

  // Reset when dialog opens — also re-read settings so changes in Settings tab are reflected
  useEffect(() => {
    if (open) {
      // Load all active services — filtering by pricingType happens at render time based on effectiveMode
      const svcOn = typeof window !== "undefined" ? localStorage.getItem("laundrytrack_svc_enabled") !== "false" : true;
      const enabledServices = svcOn ? loadServiceTypes().filter((s) => s.active) : [];
      const addOns = loadAddOns();
      const pricingCfg = loadPricingConfig();
      setSvcEnabled(svcOn);
      setBasePerKg(pricingCfg.pricePerKg || "0");
      setServiceTypes(enabledServices);
      setAddOnOptions(addOns);
      setMinWeightSetting(pricingCfg.minWeight || "0");
      setPricingModeSetting(pricingCfg.pricingMode);
      setLoadTiersSetting(pricingCfg.loadTiers);
      // chargingMode intentionally NOT reset — persists from sessionStorage
      setSelectedTierId(pricingCfg.loadTiers[0]?.id ?? "");
      setPriceDisplayMode(pricingCfg.priceDisplayMode ?? "show");

      setStep(1);
      setForm({
        customerType: "walkin",
        customerName: "",
        phone: "",
        arrivalDateTime: format(new Date(), "yyyy-MM-dd HH:mm"),
        loyaltyMember: null,
        washType: enabledServices[0]?.name ?? "",
        weight: "",
        numberOfLoads: "1",
        addOns: [],
        washInstructions: "",
        paymentStatus: "unpaid",
      });
      setMemberSearch("");
      setMemberSearchRes([]);
      setManualId("");
      setManualError("");
      setShowScanner(false);
    }
  }, [open]);

  // Live search
  useEffect(() => {
    if (memberSearch.trim().length < 2) { setMemberSearchRes([]); return; }
    const q = memberSearch.toLowerCase();
    setMemberSearchRes(
      loyaltyMembers.filter((m) =>
        m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q) || m.phone.includes(q)
      )
    );
  }, [memberSearch]);

  const selectMember = (m: LoyaltyMember) => {
    setForm((f) => ({ ...f, loyaltyMember: m, customerName: m.name, phone: m.phone }));
    setMemberSearch("");
    setMemberSearchRes([]);
    setManualId("");
    setManualError("");
    setShowScanner(false);
  };

  const handleManualFind = () => {
    const found = loyaltyMembers.find((m) => m.id === manualId.trim());
    if (found) { selectMember(found); setManualError(""); }
    else setManualError("Member not found. Check the ID and try again.");
  };

  const handleQRScan = (val: string) => {
    const found = loyaltyMembers.find((m) => m.id === val || m.phone === val);
    if (found) selectMember(found);
    else { setManualId(val); setManualError("Member not found. Check the ID and try again."); setShowScanner(false); }
  };

  const toggleAddOn = (ao: string) =>
    setForm((f) => ({ ...f, addOns: f.addOns.includes(ao) ? f.addOns.filter((x) => x !== ao) : [...f.addOns, ao] }));

  // ── Derived pricing context ────────────────────────────────────────────────
  // Effective mode for this transaction
  const effectiveMode: "per-kg" | "per-load" =
    pricingMode === "both" ? chargingMode : (pricingMode === "per-load" ? "per-load" : "per-kg");

  const selectedService = serviceTypes.find((s) => s.name === form.washType);
  const selectedTier    = loadTiers.find((t) => t.id === selectedTierId);
  const weight          = parseFloat(form.weight) || 0;
  const numberOfLoads   = parseInt(form.numberOfLoads) || 0;
  const minWeightNum    = parseFloat(minWeight) || 0;

  // ── Fee calculation ──────────────────────────────────────────���─────────────
  let baseFee = 0;
  if (effectiveMode === "per-load" && selectedTier) {
    const pricePerLoad = parseFloat(selectedTier.price) || 0;
    baseFee = pricePerLoad * numberOfLoads;
  } else if (effectiveMode === "per-kg") {
    // Use selected service price if available, otherwise use base price per kg
    const pricePerUnit = selectedService
      ? parseFloat(selectedService.price) || 0
      : parseFloat(basePerKg) || 0;
    baseFee = Math.round(weight * pricePerUnit);
  }

  const addOnTotal = form.addOns.reduce((sum, name) => {
    const found = addOnOptions.find((a) => a.name === name);
    return sum + (parseFloat(found?.rate ?? "0") || 0);
  }, 0);

  const totalFee = priceDisplayMode === "free" ? 0 : (baseFee + addOnTotal);

  const computeFee = () => totalFee;

  const step1Valid =
    !loyaltyEnabled || form.customerType === "walkin"
      ? form.customerName.trim().length > 0 && (!form.phone || form.phone.length === 0 || form.phone.length === 11)
      : form.loyaltyMember !== null;

  const step2Valid =
    effectiveMode === "per-load"
      ? (!!selectedTierId && numberOfLoads > 0)
      : (weight > 0 && weight >= minWeightNum);

  const handleSubmit = () => {
    const fee = computeFee();
    // For per-load, the "wash type" shown in the summary is the tier name
    // For per-kg without service type, show "Per Kilogram"
    const displayWashType =
      effectiveMode === "per-load" && selectedTier
        ? selectedTier.name
        : form.washType || "Per Kilogram";
    onSubmit({
      customerName: form.customerName,
      phone: form.phone,
      arrivalDateTime: form.arrivalDateTime,
      dropOffDate: form.arrivalDateTime.split(" ")[0],
      washType: displayWashType,
      weight: effectiveMode === "per-load" ? 0 : parseFloat(form.weight),
      fee,
      status: "Received",
      paymentStatus: form.paymentStatus,
      addOns: form.addOns,
      washInstructions: form.washInstructions,
    });
    onClose();
  };

  // ── Step 1: Customer Information ──────────────────────────────────────────
  const renderStep1 = () => (
    <div className="space-y-4">
      {/* Customer type selector — only shown when loyalty is enabled */}
      {loyaltyEnabled && (
        <div className="grid grid-cols-2 gap-3">
          {([
            { type: "walkin",  icon: User,  label: "Walk-in Customer",  sub: "No loyalty account" },
            { type: "loyalty", icon: Star,  label: "Loyalty Member",     sub: "Has a loyalty account" },
          ] as const).map(({ type, icon: Icon, label, sub }) => (
            <button
              key={type}
              onClick={() => {
                setForm((f) => ({ ...f, customerType: type, loyaltyMember: null, customerName: "", phone: "" }));
                setMemberSearch(""); setMemberSearchRes([]); setManualId(""); setManualError(""); setShowScanner(false);
              }}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all cursor-pointer",
                form.customerType === type
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-background hover:border-primary/40 hover:bg-muted/20"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                form.customerType === type ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className={cn("text-sm font-semibold", form.customerType === type ? "text-primary" : "text-foreground")}>{label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
              </div>
              {form.customerType === type && (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Walk-in fields — shown always if loyalty disabled, or when walkin is selected */}
      {(!loyaltyEnabled || form.customerType === "walkin") && (
        <div className="space-y-3 pt-1">
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">
              Full Name <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="Customer full name"
              value={form.customerName}
              onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
              className="h-9 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">
              Phone Number <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Input
              type="tel"
              placeholder="e.g. 09123456789"
              value={form.phone}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9+]/g, '');
                if (value.length <= 11 || (value.startsWith('+') && value.length <= 13)) {
                  setForm((f) => ({ ...f, phone: value }));
                }
              }}
              className={cn("h-9 text-sm", form.phone && form.phone.length > 0 && form.phone.length < 11 && "border-red-500")}
            />
            {form.phone && form.phone.length > 0 && form.phone.length < 11 && (
              <p className="text-xs text-destructive mt-1">Please enter a valid 11-digit phone number</p>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">
              Arrival Date &amp; Time <span className="text-destructive">*</span>
            </label>
            <Input
              type="datetime-local"
              value={form.arrivalDateTime}
              onChange={(e) => setForm((f) => ({ ...f, arrivalDateTime: e.target.value }))}
              className="h-9 text-sm"
            />
          </div>
        </div>
      )}

      {/* Loyalty member lookup */}
      {form.customerType === "loyalty" && (
        <div className="space-y-4 pt-1">
          {form.loyaltyMember ? (
            <>
              <MemberCard member={form.loyaltyMember} onClear={() => setForm((f) => ({ ...f, loyaltyMember: null, customerName: "", phone: "" }))} />
              <div>
                <label className="text-xs font-medium text-foreground block mb-1.5">
                  Arrival Date &amp; Time <span className="text-destructive">*</span>
                </label>
                <Input
                  type="datetime-local"
                  value={form.arrivalDateTime}
                  onChange={(e) => setForm((f) => ({ ...f, arrivalDateTime: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-foreground">Find Loyalty Member</p>

              {/* Option A — search */}
              <div className="relative">
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Search by Name or ID</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Type member name or ID…"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                </div>
                {memberSearchRes.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                    {memberSearchRes.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => selectMember(m)}
                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 text-left transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">{m.name}</p>
                          <p className="text-xs text-muted-foreground">{m.phone} · ID: {m.id}</p>
                        </div>
                        <div className="text-xs text-primary font-medium shrink-0 ml-3">
                          {m.stampCount % STAMP_MILESTONE}/{STAMP_MILESTONE} stamps
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Option B — QR scan */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Or scan member QR code</label>
                {showScanner ? (
                  <InlineQRScanner onScan={handleQRScan} onClose={() => setShowScanner(false)} />
                ) : (
                  <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowScanner(true)}>
                    <Camera className="w-3.5 h-3.5" /> Open Camera Scanner
                  </Button>
                )}
              </div>

              {/* Option C — manual ID */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Or enter Member ID manually</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. 1, 2, 3…"
                    value={manualId}
                    onChange={(e) => { setManualId(e.target.value); setManualError(""); }}
                    className="h-9 text-sm flex-1"
                    onKeyDown={(e) => e.key === "Enter" && handleManualFind()}
                  />
                  <Button size="sm" onClick={handleManualFind} disabled={!manualId.trim()}>
                    Find Member
                  </Button>
                </div>
                {manualError && <p className="text-xs text-destructive mt-1.5">{manualError}</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ── Step 2: Service Details ───────────────────────────────────────────────
  const renderStep2 = () => {
    // Filter services by the effective charging mode's pricingType
    const perKgServices  = serviceTypes.filter((s) => s.pricingType === "per-kg" || s.pricingType === "per-piece");
    const perLoadServices = serviceTypes.filter((s) => s.pricingType === "per-load");
    const visibleServices = effectiveMode === "per-load" ? perLoadServices : perKgServices;
    const svcCols = visibleServices.length <= 2 ? visibleServices.length || 1 : visibleServices.length === 4 ? 2 : 3;

    // Fee preview is hidden entirely when priceDisplayMode is "hide"; "free" shows ₱0
    const showFeePreview =
      priceDisplayMode !== "hide" &&
      (effectiveMode === "per-load" ? !!selectedTierId : (weight > 0 && !!form.washType));
    // Global price label override — per-service showPrice is respected unless global mode forces hide/free
    const globalHidePrice = priceDisplayMode === "free" || priceDisplayMode === "hide";

    // Shared add-ons + wash instructions + fee breakdown block
    const renderAddOnsAndFee = () => (
      <>
        {/* Add-ons */}
        {addOnOptions.length > 0 && (
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Add-ons</label>
            <div className="flex flex-wrap gap-2">
              {addOnOptions.map((ao) => (
                <button
                  key={ao.id}
                  onClick={() => toggleAddOn(ao.name)}
                  className={cn(
                    "px-3 py-1.5 rounded-full border text-xs font-medium transition-all cursor-pointer",
                    form.addOns.includes(ao.name)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border text-foreground hover:border-primary/40"
                  )}
                >
                  {form.addOns.includes(ao.name) && <Check className="w-3 h-3 inline mr-1" />}
                  {ao.name}
                  {!globalHidePrice && <span className="ml-1 opacity-70">+₱{ao.rate}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Wash Instructions */}
        <div>
          <label className="text-xs font-medium text-foreground block mb-1.5">Wash Instructions</label>
          <Textarea
            placeholder="Special instructions…"
            value={form.washInstructions}
            onChange={(e) => setForm((f) => ({ ...f, washInstructions: e.target.value }))}
            className="text-sm resize-none"
            rows={2}
          />
        </div>

        {/* Live fee breakdown — hidden in "hide" mode, always ₱0 in "free" mode */}
        {showFeePreview && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fee Breakdown</p>
            {priceDisplayMode === "free" ? (
              <div className="flex items-center justify-between border-t border-primary/20 pt-2">
                <span className="text-sm font-semibold">Total</span>
                <span className="text-lg font-bold text-primary">₱0</span>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Base fee
                      {effectiveMode === "per-kg" && weight > 0 && (
                        <span className="text-xs ml-1 text-muted-foreground/70">
                          ({weight} kg × ₱{selectedService ? selectedService.price : basePerKg})
                        </span>
                      )}
                      {effectiveMode === "per-load" && selectedTier && (
                        <span className="text-xs ml-1 text-muted-foreground/70">
                          ({selectedTier.name})
                        </span>
                      )}
                    </span>
                    <span className="font-medium text-foreground">₱{baseFee}</span>
                  </div>
                  {form.addOns.map((name) => {
                    const ao = addOnOptions.find((a) => a.name === name);
                    return ao ? (
                      <div key={name} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{name}</span>
                        <span className="font-medium text-foreground">+₱{ao.rate}</span>
                      </div>
                    ) : null;
                  })}
                  {form.addOns.length > 0 && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5 border-t border-primary/10">
                      <span>Add-ons total</span>
                      <span>+₱{addOnTotal}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between border-t border-primary/20 pt-2">
                  <span className="text-sm font-semibold">Total</span>
                  <span className="text-lg font-bold text-primary">₱{totalFee}</span>
                </div>
              </>
            )}
          </div>
        )}
        {/* "hide" mode hint — shown when a service/tier is selected but fee is deferred to Step 3 */}
        {priceDisplayMode === "hide" && (effectiveMode === "per-load" ? !!selectedTierId : (weight > 0 && !!form.washType)) && (
          <div className="flex items-center gap-2 bg-muted/40 border border-border rounded-lg px-3 py-2.5 text-xs text-muted-foreground">
            <EyeOff className="w-3.5 h-3.5 shrink-0" />
            Fee will be shown on the next step before you confirm.
          </div>
        )}
      </>
    );

    return (
      <div className="space-y-4">

        {/* ── "Both" mode — staff picks charging method ─────────────────── */}
        {pricingMode === "both" && (
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Charge by</label>
            <div className="grid grid-cols-2 gap-2">
              {(["per-kg", "per-load"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    updateChargingMode(mode);
                    if (mode === "per-kg") {
                      setSelectedTierId(loadTiers[0]?.id ?? "");
                      setForm((f) => ({ ...f, numberOfLoads: "1" }));
                    } else {
                      setForm((f) => ({ ...f, weight: "", numberOfLoads: "1" }));
                    }
                  }}
                  className={cn(
                    "rounded-lg border-2 py-2.5 text-sm font-medium transition-all cursor-pointer",
                    chargingMode === mode
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-background hover:border-primary/40 text-foreground"
                  )}
                >
                  {mode === "per-kg" ? "Per Kilogram" : "Per Load"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Per Kg mode ───────────────────────────────────────────────── */}
        {effectiveMode === "per-kg" && (
          <>
            {/* Wash Type — only per-kg and per-piece services (OPTIONAL) */}
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Wash Type <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              {visibleServices.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-4 py-3 text-center text-xs text-muted-foreground bg-muted/20">
                  <p className="font-medium text-foreground mb-1">No wash types available</p>
                  <p>Using base price per kg (₱{basePerKg}/kg). Wash types can be added in Settings.</p>
                </div>
              ) : (
                <div className={cn("grid gap-2", svcCols === 2 ? "grid-cols-2" : "grid-cols-3")}>
                  {visibleServices.map((svc) => {
                    const showThisPrice = !globalHidePrice && (svc.showPrice ?? true);
                    const unitLabel = svc.pricingType === "per-piece" ? "/pc" : "/kg";
                    return (
                      <button
                        key={svc.id}
                        onClick={() => setForm((f) => ({ ...f, washType: svc.name }))}
                        className={cn(
                          "rounded-lg border-2 py-2.5 px-3 text-sm font-medium transition-all cursor-pointer flex flex-col items-center gap-0.5",
                          form.washType === svc.name
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border bg-background hover:border-primary/40 text-foreground"
                        )}
                      >
                        <span>{svc.name}</span>
                        {showThisPrice && (
                          <span className={cn("text-[11px] font-normal", form.washType === svc.name ? "text-primary/70" : "text-muted-foreground")}>
                            ₱{svc.price}{unitLabel}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Weight */}
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Weight (kg) <span className="text-destructive">*</span>
                {minWeightNum > 0 && (
                  <span className="ml-1 text-muted-foreground font-normal">(min. {minWeightNum} kg)</span>
                )}
              </label>
              <Input
                type="number"
                min={minWeightNum > 0 ? minWeightNum : 0.5}
                step="0.1"
                placeholder={minWeightNum > 0 ? `Min. ${minWeightNum} kg` : "e.g. 5.0"}
                value={form.weight}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9.]/g, '');
                  setForm((f) => ({ ...f, weight: value }));
                }}
                onKeyDown={(e) => {
                  if (!/[0-9.]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                    e.preventDefault();
                  }
                }}
                className="h-9 text-sm"
              />
              {minWeightNum > 0 && weight > 0 && weight < minWeightNum && (
                <p className="text-xs text-destructive mt-1">Weight must be at least {minWeightNum} kg</p>
              )}
            </div>
          </>
        )}

        {/* ── Per Load mode ─────────────────────────────────────────────── */}
        {effectiveMode === "per-load" && (
          <>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Load Size <span className="text-destructive">*</span>
              </label>
              {loadTiers.length === 0 ? (
                <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-4 text-center text-xs">
                  <p className="font-semibold text-destructive mb-1.5">No load sizes available</p>
                  <p className="text-muted-foreground">Please enable service types in Settings → Pricing, or switch to Per Kilogram pricing above.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {loadTiers.map((tier) => (
                    <button
                      key={tier.id}
                      onClick={() => setSelectedTierId(tier.id)}
                      className={cn(
                        "rounded-lg border-2 py-3 px-3 text-left transition-all cursor-pointer",
                        selectedTierId === tier.id
                          ? "border-primary bg-primary/5"
                          : "border-border bg-background hover:border-primary/40"
                      )}
                    >
                      <p className={cn("text-sm font-semibold leading-tight", selectedTierId === tier.id ? "text-primary" : "text-foreground")}>
                        {tier.name}
                      </p>
                      {tier.range && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{tier.range}</p>
                      )}
                      {!globalHidePrice && (
                        <p className={cn("text-base font-bold mt-1", selectedTierId === tier.id ? "text-primary" : "text-foreground")}>
                          ₱{tier.price}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Number of Loads */}
            {selectedTierId && (
              <div>
                <label className="text-xs font-medium text-foreground block mb-1.5">
                  Number of Loads <span className="text-destructive">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="e.g. 2"
                    value={form.numberOfLoads}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setForm((f) => ({ ...f, numberOfLoads: value }));
                    }}
                    onKeyDown={(e) => {
                      if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    className="w-24 h-9 text-sm"
                  />
                  <span className="text-sm text-muted-foreground">load(s)</span>
                </div>
                {numberOfLoads === 0 && form.numberOfLoads !== "" && (
                  <p className="text-xs text-destructive mt-1">Please enter the number of loads</p>
                )}
              </div>
            )}
          </>
        )}

        {renderAddOnsAndFee()}
      </div>
    );
  };

  // ── Step 3: Summary & Receipt ───────────────────��─────────────────────────
  const renderStep3 = () => {
    const fee = computeFee();
    const isLoyalty = form.customerType === "loyalty" && form.loyaltyMember;
    const member = form.loyaltyMember;
    const willUnlock = isLoyalty && member && (member.stampCount + 1) % STAMP_MILESTONE === 0;

    return (
      <div className="space-y-4">
        {isLoyalty && member && (
          <MemberCard member={member} stampAfter />
        )}

        <div className="bg-muted/30 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Transaction Summary</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              { label: "Customer",   value: form.customerName },
              { label: "Phone",      value: form.phone || "—" },
              { label: "Arrival",    value: form.arrivalDateTime },
              effectiveMode === "per-load"
                ? { label: "Load Size",  value: selectedTier ? `${selectedTier.name} (${selectedTier.range})` : "—" }
                : { label: "Wash Type",  value: form.washType || "Per Kilogram" },
              effectiveMode === "per-load"
                ? { label: "Pricing",    value: "Per Load" }
                : { label: "Weight",     value: `${form.weight} kg` },
              { label: "Add-ons",    value: form.addOns.length ? form.addOns.join(", ") : "None" },
            ].map((row) => (
              <div key={row.label} className="bg-background/60 rounded-md p-2.5">
                <p className="text-[10px] text-muted-foreground">{row.label}</p>
                <p className="text-xs font-medium text-foreground mt-0.5 truncate">{row.value}</p>
              </div>
            ))}
          </div>
          <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-medium">Total Fee</span>
            <span className="text-xl font-bold text-primary">₱{fee}</span>
          </div>

          {/* Payment Status */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Payment Status</p>
            <div className="grid grid-cols-2 gap-2">
              {(["unpaid", "paid"] as const).map((ps) => (
                <button
                  key={ps}
                  onClick={() => setForm((f) => ({ ...f, paymentStatus: ps }))}
                  className={cn(
                    "rounded-lg border-2 py-3 px-4 text-sm font-semibold transition-all cursor-pointer flex flex-col items-center gap-0.5",
                    ps === "unpaid"
                      ? form.paymentStatus === "unpaid"
                        ? "border-red-500 bg-red-50 text-red-600"
                        : "border-border bg-background text-muted-foreground hover:border-red-300"
                      : form.paymentStatus === "paid"
                        ? "border-green-500 bg-green-50 text-green-600"
                        : "border-border bg-background text-muted-foreground hover:border-green-300"
                  )}
                >
                  {ps === "unpaid" ? "Unpaid" : "Paid"}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
              {form.paymentStatus === "unpaid"
                ? "Payment will be recorded as pending. Customer receipt will show balance due."
                : "Payment confirmed. Receipt will show as fully paid."}
            </p>
          </div>
        </div>

        {isLoyalty && member && (
          <div className="bg-muted/30 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Loyalty Update</p>
            <p className="text-sm text-foreground">
              {member.name} — Stamp <strong>{member.stampCount + 1}</strong> of{" "}
              <strong>{Math.ceil((member.stampCount + 1) / STAMP_MILESTONE) * STAMP_MILESTONE}</strong> added!
            </p>
            {willUnlock && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 flex items-center gap-2 text-xs text-yellow-800">
                <span className="text-base">🎉</span>
                <span><strong>Reward unlocked!</strong> Free wash earned.</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const stepTitles = ["Customer Information", "Service Details", "Summary & Confirm"];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:w-auto max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Transaction</DialogTitle>
          <DialogDescription>Step {step} of 3 — {stepTitles[step - 1]}</DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 py-1">
          {stepTitles.map((t, idx) => {
            const i = idx + 1;
            const done = step > i;
            const active = step === i;
            return (
              <div key={t} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all",
                    done ? "bg-primary border-primary text-primary-foreground"
                      : active ? "bg-primary border-primary text-primary-foreground"
                        : "bg-background border-border text-muted-foreground"
                  )}>
                    {done ? <Check className="w-3 h-3" /> : i}
                  </div>
                  <span className={cn("text-[9px] text-center w-16 leading-tight hidden sm:block",
                    active ? "text-primary font-semibold" : "text-muted-foreground")}>{t}</span>
                </div>
                {idx < stepTitles.length - 1 && (
                  <div className={cn("flex-1 h-0.5 mb-3 mx-1 transition-colors", done ? "bg-primary" : "bg-border")} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <div className="mt-1">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </div>

        {/* Navigation */}
        <div className="flex gap-2 pt-2">
          {step > 1 && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setStep((s) => s - 1)}>
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </Button>
          )}
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          {step < 3 && (
            <Button
              size="sm"
              disabled={step === 1 ? !step1Valid : !step2Valid}
              onClick={() => setStep((s) => s + 1)}
              className="gap-1.5"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          )}
          {step === 3 && (
            <Button size="sm" onClick={handleSubmit} className="gap-1.5">
              <Check className="w-3.5 h-3.5" /> Confirm &amp; Create
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Toast ────────��───────────────────────────────────────────��─��─────────────
function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background text-sm px-5 py-3 rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-200"
      onAnimationEnd={() => setTimeout(onDone, 2800)}
    >
      {message}
    </div>
  );
}

// ── History types ─────────────────────────────────────────────────────────────
interface TransactionsPageProps {
  transactions: Transaction[];
  loading?: boolean;
  error?: string | null;
  loyaltyEnabled?: boolean;
  onCreateTransaction: (input: CreateTransactionInput) => Promise<Transaction>;
  onUpdateTransaction: (ticketId: string, updates: UpdateTransactionInput) => Promise<Transaction>;
  editTicketId?: string;
  onEditComplete?: () => void;
}

export default function TransactionsPage({
  transactions: txns,
  loading = false,
  error = null,
  loyaltyEnabled = true,
  onCreateTransaction,
  onUpdateTransaction,
  editTicketId,
  onEditComplete,
}: TransactionsPageProps) {

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPayment, setFilterPayment] = useState("all");
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
  const [sortBy, setSortBy] = useState<"smart" | "newest" | "oldest" | "unpaid-first" | "ready-first" | "status-az">("smart");

  // New Transaction wizard
  const [showWizard, setShowWizard] = useState(false);

  // Modals
  const [viewTxn, setViewTxn]         = useState<Transaction | null>(null);
  const [editTxn, setEditTxn]         = useState<Transaction | null>(null);
  const [editInstructions, setEditInstructions] = useState("");
  const [editStatus, setEditStatus]   = useState<Transaction["status"]>("Received");
  const [editPaymentStatus, setEditPaymentStatus] = useState<PaymentStatus>("unpaid");
  const [voidTxn, setVoidTxn]         = useState<Transaction | null>(null);
  const [voidReason, setVoidReason]   = useState("");
  const [reprintTxn, setReprintTxn]   = useState<Transaction | null>(null);
  const [printTxn, setPrintTxn]       = useState<Transaction | null>(null);
  const [printPostCreate, setPrintPostCreate] = useState(false);
  const [busy, setBusy] = useState(false);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };
  const origin = typeof window !== "undefined" ? window.location.origin : "https://laundrytrack.ph";
  const getTrackingQrSrc = (transaction: Transaction, size: number) => {
    const path = transaction.publicTrackingToken
      ? `/track/${transaction.publicTrackingToken}`
      : `/ticket/${transaction.ticketId}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(`${origin}${path}`)}`;
  };

  // ── History helpers ──────────────────────────────────────────────���───────
  const commit = (..._args: unknown[]) => undefined;
  const undo = () => undefined;
  const redo = () => undefined;

  // ── Actions ──────────────────────────����───────────────────────────────────
  const confirmVoid = async () => {
    if (!voidTxn || !voidReason.trim()) return;
    setBusy(true);
    try {
      await onUpdateTransaction(voidTxn.ticketId, {
        status: "Voided",
        voidReason,
      });
      showToast(`Ticket #${voidTxn.ticketId} has been voided`);
      setVoidTxn(null);
      setVoidReason("");
    } catch {
      showToast("Unable to void this ticket right now");
    } finally {
      setBusy(false);
    }
  };

  const moveToNextStatus = async () => {
    if (!editTxn) return;
    const idx = statusOrder.indexOf(editTxn.status as (typeof statusOrder)[number]);
    if (idx < 0 || idx >= statusOrder.length - 1) return;
    const nextStatus = statusOrder[idx + 1];
    setBusy(true);
    try {
      const updatedTxn = await onUpdateTransaction(editTxn.ticketId, {
        status: nextStatus,
        washInstructions: editInstructions || editTxn.washInstructions,
      });
      setEditTxn(updatedTxn);
      showToast(`Ticket #${editTxn.ticketId} moved to ${nextStatus}`);
      return;
    } catch {
      showToast("Unable to update the ticket status right now");
    } finally {
      setBusy(false);
    }
  };

  const saveInstructions = async () => {
    if (!editTxn) return;
    if (editStatus === "Claimed" && editPaymentStatus === "unpaid") {
      showToast("Mark payment as Paid first before claiming this ticket.");
      return;
    }
    setBusy(true);
    try {
      await onUpdateTransaction(editTxn.ticketId, {
        status: editStatus,
        paymentStatus: editPaymentStatus,
        washInstructions: editInstructions,
      });
      showToast(`Ticket #${editTxn.ticketId} updated successfully`);
      setEditTxn(null);
      onEditComplete?.();
      return;
    } catch {
      showToast("Unable to save ticket changes right now");
    } finally {
      setBusy(false);
    }
  };

  const markAsClaimed = async () => {
    if (!editTxn) return;
    setBusy(true);
    try {
      await onUpdateTransaction(editTxn.ticketId, {
        status: "Claimed",
        paymentStatus: editPaymentStatus,
        washInstructions: editInstructions,
      });
      showToast(`Ticket #${editTxn.ticketId} marked as Claimed`);
      setEditTxn(null);
      onEditComplete?.();
      return;
    } catch {
      showToast("Unable to mark this ticket as claimed right now");
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (txn: Transaction) => {
    setEditTxn(txn);
    setEditInstructions(txn.washInstructions || "");
    setEditStatus(txn.status);
    setEditPaymentStatus(txn.paymentStatus);
  };

  // Auto-open edit modal if editTicketId is provided
  useEffect(() => {
    if (editTicketId) {
      const txn = txns.find(t => t.ticketId === editTicketId);
      if (txn) openEdit(txn);
    }
  }, [editTicketId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNewTransaction = async (partial: Omit<Transaction, "id" | "ticketId">) => {
    setBusy(true);
    try {
      const newTxn = await onCreateTransaction({
        customerName: partial.customerName,
        phone: partial.phone,
        arrivalDateTime: partial.arrivalDateTime,
        washType: partial.washType,
        weight: partial.weight,
        fee: partial.fee,
        status: partial.status,
        paymentStatus: partial.paymentStatus,
        addOns: partial.addOns,
        washInstructions: partial.washInstructions,
        eta: partial.eta ?? null,
      });
      showToast(`Ticket #${newTxn.ticketId} created for ${partial.customerName}`);
      setPrintTxn(newTxn);
      setPrintPostCreate(true);
      return;
    } catch {
      showToast("Unable to create a new transaction right now");
    } finally {
      setBusy(false);
    }
  };

  // ── Smart priority scoring ───────────────────────────────────────────────
  const activeStatuses = new Set(["Received", "Washing", "Drying"]);

  const smartPriority = (t: Transaction): number => {
    if (t.status === "Voided")  return 90;
    if (t.status === "Claimed") return 80;
    // Unpaid + Active (not Ready) — Priority 1
    if (t.paymentStatus === "unpaid" && activeStatuses.has(t.status)) return 1;
    // Unpaid + Ready — Priority 2
    if (t.paymentStatus === "unpaid" && t.status === "Ready") return 2;
    // Paid + Ready — Priority 3
    if (t.paymentStatus === "paid" && t.status === "Ready") return 3;
    // Paid + Active — Priority 4
    if (t.paymentStatus === "paid" && activeStatuses.has(t.status)) return 4;
    return 50;
  };

  // ── Row visual class ─────────────────────────────────────────────────────
  const rowVisualClass = (t: Transaction): string => {
    if (t.status === "Voided" || t.status === "Claimed") return "";
    if (t.paymentStatus === "unpaid" && t.status === "Ready")
      return "border-l-[3px] border-l-red-500 bg-red-50/40";
    if (t.paymentStatus === "unpaid" && activeStatuses.has(t.status))
      return "border-l-[3px] border-l-orange-400 bg-orange-50/30";
    return "";
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const filtered = (() => {
    const base = txns.filter((t) => {
      const matchSearch =
        t.customerName.toLowerCase().includes(search.toLowerCase()) ||
        t.ticketId.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === "all" || t.status === filterStatus;
      const matchPayment = filterPayment === "all" || t.paymentStatus === filterPayment;
      const matchDate = !filterDate || t.dropOffDate === format(filterDate, "yyyy-MM-dd");
      return matchSearch && matchStatus && matchPayment && matchDate;
    });

    const sorted = [...base];
    switch (sortBy) {
      case "smart":
        sorted.sort((a, b) => {
          const diff = smartPriority(a) - smartPriority(b);
          if (diff !== 0) return diff;
          // Tiebreak: newer arrival first
          return b.arrivalDateTime.localeCompare(a.arrivalDateTime);
        });
        break;
      case "newest":
        sorted.sort((a, b) => b.arrivalDateTime.localeCompare(a.arrivalDateTime));
        break;
      case "oldest":
        sorted.sort((a, b) => a.arrivalDateTime.localeCompare(b.arrivalDateTime));
        break;
      case "unpaid-first":
        sorted.sort((a, b) => {
          if (a.paymentStatus === b.paymentStatus) return 0;
          return a.paymentStatus === "unpaid" ? -1 : 1;
        });
        break;
      case "ready-first":
        sorted.sort((a, b) => {
          if (a.status === b.status) return 0;
          return a.status === "Ready" ? -1 : b.status === "Ready" ? 1 : 0;
        });
        break;
      case "status-az":
        sorted.sort((a, b) => a.status.localeCompare(b.status));
        break;
    }
    return sorted;
  })();


  const canUndo = false;
  const canRedo = false;

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Filter bar */}
      <div className="bg-card border border-border rounded-lg p-3 md:p-4 flex flex-col sm:flex-row flex-wrap gap-3">
        {/* New Transaction button */}
        <Button size="sm" className="h-10 md:h-9 gap-1.5 shrink-0" onClick={() => setShowWizard(true)} disabled={busy || loading}>
          <Plus className="w-4 h-4" /> New Transaction
        </Button>

        <div className="relative flex-1 min-w-0 sm:min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or ticket ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 md:h-9 text-sm w-full"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-40 h-10 md:h-9 text-sm">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {statusOrder.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
            <SelectItem value="Voided">Voided</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPayment} onValueChange={setFilterPayment}>
          <SelectTrigger className="w-full sm:w-40 h-10 md:h-9 text-sm">
            <SelectValue placeholder="All Payments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payments</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="w-full sm:w-48 h-10 md:h-9 text-sm">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="smart">Default (Smart Priority)</SelectItem>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="unpaid-first">Unpaid First</SelectItem>
            <SelectItem value="ready-first">Ready First</SelectItem>
            <SelectItem value="status-az">Status (A-Z)</SelectItem>
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full sm:w-44 h-10 md:h-9 text-sm justify-start gap-2 font-normal">
              <CalendarIcon className="w-4 h-4 text-muted-foreground shrink-0" />
              {filterDate ? format(filterDate, "MMM d, yyyy") : "All dates"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filterDate}
              onSelect={(d) => setFilterDate(d ?? undefined)}
              initialFocus
            />
            {filterDate && (
              <div className="p-2 border-t border-border">
                <Button variant="ghost" size="sm" className="w-full text-xs h-7" onClick={() => setFilterDate(undefined)}>
                  Clear date filter
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Undo / Redo */}
        <div className="flex gap-1.5 sm:ml-auto">
          <Button
            variant="outline"
            size="sm"
            className="h-10 md:h-9 px-3 gap-1.5 text-xs"
            disabled={!canUndo}
            onClick={undo}
            title="Undo last action"
          >
            <Undo2 className="w-3.5 h-3.5" /> Undo
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-10 md:h-9 px-3 gap-1.5 text-xs"
            disabled={!canRedo}
            onClick={redo}
            title="Redo last undone action"
          >
            <Redo2 className="w-3.5 h-3.5" /> Redo
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">Ticket ID</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">Customer Name</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap hidden md:table-cell">Arrival Date & Time</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap hidden sm:table-cell">Weight</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap hidden md:table-cell">Wash Type</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">Fee</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap hidden sm:table-cell">Payment</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">Status</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((txn) => {
                const isVoided  = txn.status === "Voided";
                const isClaimed = txn.status === "Claimed";
                const visualCls = rowVisualClass(txn);
                return (
                  <tr
                    key={txn.id}
                    className={cn(
                      "border-b border-border last:border-0 transition-colors",
                      isVoided  ? "bg-muted/30 opacity-50" : "",
                      isClaimed ? "text-muted-foreground/60" : "",
                      !isVoided && !isClaimed ? "hover:bg-muted/20" : "",
                      visualCls
                    )}
                  >
                    <td className={cn("px-4 py-3 text-xs font-mono font-semibold text-primary", isVoided && "line-through", isClaimed && "text-muted-foreground/60")}>{txn.ticketId}</td>
                    <td className={cn("px-4 py-3 text-xs font-medium", isVoided && "line-through text-foreground", isClaimed ? "text-muted-foreground/60" : "text-foreground")}>{txn.customerName}</td>
                    <td className={cn("px-4 py-3 text-xs text-muted-foreground whitespace-nowrap hidden md:table-cell", isVoided && "line-through", isClaimed && "text-muted-foreground/50")}>{txn.arrivalDateTime}</td>
                    <td className={cn("px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell", isVoided && "line-through", isClaimed && "text-muted-foreground/50")}>{txn.weight} kg</td>
                    <td className={cn("px-4 py-3 text-xs text-muted-foreground hidden md:table-cell", isVoided && "line-through", isClaimed && "text-muted-foreground/50")}>{txn.washType}</td>
                    <td className={cn("px-4 py-3 text-xs font-medium", isVoided && "line-through text-foreground", isClaimed ? "text-muted-foreground/60" : "text-foreground")}>₱{txn.fee}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap",
                        txn.paymentStatus === "paid"
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : "bg-red-50 text-red-600 border border-red-200"
                      )}>
                        {txn.paymentStatus === "paid" ? "Paid" : "Unpaid"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap",
                        statusColors[txn.status]
                      )}>
                        {txn.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-0.5">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="View" onClick={() => setViewTxn(txn)}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" disabled={isVoided} onClick={() => openEdit(txn)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          title="Void"
                          disabled={isVoided}
                          onClick={() => { setVoidTxn(txn); setVoidReason(""); }}
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hidden sm:flex" title="Print Receipt" onClick={() => { setPrintTxn(txn); setPrintPostCreate(false); }}>
                          <Printer className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-sm text-muted-foreground">
                    {loading ? "Loading transactions..." : "No transactions found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── VIEW MODAL (read-only) ──────────────────────────────────────────── */}
      <Dialog open={!!viewTxn} onOpenChange={(open) => !open && setViewTxn(null)}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:w-auto max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ticket Details — {viewTxn?.ticketId}</DialogTitle>
            <DialogDescription>Read-only view of this transaction.</DialogDescription>
          </DialogHeader>
          {viewTxn && (
            <div className="space-y-5">
              {/* Details grid */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  { label: "Ticket ID",           value: viewTxn.ticketId,                                          span: false },
                  { label: "Customer Name",        value: viewTxn.customerName,                                      span: false },
                  { label: "Arrival Date & Time",  value: viewTxn.arrivalDateTime,                                   span: true  },
                  { label: "Weight (kg)",          value: `${viewTxn.weight} kg`,                                    span: false },
                  { label: "Wash Type",            value: viewTxn.washType,                                          span: false },
                  { label: "Add-ons",              value: viewTxn.addOns.length ? viewTxn.addOns.join(", ") : "None", span: false },
                  { label: "Total Fee",            value: `₱${viewTxn.fee}`,                                         span: false },
                  { label: "ETA",                  value: viewTxn.eta ? formatReadableDateTime(viewTxn.eta) : "Awaiting estimate", span: false },
                ].map((row) => (
                  <div key={row.label} className={cn("bg-muted/30 rounded-md p-2.5", row.span && "col-span-2")}>
                    <p className="text-[11px] text-muted-foreground">{row.label}</p>
                    <p className="font-medium text-foreground text-xs mt-0.5">{row.value}</p>
                  </div>
                ))}
                {/* Payment Status */}
                <div className="bg-muted/30 rounded-md p-2.5">
                  <p className="text-[11px] text-muted-foreground mb-1">Payment Status</p>
                  <span className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border",
                    viewTxn.paymentStatus === "paid"
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-red-50 text-red-600 border-red-200"
                  )}>
                    {viewTxn.paymentStatus === "paid" ? "Paid" : "Unpaid"}
                  </span>
                </div>
                {/* Current Status */}
                <div className="bg-muted/30 rounded-md p-2.5">
                  <p className="text-[11px] text-muted-foreground mb-1">Current Status</p>
                  <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium", statusColors[viewTxn.status])}>
                    {viewTxn.status}
                  </span>
                </div>
                {/* Wash instructions read-only */}
                {viewTxn.washInstructions && (
                  <div className="col-span-2 bg-muted/30 rounded-md p-2.5">
                    <p className="text-[11px] text-muted-foreground">Wash Instructions</p>
                    <p className="font-medium text-foreground text-xs mt-0.5">{viewTxn.washInstructions}</p>
                  </div>
                )}
              </div>

              {/* Status stepper — read-only */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Status Progress</p>
                <div className="flex items-center">
                  {statusOrder.map((step, idx) => {
                    const stepIdx = statusOrder.indexOf(viewTxn.status as (typeof statusOrder)[number]);
                    const isCompleted = idx < stepIdx;
                    const isCurrent   = idx === stepIdx;
                    const isLast      = idx === statusOrder.length - 1;
                    return (
                      <div key={step} className="flex items-center flex-1 last:flex-none">
                        <div className="flex flex-col items-center">
                          <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2",
                            isCompleted || isCurrent ? "bg-primary border-primary text-primary-foreground" : "bg-background border-border text-muted-foreground"
                          )}>
                            {isCompleted ? "✓" : idx + 1}
                          </div>
                          <span className={cn("text-[9px] mt-1 text-center w-10 md:w-12 leading-tight", isCurrent ? "text-primary font-semibold" : "text-muted-foreground")}>
                            {step}
                          </span>
                        </div>
                        {!isLast && <div className={cn("flex-1 h-0.5 mb-4 mx-0.5", isCompleted ? "bg-primary" : "bg-border")} />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* QR Code */}
              <div className="flex flex-col items-center gap-2 py-2 bg-muted/30 rounded-lg">
                <img
                  src={getTrackingQrSrc(viewTxn, 100)}
                  alt={`QR for ${viewTxn.ticketId}`}
                  width={100}
                  height={100}
                  crossOrigin="anonymous"
                />
                <p className="text-[10px] text-muted-foreground font-mono">{viewTxn.ticketId}</p>
              </div>

              {/* View modal actions */}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => { setReprintTxn(viewTxn); setViewTxn(null); }}>
                  <Printer className="w-3.5 h-3.5" /> Reprint QR
                </Button>
                <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => { setPrintTxn(viewTxn); setPrintPostCreate(false); setViewTxn(null); }}>
                  <Printer className="w-3.5 h-3.5" /> Print Receipt
                </Button>
                <Button size="sm" variant="secondary" className="flex-1" onClick={() => setViewTxn(null)}>
                  <X className="w-3.5 h-3.5 mr-1" /> Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── EDIT MODAL ────────���────────────────────────────────────────────── */}
      <Dialog open={!!editTxn} onOpenChange={(open) => { if (!open) { setEditTxn(null); onEditComplete?.(); } }}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:w-auto max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Ticket — {editTxn?.ticketId}</DialogTitle>
            <DialogDescription>Update status and payment for this transaction.</DialogDescription>
          </DialogHeader>
          {editTxn && (
            <div className="space-y-5">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  { label: "Customer",  value: editTxn.customerName },
                  { label: "Wash Type", value: editTxn.washType },
                  { label: "Weight",    value: `${editTxn.weight} kg` },
                  { label: "Fee",       value: `₱${editTxn.fee}` },
                ].map((row) => (
                  <div key={row.label} className="bg-muted/30 rounded-md p-2.5">
                    <p className="text-[11px] text-muted-foreground">{row.label}</p>
                    <p className="font-medium text-foreground text-xs mt-0.5">{row.value}</p>
                  </div>
                ))}
              </div>

              {/* Status dropdown */}
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Current Status</label>
                <Select
                  value={editStatus}
                  onValueChange={(v) => setEditStatus(v as Transaction["status"])}
                >
                  <SelectTrigger className="h-9 text-sm transition-colors duration-200 hover:border-blue-400 focus:border-blue-500 cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {([
                      { value: "Received", dot: "bg-blue-500",   text: "text-blue-700"   },
                      { value: "Washing",  dot: "bg-yellow-500", text: "text-yellow-700" },
                      { value: "Drying",   dot: "bg-orange-500", text: "text-orange-700" },
                      { value: "Ready",    dot: "bg-green-500",  text: "text-green-700"  },
                      { value: "Claimed",  dot: "bg-gray-400",   text: "text-gray-600"   },
                    ] as const).map(({ value, dot, text }) => {
                      const isClaimedBlocked = value === "Claimed" && editPaymentStatus === "unpaid";
                      return (
                        <SelectItem key={value} value={value} disabled={isClaimedBlocked}>
                          <div className="flex items-center gap-2">
                            <span className={cn("w-2 h-2 rounded-full shrink-0", dot)} />
                            <span className={cn("font-medium text-xs", text)}>{value}</span>
                            {isClaimedBlocked && (
                              <span className="ml-1 text-[10px] text-muted-foreground">(payment required)</span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Status */}
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Payment Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["unpaid", "paid"] as const).map((ps) => (
                    <button
                      key={ps}
                      onClick={() => setEditPaymentStatus(ps)}
                      className={cn(
                        "rounded-lg border-2 py-2.5 px-3 text-xs font-semibold transition-all duration-200 cursor-pointer",
                        ps === "unpaid"
                          ? editPaymentStatus === "unpaid"
                            ? "border-red-500 bg-red-50 text-red-600"
                            : "border-border bg-background text-muted-foreground hover:border-red-400 hover:bg-red-50 hover:text-red-600"
                          : editPaymentStatus === "paid"
                            ? "border-green-500 bg-green-50 text-green-600"
                            : "border-border bg-background text-muted-foreground hover:border-green-400 hover:bg-green-50 hover:text-green-600"
                      )}
                    >
                      {ps === "unpaid" ? "Unpaid" : "Paid"}
                    </button>
                  ))}
                </div>
                {editPaymentStatus === "paid" && (
                  <p className="text-[11px] text-green-600 mt-1">Marked as paid. This will be recorded in the transaction log.</p>
                )}
              </div>

              {/* Wash instructions */}
              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Wash Instructions</label>
                <Textarea
                  placeholder="Add special wash instructions..."
                  value={editInstructions}
                  onChange={(e) => setEditInstructions(e.target.value)}
                  className="text-sm resize-none"
                  rows={2}
                />
              </div>

              {/* Warning when payment is Unpaid and user is trying to claim */}
              {editPaymentStatus === "unpaid" && (editStatus === "Ready" || editStatus === "Claimed") && (
                <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2.5 text-sm text-orange-800">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Mark payment as Paid first before claiming this ticket.</span>
                </div>
              )}

              {/* Edit actions */}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                {editStatus === "Ready" && editPaymentStatus === "paid" && (
                  <Button size="sm" onClick={markAsClaimed} className="flex-1 gap-1.5 transition-all duration-200 hover:scale-[1.02] cursor-pointer">
                    <Check className="w-3.5 h-3.5" />
                    Move to Claimed
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={saveInstructions}
                  className="flex-1 transition-all duration-200 hover:bg-blue-500 hover:text-white hover:border-blue-500 hover:scale-[1.02] cursor-pointer"
                >
                  Save Changes
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setEditTxn(null); onEditComplete?.(); }}
                  className="flex-1 transition-all duration-200 hover:bg-red-50 hover:text-red-600 hover:border-red-400 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5 mr-1 transition-transform duration-200 group-hover:rotate-90" /> Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── VOID CONFIRMATION MODAL ──────────────────────────────────────────── */}
      <Dialog open={!!voidTxn} onOpenChange={(open) => { if (!open) { setVoidTxn(null); setVoidReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <DialogTitle>Void Ticket</DialogTitle>
            </div>
            <DialogDescription>
              Are you sure you want to void Ticket #{voidTxn?.ticketId}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Reason <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="Enter reason for voiding..."
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="h-9 text-sm"
              />
              {voidReason.trim() === "" && (
                <p className="text-[11px] text-muted-foreground mt-1">A reason is required to void this ticket.</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                className="flex-1 cursor-pointer"
                disabled={!voidReason.trim()}
                onClick={confirmVoid}
              >
                Confirm Void
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 cursor-pointer"
                onClick={() => { setVoidTxn(null); setVoidReason(""); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── NEW TRANSACTION WIZARD ───────────────────────────────────────────── */}
      <NewTransactionWizard
        open={showWizard}
        onClose={() => setShowWizard(false)}
        onSubmit={handleNewTransaction}
        loyaltyEnabled={loyaltyEnabled}
      />

      {/* ── PRINT RECEIPT MODAL ──────────────────────────────────────────────── */}
      <PrintReceiptModal
        open={!!printTxn}
        onOpenChange={(o) => { if (!o) { setPrintTxn(null); setPrintPostCreate(false); } }}
        transaction={printTxn}
        postCreate={printPostCreate}
      />

      {/* ── REPRINT / QR MODAL ───────────────────────────────────────────────── */}
      <Dialog open={!!reprintTxn} onOpenChange={(open) => !open && setReprintTxn(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-4 h-4" /> Reprint Ticket
            </DialogTitle>
            <DialogDescription>
              Scan or print this QR code for ticket {reprintTxn?.ticketId}.
            </DialogDescription>
          </DialogHeader>
          {reprintTxn && (
            <div className="flex flex-col items-center gap-3 py-4">
              <img
                src={getTrackingQrSrc(reprintTxn, 180)}
                alt={`QR code for ${reprintTxn.ticketId}`}
                width={180}
                height={180}
                crossOrigin="anonymous"
              />
              <p className="text-sm font-mono font-semibold text-foreground">{reprintTxn.ticketId}</p>
              <p className="text-xs text-muted-foreground">{reprintTxn.customerName}</p>
              <div className="flex gap-2 mt-2 w-full">
                <Button size="sm" className="flex-1 flex items-center gap-1.5" onClick={() => window.print()}>
                  <Printer className="w-3.5 h-3.5" /> Print
                </Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setReprintTxn(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
