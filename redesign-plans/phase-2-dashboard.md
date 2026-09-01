# Redesign Plan — Phase 2: Dashboard

## Summary
Re-skin the Dashboard page to match the reference images. Color/style changes only — no logic, layout, or feature changes.

## Reference Images
- `reference_image/dashboard.png`
- `reference_image/dashboard 2.png`

---

## What Changes

### `components/pages/dashboard.tsx`

#### KPI Cards — icon background and color (currently hardcoded, must use theme tokens)
Replace hardcoded Tailwind color classes with theme-aware equivalents:

| Card | Current bg | New bg | Current icon color | New icon color |
|---|---|---|---|---|
| Total Transactions Today | `bg-blue-50` | `bg-primary/10` | `text-blue-600` | `text-primary` |
| Total Revenue Today | `bg-green-50` | `bg-chart-4/10` | `text-green-600` | `text-chart-4` (or `text-green-600` kept) |
| Ready for Pickup | `bg-orange-50` | `bg-chart-3/10` | `text-orange-600` | `text-chart-3` |
| Active Orders | `bg-purple-50` | `bg-primary/10` | `text-purple-600` | `text-primary` |

#### Loyalty Members card icon (currently hardcoded yellow)
- `bg-yellow-50` → `bg-accent/10`
- `text-yellow-600` → `text-accent-foreground`

#### Table header row — already uses theme tokens, no change needed
- `bg-muted/40` ✅ keep as-is

#### Table row hover — already uses theme tokens, no change needed
- `hover:bg-muted/30` ✅ keep as-is

---

### `components/peak-hours-chart.tsx`

Replace ALL hardcoded color values:

| Element | Current (hardcoded) | New value |
|---|---|---|
| Bar fill | `#3b82f6` | `hsl(257 58% 49%)` (matches `--primary`) |
| Grid line stroke | `#e2e8f0` | Use inline style `var(--border)` or `hsl(33 18% 82%)` |
| X-axis tick color | `#94a3b8` | `hsl(251 18% 49%)` (matches `--muted-foreground`) |
| Y-axis tick color | `#94a3b8` | `hsl(251 18% 49%)` |
| Tooltip hover cursor fill | `rgba(59,130,246,0.06)` | `hsl(257 58% 49% / 0.06)` |
| Tooltip border | `1px solid #e2e8f0` | `1px solid hsl(33 18% 82%)` |

---

### `lib/data.ts` — `statusColors` object

Update status badge Tailwind classes to match reference image palette:

```ts
export const statusColors: Record<string, string> = {
  Received: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  Washing:  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  Drying:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  Ready:    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  Claimed:  "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
};
```

---

## What Must NOT Change

- All 4 KPI cards still show the same live data
- Clicking a ticket ID still opens the detail modal (`TransactionDetailModal`)
- Table still has all columns: Ticket ID, Customer, Drop-off, Type, Status, Actions
- Staff users (`role === "staff"`) still see 3 cards instead of 4
- Peak Hours chart still renders the same bar chart with same data keys
- Loyalty Members card still shows count + enabled/disabled badge
- Quick Links still call `onNavigate("reports")` and `onNavigate("staff-management")`
- Mobile card list view (the `md:hidden` block) still works

---

## Files Touched in Phase 2

| File | What changes |
|---|---|
| `components/pages/dashboard.tsx` | KPI card icon colors, loyalty card icon color |
| `components/peak-hours-chart.tsx` | Bar/grid/axis colors updated to theme values |
| `lib/data.ts` | `statusColors` object updated to new palette |

---

## Rules for the Executing Agent

1. **Color values only** — do not change JSX structure, props, or logic
2. **Run `tsc --noEmit`** — must pass with zero errors
3. **Do NOT rename or remove** `statusColors`, data keys in Recharts, or any state variables
4. Commit with message: `style: redesign phase 2`

---

## Verification Checklist
- [ ] `tsc --noEmit` passes
- [ ] All 4 KPI cards render with correct numbers and new icon colors
- [ ] Status badges: Received=purple, Washing=blue, Drying=amber, Ready=green, Claimed=gray
- [ ] Peak hours chart renders with purple bars (not blue)
- [ ] Clicking ticket ID opens the detail modal
- [ ] Light mode and dark mode both look correct
- [ ] Staff role still hides Revenue card
