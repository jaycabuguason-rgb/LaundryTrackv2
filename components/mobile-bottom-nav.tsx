"use client";

import { LayoutDashboard, ListTodo, Receipt, User, Plus } from "lucide-react";
import { type Page } from "@/components/sidebar";
import { cn } from "@/lib/utils";

interface MobileBottomNavProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  onPreload?: (page: Page) => void;
}

const ITEMS: Array<{ page: Page; label: string; icon: typeof LayoutDashboard }> = [
  { page: "dashboard", label: "Home", icon: LayoutDashboard },
  { page: "processing", label: "Process", icon: ListTodo },
  { page: "new-transaction", label: "New order", icon: Plus },
  { page: "transactions", label: "Records", icon: Receipt },
  { page: "profile", label: "Profile", icon: User },
];

export default function MobileBottomNav({ activePage, onNavigate, onPreload }: MobileBottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="grid grid-cols-5">
        {ITEMS.map(({ page, label, icon: Icon }) => {
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
                "flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-xs outline-none focus-visible:bg-primary/10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                active ? "text-primary font-semibold" : "text-muted-foreground",
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
