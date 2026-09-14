"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  User,
  Phone,
  Sparkles,
  Scale,
  Package,
  Calendar,
  Clock,
  PlusCircle,
  Receipt,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useLoyaltyMembers } from "@/hooks/use-loyalty-members";
import {
  loadPricingConfig,
  loadServiceTypes,
  loadAddOns,
  type ServiceType,
  type LoadTier,
  type AddOn,
} from "@/lib/settings-store";
import type { CreateTransactionInput } from "@/lib/transaction-contracts";
import type { Transaction, PaymentStatus } from "@/lib/data";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Page } from "@/components/sidebar";
import { PrintReceiptModal } from "@/components/print-receipt-modal";

interface NewOrderPageProps {
  onCreateTransaction: (input: CreateTransactionInput) => Promise<Transaction>;
  onOrderCreated?: (txn: Transaction) => void;
  onNavigate?: (page: Page) => void;
  loyaltyEnabled?: boolean;
}

export default function NewOrderPage({
  onCreateTransaction,
  onOrderCreated,
  onNavigate,
  loyaltyEnabled = true,
}: NewOrderPageProps) {
  const { members: loyaltyMembers } = useLoyaltyMembers();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [createdTxn, setCreatedTxn] = useState<Transaction | null>(null);

  // Form State
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [arrivalDateTime, setArrivalDateTime] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 16);
  });

  // Autocomplete & Recognized member state
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Service Details State
  const [billBy, setBillBy] = useState<"per-kg" | "per-load">("per-kg");
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [weight, setWeight] = useState<string>("");
  const [selectedTierId, setSelectedTierId] = useState<string>("");
  const [numberOfLoads, setNumberOfLoads] = useState<string>("1");
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [specialNotes, setSpecialNotes] = useState<string>("");

  // Summary State
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("unpaid");

  // Pricing configuration loaded from settings
  const [enablePaymentOption, setEnablePaymentOption] = useState<boolean>(true);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loadTiers, setLoadTiers] = useState<LoadTier[]>([]);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [basePricePerKg, setBasePricePerKg] = useState<string>("30");

  useEffect(() => {
    const cfg = loadPricingConfig();
    const svc = loadServiceTypes().filter((s) => s.active);
    const ads = loadAddOns();

    setServiceTypes(svc);
    setLoadTiers(cfg.loadTiers || []);
    setAddOns(ads);
    setBasePricePerKg(cfg.pricePerKg || "30");

    const paymentOpt = cfg.enablePaymentOption ?? true;
    setEnablePaymentOption(paymentOpt);
    if (!paymentOpt) {
      setPaymentStatus("paid");
    }

    if (svc.length > 0) setSelectedServiceId(svc[0].id);
    if (cfg.loadTiers && cfg.loadTiers.length > 0) setSelectedTierId(cfg.loadTiers[0].id);
  }, []);

  // Automatic Loyalty Member Detection
  const matchedMember = useMemo(() => {
    if (!loyaltyEnabled) return null;
    if (selectedMemberId) {
      return loyaltyMembers.find((m) => m.id === selectedMemberId) || null;
    }
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length >= 7) {
      const byPhone = loyaltyMembers.find((m) => m.phone && m.phone.replace(/\D/g, "").includes(cleanPhone));
      if (byPhone) return byPhone;
    }
    if (customerName.trim().length >= 3) {
      const byName = loyaltyMembers.find(
        (m) => m.name.toLowerCase().trim() === customerName.toLowerCase().trim()
      );
      if (byName) return byName;
    }
    return null;
  }, [customerName, phone, selectedMemberId, loyaltyMembers, loyaltyEnabled]);

  // Autocomplete suggestion matches
  const suggestions = useMemo(() => {
    if (!loyaltyEnabled || selectedMemberId) return [];
    const qName = customerName.trim().toLowerCase();
    const qPhone = phone.replace(/\D/g, "");
    if (qName.length < 2 && qPhone.length < 3) return [];

    return loyaltyMembers.filter(
      (m) =>
        (qName.length >= 2 && m.name.toLowerCase().includes(qName)) ||
        (qPhone.length >= 3 && m.phone && m.phone.replace(/\D/g, "").includes(qPhone))
    ).slice(0, 4);
  }, [customerName, phone, selectedMemberId, loyaltyMembers, loyaltyEnabled]);

  function handleSelectSuggestion(m: typeof loyaltyMembers[0]) {
    setCustomerName(m.name);
    if (m.phone) setPhone(m.phone);
    setSelectedMemberId(m.id);
    setShowSuggestions(false);
  }

  function handleClearMember() {
    setSelectedMemberId(null);
  }

  // Price Calculations
  const selectedService = serviceTypes.find((s) => s.id === selectedServiceId);
  const selectedTier = loadTiers.find((t) => t.id === selectedTierId);
  const numWeight = parseFloat(weight) || 0;
  const numLoads = parseInt(numberOfLoads) || 0;

  const basePrice = useMemo(() => {
    if (billBy === "per-kg") {
      const rate = selectedService ? parseFloat(selectedService.price) || 0 : parseFloat(basePricePerKg) || 0;
      return Math.round(numWeight * rate);
    } else {
      const rate = selectedTier ? parseFloat(selectedTier.price) || 0 : 0;
      return Math.round(numLoads * rate);
    }
  }, [billBy, selectedService, basePricePerKg, numWeight, selectedTier, numLoads]);

  const extrasPrice = useMemo(() => {
    return selectedAddOns.reduce((acc, addOnName) => {
      const match = addOns.find((a) => a.name === addOnName);
      return acc + (match ? parseFloat(match.rate) || 0 : 0);
    }, 0);
  }, [selectedAddOns, addOns]);

  const liveTotal = basePrice + extrasPrice;

  // Validation
  const step1Valid = customerName.trim().length > 0;
  const step2Valid = billBy === "per-kg" ? numWeight > 0 : numLoads > 0 && !!selectedTierId;

  async function handleCreateOrder() {
    setSubmitting(true);
    try {
      const displayWashType =
        billBy === "per-load" && selectedTier
          ? selectedTier.name
          : selectedService?.name || "Regular";

      const newTxn = await onCreateTransaction({
        customerName: customerName.trim(),
        phone: phone.trim() || "",
        arrivalDateTime,
        dropOffDate: arrivalDateTime.split("T")[0] || arrivalDateTime.split(" ")[0],
        washType: displayWashType,
        weight: billBy === "per-kg" ? numWeight : 0,
        fee: liveTotal,
        status: "Received",
        paymentStatus,
        addOns: selectedAddOns,
        washInstructions: specialNotes.trim() || "",
      });

      toast({
        title: "Order Created Successfully!",
        description: `Ticket #${newTxn.ticketId} for ${newTxn.customerName} has been received.`,
      });

      setCreatedTxn(newTxn);
    } catch (err) {
      toast({
        title: "Failed to create order",
        description: err instanceof Error ? err.message : "Please check your details and try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">New Order</h1>
        <p className="text-xs text-muted-foreground mt-1">Add a new customer order in three steps</p>
      </div>

      {/* Stepper Progress Header */}
      <div className="flex items-center gap-3">
        {/* Step 1 Bubble */}
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
              step > 1
                ? "bg-primary text-primary-foreground"
                : step === 1
                ? "border-2 border-primary text-primary bg-primary/10"
                : "bg-muted text-muted-foreground"
            )}
          >
            {step > 1 ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : "1"}
          </div>
          <span className={cn("text-xs font-semibold", step >= 1 ? "text-foreground" : "text-muted-foreground")}>
            Customer
          </span>
        </div>

        <div className="w-8 h-[2px] bg-border" />

        {/* Step 2 Bubble */}
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
              step > 2
                ? "bg-primary text-primary-foreground"
                : step === 2
                ? "border-2 border-primary text-primary bg-primary/10"
                : "bg-muted text-muted-foreground"
            )}
          >
            {step > 2 ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : "2"}
          </div>
          <span className={cn("text-xs font-semibold", step >= 2 ? "text-foreground" : "text-muted-foreground")}>
            Service
          </span>
        </div>

        <div className="w-8 h-[2px] bg-border" />

        {/* Step 3 Bubble */}
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
              step === 3
                ? "border-2 border-primary text-primary bg-primary/10"
                : "bg-muted text-muted-foreground"
            )}
          >
            3
          </div>
          <span className={cn("text-xs font-semibold", step === 3 ? "text-foreground" : "text-muted-foreground")}>
            Summary
          </span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* STEP 1: Customer Information */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {step === 1 && (
        <Card className="border border-border shadow-xs bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-bold">Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Automatic Recognition Banner */}
            {matchedMember && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-xs font-bold">Loyalty Member Recognized: {matchedMember.name}</p>
                    <p className="text-[11px] opacity-85">
                      {matchedMember.stampCount} stamps · Will automatically receive a pending stamp, confirmed upon claiming.
                    </p>
                  </div>
                </div>
                {selectedMemberId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleClearMember}
                    className="text-xs h-7 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20"
                  >
                    Change
                  </Button>
                )}
              </div>
            )}

            {/* Name Input with Autocomplete Dropdown */}
            <div className="space-y-1.5 relative">
              <Label className="text-xs font-semibold">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="customer-name"
                name="customerName"
                autoComplete="name"
                placeholder="Customer name"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  setShowSuggestions(true);
                  if (selectedMemberId) setSelectedMemberId(null);
                }}
                onFocus={() => setShowSuggestions(true)}
                className="h-10 text-sm"
              />
              <p className="text-[11px] text-muted-foreground">Name is required to continue</p>

              {/* Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-30 mt-1 rounded-lg border border-border bg-popover p-1 shadow-lg">
                  <p className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Existing Loyalty Members
                  </p>
                  {suggestions.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSelectSuggestion(m)}
                      className="w-full flex items-center justify-between p-2 rounded-md text-xs hover:bg-muted/60 text-left cursor-pointer"
                    >
                      <div>
                        <span className="font-bold text-foreground">{m.name}</span>
                        <span className="text-muted-foreground ml-2">{m.phone}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                        {m.stampCount} stamps
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Phone Input */}
            <div className="space-y-1.5">
              <Label htmlFor="customer-phone" className="text-xs font-semibold">Phone</Label>
              <Input
                id="customer-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="Phone number (e.g. 09171234567)"
                value={phone}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9+]/g, "");
                  setPhone(val);
                }}
                className="h-10 text-sm"
              />
            </div>

            {/* Arrival Date & Time */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Arrival Date & Time <span className="text-destructive">*</span>
              </Label>
              <Input
                type="datetime-local"
                value={arrivalDateTime}
                onChange={(e) => setArrivalDateTime(e.target.value)}
                className="h-10 text-sm"
              />
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate?.("transactions")}
                className="gap-1.5 text-xs h-9 px-4"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setShowSuggestions(false);
                  setStep(2);
                }}
                disabled={!step1Valid}
                className="gap-1.5 text-xs h-9 px-5 bg-primary text-primary-foreground"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* STEP 2: Service Details */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {step === 2 && (
        <Card className="border border-border shadow-xs bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-bold">Service Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Bill By Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Bill by</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBillBy("per-kg")}
                  className={cn(
                    "py-2 px-3 text-xs font-bold rounded-lg border transition-all cursor-pointer",
                    billBy === "per-kg"
                      ? "bg-primary/10 border-primary text-primary shadow-xs"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  By the kilo
                </button>
                <button
                  type="button"
                  onClick={() => setBillBy("per-load")}
                  className={cn(
                    "py-2 px-3 text-xs font-bold rounded-lg border transition-all cursor-pointer",
                    billBy === "per-load"
                      ? "bg-primary/10 border-primary text-primary shadow-xs"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  By the load
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {billBy === "per-kg" ? "Charging per kilogram of laundry" : "Charging per batch/load size"}
              </p>
            </div>

            {/* By Kilo Form Group */}
            {billBy === "per-kg" && (
              <div className="rounded-xl border border-border/80 p-4 bg-muted/20 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">By Kilo</span>
                    <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
                      Per kg
                    </Badge>
                  </div>
                  <p className="text-xs font-semibold text-primary tabular-nums">Subtotal: ₱{basePrice}</p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      Service Type <span className="text-destructive">*</span>
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {serviceTypes.map((s) => {
                        const isSelected = selectedServiceId === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setSelectedServiceId(s.id)}
                            className={cn(
                              "flex flex-col items-start justify-between p-3 rounded-xl border text-left transition-all cursor-pointer min-h-[56px]",
                              isSelected
                                ? "bg-primary/10 border-primary text-foreground ring-1 ring-primary shadow-xs"
                                : "bg-card border-border hover:border-primary/40 hover:bg-muted/40 text-muted-foreground"
                            )}
                          >
                            <span className={cn("text-xs font-bold leading-tight", isSelected ? "text-primary" : "text-foreground")}>
                              {s.name}
                            </span>
                            <span className="text-[11px] font-semibold text-muted-foreground mt-1 tabular-nums">
                              ₱{s.price}/kg
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="order-weight" className="text-xs font-semibold">
                      Weight (kg) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="order-weight"
                      type="number"
                      step="0.1"
                      min="0.1"
                      inputMode="decimal"
                      placeholder="0.0"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      className="h-10 text-sm font-semibold tabular-nums"
                    />
                    <p className="text-[10px] text-muted-foreground">Enter weight greater than 0</p>
                  </div>
                </div>
              </div>
            )}

            {/* By Load Form Group */}
            {billBy === "per-load" && (
              <div className="rounded-xl border border-border/80 p-4 bg-muted/20 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">By Load</span>
                    <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
                      Per batch
                    </Badge>
                  </div>
                  <p className="text-xs font-semibold text-primary tabular-nums">Subtotal: ₱{basePrice}</p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      Load Size <span className="text-destructive">*</span>
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {loadTiers.map((t) => {
                        const isSelected = selectedTierId === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setSelectedTierId(t.id)}
                            className={cn(
                              "flex flex-col items-start justify-between p-3 rounded-xl border text-left transition-all cursor-pointer min-h-[56px]",
                              isSelected
                                ? "bg-primary/10 border-primary text-foreground ring-1 ring-primary shadow-xs"
                                : "bg-card border-border hover:border-primary/40 hover:bg-muted/40 text-muted-foreground"
                            )}
                          >
                            <span className={cn("text-xs font-bold leading-tight", isSelected ? "text-primary" : "text-foreground")}>
                              {t.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground mt-0.5">{t.range}</span>
                            <span className="text-[11px] font-semibold text-muted-foreground mt-1 tabular-nums">
                              ₱{t.price}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="order-loads" className="text-xs font-semibold">
                      Number of Loads <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="order-loads"
                      type="number"
                      min="1"
                      inputMode="numeric"
                      value={numberOfLoads}
                      onChange={(e) => setNumberOfLoads(e.target.value)}
                      className="h-10 text-sm font-semibold tabular-nums"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Extras / Add-ons */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">Extras</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {addOns.map((ad) => {
                  const isChecked = selectedAddOns.includes(ad.name);
                  return (
                    <button
                      key={ad.id}
                      type="button"
                      onClick={() =>
                        setSelectedAddOns((prev) =>
                          isChecked ? prev.filter((n) => n !== ad.name) : [...prev, ad.name]
                        )
                      }
                      className={cn(
                        "flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all text-left cursor-pointer",
                        isChecked
                          ? "border-primary bg-primary/10 text-primary font-bold"
                          : "border-border bg-card text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <div
                        className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                          isChecked ? "bg-primary border-primary text-white" : "border-muted-foreground"
                        )}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="truncate">
                        {ad.name} (₱{ad.rate})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Special Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Special Notes</Label>
              <Textarea
                placeholder="Any special instructions for handling..."
                value={specialNotes}
                onChange={(e) => setSpecialNotes(e.target.value)}
                rows={3}
                className="text-sm resize-none"
              />
            </div>

            {/* Live Total Bar */}
            <div className="rounded-xl border border-border p-3.5 bg-card flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">Live total</span>
              <span className="text-base font-bold text-primary font-mono">₱{liveTotal}</span>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(1)}
                className="gap-1.5 text-xs h-9 px-4"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </Button>
              <Button
                size="sm"
                onClick={() => setStep(3)}
                disabled={!step2Valid}
                className="gap-1.5 text-xs h-9 px-5 bg-primary text-primary-foreground"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* STEP 3: Summary & Confirmation */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {step === 3 && (
        <Card className="border border-border shadow-xs bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-bold">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Overview Rows */}
            <div className="space-y-3 divide-y divide-border/60 text-xs">
              <div className="flex items-center justify-between pb-2">
                <span className="text-muted-foreground font-medium">Customer</span>
                <span className="font-bold text-foreground">{customerName}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground font-medium">Service</span>
                <span className="font-bold text-foreground">
                  {billBy === "per-kg"
                    ? `${selectedService?.name || "Regular"} (${numWeight} kg)`
                    : `${selectedTier?.name || "Load"} (${numLoads} loads)`}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground font-medium">Extras</span>
                <span className="font-bold text-foreground">
                  {selectedAddOns.length > 0 ? selectedAddOns.join(", ") : "None"}
                </span>
              </div>
              {matchedMember && (
                <div className="flex items-center justify-between py-2 bg-amber-500/10 px-2 rounded-lg text-amber-900 dark:text-amber-200">
                  <span className="font-medium flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Loyalty Stamp
                  </span>
                  <span className="font-bold">+1 Pending Stamp (Auto-awarded on Claim)</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-3">
                <span className="text-sm font-bold text-foreground">Total</span>
                <span className="text-lg font-bold text-primary font-mono">₱{liveTotal}</span>
              </div>
            </div>

            {/* Payment Status Selector */}
            <div className="space-y-2 pt-2">
              <Label className="text-xs font-semibold text-muted-foreground">Payment</Label>
              {enablePaymentOption ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentStatus("paid")}
                    className={cn(
                      "py-2.5 px-3 text-xs font-bold rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-2",
                      paymentStatus === "paid"
                        ? "bg-green-500/10 border-green-500 text-green-600 dark:text-green-400 shadow-xs"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Check className="w-3.5 h-3.5" /> Paid
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentStatus("unpaid")}
                    className={cn(
                      "py-2.5 px-3 text-xs font-bold rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-2",
                      paymentStatus === "unpaid"
                        ? "bg-red-500/10 border-red-500 text-red-600 dark:text-red-400 shadow-xs"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Unpaid
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                    <Check className="w-4 h-4" /> Paid Directly
                  </span>
                  <span className="text-muted-foreground">Automatic payment on entry</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(2)}
                disabled={submitting}
                className="gap-1.5 text-xs h-9 px-4"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </Button>
              <Button
                size="sm"
                onClick={handleCreateOrder}
                disabled={submitting}
                className="gap-1.5 text-xs h-9 px-6 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {submitting ? (
                  "Creating Order…"
                ) : (
                  <>
                    <Check className="w-4 h-4" /> Create Order
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Print Receipt Modal Flow */}
      <PrintReceiptModal
        open={!!createdTxn}
        onOpenChange={(open) => {
          if (!open) {
            const finishedTxn = createdTxn;
            setCreatedTxn(null);
            if (finishedTxn) {
              onOrderCreated?.(finishedTxn);
            }
            onNavigate?.("transactions");
          }
        }}
        transaction={createdTxn}
        postCreate={true}
      />
    </div>
  );
}
