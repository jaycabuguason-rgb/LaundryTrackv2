"use client";

import { useState } from "react";
import { Search, ChevronLeft, Star, X, AlertTriangle, Plus, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useLoyaltyMembers } from "@/hooks/use-loyalty-members";
import { type LoyaltyMember } from "@/lib/data";
import { toast } from "@/hooks/use-toast";
import { getBrowserAccessToken, refreshBrowserSession } from "@/lib/supabase/browser-session";

function StampDots({ count, max = 21 }: { count: number; max?: number }) {
  return (
    <div className="flex flex-wrap gap-1 mt-2 max-w-xs">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`w-4 h-4 rounded-full border ${i < count ? "bg-yellow-400 border-yellow-500" : "bg-muted border-border"}`}
        />
      ))}
    </div>
  );
}

export default function LoyaltyPage({ loyaltyEnabled = true }: { loyaltyEnabled?: boolean }) {
  const { members, loading, refetch } = useLoyaltyMembers();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<LoyaltyMember | null>(null);
  const [rewardCycleModal, setRewardCycleModal] = useState<{ date: string; reward: string } | null>(null);
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState<LoyaltyMember | null>(null);
  const [deleteModal, setDeleteModal] = useState<LoyaltyMember | null>(null);
  const [stampModal, setStampModal] = useState<LoyaltyMember | null>(null);
  const [saving, setSaving] = useState(false);

  // Loyalty config - in real app this would come from settings
  const washesPerReward = 10;
  const rewardName = "Free wash";

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

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.phone && m.phone.includes(search))
  );

  async function handleSelectMember(m: LoyaltyMember) {
    setSelected(m);
    try {
      const res = await fetch(`/api/loyalty/${m.id}`, {
        headers: await getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.member) setSelected(data.member);
      }
    } catch (e) {
      console.error("Failed to load member history", e);
    }
  }

  async function handleAddMember(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = e.currentTarget;
    const data = new FormData(form);
    try {
      const res = await fetch("/api/loyalty", {
        method: "POST",
        headers: await getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          name: data.get("name"),
          phone: data.get("phone"),
          preferences: data.get("preferences"),
        }),
      });
      if (!res.ok) throw new Error("Failed to add member");
      toast({ title: "Member added successfully" });
      setAddModal(false);
      form.reset();
      refetch();
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
    try {
      const res = await fetch(`/api/loyalty/${editModal.id}`, {
        method: "PATCH",
        headers: await getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          name: data.get("name"),
          phone: data.get("phone"),
          preferences: data.get("preferences"),
        }),
      });
      if (!res.ok) throw new Error("Failed to update member");
      toast({ title: "Member updated successfully" });
      setEditModal(null);
      refetch();
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
      refetch();
    } catch {
      toast({ title: "Failed to delete member", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleAddStamps(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!stampModal) return;
    setSaving(true);
    const form = e.currentTarget;
    const data = new FormData(form);
    const stamps = parseInt(data.get("stamps") as string);
    const reason = data.get("reason") as string;
    try {
      const res = await fetch(`/api/loyalty/${stampModal.id}/stamps`, {
        method: "POST",
        headers: await getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ stamps, reason }),
      });
      if (!res.ok) throw new Error("Failed to add stamps");
      toast({ title: "Stamps added successfully" });
      setStampModal(null);
      refetch();
    } catch {
      toast({ title: "Failed to add stamps", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (selected) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelected(null)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Members
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Profile Card */}
          <Card className="border border-border shadow-none">
            <CardContent className="p-5 text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-yellow-100 flex items-center justify-center mx-auto">
                <Star className="w-7 h-7 text-yellow-500" />
              </div>
              <h2 className="font-semibold text-base text-foreground">{selected.name}</h2>
              <p className="text-xs text-muted-foreground">{selected.phone}</p>
              <p className="text-xs text-muted-foreground">Joined: {selected.dateJoined}</p>
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">Total Stamps</p>
                <p className="text-3xl font-bold text-foreground">{selected.stampCount}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setStampModal(selected)} className="w-full">
                <Plus className="w-3 h-3 mr-1" /> Add Stamps
              </Button>
              <div>
                <p className="text-xs text-muted-foreground">Rewards Redeemed</p>
                <p className="text-xl font-bold text-yellow-600">{selected.rewardsRedeemed}</p>
              </div>
              {selected.preferences && (
                <div className="text-left bg-muted/30 rounded p-2 mt-1">
                  <p className="text-[11px] text-muted-foreground">Preferences</p>
                  <p className="text-xs text-foreground mt-0.5">{selected.preferences}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* History */}
          <div className="md:col-span-2 space-y-4">
            <Card className="border border-border shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Current Cycle Progress</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="px-4 py-3">
                  {(() => {
                    const currentCycleStamps = selected.stampCount % washesPerReward;
                    const stampsUntilReward = washesPerReward - currentCycleStamps;
                    return (
                      <>
                        <StampDots count={currentCycleStamps} max={washesPerReward} />
                        <p className="text-xs text-muted-foreground mt-2">
                          {stampsUntilReward} {stampsUntilReward === 1 ? "wash" : "washes"} until next {rewardName}
                        </p>
                      </>
                    );
                  })()}
                </div>
                <div className="divide-y divide-border md:hidden">
                  {(() => {
                    const currentCycleStamps = selected.stampCount % washesPerReward;
                    const currentCycleHistory = selected.stampHistory.slice(-currentCycleStamps);
                    if (currentCycleHistory.length === 0) {
                      return <div className="py-6 text-center text-xs text-muted-foreground">No stamps in current cycle</div>;
                    }
                    return currentCycleHistory.map((s, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground">{s.date}</p>
                          <p className="mt-0.5 font-mono text-[11px] text-primary">
                            {s.ticket}
                            {s.notes && <span className="ml-1 text-muted-foreground font-sans truncate">({s.notes})</span>}
                          </p>
                        </div>
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-semibold text-yellow-700">+{s.stamps}</span>
                      </div>
                    ));
                  })()}
                </div>
                <table className="hidden w-full text-sm md:table">
                  <thead>
                    <tr className="border-y border-border bg-muted/40">
                      {["Date", "Ticket", "Stamps"].map((h) => (
                        <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-2">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Only show stamps from current cycle (after last reward)
                      const currentCycleStamps = selected.stampCount % washesPerReward;
                      const currentCycleHistory = selected.stampHistory.slice(-currentCycleStamps);
                      
                      if (currentCycleHistory.length === 0) {
                        return <tr><td colSpan={3} className="text-center py-6 text-xs text-muted-foreground">No stamps in current cycle</td></tr>;
                      }
                      
                      return currentCycleHistory.map((s, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{s.date}</td>
                          <td className="px-4 py-2.5 text-xs font-mono text-primary">
                            {s.ticket}
                            {s.notes && <span className="ml-1 text-muted-foreground font-sans truncate">({s.notes})</span>}
                          </td>
                          <td className="px-4 py-2.5 text-xs font-medium">+{s.stamps}</td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Reward History</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border md:hidden">
                  {selected.rewardHistory.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">No rewards redeemed yet</div>
                  ) : (
                    selected.rewardHistory.map((r, i) => (
                      <button
                        key={i}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/20"
                        onClick={() => setRewardCycleModal(r)}
                      >
                        <span className="text-xs font-medium text-foreground">{r.date}</span>
                        <span className="truncate text-xs font-semibold text-green-700">{r.reward}</span>
                      </button>
                    ))
                  )}
                </div>
                <table className="hidden w-full text-sm md:table">
                  <thead>
                    <tr className="border-y border-border bg-muted/40">
                      {["Date", "Reward"].map((h) => (
                        <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-2">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selected.rewardHistory.length === 0 ? (
                      <tr><td colSpan={2} className="text-center py-6 text-xs text-muted-foreground">No rewards redeemed yet</td></tr>
                    ) : (
                      selected.rewardHistory.map((r, i) => (
                        <tr 
                          key={i} 
                          className="border-b border-border last:border-0 hover:bg-muted/20 cursor-pointer transition-colors"
                          onClick={() => setRewardCycleModal(r)}
                        >
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.date}</td>
                          <td className="px-4 py-2.5 text-xs font-medium text-green-700">{r.reward}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Reward Cycle Modal */}
        <Dialog open={!!rewardCycleModal} onOpenChange={(open) => !open && setRewardCycleModal(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base">
                Reward Cycle — {rewardCycleModal?.date}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {/* Cycle visits */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Visits in this cycle:</p>
                <div className="divide-y divide-border overflow-hidden rounded-lg border border-border md:hidden">
                  {Array.from({ length: washesPerReward }, (_, i) => ({
                    date: `2026-0${(i % 3) + 1}-${10 + i}`,
                    ticket: `TKT-00${70 + i}`,
                    stamps: 1,
                  })).map((v, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground">{v.date}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-primary">{v.ticket}</p>
                      </div>
                      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-semibold text-yellow-700">+{v.stamps}</span>
                    </div>
                  ))}
                </div>
                <table className="hidden w-full text-sm border border-border rounded-lg overflow-hidden md:table">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Date</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Ticket</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Stamps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Mock data - in real app, this would be stored per reward cycle
                      // For demo, show placeholder visits that would have led to this reward
                      const mockCycleVisits = Array.from({ length: washesPerReward }, (_, i) => ({
                        date: `2026-0${(i % 3) + 1}-${10 + i}`,
                        ticket: `TKT-00${70 + i}`,
                        stamps: 1,
                      }));
                      
                      return mockCycleVisits.map((v, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="px-3 py-2 text-xs text-muted-foreground">{v.date}</td>
                          <td className="px-3 py-2 text-xs font-mono text-primary">{v.ticket}</td>
                          <td className="px-3 py-2 text-xs font-medium">+{v.stamps}</td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1">
                <p className="text-xs text-green-700">
                  <span className="font-semibold">Total stamps in cycle:</span> {washesPerReward}
                </p>
                <p className="text-xs text-green-700">
                  <span className="font-semibold">Reward received:</span> {rewardCycleModal?.reward}
                </p>
              </div>

              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => setRewardCycleModal(null)}
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Disabled Banner */}
      {!loyaltyEnabled && (
        <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-300 text-yellow-900 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-yellow-600" />
          <div className="space-y-0.5">
            <p className="text-sm font-semibold">Loyalty Program is currently disabled.</p>
            <p className="text-xs text-yellow-800">
              New transactions will not earn stamps. Go to Settings &rarr; Loyalty Program to re-enable.
            </p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Button size="sm" onClick={() => setAddModal(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add Member
        </Button>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap gap-4">
        <Card className="border border-border shadow-none w-full max-w-xs">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{loading ? "..." : members.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total Members</p>
          </CardContent>
        </Card>

      </div>

      {/* Members Table */}
      <Card className="border border-border shadow-none">
        <CardContent className="p-0">
          <div className="divide-y divide-border md:hidden">
            {filtered.map((m) => (
              <div key={m.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{m.name}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{m.phone || "-"}</p>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleSelectMember(m)}>
                    View
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/30 p-3">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Stamps</p>
                    <div className="mt-1 flex items-center gap-1">
                      <Star className="h-3 w-3 text-yellow-500" />
                      <span className="text-sm font-semibold text-foreground">{m.stampCount}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Rewards</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{m.rewardsRedeemed}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Joined</p>
                    <p className="mt-1 truncate text-xs text-foreground">{m.dateJoined}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-8 flex-1 text-xs" onClick={() => setEditModal(m)}>
                    <Edit className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 flex-1 text-xs text-red-600 hover:text-red-700" onClick={() => setDeleteModal(m)}>
                    <Trash2 className="mr-1 h-3 w-3" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}
            {loading && (
              <div className="py-10 text-center text-sm text-muted-foreground">Loading...</div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">No members found.</div>
            )}
          </div>

          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {["Name", "Phone", "Stamps", "Rewards Redeemed", "Date Joined", ""].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-xs font-semibold text-foreground">
                    {m.name}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{m.phone}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Star className="w-3 h-3 text-yellow-500" />
                      <span className="text-xs font-semibold text-foreground">{m.stampCount}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{m.rewardsRedeemed}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{m.dateJoined}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleSelectMember(m)}>
                        View
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditModal(m)}>
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600 hover:text-red-700" onClick={() => setDeleteModal(m)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {loading && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-sm text-muted-foreground">Loading...</td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-sm text-muted-foreground">No members found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

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
              <Button type="submit" className="flex-1" disabled={saving}>{saving ? "Adding..." : "Add Member"}</Button>
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
              <Button type="submit" className="flex-1" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
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
            <AlertDialogAction onClick={handleDeleteMember} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Stamps Modal */}
      <Dialog open={!!stampModal} onOpenChange={(open) => !open && setStampModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Stamps</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddStamps} className="space-y-4">
            <div>
              <Label htmlFor="stamps">Number of Stamps *</Label>
              <Input id="stamps" name="stamps" type="number" min="1" defaultValue="1" required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Input id="reason" name="reason" type="text" placeholder="e.g. Promo, Apology, etc." className="mt-1" />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setStampModal(null)}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={saving}>{saving ? "Adding..." : "Add Stamps"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
