"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Eye,
  EyeOff,
  Pencil,
  Search,
  UserCheck,
  UserX,
  Users,
  KeyRound,
  CheckCircle2,
  Plus,
  UserMinus,
  UserPlus,
  Loader2,
  RefreshCw,
  ScrollText,
  Shield,
  Briefcase,
  Clock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useStaffAccounts } from "@/hooks/use-staff-accounts";
import { useStaffPresence } from "@/hooks/use-staff-presence";
import { Skeleton } from "boneyard-js/react";
import type { CreateStaffAccountInput, StaffAccountSummary } from "@/lib/staff-contracts";
import type { UserProfile } from "@/lib/auth";
import { cn } from "@/lib/utils";

const AuditLogsView = dynamic(
  () => import("@/components/pages/audit-logs").then((mod) => mod.AuditLogsView),
  { ssr: false }
);

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 block text-xs font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-9 pr-9 text-sm"
        />
        <button
          type="button"
          onClick={() => setShow((current) => !current)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer p-1 rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 block text-xs font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-9 text-sm"
      />
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getDefaultEmail(username: string) {
  const normalized = username.trim().toLowerCase();
  return normalized ? `${normalized}@laundrytrack.ph` : "";
}

export function RoleBadge({ role = "Staff" }: { role?: string }) {
  const normalized = role.toLowerCase();
  if (normalized === "admin") {
    return (
      <Badge className="border-purple-200 bg-purple-100 text-purple-700 dark:border-purple-800 dark:bg-purple-900/30 dark:text-purple-300 font-medium px-2 py-0.5 text-xs border">
        Admin
      </Badge>
    );
  }
  // Staff and Cashier are treated as one (Staff)
  return (
    <Badge className="border-teal-200 bg-teal-100 text-teal-700 dark:border-teal-800 dark:bg-teal-900/30 dark:text-teal-300 font-medium px-2 py-0.5 text-xs border">
      Staff
    </Badge>
  );
}

export function ShiftStatusBadge({ status }: { status?: string }) {
  const normalized = (status || "Off Duty").toLowerCase();
  if (normalized.includes("break")) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
        On Break
      </span>
    );
  }
  if (normalized.includes("off") || normalized.includes("inactive")) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
        Off Duty
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
      On Shift
    </span>
  );
}

export default function StaffManagementPage({
  initialTab = "staff",
  onTabChange,
  currentProfile,
  isStaffOnline: isStaffOnlineProp,
}: {
  initialTab?: "staff" | "audit";
  onTabChange?: (tab: "staff" | "audit") => void;
  currentProfile?: UserProfile;
  isStaffOnline?: (staff: { id?: string; username?: string; email?: string; isActive?: boolean }) => boolean;
}) {
  const [activeTab, setActiveTab] = useState<"staff" | "audit">(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);
  const { toast } = useToast();
  const presence = useStaffPresence(isStaffOnlineProp ? undefined : currentProfile);
  const isStaffOnline = isStaffOnlineProp || presence.isStaffOnline;

  const {
    staff,
    loading,
    error,
    refresh,
    createStaff,
    updateStaff,
    resetPassword,
    usingSupabase,
  } = useStaffAccounts();

  const [search, setSearch] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addUsername, setAddUsername] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<string>("Staff");
  const [addPassword, setAddPassword] = useState("");
  const [addConfirmPassword, setAddConfirmPassword] = useState("");
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});
  const [addSubmitting, setAddSubmitting] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffAccountSummary | null>(null);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<string>("Staff");
  const [editActive, setEditActive] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<StaffAccountSummary | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);

  const [deactivateTarget, setDeactivateTarget] = useState<StaffAccountSummary | null>(null);
  const [deactivateSubmitting, setDeactivateSubmitting] = useState(false);

  // Maintain local metadata overrides for role per staff member ID
  const [staffMeta, setStaffMeta] = useState<Record<string, { role?: string }>>({});

  const getStaffRole = useCallback((staffAccount: StaffAccountSummary): string => {
    if (staffMeta[staffAccount.id]?.role) {
      const r = staffMeta[staffAccount.id].role!;
      return r.toLowerCase() === "cashier" ? "Staff" : r;
    }
    if (staffAccount.role) {
      return staffAccount.role.toLowerCase() === "cashier" ? "Staff" : staffAccount.role;
    }
    if (staffAccount.username.toLowerCase().includes("admin") || staffAccount.email.toLowerCase().includes("admin")) {
      return "Admin";
    }
    return "Staff";
  }, [staffMeta]);

  const getStaffShiftStatus = useCallback((staffAccount: StaffAccountSummary): "On Shift" | "Off Duty" => {
    if (!staffAccount.isActive) {
      return "Off Duty";
    }
    // Only seen as active ("On Shift") if the staff member is online and active in real-time
    return isStaffOnline(staffAccount) ? "On Shift" : "Off Duty";
  }, [isStaffOnline]);

  const handleTabSwitch = (tab: "staff" | "audit") => {
    if (onTabChange) {
      onTabChange(tab);
      return;
    }
    setActiveTab(tab);
  };

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return staff;
    }

    return staff.filter((item) =>
      [
        item.fullName,
        item.email,
        item.username,
        item.phoneNumber,
        getStaffRole(item),
        getStaffShiftStatus(item),
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [search, staff, getStaffRole, getStaffShiftStatus]);

  const resetAddForm = () => {
    setAddName("");
    setAddUsername("");
    setAddPhone("");
    setAddEmail("");
    setAddRole("Staff");
    setAddPassword("");
    setAddConfirmPassword("");
    setAddErrors({});
  };

  const validateAddForm = () => {
    const errors: Record<string, string> = {};
    const normalizedUsername = addUsername.trim().toLowerCase();
    const normalizedEmail = (addEmail.trim() || getDefaultEmail(addUsername)).toLowerCase();

    if (!addName.trim()) {
      errors.name = "Full name is required.";
    }
    if (!normalizedUsername) {
      errors.username = "Username is required.";
    } else if (staff.some((item) => item.username.toLowerCase() === normalizedUsername)) {
      errors.username = "Username already exists.";
    }
    if (!normalizedEmail) {
      errors.email = "Email is required.";
    } else if (staff.some((item) => item.email.toLowerCase() === normalizedEmail)) {
      errors.email = "Email already exists.";
    }
    if (!addPassword) {
      errors.password = "Password is required.";
    } else if (addPassword.length < 6) {
      errors.password = "Password must be at least 6 characters.";
    }
    if (!addConfirmPassword) {
      errors.confirmPassword = "Please confirm the password.";
    } else if (addConfirmPassword !== addPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }

    return errors;
  };

  const handleAddStaff = async () => {
    const errors = validateAddForm();
    if (Object.keys(errors).length > 0) {
      setAddErrors(errors);
      return;
    }

    setAddSubmitting(true);
    try {
      const payload: CreateStaffAccountInput = {
        fullName: addName.trim(),
        username: addUsername.trim().toLowerCase(),
        phoneNumber: addPhone.trim(),
        email: (addEmail.trim() || getDefaultEmail(addUsername)).toLowerCase(),
        password: addPassword,
      };

      const staffAccount = await createStaff(payload);
      setStaffMeta((prev) => ({
        ...prev,
        [staffAccount.id]: { role: addRole },
      }));
      setAddOpen(false);
      resetAddForm();
      toast({
        title: "Staff account created",
        description: `${staffAccount.fullName} has been added as ${addRole}.`,
      });
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Unable to create the staff account.";
      setAddErrors((current) => ({ ...current, form: message }));
    } finally {
      setAddSubmitting(false);
    }
  };

  const openEdit = (staffAccount: StaffAccountSummary) => {
    setEditTarget(staffAccount);
    setEditName(staffAccount.fullName);
    setEditUsername(staffAccount.username);
    setEditPhone(staffAccount.phoneNumber);
    setEditEmail(staffAccount.email);
    setEditRole(getStaffRole(staffAccount));
    setEditActive(staffAccount.isActive);
    setEditError(null);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editTarget) {
      return;
    }
    if (!editName.trim() || !editUsername.trim() || !editEmail.trim()) {
      setEditError("Full name, username, and email are required.");
      return;
    }

    const normalizedUsername = editUsername.trim().toLowerCase();
    const normalizedEmail = editEmail.trim().toLowerCase();
    if (staff.some((item) => item.id !== editTarget.id && item.username.toLowerCase() === normalizedUsername)) {
      setEditError("Username already exists.");
      return;
    }
    if (staff.some((item) => item.id !== editTarget.id && item.email.toLowerCase() === normalizedEmail)) {
      setEditError("Email already exists.");
      return;
    }

    setEditSubmitting(true);
    try {
      const staffAccount = await updateStaff(editTarget.id, {
        fullName: editName.trim(),
        username: normalizedUsername,
        phoneNumber: editPhone.trim(),
        email: normalizedEmail,
        isActive: editActive,
      });
      setStaffMeta((prev) => ({
        ...prev,
        [editTarget.id]: { role: editRole },
      }));
      setEditOpen(false);
      setEditTarget(null);
      toast({
        title: "Staff profile updated",
        description: `${staffAccount.fullName}'s profile has been saved.`,
      });
    } catch (saveError) {
      setEditError(saveError instanceof Error ? saveError.message : "Unable to save the staff profile.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const openReset = (staffAccount: StaffAccountSummary) => {
    setResetTarget(staffAccount);
    setNewPassword("");
    setConfirmPassword("");
    setPwError("");
    setResetOpen(true);
  };

  const handleResetPassword = async () => {
    if (!resetTarget) {
      return;
    }
    if (!newPassword) {
      setPwError("Please enter a new password.");
      return;
    }
    if (newPassword.length < 6) {
      setPwError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Passwords do not match.");
      return;
    }

    setResetSubmitting(true);
    try {
      await resetPassword(resetTarget.id, newPassword);
      setResetOpen(false);
      toast({
        title: "Password reset successfully",
        description: `${resetTarget.fullName}'s password has been updated.`,
      });
    } catch (resetError) {
      setPwError(resetError instanceof Error ? resetError.message : "Unable to reset the password.");
    } finally {
      setResetSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) {
      return;
    }

    setDeactivateSubmitting(true);
    try {
      const updated = await updateStaff(deactivateTarget.id, {
        fullName: deactivateTarget.fullName,
        username: deactivateTarget.username,
        phoneNumber: deactivateTarget.phoneNumber,
        email: deactivateTarget.email,
        isActive: !deactivateTarget.isActive,
      });
      setDeactivateTarget(null);
      toast({
        title: updated.isActive ? "Staff account reactivated" : "Staff account deactivated",
        description: `${updated.fullName} has been ${updated.isActive ? "reactivated" : "deactivated"}.`,
      });
    } catch (updateError) {
      toast({
        title: "Unable to update staff status",
        description: updateError instanceof Error ? updateError.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeactivateSubmitting(false);
    }
  };

  if (activeTab === "audit") {
    return <AuditLogsView onTabChange={handleTabSwitch} currentProfile={currentProfile} />;
  }

  const content = (
    <div className="w-full max-w-5xl space-y-5">
      {/* Header & Tab Switcher */}
      <div className="flex flex-col gap-4">
        {/* Header & Live Admin Badge (Mobile < md) */}
        <div className="flex items-center justify-between gap-2 md:hidden">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Staff & Audit Logs</h1>
            <p className="text-xs text-muted-foreground">Team management and system activity</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1 text-xs shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-semibold text-foreground truncate max-w-[90px]">
              {currentProfile?.name || currentProfile?.username || "Admin"}
            </span>
            <Badge variant="outline" className="text-[10px] px-1 py-0 uppercase border-muted-foreground/30 font-medium">
              {currentProfile?.role || "ADMIN"}
            </Badge>
          </div>
        </div>

        {/* Desktop Header & Subtitle (>= md) */}
        <div className="hidden md:block">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Staff & Audit Logs</h1>
          <p className="text-xs text-muted-foreground sm:text-sm mt-0.5">Team management and system activity</p>
        </div>

        {/* Mobile Segmented Navigation Tabs (< md) */}
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/50 p-1 border border-border md:hidden">
          <button
            type="button"
            onClick={() => handleTabSwitch("staff")}
            className="flex items-center justify-center gap-2 rounded-lg bg-card py-2 text-xs font-semibold text-foreground shadow-xs transition-colors cursor-pointer border border-border/50"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            <Users className="h-4 w-4 text-primary" />
            <span>Staff Management</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch("audit")}
            className="flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ScrollText className="h-4 w-4" />
            <span>Audit Logs</span>
          </button>
        </div>

        {/* Desktop Tab Switcher (>= md) */}
        <div className="hidden md:flex items-center gap-6 border-b border-border">
          <button
            type="button"
            onClick={() => handleTabSwitch("staff")}
            className="flex items-center gap-2 pb-2.5 text-sm font-semibold transition-colors border-b-2 border-primary text-primary cursor-pointer"
          >
            <Users className="h-4 w-4" />
            Staff Management
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch("audit")}
            className="flex items-center gap-2 pb-2.5 text-sm font-medium transition-colors border-b-2 border-transparent text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <ScrollText className="h-4 w-4" />
            Audit Logs
          </button>
        </div>
      </div>

      {/* Staff Actions & Search Bar */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Staff Members</h2>
            <p className="text-xs text-muted-foreground">
              {staff.length} staff account{staff.length !== 1 ? "s" : ""} · {staff.filter((item) => item.isActive).length} active
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search staff, role, status…"
              aria-label="Search staff members by name, role, or status"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9 w-full pl-8 text-sm"
            />
          </div>
          <Button size="sm" variant="outline" className="h-9 px-3 text-xs" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            className="flex h-9 shrink-0 items-center gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            onClick={() => {
              resetAddForm();
              setAddOpen(true);
            }}
            disabled={!usingSupabase}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Staff
          </Button>
        </div>
      </div>

      {!usingSupabase && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-300">
          Supabase is not configured in this browser session. Staff management is disabled until your project keys are set.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Staff Table Container */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-none">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Staff Member</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">Username</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">Role</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">Shift Status</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">Contact</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-3 py-3 pr-4 text-left text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index} className="border-b border-border transition-colors last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 shrink-0 rounded-full bg-muted animate-pulse" />
                        <div className="space-y-1.5">
                          <div className="h-3.5 w-28 rounded bg-muted animate-pulse" />
                          <div className="h-3 w-36 rounded bg-muted animate-pulse" />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="h-3.5 w-20 rounded bg-muted animate-pulse" />
                    </td>
                    <td className="px-3 py-3">
                      <div className="h-5 w-16 rounded-full bg-muted animate-pulse" />
                    </td>
                    <td className="px-3 py-3">
                      <div className="h-5 w-16 rounded-full bg-muted animate-pulse" />
                    </td>
                    <td className="px-3 py-3">
                      <div className="h-3.5 w-24 rounded bg-muted animate-pulse" />
                    </td>
                    <td className="px-3 py-3">
                      <div className="h-5 w-14 rounded-full bg-muted animate-pulse" />
                    </td>
                    <td className="px-3 py-3 pr-4">
                      <div className="flex items-center gap-1.5">
                        <div className="h-8 w-14 rounded bg-muted animate-pulse" />
                        <div className="h-8 w-16 rounded bg-muted animate-pulse" />
                        <div className="h-8 w-20 rounded bg-muted animate-pulse" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="h-10 w-10 min-h-[44px] min-w-[44px] text-muted-foreground/20" />
                      <p className="text-sm text-muted-foreground">No staff members found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStaff.map((staffAccount) => {
                  const role = getStaffRole(staffAccount);
                  const shiftStatus = getStaffShiftStatus(staffAccount);

                  return (
                    <tr key={staffAccount.id} className="border-b border-border transition-colors last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {getInitials(staffAccount.fullName)}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-foreground">{staffAccount.fullName}</p>
                            <p className="text-xs text-muted-foreground">{staffAccount.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-mono text-xs text-foreground">@{staffAccount.username}</span>
                      </td>
                      <td className="px-3 py-3">
                        <RoleBadge role={role} />
                      </td>
                      <td className="px-3 py-3">
                        <ShiftStatusBadge status={shiftStatus} />
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs text-muted-foreground">{staffAccount.phoneNumber || "—"}</span>
                      </td>
                      <td className="px-3 py-3">
                        {staffAccount.isActive ? (
                          <Badge className="border-green-200 bg-green-100 px-1.5 py-0 text-xs font-medium text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="px-1.5 py-0 text-xs font-medium text-muted-foreground">
                            Inactive
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-3 pr-4">
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex h-10 min-h-[44px] items-center gap-1 px-2.5 text-xs"
                            onClick={() => openEdit(staffAccount)}
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex h-10 min-h-[44px] items-center gap-1 px-2.5 text-xs"
                            onClick={() => openReset(staffAccount)}
                          >
                            <KeyRound className="h-3 w-3" />
                            Reset PW
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className={`flex h-10 min-h-[44px] items-center gap-1 px-2.5 text-xs ${staffAccount.isActive ? "text-destructive hover:text-destructive" : "text-green-600 hover:text-green-600"}`}
                            onClick={() => setDeactivateTarget(staffAccount)}
                          >
                            {staffAccount.isActive ? <UserMinus className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
                            {staffAccount.isActive ? "Deactivate" : "Reactivate"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="divide-y divide-border md:hidden">
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-3 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 shrink-0 rounded-full bg-muted animate-pulse" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="h-3.5 w-32 rounded bg-muted animate-pulse" />
                    <div className="h-3 w-44 rounded bg-muted animate-pulse" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="h-5 w-16 rounded-full bg-muted animate-pulse" />
                  <div className="h-5 w-16 rounded-full bg-muted animate-pulse" />
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  <div className="h-9 flex-1 rounded bg-muted animate-pulse" />
                  <div className="h-9 flex-1 rounded bg-muted animate-pulse" />
                  <div className="h-9 flex-1 rounded bg-muted animate-pulse" />
                </div>
              </div>
            ))
          ) : filteredStaff.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16">
              <Users className="h-10 w-10 min-h-[44px] min-w-[44px] text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">No staff members found.</p>
            </div>
          ) : (
            filteredStaff.map((staffAccount) => {
              const role = getStaffRole(staffAccount);
              const shiftStatus = getStaffShiftStatus(staffAccount);

              return (
                <div key={staffAccount.id} className="space-y-3 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {getInitials(staffAccount.fullName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-semibold text-foreground">{staffAccount.fullName}</p>
                        <RoleBadge role={role} />
                        <ShiftStatusBadge status={shiftStatus} />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">@{staffAccount.username} · {staffAccount.email}</p>
                      <p className="text-xs text-muted-foreground">Phone: {staffAccount.phoneNumber || "—"} · Created: {formatDate(staffAccount.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-2">
                    <div>
                      {staffAccount.isActive ? (
                        <Badge className="border-green-200 bg-green-100 px-1.5 py-0 text-xs text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="px-1.5 py-0 text-xs text-muted-foreground">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" className="flex h-10 min-h-[44px] items-center gap-1 text-xs px-2" onClick={() => openEdit(staffAccount)}>
                        <Pencil className="h-3 w-3" />
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" className="flex h-10 min-h-[44px] items-center gap-1 text-xs px-2" onClick={() => openReset(staffAccount)}>
                        <KeyRound className="h-3 w-3" />
                        Reset PW
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className={`flex h-10 min-h-[44px] items-center gap-1 text-xs px-2 ${staffAccount.isActive ? "text-destructive hover:text-destructive" : "text-green-600 hover:text-green-600"}`}
                        onClick={() => setDeactivateTarget(staffAccount)}
                      >
                        {staffAccount.isActive ? <UserMinus className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
                        {staffAccount.isActive ? "Deactivate" : "Reactivate"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Staff Dialog */}
      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) {
            resetAddForm();
          }
        }}
      >
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <UserPlus className="h-4 w-4 text-primary" />
              Add Staff Account
            </DialogTitle>
          </DialogHeader>
          <div className="mt-1 space-y-3">
            <Field id="add-name" label="Full Name" value={addName} onChange={setAddName} placeholder="e.g. Maria Santos" required />
            {addErrors.name && <p className="-mt-2 text-xs text-destructive">{addErrors.name}</p>}

            <Field
              id="add-username"
              label="Username"
              value={addUsername}
              onChange={(value) => {
                setAddUsername(value);
                setAddErrors((current) => ({ ...current, username: "", email: "", form: "" }));
              }}
              placeholder="e.g. maria_santos"
              required
            />
            {addErrors.username && <p className="-mt-2 text-xs text-destructive">{addErrors.username}</p>}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block text-xs font-medium">Role</Label>
                <Select value={addRole} onValueChange={setAddRole}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Admin (Purple)</SelectItem>
                    <SelectItem value="Staff">Staff (Teal)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-1.5 block text-xs font-medium">Shift Status</Label>
                <div className="flex h-9 items-center justify-between rounded-md border border-input bg-muted/40 px-3 text-xs">
                  <ShiftStatusBadge status="Off Duty" />
                  <span className="text-[11px] text-muted-foreground">Real-time</span>
                </div>
              </div>
            </div>

            <Field id="add-phone" label="Phone Number" value={addPhone} onChange={setAddPhone} placeholder="+63 9XX XXX XXXX" />

            <Field
              id="add-email"
              label="Email Address"
              value={addEmail}
              onChange={(value) => {
                setAddEmail(value);
                setAddErrors((current) => ({ ...current, email: "", form: "" }));
              }}
              placeholder={getDefaultEmail(addUsername) || "staff@laundrytrack.ph"}
              type="email"
              required
            />
            {addErrors.email && <p className="-mt-2 text-xs text-destructive">{addErrors.email}</p>}

            <PasswordField
              id="add-password"
              label="Password"
              value={addPassword}
              onChange={(value) => {
                setAddPassword(value);
                setAddErrors((current) => ({ ...current, password: "", form: "" }));
              }}
              placeholder="Min. 6 characters"
              required
            />
            {addErrors.password && <p className="-mt-2 text-xs text-destructive">{addErrors.password}</p>}

            <PasswordField
              id="add-confirm-password"
              label="Confirm Password"
              value={addConfirmPassword}
              onChange={(value) => {
                setAddConfirmPassword(value);
                setAddErrors((current) => ({ ...current, confirmPassword: "", form: "" }));
              }}
              placeholder="Re-enter password"
              required
            />
            {addErrors.confirmPassword && <p className="-mt-2 text-xs text-destructive">{addErrors.confirmPassword}</p>}

            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <RoleBadge role={addRole} />
                <ShiftStatusBadge status="Off Duty" />
              </div>
              <span className="text-xs text-muted-foreground">Badge Preview</span>
            </div>

            {addErrors.form && <p className="text-xs text-destructive">{addErrors.form}</p>}

            <Button
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              onClick={() => void handleAddStaff()}
              disabled={addSubmitting}
            >
              {addSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create Staff Account
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Staff Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <Pencil className="h-4 w-4 text-primary" />
              Edit Staff Profile
            </DialogTitle>
          </DialogHeader>
          <div className="mt-1 space-y-3">
            <Field id="edit-name" label="Full Name" value={editName} onChange={setEditName} placeholder="Full name" required />
            <Field id="edit-username" label="Username" value={editUsername} onChange={setEditUsername} placeholder="Username" required />
            <Field id="edit-email" label="Email Address" value={editEmail} onChange={setEditEmail} placeholder="Email address" type="email" required />
            <Field id="edit-phone" label="Phone Number" value={editPhone} onChange={setEditPhone} placeholder="Phone number" />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block text-xs font-medium">Role</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Admin (Purple)</SelectItem>
                    <SelectItem value="Staff">Staff (Teal)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-1.5 block text-xs font-medium">Shift Status</Label>
                <div className="flex h-9 items-center justify-between rounded-md border border-input bg-muted/40 px-3 text-xs">
                  <ShiftStatusBadge status={editTarget ? getStaffShiftStatus(editTarget) : "Off Duty"} />
                  <span className="text-[11px] text-muted-foreground">
                    {editTarget && isStaffOnline(editTarget) ? "Active Now" : "Offline"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div className="flex items-center gap-2">
                {editActive ? <UserCheck className="h-4 w-4 text-green-600" /> : <UserX className="h-4 w-4 text-muted-foreground" />}
                <div>
                  <p className="text-xs font-medium text-foreground">Account Status</p>
                  <p className="text-xs text-muted-foreground">{editActive ? "Active — can log in" : "Inactive — login blocked"}</p>
                </div>
              </div>
              <Switch checked={editActive} onCheckedChange={setEditActive} aria-label="Toggle staff active status" />
            </div>

            {editError && <p className="text-xs text-destructive">{editError}</p>}

            <Button
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              onClick={() => void handleSaveEdit()}
              disabled={editSubmitting}
            >
              {editSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Changes...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <KeyRound className="h-4 w-4 text-primary" />
              Reset Password — {resetTarget?.fullName}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-1 space-y-3">
            <PasswordField
              id="reset-new-pw"
              label="New Password"
              value={newPassword}
              onChange={(value) => {
                setNewPassword(value);
                setPwError("");
              }}
              placeholder="Min. 6 characters"
              required
            />
            <PasswordField
              id="reset-confirm-pw"
              label="Confirm Password"
              value={confirmPassword}
              onChange={(value) => {
                setConfirmPassword(value);
                setPwError("");
              }}
              placeholder="Re-enter new password"
              required
            />
            {pwError && <p className="text-xs text-destructive">{pwError}</p>}
            <Button
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              onClick={() => void handleResetPassword()}
              disabled={resetSubmitting || !newPassword || !confirmPassword}
            >
              {resetSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  Save New Password
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deactivate/Reactivate Alert Dialog */}
      <AlertDialog open={Boolean(deactivateTarget)} onOpenChange={(open) => !open && setDeactivateTarget(null)}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">
              {deactivateTarget?.isActive ? "Deactivate" : "Reactivate"} Staff Account
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              {deactivateTarget?.isActive
                ? `${deactivateTarget?.fullName} will no longer be able to log in. You can reactivate this account at any time.`
                : `${deactivateTarget?.fullName} will be able to log in again.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={deactivateTarget?.isActive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-primary text-primary-foreground hover:bg-primary/90"}
              onClick={() => void handleDeactivate()}
              disabled={deactivateSubmitting}
            >
              {deactivateSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : deactivateTarget?.isActive ? (
                "Deactivate"
              ) : (
                "Reactivate"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  return (
    <Skeleton name="staff-management" loading={loading} fallback={content}>
      {content}
    </Skeleton>
  );
}
