# Redesign Plan - Phase 7: Reports (Tab in Unified Records Page)

## Summary
Integrate the Reports & Analytics feature as a dedicated tab inside the unified **Records** page (`[Transactions] | [Claimed] | [Verify] | [Reports]`), matching the reference screenshots. All existing reports functionality, charts, sub-tabs, and PDF export logic are preserved **as-is**.

## Reference Images
- reference_image/reports.png (Shows "Records" top title with `Transactions | Claimed | Verify | Reports` tab bar)

---

## What Changes (Page Structure & Skin)

### 1. Unified Records Page Integration
- Under the **Records** page, the top tab switcher includes:
  - `Transactions`
  - `Claimed`
  - `Verify`
  - `Reports`
- When clicking `Reports`:
  - Renders the full Reports & Analytics dashboard.
  - Active tab styling: Theme purple indicator (`border-b-2 border-primary text-primary font-semibold`).

### 2. Internal Reports View (Kept As-Is with Theme Skin)
- Preserves all 5 existing report sub-tabs:
  1. `Daily Summary`
  2. `Sales Analytics`
  3. `Forecast`
  4. `Unclaimed Items`
  5. `Export`
- Color tokens & card containers automatically inherit the warm theme background and white cards from Phase 1.

---

## What Must NOT Change
- All report analytics calculations, date ranges, and aggregations
- Recharts data keys and rendering structures
- PDF export generation logic and download triggers (`components/report-pdf.tsx`)
- Unclaimed items filtering and forecast estimation models

---

## Verification Checklist
- [ ] `tsc --noEmit` passes with zero errors
- [ ] Navigating to Records -> `Reports` tab displays the complete reports dashboard
- [ ] All 5 internal sub-tabs (Daily Summary, Sales, Forecast, Unclaimed, Export) switch smoothly
- [ ] Charts render correctly with live transaction data
- [ ] PDF export button generates and downloads report
