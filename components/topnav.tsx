"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Bell, ChevronDown, ChevronRight, User, Eye, X, KeyRound, LogOut, AlertTriangle, Menu, Moon, Sun, Circle, CircleDot, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initialNotifications, transactions, type Notification } from "@/lib/data";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type Page } from "@/components/sidebar";
import type { UserProfile } from "@/lib/auth";
import type { Transaction } from "@/lib/data";
import { getUserInitials, cn } from "@/lib/utils";
import { ConnectionDiagnosticsDialog } from "@/components/connection-diagnostics-dialog";

const pageTitles: Record<Page, string> = {
  dashboard: "Dashboard",
  processing: "Processing",
  transactions: "Transactions",
  "new-transaction": "New Order",
  "claim-verification": "Claim Verification",
  reports: "Reports",
  "settings-pricing": "Settings — Pricing",
  "settings-service-types": "Settings — Service Types",
  "settings-business-profile": "Settings — Business Profile",
  "settings-backup": "Settings — Backup & Restore",
  "settings-loyalty": "Settings — Loyalty Program",
  "staff-management": "Staff & Audit Logs",
  "audit-logs": "Staff & Audit Logs",
  loyalty: "Loyalty Members",
  profile: "My Profile",
  "change-password": "Change Password",
  "settings-data-import": "Settings — Data Import",
};

/** Groups notifications chronologically by date matching the reference notification design. */
function groupNotificationsByDate(items: Notification[]) {
  const map = new Map<string, Notification[]>();

  for (const item of items) {
    let d = new Date(item.createdAt);
    if (isNaN(d.getTime())) {
      d = new Date();
    }
    const dateKey = format(d, "yyyy-MM-dd");
    if (!map.has(dateKey)) {
      map.set(dateKey, []);
    }
    map.get(dateKey)!.push(item);
  }

  const sortedKeys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
  return sortedKeys.map((dateKey) => {
    const dateObj = new Date(`${dateKey}T00:00:00`);
    const dateLabel = format(dateObj, "EEE, d MMM yyyy").toUpperCase();
    return {
      dateKey,
      dateLabel,
      items: map.get(dateKey)!,
    };
  });
}

function formatFooterTimestamp(createdAt?: string, fallbackTime?: string) {
  if (createdAt) {
    const d = new Date(createdAt);
    if (!isNaN(d.getTime())) {
      return format(d, "d MMM yyyy HH:mm");
    }
  }
  return fallbackTime || "";
}

interface TopNavProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  onSignOut: () => void;
  adminProfile: UserProfile;
  syncStatus?: "online" | "offline" | "syncing" | "error";
  pendingChangesCount?: number;
  lastSyncError?: string | null;
  onRetrySync?: () => void;
  transactions?: Transaction[];
  notifications?: Notification[];
  onMenuToggle: () => void;
  onTransactionDetail?: (ticketId: string) => void;
  onEditTransaction?: (ticketId: string) => void;
}

export default function TopNav({ activePage, onNavigate, onSignOut, adminProfile, syncStatus = "online", pendingChangesCount = 0, lastSyncError = null, onRetrySync, transactions: liveTransactions = transactions, notifications: externalNotifications, onMenuToggle, onTransactionDetail, onEditTransaction }: TopNavProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const isStaff = adminProfile.role === "staff";
  const [notifications, setNotifications] = useState<Notification[]>(externalNotifications || initialNotifications);
  const [notifOpen, setNotifOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [showAvatarViewer, setShowAvatarViewer] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);

  // Update notifications when external notifications change
  useEffect(() => {
    if (externalNotifications) {
      setNotifications(externalNotifications);
    }
  }, [externalNotifications]);

  // Read notification IDs persisted in localStorage
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = window.localStorage.getItem("laundrytrack-read-notifications");
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  const persistReadIds = (next: Set<string>) => {
    setReadIds(next);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("laundrytrack-read-notifications", JSON.stringify(Array.from(next)));
      } catch {
        // ignore
      }
    }
  };

  const isRead = (id: string) => readIds.has(id);

  const toggleRead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(readIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    persistReadIds(next);
  };

  const markAllAsRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set([...readIds, ...notifications.map((n) => n.id)]);
    persistReadIds(next);
  };

  // Badge only counts unread notifications
  const badgeCount = notifications.filter((n) => !readIds.has(n.id)).length;
  const txnsByTicket = new Map(liveTransactions.map((t) => [t.ticketId, t]));
  const groupedNotifications = groupNotificationsByDate(notifications);

  const dismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const viewNotif = (notif: Notification, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!readIds.has(notif.id)) {
      const next = new Set(readIds);
      next.add(notif.id);
      persistReadIds(next);
    }
    setNotifOpen(false);
    // Open the detail modal first — "Edit Status" button inside goes directly to Edit Ticket modal
    setTimeout(() => {
      if (onTransactionDetail) {
        onTransactionDetail(notif.ticketId);
      } else {
        onNavigate("transactions");
      }
    }, 100);
  };

  return (
    <header className="h-14 bg-card border-b border-border flex items-center justify-between px-3 md:px-6 shrink-0 gap-3">
      {/* Left: hamburger (mobile) + page title */}
      <div className="flex items-center gap-2 min-w-0">
        {/* Hamburger — visible only on mobile/tablet */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-md hover:bg-accent transition-colors shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5 text-muted-foreground" />
        </button>
        <h1 className="text-sm font-semibold text-foreground truncate">
          {pageTitles[activePage]}
        </h1>
        {/* Mobile network indicator dot — opens diagnostics dialog */}
        <button
          type="button"
          onClick={() => setDiagnosticsOpen(true)}
          className="md:hidden flex items-center justify-center p-1 rounded-full cursor-pointer hover:bg-accent focus:outline-none"
          title="Click for connection details & diagnostics"
          aria-label={`Network status: ${syncStatus}. Click for connection diagnostics.`}
        >
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${
              syncStatus === "online"
                ? "bg-emerald-500"
                : syncStatus === "syncing"
                  ? "bg-blue-500 animate-pulse"
                  : syncStatus === "error"
                    ? "bg-red-500"
                    : "bg-orange-500"
            }`}
          />
        </button>
      </div>

      <div className="flex items-center gap-1 md:gap-3 shrink-0">
        {/* Desktop connection status pill — interactive dialog trigger */}
        <div className="hidden md:flex items-center">
          <button
            type="button"
            onClick={() => setDiagnosticsOpen(true)}
            className={`text-xs px-2.5 py-1 rounded-full font-semibold border transition-all cursor-pointer flex items-center gap-1.5 hover:ring-2 hover:ring-primary/20 ${
              syncStatus === "online"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                : syncStatus === "syncing"
                  ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                  : syncStatus === "error"
                    ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 animate-pulse"
                    : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
            }`}
            title="Click for connection details & diagnostics"
            aria-label={`Network status: ${syncStatus}. Click to open diagnostics.`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                syncStatus === "online"
                  ? "bg-emerald-500"
                  : syncStatus === "syncing"
                    ? "bg-blue-500 animate-pulse"
                    : syncStatus === "error"
                      ? "bg-rose-500"
                      : "bg-amber-500"
              }`}
            />
            <span>
              {syncStatus === "online"
                ? "Online"
                : syncStatus === "syncing"
                  ? "Syncing"
                  : syncStatus === "error"
                    ? "Sync Error"
                    : "Offline"}
            </span>
            {pendingChangesCount > 0 && (
              <span className="opacity-80">({pendingChangesCount})</span>
            )}
          </button>
        </div>
        {/* Notifications */}
        <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Notifications"
              onClick={() => setNotifOpen((prev) => !prev)}
              className="relative p-2 rounded-md cursor-pointer hover:bg-accent transition-colors active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <Bell className="w-4 h-4 text-muted-foreground" />
              {badgeCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-md flex items-center justify-center text-[10px] font-bold bg-rose-500 text-white shadow-xs">
                  {badgeCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-80 sm:w-96 md:w-[420px] p-0 rounded-2xl border border-border shadow-2xl bg-card overflow-hidden"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            {/* Header: Notifications [count] ... Mark All As Read */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-foreground">Notifications</p>
                <span className="px-1.5 py-0.5 text-[11px] font-bold rounded-md bg-rose-500 text-white min-w-[20px] text-center leading-none">
                  {badgeCount}
                </span>
              </div>
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-xs font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 transition-colors cursor-pointer"
                >
                  Mark All As Read
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="py-12 px-4 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                <Bell className="w-8 h-8 text-muted-foreground/30" />
                <p className="font-semibold text-foreground">No notifications</p>
                <p>You&apos;re all caught up!</p>
              </div>
            ) : (
              <div className="max-h-[440px] overflow-y-auto">
                {groupedNotifications.map((group) => (
                  <div key={group.dateKey} className="border-t border-border/60 first:border-t-0">
                    {/* Date Section Header */}
                    <div className="px-4 py-1.5 bg-muted/40 dark:bg-muted/20 border-b border-border/50 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {group.dateLabel}
                    </div>

                    <div>
                      {group.items.map((notif) => {
                        const txn = txnsByTicket.get(notif.ticketId);
                        const isPaid = txn?.paymentStatus === "paid";
                        const read = isRead(notif.id);
                        const isUnclaimed = notif.type === "unclaimed";

                        return (
                          <div
                            key={notif.id}
                            className={cn(
                              "relative flex items-start gap-3 px-3.5 py-3 border-b border-border/50 last:border-0 transition-colors group cursor-pointer",
                              read
                                ? "border-l-4 border-l-transparent bg-card hover:bg-muted/25"
                                : "border-l-4 border-l-rose-500 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-50/80 dark:hover:bg-rose-950/30"
                            )}
                            onClick={(e) => viewNotif(notif, e)}
                          >
                            {/* Left Avatar / Icon with Status Badge */}
                            <div className="relative shrink-0 mt-0.5">
                              <div className="w-9 h-9 rounded-full bg-muted/80 border border-border/60 flex items-center justify-center text-xs font-bold text-muted-foreground">
                                {getUserInitials(notif.customerName) || "LT"}
                              </div>
                              {isUnclaimed ? (
                                <div
                                  className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center ring-2 ring-card shadow-xs"
                                  title="Unclaimed alert"
                                >
                                  <AlertTriangle className="w-2.5 h-2.5 fill-current" />
                                </div>
                              ) : (
                                <div
                                  className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-2 ring-card shadow-xs"
                                  title="Ready for pickup"
                                >
                                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                                </div>
                              )}
                            </div>

                            {/* Middle Main Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-bold text-foreground truncate">
                                  {isUnclaimed ? "Unclaimed order alert" : "Order ready for pickup"}
                                </p>

                                {/* Right toggle read/unread circle */}
                                <button
                                  type="button"
                                  onClick={(e) => toggleRead(notif.id, e)}
                                  title={read ? "Mark as unread" : "Mark as read"}
                                  aria-label={read ? "Mark as unread" : "Mark as read"}
                                  className="p-0.5 -mr-0.5 text-muted-foreground/60 hover:text-rose-500 transition-colors shrink-0"
                                >
                                  {read ? (
                                    <Circle className="w-4 h-4 text-muted-foreground/40 hover:text-rose-500" />
                                  ) : (
                                    <CircleDot className="w-4 h-4 text-muted-foreground/70 hover:text-rose-500" />
                                  )}
                                </button>
                              </div>

                              <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                                {isUnclaimed ? (
                                  <>
                                    Order <span className="font-mono font-medium text-foreground">#{notif.ticketId}</span> for {notif.customerName} has remained unclaimed for over 2 days. Contact customer to schedule collection.
                                  </>
                                ) : (
                                  <>
                                    {notif.customerName}&apos;s laundry order <span className="font-mono font-medium text-foreground">#{notif.ticketId}</span> is ready for customer pickup.
                                    {txn && (
                                      <span className="text-foreground/85 font-medium"> Total: ₱{txn.fee.toLocaleString()} ({isPaid ? "Paid" : "Unpaid"}).</span>
                                    )}
                                  </>
                                )}
                              </p>

                              {/* Action Link & Footer Metadata */}
                              <div className="flex items-center justify-between gap-2 mt-2">
                                <button
                                  type="button"
                                  onClick={(e) => viewNotif(notif, e)}
                                  className="text-xs font-bold text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 uppercase tracking-wider inline-flex items-center gap-1 cursor-pointer"
                                >
                                  VIEW
                                </button>

                                <span className="text-[11px] text-muted-foreground/75 truncate text-right">
                                  Ticket: <span className="font-mono">{notif.ticketId}</span> &middot; {formatFooterTimestamp(notif.createdAt, notif.time)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Admin profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label="User Profile" className="flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer hover:bg-accent transition-colors active:scale-95 min-h-[44px]">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0 overflow-hidden">
                {adminProfile.avatarUrl ? (
                  <img
                    src={`${adminProfile.avatarUrl}?width=70&height=70&resize=cover`}
                    alt={adminProfile.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-xs font-bold text-primary-foreground select-none">
                    {getUserInitials(adminProfile.name, adminProfile.username, adminProfile.email)}
                  </span>
                )}
              </div>
              {/* Name + role badge hidden on mobile */}
              <div className="text-left hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-foreground leading-none">{adminProfile.name}</p>
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded leading-none ${isStaff ? "bg-teal-100 text-teal-700" : "bg-primary/10 text-primary"}`}>
                    {isStaff ? "Staff" : "Admin"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-[120px] truncate">{adminProfile.email}</p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-3 py-2 border-b border-border flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => adminProfile.avatarUrl && setShowAvatarViewer(true)}
                className={`w-9 h-9 rounded-full bg-primary flex items-center justify-center shrink-0 overflow-hidden ring-2 ring-primary/20 ${
                  adminProfile.avatarUrl ? "cursor-pointer hover:ring-primary/50 group relative" : ""
                }`}
                title={adminProfile.avatarUrl ? "Click to view full photo" : undefined}
                aria-label={adminProfile.avatarUrl ? "View profile picture" : undefined}
              >
                {adminProfile.avatarUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${adminProfile.avatarUrl}?width=90&height=90&resize=cover`}
                      alt={adminProfile.name}
                      className="w-full h-full object-cover transition-opacity group-hover:opacity-90"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Eye className="w-3.5 h-3.5 text-white drop-shadow" />
                    </div>
                  </>
                ) : (
                  <span className="text-xs font-bold text-primary-foreground select-none">
                    {getUserInitials(adminProfile.name, adminProfile.username, adminProfile.email)}
                  </span>
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground truncate">{adminProfile.name}</p>
                <p className="text-xs text-muted-foreground truncate">{adminProfile.email}</p>
              </div>
            </div>
            {adminProfile.avatarUrl && (
              <DropdownMenuItem
                className="cursor-pointer mt-1"
                onClick={() => setShowAvatarViewer(true)}
              >
                <Eye className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                View Profile Picture
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className={`cursor-pointer ${!adminProfile.avatarUrl ? "mt-1" : ""}`}
              onClick={() => onNavigate("profile")}
            >
              <User className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
              Profile
            </DropdownMenuItem>
            {!isStaff && (
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => onNavigate("change-password")}
              >
                <KeyRound className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                Change Password
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            >
              {resolvedTheme === "dark" ? (
                <Sun className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
              ) : (
                <Moon className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
              )}
              {resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
              onClick={() => setSignOutOpen(true)}
            >
              <LogOut className="w-3.5 h-3.5 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Sign Out Confirmation Modal */}
      <Dialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <DialogTitle className="text-base">Sign Out</DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground pl-[52px]">
              Are you sure you want to sign out? You will be returned to the login page.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end mt-2">
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => setSignOutOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="cursor-pointer"
              onClick={() => {
                setSignOutOpen(false);
                onSignOut();
              }}
            >
              Sign Out
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Profile Picture Viewer Dialog */}
      <Dialog open={showAvatarViewer} onOpenChange={setShowAvatarViewer}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm sm:max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {adminProfile.name || "Profile Picture"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {adminProfile.role === "staff" ? "Staff" : "Admin"} &bull; {adminProfile.email}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col items-center justify-center">
            <div className="relative w-full max-h-[60vh] aspect-square rounded-2xl overflow-hidden bg-muted/40 border border-border flex items-center justify-center shadow-inner">
              {adminProfile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={adminProfile.avatarUrl}
                  alt={adminProfile.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-4xl font-bold">
                  {getUserInitials(adminProfile.name, adminProfile.username, adminProfile.email)}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2 pt-2 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-8 cursor-pointer"
              onClick={() => {
                setShowAvatarViewer(false);
                onNavigate("profile");
              }}
            >
              Go to Profile
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="text-xs h-8 cursor-pointer"
              onClick={() => setShowAvatarViewer(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Connection & Diagnostics Dialog */}
      <ConnectionDiagnosticsDialog
        open={diagnosticsOpen}
        onOpenChange={setDiagnosticsOpen}
        syncStatus={syncStatus}
        pendingChangesCount={pendingChangesCount}
        lastSyncError={lastSyncError}
        onRetrySync={onRetrySync}
      />
    </header>
  );
}
