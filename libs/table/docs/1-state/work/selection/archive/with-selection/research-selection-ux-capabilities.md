---
title: Research — row-selection user-facing capabilities across grid libraries
type: research
status: complete
date: 2026-09-12
audience: product, developers
issue: null
---

# What a person can _click and press_ for row selection — capability inventory across grid libraries

Product-side input for `withSelection()` user stories. Same method as the sibling
`research-filter-ux-capabilities.md`, focused on **row selection**: what a person can click, tap,
and press — not what config key or callback shape a developer wires up. That developer-facing
question is already covered by two sibling docs in this folder —
[research-row-selectability.md](research-row-selectability.md) (how a row is made non-selectable)
and [research-selection-change-events.md](research-selection-change-events.md) (event/callback
shape) — axis 9 below only cross-references them rather than re-deriving.

Competitor set differs from the filtering research: **Angular CDK's `SelectionModel`**, **TanStack
Table v8**, **AG Grid**, **Material React Table (MRT)**, and **PrimeNG** — CDK stands in for MUI
X's slot here, since it is the state primitive Angular Material's own table selection pattern is
built on and the closest analogue to this library's state-only layer.

Internal design ships: no selection-scope concept at all (`toggle`/`select`/`deselect` take
whatever id set the caller means, D1); `enableMultiRowSelection` and `enableRowSelection` as
per-row predicates gating the write path only (D2, D58); flat ids with no parent/child cascade
(D13); a `selectAllIds()` helper reading `rows()` (visible) vs `value()` (all), boolean not
`scope` enum (D59); a CDK-shaped `{added, removed}` delta on every write verb (D9). Every axis
below is read against that baseline.

## Method and versions

Every claim is read from published documentation or source, fetched 2026-09-12, cited by URL.
Version pins carried over from the sibling developer-facing research in this same folder
(`research-row-selectability.md`, `research-selection-change-events.md`), read from installed
packages/tarballs there — reused here rather than re-pinned, since they are the same libraries at
the same point in time.

| Library                      | Version read                                                        | Selection tier                                                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Angular CDK `SelectionModel` | `@angular/cdk@22.1.2` (source, `main` branch matches installed API) | Free — no paid tier exists; ships zero UI                                                                                                                                   |
| TanStack Table v8            | `@tanstack/table-core@8.21.3`                                       | Free, headless — no rendered UI of any kind                                                                                                                                 |
| AG Grid                      | `ag-grid-community@36.1.0` / enterprise docs                        | Row selection itself (checkbox, click, shift/ctrl-click, keyboard): **Community**. Grouping/tree cascade, server-side select-all, Status Bar selected-count: **Enterprise** |
| PrimeNG `p-table`            | `primeng@22.1.1`                                                    | Free — no paid tier exists                                                                                                                                                  |
| Material React Table         | `material-react-table@3.2.1`                                        | Free; TanStack v8 underneath, adds the rendered checkbox/radio UI layer TanStack omits                                                                                      |

Docs roots: [ag-grid.com row-selection](https://www.ag-grid.com/angular-data-grid/row-selection/),
[tanstack.com/table/v8 row-selection](https://tanstack.com/table/v8/docs/guide/row-selection),
[primeng.dev/table](https://primeng.dev/table),
[material-react-table.com row-selection](https://www.material-react-table.com/docs/guides/row-selection),
[github.com/angular/components cdk/collections](https://github.com/angular/components/blob/main/src/cdk/collections/selection-model.ts).

---

## 1. Select-all affordance

- **AG Grid**: `rowSelection.selectAll` is a three-way, user-invisible config: `'all'` (default —
  every selectable row in the grid, not just what's rendered), `'filtered'` (only rows passing
  active filters), `'currentPage'` (only rows on the current page, and only those also passing
  filters). When `isRowSelectable` is set, "the header checkbox will only select selectable rows."
  Under the **Server-Side Row Model (Enterprise)**, `'filtered'`/`'currentPage'` are explicitly
  **invalid** — only `'all'` is supported, and it selects the _entire server-side dataset_,
  including rows never fetched/rendered: `getServerSideSelectionState()` /
  `setServerSideSelectionState()` are the documented way to read/write that state "without having
  ever loaded the rows." This is the only library in the set that reaches the third rung of the
  axis ("every row ever, even unfetched"). Indeterminate state is real and native — CSS classes
  `.ag-selection-checkbox-checked` / `-unchecked` / `-indeterminate` exist and ship on the header
  checkbox, though its historical GitHub issues (v20-era) show it has been a recurring bug surface,
  not a trivially solid feature.
  [Multi-row selection](https://www.ag-grid.com/angular-data-grid/row-selection-multi-row/) ·
  [SSRM row selection](https://ag-grid.com/angular-data-grid/server-side-model-selection/) ·
  [ag-grid#2924](https://github.com/ag-grid/ag-grid/issues/2924) ·
  [ag-grid#2784](https://github.com/ag-grid/ag-grid/issues/2784)
- **TanStack v8**: no rendered checkbox at all, but **two distinct helper functions naming the
  same fork AG Grid encodes in config**: `getToggleAllRowsSelectedHandler()` (all rows in the
  current row model, i.e. post-filter but pre-pagination) vs. `getToggleAllPageRowsSelectedHandler()`
  (current page only). `getIsSomeRowsSelected()` exists purely to let a consumer drive their own
  checkbox's `indeterminate` DOM property — TanStack computes the boolean, renders nothing.
  [Row Selection guide](https://tanstack.com/table/v8/docs/guide/row-selection)
- **CDK `SelectionModel`**: no select-all concept whatsoever — no method, no helper. The canonical
  Angular Material table-selection example (which every Angular app copies) hand-writes
  `toggleAllRows()` calling `this.selection.select(...this.dataSource.data)`, and
  `isAllSelected()` comparing `selection.selected.length` to `dataSource.data.length`. Because
  `dataSource.data` is whatever slice the developer's `MatTableDataSource` currently holds, this
  pattern silently becomes page-scoped the moment a paginator is added — a well-known trap, not a
  documented option. Indeterminate is likewise 100% consumer-authored:
  `[indeterminate]="selection.hasValue() && !isAllSelected()"` is template code, not a
  `SelectionModel` capability.
  [`selection-model.ts`](https://github.com/angular/components/blob/main/src/cdk/collections/selection-model.ts) ·
  [`table-selection-example.ts`/`.html`](https://github.com/angular/components/tree/main/src/components-examples/material/table/table-selection)
- **PrimeNG**: checkbox mode's header (`p-table-header-checkbox`) selects **every row in the
  dataset by default**, spanning pages — `selectionPageOnly` (boolean, default `false`) is the
  documented opt-in to make it current-page-only. This is the inverse default of MRT (below).
  [primefaces/primeng#8301](https://github.com/primefaces/primeng/issues/8301) ·
  [primefaces/primeng#10967](https://github.com/primefaces/primeng/issues/10967)
- **MRT**: `selectAllMode: 'all' | 'page'`, **default `'page'`** — the opposite default from
  PrimeNG. `enableSelectAll` (default `true`) toggles whether the header checkbox renders at all.
  Indeterminate wiring is not spelled out in the fetched guide text (MRT renders the header
  checkbox itself, presumably feeding it TanStack's `getIsSomeRowsSelected()` the same way it feeds
  every other TanStack primitive into MUI's `Checkbox` — **inferred, not doc-confirmed**).
  [Row Selection guide](https://www.material-react-table.com/docs/guides/row-selection)

**Where they disagree.** Three different defaults for what an unconfigured header checkbox does:
AG Grid and PrimeNG both default to **every row in the dataset** (filtered/paginated or not); MRT
defaults to **current page only**; TanStack ships no default because it ships no checkbox at all,
but is the only library to expose the page-scoped and dataset-scoped variants as two _separately
named, equally first-class_ functions rather than one flag with a chosen default. Nobody besides
AG Grid's SSRM mode reaches "every row ever, including unfetched" — and even there it's gated to
Enterprise and to server-mode specifically. This maps directly onto the internal design's D1/D59
stance (no scope concept at all, the caller passes the id set): the industry's disagreement here
_is_ the D1 finding restated — a `scope` enum has no single sane default because three vendors
picked three different ones.

## 2. Individual row selection

- **AG Grid**: three simultaneous input paths, all Community. A dedicated **checkbox column**
  (`selectionColumnDef`, on by default when selection is configured). **Click-anywhere**, via
  `rowSelection.enableClickSelection`: `true` (click both selects and deselects), `'enableSelection'`,
  `'enableDeselection'`, or `false`. **Keyboard**: `Space` on a focused cell selects/deselects that
  row without clearing other selections under multi-select. All three can be active together.
  [Multi-row selection](https://www.ag-grid.com/angular-data-grid/row-selection-multi-row/)
- **TanStack v8**: none built — `row.getToggleSelectedHandler()` is a bare event-handler factory a
  consumer attaches to whatever DOM element they choose (a checkbox, the `<tr>` itself, anything).
  No default affordance exists until wired.
  [Row Selection guide](https://tanstack.com/table/v8/docs/guide/row-selection)
- **CDK**: same as TanStack — `SelectionModel.toggle(value)` is a plain method; the Material
  example's row-click wiring (`(click)="selection.toggle(row)"`, checkbox's own click stopping
  propagation so the two paths don't double-fire) is application code demonstrating one convention,
  not a `SelectionModel` default.
  [`table-selection-example.html`](https://github.com/angular/components/tree/main/src/components-examples/material/table/table-selection)
- **PrimeNG**: **mode determines the affordance, not a separate flag.** `selectionMode="single"` /
  `"multiple"` click the row directly (no checkbox needed); pairing multi-mode with
  `metaKeySelection` makes Ctrl/Cmd-click toggle and plain click replace. A **separate** checkbox
  affordance exists via `p-tableCheckbox`/`p-tableHeaderCheckbox` markup, usable instead of or
  alongside row-click depending on which template cells the developer includes. A **radio-button**
  variant (`p-table-radio-button`) is the third option, single-select only.
  [Table docs](https://primeng.dev/table)
- **MRT**: checkbox is the default multi-select affordance; `enableMultiRowSelection: false`
  switches the same control to a **radio button** automatically (not a separate prop to learn).
  Click-anywhere is _not_ a shipped default — it requires the documented recipe of wiring
  `muiTableBodyRowProps.onClick` to `getMRT_RowSelectionHandler()` yourself.
  [Row Selection guide](https://www.material-react-table.com/docs/guides/row-selection)

**Where they disagree.** AG Grid and PrimeNG both ship click-anywhere as a **first-class,
declarative option** (a boolean/mode, no extra wiring); TanStack, CDK, and MRT all require the
consumer to hand-attach a click handler to get the same behavior — the checkbox-only path is each
library's true zero-config default. PrimeNG is the only library where the _selection mode itself_
(single vs. multiple) changes which affordance appears by default (row-click for both single and
multi, checkbox optional) rather than checkbox being the fixed default and click-anywhere the
opt-in.

## 3. Range/multi selection from keyboard and mouse

- **AG Grid**: **Shift-click** on checkboxes "adds a range of adjacent rows to the selection"
  (Community). **Ctrl-click** deselects when `enableClickSelection` is `'enableDeselection'` or
  `true`. **`Space`** on a header checkbox toggles select-all/deselect-all. **Shift+arrow keys for
  row range selection are not documented** — the only shift+keyboard combo found
  (`Shift+Enter`) is scoped to **column/cell** range selection, a different feature from row
  selection. **`Ctrl+A`** is documented only as `ctrlASelectsRows`, and only "when Cell Selection is
  enabled" — i.e. it is a cell-selection feature that happens to also select rows as a side effect,
  not a row-selection-native shortcut.
  [Multi-row selection](https://www.ag-grid.com/angular-data-grid/row-selection-multi-row/) ·
  [Keyboard navigation](https://www.ag-grid.com/angular-data-grid/keyboard-navigation/)
- **TanStack v8**: nothing built for any of shift-click, ctrl-click, shift+arrow, or Ctrl+A — every
  one would be consumer-authored on top of `setRowSelection()`.
- **CDK**: identical absence — `SelectionModel` has no range concept; a shift-click range selector
  is a common community recipe (tracking "last clicked index," slicing the data array) but is not
  part of the API surface at all.
- **PrimeNG**: the fullest built-in keyboard vocabulary of the five. Arrow keys move row focus;
  `Space`/`Enter` toggles the focused row; **`Shift+Arrow`** extends a range from the anchor;
  **`Shift+Space`** "selects the rows between the most recently selected row and the focused row";
  **`Ctrl+A`** "selects all rows" — though a filed bug
  ([primefaces/primeng#15903](https://github.com/primefaces/primeng/issues/15903)) shows
  `Ctrl+A` combined with `dataKey` under multi-select can report the wrong selected count, meaning
  the feature is real but not fully solid. Mouse-side, `metaKeySelection` is required for
  Ctrl/Cmd-click to toggle rather than replace, and plain-click range behavior is implied by the
  shift-click pairing documented alongside it.
  [Table docs](https://primeng.dev/table) ·
  [primeng#15903](https://github.com/primefaces/primeng/issues/15903)
- **MRT**: `enableBatchRowSelection` (default `true`) is the one named capability — Shift-click
  "select[s] all rows between the last selected row and the clicked row." No ctrl-click, shift+arrow,
  or Ctrl+A behavior is documented; MRT inherits TanStack's absence there.
  [Row Selection guide](https://www.material-react-table.com/docs/guides/row-selection)

**Where they disagree.** PrimeNG is the only library with a **documented, complete keyboard range
story** (arrows, shift+arrow, shift+space, Ctrl+A) — and even it has an open correctness bug on the
combination that matters most (`Ctrl+A` + `dataKey`). AG Grid, the most feature-rich library
overall, has the **weakest keyboard range story of the five for rows specifically** — its shift and
Ctrl+A behaviors are real but scoped to _cell_ selection, a materially different feature that
happens to share a keyboard vocabulary. Mouse-side shift-click is near-universal (AG Grid, PrimeNG,
MRT all name it); ctrl-click for toggle-without-replacing is real in AG Grid and PrimeNG but absent
from MRT's documented feature list. Nobody in the state-only tier (CDK, TanStack) ships any of
this — it is UI-layer work in every one of these libraries, never state-primitive work, which
matches this repo's own state/UI split (D3).

## 4. Selection under grouping

- **AG Grid**: `rowSelection.groupSelects` is the explicit three-way switch — **`'self'`** (default:
  selecting a group row has no effect on its children), **`'descendants'`** (selecting a group
  selects every descendant), **`'filteredDescendants'`** (same, but only descendants passing the
  active filter). Indeterminate group checkboxes are real (same CSS-class mechanism as axis 1).
  **Group nodes are excluded from `api.getSelectedNodes()`/`getSelectedRows()`** under
  `'descendants'`/`'filteredDescendants'` — the selection count/read API is leaf-rows-only by
  construction, even though the group row visually shows as checked/indeterminate. Grouping itself
  is **Enterprise**; the selection _mechanism_ (`RowSelectionModule`) is Community, so this whole
  axis only exists for a customer already paying for grouping.
  [Row grouping — selection](https://www.ag-grid.com/angular-data-grid/grouping-row-selection/)
- **TanStack v8**: `enableSubRowSelection` (boolean or per-row predicate), default behavior:
  "selecting a parent row will select all of its sub-rows." No indeterminate helper specific to
  grouping is named beyond the generic `getIsSomeRowsSelected()`; whether a parent's own id counts
  toward `getSelectedRowModel()` is a function of whatever `getRowId` yields for that row — the
  library does not special-case it the way AG Grid explicitly excludes group nodes.
  [Row Selection guide](https://tanstack.com/table/v8/docs/guide/row-selection)
- **MRT**: `enableSubRowSelection` (default `true`), same TanStack primitive surfaced with a
  boolean-or-callback shape, applied to its expanding/grouped sub-row feature.
  [Row Selection guide](https://www.material-react-table.com/docs/guides/row-selection)
- **CDK**: not applicable — `SelectionModel` has no row-hierarchy concept; a CDK **tree** (a
  different primitive, `SelectionModel` + `FlatTreeControl`) is where Angular apps build cascading
  checkbox trees, entirely hand-wired per app.
- **PrimeNG**: **this is a real, long-standing gap, not a quiet omission.** Row grouping
  (`rowGroup`) and selection are documented by users as actively **conflicting**: clicking one row
  selects every row in its group unintentionally
  ([primefaces/primeng#5831](https://github.com/primefaces/primeng/issues/5831), "conflicting
  behavior"), and a group-header checkbox that cascades to its members has been an open feature
  request for years with no built-in resolution
  ([primefaces/primeng#4310](https://github.com/primefaces/primeng/issues/4310),
  [forum thread](https://forum.primefaces.org/viewtopic.php?t=50587)). There is no `groupSelects`-
  equivalent switch anywhere in PrimeNG's table API.

**Where they disagree.** This is the sharpest split in the whole inventory. AG Grid ships a
deliberate three-way policy plus a considered answer to "does the count include group headers"
(no — leaf-only, always). TanStack/MRT ship one boolean default (cascade on) with no explicit
group-vs-leaf counting policy documented at all. PrimeNG ships **nothing** — its grouping and
selection features actively fight each other in production, years-old bug reports unresolved. This
directly hits the internal design's open question ("group-header select-all... undecided whether
this is library API or consumer code," `2-decisions.md`): AG Grid is the only library proving a
library-owned cascade policy is buildable and defensible; PrimeNG is proof of what shipping
grouping and selection as unrelated features costs a user once both are turned on at once — a
concrete cautionary case for whatever `withGrouping()` does with `withSelection()`.

## 5. Selection surviving filter/sort/pagination changes

- **AG Grid**: **selection is filter/sort-independent by default and by design.** A selected row
  that a filter later hides **stays selected** — `getSelectedRows()` still returns it — confirmed
  both by an issue reporter's expectation and AG Grid's own SSRM docs stating selections "are
  preserved when the grid is sorted or filtered and are displayed as selected when scrolled into
  view," including "if a selected row doesn't match the applied filter, it will still be selected
  when the filter is removed." Community-mode `'currentPage'`/`'filtered'` select-all scopes (axis
  1. only change what a **future** select-all click captures — they do not retroactively touch
     rows already selected before the filter changed.
     [ag-grid#3555](https://github.com/ag-grid/ag-grid/issues/3555) ·
     [SSRM row selection](https://ag-grid.com/angular-data-grid/server-side-model-selection/)
- **TanStack v8**: same posture, explicit in the docs — selection state is "row ids that are not
  present in the data array just fine," i.e. it is not pruned when rows leave the visible/filtered
  set. The load-bearing caveat is `getRowId`: default index-based ids mean a selected "row 3" can
  silently become a _different_ row after a sort/filter/page change re-indexes the array — the
  library's own guidance is to always supply a stable `getRowId` precisely to avoid this. Pagination
  specifically: `getSelectedRowModel()` only returns rows present in the _currently materialized_
  row model, so a selection on another page reads as "not there" from that API even though the
  underlying `rowSelection` state object still holds it.
  [Row Selection guide](https://tanstack.com/table/v8/docs/guide/row-selection) ·
  [TanStack/table#4781](https://github.com/TanStack/table/issues/4781)
- **CDK**: trivially persists, because `SelectionModel` is never touched by sort/filter/pagination
  code at all — it only knows what `select()`/`deselect()` told it. The failure mode is the mirror
  image of AG Grid/TanStack's _intentional_ behavior: because nothing prunes it, a `MatTableDataSource`
  swap that changes which objects represent "the same" row (e.g. re-fetched objects with new
  identity) can silently orphan a selection unless the developer's own `compareWith` or object
  identity discipline holds.
- **PrimeNG**: **the community's own workaround is to clear selection by hand.** No stated built-in
  policy either way was found in the fetched docs; the pattern surfacing in the wild
  (`(onFilter)="selectedItems = []"`) is developers **manually resetting** selection on filter
  change because the library doesn't decide it for them — the opposite failure mode from AG Grid's
  documented "stays selected" guarantee. `dataKey` is repeatedly cited as necessary to avoid
  selection state drifting during sort/filter, implying that without it identity is index-based and
  fragile in the same way TanStack's default `getRowId` is.
- **MRT**: not separately documented from TanStack in the fetched pages; presumably inherits
  TanStack's "persists, but get a stable `getRowId`" posture. **Unverified independently.**

**Where they disagree.** AG Grid and TanStack both make an explicit, confident choice — **keep it
selected, always**, and both explain _why_ (a selection is a fact about a row, not about the
current view). PrimeNG has no such stated policy, and the community's own coping pattern
(`onFilter` handlers that wipe selection) is the visible symptom of that gap — it's a real, if
unglamorous, product decision PrimeNG has left to every integrator to make for themselves. This is
the axis where the internal design already has the most going for it structurally: `withSelection()`
stores ids in a plain `Set` untouched by `withFiltering()`/pagination (D1), which is architecturally
identical to AG Grid/TanStack's stance — the only question the internal design still owns is
whether `selectionStateOf(ids)`'s denominator should count a since-hidden id (open question in
`2-decisions.md`, and no library here settles it either).

## 6. Disabled/locked row selection

Fully covered by the sibling doc [research-row-selectability.md](research-row-selectability.md)
(source-verified against installed packages, not re-derived here). Summary relevant to the
_person-facing_ half only:

- **Visual convention is unanimous**: render a **disabled control, never hide it**. MRT disables
  the checkbox (`disabled={!row.getCanSelect()}`); AG Grid renders a disabled checkbox by default
  and only hides it via an explicit opt-in (`rowSelection.hideDisabledCheckboxes`, default `false`);
  PrimeNG's `p-tableCheckbox` takes its own `disabled` and separately registers the row into
  `disabledSelectionKeys`; CDK listbox (the closest CDK primitive with a disabled concept at all —
  `SelectionModel` itself has none) uses `aria-disabled` while keeping the option **focusable**,
  which the sibling doc calls "the a11y-correct baseline."
- **PrimeNG's disabled-row story has a real, filed gap**: a header "select all" checkbox has been
  reported to select disabled rows anyway, counting them in the total
  ([primefaces/primeng#6736](https://github.com/primefaces/primeng/issues/6736)), and disabled rows
  ship with no distinguishing style out of the box
  ([primefaces/primeng#9944](https://github.com/primefaces/primeng/issues/9944)) — a person cannot
  visually tell a locked row from a selectable one without the integrator adding their own CSS.
- **Nobody auto-deselects a row that becomes locked while selected** except AG Grid, which does —
  and pays for it with a `'selectableChanged'` entry in its 16-value selection-source enum to
  explain the library-initiated change to subscribers. Every other library leaves a
  selected-then-disabled row selected until something else writes to it.

## 7. Selection count / bulk-action toolbar

- **AG Grid**: `agSelectedRowCountComponent` is a **grid-provided Status Bar panel** — but the
  entire Status Bar feature is **Enterprise**. A Community user gets no built-in "N selected"
  affordance of any kind; they read `api.getSelectedRows().length` and render their own.
  [Status Bar](https://www.ag-grid.com/angular-data-grid/status-bar/)
- **TanStack v8**: nothing — `table.getSelectedRowModel().rows.length` is the raw number, no UI.
- **CDK**: nothing — `selection.selected.length` is the raw number, no UI, no convention for where
  to put it.
- **PrimeNG**: no dedicated selected-count or bulk-action-bar component found in the fetched docs;
  the documented pattern (e.g. the CRUD-demo style) is a developer-built toolbar reading the bound
  `selection` array's length. **Absent, not just under-documented** — searched specifically and
  found no such component.
- **MRT**: the **only library in the set shipping a built-in, automatic indicator**.
  `positionToolbarAlertBanner` (`'top'` / `'bottom'` / `'none'`) renders a banner that "displays
  selected row count automatically" with zero developer wiring beyond choosing its position.
  [Row Selection guide](https://www.material-react-table.com/docs/guides/row-selection)

**Where they disagree.** This is a clean 1-of-5 split: MRT gives away a real, automatic bulk-action
surface for free; AG Grid has the equivalent component but paywalls the whole Status Bar it lives
in; TanStack, CDK, and PrimeNG give the integrator nothing at all — not even a documented recipe in
PrimeNG's case. Free-tier MRT out-building paid-tier-gated AG Grid on this one specific affordance
is a useful data point: a "N selected" banner is cheap enough to build that gating it behind an
Enterprise-wide feature (rather than selling it standalone) reads as bundling, not as evidence the
capability itself is expensive.

## 8. Accessibility

- **AG Grid**: `aria-selected` is applied to both rows and cells, "only present if the
  row/cell is selectable" — i.e. a non-selectable row/cell carries no `aria-selected` attribute at
  all rather than `aria-selected="false"`, a subtle but real distinction from CDK listbox's
  `aria-disabled`-while-present convention. AG Grid's own docs **admit a known screen-reader
  limitation**: "some screen readers will not recognise changes that happen to an element that is
  currently focused," so a selection made via keyboard on the currently-focused row may not be
  announced — the documented workaround is moving focus away and back, which is a genuine UX
  compromise, not a solved problem.
  [Accessibility](https://www.ag-grid.com/angular-data-grid/accessibility/)
- **TanStack v8 / CDK `SelectionModel`**: no ARIA guidance at all — both are headless/state-only,
  so `aria-selected`, live-region announcements, and focus management are entirely the consumer's
  responsibility. CDK's own **listbox** primitive (a different module) does the ARIA work properly
  (`aria-disabled`, focus-preserving skip behavior) but that pattern does not transfer to
  `SelectionModel` automatically — a developer must choose to route through listbox semantics.
- **PrimeNG**: sets `aria-selected="true"` on a selected row and exposes `selectAll`/`unselectAll`
  locale keys specifically to label the header checkbox for assistive tech — the only library found
  to treat the header checkbox's _label text_ as a first-class, translatable a11y concern rather
  than an implementation detail left to the integrator.
  [Table docs](https://primeng.dev/table)
- **MRT**: no selection-specific accessibility documentation was found in the fetched guide;
  behavior is presumably whatever MUI's underlying `Checkbox`/`TableRow` components provide by
  default (MUI does not model native ARIA grid `role="row"`/`aria-selected` semantics out of the
  box for a plain `<table>`). **Unverified, and worth flagging as a real gap in MRT's own docs** —
  every other library in this set at least states something about `aria-selected`; MRT's guide is
  silent on it entirely.

**Where they disagree.** AG Grid is the only library candid about a known, unresolved screen-reader
gap rather than presenting selection a11y as solved — worth taking at face value rather than as a
uniquely AG Grid problem, since it likely applies to any grid announcing selection state on an
already-focused element. PrimeNG is the only library treating the header checkbox's _label_
(select-all vs. deselect-all) as something to localize and get right, which the internal design's
directive layer (D6's native-checkbox-only stance) should account for when it eventually drills
`aria-label`/announcement text for `ngpTableSelectionCheckbox`.

## 9. Selection change events/callbacks

Covered in depth by the sibling doc
[research-selection-change-events.md](research-selection-change-events.md) — not re-derived here
per this document's scope. One-line summary for cross-reference: of the five libraries read there,
**CDK is the only one shipping a delta** (`{source, added, removed}`), which is what
`withSelection()`'s own `SelectionChange` (D9) is modeled on; PrimeNG splits the same information
into two separate events (`onRowSelect`/`onRowUnselect`) that cannot jointly express a single
single-select "replace" write; AG Grid and TanStack ship no delta at all, only a snapshot getter.

---

## 10. Tier splits

| Capability                                              | AG Grid                                        | PrimeNG                                                            | MRT                                        | TanStack / CDK                          |
| ------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------ | --------------------------------------- |
| Checkbox + click-anywhere + keyboard row toggle         | **Free**                                       | **Free**                                                           | Checkbox free; click-anywhere needs wiring | n/a (no UI)                             |
| Shift-click / ctrl-click                                | **Free**                                       | **Free**                                                           | Shift-click free; no ctrl-click documented | n/a                                     |
| Shift+Arrow / Ctrl+A keyboard range                     | Cell-selection only, not row                   | **Free** (buggy w/ `dataKey`)                                      | Not documented                             | n/a                                     |
| Native indeterminate header checkbox                    | **Free**                                       | Not confirmed                                                      | Inferred, not confirmed                    | n/a (consumer-built)                    |
| Select-all scope = literally every row, unfetched       | **Enterprise** (SSRM only)                     | Not offered                                                        | Not offered                                | Not offered                             |
| Group-header cascade selection (`groupSelects`)         | **Enterprise** (grouping itself is Enterprise) | **Not built** — conflicts with grouping                            | Free (`enableSubRowSelection`)             | Free (TanStack primitive)               |
| Built-in "N selected" bulk toolbar                      | **Enterprise** (Status Bar)                    | **Not offered**                                                    | **Free**, automatic                        | Not offered                             |
| Disabled-row predicate + disabled (not hidden) checkbox | **Free**                                       | Free, but header select-all has a filed bug counting disabled rows | Free                                       | n/a (CDK: view-layer only, via listbox) |

**Where they disagree.** The Enterprise line AG Grid draws is consistent across every row on this
table: **anything requiring the grid to reason about rows it hasn't rendered or fully modeled**
(unfetched rows, grouped hierarchies, an aggregate status bar) is paywalled; anything about a
single row in front of the user (click, keyboard toggle, disabled predicate) is free. MRT's free
tier out-competes AG Grid Enterprise on exactly one line (the bulk toolbar) and is silent on
another (group cascade uses the plain TanStack default, no policy). PrimeNG is the one vendor with
a real, unresolved product gap rather than a deliberate paywall — grouping and selection were
simply never designed to cooperate.

---

## What this suggests for `withSelection()` user stories

Not decisions — just where the inventory points.

- **The internal design's "no scope concept" (D1) has real cross-vendor cover.** Three different
  vendors picked three different defaults for what select-all means (AG Grid/PrimeNG: everything;
  MRT: current page), which is itself evidence there is no "obviously correct" default to inherit —
  refusing to bake one in is defensible, not a gap.
- **Selection-survives-filtering is the majority, confident position** (AG Grid, TanStack both
  state it as a deliberate guarantee) — the internal design's architecture already matches it by
  construction. What's still open industry-wide, not just internally, is whether the _denominator_
  for a tri-state/count should count a since-hidden id — nobody here has answered that either.
- **Group-header cascade is a genuine fork with a cautionary tale attached.** AG Grid proves a
  library-owned `groupSelects`-style policy is buildable; PrimeNG is the concrete, years-old proof
  of what happens when grouping and selection ship as unrelated features and a user turns both on —
  worth citing directly the next time `withGrouping()` × `withSelection()` interaction comes up as
  an open question.
- **A built-in selection-count/bulk-action banner is cheap and worth a story even if the primitive
  won't own it.** MRT gives it away free with zero developer wiring; naming it as a documented
  consumer recipe (similar to how directives already document a disabled-checkbox recipe per D6)
  costs little and closes a gap three of five competitors leave open.
- **PrimeNG's keyboard story (`Shift+Arrow`, `Shift+Space`, `Ctrl+A`) is the fullest in the set and
  worth using as the reference shape** if/when `docs/3-ui/directives/selection.md` designs keyboard
  behavior for `ngpTableSelectionCheckbox`/row directives — with the caveat that PrimeNG's own
  `Ctrl+A` + `dataKey` bug shows the naive implementation (recompute "all" against the wrong
  identity source) is an easy trap.
- **MRT's silence on `aria-selected` is a real gap to not accidentally copy.** Every other library
  states something about selection ARIA; a table library whose docs say nothing about it is a
  signal, not an absence of a problem — worth being explicit in this library's own a11y story
  rather than assuming "everyone does this fine."

---

## Not researched

- **AG Grid tree-data selection** (`row-selection-tree` equivalent to grouping's cascade) — named
  in search results, not separately fetched; likely mirrors `groupSelects` but not confirmed.
- **MRT's exact indeterminate-checkbox wiring** — inferred from its general pattern of surfacing
  TanStack helpers into MUI components, not confirmed by an explicit doc statement.
- **MRT and PrimeNG's precise selection-persistence-under-pagination behavior** — TanStack/AG Grid
  have explicit statements; MRT presumably inherits TanStack's, PrimeNG's own stance was not found
  stated anywhere, only inferred from community workaround patterns.
- **Touch/mobile-specific selection gestures** (long-press to enter selection mode, swipe actions) —
  not covered by any of the fetched desktop-oriented docs; out of scope for this pass.
- **CDK listbox's full ARIA/keyboard model in detail** — cited only as the closest CDK analogue for
  disabled-row treatment (per the sibling `research-row-selectability.md`), not independently
  re-researched here.
- **PrimeNG's exact `disabledSelectionKeys` / `rowSelectable` implementation** — already
  source-verified in `research-row-selectability.md`; not re-fetched independently for this
  product-facing pass, only cross-referenced.

## Sources

Angular CDK (`@angular/cdk@22.1.2` API surface, read from `main` source) —
[`selection-model.ts`](https://github.com/angular/components/blob/main/src/cdk/collections/selection-model.ts) ·
[`table-selection-example.ts`](https://github.com/angular/components/blob/main/src/components-examples/material/table/table-selection/table-selection-example.ts) ·
[`table-selection-example.html`](https://github.com/angular/components/blob/main/src/components-examples/material/table/table-selection/table-selection-example.html)

TanStack Table v8 (`8.21.3`) —
[Row Selection guide](https://tanstack.com/table/v8/docs/guide/row-selection) ·
[TanStack/table#4781 (pagination + selection)](https://github.com/TanStack/table/issues/4781)

AG Grid (`ag-grid-community@36.1.0`) —
[Row selection overview](https://www.ag-grid.com/angular-data-grid/row-selection/) ·
[Multi-row selection](https://www.ag-grid.com/angular-data-grid/row-selection-multi-row/) ·
[Grouping — row selection](https://www.ag-grid.com/angular-data-grid/grouping-row-selection/) ·
[SSRM row selection](https://ag-grid.com/angular-data-grid/server-side-model-selection/) ·
[Keyboard navigation](https://www.ag-grid.com/angular-data-grid/keyboard-navigation/) ·
[Accessibility](https://www.ag-grid.com/angular-data-grid/accessibility/) ·
[Status Bar](https://www.ag-grid.com/angular-data-grid/status-bar/) ·
[ag-grid#3555](https://github.com/ag-grid/ag-grid/issues/3555) ·
[ag-grid#2924](https://github.com/ag-grid/ag-grid/issues/2924) ·
[ag-grid#2784](https://github.com/ag-grid/ag-grid/issues/2784)

PrimeNG (`primeng@22.1.1`) —
[Table docs](https://primeng.dev/table) ·
[primeng#8301 (page-only select-all request)](https://github.com/primefaces/primeng/issues/8301) ·
[primeng#10967 (`selectionPageOnly` request)](https://github.com/primefaces/primeng/issues/10967) ·
[primeng#15903 (Ctrl+A count bug with `dataKey`)](https://github.com/primefaces/primeng/issues/15903) ·
[primeng#5831 (rowGroup + selection conflict)](https://github.com/primefaces/primeng/issues/5831) ·
[primeng#4310 (group-header checkbox request)](https://github.com/primefaces/primeng/issues/4310) ·
[primeng#6736 (`rowSelectable` request)](https://github.com/primefaces/primeng/issues/6736) ·
[primeng#9944 (disabled-row styling gap)](https://github.com/primefaces/primeng/issues/9944) ·
[PrimeFaces forum — group-header checkbox](https://forum.primefaces.org/viewtopic.php?t=50587)

Material React Table (`material-react-table@3.2.1`) —
[Row Selection guide](https://www.material-react-table.com/docs/guides/row-selection)

Sibling in-repo research (developer-facing, cross-referenced not re-derived) —
[research-row-selectability.md](research-row-selectability.md) ·
[research-selection-change-events.md](research-selection-change-events.md)
