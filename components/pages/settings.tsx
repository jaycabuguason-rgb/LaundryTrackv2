"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, Edit, Save, Upload, Clock, Download, Loader2, CheckCircle2, Scale, ShoppingBasket, Package, X, Eye, EyeOff, Tag, Undo2, Redo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type Page } from "@/components/sidebar";
import { cn } from "@/lib/utils";
import {
  transactions,
  loyaltyMembers,
  auditLogs,
  serviceRevenueData,
  weeklyRevenueData,
} from "@/lib/data";
import {
  type ServiceType,
  type AddOn,
  type PricingType,
  type PricingMode,
  type PriceDisplayMode,
  type LoadTier,
  type BusinessProfile,
  DEFAULT_SERVICE_TYPES,
  DEFAULT_ADDONS,
  DEFAULT_LOAD_TIERS,
  loadServiceTypes,
  persistServiceTypes,
  loadAddOns,
  persistAddOns,
  loadPricingConfig,
  persistPricingConfig,
  loadBusinessProfile,
  persistBusinessProfile,
  loadLoyaltySettings,
  persistLoyaltySettings,
} from "@/lib/settings-store";
import { getBrowserAccessToken } from "@/lib/supabase/browser-session";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { enqueueSettingsMutation } from "@/lib/offline-settings-sync";
import { isOnline } from "@/lib/network-status";
import { toast } from "@/hooks/use-toast";

async function buildAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (getSupabaseBrowserClient()) {
    const accessToken = await getBrowserAccessToken();
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

// ─── Pricing ────────────────────────────────────────────────────────────────

function PricingSettings() {
  // Base pricing — initialised from shared store
  const [pricingMode, setPricingMode]   = useState<PricingMode>(() => loadPricingConfig().pricingMode);
  const [pricePerKg, setPricePerKg]     = useState(() => loadPricingConfig().pricePerKg);
  const [minWeight, setMinWeight]       = useState(() => loadPricingConfig().minWeight);

  // Load tiers — initialised from shared store
  const [loadTiers, setLoadTiers] = useState<LoadTier[]>(() => loadPricingConfig().loadTiers);
  // Undo/redo history for tier changes
  const [tierHistory, setTierHistory] = useState<LoadTier[][]>([]);
  const [tierFuture,  setTierFuture]  = useState<LoadTier[][]>([]);
  // Delete confirmation modal
  const [deleteTierId, setDeleteTierId] = useState<string | null>(null);

  const [showAddTier, setShowAddTier] = useState(false);
  const [newTierName, setNewTierName]   = useState("");
  const [newTierFrom, setNewTierFrom]   = useState("");
  const [newTierTo, setNewTierTo]       = useState("");
  const [newTierOpen, setNewTierOpen]   = useState(false);
  const [newTierPrice, setNewTierPrice] = useState("");

  // Helper: build range string from from/to/open
  const buildRange = (from: string, to: string, open: boolean) =>
    from ? (open ? `${from} kg+` : to ? `${from} kg – ${to} kg` : `${from} kg`) : "";

  useEffect(() => {
    let ignore = false;
    void buildAuthHeaders()
      .then(headers => fetch("/api/settings/pricing", { cache: "no-store", headers }))
      .then(async (response) => {
        if (!response.ok || ignore) return;
        const data = await response.json().catch(() => ({}));
        if (ignore) return;
        
        if (data.pricingConfig) {
          setPricingMode(data.pricingConfig.pricingMode);
          setPricePerKg(data.pricingConfig.pricePerKg);
          setMinWeight(data.pricingConfig.minWeight);
          setLoadTiers(data.pricingConfig.loadTiers);
          setTierHistory([]);
          setTierFuture([]);
          persistPricingConfig(data.pricingConfig);
        }
        if (data.serviceTypes) {
          setServices(data.serviceTypes);
          persistServiceTypes(data.serviceTypes);
        }
        if (data.addOns) {
          setAddOns(data.addOns);
          persistAddOns(data.addOns);
        }
      })
      .catch(() => undefined);

    return () => { ignore = true; };
  }, []);

  // Tier mutation with history tracking
  const commitTiers = (next: LoadTier[]) => {
    setTierHistory((h) => [...h, loadTiers]);
    setTierFuture([]);
    setLoadTiers(next);
  };
  const undoTiers = () => {
    if (!tierHistory.length) return;
    setTierFuture((f) => [loadTiers, ...f]);
    setLoadTiers(tierHistory[tierHistory.length - 1]);
    setTierHistory((h) => h.slice(0, -1));
  };
  const redoTiers = () => {
    if (!tierFuture.length) return;
    setTierHistory((h) => [...h, loadTiers]);
    setLoadTiers(tierFuture[0]);
    setTierFuture((f) => f.slice(1));
  };

  // Service Types — initialised from shared store
  const [services, setServices] = useState<ServiceType[]>(loadServiceTypes);
  const updateServices = (next: ServiceType[]) => { setServices(next); persistServiceTypes(next); };
  const [svcNewName, setSvcNewName]               = useState("");
  const [svcNewDesc, setSvcNewDesc]               = useState("");
  const [svcNewPrice, setSvcNewPrice]             = useState("");
  const [svcNewPricingType, setSvcNewPricingType] = useState<PricingType>("per-kg");
  const [svcNewShowInTxn, setSvcNewShowInTxn]     = useState(true);
  const [svcNewShowPrice, setSvcNewShowPrice]     = useState(true);
  const [showAddSvc, setShowAddSvc]               = useState(false);
  const [svcEnabled, setSvcEnabled]               = useState(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem("laundrytrack_svc_enabled");
    return v === null ? true : v === "true";
  });
  const [svcEditTarget, setSvcEditTarget]         = useState<ServiceType | null>(null);
  const [svcEditName, setSvcEditName]             = useState("");
  const [svcEditDesc, setSvcEditDesc]             = useState("");
  const [svcEditPrice, setSvcEditPrice]           = useState("");
  const [svcEditPricingType, setSvcEditPricingType] = useState<PricingType>("per-kg");
  const [svcEditActive, setSvcEditActive]         = useState(true);
  const [svcEditShowPrice, setSvcEditShowPrice]   = useState(true);

  const openSvcEdit = (s: ServiceType) => {
    setSvcEditTarget(s); setSvcEditName(s.name); setSvcEditDesc(s.description);
    setSvcEditPrice(s.price); setSvcEditPricingType(s.pricingType);
    setSvcEditActive(s.active); setSvcEditShowPrice(s.showPrice ?? true);
  };
  const saveSvcEdit = () => {
    if (!svcEditTarget) return;
    updateServices(services.map((s) => s.id === svcEditTarget.id
      ? { ...s, name: svcEditName, description: svcEditDesc, price: svcEditPrice, pricingType: svcEditPricingType, active: svcEditActive, showPrice: svcEditShowPrice }
      : s));
    setSvcEditTarget(null);
  };
  const handleSvcAdd = () => {
    if (!svcNewName.trim() || !svcNewPrice.trim()) return;
    updateServices([...services, { id: Date.now().toString(), name: svcNewName.trim(), description: svcNewDesc.trim(), price: svcNewPrice.trim(), pricingType: svcNewPricingType, active: svcNewShowInTxn, showPrice: svcNewShowPrice }]);
    setSvcNewName(""); setSvcNewDesc(""); setSvcNewPrice(""); setSvcNewPricingType("per-kg"); setSvcNewShowInTxn(true); setSvcNewShowPrice(true);
    setShowAddSvc(false);
  };

  // Add-ons — initialised from shared store
  const [addOns, setAddOns] = useState<AddOn[]>(() => loadAddOns());
  const [newName, setNewName] = useState("");
  const [newRate, setNewRate] = useState("");

  // Price display mode — initialised from shared store
  const [priceDisplayMode, setPriceDisplayMode] = useState<PriceDisplayMode>(
    () => loadPricingConfig().priceDisplayMode ?? "show"
  );

  // Save state
  const [saved, setSaved] = useState(false);

  // Load settings from database on mount
  useEffect(() => {
    let ignore = false;

    void buildAuthHeaders()
      .then(headers => fetch("/api/settings/pricing", { cache: "no-store", headers }))
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || ignore) return;
        
        if (data.pricingConfig) {
          const cfg = data.pricingConfig;
          setPricePerKg(cfg.pricePerKg);
          setMinWeight(cfg.minWeight);
          setPricingMode(cfg.pricingMode);
          setLoadTiers(cfg.loadTiers);
          setPriceDisplayMode(cfg.priceDisplayMode ?? "show");
          persistPricingConfig(cfg);
        }
        
        if (data.serviceTypes) {
          setServices(data.serviceTypes);
          persistServiceTypes(data.serviceTypes);
        }
        
        if (data.addOns) {
          setAddOns(data.addOns);
          persistAddOns(data.addOns);
        }
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
    };
  }, []);

  const addAddon = () => {
    if (!newName || !newRate) return;
    const next: AddOn[] = [...addOns, { id: Date.now().toString(), name: newName, rate: newRate }];
    setAddOns(next);
    persistAddOns(next);
    setNewName(""); setNewRate("");
  };

  const addTier = () => {
    if (!newTierName || !newTierPrice) return;
    const range = buildRange(newTierFrom, newTierTo, newTierOpen);
    commitTiers([...loadTiers, { id: Date.now().toString(), name: newTierName, range, price: newTierPrice }]);
    setNewTierName(""); setNewTierFrom(""); setNewTierTo(""); setNewTierOpen(false); setNewTierPrice("");
    setShowAddTier(false);
  };

  const confirmDeleteTier = () => {
    if (!deleteTierId) return;
    commitTiers(loadTiers.filter((t) => t.id !== deleteTierId));
    setDeleteTierId(null);
  };

  const updateTier = (id: string, patch: Partial<LoadTier & { from: string; to: string; open: boolean }>) =>
    setLoadTiers((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      const merged = { ...t, ...patch };
      // Re-derive range from from/to/open if any of those changed
      if ("from" in patch || "to" in patch || "open" in patch) {
        const from  = (patch.from  ?? (t as LoadTier & { from?: string }).from)  ?? "";
        const to    = (patch.to    ?? (t as LoadTier & { to?: string }).to)      ?? "";
        const open  = (patch.open  ?? (t as LoadTier & { open?: boolean }).open) ?? false;
        merged.range = buildRange(from, to, open);
      }
      return merged;
    }));

  // Parse existing range string into from/to/open for display
  const parseRange = (range: string): { from: string; to: string; open: boolean } => {
    if (!range) return { from: "", to: "", open: false };
    const openMatch = range.match(/^(\d+(?:\.\d+)?)\s*kg\+/);
    if (openMatch) return { from: openMatch[1], to: "", open: true };
    const rangeMatch = range.match(/^(\d+(?:\.\d+)?)\s*kg\s*[–-]\s*(\d+(?:\.\d+)?)\s*kg/);
    if (rangeMatch) return { from: rangeMatch[1], to: rangeMatch[2], open: false };
    const singleMatch = range.match(/^(\d+(?:\.\d+)?)\s*kg/);
    if (singleMatch) return { from: singleMatch[1], to: "", open: false };
    return { from: "", to: "", open: false };
  };

  const showKg   = pricingMode === "per-kg"   || pricingMode === "both";
  const showLoad = pricingMode === "per-load" || pricingMode === "both";

  const MODES: { value: PricingMode; icon: React.ReactNode; label: string; sub: string }[] = [
    { value: "per-kg",   icon: <Scale className="w-4 h-4" />,          label: "Per Kilogram", sub: "Charge by weight"     },
    { value: "per-load", icon: <ShoppingBasket className="w-4 h-4" />, label: "Per Load",     sub: "Flat rate per load"   },
    { value: "both",     icon: <Package className="w-4 h-4" />,        label: "Both",         sub: "Staff selects at time of transaction" },
  ];

  const handleSave = async () => {
    persistPricingConfig({ pricePerKg, minWeight, pricingMode, loadTiers, priceDisplayMode });
    persistAddOns(addOns);
    persistServiceTypes(services);
    if (typeof window !== "undefined") localStorage.setItem("laundrytrack_svc_enabled", String(svcEnabled));
    
    // Save to database
    try {
      if (!isOnline()) {
        await enqueueSettingsMutation({
          endpoint: "/api/settings/pricing",
          method: "PUT",
          body: {
            pricingConfig: { pricePerKg, minWeight, pricingMode, loadTiers, priceDisplayMode },
            serviceTypes: services,
            addOns,
          },
        });
        toast({
          title: "Saved Offline",
          description: "Pricing changes were queued and will sync when online.",
        });
      } else {
        const response = await fetch("/api/settings/pricing", {
          method: "PUT",
          headers: await buildAuthHeaders(),
          body: JSON.stringify({
            pricingConfig: { pricePerKg, minWeight, pricingMode, loadTiers, priceDisplayMode },
            serviceTypes: services,
            addOns,
          }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Failed to save settings.");
        }
      }
    } catch (error) {
      console.error("Failed to save settings to database:", error);
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Failed to save settings.",
        variant: "destructive",
      });
      setSaved(false);
      return;
    }
    
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <>
    <div className="space-y-5 w-full max-w-xl">

      {/* ── Base Pricing ─────────────────────────────────────────────────── */}
      <Card className="border border-border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Base Pricing</CardTitle>
          <CardDescription className="text-xs">Configure how laundry is charged to customers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Pricing Mode toggle */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pricing Mode</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {MODES.map(({ value, icon, label, sub }) => (
                <button
                  key={value}
                  onClick={() => setPricingMode(value)}
                  className={[
                    "flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 text-center transition-all cursor-pointer",
                    pricingMode === value
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-background hover:border-primary/40 hover:bg-muted/20",
                  ].join(" ")}
                >
                  <div className={[
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    pricingMode === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  ].join(" ")}>
                    {icon}
                  </div>
                  <p className={["text-xs font-semibold leading-tight", pricingMode === value ? "text-primary" : "text-foreground"].join(" ")}>
                    {label}
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{sub}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Per Kilogram fields */}
          {showKg && (
            <div className="space-y-3 pt-1">
              {pricingMode === "both" && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Per Kilogram</p>
              )}
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                <Label className="text-sm w-36 shrink-0">Price per kg (₱)</Label>
                <Input
                  type="number"
                  min="0"
                  value={pricePerKg}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9.]/g, '');
                    setPricePerKg(value);
                  }}
                  onKeyDown={(e) => {
                    if (!/[0-9.]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  className="h-9 w-full text-sm sm:w-28"
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                <Label className="text-sm w-36 shrink-0">Minimum weight (kg)</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="e.g. 3 kg minimum"
                  value={minWeight}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9.]/g, '');
                    setMinWeight(value);
                  }}
                  onKeyDown={(e) => {
                    if (!/[0-9.]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  className="h-9 w-full text-sm sm:w-28"
                />
              </div>
            </div>
          )}

          {/* Per Load tier table */}
          {showLoad && (
            <div className="space-y-3 pt-1">
              {pricingMode === "both" && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Per Load Tiers</p>
              )}
              {pricingMode === "per-load" && (
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Load Pricing Tiers</Label>
              )}
              {/* Undo / Redo */}
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="h-7 px-2.5 gap-1 text-xs" disabled={!tierHistory.length} onClick={undoTiers}>
                  <Undo2 className="w-3 h-3" /> Undo
                </Button>
                <Button variant="outline" size="sm" className="h-7 px-2.5 gap-1 text-xs" disabled={!tierFuture.length} onClick={redoTiers}>
                  <Redo2 className="w-3 h-3" /> Redo
                </Button>
              </div>
              <div className="rounded-lg border border-border overflow-x-auto">
                <table className="w-full text-sm min-w-[450px]">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground whitespace-nowrap">Load Size</th>
                      <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground whitespace-nowrap">Weight Range</th>
                      <th className="text-left px-3 py-2.5 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground whitespace-nowrap">Price</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {loadTiers.map((tier) => {
                      const parsed = parseRange(tier.range);
                      return (
                        <tr key={tier.id} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
                          {/* Load Size — editable */}
                          <td className="px-3 py-2.5 align-middle">
                            <Input
                              value={tier.name}
                              onChange={(e) => updateTier(tier.id, { name: e.target.value })}
                              className="h-8 text-xs w-20 sm:w-28 px-2"
                              placeholder="Name"
                            />
                          </td>
                          {/* Weight Range — two number inputs */}
                          <td className="px-3 py-2.5 align-middle whitespace-nowrap">
                            <div className="flex items-center gap-1.5 flex-nowrap">
                              <Input
                                type="number"
                                min="0"
                                value={parsed.from}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/[^0-9.]/g, '');
                                  updateTier(tier.id, { from: value, to: parsed.to, open: parsed.open });
                                }}
                                onKeyDown={(e) => {
                                  if (!/[0-9.]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                                    e.preventDefault();
                                  }
                                }}
                                className="w-12 sm:w-14 h-8 text-xs px-1.5 text-center"
                                placeholder="0"
                              />
                              <span className="text-[11px] sm:text-xs text-muted-foreground font-medium">kg —</span>
                              {parsed.open ? (
                                <span className="text-[11px] sm:text-xs font-medium text-foreground px-1">above</span>
                              ) : (
                                <>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={parsed.to}
                                    onChange={(e) => {
                                      const value = e.target.value.replace(/[^0-9.]/g, '');
                                      updateTier(tier.id, { from: parsed.from, to: value, open: false });
                                    }}
                                    onKeyDown={(e) => {
                                      if (!/[0-9.]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                                        e.preventDefault();
                                      }
                                    }}
                                    className="w-12 sm:w-14 h-8 text-xs px-1.5 text-center"
                                    placeholder="0"
                                  />
                                  <span className="text-[11px] sm:text-xs text-muted-foreground font-medium">kg</span>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => updateTier(tier.id, { from: parsed.from, to: parsed.to, open: !parsed.open })}
                                className={cn(
                                  "text-[10px] px-1.5 py-0.5 h-6 rounded border transition-colors cursor-pointer ml-1 shrink-0",
                                  parsed.open
                                    ? "bg-primary/10 border-primary/30 text-primary"
                                    : "bg-muted border-border text-muted-foreground hover:border-primary/40"
                                )}
                                title="Toggle open-ended (e.g. 10 kg+)"
                              >
                                {parsed.open ? "Open" : "+"}
                              </button>
                            </div>
                          </td>
                          {/* Price */}
                          <td className="px-3 py-2.5 align-middle">
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] sm:text-xs text-muted-foreground font-medium">₱</span>
                              <Input
                                type="number"
                                min="0"
                                value={tier.price}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/[^0-9.]/g, '');
                                  updateTier(tier.id, { price: value });
                                }}
                                onKeyDown={(e) => {
                                  if (!/[0-9.]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                                    e.preventDefault();
                                  }
                                }}
                                className="w-16 sm:w-20 h-8 text-xs sm:text-sm px-2"
                              />
                            </div>
                          </td>
                          <td className="px-2 py-2.5 align-middle text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                              onClick={() => setDeleteTierId(tier.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Add custom tier */}
              {showAddTier ? (
                <div className="bg-muted/30 rounded-lg border border-border p-3 space-y-2">
                  <p className="text-xs font-medium text-foreground">New Custom Tier</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <Label className="text-[10px] text-muted-foreground mb-1 block">Tier Name</Label>
                      <Input placeholder="e.g. Extra Large" value={newTierName} onChange={(e) => setNewTierName(e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground mb-1 block">From (kg)</Label>
                      <div className="flex items-center gap-1">
                        <Input type="number" min="0" placeholder="0" value={newTierFrom} onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9.]/g, '');
                        setNewTierFrom(value);
                      }} onKeyDown={(e) => {
                        if (!/[0-9.]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                          e.preventDefault();
                        }
                      }} className="h-8 text-xs w-full" />
                        <span className="text-xs text-muted-foreground shrink-0">kg</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground mb-1 block">To (kg)</Label>
                      <div className="flex items-center gap-1">
                        {newTierOpen ? (
                          <span className="text-xs font-medium text-foreground px-2 h-8 flex items-center">above</span>
                        ) : (
                          <Input type="number" min="0" placeholder="0" value={newTierTo} onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9.]/g, '');
                            setNewTierTo(value);
                          }} onKeyDown={(e) => {
                            if (!/[0-9.]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                              e.preventDefault();
                            }
                          }} className="h-8 text-xs w-full" />
                        )}
                        <span className="text-xs text-muted-foreground shrink-0">kg</span>
                        <button
                          type="button"
                          onClick={() => setNewTierOpen((v) => !v)}
                          className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer shrink-0",
                            newTierOpen
                              ? "bg-primary/10 border-primary/30 text-primary"
                              : "bg-muted border-border text-muted-foreground hover:border-primary/40"
                          )}
                          title="Toggle open-ended"
                        >+</button>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-[10px] text-muted-foreground mb-1 block">Price (₱)</Label>
                      <Input type="number" placeholder="e.g. 300" value={newTierPrice} onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9.]/g, '');
                        setNewTierPrice(value);
                      }} onKeyDown={(e) => {
                        if (!/[0-9.]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                          e.preventDefault();
                        }
                      }} className="h-8 text-xs" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-xs" onClick={addTier} disabled={!newTierName || !newTierPrice}>
                      Save Tier
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => { setShowAddTier(false); setNewTierName(""); setNewTierFrom(""); setNewTierTo(""); setNewTierOpen(false); setNewTierPrice(""); }}>
                      <X className="w-3 h-3" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => setShowAddTier(true)}>
                  <Plus className="w-3.5 h-3.5" /> Add Custom Tier
                </Button>
              )}
            </div>
          )}

          {/* Both mode note */}
          {pricingMode === "both" && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 text-xs text-blue-800">
              Staff will select the pricing type when creating a new transaction.
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Service Types ─────────────────────────────────────────────────── */}
      <Card className="border border-border shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm">Service Types</CardTitle>
              <CardDescription className="text-xs">Manage available wash service categories.</CardDescription>
            </div>
            <Switch checked={svcEnabled} onCheckedChange={setSvcEnabled} aria-label="Toggle service types" />
          </div>
        </CardHeader>
        <CardContent className={cn("space-y-3", !svcEnabled && "opacity-40 pointer-events-none")}>
          {/* Helper text */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 text-xs text-blue-800 leading-relaxed">
            Service types define wash categories (Regular, Delicate, Express). If using Per Kilogram only, you can leave these disabled.
          </div>
          <div className="space-y-2">
          {services.map((s) => (
            <div key={s.id} className={cn("rounded-md px-3 py-2.5 space-y-2 transition-opacity duration-150", s.active ? "bg-muted/30" : "bg-muted/10 opacity-60")}>
              <div className="flex items-start gap-2 flex-wrap">
                <p className="text-sm font-semibold text-foreground">{s.name}</p>
                {s.active && (s.showPrice ?? true) && (
                  <span className="text-xs font-semibold text-primary bg-primary/10 rounded-full px-2 py-0.5">₱{s.price}</span>
                )}
                <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5 border border-border">
                  {PRICING_TYPE_LABELS[s.pricingType] ?? s.pricingType}
                </span>
              </div>
              {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Switch checked={s.active} onCheckedChange={(v) => updateServices(services.map((x) => x.id === s.id ? { ...x, active: v, showPrice: v ? (x.showPrice ?? true) : false } : x))} className="scale-90" />
                  <span className="text-[11px] text-muted-foreground font-medium">Show</span>
                </div>
                <div className={cn("flex items-center gap-1.5 transition-opacity duration-150", !s.active && "opacity-40 pointer-events-none cursor-not-allowed")} title={!s.active ? "Enable Show first" : undefined}>
                  <Switch checked={(s.showPrice ?? true) && s.active} onCheckedChange={(v) => updateServices(services.map((x) => x.id === s.id ? { ...x, showPrice: v } : x))} disabled={!s.active} className="scale-90" />
                  <span className="text-[11px] text-muted-foreground font-medium">Price</span>
                </div>
                <div className="flex-1" />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openSvcEdit(s)}><Edit className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => updateServices(services.filter((x) => x.id !== s.id))}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          ))}
          <div className="mt-3 pt-3 border-t border-border space-y-2">
            {!showAddSvc ? (
              <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setShowAddSvc(true)}>
                <Plus className="w-3.5 h-3.5" /> Add Service Type
              </Button>
            ) : (
              <>
            <p className="text-xs font-semibold text-muted-foreground">Add New Service Type</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <Label className="text-[10px] text-muted-foreground mb-1 block">Service Name <span className="text-destructive">*</span></Label>
                <Input placeholder="e.g. Heavy Duty Wash" value={svcNewName} onChange={(e) => setSvcNewName(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="col-span-2">
                <Label className="text-[10px] text-muted-foreground mb-1 block">Description</Label>
                <Input placeholder="e.g. For heavily soiled items" value={svcNewDesc} onChange={(e) => setSvcNewDesc(e.target.value)} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground mb-1 block">Price (₱) <span className="text-destructive">*</span></Label>
                <Input type="number" min="0" placeholder="e.g. 60" value={svcNewPrice} onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9.]/g, '');
                  setSvcNewPrice(value);
                }} onKeyDown={(e) => {
                  if (!/[0-9.]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                    e.preventDefault();
                  }
                }} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground mb-1 block">Pricing Type</Label>
                <Select value={svcNewPricingType} onValueChange={(v) => setSvcNewPricingType(v as PricingType)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per-kg">Per kg</SelectItem>
                    <SelectItem value="per-load">Per load</SelectItem>
                    <SelectItem value="per-piece">Per piece</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-4 pt-1">
              <div className="flex items-center gap-2"><Switch checked={svcNewShowInTxn} onCheckedChange={setSvcNewShowInTxn} /><Label className="text-xs text-muted-foreground">Show in Transaction</Label></div>
              <div className="flex items-center gap-2"><Switch checked={svcNewShowPrice} onCheckedChange={setSvcNewShowPrice} /><Label className="text-xs text-muted-foreground">Show Price</Label></div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="h-8 gap-1.5 mt-1" onClick={handleSvcAdd} disabled={!svcNewName.trim() || !svcNewPrice.trim()}>
                <Plus className="w-3.5 h-3.5" /> Add Service Type
              </Button>
              <Button size="sm" variant="ghost" className="h-8 gap-1 mt-1" onClick={() => { setShowAddSvc(false); setSvcNewName(""); setSvcNewDesc(""); setSvcNewPrice(""); setSvcNewPricingType("per-kg"); setSvcNewShowInTxn(true); setSvcNewShowPrice(true); }}>
                <X className="w-3 h-3" /> Cancel
              </Button>
            </div>
              </>
            )}
          </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Service Type modal */}
      <Dialog open={!!svcEditTarget} onOpenChange={(o) => { if (!o) setSvcEditTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Edit Service Type</DialogTitle>
            <DialogDescription className="sr-only">Edit service type details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Service Name <span className="text-destructive">*</span></Label>
              <Input value={svcEditName} onChange={(e) => setSvcEditName(e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Description</Label>
              <Textarea value={svcEditDesc} onChange={(e) => setSvcEditDesc(e.target.value)} className="text-sm resize-none" rows={2} placeholder="Optional description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Price (₱) <span className="text-destructive">*</span></Label>
                <Input type="number" min="0" value={svcEditPrice} onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9.]/g, '');
                  setSvcEditPrice(value);
                }} onKeyDown={(e) => {
                  if (!/[0-9.]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                    e.preventDefault();
                  }
                }} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Pricing Type</Label>
                <Select value={svcEditPricingType} onValueChange={(v) => setSvcEditPricingType(v as PricingType)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per-kg">Per kg</SelectItem>
                    <SelectItem value="per-load">Per load</SelectItem>
                    <SelectItem value="per-piece">Per piece</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between bg-muted/30 rounded-md px-3 py-2.5">
                <Label className="text-sm">Show</Label>
                <Switch checked={svcEditActive} onCheckedChange={setSvcEditActive} />
              </div>
              <div className="flex items-center justify-between bg-muted/30 rounded-md px-3 py-2.5">
                <Label className="text-sm">Price</Label>
                <Switch checked={svcEditShowPrice} onCheckedChange={setSvcEditShowPrice} />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button className="flex-1 gap-1.5" onClick={saveSvcEdit} disabled={!svcEditName.trim() || !svcEditPrice.trim()}>
                <Save className="w-3.5 h-3.5" /> Save Changes
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setSvcEditTarget(null)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Tier confirmation modal */}
      <Dialog open={!!deleteTierId} onOpenChange={(o) => { if (!o) setDeleteTierId(null); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-base">Delete this tier?</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">This cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Button variant="destructive" className="flex-1" onClick={confirmDeleteTier}>Delete</Button>
            <Button variant="outline" className="flex-1" onClick={() => setDeleteTierId(null)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add-on Rates ─────────────────────────────────────────────────── */}
      <Card className="border border-border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Add-on Rates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            {addOns.map((a) => (
              <div key={a.id} className="flex items-center gap-2 bg-muted/30 rounded-md px-3 py-2">
                <span className="flex-1 text-sm text-foreground">{a.name}</span>
                <span className="text-sm text-muted-foreground">&#x20B1;{a.rate}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => {
                  const next = addOns.filter((x) => x.id !== a.id);
                  setAddOns(next);
                  persistAddOns(next);
                }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <Input placeholder="Add-on name" value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1 h-8 text-sm" />
            <Input placeholder="Rate ₱" value={newRate} onChange={(e) => {
              const value = e.target.value.replace(/[^0-9.]/g, '');
              setNewRate(value);
            }} onKeyDown={(e) => {
              if (!/[0-9.]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                e.preventDefault();
              }
            }} className="w-20 h-8 text-sm" />
            <Button size="sm" variant="outline" onClick={addAddon} className="h-8">
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Price Display Settings ───────────────────────────────────────── */}
      <Card className="border border-border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Price Display Settings</CardTitle>
          <CardDescription className="text-xs">Control how prices appear to staff during transaction entry.</CardDescription>
        </CardHeader>
        <CardContent>
          {(() => {
            const DISPLAY_MODES: {
              value: PriceDisplayMode;
              icon: React.ReactNode;
              label: string;
              description: string;
            }[] = [
              {
                value: "show",
                icon: <Eye className="w-5 h-5" />,
                label: "Show Price",
                description: "Staff sees the price on each Wash Type and Load Size button, and the fee updates live as they fill out the form.",
              },
              {
                value: "free",
                icon: <Tag className="w-5 h-5" />,
                label: "No Price / Free",
                description: "All fees are set to ₱0. Useful for promo days or owner use. No prices are shown on buttons.",
              },
              {
                value: "hide",
                icon: <EyeOff className="w-5 h-5" />,
                label: "Hide Price",
                description: "Prices are kept but hidden from buttons and the live preview. Staff only sees the total on the final confirmation step.",
              },
            ];

            return (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {DISPLAY_MODES.map(({ value, icon, label, description }) => {
                  const active = priceDisplayMode === value;
                  return (
                    <button
                      key={value}
                      onClick={() => setPriceDisplayMode(value)}
                      className={[
                        "flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all cursor-pointer",
                        active
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-background hover:border-primary/40 hover:bg-muted/20",
                      ].join(" ")}
                    >
                      <div className={[
                        "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                      ].join(" ")}>
                        {icon}
                      </div>
                      <div className="space-y-0.5">
                        <p className={["text-sm font-semibold leading-tight", active ? "text-primary" : "text-foreground"].join(" ")}>
                          {label}
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-snug">{description}</p>
                      </div>
                      {active && (
                        <span className="mt-auto text-[10px] font-semibold uppercase tracking-wider text-primary">Active</span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* bottom spacer so content isn't hidden behind fixed bar */}
      <div className="h-36 lg:h-20" />
    </div>

    {/* ── Fixed Save Bar ───────────────────────────────────────────────────── */}
    <div className="fixed bottom-[72px] left-0 right-0 z-50 flex items-center justify-between gap-3 border-t border-border bg-background px-4 py-2.5 lg:bottom-0 lg:px-6 lg:py-3">
      {saved ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700 animate-in fade-in slide-in-from-bottom-1 ml-auto">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Changes saved successfully!
        </div>
      ) : (
        <>
          <p className="hidden text-xs text-muted-foreground sm:block">Make changes above, then click Save to apply them.</p>
          <Button
            size="sm"
            onClick={handleSave}
            className="flex shrink-0 items-center justify-center gap-1.5 ml-auto"
          >
            <Save className="w-3.5 h-3.5" /> Save Changes
          </Button>
        </>
      )}
    </div>
    </>
  );
}

const PRICING_TYPE_LABELS: Record<PricingType, string> = {
  "per-kg":    "Per kg",
  "per-load":  "Per load",
  "per-piece": "Per piece",
};


// ─── Business Profile ────────────────────────────────────────────────────────
const DEFAULT_PROFILE = {
  shopName: "LaundryTrack",
  tagline: "Powered by LaundryTrack",
  address: "",
  contactNumber: "",
  email: "",
  logoDataUrl: "",
  receiptFooter: "",
  pickupInstructions: "Present this receipt or QR code upon claiming.",
};

function BusinessProfileSettings({ onSave }: { onSave?: (profile: BusinessProfile) => void }) {
  const [profile, setProfile] = useState<BusinessProfile>(() => loadBusinessProfile());
  const [committedProfile, setCommittedProfile] = useState<BusinessProfile>(() => loadBusinessProfile());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof BusinessProfile, string>>>({});
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const isDirty = JSON.stringify(profile) !== JSON.stringify(committedProfile);

  const update = (patch: Partial<BusinessProfile>) => {
    setProfile((p) => ({ ...p, ...patch }));
    const key = Object.keys(patch)[0] as keyof BusinessProfile;
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  useEffect(() => {
    let ignore = false;
    void fetch("/api/settings/business-profile", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.profile || ignore) return;
        setProfile(data.profile as BusinessProfile);
        setCommittedProfile(data.profile as BusinessProfile);
        persistBusinessProfile(data.profile as BusinessProfile);
      })
      .catch(() => undefined);
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const validate = () => {
    const errs: Partial<Record<keyof BusinessProfile, string>> = {};
    if (!profile.shopName.trim()) errs.shopName = "Shop name is required.";
    if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email))
      errs.email = "Please enter a valid email address.";
    return errs;
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("Logo must be under 2MB."); return; }
    const reader = new FileReader();
    reader.onload = () => update({ logoDataUrl: reader.result as string });
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    setSaveError(null);
    try {
      if (!isOnline()) {
        await enqueueSettingsMutation({
          endpoint: "/api/settings/business-profile",
          method: "PUT",
          body: profile,
        });
        toast({
          title: "Saved Offline",
          description: "Business profile changes were queued and will sync when online.",
        });
      } else {
        const response = await fetch("/api/settings/business-profile", {
          method: "PUT",
          headers: await buildAuthHeaders(),
          body: JSON.stringify(profile),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message =
            typeof data.error === "string" && data.error.trim().length > 0
              ? data.error
              : "Failed to save business profile. Please try again.";
          throw new Error(message);
        }
      }

      const result = profile as BusinessProfile;
      persistBusinessProfile(result);
      onSave?.(result);
      setProfile(result);
      setCommittedProfile(result);
      setErrors({});
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save business profile.";
      setSaveError(message);
      setSaved(false);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    persistBusinessProfile(DEFAULT_PROFILE as BusinessProfile);
    setProfile(DEFAULT_PROFILE as BusinessProfile);
    setCommittedProfile(DEFAULT_PROFILE as BusinessProfile);
    setErrors({});
    setShowResetConfirm(false);
    onSave?.(DEFAULT_PROFILE as BusinessProfile);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-4 w-full max-w-lg">
      <Card className="border border-border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Business Profile</CardTitle>
          <CardDescription className="text-xs">This information appears on receipts and the customer tracking page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Shop Name <span className="text-destructive">*</span></Label>
            <Input value={profile.shopName} onChange={(e) => update({ shopName: e.target.value })}
              className={cn("h-9 text-sm", errors.shopName && "border-destructive")} placeholder="e.g. Sunshine Laundry Shop" />
            {errors.shopName && <p className="text-xs text-destructive mt-1">{errors.shopName}</p>}
          </div>
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Tagline / Subtitle</Label>
            <Input value={profile.tagline} onChange={(e) => update({ tagline: e.target.value })}
              className="h-9 text-sm" placeholder="e.g. Powered by LaundryTrack" />
          </div>
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Address</Label>
            <Input value={profile.address} onChange={(e) => update({ address: e.target.value })}
              className="h-9 text-sm" placeholder="e.g. 123 Magsaysay Ave, Manila" />
          </div>
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Contact Number</Label>
            <Input value={profile.contactNumber} onChange={(e) => update({ contactNumber: e.target.value })}
              className="h-9 text-sm" placeholder="e.g. (02) 8123-4567" />
          </div>
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Email</Label>
            <Input type="email" value={profile.email} onChange={(e) => update({ email: e.target.value })}
              className={cn("h-9 text-sm", errors.email && "border-destructive")} placeholder="e.g. contact@laundrytrack.ph" />
            {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
          </div>
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Shop Logo</Label>
            <input ref={logoInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleLogoChange} />
            {profile.logoDataUrl ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={profile.logoDataUrl} alt="Shop logo preview" className="w-16 h-16 rounded-lg object-contain border border-border bg-muted/30" />
                <div className="flex flex-col gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => logoInputRef.current?.click()}>
                    <Upload className="w-3 h-3" /> Change Logo
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => update({ logoDataUrl: "" })}>Remove</Button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => logoInputRef.current?.click()}
                className="w-full border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-2 hover:border-primary/40 hover:bg-muted/20 transition-colors cursor-pointer">
                <Upload className="w-6 h-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Click to upload or drag & drop</p>
                <p className="text-[11px] text-muted-foreground/60">PNG, JPG up to 2MB</p>
              </button>
            )}
          </div>
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Receipt Footer Message</Label>
            <Textarea value={profile.receiptFooter} onChange={(e) => update({ receiptFooter: e.target.value })}
              placeholder="e.g. Thank you for choosing Sunshine Laundry Shop!" className="text-sm resize-none" rows={2} />
          </div>
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Pickup Instructions</Label>
            <Textarea value={profile.pickupInstructions} onChange={(e) => update({ pickupInstructions: e.target.value })}
              placeholder="e.g. Present this receipt or QR code upon claiming." className="text-sm resize-none" rows={2} />
          </div>
        </CardContent>
      </Card>

      {isDirty && (
        <p className="text-xs text-amber-600 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
          You have unsaved changes.
        </p>
      )}
      {saveError && (
        <p className="text-xs text-destructive">{saveError}</p>
      )}

      <div className="flex items-center gap-3">
        <Button size="sm" onClick={handleSave} disabled={saving} className="flex items-center gap-1.5">
          {saving
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>
            : saved
              ? <><CheckCircle2 className="w-3.5 h-3.5" /> Saved!</>
              : <><Save className="w-3.5 h-3.5" /> Save Profile</>}
        </Button>
        <button type="button" onClick={() => setShowResetConfirm(true)}
          className="text-xs text-muted-foreground hover:text-destructive underline underline-offset-2 transition-colors">
          Reset to Default
        </button>
      </div>

      {saved && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-green-600 text-white rounded-lg px-5 py-3 text-sm font-medium shadow-lg animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Business profile saved successfully!
        </div>
      )}
      {saveError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-destructive text-destructive-foreground rounded-lg px-5 py-3 text-sm font-medium shadow-lg animate-in fade-in slide-in-from-bottom-4">
          <X className="w-4 h-4 shrink-0" />
          {saveError}
        </div>
      )}

      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-base">Reset to Default?</DialogTitle>
            <DialogDescription className="text-sm">Reset all business profile settings to default? This cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Button variant="destructive" className="flex-1" onClick={handleReset}>Reset</Button>
            <Button variant="outline" className="flex-1" onClick={() => setShowResetConfirm(false)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Backup & Restore ────────────────────────────────────────────────────────
function BackupSettings() {
  const [autoBackup, setAutoBackup]   = useState(true);
  const [schedule, setSchedule]       = useState<"daily" | "weekly">("daily");
  const [exporting, setExporting]     = useState(false);
  const [lastBackup, setLastBackup]   = useState<Date | null>(null);
  const [justExported, setJustExported] = useState(false);

  const formatBackupDate = (d: Date) =>
    d.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) +
    ", " +
    d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: true });

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);

    // Brief artificial delay so the loading state is visible
    await new Promise((r) => setTimeout(r, 800));

    const now = new Date();

    // Build full backup payload from all data sources
    const backup = {
      meta: {
        appName: "LaundryTrack",
        version: "1.0",
        exportedAt: now.toISOString(),
        exportedBy: "Admin",
      },
      settings: {
        pricing: {
          pricePerKg: 30,
          loyaltyMilestone: 7,
          addOns: [
            { name: "Fabcon",        rate: 10 },
            { name: "Express (+50%)", rate: 50 },
            { name: "Bleach",        rate: 15 },
            { name: "Starch",        rate: 20 },
          ],
        },
        serviceTypes: [
          { name: "Regular",         description: "Standard wash & dry",              active: true },
          { name: "Delicate",        description: "Gentle cycle for delicate fabrics", active: true },
          { name: "Express",         description: "Same-day turnaround",               active: true },
          { name: "Bulk / Commercial", description: "For 10kg and above",             active: false },
        ],
        businessProfile: {
          shopName:      "LaundryTrack",
          address:       "123 Magsaysay Ave, Brgy. Sta. Cruz, Manila",
          contactNumber: "(02) 8123-4567",
          email:         "contact@laundrytrack.ph",
        },
        backup: {
          autoBackup: true,
          schedule:   "daily",
        },
      },
      data: {
        transactions,
        loyaltyMembers,
        auditLogs,
        analytics: {
          serviceRevenue:  serviceRevenueData,
          weeklyRevenue:   weeklyRevenueData,
        },
      },
    };

    // Serialise and trigger download
    const json     = JSON.stringify(backup, null, 2);
    const blob     = new Blob([json], { type: "application/json" });
    const url      = URL.createObjectURL(blob);
    const pad      = (n: number) => String(n).padStart(2, "0");
    const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const fileName = `LaundryTrack_Backup_${datePart}_${timePart}.json`;
    const a        = document.createElement("a");
    a.href         = url;
    a.download     = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setLastBackup(now);
    setExporting(false);
    setJustExported(true);
    setTimeout(() => setJustExported(false), 3000);
  };

  return (
    <div className="space-y-4 w-full max-w-lg">
      {/* Success toast */}
      {justExported && (
        <div className="flex items-center gap-2.5 bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600" />
          Backup exported successfully!
        </div>
      )}

      <Card className="border border-border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Manual Backup</CardTitle>
          <CardDescription className="text-xs">Download a snapshot of all system data.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 bg-muted/30 rounded-md p-3">
            <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">
              Last backup:{" "}
              <strong className="text-foreground">
                {lastBackup ? formatBackupDate(lastBackup) : "April 4, 2026, 11:00 PM"}
              </strong>
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="flex items-center gap-1.5"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                Export Database Backup
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Automatic Backup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Enable automatic backup</Label>
            <Switch checked={autoBackup} onCheckedChange={setAutoBackup} />
          </div>
          {autoBackup && (
            <div className="flex items-center gap-3">
              <Label className="text-sm w-20 shrink-0">Schedule</Label>
              <div className="flex gap-2">
                {(["daily", "weekly"] as const).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={schedule === s ? "default" : "outline"}
                    className="h-7 text-xs capitalize"
                    onClick={() => setSchedule(s)}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Restore from Backup</CardTitle>
          <CardDescription className="text-xs">Upload a previously exported backup file to restore data.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-2">
            <Upload className="w-6 h-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Click to upload backup file</p>
            <p className="text-[11px] text-muted-foreground/60">.json files accepted</p>
          </div>
          <Button size="sm" variant="destructive" className="mt-3 flex items-center gap-1.5">
            Restore Database
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Loyalty Program Settings ─────────────────────────────────────────────────

interface LoyaltyProgramSettingsProps {
  loyaltyEnabled: boolean;
  onLoyaltyEnabledChange: (val: boolean) => void;
}

function LoyaltyProgramSettings({ loyaltyEnabled, onLoyaltyEnabledChange }: LoyaltyProgramSettingsProps) {
  const [enabled, setEnabled] = useState(loyaltyEnabled);
  const [washesPerReward, setWashesPerReward] = useState(
    () => loadLoyaltySettings().washesPerReward
  );
  const [rewardDescription, setRewardDescription] = useState(
    () => loadLoyaltySettings().rewardDescription
  );
  const [saved, setSaved] = useState(false);

  // Load settings from database on mount
  useEffect(() => {
    let ignore = false;

    void fetch("/api/settings/pricing", {
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || ignore) return;
        
        if (data.loyaltySettings) {
          const settings = data.loyaltySettings;
          setEnabled(settings.enabled);
          setWashesPerReward(settings.washesPerReward);
          setRewardDescription(settings.rewardDescription);
          persistLoyaltySettings(settings);
        }
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
    };
  }, []);

  const handleSave = async () => {
    persistLoyaltySettings({ enabled, washesPerReward, rewardDescription });
    onLoyaltyEnabledChange(enabled);
    
    // Save to database
    try {
      if (!isOnline()) {
        await enqueueSettingsMutation({
          endpoint: "/api/settings/pricing",
          method: "PUT",
          body: {
            loyaltySettings: { enabled, washesPerReward, rewardDescription },
          },
        });
        toast({
          title: "Saved Offline",
          description: "Loyalty settings were queued and will sync when online.",
        });
      } else {
        const response = await fetch("/api/settings/pricing", {
          method: "PUT",
          headers: await buildAuthHeaders(),
          body: JSON.stringify({
            loyaltySettings: { enabled, washesPerReward, rewardDescription },
          }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Failed to save loyalty settings.");
        }
      }
    } catch (error) {
      console.error("Failed to save loyalty settings to database:", error);
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Failed to save settings.",
        variant: "destructive",
      });
      return;
    }
    
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-4 w-full max-w-lg">
      {saved && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600" />
          Changes saved successfully!
        </div>
      )}

      {/* Master toggle */}
      <Card className="border border-border shadow-none">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-semibold">Enable Loyalty Program</Label>
              <p className="text-xs text-muted-foreground leading-relaxed">
                When turned off, the Loyalty Member option will be hidden in New Transaction and the Loyalty Members menu will be disabled.
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              aria-label="Enable loyalty program"
            />
          </div>
        </CardContent>
      </Card>

      {/* Reward config — only shown when enabled */}
      <Card className={cn("border border-border shadow-none transition-opacity", !enabled && "opacity-50 pointer-events-none")}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Reward Configuration</CardTitle>
          <CardDescription className="text-xs">Configure how customers earn rewards based on their washes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Loyalty Reward</Label>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground shrink-0">Every</span>
              <Input
                type="number"
                min="1"
                value={washesPerReward}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, '');
                  setWashesPerReward(value);
                }}
                onKeyDown={(e) => {
                  if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                    e.preventDefault();
                  }
                }}
                className="w-16 h-9 text-sm text-center"
              />
              <span className="text-sm text-muted-foreground shrink-0">washes =</span>
              <Input
                placeholder="e.g. Free wash, 50% discount, Free fabcon"
                value={rewardDescription}
                onChange={(e) => setRewardDescription(e.target.value)}
                className="flex-1 min-w-40 h-9 text-sm"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Example: Every 10 washes = Free wash
            </p>
          </div>
        </CardContent>
      </Card>

      <Button size="sm" onClick={handleSave} className="flex items-center gap-1.5">
        <Save className="w-3.5 h-3.5" /> Save Changes
      </Button>
    </div>
  );
}

// ─── Export ──────────────────────────────────────────────────────────────────

interface SettingsPageProps {
  page: Page;
  loyaltyEnabled?: boolean;
  onLoyaltyEnabledChange?: (val: boolean) => void;
  onBusinessProfileChange?: (profile: BusinessProfile) => void;
}

export default function SettingsPage({ page, loyaltyEnabled = true, onLoyaltyEnabledChange, onBusinessProfileChange }: SettingsPageProps) {
  switch (page) {
    case "settings-pricing": return <PricingSettings />;
    case "settings-business-profile": return <BusinessProfileSettings onSave={onBusinessProfileChange} />;
    case "settings-loyalty": return (
      <LoyaltyProgramSettings
        loyaltyEnabled={loyaltyEnabled}
        onLoyaltyEnabledChange={onLoyaltyEnabledChange ?? (() => {})}
      />
    );
    case "settings-backup": return <BackupSettings />;
    default: return null;
  }
}
