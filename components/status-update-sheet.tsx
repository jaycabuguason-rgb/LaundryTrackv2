"use client";

import { Check } from "lucide-react";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { getStatusIcon } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import type { TransactionStatus } from "@/lib/data";

export type StatusOption = {
  status: TransactionStatus;
  label: string;
};

interface StatusUpdateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId?: string;
  currentStatus: TransactionStatus;
  options: StatusOption[];
  disabled?: boolean;
  onSelectStatus: (status: TransactionStatus) => Promise<void> | void;
}

export function StatusUpdateSheet({
  open,
  onOpenChange,
  ticketId,
  currentStatus,
  options,
  disabled = false,
  onSelectStatus,
}: StatusUpdateSheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-card border-t border-border text-foreground shadow-2xl">
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-muted-foreground/30" />
        <DrawerHeader className="text-center pt-6 pb-4">
          <DrawerTitle className="text-lg font-semibold text-foreground">Update Status</DrawerTitle>
          <DrawerDescription className="text-muted-foreground mt-1">
            {ticketId ? `Ticket ${ticketId}` : "Select a new status"}
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-8 max-w-md mx-auto w-full">
          <div className="flex flex-col gap-1.5">
            {options.map(({ status, label }) => {
              const isCurrent = status === currentStatus;
              const isDisabled = disabled || isCurrent;
              return (
                <button
                  key={status}
                  type="button"
                  disabled={isDisabled}
                  className={cn(
                    "flex items-center w-full min-h-[52px] px-4 rounded-xl transition-all duration-200 outline-none border border-transparent cursor-pointer",
                    isCurrent
                      ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                      : "hover:bg-muted/40 hover:border-border text-foreground focus-visible:bg-muted/40 active:bg-muted/60"
                  )}
                  onClick={() => {
                    if (!isDisabled) void onSelectStatus(status);
                  }}
                >
                  <div className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-lg mr-3 transition-colors",
                    isCurrent ? "text-primary" : "text-muted-foreground"
                  )}>
                    {getStatusIcon(status)}
                  </div>
                  <span className={cn(
                    "flex-1 text-left font-medium text-[15px]",
                    isCurrent ? "text-primary" : "text-foreground"
                  )}>
                    {label}
                  </span>
                  {isCurrent && (
                    <div className="flex items-center gap-1.5 pl-3">
                      <Check className="h-4 w-4 text-primary" />
                      <span className="text-xs font-medium text-primary">Current</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {disabled && (
            <p className="mt-4 text-center text-xs font-medium text-muted-foreground animate-pulse">Updating...</p>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

