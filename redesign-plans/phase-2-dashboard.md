# Redesign Plan - Phase 2: Dashboard

## Summary
Re-skin the Dashboard page (KPI stat boxes, Recent Transactions table, and Peak Hours chart) to match the reference screenshots.

## Reference Images
- reference_image/dashboard.png
- reference_image/dashboard 2.png

## Scope & Files
- `components/pages/dashboard.tsx` (KPI card icon backgrounds, recent orders table, loyalty quick card)
- `components/peak-hours-chart.tsx` (Update chart bar colors from blue to purple theme token)
- `lib/data.ts` (Update `statusColors` map: Received=Purple, Washing=Blue, Ready=Green, Claimed=Gray, Voided=Red)

## Verification Checklist
- [ ] `tsc --noEmit` passes with 0 errors
- [ ] 4 KPI cards render with theme-colored icon boxes
- [ ] Peak Hours chart renders purple bars
- [ ] Recent transactions table displays correct status badge colors
- [ ] Ticket detail modal opens upon clicking ticket ID
