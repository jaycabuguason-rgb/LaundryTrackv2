"use client";

import { useState, useEffect } from "react";
import { Bell, ChevronDown, User, Eye, X, KeyRound, LogOut, AlertTriangle, Menu, Moon, Sun } from "lucide-react";
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

const pageTitles: Record<Page, string> = {
  dashboard: "Dashboard",
  processing: "Processing",
  transactions: "Transactions",
  "claim-verification": "Claim Verification",
  reports: "Reports",
  "settings-pricing": "Settings — Pricing",
  "settings-service-types": "Settings — Service Types",
  "settings-business-profile": "Settings — Business Profile",
  "settings-backup": "Settings — Backup & Restore",
  "settings-loyalty": "Settings — Loyalty Program",
  "staff-management": "Staff Management",
  "audit-logs": "Audit Logs",
  loyalty: "Loyalty Members",
  profile: "My Profile",
  "change-password": "Change Password",
  "settings-data-import": "Settings — Data Import",
};

const notifTypeColors: Record<Notification["type"], string> = {
  ready:     "bg-green-100 text-green-700",
  unclaimed: "bg-orange-100 text-orange-700",
};

const notifTypeLabels: Record<Notification["type"], string> = {
  ready:     "READY",
  unclaimed: "UNCLAIMED",
};

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

  // Update notifications when external notifications change
  useEffect(() => {
    if (externalNotifications) {
      setNotifications(externalNotifications);
    }
  }, [externalNotifications]);

  // Badge only counts READY + UNCLAIMED
  const badgeCount = notifications.filter((n) => n.type === "ready" || n.type === "unclaimed").length;

  const dismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const viewNotif = (notif: Notification, e: React.MouseEvent) => {
    e.stopPropagation();
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
      </div>

      <div className="flex items-center gap-1 md:gap-3 shrink-0">
        <div className="hidden md:flex items-center">
          <span className={`text-[11px] px-2 py-1 rounded-full font-semibold ${
            syncStatus === "online"
              ? "bg-emerald-100 text-emerald-700"
              : syncStatus === "syncing"
                ? "bg-blue-100 text-blue-700"
                : syncStatus === "error"
                  ? "bg-red-100 text-red-700"
                  : "bg-orange-100 text-orange-700"
          }`}>
            {syncStatus === "online" ? "Online" : syncStatus === "syncing" ? "Syncing" : syncStatus === "error" ? "Sync Error" : "Offline"}
          </span>
          {pendingChangesCount > 0 && (
            <span className="ml-2 text-[11px] text-muted-foreground">
              {pendingChangesCount} pending
            </span>
          )}
          {pendingChangesCount > 0 && syncStatus !== "syncing" && onRetrySync && (
            <Button
              size="sm"
              variant="outline"
              className="ml-2 h-6 px-2 text-[11px]"
              onClick={onRetrySync}
            >
              Retry Sync
            </Button>
          )}
          {lastSyncError && syncStatus === "error" && (
            <span className="ml-2 text-[11px] text-red-600 max-w-[180px] truncate" title={lastSyncError}>
              {lastSyncError}
            </span>
          )}
        </div>
        {/* Notifications */}
        <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
          <DropdownMenuTrigger asChild>
            <button aria-label="Notifications" className="relative p-2 rounded-md cursor-pointer hover:bg-accent transition-colors active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center">
              <Bell className="w-4 h-4 text-muted-foreground" />
              {badgeCount > 0 && (
                <Badge className="absolute -top-0.5 -right-0.5 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-primary text-primary-foreground border-0">
                  {badgeCount}
                </Badge>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-72 sm:w-80 p-0"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-xs font-semibold text-foreground">Notifications</p>
              <span className="text-[11px] text-muted-foreground">{badgeCount} unread</span>
            </div>

            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No notifications
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold mb-1 tracking-wide ${notifTypeColors[notif.type]}`}>
                        {notifTypeLabels[notif.type]}
                      </span>
                      <p className="text-xs font-semibold text-foreground leading-tight">{notif.ticketId}</p>
                      <p className="text-[11px] text-muted-foreground leading-snug">{notif.customerName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {(() => {
                          const txn = liveTransactions.find((t) => t.ticketId === notif.ticketId);
                          if (!txn) return null;
                          return txn.paymentStatus === "paid" ? (
                            <span className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-green-500 text-white">PAID</span>
                          ) : (
                            <span className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white">UNPAID</span>
                          );
                        })()}
                        <span className="text-[11px] text-muted-foreground">{notif.time}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] px-2 flex items-center gap-1"
                        onClick={(e) => viewNotif(notif, e)}
                      >
                        <Eye className="w-3 h-3" /> View
                      </Button>
                      {/* Hide Dismiss button for UNCLAIMED notifications */}
                      {notif.type !== 'unclaimed' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[11px] px-2 flex items-center gap-1 text-muted-foreground hover:text-destructive"
                          onClick={(e) => dismiss(notif.id, e)}
                        >
                          <X className="w-3 h-3" /> Dismiss
                        </Button>
                      )}
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
                  <span className="text-[11px] font-bold text-primary-foreground select-none">
                    {adminProfile.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
                  </span>
                )}
              </div>
              {/* Name + role badge hidden on mobile */}
              <div className="text-left hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-foreground leading-none">{adminProfile.name}</p>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded leading-none ${isStaff ? "bg-teal-100 text-teal-700" : "bg-primary/10 text-primary"}`}>
                    {isStaff ? "Staff" : "Admin"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[120px] truncate">{adminProfile.email}</p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-xs font-semibold text-foreground truncate">{adminProfile.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">{adminProfile.email}</p>
            </div>
            <DropdownMenuItem
              className="cursor-pointer mt-1"
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
    </header>
  );
}
