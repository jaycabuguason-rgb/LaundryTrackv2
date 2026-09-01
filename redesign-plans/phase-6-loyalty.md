# Redesign Plan - Phase 6: Loyalty (Members & Rewards)

## Summary
Re-skin the Loyalty page (Members list/cards, member detail drilldown, stamp progression, and add/edit modals). Color and component styling updates only; all stamp mechanics, member API interactions, and reward tracking remain unchanged.

## Reference Images
- reference_image/members and reward.png
- reference_image/members and reward step2.png
- reference_image/rewards.png

---

## What Changes

### 1. Member Cards & Avatars
- **Avatar Circle:** Purple background with bold white initials (`bg-primary text-primary-foreground font-bold`)
- **Stamp Progress Pill:** Golden amber chip (`bg-amber-100 text-amber-800 border-amber-200`)
- **Cycle Progress Bar:** Purple fill (`bg-primary`) on warm track (`bg-muted`)
- **Stamp Dots/Icons:** Filled with theme purple/gold, unfilled with soft border
- **Stats Row (Visits, kg Washed, Rewards):** Bold dark numbers with muted labels
- **Card Actions:** Outlined Edit / Delete buttons with warm hover states

### 2. Member Detail Drilldown View
- Back button with clean text and chevron
- Profile overview card with total stamps and rewards summary
- Service history and reward history tables styled with warm headers (`bg-muted/40`)

### 3. Modals & Dialogs
- **Add / Edit Member Dialogs:** Warm input borders and purple primary save buttons
- **Add Stamps Dialog:** Clean number input and submit button
- **Delete Confirmation Alert:** Standard destructive dialog

---

## What Must NOT Change
- Member API routes (`/api/loyalty`, `/api/loyalty/[id]`, `/api/loyalty/[id]/stamps`)
- Real-time search by name or phone
- Stamp cycle threshold calculation (e.g. 7 or 10 stamps per cycle)
- Session token retrieval and auth headers

---

## Verification Checklist
- [ ] `tsc --noEmit` passes with zero errors
- [ ] Members card list renders with purple avatar circles and amber stamp pills
- [ ] Clicking a member opens the detail view with full history
- [ ] Add Member modal opens, accepts input, and submits
- [ ] Edit / Delete / Add Stamps modals function properly
- [ ] Light & dark mode verified
