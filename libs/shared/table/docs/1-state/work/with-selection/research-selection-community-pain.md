# Community pain research — row selection (N1)

Scope: row selection across Angular CDK's `SelectionModel` (+ `cdk-experimental/selection` /
`material-experimental/selection`), TanStack Table v8, AG Grid, Material React Table (MRT), and
PrimeNG (Table/TreeTable) — the same five-library set `docs/1-state/features/selection.md`'s
"Competitive position" section benchmarks against. All issue/PR numbers, states, dates, and
reaction counts below were fetched via `gh issue view` / `gh pr view` / `gh api search/issues`
against the live repos on 2026-09-12, or via WebFetch/WebSearch of the library's own docs.
Reaction counts are each issue's `reactions.total_count` (all reaction types, not literally only
👍) — same convention the sibling filtering research uses. Anything I could not verify from a
fetched page is marked **unverified**.

Internal design context this is being checked against (`docs/1-state/features/selection.md`):
`withSelection()` ships a flat `Set<RowId>`, a CDK-shaped `{added, removed}` delta, per-row
`enableRowSelection`/`enableMultiRowSelection` write-gates (D58), and a standalone `selectAllIds()`
helper (D59) — but **deliberately refuses to define "select all" scope** (D1: no dependency on
`withPagination()`/`withFiltering()`), ships **no parent/child cascade** (D13, blocked on
`withGrouping()`), and has **no UI-layer directives yet** (checkbox/keyboard/ARIA wiring is
tracked separately, unblocked but unbuilt). Themes below flag where community pain lines up with
one of those deliberate gaps or open questions.

---

## Theme 1 — "Select all" scope ambiguity under pagination/filtering: the single most-repeated bug in the category

Every library in the set has shipped, and re-shipped, a version of "select all" that means
something other than what the user meant — usually "every row ever" when the user meant "every
row currently matching," or "the current page" silently replacing a broader selection.

- Angular CDK/Material **[#9670](https://github.com/angular/components/issues/9670)** —
  "Checkbox column out of sync with view after pagination": `SelectionModel` holds the correct
  `selected` state, but the header/row checkboxes visually desync once you page. Closed within a
  day (2018-01-29 → 2018-01-30) — but note this is the **official `mat-table` selection example**
  (`masterToggle()`/`isAllSelected()`, hand-rolled `SelectionModel` wiring from the docs), not
  library code; CDK ships the primitive and leaves this exact wiring to every consumer, so the bug
  recurs per-integration, not per-library-release.
- Angular Material **[#16796](https://github.com/angular/components/issues/16796)** — "Last row
  get selected when I toggle the checkbox in the header with single selection," closed 2019 —
  same docs-example root cause, single-select variant.
- AG Grid **[#1481](https://github.com/ag-grid/ag-grid/issues/1481)** — "select all header
  checkbox doesn't work well with pagination; it should maintain state across pages," opened
  2017-02-20, closed 6 days later, but **still being commented on 2025-12-15** — 8+ years later.
- AG Grid **[#2139](https://github.com/ag-grid/ag-grid/issues/2139)** — "Select all checkbox is
  not working with filters and pagination," 👍5, opened 2018-01-12, closed, but still receiving
  activity through 2025-06-20 — same multi-year "closed but not actually settled" pattern.
- AG Grid **[#9327](https://github.com/ag-grid/ag-grid/issues/9327)** — Server-Side Row Model:
  "Select All" visual state persists across pages despite `selectAll: 'currentPage'` — the
  *config knob built specifically to answer this question* still leaks the wrong scope visually.
  Closed 2024-12-04 → 2024-12-18.
- AG Grid **[#10688](https://github.com/ag-grid/ag-grid/issues/10688)**,
  **[#12072](https://github.com/ag-grid/ag-grid/issues/12072)**,
  **[#12559](https://github.com/ag-grid/ag-grid/issues/12559)** — three independently-filed
  reports (2025-06, 2025-09, 2025-11) that `selectAll: 'currentPage'` "does not work" under the
  Server-Side Row Model once multiple pages are loaded — the same root cause as #9327 re-reported
  three times in five months, a year after AG Grid's own fix.
- PrimeNG **[#5220](https://github.com/primefaces/primeng/issues/5220)** — "Table checkbox
  selection ignores filtering": select-all includes filtered-out rows and other pages. 👍7,
  2018-02-26 → 2018-03-28.
- Material React Table **[#1420](https://github.com/KevinVandy/material-react-table/issues/1420)**
  — "SelectAll in combination with autoResetPageIndex not working": filtering to 5 visible rows,
  select-all selects only 4 and leaves the last unselected. **Open**, 2025-06-08.
- Material React Table **[#1499](https://github.com/KevinVandy/material-react-table/pull/1499)**
  — open PR, "correct select-all checkbox state for manual pagination": header checkbox shows
  fully-checked (not indeterminate) when only the current page's rows are selected out of a larger
  server-side total. **Open**, 2026-01-20 — still unmerged as of this research.
- TanStack Table **[#3514](https://github.com/TanStack/table/issues/3514)** — "Select All rows
  from all pages with controlled pagination," 👍6, opened as a discussion 2021-10-26, closed
  2022-04-08 by pointing to userland patterns — TanStack (headless) never ships a resolved answer,
  only the primitives to build one.

**Read for our design:** this is the same "near-universal, decade-spanning, keeps recurring even
after fixes" pattern the sibling filtering research found for filter-scoped select-all — except
here it's worse: three separate libraries (AG Grid ×2 clusters, MRT) have shipped a
purpose-built config option (`selectAll: 'currentPage'`, `autoResetPageIndex` interplay) *whose
job is to answer this exact question*, and each is still fielding bug reports against its own
fix years later. `withSelection()`'s D1 (refuse to define scope, make every write name its own id
set) sidesteps the entire bug class structurally rather than attempting the config knob every
other library has tried and re-broken. The trade (per D59's own "Not Shipped" line) is that
`withSelection()` ships no "are all visible rows selected" read-side signal — every library above
that *does* attempt this ships a checkbox-state bug as the direct cost of attempting it.

## Theme 2 — Selection silently dropped (or stuck) across data refetch, sort, and row removal

Distinct from Theme 1: this is what happens to an *already-selected* row when the underlying data
array changes shape, independent of any explicit "select all" action.

- TanStack Table **[#4498](https://github.com/TanStack/table/issues/4498)** — "[React] Row
  selection does not reset after upgrading from v7 to v8": v7's `autoResetSelectedRows` (on by
  default) was removed in v8 without a documented replacement, so stale `rowSelection` state
  (keyed by row **index**, not id, unless the consumer opts into `getRowId`) now survives a data
  swap and points at the wrong rows. **Open**, 👍6, opened 2022-11-01, still active 2025-01 — a
  maintainer-adjacent commenter's answer (`table.toggleAllRowsSelected(false)` /
  `resetRowSelection()`) is a workaround, not a fix, and multiple independent commenters report the
  same confusion into 2025.
- Material React Table **[#1362](https://github.com/KevinVandy/material-react-table/issues/1362)**
  — "Removing rows that are selected causes the row to still be selected but doesn't exist": after
  a delete-then-refetch, the selection count/UI still reports the deleted rows as selected;
  "Clear selection" doesn't clear them. **Open**, 👍2, 2025-01-20 — reporter's workaround is a
  manual `tableInstance` ref hack.
- AG Grid **[#6635](https://github.com/ag-grid/ag-grid/issues/6635)** — "Selection resets on state
  change": any external state update (e.g. a parent re-render passing new `rowData`) silently
  clears an in-progress selection with no configuration to opt out. Closed 2023-05-20 →
  2023-06-29.
- Angular CDK **[#25878](https://github.com/angular/components/issues/25878)** /
  **[#27425](https://github.com/angular/components/issues/27425)** — `SelectionModel.setSelection`
  "does not respect `compareWith`": restoring a selection against a freshly-fetched object array
  (new object identities, same logical ids) silently fails to re-mark rows as selected unless
  `compareWith` is passed *and correctly respected*, which these two issues (2022, 2023,
  independently filed) show it wasn't, consistently, across versions. Both closed after fix
  PRs — i.e., the "restore selection against new object identities" seam broke more than once.

**Read for our design:** this is exactly what D8 (unknown/unloaded ids stay selectable, extended
to async-restore) and the `RowId`-based (not index/object-identity-based) selection set in
`withSelection()` are structurally positioned to avoid — TanStack's #4498 and CDK's
`compareWith` bugs are both, at root, "selection was keyed by something more fragile than a stable
id." Worth stating as design rationale, not just an implementation detail, since three of five
libraries have shipped exactly this class of bug. AG Grid's #6635 (bulk external-state wipes
selection with no opt-out) is the one pattern `withSelection()` doesn't yet have an answer for —
D19 already flags that selection has no persistence today; this is the adjacent "does a normal
data reassignment wipe selection" question, and it's currently answered by D11's reconciliation
(prune ids that left `data()`) which is narrower than "any state change."

## Theme 3 — Shift-click range selection: years of userland DIY, only recently shipped as a built-in anywhere

The clearest "resurfacing feature request, unmet need" signal in the whole set, mirroring the
filtering research's Theme 2 pattern almost exactly.

- Angular CDK/Material **[#17402](https://github.com/angular/components/issues/17402)** — "Please
  add an example for MULTI SHIFT CLICK selection in checkbox mat table," working across
  paginated/filtered/sorted data. Opened 2019-10-15, **closed by the reporter themselves** five
  days later after building and sharing their own StackBlitz implementation — i.e. closed because
  a user solved it in userland, not because Angular Material shipped anything. `SelectionModel`
  still has no shift-range primitive as of this research.
- TanStack Table **[#3636](https://github.com/TanStack/table/issues/3636)** — "Question: range
  select on table," opened 2022-01-13, closed as answered five comments later — every comment is a
  different hand-rolled `shiftKey`/`lastSelectedRowIndex` implementation (one later extended by
  another commenter to add sub-row and Ctrl+Shift support), each reinventing the same anchor-index
  tracking independently.
- TanStack Table **[PR #6409 "feat: batch row selection"](https://github.com/TanStack/table/pull/6409)**
  — merged 2026-07-12, **only two months before this research** — finally adds inclusive
  Shift-click range selection as a *built-in* default behavior of
  `row.getToggleSelectedHandler()` (confirmed via the current
  [row-selection guide](https://tanstack.com/table/latest/docs/framework/react/guide/row-selection)),
  with an `enableRowRangeSelection` opt-out and documented caveat that ranges only span
  currently-loaded rows under manual/server-side pagination. This is a ~4.5-year gap (#3636 → PR
  #6409) between the community need being clearly documented and the headless library shipping a
  built-in answer — and the range-across-server-pages case (Theme 1's territory) is explicitly
  still not solved by it.
- Material React Table **[#917](https://github.com/KevinVandy/material-react-table/issues/917)** —
  "storybook: implement multi row selection with hold shift" — MRT itself (a wrapper over
  TanStack Table) needed to add its own **example**, i.e. as recently as 2024 the wrapping library
  still had no first-class shift-select story, consistent with TanStack Table core not shipping it
  until mid-2026.
- AG Grid ships shift-click range select as a documented, built-in feature (confirmed via the
  [Angular row-selection docs](https://www.ag-grid.com/angular-data-grid/row-selection-multi-row/))
  — the one library in the set that had it natively for years — but even there it has had
  correctness bugs: AG Grid **[#6619](https://github.com/ag-grid/ag-grid/issues/6619)** — "Shift
  key combination does not work properly for **deselecting** multiple rows" (select-range worked,
  deselect-range didn't). Opened 2023-05-18, fixed within a week.
- PrimeNG **[#5496](https://github.com/primefaces/primeng/issues/5496)** — "Table - shiftKey
  multiple-selection when using checkbox" — shift-range checkbox selection simply didn't work.
  👍4, opened 2018-04-05, **open for 4.5 years** before being fixed by
  **[PR #11845](https://github.com/primefaces/primeng/pull/11845)** ("Fix #5496: Allow shift
  selection for table checkboxes"), merged 2022-08-19 → closed 2025-05-02. A related ask for the
  same gesture on TreeTable, PrimeNG **[#8035](https://github.com/primefaces/primeng/issues/8035)**
  — "Multiple Selection Using Shift Key for Tree Table," 👍5, opened 2019-08-07 — took even
  longer, not closed until 2024-11-29 (5+ years).

**Read for our design:** shift-range select is the single clearest case in this whole research
where "the community kept re-asking, kept re-implementing by hand, and the library eventually
had to ship it" — AG Grid shipped it early (and still has correctness bugs in the deselect path);
CDK never shipped it at the primitive level at all; TanStack Table went 4.5 years on
community-only implementations before shipping one two months ago; PrimeNG took 4.5 years to fix
a broken attempt. `withSelection()` currently has no UI layer at all (per `selection.md`'s "Not
Shipped" table — "Selection checkbox directive + header directive" is unblocked but unbuilt), so
this entire theme is a forward-looking flag for whichever directive effort builds shift-range
selection: budget for the anchor-tracking state to live in the *directive*, not the state
feature (which is deliberately flat/id-set-only per D13), and expect the "does the range span
filtered-out or off-page rows" question (AG Grid's still-unresolved edge, TanStack's documented
"only loaded rows" caveat) to reopen Theme 1's scope question in a new shape.

## Theme 4 — Keyboard selection and keyboard accessibility: consistently the last thing shipped, sometimes never

- PrimeNG **[#713](https://github.com/primefaces/primeng/issues/713)** — "Keyboard support for
  DataTable Selection," 👍19, opened 2016-08-08, **open for 1.5 years** before closing
  2018-01-13.
- PrimeNG **[#5762](https://github.com/primefaces/primeng/issues/5762)** — "Keyboard Support for
  Table Row Selection," 👍9, opened 2018-05-18 (i.e. *after* #713 had already closed, for a
  different table variant) — same request resurfacing across the library's own component split
  (`DataTable` vs `TurboTable`), closed 2019-12-06.
- Angular Material **[#14861](https://github.com/angular/components/issues/14861)** — "mat-table
  does not accept keyboard up/down keys to navigate among rows," 👍19, **open since 2019-01-17,
  still active 2025-01-02** (6 years) — `mat-table` + `SelectionModel` has no built-in row
  keyboard-navigation story at all; every selection example wires mouse/checkbox click only.
- AG Grid **[#12547](https://github.com/ag-grid/ag-grid/issues/12547)** — "Accessibility: Keyboard
  Trap": Tab enters the grid but only Tab (not Escape or a documented exit) moves focus back out,
  requiring N tab-presses for an N-cell grid — a direct WCAG 2.1.2 ("No Keyboard Trap") violation.
  **Open**, 2025-11-24.
- AG Grid **[#14234](https://github.com/ag-grid/ag-grid/pull/14234)** — "fix(grid): toggle
  selection on SPACE over full-width group rows" — Space-to-toggle-selection, the standard
  checkbox-row keyboard convention, was still being patched for a specific row type (full-width
  group rows) as recently as 2026-06-26.
- Material React Table **[#1428](https://github.com/KevinVandy/material-react-table/issues/1428)**
  — "Selection options dropdown (non-modal) - keyboard navigation (keys up/down) does not work."
  **Open**, 2025-06-25.

**Read for our design:** across all five libraries, keyboard interaction for selection is
consistently the feature that ships latest (years after mouse/checkbox selection) or never ships
at all as a first-class row-level primitive (`mat-table`'s #14861 is 6 years open with no
resolution). `withSelection()` has no directive layer yet — this is direct evidence for treating
Space-to-toggle and Tab-focus-order as designed-in-from-the-start requirements for that directive
work, not an accessibility pass bolted on afterward, since every library here treated it as an
afterthought and is still paying for it years later.

## Theme 5 — Tri-state checkbox for parent/group rows: still buggy everywhere it's shipped

- TanStack Table **[#2618](https://github.com/TanStack/table/issues/2618)** — "`useRowSelect`.
  Parent row in [all selected] state when some subrows are not selected," closed 2020-08-10 →
  2020-11-02.
- TanStack Table **[#2908](https://github.com/TanStack/table/issues/2908)** — "Parent rows lose
  the ability to select all subRows when `paginateExpandedRows` is disabled," 👍9, closed
  2020-12-03 → 2022-04-08 (1.5 years) — tri-state cascade breaking specifically under a pagination
  interaction.
- TanStack Table **[PR #6495](https://github.com/TanStack/table/pull/6495)** — "fix: honor
  selection rules in select-all paths, add `deselectParents` option" — merged 2026-08-02, i.e. the
  parent/child cascade rules for select-all were *still being corrected* one month before this
  research.
- AG Grid **[#9565](https://github.com/ag-grid/ag-grid/issues/9565)** — "Row Selection
  `groupSelects` descendants does not select parent node" — filed as a bug, closed as `invalid`
  (i.e. AG Grid's own team considers the observed behavior intentional, not a bug) — a sign the
  tri-state semantics are non-obvious enough that users file bugs against intended behavior.
  2024-12-16 → 2024-12-19.
- Material React Table **[#1046](https://github.com/KevinVandy/material-react-table/issues/1046)**
  / **[#1049](https://github.com/KevinVandy/material-react-table/issues/1049)** — "Sub Row
  Selection not working correctly," filed as a bug (#1046, closed 2024-06-15) then reopened as a
  fix PR (#1049, still open 2024-03-19 → tracked through 2024-12-11) — same root cause across two
  tracker entries.
- Material React Table **[#1226](https://github.com/KevinVandy/material-react-table/issues/1226)**
  — "Header checkbox does not get selected when selecting page with grouped data." **Open**, 👍3,
  2024-08-26.
- Material React Table **[#1247](https://github.com/KevinVandy/material-react-table/issues/1247)**
  — "Grouped row does not get unselected with selection cleared." **Open**, 2024-09-17.
- PrimeNG **[#9933](https://github.com/primefaces/primeng/issues/9933)** — "Tree exceeds maximum
  call stack size on selection when using `selectionMode=\"checkbox\"` with filter," 👍4 —
  tri-state cascade recursion blowing the stack when combined with filtering. Closed 2021-02-24 →
  2022-07-11 (1.5 years).
- PrimeNG **[#7387](https://github.com/primefaces/primeng/issues/7387)** — "p-treeTable
  `selectionMode=\"checkbox\"` - toggle selection propagation," closed 2019-03-14 → 2020-01-31.

**Read for our design:** `withSelection()`'s D13 (flat ids, explicitly no parent/child cascade,
blocked on `withGrouping()` not existing yet) sidesteps an entire class of bugs that every library
shipping a cascade has hit repeatedly, including a PR fixing this exact interaction (#6495)
merging in TanStack a month before this research — i.e. this is not a solved problem anywhere in
the competitive set, it's a live one. `selection.md`'s open question on group-header select-all
("plausibly means select every row in this group... undecided whether this is library API or
consumer code") should be read against this evidence: every library that made it library API is
still fixing it years in; that's a real argument for keeping it consumer code for as long as
`withGrouping()` allows.

## Theme 6 — Disabled/locked-row selection semantics: "select all" repeatedly ropes in rows it shouldn't

- TanStack Table **[#2988](https://github.com/TanStack/table/issues/2988)** — "'Select all'
  Checkbox also selects disabled checkboxes / rows," 👍4, opened 2021-01-13, closed 2022-04-08
  (1+ year) — select-all bypassing the per-row `enableRowSelection`-equivalent predicate entirely.
- PrimeNG **[#6736](https://github.com/primefaces/primeng/issues/6736)** — "Add `rowSelectable`
  property to DataTable," 👍34 (the highest-reaction issue found in this entire research pass) —
  opened 2018-10-23 after a user discovered `[disabled]="true"` on a row checkbox still let the
  *header* select-all checkbox select that row. **Open for over 3 years** before closing
  2021-12-23.
- PrimeNG **[#15780](https://github.com/primefaces/primeng/issues/15780)** — "Table select all
  checkbox deselect disabled selected checkboxes," 👍6, opened **2024-06-03** (2.5 years *after*
  #6736 shipped a fix) — the inverse failure mode of the same root cause (select-all now
  incorrectly *deselects* pre-selected disabled rows instead of leaving them alone), open for
  **2 full years** before closing 2026-06-18. Explicitly connected in the issue body to a sibling
  report, #15338.

**Read for our design:** this is a textbook "closed the bug, reopened the adjacent half of the
same bug two years later" pattern — select-all-vs-disabled-rows is genuinely hard to get fully
right, evidenced by PrimeNG needing two multi-year issues (6+ years combined) to cover both
directions (select-all shouldn't select disabled rows; select-all shouldn't touch already-selected
disabled rows either). `withSelection()`'s D58/D60 (`enableRowSelection` gates every id-adding
write including `select()`, and a fully-blocked write is a **silent** no-op) directly targets the
first half of this — `selectAllIds()` composed with `select()` naturally drops non-selectable
ids from the candidate set before the write, per the existing spec. The second half (should
select-all *deselect* a disabled row that's already selected) maps onto `deselect()`'s explicit
"never subject to the multi-select or row-selection rule" design in `selection.md` — worth an
explicit test case given PrimeNG's #15780 shows this exact asymmetry is where the bug hides.

## Theme 7 — Performance: re-render cost and freezing at scale

- TanStack Table **[#1496](https://github.com/TanStack/table/issues/1496)** — "[Performance] All
  rows are re-rendered on selecting row," 👍14, opened 2019-09-05 — every row re-renders on a
  single checkbox click. Closed within a day as a React-usage/memoization guidance issue rather
  than a library fix, but **still being commented on as recently as 2025-06-02** — i.e. the
  underlying "how do I select one row without re-rendering N rows" question outlived the issue's
  closure by 6 years.
- Material React Table **[#1281](https://github.com/KevinVandy/material-react-table/issues/1281)**
  — "Row selection causes the entire table to re-render" — same root pattern one layer up the
  stack (MRT wraps TanStack Table but still re-renders wholesale on selection). Closed
  2024-10-26 → 2024-12-23.
- PrimeNG **[#12182](https://github.com/primefaces/primeng/issues/12182)** — "Virtual scroll and
  select all with quantities > 2000 items causes window to freeze/hang," explicitly noting the
  same bug was "previously closed as potentially fixed" in a linked issue (#11775) and had
  resurfaced. Affects both `p-multiSelect` and `p-table`'s checkbox column. Closed
  2022-11-10 → 2023-11-29 (1 year), with the report itself describing a prior "fix" that didn't
  hold.
- PrimeNG **[#10694](https://github.com/primefaces/primeng/issues/10694)** — "p-multiselect:
  Performance fix when selecting all items (10000 records or more)" — closed as a direct
  performance PR, 2021-09-29 → 2022-12-06 (over a year to land).

**Read for our design:** `withSelection()`'s `Set<RowId>` (not an array, not per-row boolean
flags on `RenderRow`) and D5 (selection read from a signal, never stamped onto `RenderRow`, so no
row-object identity churn on every selection change) are structurally the right shape against
this theme — TanStack's #1496/MRT's #1281 are exactly the failure mode of coupling selection
state to something that forces a wide re-render, and PrimeNG's #12182/#10694 show the "select all
at scale" case specifically compounds it. Worth stating as design rationale: the competitive
evidence is that "reads from a signal, no stamping" isn't a micro-optimization here, it's avoiding
a bug class multiple libraries have shipped and needed a year-plus PR to fix.

## Theme 8 — Selection × row editing/removal collisions

- Material React Table **[#1362](https://github.com/KevinVandy/material-react-table/issues/1362)**
  (also Theme 2) — deleted-but-still-selected rows, the clearest edit/removal collision found.
- Angular Material **[#23789](https://github.com/angular/components/issues/23789)** —
  "`MatSelectionColumn` row checkbox should prevent click event propagation" — when a row's own
  click handler also toggles selection (a common pattern for "click anywhere in the row to
  select"), the checkbox's own click bubbles and double-fires the toggle. Opened 2021-10-19,
  **open for over 4.5 years** before closing 2026-05-29 — a plain event-propagation bug, but one
  that specifically bites the moment a consumer wires row-click-to-select alongside a checkbox
  column, which is the exact composition most selection UIs use.
- I found **no well-reasoned, verifiable issue** in any of the five trackers specifically about
  "a row is edited such that it should no longer be selectable" (the selection analogue of the
  filtering research's Theme 6 finding for "edited row no longer matches filter"). **Unverified /
  apparently unaddressed as a named issue** in any tracker — consistent with the filtering
  research's finding that this general shape of problem (a mutation invalidating a
  previously-valid state elsewhere) is under-tracked industry-wide, not something this library set
  has a precedent for either way.

**Read for our design:** `withSelection()`'s D12 (bulk `removeRow(id[])`/`patchRow(id[], partial)`
explicitly out of scope for this effort, deferred to D31.2) and D11 (removal reconciliation prunes
`selectedRows` silently, no `selectionChanged` emission) together are a more complete answer than
MRT's #1362 shows MRT has today — MRT's bug is exactly "no reconciliation on removal," which
`withSelection()` already has. The event-propagation risk in CDK's #23789 is a UI-layer concern
for whichever directive wires row-click-to-select next to a checkbox column — worth flagging to
that effort specifically since it sat unresolved in Material for 4.5 years.

## Theme 9 — End-user vs. integrator complaints, and API churn as its own complaint

Nearly every issue cited above is filed by an *integrator* (a developer wiring the table), not an
end user directly — consistent with the filtering research's finding for the same library set.
The one clear end-user-perspective complaint about a "select all" checkbox found in this research
was **not** in one of the five target libraries (Adobe Workfront's community forum,
"[CLOSED] - Checkbox in Lists: Do not De-select all if you misclick") — a user asking that a
misclick on a header checkbox not silently wipe an entire existing selection. It's adjacent, not
sourced from the target set, so treated here as **corroborating, not primary** evidence — but the
underlying complaint (a single mis-click on a "select all" toggle should not be a
destructive, unconfirmed bulk action) matches the shape of AG Grid's #6635 (Theme 2) and the
general "select-all is a footgun" thread running through Theme 1.

Separately, AG Grid's selection-adjacent API churn shows up as an integrator complaint in its own
right: AG Grid **[#8805](https://github.com/ag-grid/ag-grid/issues/8805)** — "New selection API
misses a lot of scenarios that was possible with the old one," filed the day the new (32.2.0)
selection API config (`rowSelection: {...}` object replacing the old `rowSelection: 'multiple'`
string + scattered booleans) shipped, closed the same day but is direct evidence that a
selection-config rewrite has a real integrator migration cost even when the maintainers respond
same-day.

**Read for our design:** this is a soft argument for `withSelection()`'s config shape
(`enableRowSelection`/`enableMultiRowSelection` as stable, additive booleans-or-predicates rather
than a single mode-string or nested config object) staying additive going forward — AG Grid's
#8805 is exactly the cost of the alternative (a config object rewrite) even when handled well.

---

## Summary of what to weigh against `withSelection()`

1. **"Select all" scope ambiguity is the single most-repeated, most-persistent bug in the entire
   category** (Theme 1) — worse than filtering's equivalent, because multiple libraries have
   shipped a *purpose-built config option* to answer it and are still fixing that option years
   later. D1's refusal to define scope at the state layer, paired with D59's `selectAllIds()`
   helper, sidesteps the bug class the other four libraries keep re-shipping — but leaves the
   "is everything visible currently selected" read-side signal unbuilt (flagged in `selection.md`
   itself), which is the one piece of this theme not yet answered.
2. **Selection keyed by anything other than a stable id (array index, object identity) is a
   recurring, multi-library bug source** (Theme 2) — direct support for `withSelection()`'s
   `RowId`-set design and D8's async-restore permissiveness.
3. **Shift-click range selection is the clearest "community solved it before the library did"
   story found** (Theme 3) — CDK still hasn't shipped it at the primitive level; TanStack Table
   took 4.5 years and shipped a built-in only two months before this research; PrimeNG took 4.5
   years to land a working fix. Directly relevant to whichever directive effort builds selection
   UI next: budget the anchor-tracking state and the "does the range span off-page/filtered rows"
   scope question (Theme 1 recurring in a new shape) as first-class design work, not an
   afterthought.
4. **Keyboard interaction for selection ships last, or never, everywhere** (Theme 4) — `mat-table`
   has had no row keyboard-navigation story for 6+ years; AG Grid has an open WCAG keyboard-trap
   report today. Strong argument for treating Space-to-toggle and a documented focus/tab model as
   in-scope from the start of `withSelection()`'s UI-directive work, not a follow-up pass.
5. **Tri-state parent/child cascade is unsolved everywhere it's shipped, including a fix merging
   in TanStack a month before this research** (Theme 5) — corroborates keeping D13's flat-ids,
   no-cascade design and leaving group-header select-all as an open, undecided question rather
   than committing to library API before `withGrouping()` exists.
6. **Disabled/locked-row selection needs both halves tested explicitly** (Theme 6) — PrimeNG
   needed two issues 6 years apart to cover "select-all shouldn't select disabled rows" and
   "select-all shouldn't touch already-selected disabled rows." D58/D60 covers the first
   structurally; the second (via `deselect()`'s explicit exemption from both rules) needs its own
   named test given how easily libraries get only one half right.
7. **A `Set`-backed, signal-read, unstamped selection model is a real defense against a
   performance bug class three of five libraries have shipped and needed year-plus fixes for**
   (Theme 7) — worth stating as rationale, not just implementation detail.
8. **"A row is edited such that it should no longer be selectable" has no precedent in any
   tracker** (Theme 8) — same finding as the filtering research's edit-collision theme; genuinely
   unaddressed industry-wide, worth an explicit product decision rather than assumed convention.

Total distinct issues/PRs cited above with a verified number, state, and date: **48** (plus one
adjacent non-target-library citation and one explicitly marked unverified/not-found, both called
out inline rather than omitted).
