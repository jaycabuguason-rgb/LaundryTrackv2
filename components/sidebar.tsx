"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Receipt,
  ListTodo,
  QrCode,
  BarChart3,
  Settings,
  Star,
  PanelLeftClose,
  PanelLeftOpen,
  WashingMachine,
  Users,
  PlusCircle,
  Moon,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { UserRole, UserProfile } from "@/lib/auth";

export type Page =
  | "dashboard"
  | "processing"
  | "new-transaction"
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
  onPreload?: (page: Page) => void;
  loyaltyEnabled: boolean;
  role?: UserRole;
  processingCount?: number;
  adminProfile?: UserProfile;
  onSignOut?: () => void;
}

// Pages hidden from staff
const ADMIN_ONLY_NAV_PAGES: Page[] = ["reports", "staff-management", "audit-logs"];

// Sidebar sections definition
const OPERATE_ITEMS = [
  { id: "dashboard" as Page, label: "Dashboard", icon: LayoutDashboard },
  { id: "processing" as Page, label: "Processing", icon: ListTodo },
  { id: "new-transaction" as Page, label: "New Order", icon: PlusCircle },
  { id: "claim-verification" as Page, label: "Claim Verification", icon: QrCode },
];

const CUSTOMER_ITEMS = [
  { id: "transactions" as Page, label: "Transactions", icon: Receipt },
  { id: "loyalty" as Page, label: "Loyalty Members", icon: Star, requiresLoyalty: true },
];

const SYSTEM_ITEMS = [
  { id: "audit-logs" as Page, label: "Staff & Audit Logs", icon: Users, adminOnly: true },
  { id: "reports" as Page, label: "Reports", icon: BarChart3, adminOnly: true },
  { id: "settings-pricing" as Page, label: "Settings", icon: Settings },
];

export default function Sidebar({
  activePage,
  onNavigate,
  onPreload,
  loyaltyEnabled,
  role = "admin",
  processingCount = 0,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const isStaff = role === "staff";
  const effectiveCollapsed = collapsed;

  // Filter helpers
  const filterItems = <T extends { adminOnly?: boolean; requiresLoyalty?: boolean; id: Page }>(
    items: T[]
  ) =>
    items.filter((item) => {
      if (item.adminOnly && isStaff) return false;
      if (item.requiresLoyalty && !loyaltyEnabled) return false;
      if (ADMIN_ONLY_NAV_PAGES.includes(item.id) && isStaff) return false;
      return true;
    });

  const operateItems = filterItems(OPERATE_ITEMS);
  const customerItems = filterItems(CUSTOMER_ITEMS);
  const systemItems = filterItems(SYSTEM_ITEMS);

  const isActive = (id: Page) =>
    activePage === id ||
    (id === "audit-logs" && activePage === "staff-management") ||
    (id === "settings-pricing" && activePage.startsWith("settings"));

  const NavButton = ({
    id,
    label,
    icon: Icon,
    showBadge,
  }: {
    id: Page;
    label: string;
    icon: React.ElementType;
    showBadge?: boolean;
  }) => {
    const active = isActive(id);
    return (
      <li>
        <button
          onPointerDown={() => onPreload?.(id)}
          onPointerEnter={() => onPreload?.(id)}
          onFocus={() => onPreload?.(id)}
          onClick={() => onNavigate(id)}
          title={effectiveCollapsed ? label : undefined}
          className={cn(
            "relative w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]",
            active
              ? "bg-sidebar-accent text-white"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-white"
          )}
        >
          <Icon className="w-5 h-5 shrink-0" />
          {effectiveCollapsed ? (
            showBadge && processingCount > 0 ? (
              <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {processingCount > 99 ? "99+" : processingCount}
              </span>
            ) : null
          ) : (
            <span className="flex-1 flex items-center gap-2 truncate">
              <span className="truncate">{label}</span>
              {showBadge && processingCount > 0 && (
                <span className="shrink-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-primary-foreground">
                  {processingCount > 99 ? "99+" : processingCount}
                </span>
              )}
            </span>
          )}
        </button>
      </li>
    );
  };

  const SectionLabel = ({ label }: { label: string }) =>
    effectiveCollapsed ? (
      <div className="my-1 h-px bg-sidebar-border/50 mx-2" />
    ) : (
      <li className="px-3 pt-4 pb-1">
        <span className="text-[10px] font-semibold tracking-widest text-sidebar-foreground/40 uppercase">
          {label}
        </span>
      </li>
    );

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
      <nav className="flex-1 py-3 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent] hover:[scrollbar-color:rgba(255,255,255,0.3)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15 hover:[&::-webkit-scrollbar-thumb]:bg-white/25">
        <ul className="space-y-0.5 px-2">
          {/* OPERATE */}
          <SectionLabel label="Operate" />
          {operateItems.map((item) => (
            <NavButton
              key={item.id}
              id={item.id}
              label={item.label}
              icon={item.icon}
              showBadge={item.id === "processing"}
            />
          ))}

          {/* CUSTOMERS */}
          <SectionLabel label="Customers" />
          {customerItems.map((item) => (
            <NavButton key={item.id} id={item.id} label={item.label} icon={item.icon} />
          ))}

          {/* SYSTEM */}
          <SectionLabel label="System" />
          {systemItems.map((item) => (
            <NavButton key={item.id} id={item.id} label={item.label} icon={item.icon} />
          ))}
        </ul>
      </nav>

      {/* Footer Dock */}
      <div className="border-t border-sidebar-border/50 bg-gradient-to-t from-black/25 via-sidebar/60 to-transparent shrink-0">
        {/* Dark Mode Toggle */}
        {!effectiveCollapsed ? (
          <div className="flex items-center gap-3 px-4 py-3 border-b border-sidebar-border/30">
            <Moon className="w-4 h-4 text-sidebar-foreground/60 shrink-0" />
            <span className="flex-1 text-sm text-sidebar-foreground/70">Dark Mode</span>
            <Switch
              checked={isDark}
              onCheckedChange={(v) => setTheme(v ? "dark" : "light")}
              aria-label="Toggle dark mode"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center py-2 border-b border-sidebar-border/30">
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className="p-2 rounded-md text-sidebar-foreground/50 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Toggle dark mode"
            >
              <Moon className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Collapse toggle (desktop only) */}
        <div className="p-2 hidden lg:block">
          <button
            onClick={() => setCollapsed((prev) => !prev)}
            title={effectiveCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "w-full flex items-center rounded-xl py-2 text-xs font-medium text-sidebar-foreground/75 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all duration-200 cursor-pointer min-h-[40px] shadow-xs active:scale-[0.98]",
              effectiveCollapsed ? "justify-center px-2" : "justify-between px-3"
            )}
          >
            {effectiveCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-sidebar-foreground/90 hover:text-white transition-transform hover:scale-110" />
            ) : (
              <div className="flex items-center gap-2.5">
                <PanelLeftClose className="w-4 h-4 text-sidebar-foreground/90" />
                <span className="font-medium tracking-tight">Collapse</span>
              </div>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
