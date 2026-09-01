# Redesign Plan - Phase 4: Processing Queue (3-Stage Workflow)

## Summary
Re-skin the Processing Queue page to match the reference screenshot with exactly 3 active stages: Received -> Washed -> Ready. Color and component styling updates with 3 primary stage cards.

## User Workflow Decision (Confirmed)
- **3-Stage Process:**
  1. **Received** (Purple - `bg-purple-100 text-purple-700`)
  2. **Washed** (Blue - `bg-blue-100 text-blue-700`)
  3. **Ready** (Green - `bg-green-100 text-green-700`)
  *(Followed by Claimed upon verification/pickup)*

## Reference Images
- reference_image/processing.png (Shows exactly 3 stage cards: Received, Washed/Washing, Ready)

---

## What Changes

### 1. Stage Badge & Card Accent Colors
- **Received:** Purple (`bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300`)
- **Washed:** Blue (`bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300`)
- **Ready:** Green (`bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300`)
- **Claimed:** Gray (`bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400`)
- **Voided:** Red (`bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300`)

### 2. Stage Cards & Top Metric Card
- **"Total Ongoing Transactions" Card:** White background with subtle border, count pill in `bg-primary/10 text-primary`
- **3 Horizontal Stage Cards (Received, Washed, Ready):** Grid layout with 3 stage cards matching the reference image layout.
  - Active expanded card gets matching border accent + soft warm background
- **"Waiting Xh" Badge:** Amber alert badge (`bg-amber-100 text-amber-800`)

### 3. Dropdowns & Action Modals
- "Update Status" dropdown menu: styled with warm background, icons, and rounded corners
- "Confirm Claim / Void" dialog: theme-based buttons and clean card styling

---

## What Must NOT Change
- 30-second auto-refresh timer and manual refresh button
- Real-time time-in-stage calculation (`formatTimeInStage`)
- Stage expand/collapse logic
- Status transition handlers and loyalty stamp award notifications
- Mobile Status Update Sheet (`StatusUpdateSheet`)

---

## Verification Checklist
- [ ] `tsc --noEmit` passes with zero errors
- [ ] 3 stage cards (Received, Washed, Ready) render correct counts matching reference layout
- [ ] Expanding each stage reveals the table / mobile card view
- [ ] Status dropdown can advance orders through each stage
- [ ] Confirmation dialog appears for irreversible statuses (Claimed/Voided)
- [ ] Light & dark mode verified
