# Redesign Plan - Phase 5: Claim Verification (Claimed History Focus)

## Summary
In Claim Verification, do NOT change any scanner logic, lookup flow, or claim verification functionality. Strictly re-skin the **Claimed History** table / list view to match the clean card styling from the reference screenshot.

## User Directive (Confirmed)
- **Scanner & Verification Logic:** 100% untouched.
- **Scope:** Re-skin the **Claimed History list** display (clean rows, purple ticket chips, timestamps, formatted currency amounts, and warm background tokens).

## Reference Images
- reference_image/verify.png (Shows "Claimed History" with items claimed via scanner or filed manually)

---

## What Changes

### 1. Claimed History List Styling
- **Card Container:** Clean white card with warm border (`border-border bg-card`)
- **Row Presentation:**
  - **Ticket ID:** Soft purple badge chip (`bg-primary/10 text-primary font-mono font-semibold px-2 py-0.5 rounded`)
  - **Customer Name:** Bold text (`font-medium text-foreground`)
  - **Timestamp:** Subtle muted text (`text-muted-foreground text-xs`)
  - **Total Amount:** Bold currency text (`font-semibold text-foreground`)
  - **Row Hover:** `hover:bg-muted/30` with subtle divider borders

### 2. General Theme Tokens
- Search input & action buttons use standard theme tokens from Phase 1.

---

## What Must NOT Change
- QR scanner `<video>` & `<canvas>` camera stream refs
- `jsQR` and `BarcodeDetector` scanning loops
- Lookup by ticket ID and public tracking token
- Payment status toggle (Paid / Unpaid) logic
- "Mark as Claimed" update handler and audit log saving

---

## Verification Checklist
- [ ] `tsc --noEmit` passes with zero errors
- [ ] QR scanner works with camera
- [ ] Manual search still finds tickets
- [ ] Claimed history list renders rows in the new purple/warm card styling
- [ ] Light & dark mode verified
