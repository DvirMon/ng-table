---
title: Research — row-filtering user-facing capabilities across grid libraries
type: research
status: complete
date: 2026-09-10
audience: product, developers
issue: null
---

# What a person can *do* with row filtering — capability inventory across grid libraries

Product-side input for `withFiltering()` / `createFilters()` user stories. Same four libraries
and same method as the sibling `research-grouping-ux-capabilities.md`, focused on **row
filtering**: what a person can click, type, and see — not what config key exists in the docs.

Internal design ships fixed, developer-declared filter kinds (`equals`, `contains`, `inRange`,
`inDateRange`, `hasAny`, `hasNone`, a general `filter()` predicate, `anyOf` for OR-grouped
multi-path criteria, `applyWhen` for conditional activation) and deliberately does **not** ship:
a runtime operator picker, a second filter per column (must drop to a custom compound predicate),
built-in debounce, a persistence/storage adapter, or data-derived filter options (auto-computed
distinct values for a set-style filter). Every axis below is read against that omission list.

## Method and versions

Every claim is read from published documentation, fetched 2026-09-10, cited by URL. Where a page
would not yield the needed detail through automated fetch, a second source (a `.d.ts`/type
export, a GeeksforGeeks reference, a GitHub issue evidencing a UI element by discussing its
customization) is used and flagged as such. Anything neither source confirmed is marked
**unverified** rather than guessed.

| Library | Version read | Filtering tier |
|---|---|---|
| AG Grid | `ag-grid-community@36.1.0` / enterprise docs (registry `latest`) | Text/Number/Date filters + AND/OR condition combining: **Community**. Set Filter, Multi Filter, Floating-filter-in-toolbar, Advanced Filter: **Enterprise** |
| TanStack Table | v8 line (`8.21.3` pinned by the sibling grouping research) | Free, headless — **no filter UI of any kind**, including no global-filter input |
| MUI X Data Grid | `@mui/x-data-grid-premium@9.13.0` (registry `latest`) | Single-column filtering + Quick Filter: **Community**. Multi-filter (AND/OR across/within columns) + Header Filters: **Pro**. Filtering is otherwise not further gated in Premium |
| PrimeNG `p-table` | `primeng@22.1.1` (registry `latest`) | Free — no paid tier exists |
| Material React Table | `material-react-table@3.2.1` (registry `latest`) | Free; TanStack v8 underneath, adds the entire UI layer TanStack omits |

Docs roots: [ag-grid.com filtering-overview](https://www.ag-grid.com/angular-data-grid/filtering-overview/),
[tanstack.com/table/v8 column-filtering](https://tanstack.com/table/v8/docs/guide/column-filtering),
[mui.com/x filtering](https://mui.com/x/react-data-grid/filtering/),
[primeng.dev/table](https://primeng.dev/table),
[material-react-table.com column-filtering](https://www.material-react-table.com/docs/guides/column-filtering).

---

## 1. Filter entry point

- **AG Grid**: three simultaneous routes. (a) A filter icon in the column-menu button, opening a
  popup with the filter's UI — free. (b) A **floating filter** row directly under the headers,
  editable in place — confirmed **Community-available** (`floatingFilter: true` per column or on
  `defaultColDef`); text/number/date floating filters degrade to read-only once a column has
  multiple conditions, set-filter floating cells are always read-only labels. (c) A **Quick
  Access Toolbar** search box — Enterprise (`ToolbarModule`) for the pre-built toolbar item, but a
  developer can wire an arbitrary input to `quickFilterText` in Community. Discovery signal: the
  filter icon itself, present whenever `filter: true` is set on a column.
  [Filtering overview](https://www.ag-grid.com/angular-data-grid/filtering-overview/) ·
  [Column menu](https://www.ag-grid.com/angular-data-grid/column-menu/) ·
  [Floating filters](https://www.ag-grid.com/angular-data-grid/floating-filters/) ·
  [Quick filter](https://www.ag-grid.com/angular-data-grid/filter-quick/)
- **TanStack v8**: none. No icon, no row, no box ships. The guide states plainly it exposes state
  and handler APIs "to interact with... and hook up to your UI components" — the entry point is
  100% consumer-built.
  [Column Filtering guide](https://tanstack.com/table/v8/docs/guide/column-filtering)
- **MUI X**: a filter icon inside the column header menu, **or** a "Filters" button in the
  toolbar — both open the same **side/overlay filter panel** (a list of filter rows, not inline
  per-column). Pro adds **Header Filters**: an input row built into the header itself (Pro-only),
  which stays synchronized with the panel rather than replacing it.
  [Filtering](https://mui.com/x/react-data-grid/filtering/) ·
  [Header filters](https://mui.com/x/react-data-grid/filtering/header-filters/)
- **PrimeNG**: `p-columnFilter` has two `display` modes on the *same* component — `"row"`
  (default): the input renders inline inside the header row itself; `"menu"`: a filter icon opens
  an overlay panel with match-mode dropdown, value input, and Apply/Clear buttons. Both are free.
  [Table docs](https://primeng.dev/table) ·
  [ColumnFilter properties](https://www.geeksforgeeks.org/angular-js/angular-primeng-table-columnfilter-properties/)
- **MRT**: three explicit `columnFilterDisplayMode` options — default (inputs render below the
  header, closest to PrimeNG's `row`), `'popover'` ("like excel", closest to a filter-icon menu),
  and a fully custom mode.
  [Column Filtering guide](https://www.material-react-table.com/docs/guides/column-filtering)

**Where they disagree.** Every UI-bearing library independently reinvented the same two shapes —
*inline row under/in the header* vs *icon opens a popup* — and three of the four (AG Grid,
PrimeNG, MRT) ship **both** as a configurable choice, while MUI X ships the popup by default and
gates the inline row behind Pro. TanStack is the odd one out by design: it is the only library
where "how does a person discover a column is filterable" has no answer at all until a consumer
builds one. That MUI X paywalls exactly the affordance (an always-visible input) that the other
three give away free is the sharpest signal that "filter visible without a click" is a paid-tier
differentiator, not a UI nicety.

## 2. Operator choice

- **AG Grid**: **user-changeable at runtime**, free. The default Text/Number/Date filters
  present "a list of Filter Options" (`contains`, `notContains`, `equals`, `notEqual`,
  `startsWith`, `endsWith`, `blank`, `notBlank` for text; analogous comparison operators for
  number/date) in a dropdown the end user opens and picks from. The Set Filter has no operator —
  membership is the only concept. [Text filter](https://www.ag-grid.com/angular-data-grid/filter-text/)
- **TanStack v8**: **fixed by the developer**, no runtime picker exists. `filterFn` is a column
  option (`includesString`, `includesStringSensitive`, `equalsString`, `equalsStringSensitive`,
  `arrIncludes`, `arrIncludesAll`, `arrIncludesSome`, `equals`, `weakEquals`, `inNumberRange`, or a
  custom function); switching it is a code change, not a click.
  [Column Filtering API](https://tanstack.com/table/v8/docs/api/features/column-filtering)
- **MUI X**: **user-changeable**, free, via a per-column operator dropdown inside the filter
  panel row (`getGridStringOperators()` "contains" etc., `getGridNumericOperators()`,
  `getGridDateOperators()`, `getGridBooleanOperators()`, `getGridSingleSelectOperators()` — each
  column type ships its own operator set the end user selects from).
  [Filtering](https://mui.com/x/react-data-grid/filtering/) ·
  [Filter customization](https://mui.com/x/react-data-grid/filtering/customization/)
- **PrimeNG**: **user-changeable**, free, via `matchModeOptions` shown as a dropdown in menu mode.
  Confirmed member set — text: `startsWith, contains, notContains, endsWith, equals, notEquals`;
  numeric: `equals, notEquals, lt, lte, gt, gte`; date: `dateIs, dateIsNot, dateBefore,
  dateAfter` — from `FilterMatchMode` and cross-checked against the columnFilter docs.
  [Match modes reference](https://www.geeksforgeeks.org/angular-js/angular-primeng-table-match-modes/)
- **MRT**: **user-changeable**, free — "enable column filter modes" opens a dropdown of available
  filter functions per column, reached via an icon in the filter text field itself.
  [Column Filtering guide](https://www.material-react-table.com/docs/guides/column-filtering)

**Where they disagree.** This is the axis where the internal design's stated decision (fixed by
the developer, no runtime picker) sides with exactly **one of five** libraries — TanStack, the
one with no UI at all. Every library that ships a rendered filter UI (AG Grid, MUI X, PrimeNG,
MRT) also ships a user-facing operator dropdown, free of charge, as a base capability rather than
a paid add-on. There is no precedent among the UI-bearing libraries for "developer fixes the
operator, end user only supplies a value" — that combination exists only where there's no filter
UI to attach a dropdown to in the first place. Product should read this as a deliberate,
narrower-than-market position, not an oversight.

## 3. Value input widgets per filter type

- **AG Grid**: text → single input; number → single input, or two inputs for `inRange` (default
  Number Filter supports a range operator); date → a calendar-picker input (native or provided
  date component) per bound; boolean → not a first-class provided filter type (no dedicated
  boolean filter is documented; typically modeled via Text/Set); Set Filter → **checkbox list
  auto-populated from distinct data values**, with its own mini-filter search box narrowing the
  checkbox list, a Select-All checkbox, and optional Apply/Clear/Reset/Cancel buttons. Set Filter
  also has a `treeList` mode presenting values hierarchically (e.g. year → month → day).
  [Set filter](https://www.ag-grid.com/angular-data-grid/filter-set/)
- **TanStack v8**: none built. `inNumberRange` exists as a *comparator*, but the two-input range
  UI, calendar widget, and boolean control are 100% consumer markup. **Faceting** APIs
  (`getFacetedUniqueValues()`, `getFacetedMinMaxValues()`, and the table-wide
  `getGlobalFacetedUniqueValues()`) exist purely to hand a consumer the distinct-value list or
  min/max pair to *build* a set-style dropdown or a range slider — explicitly "the wiring and UI
  rendering are entirely your responsibility."
  [Column Faceting guide](https://tanstack.com/table/v8/docs/guide/column-faceting) ·
  [Global Faceting guide](https://tanstack.com/table/v8/docs/guide/global-faceting)
- **MUI X**: filter panel value input adapts per operator/type — free text input by default;
  `singleSelect` columns get a dropdown of the column's declared `valueOptions` (developer-
  supplied, not auto-derived from data); boolean columns get their boolean-specific operators
  (is/is not) with a matching control; date columns pair with MUI's date-picker component per
  operator. A custom `InputComponent` can replace any of these.
  [Filter customization](https://mui.com/x/react-data-grid/filtering/customization/)
- **PrimeNG**: `type="text" | "numeric" | "date" | "boolean"` on `p-columnFilter` each render a
  matching native/PrimeNG input (numeric gets locale/currency/fraction-digit formatting props;
  boolean's control changed in v18 — **`TriStateCheckbox` was removed and replaced by "Checkbox
  with indeterminate"**, and a display bug on reopening the filter menu is open as
  [primeng#17817](https://github.com/primefaces/primeng/issues/17817)). A **MultiSelect** filter
  (`matchMode="in"`) is the set-style widget — its option list is **developer-supplied**, not
  auto-computed from the table's own data (no distinct-value derivation is documented anywhere in
  PrimeNG's filtering surface).
  [ColumnFilter properties](https://www.geeksforgeeks.org/angular-js/angular-primeng-table-columnfilter-properties/)
- **MRT**: the widest built-in vocabulary of the five — 11+ named `filterVariant`s: `text`,
  `select`, `multi-select`, `range`, `range-slider`, `date`, `datetime`, `date-range`,
  `datetime-range`, `time`, `time-range`, `checkbox`. `select`/`multi-select`/`range` variants
  auto-populate from **Faceted Values** — "a list of unique values for a column that gets
  generated under the hood from table data" — i.e. MRT is the only library in this set that turns
  TanStack's headless faceting API into an out-of-the-box, data-derived widget.
  [Column Filtering guide](https://www.material-react-table.com/docs/guides/column-filtering)

**Where they disagree.** Auto-computed distinct values is a real split, not a naming difference:
AG Grid's Set Filter (Enterprise) and MRT's `select`/`multi-select` (free) derive options from the
data automatically; MUI X's `singleSelect` and PrimeNG's MultiSelect both require the developer to
supply the option list by hand even though the on-screen widget looks identical to AG Grid's. A
person moving between these libraries would have no visual way to tell "this dropdown reflects
what's actually in the table" from "this dropdown reflects what a developer hardcoded" — that
distinction is exactly the one the internal design excludes (no data-derived filter options),
putting it in the company of MUI X and PrimeNG rather than AG Grid/MRT.

## 4. Global / quick filter

- **AG Grid**: Quick Filter scans **all columns**; matching is per-word, case-insensitive, AND
  across words ("Tony Ireland" requires both terms present somewhere in the row). It runs **in
  addition to** column filters — effectively AND'd with them, since a row must pass both to show.
  Free (`QuickFilterModule`) as a bring-your-own input; a pre-styled toolbar box is Enterprise.
  [Quick filter](https://www.ag-grid.com/angular-data-grid/filter-quick/)
- **TanStack v8**: `globalFilter` state and `setGlobalFilter()` exist; **no input is rendered** —
  "TanStack table will not add a global filter input UI to your table." Column-level
  `enableGlobalFilter: false` can exclude a column. Combination semantics with column filters
  are not documented centrally; both filter model layers exist and compose (both must pass).
  [Global Filtering guide](https://tanstack.com/table/v8/docs/guide/global-filtering)
- **MUI X**: Quick Filter is a toolbar text field, **Community-tier**, with **built-in debounce**
  (`debounceMs`) — the only library confirmed to ship debounce out of the box for any filter
  input. Default word-matching is **AND** (all words must appear somewhere), switchable to
  **OR** via `quickFilterLogicOperator`. Runs alongside per-column filters (both apply).
  [Quick filter](https://mui.com/x/react-data-grid/filtering/quick-filter/)
- **PrimeNG**: a single `global` key inside the `filters` state object, developer-bound to any
  input; `globalFilterFields` names which columns participate. Runs simultaneously with
  per-column filters, both active at once. No debounce is documented as built in.
- **MRT**: search box lives in the toolbar (position configurable left/right), uses `match-sorter`
  **fuzzy ranking by default** — results are ordered by closeness of match, a step beyond every
  other library's plain substring/word match — with `contains`/`startsWith` selectable
  alternatives. No documented debounce.
  [Global Filtering guide](https://www.material-react-table.com/docs/guides/global-filtering)

**Where they disagree.** Two axes split here. First, **debounce**: MUI X is the only library that
ships one, everyone else (including the internal design, by stated omission) leaves it to the
consumer. Second, **match ranking**: AG Grid/PrimeNG/MUI X all do exact substring/word matching;
MRT alone defaults to fuzzy, relevance-ranked matching via `match-sorter`. Nobody treats the
combination of quick filter + column filters as anything but a plain AND of two independent
layers — no library lets the *end user* pick how the two interact.

## 5. Active-filter visibility

- **AG Grid**: the filter icon itself changes appearance when a filter is active (standard grid
  chrome), and floating filters show the live value/condition inline. No badge/count or chip
  list is documented on the toolbar or column menu.
- **TanStack v8**: nothing rendered; `column.getIsFiltered()` / `getFilterValue()` exist purely as
  state a consumer can use to build their own indicator.
- **MUI X**: the filter **panel row itself has a delete (×) icon per filter constraint**, and a
  documented **"Remove all" button** clearing every filter at once — both confirmed via
  customization requests that presuppose their default existence
  ([mui-x#4063](https://github.com/mui/mui-x/issues/4063),
  [mui-x#11067](https://github.com/mui/mui-x/issues/11067)). Whether the toolbar "Filters" button
  itself shows a numeric badge for active-filter count is **unverified** — not confirmed in either
  the overview or customization docs.
- **PrimeNG**: menu-mode filter popovers include Apply/Clear per field; the docs do not describe
  any chip/pill list or a persistent "N filters active" indicator anywhere on the table chrome.
- **MRT**: not documented in the fetched pages; **unverified**.

**Where they disagree.** Only MUI X documents a granular, per-filter clear affordance
(delete icon per row) *and* a bulk "remove all," and it is the only one of the five with any
confirmed visibility mechanism beyond the filter's own input showing its current value. The other
four leave "can the user tell what's currently filtered, in one glance, without opening a menu" to
the consumer — which product should treat as a real gap most competitors also leave unfilled,
not as a settled non-requirement.

## 6. Combining filters

- **AG Grid**: two levels. **Within one column**, Filter Conditions join up to `maxNumConditions`
  (default 2, developer-raisable) constraints with a join-operator (AND/OR) dropdown the **end
  user** operates at runtime — confirmed free/Community on the Text Filter page. **Across
  columns**, every active column filter is implicitly AND'd; there is no cross-column OR/AND
  toggle exposed to the user. **Multi Filter** (Enterprise) layers *different filter types* (e.g.
  Text + Set) on one column, navigated via tabs/accordion, not a boolean combinator.
  [Filter conditions](https://www.ag-grid.com/angular-data-grid/filter-conditions/) ·
  [Multi filter](https://www.ag-grid.com/angular-data-grid/filter-multi/)
- **TanStack v8**: column filters are an array of `{id, value}`; combining logic across columns is
  whatever the consumer's filter functions implement — there is no built-in cross-column
  operator concept at all, let alone a user-facing toggle.
- **MUI X**: **Pro-gated.** Community can only have one filter total. Pro's multi-filter panel
  lets a user click **Add Filter** to add rows across (and, per docs, potentially within) columns,
  each joined by a `GridLogicOperator` (`And`/`Or`) the **end user changes via a dropdown** shown
  next to each condition after the first — this is the one library confirmed to expose a runtime
  AND/OR *toggle in the UI itself*, not just as a config default.
  [Multi-filters](https://mui.com/x/react-data-grid/filtering/multi-filters/)
- **PrimeNG**: `p-columnFilter` supports `operator` (`"and" | "or"`, default `and`) **per field**,
  with `showOperator` controlling whether the end user sees and can change it, and
  `showAddButton`/`maxConstraints` (default 2) controlling multi-constraint entry within that one
  field — architecturally close to AG Grid's Filter Conditions, one column at a time. Cross-column
  combination is always implicit AND (there is no cross-column operator concept in PrimeNG's
  filter model).
- **MRT**: inherits TanStack's absence of a cross-column operator; no runtime AND/OR UI documented.

**Where they disagree.** MUI X is the only library where the end user can change **cross-column**
AND/OR from the UI — everyone else treats cross-column combination as implicit-and-fixed AND, and
reserves any user-facing operator toggle for **multiple constraints on the same column** (AG
Grid's Filter Conditions, PrimeNG's per-field `operator`). This maps directly onto the internal
design's `anyOf` primitive: `anyOf` is a *developer-authored* OR-group, matching how every library
except MUI X treats OR — as something the developer wires, not something the end user toggles at
runttime.

## 7. Filtering interaction with other features

- **Grouping**: AG Grid filters leaf rows only by default, so an all-filtered-out group
  disappears; `groupAggFiltering` (Enterprise) opts into filtering on aggregated values instead,
  which can pull a whole group's descendants back in even if only the aggregate passed. MUI X
  confirms the same disappearing-empty-group behavior for row-grouped `DataGridPremium`. TanStack
  structurally cannot produce an empty group (its row-model order runs filter before group).
  PrimeNG's grouping is a sort of already-filtered rows, so the question doesn't arise. (Detail
  carried over from the sibling grouping research, re-verified here for the filtering side.)
- **Pagination**: not separately documented by any of the four for "does the page count reflect
  the filtered set" — but it is implied everywhere filtering runs before pagination in the
  pipeline (AG Grid, MUI X, TanStack, PrimeNG all filter-then-paginate architecturally), so page
  totals do reflect filtered rows by construction. No library flags an exception. **Not
  independently confirmed by an explicit doc statement for any library — treat as inferred, not
  verified.**
- **Selection**: **MUI X is the only library with an explicit, quotable behavior**: "Selected rows
  that do not pass the filtering criteria are automatically deselected when the filter is
  applied" — i.e. filtering silently shrinks a selection set. AG Grid/TanStack/PrimeNG do not
  document what happens to an existing selection when a filter newly excludes a selected row;
  **unverified** for all three.
  [Row grouping (MUI X)](https://mui.com/x/react-data-grid/row-grouping/)
- **Server-side / manual mode**: all four support it. AG Grid: Server-Side Row Model handles
  filtering server-side as part of its data source contract. TanStack: `manualFiltering: true`
  disables `getFilteredRowModel()` entirely, handing the developer full control. MUI X:
  `filterMode="server"` + `onFilterModelChange`. PrimeNG: `lazy` + `onLazyLoad` receives filter
  state alongside sort/pagination for the developer to apply server-side. None of the four
  document any tier gating specific to *filtering* in server mode (though AG Grid's Server-Side
  Row Model as a whole, and MUI X's, carry their own broader tier considerations not specific to
  filtering).
- **Empty-state messaging**: AG Grid has a distinct **no-matching-rows overlay** separate from the
  no-data overlay (`overlayNoRowsTemplate` / `noRowsOverlayComponent`), with a documented gotcha —
  it does not fire correctly if the developer filters manually without updating the `rows` prop
  ([ag-grid#3716](https://github.com/ag-grid/ag-grid/issues/3716)). MUI X has an equivalent
  `noResultsOverlay` slot, distinct from its no-rows overlay, with the same "you must pass the
  actually-filtered rows" caveat surfacing repeatedly in its issue tracker. PrimeNG only documents
  a generic `emptymessage` template (used for "no data at all"); no PrimeNG-specific "no matches"
  variant is documented separately. TanStack/MRT: not documented — **unverified**.

**Where they disagree.** The filtered-selection interaction is the sharpest finding: MUI X
silently auto-deselects rows a filter hides, and it's the *only* library saying anything about
this at all — the internal design has to make an explicit call here (auto-deselect, keep
selection but hide it, or block/warn) with zero-to-one library's worth of prior art to lean on.
The empty-state overlay is near-universal (AG Grid, MUI X both ship one, distinct from the
no-data case) and both independently warn about the same developer mistake (stale unfiltered rows
prop hiding the overlay) — a signal this is an easy trap, not an edge case.

## 8. Persistence / URL state

- **AG Grid**: **Grid State** (`api.getState()` / `api.setState()` / `initialState`) captures the
  column filter model (and Advanced Filter model) as one serializable snapshot alongside sort,
  columns, etc. Appears to be a Community-tier API based on doc-site navigation structure, though
  this was not independently confirmed against a Community-only code sample — **treat tier as
  likely-free but not fully verified**. Critically, **AG Grid stores nothing itself**: the
  developer must persist the retrieved state object (localStorage, URL, backend) and re-supply it
  as `initialState` on reload. No automatic save/restore exists.
  [Grid state](https://www.ag-grid.com/javascript-data-grid/grid-state/)
- **TanStack v8**: `columnFilters`/`globalFilter` are ordinary controlled state the consumer
  already owns — persistence is 100% consumer-implemented, no different from any other piece of
  React/Angular state.
- **MUI X**: `apiRef.current.exportState()` / `restoreState()` are the equivalent of AG Grid's
  pair — export a serializable snapshot, restore it later. The docs' own worked example
  explicitly writes it to `localStorage` on `beforeunload` — i.e. the library ships the
  export/import mechanism but not the storage or the URL sync; that wiring is the documented
  example, not a built-in.
  [State](https://mui.com/x/react-data-grid/state/)
- **PrimeNG**: the only library with a **named, built-in storage target**. `stateStorage: 'session'
  | 'local'` tells `p-table` to serialize its state to `sessionStorage`/`localStorage` **itself**,
  automatically, without the developer wiring an event handler or a storage call. Exactly which
  filter fields (constraints, match modes, operator, value) are included in that serialized state
  was not confirmed from the docs page fetched — **partially unverified**, but the mechanism
  itself (automatic storage, not just an export API) is real and distinct from every other library
  here.
- **MRT**: not documented in the fetched pages; presumably inherits TanStack's fully-consumer-owned
  model since it sits on the same state primitives. **Unverified** whether MRT adds any
  convenience layer on top.

**Where they disagree.** This is a three-way split rather than two: TanStack/MRT ship *nothing*
(the consumer's own state, no export helper at all); AG Grid/MUI X ship an **export/import API**
but explicitly no storage (the developer still writes the `localStorage`/URL glue, shown as a
"here's how" example rather than a config flag); PrimeNG alone ships **actual automatic
persistence** — set one string option and the browser storage write/read happens without any
handler code. The internal design's "fully consumer-owned" stance matches the *majority* position
(3 of 5 have zero built-in storage-writing) but diverges from PrimeNG's proof that a table library
can own storage without controversy — worth naming explicitly as the road not taken.

## 9. Tier splits

| Capability | AG Grid | MUI X | PrimeNG | TanStack / MRT |
|---|---|---|---|---|
| Text/Number/Date filter + runtime operator picker | Free | Free | Free | n/a (no UI) |
| Filter-icon or inline-row entry point | Free | Free | Free | n/a |
| Floating filter row (always-visible input) | **Free** | **Pro** (Header Filters) | Free (`display="row"`) | n/a |
| Quick/global filter box | Free (bring-your-own input); pre-built toolbar item Enterprise | Free, with built-in debounce | Free | Free (MRT); no UI at all (TanStack) |
| Set/multi-select filter with auto-computed distinct values | **Enterprise** (Set Filter) | n/a (`singleSelect` needs dev-supplied options at any tier) | n/a (MultiSelect needs dev-supplied options) | **Free** (MRT `select`/`multi-select` via faceting) |
| Multiple constraints per column, user-toggled AND/OR | Free (Filter Conditions) | **Pro** (multi-filter) | Free (`operator`/`showOperator`) | n/a |
| Cross-column AND/OR toggle exposed to the end user | Not exposed (implicit AND) | **Pro** | Not exposed (implicit AND) | Not exposed |
| Combining two *different* filter types on one column | **Enterprise** (Multi Filter) | n/a | n/a | n/a |
| Filter state export/import API | Likely free (unverified) | Free | Free (with automatic storage) | Consumer-owned |
| Grid-native automatic persistence (no handler code) | No | No | **Yes** | No |

**Where they disagree.** The clearest paywall signal in this whole inventory: AG Grid puts
**auto-computed distinct values** (Set Filter) behind Enterprise, while MRT gives the visually
identical capability away free by exposing TanStack's faceting primitive as a rendered widget —
proof the capability itself isn't inherently expensive to build, only that AG Grid chose to meter
it. MUI X's paywall line sits somewhere else entirely: it gates **multiplicity** (more than one
filter active at all, and the cross-column AND/OR that multiplicity requires), while giving away
the single-filter operator picker and the debounced quick filter for free. Two different products
found two different features worth charging for — that divergence is itself evidence there's no
single "obviously monetizable" piece of filtering UX.

---

## What this suggests for `withFiltering()` user stories

Not decisions — just where the inventory points.

- **The operator-picker gap is real and worth naming explicitly.** Every UI-bearing competitor
  gives the end user a runtime operator dropdown for free; the internal design's fixed-kind
  approach is a deliberate minority position, not something to describe as "how filtering
  normally works."
- **Filtered-selection interaction has almost no prior art** (only MUI X documents anything), so
  it needs its own explicit design decision rather than "matching convention" — there isn't one.
- **Debounce and empty-state messaging are cheap, near-universal wins** competitors either ship
  (MUI X debounce) or warn about getting wrong (AG Grid's and MUI X's identical "stale rows prop"
  empty-state gotcha) — worth flagging to whoever builds the consumer-facing debounce/empty-state
  guidance even though the primitive itself won't own them.
- **Data-derived filter options is a genuine fork in the road**, not a nice-to-have: AG Grid
  monetizes it, MRT gives it away, MUI X/PrimeNG never built it. The internal design's choice to
  exclude it sides with MUI X/PrimeNG, which is defensible company but should be a stated choice.
- **PrimeNG's automatic persistence is the one capability with a single-library precedent** — if
  product ever reconsiders "fully consumer-owned" persistence, PrimeNG is the only existing
  argument that a table can own storage without it being controversial.

---

## Not researched

- **Screen-reader / keyboard behavior of any filter UI** — not investigated for this document
  (the sibling grouping research's a11y section does not cover filtering either).
- **AG Grid Advanced Filter** (type-ahead visual query builder) — named in the filtering overview
  but not investigated in the same depth as the four provided filter types.
- **MUI X exact `singleSelect`/boolean/date default value-input component appearance** — the
  customization page confirms the operator getters exist but the automated fetch could not
  extract the literal rendered widget list; treat "date → date picker, boolean → toggle" as
  a reasonable inference from MUI's design system, not a doc-confirmed fact.
- **MUI X toolbar Filters-button badge/count** — actively searched for, not confirmed either way.
- **PrimeNG exactly which filter fields `stateStorage` serializes** (values only, or match modes
  and operators too).
- **MRT persistence, active-filter chips, and pagination/selection interaction with filtering** —
  none of the fetched MRT pages covered these; MRT presumably inherits TanStack's total absence
  of built-ins here but this was not independently confirmed.
- **Server-side filtering tier gating specifically** (as opposed to server-side row models
  generally) for AG Grid and MUI X.
- **Exact AG Grid Grid State tier** (Community vs Enterprise) — inferred from doc-site structure,
  not from a Community-only working example.

## Sources

AG Grid v36.1.0 —
[Filtering overview](https://www.ag-grid.com/angular-data-grid/filtering-overview/) ·
[Text filter](https://www.ag-grid.com/angular-data-grid/filter-text/) ·
[Filter conditions](https://www.ag-grid.com/angular-data-grid/filter-conditions/) ·
[Set filter](https://www.ag-grid.com/angular-data-grid/filter-set/) ·
[Multi filter](https://www.ag-grid.com/angular-data-grid/filter-multi/) ·
[Quick filter](https://www.ag-grid.com/angular-data-grid/filter-quick/) ·
[Floating filters](https://www.ag-grid.com/angular-data-grid/floating-filters/) ·
[Column menu](https://www.ag-grid.com/angular-data-grid/column-menu/) ·
[Grid state](https://www.ag-grid.com/javascript-data-grid/grid-state/) ·
[ag-grid#3716 (no-rows overlay + filter)](https://github.com/ag-grid/ag-grid/issues/3716)

TanStack Table v8 —
[Column Filtering guide](https://tanstack.com/table/v8/docs/guide/column-filtering) ·
[Column Filtering API](https://tanstack.com/table/v8/docs/api/features/column-filtering) ·
[Global Filtering guide](https://tanstack.com/table/v8/docs/guide/global-filtering) ·
[Fuzzy Filtering guide](https://tanstack.com/table/v8/docs/guide/fuzzy-filtering) ·
[Column Faceting guide](https://tanstack.com/table/v8/docs/guide/column-faceting) ·
[Global Faceting guide](https://tanstack.com/table/v8/docs/guide/global-faceting)

MUI X v9.13.0 —
[Filtering](https://mui.com/x/react-data-grid/filtering/) ·
[Filter customization](https://mui.com/x/react-data-grid/filtering/customization/) ·
[Quick filter](https://mui.com/x/react-data-grid/filtering/quick-filter/) ·
[Multi-filters](https://mui.com/x/react-data-grid/filtering/multi-filters/) ·
[Header filters](https://mui.com/x/react-data-grid/filtering/header-filters/) ·
[Server-side filtering](https://mui.com/x/react-data-grid/filtering/server-side/) ·
[Row grouping](https://mui.com/x/react-data-grid/row-grouping/) ·
[State](https://mui.com/x/react-data-grid/state/) ·
[mui-x#4063 (delete icon)](https://github.com/mui/mui-x/issues/4063) ·
[mui-x#11067 (remove-all button)](https://github.com/mui/mui-x/issues/11067)

PrimeNG 22.1.1 — [Table docs](https://primeng.dev/table) ·
[ColumnFilter properties (GeeksforGeeks)](https://www.geeksforgeeks.org/angular-js/angular-primeng-table-columnfilter-properties/) ·
[Match modes reference (GeeksforGeeks)](https://www.geeksforgeeks.org/angular-js/angular-primeng-table-match-modes/) ·
[primeng#17817 (boolean filter display bug)](https://github.com/primefaces/primeng/issues/17817)

Material React Table 3.2.1 —
[Column Filtering guide](https://www.material-react-table.com/docs/guides/column-filtering) ·
[Global Filtering guide](https://www.material-react-table.com/docs/guides/global-filtering) ·
npm registry `material-react-table@latest` metadata (version pin)
