"use client";

import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
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
  dotClass: string;
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
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Update Status</DrawerTitle>
          <DrawerDescription>
            {ticketId ? `Ticket ${ticketId}` : "Select a new status"}
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-5">
          <div className="space-y-2">
            {options.map(({ status, label, dotClass }) => {
              const isCurrent = status === currentStatus;
              const isDisabled = disabled || isCurrent;
              return (
                <Button
                  key={status}
                  type="button"
                  variant="outline"
                  disabled={isDisabled}
                  className={cn(
                    "h-11 w-full justify-start gap-3 text-sm",
                    isCurrent && "border-primary bg-primary/5",
                  )}
                  onClick={() => {
                    if (!isDisabled) void onSelectStatus(status);
                  }}
                >
                  <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", dotClass)} />
                  <span className="flex-1 text-left">{label}</span>
                  {isCurrent ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Check className="h-3.5 w-3.5" />
                      Current
                    </span>
                  ) : null}
                </Button>
              );
            })}
          </div>
          {disabled ? (
            <p className="mt-3 text-center text-xs text-muted-foreground">Updating...</p>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

