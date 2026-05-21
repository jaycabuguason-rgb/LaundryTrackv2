"use client";

import { useMemo, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useStaffAccounts } from "@/hooks/use-staff-accounts";
import type { CreateStaffAccountInput, StaffAccountSummary } from "@/lib/staff-contracts";

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
          className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
          tabIndex={-1}
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

export default function StaffManagementPage() {
  const { toast } = useToast();
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
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [search, staff]);

  const resetAddForm = () => {
    setAddName("");
    setAddUsername("");
    setAddPhone("");
    setAddEmail("");
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
      setAddOpen(false);
      resetAddForm();
      toast({
        title: "Staff account created",
        description: `${staffAccount.fullName} has been added.`,
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

  return (
    <div className="w-full max-w-5xl space-y-5">
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Staff Members</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {staff.length} staff account{staff.length !== 1 ? "s" : ""} · {staff.filter((item) => item.isActive).length} active
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <div className="relative min-w-0 flex-1 sm:w-52 sm:flex-none">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search staff..."
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
            className="flex h-9 shrink-0 items-center gap-1.5 text-xs"
            onClick={() => {
              resetAddForm();
              setAddOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Staff
          </Button>
        </div>
      </div>

      {!usingSupabase && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
          Supabase is not configured in this browser session, so staff management is currently running in demo mode.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Name</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">Username</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">Phone Number</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">Date Created</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-3 py-3 pr-4 text-left text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <p className="text-sm">Loading staff accounts...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="h-8 w-8 text-muted-foreground/20" />
                      <p className="text-sm text-muted-foreground">No staff members found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStaff.map((staffAccount) => (
                  <tr key={staffAccount.id} className="border-b border-border transition-colors last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                          {getInitials(staffAccount.fullName)}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground">{staffAccount.fullName}</p>
                          <p className="text-[11px] text-muted-foreground">{staffAccount.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs font-mono text-foreground">@{staffAccount.username}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs text-muted-foreground">{staffAccount.phoneNumber || "—"}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs text-muted-foreground">{formatDate(staffAccount.createdAt)}</span>
                    </td>
                    <td className="px-3 py-3">
                      {staffAccount.isActive ? (
                        <Badge className="border-green-200 bg-green-100 px-1.5 py-0 text-[10px] font-medium text-green-700">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-medium text-muted-foreground">
                          Inactive
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-3 pr-4">
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex h-7 items-center gap-1 px-2.5 text-[11px]"
                          onClick={() => openEdit(staffAccount)}
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex h-7 items-center gap-1 px-2.5 text-[11px]"
                          onClick={() => openReset(staffAccount)}
                        >
                          <KeyRound className="h-3 w-3" />
                          Reset PW
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className={`flex h-7 items-center gap-1 px-2.5 text-[11px] ${staffAccount.isActive ? "text-destructive hover:text-destructive" : "text-green-600 hover:text-green-600"}`}
                          onClick={() => setDeactivateTarget(staffAccount)}
                        >
                          {staffAccount.isActive ? <UserMinus className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
                          {staffAccount.isActive ? "Deactivate" : "Reactivate"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-border md:hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Loading staff accounts...</p>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16">
              <Users className="h-8 w-8 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">No staff members found.</p>
            </div>
          ) : (
            filteredStaff.map((staffAccount) => (
              <div key={staffAccount.id} className="space-y-3 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {getInitials(staffAccount.fullName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold text-foreground">{staffAccount.fullName}</p>
                      {staffAccount.isActive ? (
                        <Badge className="border-green-200 bg-green-100 px-1.5 py-0 text-[10px] text-green-700">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="px-1.5 py-0 text-[10px] text-muted-foreground">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">@{staffAccount.username} · {staffAccount.phoneNumber || "—"}</p>
                    <p className="text-[11px] text-muted-foreground">Created: {formatDate(staffAccount.createdAt)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="flex h-8 items-center gap-1 text-xs" onClick={() => openEdit(staffAccount)}>
                    <Pencil className="h-3 w-3" />
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" className="flex h-8 items-center gap-1 text-xs" onClick={() => openReset(staffAccount)}>
                    <KeyRound className="h-3 w-3" />
                    Reset PW
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={`flex h-8 items-center gap-1 text-xs ${staffAccount.isActive ? "text-destructive hover:text-destructive" : "text-green-600 hover:text-green-600"}`}
                    onClick={() => setDeactivateTarget(staffAccount)}
                  >
                    {staffAccount.isActive ? <UserMinus className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
                    {staffAccount.isActive ? "Deactivate" : "Reactivate"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

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
            <DialogTitle className="flex items-center gap-2 text-sm">
              <UserPlus className="h-4 w-4" />
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

            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
              <div>
                <p className="text-xs font-medium text-foreground">Role</p>
                <p className="text-[11px] text-muted-foreground">Cannot be changed to Admin</p>
              </div>
              <Badge variant="secondary" className="bg-teal-100 text-xs font-medium text-teal-700">
                Staff
              </Badge>
            </div>

            {addErrors.form && <p className="text-xs text-destructive">{addErrors.form}</p>}

            <Button className="w-full" onClick={() => void handleAddStaff()} disabled={addSubmitting}>
              {addSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create Account
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Pencil className="h-4 w-4" />
              Edit Staff Profile
            </DialogTitle>
          </DialogHeader>
          <div className="mt-1 space-y-3">
            <Field id="edit-name" label="Full Name" value={editName} onChange={setEditName} placeholder="Full name" required />
            <Field id="edit-username" label="Username" value={editUsername} onChange={setEditUsername} placeholder="Username" required />
            <Field id="edit-email" label="Email Address" value={editEmail} onChange={setEditEmail} placeholder="Email address" type="email" required />
            <Field id="edit-phone" label="Phone Number" value={editPhone} onChange={setEditPhone} placeholder="Phone number" />

            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <div className="flex items-center gap-2">
                {editActive ? <UserCheck className="h-4 w-4 text-green-600" /> : <UserX className="h-4 w-4 text-muted-foreground" />}
                <div>
                  <p className="text-xs font-medium text-foreground">Account Status</p>
                  <p className="text-[11px] text-muted-foreground">{editActive ? "Active — can log in" : "Inactive — login blocked"}</p>
                </div>
              </div>
              <Switch checked={editActive} onCheckedChange={setEditActive} aria-label="Toggle staff active status" />
            </div>

            {editError && <p className="text-xs text-destructive">{editError}</p>}

            <Button className="w-full" onClick={() => void handleSaveEdit()} disabled={editSubmitting}>
              {editSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <KeyRound className="h-4 w-4" />
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
            <Button className="w-full" onClick={() => void handleResetPassword()} disabled={resetSubmitting || !newPassword || !confirmPassword}>
              {resetSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  Reset Password
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
              className={deactivateTarget?.isActive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
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
}
