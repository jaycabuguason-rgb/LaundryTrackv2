"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Search, EyeOff, Edit, Ban, Printer, ChevronRight, X, QrCode, CalendarIcon,
  AlertTriangle, Plus, User, Star, Camera,
  ChevronLeft, Check, RefreshCw, Inbox, MoreHorizontal, Download
} from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { loyaltyMembers as _seedMembers, statusOrder, type Transaction, type PaymentStatus, type LoyaltyMember } from "@/lib/data";
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
  persistPricingConfig,
  persistServiceTypes,
  persistAddOns,
  loadBusinessProfile,
} from "@/lib/settings-store";
import { downloadQrCodeImage, printQrTicketOnly } from "@/lib/qr-ticket";
import type { CreateTransactionInput, UpdateTransactionInput } from "@/lib/transaction-contracts";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { PrintReceiptModal } from "@/components/print-receipt-modal";
import { StatusUpdateSheet, type StatusOption } from "@/components/status-update-sheet";
import { StatusBadge, PaymentBadge, STATUS_ICONS } from "@/components/status-badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import QRScanner from "@/components/qr-scanner";
import type { Page } from "@/components/sidebar";

// ─────────────────────────────────────────────────────────────────────────────
// QR Scanner
// ─────────────────────────────────────────────────────────────────────────────
function InlineQRScanner({ onScan, onClose }: { onScan: (v: string) => void; onClose: () => void }) {
  return (
    <div className="space-y-3">
      <QRScanner
        onScan={(raw) => {
          const m = raw.match(/member\/([A-Z0-9-]+)/i);
          onScan(m ? m[1].toUpperCase() : raw);
        }}
      />
      <Button size="sm" variant="outline" className="w-full min-h-[44px]" onClick={onClose}>
        Cancel Scan
      </Button>
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
        const isNew = highlight && i === (count - 1) % STAMP_MILESTONE;
        return (
          <div key={i} className={cn(
            "w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs transition-all",
            filled
              ? isNew
                ? "bg-yellow-400 border-yellow-500 text-yellow-900 scale-110 shadow"
                : "bg-primary border-primary text-primary-foreground"
              : "bg-muted border-border text-muted-foreground"
          )}>
            {filled ? <Star className="w-3.5 h-3.5 fill-current" /> : <span className="text-xs">{i + 1}</span>}
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
  const currentStamp = member.stampCount % STAMP_MILESTONE;
  const newStamp = stampAfter ? currentStamp + 1 : currentStamp;
  const willUnlock = stampAfter && newStamp >= STAMP_MILESTONE;

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs">
            {member.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm text-foreground">{member.name}</p>
              <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 px-2 py-0.5 text-xs font-semibold">Loyalty Member</span>
            </div>
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
          <p className="text-muted-foreground text-xs">Member ID</p>
          <p className="font-mono font-medium text-foreground">{member.id}</p>
        </div>
        <div className="bg-background/70 rounded-md p-2">
          <p className="text-muted-foreground text-xs">Member Since</p>
          <p className="font-medium text-foreground">{member.dateJoined}</p>
        </div>
        <div className="bg-background/70 rounded-md p-2 col-span-2">
          <p className="text-muted-foreground text-xs mb-1.5">
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
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [, setSvcEnabled] = useState(true);
  const [basePerKg, setBasePerKg] = useState("0");
  const [addOnOptions, setAddOnOptions] = useState<AddOn[]>([]);
  const [minWeight, setMinWeightSetting] = useState("0");
  const [pricingMode, setPricingModeSetting] = useState<PricingMode>("per-kg");
  const [loadTiers, setLoadTiersSetting] = useState<LoadTier[]>([]);
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
  const [enablePaymentOption, setEnablePaymentOption] = useState<boolean>(
    () => loadPricingConfig().enablePaymentOption ?? true
  );

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardForm>(() => {
    const paymentOpt = loadPricingConfig().enablePaymentOption ?? true;
    return {
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
      paymentStatus: paymentOpt ? "unpaid" : "paid",
    };
  });

  // Loyalty search state
  const [memberSearch, setMemberSearch] = useState("");
  const [memberSearchRes, setMemberSearchRes] = useState<LoyaltyMember[]>([]);
  const [manualId, setManualId] = useState("");
  const [manualError, setManualError] = useState("");
  const [showScanner, setShowScanner] = useState(false);

  // Reset when dialog opens — also re-read settings so changes in Settings tab are reflected
  useEffect(() => {
    if (open) {
      // Load all active services — filtering by pricingType happens at render time based on effectiveMode
      const svcOn = typeof window !== "undefined" ? localStorage.getItem("laundrytrack_svc_enabled") !== "false" : true;
      const enabledServices = svcOn ? loadServiceTypes().filter((s) => s.active) : [];
      const addOns = loadAddOns();
      const pricingCfg = loadPricingConfig();
      const paymentOpt = pricingCfg.enablePaymentOption ?? true;
      setEnablePaymentOption(paymentOpt);
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
        paymentStatus: paymentOpt ? "unpaid" : "paid",
      });
      setMemberSearch("");
      setMemberSearchRes([]);
      setManualId("");
      setManualError("");
      setShowScanner(false);

      // Fetch latest settings from server in background to sync
      let ignore = false;
      void (async () => {
        const headers: Record<string, string> = {};
        const { getBrowserAccessToken } = await import("@/lib/supabase/browser-session");
        const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");
        if (getSupabaseBrowserClient()) {
          const token = await getBrowserAccessToken();
          if (token) headers.Authorization = `Bearer ${token}`;
        }
        if (ignore) return;
        const response = await fetch("/api/settings/pricing", { cache: "no-store", headers }).catch(() => null);
        if (!response || ignore) return;
        const data = await response.json().catch(() => ({}));
        if (!response.ok || ignore) return;

        if (data.pricingConfig) {
          persistPricingConfig(data.pricingConfig);
          setBasePerKg(data.pricingConfig.pricePerKg || "0");
          setMinWeightSetting(data.pricingConfig.minWeight || "0");
          setPricingModeSetting(data.pricingConfig.pricingMode);
          setLoadTiersSetting(data.pricingConfig.loadTiers);
          setPriceDisplayMode(data.pricingConfig.priceDisplayMode ?? "show");
          const serverPaymentOpt = data.pricingConfig.enablePaymentOption ?? true;
          setEnablePaymentOption(serverPaymentOpt);
          if (!serverPaymentOpt) {
            setForm((f) => ({ ...f, paymentStatus: "paid" }));
          }
          setSelectedTierId((currentTierId) => {
            if (!data.pricingConfig.loadTiers.find((t: LoadTier) => t.id === currentTierId)) {
              return data.pricingConfig.loadTiers[0]?.id ?? "";
            }
            return currentTierId;
          });
        }
        if (data.serviceTypes) {
          persistServiceTypes(data.serviceTypes);
          const enabled = svcOn ? data.serviceTypes.filter((s: ServiceType) => s.active) : [];
          setServiceTypes(enabled);
        }
        if (data.addOns) {
          persistAddOns(data.addOns);
          setAddOnOptions(data.addOns);
        }
      })();

      return () => { ignore = true; };
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
  }, [memberSearch, loyaltyMembers]);

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
  const selectedTier = loadTiers.find((t) => t.id === selectedTierId);
  const weight = parseFloat(form.weight) || 0;
  const numberOfLoads = parseInt(form.numberOfLoads) || 0;
  const minWeightNum = parseFloat(minWeight) || 0;

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
            { type: "walkin", icon: User, label: "Walk-in Customer", sub: "No loyalty account" },
            { type: "loyalty", icon: Star, label: "Loyalty Member", sub: "Has a loyalty account" },
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
                <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
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
    const perKgServices = serviceTypes.filter((s) => s.pricingType === "per-kg" || s.pricingType === "per-piece");
    const perLoadServices = serviceTypes.filter((s) => s.pricingType === "per-load");
    const visibleServices = effectiveMode === "per-load" ? perLoadServices : perKgServices;
    const svcCols = visibleServices.length <= 2 ? visibleServices.length || 1 : visibleServices.length === 4 ? 2 : 3;

    // Fee preview is hidden entirely when priceDisplayMode is "hide"; "free" shows ₱0
    const showFeePreview =
      priceDisplayMode !== "hide" &&
      (effectiveMode === "per-load" ? !!selectedTierId : (weight > 0 && !!form.washType));
    // Global price label override — per-service showPrice is respected unless global mode forces hide/free
    const globalHidePrice = priceDisplayMode === "free" || priceDisplayMode === "hide";

    const effectiveAddOns = addOnOptions.length > 0 ? addOnOptions : [
      { id: "def-1", name: "Detergent", rate: "15" },
      { id: "def-2", name: "Fabric Softener", rate: "15" },
      { id: "def-3", name: "Bleach", rate: "20" },
    ];

    // Shared add-ons + wash instructions + fee breakdown block
    const renderAddOnsAndFee = () => (
      <>
        {/* Add-ons */}
        {effectiveAddOns.length > 0 && (
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">Add-ons</label>
            <div className="flex flex-wrap gap-2">
              {effectiveAddOns.map((ao) => (
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
                      ? "border-primary bg-primary/10 text-primary"
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
                          <span className={cn("text-xs font-normal", form.washType === svc.name ? "text-primary/70" : "text-muted-foreground")}>
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
                        <p className="text-xs text-muted-foreground mt-0.5">{tier.range}</p>
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
              { label: "Customer", value: form.customerName },
              { label: "Phone", value: form.phone || "—" },
              { label: "Arrival", value: form.arrivalDateTime },
              effectiveMode === "per-load"
                ? { label: "Load Size", value: selectedTier ? `${selectedTier.name} (${selectedTier.range})` : "—" }
                : { label: "Wash Type", value: form.washType || "Per Kilogram" },
              effectiveMode === "per-load"
                ? { label: "Pricing", value: "Per Load" }
                : { label: "Weight", value: `${form.weight} kg` },
              { label: "Add-ons", value: form.addOns.length ? form.addOns.join(", ") : "None" },
            ].map((row) => (
              <div key={row.label} className="bg-background/60 rounded-md p-2.5">
                <p className="text-xs text-muted-foreground">{row.label}</p>
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
            {enablePaymentOption ? (
              <>
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
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  {form.paymentStatus === "unpaid"
                    ? "Payment will be recorded as pending. Customer receipt will show balance due."
                    : "Payment confirmed. Receipt will show as fully paid."}
                </p>
              </>
            ) : (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                    ✓
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Paid Directly</p>
                    <p className="text-[11px] text-muted-foreground">Payment is confirmed immediately on order creation.</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                  Paid
                </span>
              </div>
            )}
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
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                    done ? "bg-primary border-primary text-primary-foreground"
                      : active ? "bg-primary border-primary text-primary-foreground"
                        : "bg-muted border-border text-muted-foreground"
                  )}>
                    {done ? <Check className="w-3 h-3" /> : i}
                  </div>
                  <span className={cn("text-xs text-center w-16 leading-tight hidden sm:block",
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
  onUpdateTransaction: (ticketId: string, updates: UpdateTransactionInput) => Promise<{ transaction: Transaction; loyaltyResult?: import("@/lib/transaction-contracts").StampAwardResult }>;
  editTicketId?: string;
  onEditComplete?: () => void;
  initialWizardOpen?: boolean;
  onWizardClose?: () => void;
  onNavigate?: (page: Page) => void;
}

const MOBILE_STATUS_OPTIONS: StatusOption[] = [
  { status: "Received", label: "Received" },
  { status: "Washing", label: "Washing" },
  { status: "Ready", label: "Ready" },
  { status: "Claimed", label: "Claimed" },
  { status: "Voided", label: "Voided" },
];

export default function TransactionsPage({
  transactions: txns,
  loading = false,
  error = null,
  loyaltyEnabled = true,
  onCreateTransaction,
  onUpdateTransaction,
  editTicketId,
  onEditComplete,
  onNavigate,
}: TransactionsPageProps) {

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterService, setFilterService] = useState("all");
  const [filterPayment, setFilterPayment] = useState("all");
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
  const [sortBy, setSortBy] = useState<"smart" | "newest" | "oldest" | "unpaid-first" | "ready-first" | "status-az">("smart");
  const [activeTab, setActiveTab] = useState<"transactions" | "all" | "claimed" | "voided">("transactions");

  const serviceOptions = useMemo(() => Array.from(new Set(txns.map((t) => t.washType).filter(Boolean))), [txns]);

  function formatDateDisplay(dateStr?: string) {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return format(d, "MMM d");
    } catch {
      return dateStr;
    }
  }

  // New Transaction wizard
  const [showWizard, setShowWizard] = useState(false);

  // Modals
  const [viewTxn, setViewTxn] = useState<Transaction | null>(null);
  const [editTxn, setEditTxn] = useState<Transaction | null>(null);
  const [editInstructions, setEditInstructions] = useState("");
  const [editStatus, setEditStatus] = useState<Transaction["status"]>("Received");
  const [editPaymentStatus, setEditPaymentStatus] = useState<PaymentStatus>("unpaid");
  const [voidTxn, setVoidTxn] = useState<Transaction | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [reprintTxn, setReprintTxn] = useState<Transaction | null>(null);
  const [printTxn, setPrintTxn] = useState<Transaction | null>(null);
  const [printPostCreate, setPrintPostCreate] = useState(false);
  const [mobileStatusTxn, setMobileStatusTxn] = useState<Transaction | null>(null);
  const [mobileStatusBusyTicket, setMobileStatusBusyTicket] = useState<string | null>(null);
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

  const handleDownloadQr = async (txn: Transaction) => {
    try {
      await downloadQrCodeImage(txn);
      showToast(`QR Code for #${txn.ticketId} downloaded`);
    } catch {
      showToast(`Failed to download QR code`);
    }
  };

  const handlePrintQrTicket = async (txn: Transaction) => {
    try {
      const profile = loadBusinessProfile();
      await printQrTicketOnly(txn, profile, profile.receiptPaperWidth || "80mm");
      showToast(`QR Tag sent to printer for #${txn.ticketId}`);
    } catch {
      showToast(`Failed to print QR tag`);
    }
  };

  const handleDownloadReceipt = async (txn: Transaction) => {
    try {
      const profile = loadBusinessProfile();
      const { downloadReceiptPdf } = await import("@/components/receipt-pdf");
      await downloadReceiptPdf(txn, profile);
      showToast(`Receipt PDF for #${txn.ticketId} downloaded`);
    } catch (err) {
      console.error(err);
      showToast(`Failed to download receipt PDF`);
    }
  };

  // ── Actions ──────────────────────────────────────────────────────────────────
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

  const _moveToNextStatus = async () => {
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
      setEditTxn(updatedTxn.transaction);
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
      const res = await onUpdateTransaction(editTxn.ticketId, {
        washInstructions: editInstructions,
        status: editStatus,
        paymentStatus: editPaymentStatus,
      });
      showToast(`Ticket #${editTxn.ticketId} updated successfully`);
      if (res.loyaltyResult?.stamped && res.loyaltyResult.rewarded) {
        showToast(`Reward Unlocked! 🎉 Customer earned a free wash! They now have ${res.loyaltyResult.newStampCount} stamps.`);
      } else if (res.loyaltyResult?.stamped) {
        showToast(`Stamp Added 🌟 Customer now has ${res.loyaltyResult.newStampCount} stamps.`);
      }
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
      const res = await onUpdateTransaction(editTxn.ticketId, {
        status: "Claimed",
        paymentStatus: editPaymentStatus,
        washInstructions: editInstructions,
      });
      showToast(`Ticket #${editTxn.ticketId} marked as Claimed`);
      if (res.loyaltyResult?.stamped && res.loyaltyResult.rewarded) {
        showToast(`Reward Unlocked! 🎉 Customer earned a free wash! They now have ${res.loyaltyResult.newStampCount} stamps.`);
      } else if (res.loyaltyResult?.stamped) {
        showToast(`Stamp Added 🌟 Customer now has ${res.loyaltyResult.newStampCount} stamps.`);
      }
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

  const handleMobileStatusSelect = async (status: Transaction["status"]) => {
    if (!mobileStatusTxn || status === mobileStatusTxn.status) return;
    if (status === "Claimed" && mobileStatusTxn.paymentStatus === "unpaid") {
      showToast("Mark payment as Paid first before claiming this ticket.");
      return;
    }
    if (status === "Voided") {
      setVoidTxn(mobileStatusTxn);
      setVoidReason("");
      setMobileStatusTxn(null);
      return;
    }
    setMobileStatusBusyTicket(mobileStatusTxn.ticketId);
    try {
      const res = await onUpdateTransaction(mobileStatusTxn.ticketId, {
        status,
        paymentStatus: mobileStatusTxn.paymentStatus,
      });
      showToast(`Ticket #${mobileStatusTxn.ticketId} moved to ${status}`);
      if (res.loyaltyResult?.stamped && res.loyaltyResult.rewarded) {
        showToast(`Reward Unlocked! 🎉 Customer earned a free wash! They now have ${res.loyaltyResult.newStampCount} stamps.`);
      } else if (res.loyaltyResult?.stamped) {
        showToast(`Stamp Added 🌟 Customer now has ${res.loyaltyResult.newStampCount} stamps.`);
      }
      setMobileStatusTxn(null);
    } catch {
      showToast("Unable to update the ticket status right now");
    } finally {
      setMobileStatusBusyTicket(null);
    }
  };

  // Auto-open Edit modal directly when editTicketId is provided (e.g. from notification "View" button)
  const handledEditTicketRef = useRef<string | null>(null);
  useEffect(() => {
    if (editTicketId && editTicketId !== handledEditTicketRef.current) {
      handledEditTicketRef.current = editTicketId;
      const txn = txns.find((t) => t.ticketId === editTicketId);
      if (txn) openEdit(txn);
    }
    if (!editTicketId) {
      handledEditTicketRef.current = null;
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
  const activeStatuses = new Set(["Received", "Washing"]);

  const smartPriority = (t: Transaction): number => {
    if (t.status === "Voided") return 90;
    if (t.status === "Claimed") return 80;
    if (t.paymentStatus === "unpaid" && activeStatuses.has(t.status)) return 1;
    if (t.paymentStatus === "unpaid" && t.status === "Ready") return 2;
    if (t.paymentStatus === "paid" && t.status === "Ready") return 3;
    if (t.paymentStatus === "paid" && activeStatuses.has(t.status)) return 4;
    return 50;
  };

  // ── Row visual class ─────────────────────────────────────────────────────
  const rowVisualClass = (t: Transaction): string => {
    if (t.status === "Voided" || t.status === "Claimed") return "";
    if (t.paymentStatus === "unpaid" && t.status === "Ready")
      return "border-l-[3px] border-l-red-500 bg-red-50/40";
    if (t.paymentStatus === "unpaid" && activeStatuses.has(t.status))
      return "border-l-[3px] border-l-amber-500 bg-amber-50/30";
    if (t.paymentStatus === "paid" && t.status === "Ready")
      return "border-l-[3px] border-l-emerald-500 bg-emerald-50/30";
    return "";
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const filtered = (() => {
    const base = txns.filter((t) => {
      const matchTab =
        activeTab === "all"
          ? true
          : activeTab === "claimed"
          ? t.status === "Claimed"
          : activeTab === "voided"
          ? t.status === "Voided"
          : t.status === "Received" || t.status === "Washing" || t.status === "Ready";
      const matchSearch =
        t.customerName.toLowerCase().includes(search.toLowerCase()) ||
        t.ticketId.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === "all" || t.status === filterStatus;
      const matchService = filterService === "all" || t.washType === filterService;
      const matchPayment = filterPayment === "all" || t.paymentStatus === filterPayment;
      const matchDate = !filterDate || t.dropOffDate === format(filterDate, "yyyy-MM-dd");
      return matchTab && matchSearch && matchStatus && matchService && matchPayment && matchDate;
    });

    const sorted = [...base];
    switch (sortBy) {
      case "smart":
        sorted.sort((a, b) => {
          const diff = smartPriority(a) - smartPriority(b);
          if (diff !== 0) return diff;
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

  const totalFilteredOrders = filtered.length;
  const totalFilteredRevenue = filtered.reduce((acc, t) => acc + (t.status === "Voided" ? 0 : t.fee), 0);
  const totalFilteredWeight = filtered.reduce((acc, t) => acc + (t.status === "Voided" ? 0 : (t.weight || 0)), 0);

  const activeOrdersCount = useMemo(
    () => txns.filter((t) => t.status === "Received" || t.status === "Washing" || t.status === "Ready").length,
    [txns]
  );
  const allOrdersCount = txns.length;
  const claimedOrdersCount = useMemo(() => txns.filter((t) => t.status === "Claimed").length, [txns]);
  const voidedOrdersCount = useMemo(() => txns.filter((t) => t.status === "Voided").length, [txns]);

  const hasActiveFilters = Boolean(
    search.trim() ||
    filterStatus !== "all" ||
    filterService !== "all" ||
    filterPayment !== "all" ||
    filterDate !== undefined ||
    sortBy !== "smart"
  );

  const clearAllFilters = () => {
    setSearch("");
    setFilterStatus("all");
    setFilterService("all");
    setFilterPayment("all");
    setFilterDate(undefined);
    setSortBy("smart");
  };

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Page Header with Title, Description, and Primary CTA */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Transactions</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Monitor laundry orders, track stage progress, and manage customer payments
          </p>
        </div>
        <Button
          size="default"
          className="gap-2 shrink-0 shadow-xs cursor-pointer self-start sm:self-auto"
          onClick={() => (onNavigate ? onNavigate("new-transaction") : setShowWizard(true))}
          disabled={busy || loading}
        >
          <Plus className="w-4 h-4" /> New Transaction
        </Button>
      </div>

      {/* Tabs — Active Orders, All Transactions, Claimed, Voided */}
      <div className="flex items-center justify-between border-b border-border overflow-x-auto">
        <div className="flex gap-1 sm:gap-2 min-w-max">
          <button
            onClick={() => setActiveTab("transactions")}
            className={cn(
              "flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer -mb-[1px]",
              activeTab === "transactions"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <span>Active Orders</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                activeTab === "transactions"
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {activeOrdersCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={cn(
              "flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer -mb-[1px]",
              activeTab === "all"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <span>All Transactions</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                activeTab === "all"
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {allOrdersCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("claimed")}
            className={cn(
              "flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer -mb-[1px]",
              activeTab === "claimed"
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <span>Claimed</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                activeTab === "claimed"
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {claimedOrdersCount}
            </span>
          </button>
          <button
            onClick={() => {
              setActiveTab("voided");
              setFilterStatus("all");
            }}
            className={cn(
              "flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer -mb-[1px]",
              activeTab === "voided"
                ? "border-destructive text-destructive font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <span>Voided</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                activeTab === "voided"
                  ? "bg-destructive/10 text-destructive font-bold"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {voidedOrdersCount}
            </span>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Filter bar */}
        <div className="bg-card border border-border rounded-xl p-3 sm:p-4 shadow-xs space-y-3">
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Search Input with inline clear */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search by customer name or ticket ID…"
                aria-label="Search transactions by customer name or ticket ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-8 h-10 md:h-9 text-sm w-full"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              {(activeTab === "transactions" || activeTab === "all") && (
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full sm:w-[130px] h-10 md:h-9 text-sm">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {statusOrder.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                    {activeTab === "all" && (
                      <>
                        <SelectItem value="Claimed">Claimed</SelectItem>
                        <SelectItem value="Voided">Voided</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              )}

              <Select value={filterService} onValueChange={setFilterService}>
                <SelectTrigger className="w-full sm:w-[135px] h-10 md:h-9 text-sm">
                  <SelectValue placeholder="All Services" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Services</SelectItem>
                  {serviceOptions.map((srv: string) => (
                    <SelectItem key={srv} value={srv}>{srv}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterPayment} onValueChange={setFilterPayment}>
                <SelectTrigger className="w-full sm:w-[130px] h-10 md:h-9 text-sm">
                  <SelectValue placeholder="All Payments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payments</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full sm:w-[140px] h-10 md:h-9 text-sm justify-start gap-2 font-normal",
                      filterDate && "border-primary text-primary font-medium"
                    )}
                  >
                    <CalendarIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{filterDate ? format(filterDate, "MMM d, yyyy") : "All dates"}</span>
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
                      <Button variant="ghost" size="sm" className="w-full text-xs h-7 cursor-pointer" onClick={() => setFilterDate(undefined)}>
                        Clear date filter
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="w-full sm:w-[180px] h-10 md:h-9 text-sm">
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

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="h-10 md:h-9 text-xs text-muted-foreground hover:text-foreground gap-1.5 px-2.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" /> Clear filters
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Summary subheader line */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 px-0.5 text-xs text-muted-foreground font-medium">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <span className="font-semibold text-foreground">{totalFilteredOrders}</span>
              <span>{totalFilteredOrders === 1 ? "order" : "orders"}</span>
            </span>
            <span className="text-border">•</span>
            <span className="inline-flex items-center gap-1">
              <span className="font-semibold text-foreground">₱{totalFilteredRevenue.toLocaleString()}</span>
              <span>total</span>
            </span>
            <span className="text-border">•</span>
            <span className="inline-flex items-center gap-1">
              <span className="font-semibold text-foreground">{totalFilteredWeight.toFixed(1)} kg</span>
              <span>total weight</span>
            </span>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-xs text-primary hover:underline self-start sm:self-auto cursor-pointer"
            >
              Reset all filters
            </button>
          )}
        </div>

        {/* Clean Transaction Card Rows matching Concept */}
        <div className="space-y-2.5">
          {filtered.map((txn) => {
            const isVoided = txn.status === "Voided";
            const isClaimed = txn.status === "Claimed";
            return (
              <div
                key={txn.id}
                className={cn(
                  "group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-xl md:rounded-2xl border border-border/80 bg-card px-4 py-3 md:px-5 md:py-3.5 transition-all duration-150 hover:border-primary/40 hover:shadow-xs",
                  isVoided && "opacity-60 bg-muted/20",
                  isClaimed && "bg-muted/10",
                  rowVisualClass(txn)
                )}
              >
                {/* Left Section: Ticket ID Pill & Customer/Service info */}
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                  {/* Ticket ID Pill */}
                  <button
                    type="button"
                    onClick={() => setViewTxn(txn)}
                    className={cn(
                      "shrink-0 rounded-full px-3 py-1 font-mono text-xs font-semibold tracking-wider transition-colors cursor-pointer",
                      isVoided
                        ? "bg-muted text-muted-foreground line-through"
                        : "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/60"
                    )}
                    title="View ticket details"
                  >
                    #{txn.ticketId}
                  </button>

                  {/* Customer Name & Wash Details */}
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm font-semibold text-foreground", isVoided && "line-through text-muted-foreground")}>
                      {txn.customerName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground mt-0.5">
                      {txn.washType}{txn.weight ? ` · ${txn.weight} kg` : ""}
                      {txn.addOns && txn.addOns.length > 0 ? ` · ${txn.addOns.join(", ")}` : ""}
                    </p>
                    {isVoided && txn.voidReason && (
                      <p className="text-[11px] text-destructive/80 font-medium mt-1 truncate">
                        Reason: {txn.voidReason}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Section: Badges, Actions, Price & Date */}
                <div className="flex items-center flex-wrap sm:flex-nowrap justify-between sm:justify-end gap-2.5 sm:gap-4 shrink-0">
                  {/* Status Badge */}
                  <StatusBadge status={txn.status} />

                  {/* Payment Badge */}
                  <PaymentBadge paymentStatus={txn.paymentStatus} />

                  {/* Action Links */}
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewTxn(txn)}
                      className="h-7 px-2 text-xs text-foreground font-medium hover:text-primary hover:bg-primary/10 cursor-pointer"
                    >
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setPrintTxn(txn); setPrintPostCreate(false); }}
                      className="h-7 px-2 text-xs text-foreground font-medium hover:text-primary hover:border-primary/50 cursor-pointer gap-1"
                      title="Print receipt"
                      aria-label={`Print receipt for ticket ${txn.ticketId}`}
                    >
                      <Printer className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="hidden xs:inline">Print</span>
                    </Button>
                    <a
                      href={`${origin}${txn.publicTrackingToken ? `/track/${txn.publicTrackingToken}` : `/ticket/${txn.ticketId}`}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "sm" }),
                        "h-7 px-2 text-xs text-foreground font-medium hover:text-primary hover:bg-primary/10 cursor-pointer inline-flex items-center"
                      )}
                    >
                      Track
                    </a>

                    {/* Quick Dropdown Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer" aria-label="More actions">
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => { setPrintTxn(txn); setPrintPostCreate(false); }}>
                          <Printer className="w-3.5 h-3.5 mr-2" /> Print Receipt
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void handleDownloadReceipt(txn)}>
                          <Download className="w-3.5 h-3.5 mr-2" /> Download Receipt
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setReprintTxn(txn)}>
                          <QrCode className="w-3.5 h-3.5 mr-2" /> QR Code Ticket
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void handlePrintQrTicket(txn)}>
                          <Printer className="w-3.5 h-3.5 mr-2 text-primary" /> Print QR Only
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void handleDownloadQr(txn)}>
                          <Download className="w-3.5 h-3.5 mr-2 text-primary" /> Download QR Code
                        </DropdownMenuItem>
                        {!isVoided && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openEdit(txn)}>
                              <Edit className="w-3.5 h-3.5 mr-2" /> Edit Order
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setMobileStatusTxn(txn)}>
                              <RefreshCw className="w-3.5 h-3.5 mr-2" /> Change Status
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => { setVoidTxn(txn); setVoidReason(""); }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Ban className="w-3.5 h-3.5 mr-2" /> Void Order
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Price & Date Column */}
                  <div className="text-right min-w-[72px] pl-2 sm:pl-3 border-l border-border/50">
                    <p className={cn("text-sm font-bold text-foreground", isVoided && "line-through text-muted-foreground")}>
                      ₱{txn.fee.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-muted-foreground whitespace-nowrap mt-0.5">
                      {formatDateDisplay(txn.arrivalDateTime || txn.dropOffDate)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="bg-card border border-border rounded-xl p-10">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Inbox />
                  </EmptyMedia>
                  <EmptyTitle className="text-sm">
                    {loading
                      ? "Loading transactions..."
                      : activeTab === "voided"
                      ? "No voided transactions found."
                      : activeTab === "claimed"
                      ? "No claimed transactions found."
                      : activeTab === "all"
                      ? "No transactions found."
                      : "No active orders found."}
                  </EmptyTitle>
                  {loading ? null : (
                    <EmptyDescription className="flex flex-col items-center gap-2">
                      <span>Try adjusting your filters or search terms.</span>
                      {hasActiveFilters && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={clearAllFilters}
                          className="mt-1 h-8 text-xs cursor-pointer"
                        >
                          Clear all filters
                        </Button>
                      )}
                    </EmptyDescription>
                  )}
                </EmptyHeader>
              </Empty>
            </div>
          )}
        </div>
      </div>

      {/* ── VIEW MODAL (read-only) ──────────────────────────────────────────── */}
      <Dialog open={!!viewTxn} onOpenChange={(open) => { if (!open) { setViewTxn(null); onEditComplete?.(); } }}>
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
                  { label: "Ticket ID", value: viewTxn.ticketId, span: false },
                  { label: "Customer Name", value: viewTxn.customerName, span: false },
                  { label: "Arrival Date & Time", value: viewTxn.arrivalDateTime, span: true },
                  { label: "Weight (kg)", value: `${viewTxn.weight} kg`, span: false },
                  { label: "Wash Type", value: viewTxn.washType, span: false },
                  { label: "Add-ons", value: viewTxn.addOns.length ? viewTxn.addOns.join(", ") : "None", span: false },
                  { label: "Total Fee", value: `₱${viewTxn.fee}`, span: false },
                  { label: "ETA", value: viewTxn.eta ? formatReadableDateTime(viewTxn.eta) : "Awaiting estimate", span: false },
                ].map((row) => (
                  <div key={row.label} className={cn("bg-muted/30 rounded-md p-2.5", row.span && "col-span-2")}>
                    <p className="text-xs text-muted-foreground">{row.label}</p>
                    <p className="font-medium text-foreground text-xs mt-0.5">{row.value}</p>
                  </div>
                ))}
                {/* Payment Status */}
                <div className="bg-muted/30 rounded-md p-2.5">
                  <p className="text-xs text-muted-foreground mb-1">Payment Status</p>
                  <PaymentBadge paymentStatus={viewTxn.paymentStatus} />
                </div>
                {/* Current Status */}
                <div className="bg-muted/30 rounded-md p-2.5">
                  <p className="text-xs text-muted-foreground mb-1">Current Status</p>
                  <StatusBadge status={viewTxn.status} />
                </div>
                {/* Wash instructions read-only */}
                {viewTxn.washInstructions && (
                  <div className="col-span-2 bg-muted/30 rounded-md p-2.5">
                    <p className="text-xs text-muted-foreground">Wash Instructions</p>
                    <p className="font-medium text-foreground text-xs mt-0.5">{viewTxn.washInstructions}</p>
                  </div>
                )}
                {/* Void reason read-only */}
                {viewTxn.status === "Voided" && (
                  <div className="col-span-2 bg-destructive/10 border border-destructive/20 rounded-md p-2.5">
                    <p className="text-xs font-semibold text-destructive">Void Reason</p>
                    <p className="font-medium text-destructive text-xs mt-0.5">{viewTxn.voidReason || "No specific reason provided."}</p>
                  </div>
                )}
              </div>

              {/* Status stepper — read-only */}
              {viewTxn.status !== "Voided" && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Status Progress</p>
                  <div className="flex items-center">
                    {statusOrder.map((step, idx) => {
                      const stepIdx = statusOrder.indexOf(viewTxn.status as (typeof statusOrder)[number]);
                      const isCompleted = idx < stepIdx;
                      const isCurrent = idx === stepIdx;
                      const isLast = idx === statusOrder.length - 1;
                      return (
                        <div key={step} className="flex items-center flex-1 last:flex-none">
                          <div className="flex flex-col items-center">
                            <div className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2",
                              isCompleted || isCurrent ? "bg-primary border-primary text-primary-foreground" : "bg-background border-border text-muted-foreground"
                            )}>
                              {isCompleted ? "✓" : idx + 1}
                            </div>
                            <span className={cn("text-xs mt-1 text-center w-10 md:w-12 leading-tight", isCurrent ? "text-primary font-semibold" : "text-muted-foreground")}>
                              {step}
                            </span>
                          </div>
                          {!isLast && <div className={cn("flex-1 h-0.5 mb-4 mx-0.5", isCompleted ? "bg-primary" : "bg-border")} />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* QR Code */}
              <div className="flex flex-col items-center gap-2 py-2 bg-muted/30 rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getTrackingQrSrc(viewTxn, 100)}
                  alt={`QR for ${viewTxn.ticketId}`}
                  width={100}
                  height={100}
                  crossOrigin="anonymous"
                />
                <p className="text-xs text-muted-foreground font-mono">{viewTxn.ticketId}</p>
              </div>

              {/* View modal actions */}
              <div className="flex flex-col gap-2 pt-1">
                {/* Primary action: Edit Status */}
                {viewTxn.status !== "Voided" && (
                  <Button
                    size="sm"
                    className="w-full gap-1.5"
                    onClick={() => {
                      const txn = viewTxn;
                      setViewTxn(null);
                      openEdit(txn);
                    }}
                  >
                    <Edit className="w-3.5 h-3.5" /> Edit Status
                  </Button>
                )}
                {/* Secondary actions */}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => { setReprintTxn(viewTxn); setViewTxn(null); onEditComplete?.(); }}>
                    <Printer className="w-3.5 h-3.5" /> Reprint QR
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => { setPrintTxn(viewTxn); setPrintPostCreate(false); setViewTxn(null); onEditComplete?.(); }}>
                    <Printer className="w-3.5 h-3.5" /> Print Receipt
                  </Button>
                  <Button size="sm" variant="secondary" className="flex-1" onClick={() => { setViewTxn(null); onEditComplete?.(); }}>
                    <X className="w-3.5 h-3.5 mr-1" /> Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── EDIT MODAL ────────���────────────────────────────────────────────── */}
      <Dialog open={!!editTxn} onOpenChange={(open) => { if (!open) { setEditTxn(null); onEditComplete?.(); } }}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:w-auto max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader className="text-left space-y-1.5">
            <div className="flex justify-between items-start pr-4">
              <DialogTitle className="text-lg font-bold">Edit Ticket — {editTxn?.ticketId}</DialogTitle>
              {editTxn && (
                <StatusBadge status={editTxn.status} className="border shadow-sm mt-0.5 font-bold" />
              )}
            </div>
            <DialogDescription className="text-sm text-muted-foreground font-medium">
              Update status and payment for this transaction.
            </DialogDescription>
          </DialogHeader>
          {editTxn && (
            <div className="space-y-6 mt-1">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-2.5 text-sm">
                {[
                  { label: "Customer", value: editTxn.customerName },
                  { label: "Wash Type", value: editTxn.washType },
                  { label: "Weight", value: `${editTxn.weight} kg` },
                  { label: "Fee", value: `₱${editTxn.fee}` },
                ].map((row) => (
                  <div key={row.label} className="bg-muted/40 rounded-xl p-3 border border-border/40 flex flex-col justify-center">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{row.label}</p>
                    <p className="font-bold text-foreground text-[13px]">{row.value}</p>
                  </div>
                ))}
              </div>

              {/* Status stepper — dynamic based on editStatus */}
              <div>
                <p className="text-xs font-bold text-foreground mb-3 block">Status Progress</p>
                <div className="flex items-center">
                  {statusOrder.map((step, idx) => {
                    const stepIdx = statusOrder.indexOf(editStatus as typeof statusOrder[number]);
                    const isCompleted = idx < stepIdx;
                    const isCurrent = idx === stepIdx;
                    const isLast = idx === statusOrder.length - 1;
                    return (
                      <div key={step} className="flex items-center flex-1 last:flex-none">
                        <div className="flex flex-col items-center">
                          <div className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300 shadow-sm",
                            isCompleted ? "bg-primary border-primary text-primary-foreground" :
                              isCurrent ? "bg-background border-primary text-primary ring-2 ring-primary/20 ring-offset-1 ring-offset-background" : "bg-muted/50 border-border text-muted-foreground"
                          )}>
                            {isCompleted ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                          </div>
                          <span className={cn("text-xs mt-2 text-center w-11 md:w-12 leading-tight transition-colors duration-300 uppercase tracking-wide", isCurrent ? "text-primary font-bold" : "text-muted-foreground font-semibold")}>
                            {step}
                          </span>
                        </div>
                        {!isLast && <div className={cn("flex-1 h-0.5 mb-6 mx-1 transition-colors duration-300 rounded-full", isCompleted ? "bg-primary" : "bg-border")} />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Status dropdown */}
              <div>
                <label className="text-xs font-bold text-foreground mb-1.5 block">Current Status</label>
                <Select
                  value={editStatus}
                  onValueChange={(v) => setEditStatus(v as Transaction["status"])}
                >
                  <SelectTrigger className="h-11 text-sm bg-background border-border hover:border-primary/50 transition-colors cursor-pointer rounded-xl font-semibold shadow-sm focus:ring-primary/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/50 shadow-lg p-1.5">
                    {(
                      ["Received", "Washing", "Ready", "Claimed", "Voided"] as const
                    ).map((value) => {
                      const Icon = STATUS_ICONS[value];
                      const isClaimedBlocked = value === "Claimed" && editPaymentStatus === "unpaid";
                      const isCurrent = value === editStatus;
                      return (
                        <SelectItem key={value} value={value} disabled={isClaimedBlocked} className={cn("cursor-pointer rounded-lg mb-1 last:mb-0", isCurrent ? "bg-muted/60" : "focus:bg-muted/40")}>
                          <div className="flex items-center gap-3 py-1.5 w-full pr-4">
                            <Icon className={cn("w-4 h-4", isCurrent ? "text-foreground" : "text-muted-foreground")} aria-hidden="true" />
                            <span className={cn("font-medium text-[15px] flex-1 text-left", isCurrent ? "text-foreground" : "text-muted-foreground")}>{value}</span>
                            {isCurrent && (
                              <div className="flex items-center gap-1.5 ml-3">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current</span>
                                <Check className="w-3.5 h-3.5 text-muted-foreground" />
                              </div>
                            )}
                            {isClaimedBlocked && !isCurrent && (
                              <span className="ml-2 text-xs text-muted-foreground font-medium uppercase tracking-wider">(Payment Required)</span>
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
                <label className="text-xs font-bold text-foreground mb-1.5 block">Payment Status</label>
                <div className="grid grid-cols-2 gap-2.5">
                  {(["unpaid", "paid"] as const).map((ps) => (
                    <button
                      key={ps}
                      onClick={() => setEditPaymentStatus(ps)}
                      className={cn(
                        "rounded-xl border-2 py-2.5 px-3 text-[13px] font-bold transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                        ps === "unpaid"
                          ? editPaymentStatus === "unpaid"
                            ? "border-red-500 bg-red-50 text-red-700 shadow-sm"
                            : "border-border/60 bg-muted/20 text-muted-foreground hover:border-red-300 hover:bg-red-50/50 hover:text-red-600"
                          : editPaymentStatus === "paid"
                            ? "border-green-500 bg-green-50 text-green-700 shadow-sm"
                            : "border-border/60 bg-muted/20 text-muted-foreground hover:border-green-300 hover:bg-green-50/50 hover:text-green-600"
                      )}
                    >
                      {ps === "unpaid" ? "Unpaid" : "Paid"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Wash instructions */}
              <div>
                <label className="text-xs font-bold text-foreground mb-1.5 block">Wash Instructions</label>
                <Textarea
                  placeholder="Add special wash instructions..."
                  value={editInstructions}
                  onChange={(e) => setEditInstructions(e.target.value)}
                  className="text-sm resize-none rounded-xl border-border focus:border-primary/50 shadow-sm min-h-[80px]"
                />
              </div>

              {/* Warning when payment is Unpaid and user is trying to claim */}
              {editPaymentStatus === "unpaid" && editStatus === "Ready" && (
                <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl px-3.5 py-3 text-sm text-orange-800 shadow-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-orange-600" />
                  <span className="font-semibold leading-tight">Mark payment as Paid first before claiming this ticket.</span>
                </div>
              )}

              {/* Edit actions */}
              <div className="flex flex-col gap-2.5 pt-3 border-t border-border/40 mt-2">
                {editStatus === "Ready" && editPaymentStatus === "paid" && (
                  <Button size="lg" onClick={markAsClaimed} className="w-full gap-2 transition-all duration-200 hover:scale-[1.02] bg-green-600 hover:bg-green-700 text-white shadow-sm font-bold text-sm h-12 rounded-xl">
                    <Check className="w-4 h-4" /> Move to Claimed
                  </Button>
                )}
                <Button
                  size="lg"
                  variant="default"
                  onClick={saveInstructions}
                  className="w-full transition-all duration-200 hover:scale-[1.02] shadow-sm font-bold text-sm h-12 rounded-xl"
                >
                  Save Changes
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => { setEditTxn(null); onEditComplete?.(); }}
                  className="w-full transition-all duration-200 hover:bg-muted cursor-pointer font-bold text-sm h-12 rounded-xl border-border/60"
                >
                  <X className="w-4 h-4 mr-1.5 opacity-70" /> Cancel
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
                <p className="text-xs text-muted-foreground mt-1">A reason is required to void this ticket.</p>
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
              <QrCode className="w-4 h-4 text-primary" /> QR Code Ticket
            </DialogTitle>
            <DialogDescription>
              Scan, print bag tag, or download this QR code for #{reprintTxn?.ticketId}.
            </DialogDescription>
          </DialogHeader>
          {reprintTxn && (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="bg-white p-3 rounded-xl border shadow-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getTrackingQrSrc(reprintTxn, 180)}
                  alt={`QR code for ${reprintTxn.ticketId}`}
                  width={180}
                  height={180}
                  crossOrigin="anonymous"
                  className="rounded"
                />
              </div>
              <div className="text-center">
                <p className="text-base font-mono font-bold text-foreground">#{reprintTxn.ticketId}</p>
                <p className="text-xs font-semibold text-foreground">{reprintTxn.customerName}</p>
                <p className="text-[11px] text-muted-foreground">{reprintTxn.washType} &bull; {reprintTxn.weight > 0 ? `${reprintTxn.weight} kg` : "Per Load"}</p>
              </div>

              <div className="flex flex-col gap-2 w-full mt-1">
                {/* Print QR Tag Without Receipt */}
                <Button
                  size="sm"
                  className="w-full flex items-center justify-center gap-1.5 cursor-pointer bg-primary text-primary-foreground font-semibold shadow-xs"
                  onClick={() => handlePrintQrTicket(reprintTxn)}
                >
                  <Printer className="w-3.5 h-3.5" /> Print QR Tag Only
                </Button>

                {/* Download QR Image */}
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full flex items-center justify-center gap-1.5 cursor-pointer font-medium"
                  onClick={() => handleDownloadQr(reprintTxn)}
                >
                  <Download className="w-3.5 h-3.5 text-primary" /> Download QR Image
                </Button>

                <div className="flex items-center gap-2 my-0.5">
                  <div className="h-px bg-border flex-1" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Receipt</span>
                  <div className="h-px bg-border flex-1" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex items-center justify-center gap-1 text-xs cursor-pointer"
                    onClick={() => handleDownloadReceipt(reprintTxn)}
                  >
                    <Download className="w-3 h-3 text-primary" /> PDF Receipt
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex items-center justify-center gap-1 text-xs cursor-pointer"
                    onClick={() => {
                      const t = reprintTxn;
                      setReprintTxn(null);
                      setPrintTxn(t);
                      setPrintPostCreate(false);
                    }}
                  >
                    <Printer className="w-3 h-3" /> Full Receipt
                  </Button>
                </div>

                <Button size="sm" variant="ghost" className="cursor-pointer text-xs text-muted-foreground hover:text-foreground mt-0.5" onClick={() => setReprintTxn(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <StatusUpdateSheet
        open={!!mobileStatusTxn}
        onOpenChange={(open) => !open && setMobileStatusTxn(null)}
        ticketId={mobileStatusTxn?.ticketId}
        currentStatus={mobileStatusTxn?.status ?? "Received"}
        options={MOBILE_STATUS_OPTIONS}
        disabled={Boolean(mobileStatusTxn && mobileStatusBusyTicket === mobileStatusTxn.ticketId)}
        onSelectStatus={handleMobileStatusSelect}
      />
    </div>
  );
}
