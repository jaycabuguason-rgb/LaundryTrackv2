# Redesign Plan - Phase 8: Staff & Audit Logs (Unified Page with 2 Tabs)

## Summary
Unify Staff Management and Audit Logs into a single **Staff & Audit Logs** page with a 2-tab switcher (`[Staff] | [Audit Logs]`), matching the reference screenshots. All existing staff management and audit log functionalities are preserved as-is.

## Reference Images
- reference_image/staff and audit.png (`[Staff]` tab)
- reference_image/audit.png (`[Audit Logs]` tab)

---

## What Changes

### 1. Page Header & Tab Bar
- Main Title: **Staff & Audit Logs** (Subtitle: *Team management and system activity*)
- Top Tab Switcher:
  - `[Staff]` -> Shows staff members, roles, shift statuses, and "+ Add Staff" action.
  - `[Audit Logs]` -> Shows audit log filters, action icons, and activity history table.
- Active tab indicator: Purple underline (`border-b-2 border-primary text-primary font-semibold`).

### 2. Styling Skin
- Clean white cards with warm borders.
- Staff role badges and shift chips styled with theme tokens.
- Add Staff and Reset Password dialogs inherit warm modal tokens.

---

## What Must NOT Change
- All staff account creation, update, and deactivation API handlers
- Audit log query filtering, sorting, and export capabilities
- Role-based permissions and admin security controls

---

## Verification Checklist
- [ ] `tsc --noEmit` passes with zero errors
- [ ] Tab switcher toggles cleanly between Staff and Audit Logs
- [ ] Staff card actions (Add Staff, Edit, Password Reset) work properly
- [ ] Audit logs table renders live activity events
