# Community pain research — table filtering (N1)

Scope: row filtering across AG Grid, TanStack Table, MUI X (DataGrid), PrimeNG (Table/TreeTable),
mirroring the library set used in `docs/0-product/grouping.md`. All issue numbers, states, dates,
and 👍 counts below were fetched via `gh issue view` / `gh api search/issues` against the live
repos on 2026-09-10, or via WebFetch of the GitHub page. Anything I could not verify is marked
**unverified**.

Internal design context this is being checked against: `createFilters()` ships typed kinds
(`equals`, `contains`, `inRange`, `inDateRange`, `hasAny`, `hasNone`, `filter`, `anyOf`,
`applyWhen`) but deliberately does **not** ship a runtime operator picker, a second filter per
column, debounce, persistence, or data-derived filter options (distinct-value "set filter"
pickers). Themes below flag where community pain lines up with one of those deliberate gaps.

---

## Theme 1 — "Select all" / bulk selection breaks under an active filter

The single most-repeated collision across libraries: selecting/deselecting "all" rows while a
filter is applied either selects the *unfiltered* full set, or silently drops previously-selected
rows outside the current filter.

- MUI X **[#976](https://github.com/mui/mui-x/issues/976)** — "Select All checkbox selects all
  rows instead of filtered rows." Closed (opened 2021-02-03, closed via PR #1020), 👍 2. Maintainer
  (`oliviertassinari`) called it out as making "selection + filtering effectively useless when
  used in combination," and cross-linked it to a second open issue on the same root cause.
- MUI X **[#1141](https://github.com/mui/mui-x/issues/1141)** — "Select All feature does not work
  on column filtering": works for one filter, breaks once a second filter is added. Closed
  (2021-03-01 → 2022-05-27), 👍 1.
- MUI X **[#14074](https://github.com/mui/mui-x/issues/14074)** — `checkboxSelectionVisibleOnly`
  doesn't accumulate selection after applying filters (selecting page 1 under a filter, then
  changing the filter, loses page-1 selections instead of accumulating). Closed, but still updated
  as recently as 2026-05-12 — evidence the underlying selection+filter interaction keeps recurring
  even after "fixes."
- MUI X **[#1863](https://github.com/mui/mui-x/issues/1863)** — "Filter and check all Checkbox
  selects all items" (duplicate framing of #976).
- AG Grid **[#2139](https://github.com/ag-grid/ag-grid/issues/2139)** — "Select all checkbox is
  not working with filters and pagination." Closed, 👍 5, but still receiving activity through
  2025-06-20 — a 7-year-old bug class still being poked at.
- AG Grid **[#7440](https://github.com/ag-grid/ag-grid/issues/7440)** — "select all in column
  filter, select filter values not working well." Closed, 2024-01-16 → 2024-02-19, 0 reactions.
- AG Grid **[#3555](https://github.com/ag-grid/ag-grid/issues/3555)** — "Filtering after selection
  not updating selection": once you filter, previously-selected rows outside the filter aren't
  reconciled. Closed 2019 → last touched 2024-01-21.
- TanStack Table **[#2210](https://github.com/TanStack/table/issues/2210)** — `selectedFlatRows` is
  an empty array after filtering. Closed, 👍 13.
- TanStack Table **[#4781](https://github.com/TanStack/table/issues/4781)** — "Pagination and Row
  Selection": `getIsAllRowsSelected()` reports true when only the current page is selected, and
  `getToggleAllRowsSelectedHandler()` vs `getToggleAllPageRowsSelectedHandler()` is confusable.
  Closed, 👍 11, still being commented on as of 2026-08-05.

**Read for our design:** this is a cross-library, decade-spanning failure mode, not a one-off bug.
`withFiltering()` should be explicit and tested about what "select all" means once a filter is
active (all matching rows vs. current page), and what happens to selections that fall outside a
newly-applied filter (drop vs. retain-but-hide) — because every library above shipped the wrong
default at least once and is still fielding reports about it.

## Theme 2 — Feature requests that resurface and stay open: filter UI/operator power

The clearest "unmet need" signal — long-open, high-👍 feature requests asking for exactly the kind
of operator/composition surface our internal design deliberately does *not* expose at runtime.

- MUI X **[#4217](https://github.com/mui/mui-x/issues/4217)** — "Support filter group / query
  builder" (AND/OR nesting across columns in the filter panel UI). **Open** since 2022-03-17, 👍 33,
  14 comments, still being updated 2026-08-28. This is the single clearest "closed-as-hard,
  never fully met" filtering request in the MUI X tracker.
- MUI X **[#9243](https://github.com/mui/mui-x/issues/9243)** — "Support `inAnyOf` operator in
  header filters" (i.e., our `hasAny`, but exposed as a pickable runtime operator in the quick/
  header filter UI, not just the full filter panel). **Open**, 👍 11, opened 2023-06-06, still
  updated 2025-11-25.
- MUI X **[#6419](https://github.com/mui/mui-x/issues/6419)** — "Improve the filtering panel UX
  and DX." **Open**, 👍 10, opened 2022-10-07, still active 2026-04-23.
- MUI X **[#13610](https://github.com/mui/mui-x/issues/13610)** — "Add more filter operators."
  **Open**, 👍 9.
- MUI X **[#14897](https://github.com/mui/mui-x/issues/14897)** — "Improve filtering logic and
  UI." **Open**, 👍 9.
- By contrast, MUI X **[#201](https://github.com/mui/mui-x/issues/201)** "Implement multi-column
  filter" and **[#202](https://github.com/mui/mui-x/issues/202)** "Implement Quick filter" each sit
  at 👍 648 — the two highest-reaction filtering asks in the repo — but both are **closed**
  because the feature eventually shipped (201 closed 2021-01-29 after 5 months; 202 closed
  2021-10-11 after ~14 months). Read together with the still-open items above: shipping the
  *baseline* capability (any column filter at all; a single global quick filter) resolves the
  loudest demand, but a smaller, persistent minority keeps asking for compositional power (AND/OR
  groups, more operators, `anyOf` in the lightweight UI) that baseline shipping doesn't satisfy.

**Read for our design:** `createFilters()` already models `anyOf`/`hasAny`/`applyWhen` as
composable primitives at the API level — which is ahead of where MUI X's *primitive* layer sits.
The gap these issues actually point at is UI, not engine: a runtime operator picker and an
OR/group builder are the two capabilities people keep re-requesting once the basic filter ships.
Since we deliberately don't ship a runtime operator picker, that's a known, named trade-off — not
an oversight — but it's the exact shape of what stays open-and-wanted elsewhere.

## Theme 3 — Global/quick filter correctness bugs (recurring, cross-library)

A high volume of *closed* but high-reaction bugs cluster around the naive "stringify and
substring-match every cell" implementation of global/quick filter — precisely the shortcut a
"quick filter" is expected to take.

- TanStack Table **[#4280](https://github.com/TanStack/table/issues/4280)** — "Global filter gives
  `TypeError: l.toLowerCase is not a function` when using number fields." Closed, 👍 **29** — the
  highest-reaction filtering bug in the TanStack tracker.
- TanStack Table **[#4610](https://github.com/TanStack/table/issues/4610)** — "Cannot read
  properties of undefined (reading 'filter')." Closed, 👍 14.
- TanStack Table **[#4919](https://github.com/TanStack/table/issues/4919)** — "Filter not working
  if `accessorFn` returns null for any row." Closed, 👍 10, still getting updates through
  2026-08-02.
- TanStack Table **[#4673](https://github.com/TanStack/table/issues/4673)** — "Global filter
  doesn't run when accessor key points to an object." Closed, 👍 9.
- TanStack Table **[#4711](https://github.com/TanStack/table/issues/4711)** — "Column filter not
  working when first value in data is null." Closed, 👍 5, updated 2026-07-24.
- AG Grid **[#288](https://github.com/ag-grid/ag-grid/issues/288)** — "Quick filter doesn't take
  new columns into account" (stale cached searchable-text string).
- AG Grid **[#2548](https://github.com/ag-grid/ag-grid/issues/2548)** — Quick filter searches
  hidden columns even when the user only wants visible ones searched. Closed 2018, labeled
  community-support (i.e. never formally fixed as a bug, just answered).
- PrimeNG **[#14016](https://github.com/primefaces/primeng/issues/14016)** — TreeTable global
  filter "not returning all the relevant results" — root cause: it searches one column at a time
  rather than across all. Closed as a confirmed bug (Core Team / LTS-PORTABLE label,
  milestone 16.7.1), 2023-11-03 → 2023-11-15.
- PrimeNG **[#3681](https://github.com/primefaces/primeng/issues/3681)**,
  **[#3728](https://github.com/primefaces/primeng/issues/3728)**,
  **[#13052](https://github.com/primefaces/primeng/issues/13052)** — three separate reports,
  spanning PrimeNG v2 through recent versions, of the global filter simply not reacting to input
  at all under some configuration. Recurrence across major versions suggests fragile/duplicated
  matching logic rather than one bug.

**End-user vs. integrator split:** almost every issue in this theme is filed by an *integrator*
(a developer wiring the grid to their data), not an end user — the failure mode is a thrown
exception or silently-no-op filter caused by a data shape (null, number, nested object) the
library's naive stringify-and-match didn't anticipate. This is exactly the class of bug a typed
`equals`/`contains` primitive with explicit accessor typing (rather than a generic "search
everything as string") is structurally positioned to avoid — worth stating as a design rationale.

## Theme 4 — Filtering × grouping/expansion collisions

- TanStack Table **[#2309](https://github.com/TanStack/table/issues/2309)** — "Expandable +
  Filterable Table: subRows empty after a filter was set." Closed, 👍 5.
- TanStack Table **[#2064](https://github.com/TanStack/table/issues/2064)** — "When we use
  `useExpanded` and `useFilters` subRows disappear when we perform a search" (v7). Closed, 👍 1 —
  same root cause reported independently two versions apart, i.e. not durably fixed the first
  time.
- AG Grid **[#1577](https://github.com/ag-grid/ag-grid/issues/1577)** — "Grouped row aggregations
  not updated when filter is changed." Closed (2017), 0 reactions, but the underlying
  aggregation-recompute-on-filter-change problem recurs later as an internal fix, e.g. AG Grid PR
  **[#10597](https://github.com/ag-grid/ag-grid/pull/10597)** "Refresh aggregations in pinned
  grand total row after filter" (2025-05-21) — the same class of bug being re-fixed ~8 years apart.
- AG Grid **[#13158](https://github.com/ag-grid/ag-grid/issues/13158)** — "`groupMaintainOrder=true`
  does not restore original group order after clearing filter." Closed, 👍 1, 2026-02.
- AG Grid **[#7875](https://github.com/ag-grid/ag-grid/issues/7875)** — "Filters persistence after
  data updates" — filters silently stop applying once the underlying row data is refreshed.
  Closed, 0 reactions, 2024-04-22.
- AG Grid **[#10727](https://github.com/ag-grid/ag-grid/issues/10727)** — "The filters are not
  removed when the dataset is empty" (stale filter state left applied against a since-emptied
  dataset). Closed, 2025-06-10.

**Read for our design:** filtering interacting with derived/grouped structure (sub-rows,
aggregates, group order) is consistently where "filtering worked, but the thing built on top of
it didn't recompute" bugs live — relevant to how `withFiltering()` and a future `withGrouping()`
must agree on recompute order, since this exact seam is what our own `docs/1-state/work/with-grouping/`
research is independently working through.

## Theme 5 — Filtering × pagination / row-count collisions

- MUI X **[#7583](https://github.com/mui/mui-x/issues/7583)** — "Client to server model mapper
  solution for filtering, sorting and pagination." **Open**, 👍 23, opened 2023-01-17, still
  updated 2025-07-01 — people want one unified place to reconcile filtered-vs-total counts across
  client/server boundaries and don't have it.
- MUI X **[#1106](https://github.com/mui/mui-x/issues/1106)** — "Add event and callback when
  filtered rows changes" — i.e. no first-class way to read "how many rows match now" without
  reaching into internals. **Open**, 👍 8, opened 2021-02-23, still active through 2025-03-01.
- AG Grid **[#1112](https://github.com/ag-grid/ag-grid/issues/1112)** and
  **[#7374](https://github.com/ag-grid/ag-grid/issues/7374)** — both titled around "filtered rows
  count" / "API to get filtered collapsed rows count" — recurring low-reaction but repeated
  requests (2016 and 2023) for a plain filtered-count API, each closed once answered/implemented
  rather than because the need was disputed.
- AG Grid **[#2139](https://github.com/ag-grid/ag-grid/issues/2139)** (also Theme 1) explicitly
  ties select-all breakage to the combination of filtering *and* pagination together, not either
  alone.

**Read for our design:** "how many rows currently match the filter" (distinct from total row
count) is a repeatedly-requested primitive across libraries — worth exposing directly from
`createFilters()`/`withFiltering()` rather than leaving consumers to derive it, since three
separate libraries have open or repeatedly-filed asks for exactly this.

## Theme 6 — Filtering × editing collisions

Two distinct sub-patterns, both under-addressed:

- **A row edited so it no longer matches the active filter** — I could not find a well-known,
  well-reasoned issue in any of the four trackers that names this scenario directly (searches for
  "no longer matches filter", "filter after edit" surfaced only unrelated regressions and PR
  titles). **Unverified / apparently unaddressed as a named issue** — which is itself a finding:
  none of the four libraries appears to treat "edited row silently vanishes from a filtered view"
  as a tracked UX problem, even though Theme 1 and Theme 4 show the adjacent "recompute after
  mutation" seam is a recurring source of bugs.
- **Filterable inputs used as editors fight the filter's own keystroke handling** — well
  documented in PrimeNG, whose `p-select`/Dropdown component conflates "type to filter the
  option list" with "type to edit the bound value" when both `editable` and `filter` are true:
  PrimeNG **[#17128](https://github.com/primefaces/primeng/issues/17128)** (open, 2024-12-18,
  "Dropdown editable does not work when filter is turned on"),
  **[#14567](https://github.com/primefaces/primeng/issues/14567)** and
  **[#14556](https://github.com/primefaces/primeng/issues/14556)** (closed 2024, same root
  conflation, fixed then re-reported), and MUI X
  **[#16206](https://github.com/mui/mui-x/issues/16206)** — "Unify header filter/editable cell
  keyboard navigation" (open, 👍 2, 2025-01-16) naming the same class at the grid-cell level: a
  cell that is simultaneously an editor and a header-filter target has no agreed keyboard model.

**Read for our design:** the second sub-pattern is a UI-layer risk specific to *filter inputs that
double as pickers/editors* — not directly in `createFilters()`'s scope, but worth flagging to
whatever consumes `withFiltering()` for an editable-column story.

## Theme 7 — Filtering × virtual scroll / sorting

Weaker signal than the other collisions — I did not find well-reasoned, verifiable issues
specifically about virtual-scroll-plus-filter interaction in AG Grid, MUI X, or PrimeNG trackers
(searches surfaced only generic performance/rendering issues, not filter-scroll interaction
specifically) — **unverified as a distinct theme**, flagging rather than asserting it. The
adjacent, verified pattern is filtering combined with *sorting* order stability:

- AG Grid **[#13158](https://github.com/ag-grid/ag-grid/issues/13158)** and
  **[#5870](https://github.com/ag-grid/ag-grid/issues/5870)** — group/row order not restored
  correctly once a filter is cleared, i.e. filter-clear doesn't cleanly hand back to whatever
  ordering (sort or group order) was active before.
- MUI X **[#7583](https://github.com/mui/mui-x/issues/7583)** (also Theme 5) explicitly frames
  filtering and sorting as needing one unified server-mapping story, not two independent ones.

## Theme 8 — URL/query-string state and undo

- I found **no verifiable, well-reasoned issue** in any of the four trackers specifically about
  syncing filter state to the URL/query-string as a *library* concern — TanStack Table's own docs
  explicitly punt this to userland (community packages exist, e.g. a third-party "sync TanStack
  Table state with URL parameters" blog post turned up in search, but that is prescriptive
  advice/tooling, not a tracked pain point) and AG Grid/MUI X/PrimeNG expose serializable filter
  models (`getFilterModel()`/`setFilterModel()`, MUI X `filterModel`) as the documented mechanism,
  with the URL-sync step left to the integrator. **Read as: this is treated industry-wide as "give
  the consumer a serializable model, not a URL-sync feature" — not a gap, a settled boundary.**
- **Undo/redo of a filter change specifically** — no verifiable issue found; the only undo-related
  filtering hits in AG Grid's tracker were about undo/redo not working for *cell edits* made via
  `valueSetter` (AG Grid **[#6737](https://github.com/ag-grid/ag-grid/issues/6737)**, closed,
  0 reactions) or after column resize (**[#3755](https://github.com/ag-grid/ag-grid/issues/3755)**,
  closed) — filtering itself doesn't appear to participate in any library's undo stack.
  **Unverified as a real gap** — could mean nobody wants filter-undo, or that it's assumed to be
  "just re-open the filter and change it back," which is cheap enough that no one has filed for
  more.

## Theme 9 — Filter UI/UX-specific pain: debounce, active-filter indicators, date ranges, set-filter/distinct values

- **Debounce / instant-filter feel.** PrimeNG **[#9581](https://github.com/primefaces/primeng/issues/9581)**
  — "ColumnFilter: add option to filter instantly (without pressing Enter)." 👍 19, opened
  2020-11-26, stayed open for over **5 years** before closing 2026-02-15 — one of the longest-lived
  filtering asks I found in any tracker, and it's exactly the "should filtering react per-keystroke
  or on commit" question our own design defers to the consumer (no shipped debounce). MUI X
  has the mirror-image ask, **[#12150](https://github.com/mui/mui-x/pull/12150)** "Debounce header
  filter inputs for async server-side filtering," closed 2024, showing the same tension pulls both
  directions (some want instant, some want debounced) depending on client vs. server-side cost —
  supports leaving debounce to the consumer rather than picking one default.
- **Active-filter indicator/pill.** PrimeNG **[#16576](https://github.com/primefaces/primeng/issues/16576)**
  — "v18 p-columnFilter: Column filtering indicator is missing" — **open**, 👍 11, opened
  2024-10-17, still updated 2026-06-02. A visible "this column has an active filter" affordance
  regressed in a major version and stayed unfixed for well over a year.
- **Date range filter correctness.** PrimeNG has a cluster of date-filter edge-case bugs that all
  reduce to the same root cause (time-of-day silently dropped/reset by a "date is after/before"
  comparison): **[#18676](https://github.com/primefaces/primeng/issues/18676)** ("'Date is after'
  clears the time part," open, 2025-07-23), **[#15684](https://github.com/primefaces/primeng/issues/15684)**
  (same, open, 2024-05-23), **[#14886](https://github.com/primefaces/primeng/issues/14886)** /
  **[#14589](https://github.com/primefaces/primeng/issues/14589)** (closed variants of the same
  complaint, 2024). Four separate filings of essentially one bug across 15 months indicates the
  fix never fully stuck. Directly relevant: our `inDateRange` kind should be explicit about
  inclusive/exclusive boundaries and time-of-day handling in its own tests, since this exact
  ambiguity is what keeps getting re-reported elsewhere.
- **Set filter / distinct-value pickers (data-derived filter options) — the capability we
  deliberately don't ship.** AG Grid's Set Filter is a whole sub-system precisely because
  deriving "distinct values for this column" from live data is non-trivial: AG Grid
  **[#3314](https://github.com/ag-grid/ag-grid/issues/3314)** — "Resetting set filters slows down
  the grid" (recomputing distinct values on every reset is expensive on 39+ columns);
  **[#6747](https://github.com/ag-grid/ag-grid/issues/6747)** — set filter breaks when the
  column's distinct values are complex objects (id/name pairs) rather than primitives; and the
  documented case-sensitivity trap where a column that's actually 7 distinct colors shows 21
  "distinct" list entries because casing wasn't normalized before dedup
  (ag-grid Set Filter docs, verified via the official filter-set-filter-list page). PrimeNG's
  analogue, Dropdown-as-filter, has its own data-shape trap:
  **[#10122](https://github.com/primefaces/primeng/issues/10122)** — "Dropdown Filter not working
  for simple arrays like `string[]`" — closed, 👍 21, i.e. the distinct-values picker breaks on
  the simplest possible input shape (an array of strings rather than objects). **This is the
  single clearest case where a deliberately-not-shipped capability lines up with real, recurring
  pain**: every library that ships a data-derived "set filter" has fielded correctness and
  performance bugs specifically in the distinct-value derivation step, not in the filtering logic
  itself.
- **Empty-state messaging when a filter matches nothing.** No well-reasoned, verifiable issue found
  in any of the four trackers specifically about *messaging* (as opposed to rendering) an
  all-rows-filtered-out state — **unverified as a distinct theme**. This may mean it's treated as
  purely a consumer-styling concern (all four libraries expose a "no rows" slot/prop for the
  integrator to fill), not a library-level gap.
- **Filtering on nested/array values.** TanStack Table **[#4499](https://github.com/TanStack/table/issues/4499)**
  — "`getValue` should return a null value for nested keys" — closed, 👍 14 — nested-accessor
  values are a recurring source of filter breakage (ties back to Theme 3's null/undefined
  accessor bugs). PrimeNG's array-filter bug (#10122, above) is the clearest nested/array-specific
  case. No equivalent well-reasoned issue found for AG Grid or MUI X specifically about
  array-valued cells and filtering — **unverified** for those two.
- **Saved filter sets.** No dedicated "save this filter configuration for reuse" feature-request
  issue with meaningful engagement was found in any of the four trackers — all four already expose
  a serializable filter-model API (`getFilterModel`/`setFilterModel` in AG Grid, `filterModel` in
  MUI X, `filters` object in PrimeNG) that integrators use to build "saved views" in userland, so
  this reads as another **settled boundary** (library gives you the model, saving/naming/sharing
  filter presets is left to the app) rather than an open gap.

---

## Summary of what to weigh against `createFilters()` / `withFiltering()`

1. **Select-all-under-a-filter is a near-universal historical bug** (Theme 1) — needs an explicit,
   tested contract in `withFiltering()`, not an assumed default.
2. **The naive global/quick filter (stringify + substring match) is where most high-reaction bugs
   live** (Theme 3) — a typed, accessor-aware filter primitive is structurally better positioned
   here; worth stating as a rationale, not just an implementation detail.
3. **Filtered-row-count as a first-class read** is a repeated, still-open ask across MUI X and AG
   Grid (Theme 5) — cheap to expose from `createFilters()`, worth not leaving to consumers to
   derive.
4. **Runtime operator picker and AND/OR filter-group UI stay open and wanted years after the
   baseline filter shipped** (Theme 2) — confirms these are real, resurfacing needs, and that not
   shipping them is a deliberate scope cut against a genuine, persistent demand — not a corner
   nobody asked about.
5. **Distinct-value "set filter" pickers are where deliberately-not-shipped scope most cleanly
   matches real pain** (Theme 9) — every library that ships one has shipped bugs in the
   distinct-value derivation step (performance, complex-object dedup, case sensitivity, array
   values). Confirms leaving this out is trading away a hard, bug-prone feature, not a trivial one.
6. **Date range inclusive/exclusive and time-of-day handling is a live, repeatedly-reported bug
   class** (Theme 9) — directly actionable for `inDateRange`'s own test coverage.
7. **A row edited so it no longer matches an active filter has no named precedent in any tracker**
   (Theme 6) — genuinely unaddressed territory industry-wide, not just internally; worth an
   explicit product decision rather than assuming a library convention exists to follow.

Total distinct issues/threads cited above with a verified number, state, and date: **57**
(plus several explicitly marked unverified/not-found, called out inline rather than omitted).
