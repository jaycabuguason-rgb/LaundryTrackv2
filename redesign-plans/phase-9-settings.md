# Redesign Plan - Phase 9: Settings (Pricing & Business Profile Tabs)

## Summary
Re-skin the Settings page into a clean 2-tab layout (`[Pricing] | [Business Profile]`), matching the reference screenshots. Pricing tiers, price per kg, business information, offline sync indicator, and save workflows remain fully intact.

## Reference Images
- reference_image/setting.png (`[Pricing]` tab)
- reference_image/bussinessprofile.png (`[Business Profile]` tab)

---

## What Changes

### 1. Page Header & Tab Bar
- Main Title: **Settings** (Subtitle: *Business profile, pricing, and sync*)
- Top Tab Switcher:
  - `[Pricing]` -> Base pricing mode, Price/kg, Min weight, Per-load tiers table, Add custom tier.
  - `[Business Profile]` -> Shop Name, Tagline, Address, Phone, Email, Logo uploader, Receipt footer & instructions.
- Active tab indicator: Purple underline (`border-b-2 border-primary text-primary font-semibold`).

### 2. Pricing Tab Styling
- Mode selector (`Per Kilogram | Per Load | Both`): Active mode gets soft purple tint (`bg-primary/10 border-primary text-primary font-semibold`).
- Per-load tiers table & add custom tier card styled with warm borders and clean inputs.
- Bottom floating sync/save bar with online badge and purple "Save Pricing" button.

### 3. Business Profile Tab Styling
- Form inputs in clean white cards with warm borders.
- Logo upload box with live preview.
- Bottom floating save bar with purple "Save Business Profile" button.

---

## What Must NOT Change
- Pricing math calculations and load tier configuration
- Offline settings sync engine and mutation queue
- Business profile persistence to localStorage and Supabase
- Backup download and restore tools

---

## Verification Checklist
- [ ] `tsc --noEmit` passes with zero errors
- [ ] Switching between Pricing and Business Profile tabs works smoothly
- [ ] Saving pricing updates store and displays success toast
- [ ] Saving business profile updates receipt header/footer dynamically
- [ ] Light & dark mode verified
