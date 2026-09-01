# Redesign Plan - Phase 3: Transactions & Claimed Records (UPDATED)

## Summary
Re-skin the New Order wizard (3 steps), separate the Records page into dedicated tabs ("Transactions" vs "Claimed"), and style the Print Receipt modal.

## User Decision on Flow
- **Separate Claimed Tab:** The active transactions list should NOT mix claimed orders into the default view.
- Introduce a top tab switcher:
  - **Transactions tab:** Active orders (Received, Washing, Drying, Ready, Voided) with search and filters.
  - **Claimed tab:** Dedicated view for completed & claimed orders.
- Color & visual styling matching the reference screenshots.

## Reference Images
- reference_image/neworder.png (Step 1 - Customer Info)
- reference_image/new order step2.png (Step 2 - Service Details)
- reference_image/neworderstep3.png (Step 3 - Summary)
- reference_image/recordstrnsac.png (Active Transactions tab)
- reference_image/recordsclaimed.png (Claimed tab)
- reference_image/receiptneworder.png (Receipt modal)

---

## What Changes

### 1. Tab Bar on Records / Transactions Page
- Top tab switcher with active purple underline (`border-b-2 border-primary text-primary font-semibold`)
- Tabs: **Transactions** | **Claimed**
- Switching tabs toggles between:
  - **Transactions tab view:** Active orders filter bar & list
  - **Claimed tab view:** Claimed order cards with claim/completion details

### 2. New Order Form (Steps 1-3)
- Step bubbles:
  - Completed step: bg-primary text-primary-foreground (purple + checkmark)
  - Current step: bg-primary text-primary-foreground (purple + step number)
  - Future step: bg-muted text-muted-foreground
- Toggle buttons (By the Kilo / By the Load): selected gets soft purple tint (`bg-primary/10 text-primary border-primary`)
- Form buttons: Purple primary buttons

### 3. Record Cards & Badges
- Ticket ID: Soft purple badge / font link
- Paid badge: `bg-green-100 text-green-700`
- Unpaid badge: `bg-red-100 text-red-700`
- Status badge colors:
  - Received: Purple (`bg-purple-100 text-purple-700`)
  - Washing: Blue (`bg-blue-100 text-blue-700`)
  - Drying: Amber (`bg-amber-100 text-amber-700`)
  - Ready: Green (`bg-green-100 text-green-700`)
  - Claimed: Gray (`bg-gray-100 text-gray-700`)

### 4. Print Receipt Modal
- Thermal receipt preview preserved for exact printing
- Action buttons updated to theme tokens

---

## What Must NOT Change
- All business logic, price calculation, and ticket creation handlers
- Zod validation and input constraints
- Receipt thermal print functionality and QR rendering

## Verification Checklist
- [ ] `tsc --noEmit` passes with 0 errors
- [ ] Transactions tab displays active non-claimed orders
- [ ] Claimed tab displays claimed orders separately
- [ ] 3-step order wizard works start to finish
- [ ] Receipt modal prints properly
