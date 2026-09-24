# How do data-table libraries model column order when the order must change at runtime?

**Date:** 2026-09-22 · **Depth:** standard

## Answer

**Adopt a dedicated order channel: an ordered `string[]` of column ids in its own store
slice, with `ColumnDef` losing `order` entirely.** Every surveyed library that supports
runtime reorder does exactly this — declared order is the array position of the
definition, runtime order is a separate ordered id list — and **not one** of them ships a
writable per-column `order` number. Kendo is the sharpest: it *has* an `orderIndex` on the
column and documents it as read-only, "Setting this field does not change the column
order." [S1][S2][S3][S4][S5][S12]

The deciding cost is **not** the 10-150 object copies `applyColumnOrder` makes. It is that
a reorder changes `baseColumns` → invalidates `core.columns` → invalidates `renderRows`,
which re-runs `buildDataCells` for **every row × every column** — an O(rows × columns)
accessor sweep per drag event, for a change `cells` is documented to ignore. [R1][R2][R3]
At 5,000 rows × 30 columns that is 150,000 accessor calls and 5,000 object allocations per
reorder, at drag-event frequency. That is the number that settles it, and it is
independent of column count.

The design brief's plan to drop the `order` option and let array position be the only
*declared* order is exactly the industry shape [S1][S3][S6] — but it is only half the
answer. Every vendor keeps **both**, and the stated reason is AG Grid's
`maintainColumnOrder`: a user's runtime order must survive a re-declaration of the column
definitions. [S7]

## Method

- Versions pinned from `registry.npmjs.org/<pkg>/latest`, read 2026-09-22:
  `@tanstack/table-core@9.2.4` (latest) — **source read at the explicit `@8.21.3` pin**,
  because v9 ships no `src/`; `ag-grid-community@36.2.0`; `@mui/x-data-grid-pro@9.14.0`
  (types read from `@mui/x-data-grid@9.14.0`); `react-data-grid@7.0.0-beta.61`;
  `handsontable@18.1.1`; `@glideapps/glide-data-grid@6.0.3`;
  `@progress/kendo-angular-grid@25.1.0`.
- AG Grid docs read as `.mdoc` at tag `b36.2.0`; MUI X docs at tag `v9.14.0`. Type
  surfaces read from published `dist`/`lib` `.d.ts` on unpkg. Angular CDK `table.ts` read
  from `angular/components@main` — **unpinned**, tag refs 404 (known, per the anchors file).
- Repo reads are `libs/table/src` at working tree, commit `c3359c0`.
- Reliability: "order" means three different things across vendors — a *declared* position
  (array index), a *runtime* channel (id list), and a *derived read-back* (Kendo
  `orderIndex`, react-data-grid `CalculatedColumn.idx`). The read-back ones are outputs,
  never inputs; do not read them as a per-column storage model.

## Evidence

- TanStack v8: `ColumnOrderState = string[]`, `ColumnOrderTableState = { columnOrder:
  ColumnOrderState }` — a table-level ordered id list, not a column property. [S1]
- TanStack's `_getOrderColumnsFn` **permutes references only**: it `splice`s matched
  `Column` objects out of a shallow copy and pushes them into a new array. No column object
  is recreated, so anything memoized per `Column` survives a reorder. [S1]
- TanStack keeps both, with an explicit fallback: `if (!columnOrder?.length) orderedColumns
  = columns` — empty state means "use declared array order". [S1]
- AG Grid: `ColumnOrderState { /** All colIds in order */ orderedColIds: string[] }`, a
  sibling of `columnSizing`/`columnVisibility` in `GridState`. [S2]
- AG Grid's `Column` runtime interface exposes **no** ordinal/index member — only
  `getLeft()`, `getSortIndex()`, `getColDef()`. Position is not stored on the column. [S8]
- AG Grid `applyColumnState` expresses order as **the sequence of the `state` array**, gated
  by `applyOrder: true`; `ColumnState` has no per-item `order` field. [S9]
- AG Grid states the reason for two channels: by default new `columnDefs` reimpose their
  own order; `maintainColumnOrder: true` makes a user's runtime order survive the update,
  and new columns "always be added at the end". [S7]
- MUI X splits it structurally: `GridColumnsState { orderedFields: string[]; lookup:
  GridColumnLookup; columnVisibilityModel; ... }` where `GridColumnLookup = { [field:
  string]: GridStateColDef }`. The id list is the order; the lookup holds the defs. [S3]
- MUI X ships the same split as declared state: `GridColumnsInitialState { orderedFields?:
  string[]; columnVisibilityModel?; dimensions? }`. [S3]
- MUI X's write verb is index-based over the id list, not a def write:
  `setColumnIndex: (field: string, targetIndexPosition: number) => void` on
  `GridColumnReorderApi`; `getColumnIndex` is the read-back. [S10]
- MUI X's docs state the declared half plainly: "Columns are organized according to the
  order in which they're provided in the `columns` array." No order property on
  `GridColDef`; only `disableReorder`. [S6]
- Angular CDK Table is the closest structural analogue: definitions live in
  `_columnDefsByName` (a name→`CdkColumnDef` map) and order comes from the row def's
  `columns` string array — `Array.from(rowDef.columns, columnId =>
  this._columnDefsByName.get(columnId))`. Reordering is a new `string[]`; the column defs
  are untouched directive instances. [S11]
- Kendo Angular Grid has `orderIndex` on the column **as a read-only field**: "Gets the
  column index after reordering. The `orderIndex` property is read-only. Setting this field
  does not change the column order." The write verb is `grid.reorderColumn(column, 0, {
  before: true })`. [S12][S4]
- Handsontable keeps order entirely out of the column definitions: `manualColumnMove`'s
  `moveColumns()` body calls `this.hot.columnIndexMapper.moveIndexes(columns, finalIndex)`
  and touches nothing on `columns` settings. [S5]
- react-data-grid has no order input at all: `idx` exists only as `readonly idx: number` on
  the derived `CalculatedColumn`, and reorder surfaces as
  `onColumnsReorder?: (sourceColumnKey, targetColumnKey) => void` — a notification, with no
  `columnOrder` state prop. [S13]
- Glide Data Grid: `BaseGridColumn` has no order or index member; `columns: readonly
  GridColumn[]` and array position is the order. [S14][S15]
- Syncfusion EJ2 exposes only index/field verbs — `reorderColumnByIndex(fromIndex,
  toIndex)`, `reorderColumnByTargetIndex`, `reorderColumns(fromFName, toFName)` — and
  documents no per-column order property. [S16]
- In this repo, `ColumnDef.order: number` is a required per-column field and
  `applyColumnOrder` returns "a new array of new objects" — `columns.map(c => ({ ...c,
  order }))`. [R4][R5]
- `createTableCore`'s `renderRows` computed reads `columns()` and calls
  `buildDataCells(row.data, resolvedColumns, ...)` per row; its own comment says "`cells`
  reads `columns()`, so any column change recomputes every render row (ADR-0022)". [R2]
- `buildDataCells` loops every column per row, invoking each `accessor` through
  `readAccessor`'s `try/catch`. [R3]
- `RenderRow.cells` is documented as order-independent: "Does not follow column visibility
  or order: the consumer's own visible-column loop still decides what renders
  (ADR-0022)." [R1]
- `core.columns` is `computed(() => foldColumnRules(baseColumns(), columnRules))` and
  `foldColumnRules` always returns a fresh array, so any `baseColumns` write changes
  `columns()` identity regardless of whether any value changed. [R6][R7]

## Comparison

| Axis | TanStack 8.21.3 | AG Grid 36.2.0 | MUI X 9.14.0 | CDK (main) | Handsontable 18.1.1 | react-data-grid 7.0.0-b61 | Glide 6.0.3 | Kendo 25.1.0 |
|---|---|---|---|---|---|---|---|---|
| Order on the column def? | no [S1] | no [S8][S9] | no [S6] | no [S11] | no [S5] | no (derived `idx` only) [S13] | no [S14] | read-only `orderIndex` [S12] |
| Separate ordered id list? | `columnOrder: string[]` [S1] | `orderedColIds: string[]` [S2] | `orderedFields: string[]` [S3] | row def `columns: string[]` [S11] | `IndexMapper` index map [S5] | none — uncontrolled [S13] | none — array position [S15] | internal; `reorderColumn()` verb [S4] |
| Declared order = array position? | yes [S1] | yes [S7] | yes [S6] | yes [S11] | yes [S5] | yes [S13] | yes [S15] | yes (template order) [S4] |
| Keeps BOTH channels? | yes [S1] | yes [S7] | yes [S3][S6] | yes [S11] | yes [S5] | no [S13] | no [S15] | yes [S12] |
| Reorder mutates def objects? | no — reference permute [S1] | no [S8] | no — `lookup` untouched [S3] | no — directive instances [S11] | no [S5] | n/a | n/a | not documented |

## Synthesis

**Where they agree (7 of 8, unanimously):** order is never a writable property of a column
definition. This is not convention drift — three of them arrived at it from different
architectures. TanStack is headless-functional and permutes references. MUI X is a
normalized-store design and splits `lookup` (defs) from `orderedFields` (order) as two
fields of one state object. Handsontable is a spreadsheet and keeps a physical↔visual index
map that never touches settings. CDK is directive-based and gets it for free because the
defs are component instances and the order is a plain `string[]` input. Four unrelated
designs, one storage model.

**Where the disagreement is, and what it implies:** the split is over whether a runtime
channel exists *at all*, not over its shape. react-data-grid and Glide have none —
`onColumnsReorder` / array position only — because both push the reorder decision back to
the consumer's own `useState`. That is a real alternative, and it is what the design brief's
"array position is the only source of order" would become if no channel is added. But both
of those are *uncontrolled* libraries with no state store; this repo already owns a store,
so the consumer-owns-it option means the consumer re-declares `createColumns(...)` on every
drag — which under the hard constraint (the id union and value map are captured statically)
is the one thing that must not happen at runtime. That closes the option here.

**Kendo is the strongest single data point** because it is the only vendor that tried the
per-column-number shape and then disabled it. Shipping `orderIndex` and documenting it as
"read-only… setting this field does not change the column order" is a vendor publicly
stating that a per-column order number is a *derived read*, never a write channel. [S12]

**Why the local cost argument is decisive and not merely aligned with them.** The 10-150
column-object copies are irrelevant — that is microseconds. The cost is one level down:
`baseColumns` write → `columns()` recompute (new array, always) → `renderRows` recompute →
`buildDataCells` per row over every column, each cell going through a `try/catch`. [R2][R3]
`cells` is keyed by column id and explicitly documented as ignoring order [R1], so the
entire sweep produces a byte-identical result. A separate order slice removes the edge
entirely: `columns()` does not depend on it, so `renderRows` never sees a reorder. That is
a structural fix, not a constant-factor one, and it is what makes the verdict
row-count-driven rather than column-count-driven.

**What the shape should be, concretely, against the constraint.** Order is a `string[]` of
ids in its own slice — which satisfies "not a re-declaration" exactly. Declared order stays
array position of the `createColumns` builder output (drop `ColumnDef.order`, as the brief
proposes). Keep both, for AG Grid's stated reason [S7]: a `setColumns()` write must not
silently discard a user's drag order, and ids present in the defs but absent from the order
list append at the end — the same rule TanStack [S1] and AG Grid [S7] both ship. This is
also the persistence shape `docs/1-state/state-persistence.md` needs: a `string[]` is
serializable as-is, whereas today's model requires reading `order` off 150 objects and
sorting.

## Against

- **The honest counter on magnitude:** no vendor publishes a benchmark for reorder cost,
  and none of them documents *why* they chose the id list — the convergence is inferred
  from eight type surfaces, not from a stated rationale in any of them. The only stated
  reason found anywhere is AG Grid's `maintainColumnOrder`, and that argues for keeping
  two channels, not for the id list being cheaper. [S7]
- **A cheaper local fix exists and should be named:** the `renderRows` invalidation could
  also be cut by giving `core.columns` a custom `equal` on the fold, or by having
  `renderRows` depend on a `computed` projecting only `(id, accessor)` pairs. That would
  fix the cost without touching the API. It is strictly smaller work — but it leaves
  `order` as a writable per-column field that eight libraries agree should not exist, and
  it does nothing for the persistence shape.
- **TanStack pays a real price for the id list:** `_getOrderColumnsFn` is an O(n²)
  `findIndex`-inside-`while` scan. [S1] At 150 columns that is ~11k comparisons per
  evaluation — memoized, so it runs once per state change, but it is not free, and it is a
  cost today's `applyColumnOrder` (one `Map` lookup per column) does not pay. Use a
  `Map<id, index>` for the projection, not TanStack's loop.

## Not researched

- Whether Angular's `computed()` equality could be exploited to make the current model
  cheap without an API change — named above as an alternative, not measured.
- Virtualization windows and measured column widths: the brief asks whether reorder
  invalidates them. No surveyed library documents this, and this repo virtualizes nothing
  today, so there is no claim either way.
- Column *grouping* / header groups interacting with order (TanStack's `groupedColumnMode`,
  AG Grid's `columnGroup` state). Out of scope for a flat order list.
- Glide's `onColumnMoved` — it is absent from `data-editor.d.ts` and
  `internal/data-grid/data-grid-types.d.ts` at `6.0.3`; whether it exists on another entry
  point was not settled. Glide's claims here rest on the column type having no order member.

## Unverified

- Kendo's internal storage of runtime order. Only the public read-only `orderIndex` field
  and the `reorderColumn()` verb are documented; whether the grid holds an id list or
  re-sorts a column collection is not stated anywhere reachable. [S12][S4]
- Syncfusion's internal representation — the reorder page documents only verbs. The claim
  "no per-column order property" is from the absence of one on that page, which is weaker
  than a type read. [S16]
- The 150,000-accessor figure is arithmetic over the verified code path (rows × columns),
  not a measured benchmark. **What would settle it:** a `vitest` bench in
  `engine/core.spec.ts` timing `table.columns.update(reorderColumns(ids))` followed by a
  `renderRows()` read, at 1k/5k/20k rows × 30/150 columns, against the same reorder routed
  through a separate order signal. That is the one measurement that converts this verdict
  from "eight vendors agree plus a traced invalidation edge" to a number. Per the repo's
  no-unprompted-runs rule, it is not run here.
- Whether `foldColumnRules`' per-element identity preservation (columns with no rules pass
  through by identity [R7]) buys anything downstream. Nothing in `renderRows` reads element
  identity — it re-derives cells from the array — so today it buys nothing, but that is an
  inference from the current call sites, not a documented guarantee.

## Sources

| | Source | Version | Verified |
|---|---|---|---|
| S1 | https://unpkg.com/@tanstack/table-core@8.21.3/src/features/ColumnOrdering.ts | 8.21.3 | yes — source read; `_getOrderColumnsFn` body quoted, confirms reference permute, not object recreation |
| S2 | https://unpkg.com/ag-grid-community@36.2.0/dist/types/src/interfaces/gridState.d.ts | 36.2.0 | yes — type read; `ColumnOrderState.orderedColIds` with its `/** All colIds in order */` comment |
| S3 | https://unpkg.com/@mui/x-data-grid@9.14.0/hooks/features/columns/gridColumnsInterfaces.d.ts | 9.14.0 | yes — type read; `GridColumnsState` and `GridColumnsInitialState` both carry `orderedFields` |
| S4 | https://www.telerik.com/kendo-angular-ui/components/grid/columns/reordering | 25.1.0 | yes — docs read; `reorderColumn(column, 0, { before: true })` |
| S5 | https://unpkg.com/handsontable@18.1.1/plugins/manualColumnMove/manualColumnMove.js | 18.1.1 | yes — source read; corrected the docs-derived framing — `moveColumns()` delegates to `columnIndexMapper.moveIndexes()` and never touches the `columns` setting |
| S6 | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/docs/data/data-grid/column-ordering/column-ordering.md | 9.14.0 | yes — docs read at tag; states array-position ordering, and notably does **not** document `orderedFields` — the type surface does |
| S7 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/column-updating-definitions/index.mdoc | b36.2.0 | yes — docs read at tag; the only stated rationale found for keeping two channels (`maintainColumnOrder`) |
| S8 | https://unpkg.com/ag-grid-community@36.2.0/dist/types/src/interfaces/iColumn.d.ts | 36.2.0 | yes — type read; negative result, no ordinal member on `Column` |
| S9 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/column-state/index.mdoc | b36.2.0 | yes — docs read at tag; `applyColumnState({ state, applyOrder: true })`, order carried by array sequence |
| S10 | https://unpkg.com/@mui/x-data-grid@9.14.0/models/api/gridColumnApi.d.ts | 9.14.0 | yes — type read; corrected a likely assumption — `setColumnIndex` is on `GridColumnReorderApi`, not `GridColumnApi` |
| S11 | https://raw.githubusercontent.com/angular/components/main/src/cdk/table/table.ts | unpinned (`main`) | yes — source read; `_getCellTemplates` maps `rowDef.columns` through `_columnDefsByName`. Tag refs 404, so this read is unpinned — flagged in Method |
| S12 | https://www.telerik.com/kendo-angular-ui/components/grid/api/ColumnComponent | 25.1.0 | yes — API docs read; `orderIndex` documented read-only, "Setting this field does not change the column order" |
| S13 | https://unpkg.com/react-data-grid@7.0.0-beta.61/lib/index.d.ts | 7.0.0-beta.61 | yes — type read; `CalculatedColumn.idx` is `readonly`, `onColumnsReorder` is a callback with no paired state prop |
| S14 | https://unpkg.com/@glideapps/glide-data-grid@6.0.3/dist/dts/internal/data-grid/data-grid-types.d.ts | 6.0.3 | yes — type read; `BaseGridColumn` has no order/index member |
| S15 | https://unpkg.com/@glideapps/glide-data-grid@6.0.3/dist/dts/data-editor/data-editor.d.ts | 6.0.3 | yes — type read; `readonly columns: readonly GridColumn[]`; `onColumnMoved` absent from this file |
| S16 | https://ej2.syncfusion.com/angular/documentation/grid/columns/column-reorder | latest (docs site carries no version marker) | yes — docs read; verbs only, no per-column order property documented |
| S17 | https://registry.npmjs.org/@tanstack/table-core/latest | 9.2.4 | yes — registry read; the pin mismatch against the brief's "v8" |
| S18 | https://registry.npmjs.org/ag-grid-community/latest | 36.2.0 | yes — registry read |
| S19 | https://registry.npmjs.org/@mui/x-data-grid-pro/latest | 9.14.0 | yes — registry read |
| S20 | https://registry.npmjs.org/react-data-grid/latest | 7.0.0-beta.61 | yes — registry read |
| S21 | https://registry.npmjs.org/handsontable/latest | 18.1.1 | yes — registry read |
| S22 | https://registry.npmjs.org/@glideapps/glide-data-grid/latest | 6.0.3 | yes — registry read |
| S23 | https://registry.npmjs.org/@progress/kendo-angular-grid/latest | 25.1.0 | yes — registry read |
| R1 | libs/table/src/api/types.ts:76-80 | — | yes — read; `cells` "Does not follow column visibility or order" |
| R2 | libs/table/src/engine/core.ts:88-106 | — | yes — read; `renderRows` reads `columns()` and rebuilds `cells` per row |
| R3 | libs/table/src/engine/cells.ts:39-49 | — | yes — read; `buildDataCells` loops every column per row |
| R4 | libs/table/src/api/types.ts:83-98 | — | yes — read; `ColumnDef.order: number` required |
| R5 | libs/table/src/engine/columns.ts:65-74 | — | yes — read; `applyColumnOrder` returns new array of new objects |
| R6 | libs/table/src/engine/core.ts:41-43 | — | yes — read; `columns = computed(() => foldColumnRules(baseColumns(), columnRules))` |
| R7 | libs/table/src/engine/columns.ts:143-178 | — | yes — read; `foldColumnRules` always returns a fresh array; per-element identity preserved only when no rule matches |
| R8 | libs/table/src/mutations/update-columns.ts:20-25 | — | yes — read; `reorderColumns(ids)` is the shipped consumer verb |
| R9 | libs/table/docs/1-state/work/core/active/single-value-source/design-create-columns.md | — | yes — read; the `createColumns` builder design under review |
