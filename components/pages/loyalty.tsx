"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Search,
  ChevronLeft,
  Star,
  Plus,
  Edit,
  Trash2,
  Phone,
  Gift,
  Award,
  Check,
  Sparkles,
  CheckCircle2,
  LayoutGrid,
  Table as TableIcon,
  Flame,
  Undo2,
  Redo2,
  QrCode,
  Copy,
  ExternalLink,
  Package,
  Users,
  UserPlus,
  History,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLoyaltyMembers } from "@/hooks/use-loyalty-members";
import { Skeleton } from "boneyard-js/react";
import { cn } from "@/lib/utils";
import { type LoyaltyMember, type Transaction, transactions as seedTransactions } from "@/lib/data";
import { formatReadableDateTime } from "@/lib/date-format";
import { toast } from "@/hooks/use-toast";
import { getBrowserAccessToken, refreshBrowserSession } from "@/lib/supabase/browser-session";
import {
  loadLoyaltySettings,
  persistLoyaltySettings,
  type LoyaltySettings,
} from "@/lib/settings-store";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function StampDots({ count, max = 7 }: { count: number; max?: number }) {
  const effectiveCount = Math.min(count, max);
  return (
    <div
      role="meter"
      aria-label={`Loyalty stamps: ${effectiveCount} of ${max}`}
      aria-valuenow={effectiveCount}
      aria-valuemin={0}
      aria-valuemax={max}
      className="flex flex-wrap gap-2"
    >
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < effectiveCount;
        return (
          <div
            key={i}
            aria-hidden="true"
            className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold transition-all ${
              filled
                ? "bg-primary border-primary text-primary-foreground shadow-xs scale-105"
                : "bg-muted/40 border-dashed border-border text-muted-foreground"
            }`}
          >
            {filled ? <Star className="w-4 h-4 fill-current" /> : i + 1}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile Tactile Member Card
// ─────────────────────────────────────────────────────────────────────────────
function MobileLoyaltyMemberCard({
  member,
  washesPerReward,
  rewardName,
  saving,
  onSelect,
  onEdit,
  onDelete,
  onQr,
  onAddStamp,
}: {
  member: LoyaltyMember;
  washesPerReward: number;
  rewardName: string;
  saving: boolean;
  onSelect: (m: LoyaltyMember) => void;
  onEdit: (m: LoyaltyMember) => void;
  onDelete: (m: LoyaltyMember) => void;
  onQr: (m: LoyaltyMember) => void;
  onAddStamp: (m: LoyaltyMember, count: number) => void;
}) {
  const currentStamps = member.stampCount % washesPerReward;
  const stampsUntilReward = washesPerReward - currentStamps;
  const pct = Math.min(100, (currentStamps / washesPerReward) * 100);
  const isFrequent = member.stampCount >= Math.ceil(washesPerReward / 2);

  return (
    <div
      className="bg-card rounded-2xl p-4 border border-border/70 shadow-xs flex flex-col gap-3 transition-all"
      data-name={member.name}
      data-phone={member.phone || ""}
    >
      {/* Top row: Avatar, Name + Frequent tag, Phone, Edit & Delete */}
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
          onClick={() => onSelect(member)}
        >
          <div className="w-11 h-11 rounded-full bg-primary/10 text-primary border border-primary/20 font-bold flex items-center justify-center text-sm shrink-0 shadow-xs">
            {getInitials(member.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-sm text-foreground truncate">
                {member.name}
              </span>
              {isFrequent && (
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold text-[10px] tracking-wide uppercase">
                  Frequent
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <Phone className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{member.phone || "No phone"}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            aria-label={`Edit ${member.name}`}
            onClick={() => onEdit(member)}
            className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors flex items-center justify-center cursor-pointer"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label={`Delete ${member.name}`}
            onClick={() => onDelete(member)}
            className="w-8 h-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex items-center justify-center cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stamp Progress Section */}
      <div
        className="bg-muted/40 rounded-xl p-3 space-y-2 cursor-pointer hover:bg-muted/60 transition-colors"
        onClick={() => onSelect(member)}
      >
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-primary font-bold">
            <Star className="w-3.5 h-3.5 fill-current text-primary" />
            <span>
              {currentStamps} / {washesPerReward} Stamps
            </span>
          </div>
          <span className="text-muted-foreground font-medium text-[11px]">
            {member.rewardsRedeemed} Rewards Claimed
          </span>
        </div>

        {/* Progress track */}
        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-[11px] text-muted-foreground">
          <span>
            {stampsUntilReward <= 0
              ? "Reward Unlocked! 🎉"
              : currentStamps >= Math.ceil(washesPerReward / 2)
              ? "Halfway to next perk!"
              : currentStamps > 0
              ? "Started journey"
              : "Fresh enrollment"}
          </span>
          <span>
            {stampsUntilReward <= 0
              ? "Ready to claim"
              : `${stampsUntilReward} more to ${rewardName.toLowerCase()}`}
          </span>
        </div>
      </div>

      {/* Quick Action Buttons (3-button strip) */}
      <div className="flex items-center gap-1.5 pt-0.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`View QR status for ${member.name}`}
          onClick={() => onQr(member)}
          className="h-9 px-3 text-xs rounded-xl gap-1 shrink-0"
        >
          <QrCode className="w-3.5 h-3.5 text-primary" />
          <span>QR</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onSelect(member)}
          className="h-9 flex-1 text-xs rounded-xl gap-1"
        >
          <History className="w-3.5 h-3.5 text-muted-foreground" />
          <span>View Details</span>
        </Button>

        <Button
          type="button"
          size="sm"
          onClick={() => onAddStamp(member, 1)}
          disabled={saving}
          className="h-9 px-3 text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-xl gap-1 shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Stamp</span>
        </Button>
      </div>
    </div>
  );
}

interface LoyaltyPageProps {
  loyaltyEnabled?: boolean;
  transactions?: Transaction[];
}

export default function LoyaltyPage({ loyaltyEnabled: _loyaltyEnabled = true, transactions }: LoyaltyPageProps) {
  const { members, loading, refetch } = useLoyaltyMembers();
  const [activeTab, setActiveTab] = useState<"members" | "rewards">("members");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<LoyaltyMember | null>(null);

  // Loyalty Program Config state
  const [loyaltyConfig, setLoyaltyConfig] = useState<LoyaltySettings>(() => loadLoyaltySettings());

  // Modals state
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState<LoyaltyMember | null>(null);
  const [deleteModal, setDeleteModal] = useState<LoyaltyMember | null>(null);
  const [stampModal, setStampModal] = useState<LoyaltyMember | null>(null);
  const [rewardCycleModal, setRewardCycleModal] = useState<{ date: string; reward: string } | null>(null);
  const [qrModal, setQrModal] = useState<LoyaltyMember | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [saving, setSaving] = useState(false);

  // Simulated reward redemption state
  const [redeemedRewards, setRedeemedRewards] = useState<
    Array<{ id: string; name: string; memberName: string; date: string }>
  >([]);

  // Undo / Redo Stamp stack
  const [undoStack, setUndoStack] = useState<Array<{ memberId: string; stamps: number }>>([]);
  const [redoStack, setRedoStack] = useState<Array<{ memberId: string; stamps: number }>>([]);

  useEffect(() => {
    const cfg = loadLoyaltySettings();
    setLoyaltyConfig(cfg);
  }, []);

  const washesPerReward = parseInt(loyaltyConfig.washesPerReward) || 7;
  const rewardName = loyaltyConfig.rewardDescription || "Free wash";

  async function getAuthHeaders(extra: Record<string, string> = {}) {
    let accessToken = await getBrowserAccessToken();
    if (!accessToken) {
      const refreshed = await refreshBrowserSession();
      accessToken = refreshed?.access_token ?? null;
    }

    const headers: Record<string, string> = { ...extra };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    return headers;
  }

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        (m.phone && m.phone.toLowerCase().includes(q)) ||
        (m.preferences && m.preferences.toLowerCase().includes(q))
      );
    });
  }, [members, search]);

  // Overall statistics
  const totalMembers = members.length;
  const totalStampsIssued = useMemo(
    () => members.reduce((acc, m) => acc + (m.stampCount || 0), 0),
    [members]
  );
  const totalRewardsRedeemed = useMemo(
    () => members.reduce((acc, m) => acc + (m.rewardsRedeemed || 0), 0) + redeemedRewards.length,
    [members, redeemedRewards]
  );

  async function handleAddMember(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = (data.get("name") as string)?.trim();
    const phone = (data.get("phone") as string)?.trim();
    const preferences = (data.get("preferences") as string)?.trim();

    try {
      const res = await fetch("/api/loyalty", {
        method: "POST",
        headers: await getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ name, phone, preferences }),
      });
      if (!res.ok) throw new Error("Failed to create member");
      const json = await res.json();
      toast({ title: "Loyalty member added successfully" });
      setAddModal(false);
      refetch();
      if (json.member) {
        setSelected(json.member);
      }
    } catch {
      toast({ title: "Failed to add member", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateMember(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editModal) return;
    setSaving(true);
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = (data.get("name") as string)?.trim();
    const phone = (data.get("phone") as string)?.trim();
    const preferences = (data.get("preferences") as string)?.trim();

    try {
      const res = await fetch(`/api/loyalty/${editModal.id}`, {
        method: "PATCH",
        headers: await getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ name, phone, preferences }),
      });
      if (!res.ok) throw new Error("Failed to update member");
      toast({ title: "Member updated successfully" });
      setEditModal(null);
      refetch();
      if (selected && selected.id === editModal.id) {
        setSelected({ ...selected, name, phone, preferences });
      }
    } catch {
      toast({ title: "Failed to update member", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteMember() {
    if (!deleteModal) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/loyalty/${deleteModal.id}`, {
        method: "DELETE",
        headers: await getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete member");
      toast({ title: "Member deleted successfully" });
      setDeleteModal(null);
      if (selected && selected.id === deleteModal.id) {
        setSelected(null);
      }
      refetch();
    } catch {
      toast({ title: "Failed to delete member", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDirectAddStamp(member: LoyaltyMember, stamps: number = 1) {
    if (saving) return;
    setSaving(true);
    const targetMemberId = member.id;
    try {
      const headers = await getAuthHeaders({ "Content-Type": "application/json" });
      const res = await fetch(`/api/loyalty/${targetMemberId}/stamps`, {
        method: "POST",
        headers,
        body: JSON.stringify({ stamps, reason: "Manual stamp add" }),
      });
      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errJson.error || `Server returned error (${res.status})`);
      }
      const json = await res.json();
      toast({ title: `+${stamps} stamp added to ${member.name}!` });
      setUndoStack((prev) => [...prev, { memberId: targetMemberId, stamps }]);
      setRedoStack([]);
      refetch();

      if (json.member) {
        setSelected(json.member);
      } else {
        const memberRes = await fetch(`/api/loyalty/${targetMemberId}`, {
          headers,
        });
        if (memberRes.ok) {
          const memberData = await memberRes.json();
          if (memberData.member) {
            setSelected(memberData.member);
          }
        }
      }
    } catch (err: unknown) {
      console.error("Direct add stamp error:", err);
      toast({
        title: "Failed to add stamp",
        description: err instanceof Error ? err.message : "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleUndoStamp() {
    if (undoStack.length === 0 || saving || !selected) return;
    const lastAction = undoStack[undoStack.length - 1];
    if (lastAction.memberId !== selected.id) return;

    setSaving(true);
    try {
      const headers = await getAuthHeaders({ "Content-Type": "application/json" });
      const res = await fetch(`/api/loyalty/${selected.id}/stamps`, {
        method: "POST",
        headers,
        body: JSON.stringify({ stamps: -lastAction.stamps, reason: "Undo stamp" }),
      });
      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errJson.error || "Failed to undo stamp");
      }
      const json = await res.json();
      toast({ title: `Undid +${lastAction.stamps} stamp for ${selected.name}` });
      setUndoStack((prev) => prev.slice(0, -1));
      setRedoStack((prev) => [...prev, lastAction]);
      refetch();

      if (json.member) {
        setSelected(json.member);
      } else {
        const memberRes = await fetch(`/api/loyalty/${selected.id}`, { headers });
        if (memberRes.ok) {
          const memberData = await memberRes.json();
          if (memberData.member) {
            setSelected(memberData.member);
          }
        }
      }
    } catch (err: unknown) {
      toast({
        title: "Failed to undo stamp",
        description: err instanceof Error ? err.message : "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleRedoStamp() {
    if (redoStack.length === 0 || saving || !selected) return;
    const nextAction = redoStack[redoStack.length - 1];
    if (nextAction.memberId !== selected.id) return;

    setSaving(true);
    try {
      const headers = await getAuthHeaders({ "Content-Type": "application/json" });
      const res = await fetch(`/api/loyalty/${selected.id}/stamps`, {
        method: "POST",
        headers,
        body: JSON.stringify({ stamps: nextAction.stamps, reason: "Redo stamp" }),
      });
      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errJson.error || "Failed to redo stamp");
      }
      const json = await res.json();
      toast({ title: `Redid +${nextAction.stamps} stamp for ${selected.name}` });
      setRedoStack((prev) => prev.slice(0, -1));
      setUndoStack((prev) => [...prev, nextAction]);
      refetch();

      if (json.member) {
        setSelected(json.member);
      } else {
        const memberRes = await fetch(`/api/loyalty/${selected.id}`, { headers });
        if (memberRes.ok) {
          const memberData = await memberRes.json();
          if (memberData.member) {
            setSelected(memberData.member);
          }
        }
      }
    } catch (err: unknown) {
      toast({
        title: "Failed to redo stamp",
        description: err instanceof Error ? err.message : "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function _handleAddStamps(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!stampModal) return;
    setSaving(true);
    const form = e.currentTarget;
    const data = new FormData(form);
    const stamps = parseInt(data.get("stamps") as string) || 1;
    const reason = (data.get("reason") as string) || "Manual entry";
    const targetMemberId = stampModal.id;

    try {
      const res = await fetch(`/api/loyalty/${targetMemberId}/stamps`, {
        method: "POST",
        headers: await getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ stamps, reason }),
      });
      if (!res.ok) throw new Error("Failed to add stamps");
      const json = await res.json();
      toast({ title: "Stamps added successfully" });
      setStampModal(null);
      refetch();

      if (json.member) {
        setSelected(json.member);
      } else {
        const memberRes = await fetch(`/api/loyalty/${targetMemberId}`, {
          headers: await getAuthHeaders(),
        });
        if (memberRes.ok) {
          const memberData = await memberRes.json();
          if (memberData.member) {
            setSelected(memberData.member);
          }
        }
      }
    } catch {
      toast({ title: "Failed to add stamps", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveLoyaltyConfig(updated: Partial<LoyaltySettings>) {
    const next = { ...loyaltyConfig, ...updated };
    setLoyaltyConfig(next);
    persistLoyaltySettings(next);
    toast({ title: "Loyalty settings saved" });
  }

  function handleRedeemReward(rewardTitle: string, memberName: string = "Walk-in Member") {
    const item = {
      id: Math.random().toString(),
      name: rewardTitle,
      memberName,
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    };
    setRedeemedRewards((prev) => [item, ...prev]);
    toast({ title: `Redeemed: ${rewardTitle} for ${memberName}!` });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MEMBER DRILLDOWN VIEW (Step 2)
  // ─────────────────────────────────────────────────────────────────────────────
  if (selected) {
    const currentCycleStamps = selected.stampCount % washesPerReward;
    const stampsUntilReward = washesPerReward - currentCycleStamps;
    const progressPct = Math.min(100, (currentCycleStamps / washesPerReward) * 100);
    const canUndo = undoStack.some((a) => a.memberId === selected.id);
    const canRedo = redoStack.some((a) => a.memberId === selected.id);

    // Matching laundry transactions for this member
    const memberPhoneClean = (selected.phone || "").replace(/\D/g, "");
    const memberNameLower = selected.name.trim().toLowerCase();
    const effectiveTxns = transactions && transactions.length > 0 ? transactions : seedTransactions;
    const matchingTxns = effectiveTxns.filter((t) => {
      const tPhoneClean = (t.phone || "").replace(/\D/g, "");
      if (memberPhoneClean && tPhoneClean && memberPhoneClean === tPhoneClean) return true;
      if (t.customerName && t.customerName.trim().toLowerCase() === memberNameLower) return true;
      return false;
    });

    const totalKg = matchingTxns.reduce((acc, t) => acc + (t.weight || 0), 0).toFixed(1);
    const totalVisits = Math.max(matchingTxns.length, selected.stampCount);

    return (
      <div className="space-y-5">
        {/* Header navigation */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Members & Rewards</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Manage loyalty members and track rewards</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border mb-3 gap-1">
          <button
            onClick={() => setSelected(null)}
            className="px-4 py-2.5 text-sm font-semibold border-b-2 border-primary text-primary transition-colors cursor-pointer"
          >
            Members
          </button>
          <button
            onClick={() => {
              setSelected(null);
              setActiveTab("rewards");
            }}
            className="px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Rewards
          </button>
        </div>

        {/* Back Button */}
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelected(null)}
            className="gap-1.5 text-xs h-8 px-3 rounded-lg"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back
          </Button>
        </div>

        {/* Member Profile Overview Card */}
        <Card className="border border-border shadow-xs bg-card">
          <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center text-base shrink-0 shadow-xs">
                {getInitials(selected.name)}
              </div>
              <div className="space-y-1">
                <h2 className="font-bold text-base text-foreground leading-tight">{selected.name}</h2>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span>{selected.phone || "No phone provided"}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="inline-flex items-center rounded-full bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 text-xs font-semibold">
                    {currentCycleStamps}/{washesPerReward} stamps
                  </span>
                  <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-xs font-semibold">
                    {selected.rewardsRedeemed} rewards
                  </span>
                  <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold">
                    {totalVisits} visits • {totalKg} kg
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setQrModal(selected)}
                className="gap-1.5 text-xs h-9 px-3 rounded-lg cursor-pointer"
                title="View Member QR Status & Public Link"
              >
                <QrCode className="w-3.5 h-3.5 text-primary" /> QR Status
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={saving || !canUndo}
                onClick={handleUndoStamp}
                className="gap-1.5 text-xs h-9 px-3 rounded-lg cursor-pointer"
                title="Undo last stamp added"
              >
                <Undo2 className="w-3.5 h-3.5" /> Undo
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={saving || !canRedo}
                onClick={handleRedoStamp}
                className="gap-1.5 text-xs h-9 px-3 rounded-lg cursor-pointer"
                title="Redo undone stamp"
              >
                <Redo2 className="w-3.5 h-3.5" /> Redo
              </Button>
              <Button
                size="sm"
                disabled={saving}
                onClick={() => handleDirectAddStamp(selected, 1)}
                className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg h-9 px-4 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Stamp
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Current Cycle Progress Card */}
        <Card className="border border-border shadow-xs bg-card">
          <CardHeader className="pb-3 border-b border-border/60">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-500" /> Current Reward Progress
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Earn {stampsUntilReward} more stamp{stampsUntilReward !== 1 ? "s" : ""} to unlock a <span className="font-semibold text-foreground">{rewardName}</span>!
                </CardDescription>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
                {currentCycleStamps} / {washesPerReward}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 space-y-4">
            {/* Remaining Laundries Banner */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Gift className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <p className="text-xs font-bold text-foreground sm:text-sm">
                    {stampsUntilReward > 0
                      ? `Only ${stampsUntilReward} more ${stampsUntilReward === 1 ? 'laundry' : 'laundries'} remaining before ${rewardName}!`
                      : `🎉 Reward Unlocked! Customer can claim a ${rewardName}!`}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {stampsUntilReward > 0
                      ? `${currentCycleStamps} of ${washesPerReward} laundries completed in this cycle. Next reward unlocks at stamp #${(Math.floor(selected.stampCount / washesPerReward) + 1) * washesPerReward}.`
                      : `Ready to claim at checkout or claim verification.`}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setQrModal(selected)}
                className="h-8 text-xs gap-1.5 shrink-0 bg-background cursor-pointer self-start sm:self-auto"
              >
                <QrCode className="w-3.5 h-3.5 text-primary" /> View QR Status
              </Button>
            </div>

            <StampDots count={currentCycleStamps} max={washesPerReward} />
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-300 rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Laundry Records Table */}
        <Card className="border border-border shadow-xs bg-card overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/60">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" /> Laundry Records & History
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Laundry visits and records tracked for this member
                </CardDescription>
              </div>
              <span className="text-xs font-semibold text-muted-foreground">
                {matchingTxns.length > 0 ? `${matchingTxns.length} laundry records` : `${selected.stampHistory?.length || 0} visits`}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                    <th className="px-4 py-2.5">Date In</th>
                    <th className="px-4 py-2.5">Date Claimed</th>
                    <th className="px-4 py-2.5">Ticket</th>
                    <th className="px-4 py-2.5">Service</th>
                    <th className="px-4 py-2.5">KG</th>
                    <th className="px-4 py-2.5">Reward</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {matchingTxns.length > 0 ? (
                    matchingTxns.map((t, i) => {
                      const isReward = t.fee === 0 || (t.washInstructions || "").toLowerCase().includes("reward");
                      return (
                        <tr key={t.ticketId || i} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{formatReadableDateTime(t.arrivalDateTime) || t.arrivalDateTime || t.dropOffDate}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {t.status === "Claimed" ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> {formatReadableDateTime(t.claimedAt || t.updatedAt || t.arrivalDateTime) || t.claimedAt || t.updatedAt || t.arrivalDateTime}
                              </span>
                            ) : t.status === "Ready" ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Ready</span>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400">In Progress</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-primary font-medium">{t.ticketId}</td>
                          <td className="px-4 py-2.5 font-medium text-foreground">{t.washType}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{t.weight} kg</td>
                          <td className="px-4 py-2.5 font-semibold">
                            {isReward ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Yes
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : selected.stampHistory && selected.stampHistory.length > 0 ? (
                    selected.stampHistory.map((h, i) => (
                      <tr key={i} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{h.date}</td>
                        <td className="px-4 py-2.5 text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> {h.date}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-primary font-medium">{h.ticket}</td>
                        <td className="px-4 py-2.5 font-medium text-foreground">Regular Wash</td>
                        <td className="px-4 py-2.5 text-muted-foreground">—</td>
                        <td className="px-4 py-2.5 font-semibold text-emerald-600 dark:text-emerald-400">+{h.stamps} stamp</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-muted-foreground">
                        No laundry records found for this member yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Reward Redemption History */}
        <Card className="border border-border shadow-xs bg-card overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Award className="w-4 h-4 text-primary" /> Redeemed Rewards History
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Recent rewards claimed and redeemed by this member
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                    <th className="px-4 py-2.5">Date Redeemed</th>
                    <th className="px-4 py-2.5">Reward Unlocked</th>
                    <th className="px-4 py-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {selected.rewardHistory && selected.rewardHistory.length > 0 ? (
                    selected.rewardHistory.map((r, i) => (
                      <tr key={i} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{r.date}</td>
                        <td className="px-4 py-2.5 font-semibold text-foreground">{r.reward}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" /> Claimed
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="text-center py-6 text-muted-foreground">
                        No rewards claimed yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN MEMBERS & REWARDS VIEW (Step 1)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <Skeleton name="loyalty-members" loading={loading}>
      <div className="space-y-5">
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MOBILE CONCEPT VIEW (< md)                                          */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="space-y-4 md:hidden">
        {/* Header & Add Member Button */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Members & Rewards</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Manage customer loyalty points, rewards, and program rules</p>
          </div>
          {activeTab === "members" && (
            <Button
              size="sm"
              onClick={() => setAddModal(true)}
              className="h-9 px-3.5 rounded-full bg-primary text-primary-foreground font-semibold text-xs shadow-xs gap-1.5 shrink-0 hover:bg-primary/90 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Member</span>
            </Button>
          )}
        </div>

        {/* Segmented Navigation Tabs */}
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/50 p-1 border border-border">
          <button
            type="button"
            onClick={() => setActiveTab("members")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer",
              activeTab === "members"
                ? "bg-card text-foreground shadow-xs border border-border/50"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Star className={cn("w-3.5 h-3.5", activeTab === "members" ? "fill-primary text-primary" : "")} />
            <span>Members</span>
            <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] font-bold text-primary">
              {totalMembers}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("rewards")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer",
              activeTab === "rewards"
                ? "bg-card text-foreground shadow-xs border border-border/50"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Award className="w-3.5 h-3.5 text-primary" />
            <span>Rewards & Rules</span>
          </button>
        </div>

        {/* 3 Key Metrics Cards */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {/* Total Members */}
          <div className="rounded-xl border border-border bg-card p-3 shadow-xs flex flex-col justify-between">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-1.5">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xl font-extrabold text-foreground block">{totalMembers}</span>
              <span className="text-[11px] text-muted-foreground font-medium truncate block">Total Members</span>
            </div>
          </div>

          {/* Stamps Issued */}
          <div className="rounded-xl border border-border bg-card p-3 shadow-xs flex flex-col justify-between">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-1.5">
              <Star className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xl font-extrabold text-foreground block">{totalStampsIssued}</span>
              <span className="text-[11px] text-muted-foreground font-medium truncate block">Stamps Issued</span>
            </div>
          </div>

          {/* Claimed */}
          <div className="rounded-xl border border-border bg-card p-3 shadow-xs flex flex-col justify-between">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-1.5">
              <Gift className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xl font-extrabold text-foreground block">{totalRewardsRedeemed}</span>
              <span className="text-[11px] text-muted-foreground font-medium truncate block">Claimed</span>
            </div>
          </div>
        </div>

        {activeTab === "members" ? (
          <div className="space-y-3">
            {/* Filter & View Controls */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search member name or phone..."
                  aria-label="Search member name or phone"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-8 h-10 text-xs rounded-xl bg-card border-border w-full"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-0.5 border border-border rounded-xl p-0.5 bg-card shrink-0">
                <button
                  type="button"
                  aria-label="Card View"
                  onClick={() => setViewMode("cards")}
                  className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center transition-all cursor-pointer",
                    viewMode === "cards" ? "bg-muted text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="Table View"
                  onClick={() => setViewMode("table")}
                  className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center transition-all cursor-pointer",
                    viewMode === "table" ? "bg-muted text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <TableIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Active Shop Campaign Micro-Banner */}
            <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-primary text-white rounded-2xl p-3.5 shadow-xs relative overflow-hidden flex items-center justify-between">
              <div className="relative z-10 pr-2 space-y-0.5">
                <div className="flex items-center gap-1.5 text-purple-200 text-[10px] font-bold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Active Shop Campaign</span>
                </div>
                <h4 className="font-bold text-sm leading-tight text-white">
                  {washesPerReward} Stamps = 1 {rewardName}
                </h4>
                <p className="text-[11px] text-purple-100/90 leading-tight">
                  Auto-redeemed at checkout on standard cycles
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20">
                <Award className="w-5 h-5 text-white" />
              </div>
            </div>

            {/* Members List */}
            {loading ? (
              <div className="py-12 text-center text-xs text-muted-foreground">Loading members...</div>
            ) : filteredMembers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 bg-card p-8 text-center">
                <Award className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs font-semibold text-foreground">No loyalty members found</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Try searching for another name/phone or add a new member
                </p>
              </div>
            ) : viewMode === "cards" ? (
              <div className="space-y-3">
                {filteredMembers.map((member) => (
                  <MobileLoyaltyMemberCard
                    key={member.id}
                    member={member}
                    washesPerReward={washesPerReward}
                    rewardName={rewardName}
                    saving={saving}
                    onSelect={setSelected}
                    onEdit={setEditModal}
                    onDelete={setDeleteModal}
                    onQr={setQrModal}
                    onAddStamp={handleDirectAddStamp}
                  />
                ))}
              </div>
            ) : (
              <Card className="overflow-hidden border border-border shadow-xs bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                        <th className="px-3 py-2.5">Member</th>
                        <th className="px-3 py-2.5">Phone</th>
                        <th className="px-3 py-2.5">Stamps</th>
                        <th className="px-3 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {filteredMembers.map((member) => (
                        <tr key={member.id} className="hover:bg-muted/30 transition-colors">
                          <td
                            className="px-3 py-2.5 font-semibold text-foreground cursor-pointer"
                            onClick={() => setSelected(member)}
                          >
                            {member.name}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">{member.phone || "—"}</td>
                          <td className="px-3 py-2.5 font-medium text-primary">
                            {member.stampCount % washesPerReward}/{washesPerReward}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs px-2"
                                onClick={() => setSelected(member)}
                              >
                                View
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-primary text-primary-foreground px-2"
                                onClick={() => handleDirectAddStamp(member, 1)}
                                disabled={saving}
                              >
                                +1
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        ) : (
          /* Mobile Rewards & Rules Tab */
          <div className="space-y-4">
            {/* Rules Configuration */}
            <Card className="border border-border shadow-xs bg-card">
              <CardHeader className="pb-3 border-b border-border/60">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> Loyalty Program Configuration
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Configure how customers earn stamps and unlock rewards
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="mobile-washesPerReward" className="text-xs">Stamps Required for Reward</Label>
                  <Input
                    id="mobile-washesPerReward"
                    type="number"
                    min="1"
                    max="50"
                    value={loyaltyConfig.washesPerReward}
                    onChange={(e) => setLoyaltyConfig({ ...loyaltyConfig, washesPerReward: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="mobile-rewardDescription" className="text-xs">Reward Description</Label>
                  <Input
                    id="mobile-rewardDescription"
                    type="text"
                    value={loyaltyConfig.rewardDescription}
                    onChange={(e) => setLoyaltyConfig({ ...loyaltyConfig, rewardDescription: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>

                <Button
                  size="sm"
                  onClick={() => handleSaveLoyaltyConfig(loyaltyConfig)}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-9 cursor-pointer"
                >
                  Save Configuration
                </Button>
              </CardContent>
            </Card>

            {/* Active Reward Perks */}
            <Card className="border border-border shadow-xs bg-card">
              <CardHeader className="pb-3 border-b border-border/60">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Gift className="w-4 h-4 text-primary" /> Active Reward Perks
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Perks automatically rewarded upon cycle completion
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="border border-border rounded-xl p-3 bg-muted/20 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Gift className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-foreground">{loyaltyConfig.rewardDescription || "Free Wash"}</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Unlocked after {washesPerReward} verified stamps</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRedeemReward(loyaltyConfig.rewardDescription || "Free Wash")}
                    className="text-xs h-8 px-2.5"
                  >
                    Simulate
                  </Button>
                </div>

                {redeemedRewards.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs font-semibold text-foreground mb-1.5">Recent Redemptions</p>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {redeemedRewards.map((r) => (
                        <div key={r.id} className="text-[11px] flex items-center justify-between border-b border-border/50 pb-1 text-muted-foreground">
                          <span className="truncate">{r.name} ({r.memberName})</span>
                          <span className="font-mono text-[10px] shrink-0">{r.date}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* DESKTOP VIEW (>= md)                                                */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="hidden md:block space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Members & Rewards</h1>
            <p className="text-xs text-muted-foreground sm:text-sm mt-0.5">Manage customer loyalty points, rewards, and program rules</p>
          </div>
          {activeTab === "members" && (
            <Button
              size="sm"
              onClick={() => setAddModal(true)}
              className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Member
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border gap-1">
          <button
            onClick={() => setActiveTab("members")}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === "members"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Members
          </button>
          <button
            onClick={() => setActiveTab("rewards")}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === "rewards"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Rewards & Rules
          </button>
        </div>

        {/* Top 3 Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <Card className="border border-border shadow-xs bg-card">
            <CardContent className="p-4 flex items-center gap-3.5">
              <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Members</p>
                <h3 className="text-xl font-bold text-foreground">{totalMembers}</h3>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border shadow-xs bg-card">
            <CardContent className="p-4 flex items-center gap-3.5">
              <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Star className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Stamps Issued</p>
                <h3 className="text-xl font-bold text-foreground">{totalStampsIssued}</h3>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border shadow-xs bg-card">
            <CardContent className="p-4 flex items-center gap-3.5">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Gift className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Rewards Claimed</p>
                <h3 className="text-xl font-bold text-foreground">{totalRewardsRedeemed}</h3>
              </div>
            </CardContent>
          </Card>
        </div>

        {activeTab === "members" ? (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-card border border-border rounded-xl p-3 md:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search member name or phone…"
                  aria-label="Search member name or phone"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-xs w-full"
                />
              </div>
              <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-muted/30 shrink-0">
                <Button
                  variant={viewMode === "cards" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("cards")}
                  className="h-8 px-2.5 text-xs gap-1.5"
                >
                  <LayoutGrid className="w-3.5 h-3.5" /> Cards
                </Button>
                <Button
                  variant={viewMode === "table" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("table")}
                  className="h-8 px-2.5 text-xs gap-1.5"
                >
                  <TableIcon className="w-3.5 h-3.5" /> Table
                </Button>
              </div>
            </div>

            {/* Members Grid or Table */}
            {loading ? (
              <div className="py-16 text-center text-xs text-muted-foreground">Loading members...</div>
            ) : filteredMembers.length === 0 ? (
              <Card className="p-12 text-center border-dashed">
                <Award className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-semibold text-foreground">No loyalty members found</p>
                <p className="text-xs text-muted-foreground mt-1">Add your first member to begin tracking stamps!</p>
              </Card>
            ) : viewMode === "cards" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredMembers.map((member) => {
                  const currentStamps = member.stampCount % washesPerReward;
                  const pct = Math.min(100, (currentStamps / washesPerReward) * 100);

                  return (
                    <Card
                      key={member.id}
                      className="border border-border/80 hover:border-primary/50 transition-all bg-card shadow-xs group"
                    >
                      <CardContent className="p-4 space-y-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div
                            className="flex items-center gap-3 min-w-0 cursor-pointer"
                            onClick={() => setSelected(member)}
                          >
                            <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center text-sm shrink-0 shadow-xs">
                              {getInitials(member.name)}
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                                {member.name}
                              </h3>
                              <p className="text-xs text-muted-foreground truncate">{member.phone || "No phone"}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Edit ${member.name}`}
                              className="h-8 w-8 min-h-[32px] min-w-[32px] text-muted-foreground hover:text-foreground cursor-pointer"
                              onClick={() => setEditModal(member)}
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete ${member.name}`}
                              className="h-8 w-8 min-h-[32px] min-w-[32px] text-muted-foreground hover:text-destructive cursor-pointer"
                              onClick={() => setDeleteModal(member)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Progress Bar & Details */}
                        <div className="space-y-1.5 cursor-pointer" onClick={() => setSelected(member)}>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-primary">{currentStamps}/{washesPerReward} Stamps</span>
                            <span className="text-muted-foreground text-[11px]">{member.rewardsRedeemed} Rewards</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-primary h-full transition-all duration-300 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            aria-label={`View QR status for ${member.name}`}
                            onClick={() => setQrModal(member)}
                            className="h-8 text-xs px-2.5 cursor-pointer gap-1"
                            title="View Member QR Status & Public Link"
                          >
                            <QrCode className="w-3.5 h-3.5 text-primary" /> QR
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelected(member)}
                            className="flex-1 text-xs h-8 cursor-pointer"
                          >
                            View Details
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleDirectAddStamp(member, 1)}
                            disabled={saving}
                            className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90 px-3 cursor-pointer"
                          >
                            + Add Stamp
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="overflow-hidden border border-border shadow-xs bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                        <th className="px-4 py-3">Member Name</th>
                        <th className="px-4 py-3">Phone</th>
                        <th className="px-4 py-3">Current Cycle</th>
                        <th className="px-4 py-3">Total Stamps</th>
                        <th className="px-4 py-3">Rewards</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {filteredMembers.map((member) => (
                        <tr key={member.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-semibold text-foreground cursor-pointer" onClick={() => setSelected(member)}>
                            {member.name}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{member.phone || "—"}</td>
                          <td className="px-4 py-3 font-medium text-primary">
                            {member.stampCount % washesPerReward}/{washesPerReward}
                          </td>
                          <td className="px-4 py-3 text-foreground">{member.stampCount}</td>
                          <td className="px-4 py-3 text-foreground">{member.rewardsRedeemed}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                aria-label={`View QR status for ${member.name}`}
                                className="h-7 text-xs px-2"
                                onClick={() => setQrModal(member)}
                                title="View Member QR Status"
                              >
                                <QrCode className="w-3 h-3 text-primary" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs px-2.5"
                                onClick={() => setSelected(member)}
                              >
                                View
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-primary text-primary-foreground px-2.5"
                                onClick={() => handleDirectAddStamp(member, 1)}
                                disabled={saving}
                              >
                                + Stamp
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        ) : (
          /* Rewards & Rules Tab */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Rules Configuration */}
            <Card className="border border-border shadow-xs bg-card">
              <CardHeader className="pb-3 border-b border-border/60">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> Loyalty Program Configuration
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Configure how customers earn stamps and unlock rewards
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="washesPerReward" className="text-xs">Stamps Required for Reward</Label>
                  <Input
                    id="washesPerReward"
                    type="number"
                    min="1"
                    max="50"
                    value={loyaltyConfig.washesPerReward}
                    onChange={(e) => setLoyaltyConfig({ ...loyaltyConfig, washesPerReward: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="rewardDescription" className="text-xs">Reward Description</Label>
                  <Input
                    id="rewardDescription"
                    type="text"
                    value={loyaltyConfig.rewardDescription}
                    onChange={(e) => setLoyaltyConfig({ ...loyaltyConfig, rewardDescription: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>

                <Button
                  size="sm"
                  onClick={() => handleSaveLoyaltyConfig(loyaltyConfig)}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-9 cursor-pointer"
                >
                  Save Configuration
                </Button>
              </CardContent>
            </Card>

            {/* Reward Catalog Preview */}
            <Card className="border border-border shadow-xs bg-card">
              <CardHeader className="pb-3 border-b border-border/60">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Gift className="w-4 h-4 text-primary" /> Active Reward Perks
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Perks automatically rewarded upon cycle completion
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 space-y-3">
                <div className="border border-border rounded-xl p-3.5 bg-muted/20 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Gift className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-foreground">{loyaltyConfig.rewardDescription || "Free Wash"}</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Unlocked after {washesPerReward} verified stamps</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRedeemReward(loyaltyConfig.rewardDescription || "Free Wash")}
                    className="text-xs h-8"
                  >
                    Simulate Redeem
                  </Button>
                </div>

                {redeemedRewards.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs font-semibold text-foreground mb-2">Recent Redemptions</p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {redeemedRewards.map((r) => (
                        <div key={r.id} className="text-[11px] flex items-center justify-between border-b border-border/50 pb-1.5 text-muted-foreground">
                          <span>{r.name} ({r.memberName})</span>
                          <span className="font-mono">{r.date}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      <Dialog open={addModal} onOpenChange={setAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Loyalty Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddMember} className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="preferences">Preferences</Label>
              <Textarea id="preferences" name="preferences" className="mt-1" rows={3} />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setAddModal(false)}>Cancel</Button>
              <Button type="submit" className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" disabled={saving}>{saving ? "Adding..." : "Add Member"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Member Modal */}
      <Dialog open={!!editModal} onOpenChange={(open) => !open && setEditModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateMember} className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Name *</Label>
              <Input id="edit-name" name="name" defaultValue={editModal?.name} required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="edit-phone">Phone</Label>
              <Input id="edit-phone" name="phone" defaultValue={editModal?.phone} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="edit-preferences">Preferences</Label>
              <Textarea id="edit-preferences" name="preferences" defaultValue={editModal?.preferences} className="mt-1" rows={3} />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setEditModal(null)}>Cancel</Button>
              <Button type="submit" className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteModal} onOpenChange={(open) => !open && setDeleteModal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteModal?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMember} disabled={saving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {saving ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reward Cycle Dialog */}
      <Dialog open={!!rewardCycleModal} onOpenChange={(open) => !open && setRewardCycleModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reward Cycle Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2 text-xs">
            <p><span className="font-semibold text-foreground">Date:</span> {rewardCycleModal?.date}</p>
            <p><span className="font-semibold text-foreground">Reward:</span> {rewardCycleModal?.reward}</p>
            <p className="text-muted-foreground">This reward was successfully earned after achieving {washesPerReward} qualifying stamps.</p>
            <Button variant="outline" className="w-full mt-2" onClick={() => setRewardCycleModal(null)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Member QR Status Dialog */}
      <Dialog
        open={!!qrModal}
        onOpenChange={(open) => {
          if (!open) {
            setQrModal(null);
            setCopiedLink(false);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary" /> Member QR & Status Card
            </DialogTitle>
          </DialogHeader>
          {qrModal && (() => {
            const memberCode = qrModal.id.startsWith("MEM-") ? qrModal.id : `MEM-${qrModal.id.slice(-6).toUpperCase()}`;
            const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/member/${qrModal.id}` : `/member/${qrModal.id}`;
            const cycleStamps = qrModal.stampCount % washesPerReward;
            const remaining = washesPerReward - cycleStamps;
            const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(publicUrl)}`;

            return (
              <div className="space-y-4 pt-2">
                <div className="flex flex-col items-center justify-center p-4 bg-muted/40 rounded-xl border border-border">
                  <div className="bg-white p-3 rounded-xl shadow-xs border border-border/80">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrImageUrl}
                      alt={`QR code for ${qrModal.name}`}
                      className="w-44 h-44 object-contain rounded"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 font-mono">{memberCode}</p>
                </div>

                <div className="space-y-1 text-center">
                  <h3 className="font-bold text-base text-foreground">{qrModal.name}</h3>
                  <p className="text-xs text-muted-foreground">{qrModal.phone || "No phone registered"}</p>
                </div>

                {/* Remaining Laundries Banner */}
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-center space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-primary">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{cycleStamps} of {washesPerReward} washes collected</span>
                  </div>
                  <p className="text-sm font-bold text-foreground">
                    Only <span className="text-primary underline decoration-primary/40 underline-offset-2">{remaining} more {remaining === 1 ? "laundry" : "laundries"}</span> remaining before your <span className="font-bold">{rewardName}</span>!
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={() => {
                      if (typeof navigator !== "undefined" && navigator.clipboard) {
                        navigator.clipboard.writeText(publicUrl);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2000);
                      }
                    }}
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy Link
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    className="gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => {
                      window.open(`/member/${qrModal.id}`, "_blank");
                    }}
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open Page
                  </Button>
                </div>

                <p className="text-[11px] text-muted-foreground text-center">
                  Customers can scan this QR code anytime to view their stamp progress, laundry order history, and claimed rewards.
                </p>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
    </Skeleton>
  );
}
