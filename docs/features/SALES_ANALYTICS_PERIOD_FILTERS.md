# Sales Analytics Period Filters - Design

## Goal
Add Day / Week / Month / Year preset buttons to the **Sales Analytics** tab so
the sales report can be viewed across different date ranges, matching the user
request: *"in the report part i want to change like it can see different filters
like day-week-month-year"*.

## Scope
- **Sales Analytics tab only.** Daily Summary, Unclaimed, and the Export tab's
  own buttons are out of scope.
- Sales Analytics already computes most cards from `filteredTransactions`, which
  is derived from `exportFromDate`/`exportToDate`. The presets will reuse that
  shared date range so **all** analytics cards (Orders in Range, Average Order
  Value, Sales Trend, Service Mix, Payment Split, Status Mix) respond to the
  selected period.

## Semantics
Rolling windows (relative to today), not calendar periods:

| Preset | Range                          |
|--------|--------------------------------|
| Day    | `[today, today]`               |
| Week   | `[today - 6 days, today]`      |
| Month  | `[today - 29 days, today]`     |
| Year   | `[today - 364 days, today]`    |

Default preset: **Month**.

## Changes (all in `components/pages/reports.tsx`)

### 1. Date helpers / state
- Extend the `date-fns` import with `addMonths` (used for Year bucketing).
- Add state: `const [rangePreset, setRangePreset] = useState<"day" | "week" | "month" | "year">("month");`
- Add `periodRanges` lookup keyed by preset returning `{ from: Date; to: Date }`.
- Add `applyPreset(preset)` that sets `rangePreset` and syncs
  `setExportFromDate`/`setExportToDate` to the preset range.

### 2. Period button row (UI)
Insert a "Period:" label + four `Button`s just above the Sales Analytics
summary-card grid (currently ~line 434). Active preset renders
`variant="default"`; inactive `variant="outline"`. Buttons call
`applyPreset("day" | "week" | "month" | "year")`.

### 3. Sales Trend chart follows period
Rewrite the `salesTrendData` memo (~line 175) to bucket transactions by the
selected preset using `filteredTransactions` (respects the shared date range):

- **Day**: hourly buckets reusing `getHourLabel(transaction.arrivalDateTime)`;
  seed 24 labels `12AM` … `11PM`, zero-filled.
- **Week / Month**: daily buckets keyed by `dropOffDate`, seeded for every date
  between `exportFromDate` and `exportToDate`.
- **Year**: monthly buckets (`format(date, "MMM yyyy")`), seeded by walking
  `addMonths(exportFromDate, i)` through `exportToDate`.

Each bucket accumulates `revenue` and `count`. The `BarChart` at ~line 474 is
unchanged except its `data` prop now reflects the selected period.

## Interaction with Export tab
Because Sales Analytics and the Export tab share `exportFromDate`/
`exportToDate`, clicking a preset also updates the Export tab's Start/End date
pickers (lines 776-794). This is intended and consistent: PDF/CSV export range
mirrors the selected period. Manual date-picker edits keep working; they change
the visible analytics range without flipping `rangePreset` (preset highlight
just stays on its last value).

## Accepted divergence
Current default `exportFromDate` is `subDays(new Date(), 30)` (31-day window).
The Month preset uses `subDays(today, 29)` (30-day window). This small
difference is accepted; the preset is authoritative once clicked.

## Verification
- `npm run lint`
- `npm run build`
- Manual: switch each preset and confirm summary cards + Sales Trend buckets
  change accordingly; confirm Export tab dates mirror the preset.