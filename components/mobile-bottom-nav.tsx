"use client";

import { LayoutDashboard, ListTodo, Receipt, User, Plus, BarChart3, Users } from "lucide-react";
import { type Page } from "@/components/sidebar";
import { type UserRole } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface MobileBottomNavProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  onPreload?: (page: Page) => void;
  role?: UserRole;
}

const STAFF_ITEMS: Array<{ page: Page; label: string; icon: typeof LayoutDashboard }> = [
  { page: "dashboard", label: "Home", icon: LayoutDashboard },
  { page: "processing", label: "Process", icon: ListTodo },
  { page: "new-transaction", label: "New Order", icon: Plus },
  { page: "transactions", label: "Records", icon: Receipt },
  { page: "profile", label: "Profile", icon: User },
];

const ADMIN_ITEMS: Array<{ page: Page; label: string; icon: typeof LayoutDashboard }> = [
  { page: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { page: "processing", label: "Process", icon: ListTodo },
  { page: "transactions", label: "Records", icon: Receipt },
  { page: "reports", label: "Reports", icon: BarChart3 },
  { page: "audit-logs", label: "Audit Logs", icon: Users },
];

export default function MobileBottomNav({ activePage, onNavigate, onPreload, role }: MobileBottomNavProps) {
  const items = role === "admin" ? ADMIN_ITEMS : STAFF_ITEMS;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="grid grid-cols-5">
        {items.map(({ page, label, icon: Icon }) => {
          const active = activePage === page;
          return (
            <button
              key={page}
              type="button"
              onPointerDown={() => onPreload?.(page)}
              onPointerEnter={() => onPreload?.(page)}
              onFocus={() => onPreload?.(page)}
              onClick={() => onNavigate(page)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 sm:gap-1 px-0.5 py-1.5 sm:py-2 outline-none focus-visible:bg-primary/10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary transition-colors",
                active ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-[10px] sm:text-xs leading-tight tracking-tight truncate max-w-full px-0.5">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
