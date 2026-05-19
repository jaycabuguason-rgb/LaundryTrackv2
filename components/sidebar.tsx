"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Receipt,
  ListTodo,
  QrCode,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
  Coins,
  Building2,
  Database,
  Star,
  PanelLeftClose,
  PanelLeftOpen,
  WashingMachine,
  Upload,
  Gift,
  Users,
  ScrollText,
} from "lucide-react";
import type { UserRole } from "@/lib/auth";

export type Page =
  | "dashboard"
  | "processing"
  | "transactions"
  | "claim-verification"
  | "reports"
  | "settings-pricing"
  | "settings-service-types"
  | "settings-business-profile"
  | "settings-backup"
  | "settings-loyalty"
  | "loyalty"
  | "profile"
  | "change-password"
  | "settings-data-import"
  | "staff-management"
  | "audit-logs";

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  loyaltyEnabled: boolean;
  role?: UserRole;
  processingCount?: number;
}

// Top-level nav pages hidden from staff
const ADMIN_ONLY_NAV_PAGES: Page[] = ["reports", "staff-management", "audit-logs"];

// Settings sub-pages hidden from staff
const ADMIN_ONLY_SETTINGS: Page[] = ["settings-backup", "settings-data-import"];

const allNavItems = [
  { id: "dashboard" as Page, label: "Dashboard", icon: LayoutDashboard },
  { id: "processing" as Page, label: "Processing", icon: ListTodo },
  { id: "transactions" as Page, label: "Transactions", icon: Receipt },
  { id: "claim-verification" as Page, label: "Claim Verification", icon: QrCode },
  { id: "reports" as Page, label: "Reports", icon: BarChart3 },
  { id: "staff-management" as Page, label: "Staff Management", icon: Users },
  { id: "audit-logs" as Page, label: "Audit Logs", icon: ScrollText },
  { id: "loyalty" as Page, label: "Loyalty Members", icon: Star },
];

const settingsSubItems = [
  { id: "settings-pricing" as Page, label: "Pricing", icon: Coins },
  { id: "settings-business-profile" as Page, label: "Business Profile", icon: Building2 },
  { id: "settings-loyalty" as Page, label: "Loyalty Program", icon: Gift },
  { id: "settings-backup" as Page, label: "Backup & Restore", icon: Database },
  { id: "settings-data-import" as Page, label: "Data Import", icon: Upload },
];

export default function Sidebar({ activePage, onNavigate, loyaltyEnabled, role = "admin", processingCount = 0 }: SidebarProps) {
  // On desktop: user can collapse to icon-only. On tablet (md): starts collapsed.
  const [collapsed, setCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(activePage.startsWith("settings"));

  const isSettingsActive = activePage.startsWith("settings");
  const isStaff = role === "staff";

  // Filter nav items based on role
  const navItems = isStaff
    ? allNavItems.filter((item) => !ADMIN_ONLY_NAV_PAGES.includes(item.id))
    : allNavItems;

  // Filter settings sub-items based on role
  const visibleSettingsSubItems = isStaff
    ? settingsSubItems.filter((item) => !ADMIN_ONLY_SETTINGS.includes(item.id))
    : settingsSubItems;

  // On mobile the sidebar is shown as a full slide-in drawer (controlled by app-shell)
  // On md (tablet) it starts icon-only; on lg it defaults to full
  const effectiveCollapsed = collapsed;

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-sidebar text-sidebar-foreground transition-all duration-300 shrink-0",
        effectiveCollapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border min-h-[60px]">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary shrink-0">
          <WashingMachine className="w-5 h-5 text-white" />
        </div>
        {!effectiveCollapsed && (
          <span className="font-semibold text-base tracking-tight text-white truncate">
            LaundryTrack
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id)}
                  title={effectiveCollapsed ? item.label : undefined}
                  className={cn(
                    "relative w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]",
                    active
                      ? "bg-sidebar-accent text-white"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-white"
                  )}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {effectiveCollapsed ? (
                    item.id === "processing" && processingCount > 0 ? (
                      <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                        {processingCount > 99 ? "99+" : processingCount}
                      </span>
                    ) : null
                  ) : (
                    <span className="flex-1 flex items-center gap-2 truncate">
                      <span className="truncate">{item.label}</span>
                      {item.id === "processing" && processingCount > 0 && (
                        <span className="shrink-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                          {processingCount > 99 ? "99+" : processingCount}
                        </span>
                      )}
                      {item.id === "loyalty" && !loyaltyEnabled && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted/40 text-sidebar-foreground/50 border border-sidebar-border/40">
                          Disabled
                        </span>
                      )}
                    </span>
                  )}
                </button>
              </li>
            );
          })}

          {/* Settings with sub-menu — filtered by role */}
          <li>
            <button
              onClick={() => {
                if (!effectiveCollapsed) setSettingsOpen((prev) => !prev);
                else onNavigate("settings-pricing");
              }}
              title={effectiveCollapsed ? "Settings" : undefined}
              className={cn(
                "w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]",
                isSettingsActive
                  ? "bg-sidebar-accent text-white"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-white"
              )}
            >
              <Settings className="w-5 h-5 shrink-0" />
              {!effectiveCollapsed && (
                <>
                  <span className="flex-1 text-left truncate">Settings</span>
                  {settingsOpen ? (
                    <ChevronDown className="w-4 h-4 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 shrink-0" />
                  )}
                </>
              )}
            </button>
            {!effectiveCollapsed && settingsOpen && (
              <ul className="mt-1 ml-3 pl-3 border-l border-sidebar-border space-y-1">
                {visibleSettingsSubItems.map((sub) => {
                  const Icon = sub.icon;
                  const active = activePage === sub.id;
                  return (
                    <li key={sub.id}>
                      <button
                        onClick={() => onNavigate(sub.id)}
                        className={cn(
                          "w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium transition-colors min-h-[44px]",
                          active
                            ? "bg-primary/20 text-white"
                            : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-white"
                        )}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{sub.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        </ul>
      </nav>

      {/* Collapse toggle — desktop only */}
      <div className="p-3 border-t border-sidebar-border hidden lg:block">
        <button
          onClick={() => setCollapsed((prev) => !prev)}
          className="w-full flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs text-sidebar-foreground/50 hover:text-white hover:bg-sidebar-accent/60 transition-colors min-h-[44px]"
        >
          {effectiveCollapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <>
              <PanelLeftClose className="w-4 h-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
