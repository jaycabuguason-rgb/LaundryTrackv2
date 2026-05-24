"use client";

import { Check, Inbox, RotateCw, Wind, Flag, PackageCheck, Ban } from "lucide-react";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import type { TransactionStatus } from "@/lib/data";

export type StatusOption = {
  status: TransactionStatus;
  label: string;
  dotClass?: string; // Kept for backwards compatibility if passed, but ignored in UI
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

const getStatusIcon = (status: TransactionStatus) => {
  switch (status) {
    case "Received":
      return <Inbox className="w-4 h-4" />;
    case "Washing":
      return <RotateCw className="w-4 h-4" />;
    case "Drying":
      return <Wind className="w-4 h-4" />;
    case "Ready":
      return <Flag className="w-4 h-4" />;
    case "Claimed":
      return <PackageCheck className="w-4 h-4" />;
    case "Voided":
      return <Ban className="w-4 h-4" />;
    default:
      return <Inbox className="w-4 h-4" />;
  }
};

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
      <DrawerContent className="bg-[#1a1a2e]/95 backdrop-blur-md border-t border-white/10 text-white shadow-2xl">
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-white/20" />
        <DrawerHeader className="text-center pt-6 pb-4">
          <DrawerTitle className="text-lg font-semibold text-white">Update Status</DrawerTitle>
          <DrawerDescription className="text-white/60 mt-1">
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
                    "flex items-center w-full min-h-[52px] px-4 rounded-xl transition-all duration-200 outline-none border border-transparent",
                    isCurrent
                      ? "bg-white/10 border-white/20"
                      : "hover:bg-white/5 hover:border-white/10 focus-visible:bg-white/5 active:bg-white/10"
                  )}
                  onClick={() => {
                    if (!isDisabled) void onSelectStatus(status);
                  }}
                >
                  <div className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-lg mr-3 transition-colors",
                    isCurrent ? "text-white" : "text-white/70"
                  )}>
                    {getStatusIcon(status)}
                  </div>
                  <span className={cn(
                    "flex-1 text-left font-medium text-[15px]",
                    isCurrent ? "text-white" : "text-white/80"
                  )}>
                    {label}
                  </span>
                  {isCurrent && (
                    <div className="flex items-center gap-1.5 pl-3">
                      <Check className="h-4 w-4 text-white/50" />
                      <span className="text-xs font-medium text-white/50">Current</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {disabled && (
            <p className="mt-4 text-center text-xs font-medium text-white/50 animate-pulse">Updating...</p>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

