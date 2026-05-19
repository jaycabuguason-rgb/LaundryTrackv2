"use client";

import { LayoutDashboard, ListTodo, Receipt, QrCode, User } from "lucide-react";
import { type Page } from "@/components/sidebar";
import { cn } from "@/lib/utils";

interface MobileBottomNavProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
}

const ITEMS: Array<{ page: Page; label: string; icon: typeof LayoutDashboard }> = [
  { page: "dashboard", label: "Home", icon: LayoutDashboard },
  { page: "processing", label: "Process", icon: ListTodo },
  { page: "transactions", label: "Orders", icon: Receipt },
  { page: "claim-verification", label: "Claim", icon: QrCode },
  { page: "profile", label: "Profile", icon: User },
];

export default function MobileBottomNav({ activePage, onNavigate }: MobileBottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card lg:hidden">
      <div className="grid grid-cols-5">
        {ITEMS.map(({ page, label, icon: Icon }) => {
          const active = activePage === page;
          return (
            <button
              key={page}
              type="button"
              onClick={() => onNavigate(page)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-2 text-[11px]",
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
