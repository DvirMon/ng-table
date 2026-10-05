# Are column IDs that are NOT a field of the row data model allowed in established table libraries — and how does a schema/config address such a column for per-column concerns?

**Date:** 2026-09-19 · **Depth:** standard

## Answer

The user's intuition is **refuted**. Every library surveyed lets a column id be free-form; none
requires it to be a `keyof TRow`. [S2][S11][S17][S24][S28] The dominant pattern is exactly
"identity is free-form, data access is a separate accessor/valueGetter" — AG Grid splits it
explicitly (`colId` free, `field` typed to `NestedFieldPaths<TData>`) [S11], TanStack splits it
into `id` + `accessorKey`/`accessorFn` [S2], MUI collapses both into `field: string` but documents
`field: 'fullName'` on a row with no `fullName` [S21]. Per-column derivation (group/sort/filter/agg)
is keyed by **column id** in 4 of 6 and by an **accessor attached to the column object** in the
rest — never by a narrowed `keyof TRow` space. [S4][S6][S7][S12][S13][S20] **No surveyed library
has a derivation key space narrower than its column key space**, which is the shape `ng-table` now
has [R1][R2]; the closest analogue is TanStack, which reaches the same _safety_ goal with a runtime
capability gate (`getCanSort`/`getCanFilter`/`getCanGroup` require an `accessorFn`) rather than a
type-level key restriction [S4][S6][S7].

## Method

- Versions pinned from `registry.npmjs.org/<pkg>/latest` on 2026-09-19:
  `@tanstack/table-core@9.2.4` [S1], `ag-grid-community@36.2.0` [S10],
  `@mui/x-data-grid-premium@9.14.0` [S16], `@angular/cdk@22.1.7` [S23], `primeng@22.1.1` [S27],
  `handsontable@18.1.1` [S32].
- **The brief says "TanStack Table v8"; registry latest is `table-core@9.2.4`.** All TanStack API
  claims below are read from published `@tanstack/table-core@8.21.3` source [S2]-[S9], the version
  the brief targets. v9's `src/` layout differs and `src/types.ts` 404s on unpkg [S33] — v9 was
  **not** verified; see Not researched.
- Source reads are unpkg-published package files (`src/*.ts` where the package ships sources,
  `dist/types/*.d.ts` otherwise). Docs pages used only where behavior is not expressible in types.
- **What verification changed:** three doc-derived claims moved.
  (1) AG Grid's own `value-getters` and `grouping-data` doc pages never state whether a
  `valueGetter`-only column can be grouped [S15][S31] — the answer came only from reading
  `valueService.ts`, where `getValue()` returns the `valueGetter` result _before_ it ever looks at
  `field` [S14]. (2) The `@angular/cdk@22.1.7` fesm2022 bundle has **doc comments stripped**,
  contradicting the anchors file's note that Angular fesm bundles are "unminified with doc comments
  intact" [S24] — the comments had to be read from `angular/components@main` [S25][S26], which is
  unpinned. (3) MUI's `groupingValueGetter` looks like a general escape hatch, but the docs state
  its `value` argument is `row[field]`, **not** the `valueGetter` output [S22] — so on a column
  whose `field` is absent from the row, `value` is `undefined` and the hatch only works through its
  `row` parameter [S19].

## Evidence

### Angular CDK / Material table — the name is an identifier only

- `CdkColumnDef.name` is documented "Unique name for this column."; its setter only stores it and
  derives a CSS class (`value.replace(/[^a-z0-9_-]/gi, '-')`). [S26][S24]
- `CdkTable` resolves a rendered column through `_columnDefsByName.get(columnId)`; the row object
  is never indexed by the column name anywhere in the core table. [S24]
- The only `data[name]` lookup in the whole package is inside the convenience component
  `CdkTextColumn`, and it is an overridable input, not a contract:
  `this.dataAccessor = this._options.defaultDataAccessor || ((data, name) => data[name]);` [S24],
  documented "If this property is not set, the data cells will render the value found in the data's
  property matching the column's name." [S25]
- Consequence: `select` / `actions` columns are ordinary `cdkColumnDef` names listed in
  `cdkHeaderRowDef`'s `columns` array. There is **no** per-column derivation surface at all — CDK
  ships no sorting/filtering/grouping model, so the "narrower key space" question does not arise.
  [S24]

### TanStack Table v8 — id free-form, capability gated on `accessorFn` at runtime

- `ColumnDef = DisplayColumnDef | GroupColumnDef | AccessorColumnDef`; `DisplayColumnDef` and
  `AccessorFnColumnDef` both intersect `ColumnIdentifiers = IdIdentifier | StringHeaderIdentifier`,
  where `IdIdentifier` has `id: string` (required) — so a display or `accessorFn` column **must**
  carry an explicit free-form `id` (or a string `header`). [S2]
- `AccessorKeyColumnDefBase` is `{ id?: string; accessorKey: (string & {}) | keyof TData }` — the
  **accessor** key space is `keyof TData` _widened_ by `(string & {})`, the same widening trick
  `ng-table`'s `ColumnId<TRow>` uses. [S2][R1]
- Id derivation and its hard failure: `id = resolvedColumnDef.id ?? accessorKey?.replaceAll('.','_')
?? (typeof header === 'string' ? header : undefined)`, then
  `if (!id) throw new Error('Columns require an id when using an accessorFn')`. [S3]
- `GroupingState = string[]`, `ColumnSort { id: string; desc: boolean }`,
  `ColumnFilter { id: string; value: unknown }` — every derivation concern is keyed by the **column
  id**, a plain `string`, never by `keyof TData`. [S4][S6][S7]
- `getGroupedRowModel` reads `const columnId: string = existingGrouping[depth]!` then
  `const resKey = \`${row.getGroupingValue(columnId)}\`` — grouping resolves through the column
  registry, not the row object. [S5]
- `row.getValue(columnId)` returns `undefined` when `!column?.accessorFn` — a display column reads
  as `undefined` rather than throwing. [S8]
- Capability is gated at **runtime**, not in the type: `getCanSort` and `getCanFilter` both end in
  `&& !!column.accessorFn`; `getCanGroup` ends in
  `(!!column.accessorFn || !!column.columnDef.getGroupingValue)`. [S6][S7][S4]
- `columnHelper.accessor(accessor, column)` types the key argument as
  `AccessorFn<TData> | DeepKeys<TData>`, and when the argument is a function the second parameter is
  `DisplayColumnDef` — i.e. `id` becomes required. [S9]

### AG Grid — the cleanest explicit split

- `colId?: string` — "The unique ID to give the column. This is optional. If missing, the ID will
  default to the field. If both field and colId are missing, a unique ID will be generated." [S11]
- `field?: ColDefField<TData, TValue>` where
  `ColDefField<TData, TValue> = TData extends any ? NestedFieldPaths<TData, TValue, []> : never` —
  the **accessor** is type-narrowed to the data model, the **id** is not. [S11]
- Grid state keys every per-column concern by `colId`: `RowGroupState { groupColIds: string[] }`,
  `AggregationColumnState { colId: string; aggFunc: string }`,
  `SortModelItem { colId: string; sort; type? }`, `ColumnPinningState { leftColIds; rightColIds }`.
  [S12][S13]
- Value resolution puts the getter first:
  `if (valueGetter) { return … executeValueGetter(valueGetter, data, column, rowNode); } const field
= column.field; if (!field || !data …) { return undefined; }` — a `valueGetter`-only column
  resolves a value with no `field` at all. [S14]
- Grouping keys off that same value plus an optional transform:
  `let result = this.getValueFromData(col, rowNode); … const keyCreator = colDef.keyCreator; if
(keyCreator) { … result = keyCreator(keyParams); }`. [S14]
- `keyCreator` is documented "Function to return a string key for a value. This string is used for
  grouping, Set filtering, and searching within cell editor dropdowns." [S11]
- `filterValueGetter?: string | ValueGetterFunc<TData>` — "Gets the value for filtering purposes",
  a second, filter-only accessor override. [S11]
- Grouping/aggregation are declared **on the column object** (`rowGroup?: boolean | null`,
  `rowGroupIndex?: number | null`, `aggFunc?: string | IAggFunc | null`, `comparator?`), so no
  separate key space exists at declaration time either. [S11]

### MUI X DataGrid — one `field` for both roles, explicitly allowed to be synthetic

- `field: string` is required and documented "The unique identifier of the column. Used to map with
  [[GridRowModel]] values." [S17]
- The docs state "`field` is the only required property since it's the column identifier. It's also
  used to match with `GridRowModel` values." and then show the synthetic case verbatim:
  `{ field: 'fullName', valueGetter: (value, row) => \`${row.firstName || ''} ${row.lastName ||
  ''}\` }`— a`field` that "may not exist on the row object". [S21]
- `valueGetter?: GridValueGetter<R, V, F>` — "Function that returns specific data to render in the
  cell instead of using the field value." [S17]
- `GridRowGroupingModel = string[]`, and the API is field-worded:
  `addRowGroupingCriteria: (groupingCriteriaField: string, groupingIndex?: number) => void`. [S20]
- Premium augments the col def with
  `groupingValueGetter?: GridGroupingValueGetter<R>` — "Function that transforms a complex cell
  value into a key that be used for grouping the rows", plus `aggregable?: boolean`,
  `groupingValueSetter?`, `pivotable?`. [S18]
- Its signature carries the row, which is what makes the synthetic-field case workable:
  ```ts
  export type GridGroupingValueGetter<
    R extends GridValidRowModel = GridValidRowModel,
    TValue = never,
  > = (
    value: TValue,
    row: R,
    column: GridColDef<R>,
    apiRef: RefObject<GridApiPremium>,
  ) => GridKeyValue | null | undefined;
  ```
  [S19]
- **The caveat that limits it:** "If your column also has a `valueGetter` property, the value passed
  to the `groupingValueGetter` method will still be the row value from the `row[field]`." [S22]
- Internally grouping rules are `GridGroupingRule { field: string; groupingValueGetter?;
groupingValueSetter? }` — the rule is keyed by field-as-identity and carries its own derivation.
  [S20]

### PrimeNG Table — key doubles as accessor, no per-column escape hatch

- Sorting resolves the key straight against the row: `let field = this.sortField ||
this.groupRowsBy();` then `let value1 = ObjectUtils.resolveFieldData(data1, field);`. [S28]
- Row grouping likewise: `let currentRowFieldData = ObjectUtils.resolveFieldData(rowData,
this.dataTable?.groupRowsBy() || '');` in `shouldRenderRowGroupHeader()` /
  `shouldRenderRowGroupFooter()` / `calculateRowGroupSize()`. [S28]
- `groupRowsBy` is documented "Field name to use in row grouping". [S28]
- `resolveFieldData` supports dot-notation paths, so the key space is _data paths_, not declared
  column ids — but it is an untyped `string`, so nothing is narrowed at compile time. [S28]
- The only escape hatch is table-level, not per-column: `customSort` flips `sortSingle()` to
  `this.sortFunction.emit({ data, mode, field, order })` and hands the whole sort to the consumer.
  [S28]
- A column may sort by a different path than it displays (`sortField` distinct from the displayed
  `field`), which is the one per-column id/accessor split PrimeNG offers. [S28]

### Handsontable — identity is the column index, `data` is the accessor

- A column has no id at all; `columns[].data` is the accessor: "If `data` is set to an array of
  objects, `prop` is a property name for the column's data object", with examples `{ data: 'id' }`,
  `{ data: 'name.first' }`, `{ data: 'user.address' }`. [S30]
- The accessor may be a **function**: "If your `dataSchema` is a constructor of an object that
  doesn't directly expose its members, you can specify functions for the `data` member of each
  `columns` item", shape `function property(attr) { return (row, value) => row.attr(attr, value); }`
  — a read/write accessor pair. [S29]
- So Handsontable is the extreme of the split: identity is positional, the data binding is a
  first-class function slot, and there is no key space to narrow.

### What `ng-table` currently has, for comparison

- Column key space is wide: `export type ColumnId<TRow> = Extract<keyof TRow, string> | (string &
{})`. [R1]
- Grouping schema key space is narrow: `GroupingPath<TRow> = { readonly [K in Extract<keyof TRow,
string>]: GroupingHandle<TRow, K> }`. [R2]
- `applyGrouping` / `applyGroupKey` / `applyGroupingAsync` are all
  `K extends Extract<keyof TRow, string>`. [R4]
- **An asymmetry already exists inside grouping itself:** `GroupingLevel.key` — the `initial` array
  — is typed `ColumnId<TRow>`, i.e. the wide space, while the schema path is the narrow one. So a
  non-field level is nameable in `initial` but not addressable from the schema. [R3][R2]
- A second, smaller inconsistency: `applyGroupOrder` is declared `K extends string` (unnarrowed),
  unlike its three siblings — unreachable in practice because the handle can only come from the
  narrow proxy. [R5][R2]

## Comparison

| Library                         | Column id source                                                                        | Is the id tied to a data field?                                                                 | Derivation (group/sort/filter/agg) keyed by                                                               | Non-field escape hatch                                                                                                                                 |
| ------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Angular CDK / Material `22.1.7` | `cdkColumnDef` / `matColumnDef` name, free-form `string` [S26]                          | No — name is used only for lookup + CSS class [S24]                                             | n/a — no derivation model ships [S24]                                                                     | n/a; `CdkTextColumn.dataAccessor: (data, name) => string` is the only binding and is overridable [S25]                                                 |
| TanStack Table `8.21.3`         | explicit `id`, else `accessorKey` (dots→`_`), else string `header`; throws if none [S3] | No — `id: string`; `accessorKey` is the separate typed slot `(string & {}) \| keyof TData` [S2] | **Column id** — `GroupingState = string[]`, `ColumnSort.id`, `ColumnFilter.id` [S4][S6][S7]               | `accessorFn` + explicit `id` [S2]; `getGroupingValue?: (row: TData) => any` makes a display column groupable via `getCanGroup` [S4]                    |
| AG Grid `36.2.0`                | `colId?: string`, defaults to `field`, else generated [S11]                             | No — `colId` is free `string`; `field` is `NestedFieldPaths<TData>` [S11]                       | **colId** — `RowGroupState.groupColIds`, `AggregationColumnState.colId`, `SortModelItem.colId` [S12][S13] | `valueGetter` (checked before `field`) [S14]; `keyCreator` for the group key [S11][S14]; `filterValueGetter` for filters [S11]                         |
| MUI X DataGrid `9.14.0`         | `field: string`, required [S17]                                                         | No — docs show `field: 'fullName'` with no such row property [S21]                              | **field-as-identity** — `GridRowGroupingModel = string[]`, `GridGroupingRule.field` [S20]                 | `valueGetter` [S17]; Premium `groupingValueGetter(value, row, column, apiRef)` [S19] — but `value` is `row[field]`, not the `valueGetter` output [S22] |
| PrimeNG Table `22.1.1`          | column `field`, free `string`, resolved as a data path [S28]                            | **Yes, effectively** — `resolveFieldData(row, field)` is the only lookup [S28]                  | **data path** — `groupRowsBy` and `sortField` both go straight to `resolveFieldData` [S28]                | Per-column: `sortField` ≠ display `field` [S28]. Otherwise only table-level `customSort` + `sortFunction` [S28]                                        |
| Handsontable `18.1.1`           | none — positional column index [S30]                                                    | n/a                                                                                             | n/a (sorting is by column index)                                                                          | `columns[].data` accepts a `(row, value)` accessor function [S29]                                                                                      |
| **`ng-table` (today)**          | `ColumnId<TRow> = Extract<keyof TRow,string> \| (string & {})` [R1]                     | No, at the column level [R1]                                                                    | **`Extract<keyof TRow, string>`** via `GroupingPath` [R2][R4] — narrower than the column space            | none for grouping; `initial` accepts the wide `ColumnId<TRow>` [R3]                                                                                    |

## Synthesis

**A — is "column id must be a data-model field" a real convention?** No. It is a minority position,
and where it appears it is an _implementation consequence_, not a stated rule. PrimeNG is the only
surveyed library where the key genuinely doubles as the accessor with no per-column override for
grouping [S28], and even there the key is an untyped dot-path `string`, not a `keyof`. The two
libraries that type the data path at all — AG Grid's `ColDefField = NestedFieldPaths<TData>` [S11]
and TanStack's `accessorKey: (string & {}) | keyof TData` [S2] — apply that typing to the
**accessor**, never to the id, and TanStack widens even that with `(string & {})`. The disagreement
between AG Grid and MUI is where the decision lives: AG Grid keeps two slots (`colId` free, `field`
typed) and pays with a "which one do I pass?" question on every API call; MUI keeps one slot and
pays by having `field` mean "identifier" in the type and "row property" in the default accessor —
the docs have to spend a paragraph un-teaching that [S21]. Neither chose "the id must be a field".

**B — what are derivation concerns keyed by?** Column id, dominantly: 3 of the 4 libraries that
have a derivation model key state by the column identifier (`GroupingState`/`ColumnSort.id`/
`ColumnFilter.id` [S4][S6][S7]; `groupColIds`/`colId` [S12][S13]; `GridRowGroupingModel`/
`GridGroupingRule.field` [S20]). The fourth, AG Grid at _declaration_ time, doesn't key at all —
`rowGroup: true`, `aggFunc`, `comparator` sit on the column object, so the key question only appears
in state [S11]. An accessor function is never the key; it is always the _value_ the key resolves to.
And in **none** of the six is the derivation key space narrower than the column key space. TanStack
is the interesting near-miss: it restricts sort/filter/group to columns with a real accessor, but
does it with three runtime predicates (`getCanSort`, `getCanFilter`, `getCanGroup`) [S6][S7][S4]
rather than a type. That choice is what lets `getCanGroup` carve out the exception
`|| !!column.columnDef.getGroupingValue` [S4] — a type-level narrowing to `keyof TRow` cannot
express "unless the column brought its own derivation", which is precisely the expressiveness
`ng-table` gave up [R2].

**C — escape hatches, one snippet each.** Every library that supports derivation ships one; the
variable is whether the hatch is _general_ (one accessor feeding everything) or _per-concern_.

TanStack — display/`accessorFn` column made groupable, `id` mandatory [S2][S3][S4][S9]:

```ts
// accessorFn column: id is required, key space is free
columnHelper.accessor((row) => `${row.firstName} ${row.lastName}`, {
  id: 'fullName', // throws without this  [S3]
});

// display column with no accessor at all, still groupable       [S4]
columnHelper.display({
  id: 'priceBand',
  getGroupingValue: (row) => (row.total > 100 ? 'high' : 'low'),
});
```

AG Grid — no `field`, grouped and aggregated off `valueGetter` + `keyCreator` [S11][S14]:

```ts
{
  colId: 'totalPrice',
  headerName: 'Total',
  valueGetter: (p) => p.data.qty * p.data.unitPrice,   // checked before field  [S14]
  keyCreator: (p) => (p.value > 100 ? 'high' : 'low'), // the group key         [S14]
  rowGroup: true,
  aggFunc: 'sum',
}
```

MUI X Premium — synthetic `field`, grouping through `row`, not `value` [S19][S21][S22]:

```ts
{
  field: 'fullName',                                     // not a row property  [S21]
  valueGetter: (value, row) => `${row.firstName} ${row.lastName}`,
  // `value` here is row['fullName'] === undefined — use `row`                  [S22]
  groupingValueGetter: (value, row) => row.lastName[0],
}
```

Angular CDK — no derivation to escape; the accessor is a plain input [S25]:

```html
<cdk-text-column name="fullName" [dataAccessor]="(d) => d.firstName + ' ' + d.lastName" />
```

PrimeNG — per-column only for sort; grouping has none [S28]:

```html
<!-- sorts by a different path than it displays -->
<th pSortableColumn="customer.lastName">Customer</th>
<!-- groupRowsBy goes straight to resolveFieldData(row, 'customer.lastName') -->
<p-table
  [groupRowsBy]="'customer.lastName'"
  [customSort]="true"
  (sortFunction)="mySort($event)"
></p-table>
```

Handsontable — the accessor _is_ the column binding [S29]:

```js
columns: [{ data: (row, value) => (value === undefined ? row.total() : row.setTotal(value)) }];
```

## Against

- **PrimeNG is a real counter-example, and it is not a toy.** A widely used Angular table keys
  grouping and sorting directly at the row via `resolveFieldData`, with no per-column grouping
  override at all [S28]. If the ecosystem answer were unanimous, PrimeNG would not exist in this
  shape — so "grouping keys the data model" is a defensible position, just not the majority one.
- **MUI shows the synthetic-field hatch is leaky.** `groupingValueGetter` receives `row[field]`, not
  the `valueGetter` output [S22]. A team that adopts "id is free-form, accessor is separate" then
  has to document which of the two a derivation sees — the exact confusion the narrow key space
  eliminates by construction [R2].
- **TanStack pays for its freedom with a throw.** Because an `accessorFn` column has no id to
  derive, `column.ts` throws `Columns require an id when using an accessorFn` [S3]. Free-form ids
  buy expressiveness and re-introduce a construction-time error class that a `keyof`-narrowed key
  space does not have.
- **CDK and Handsontable prove little about derivation.** Neither ships grouping/aggregation, so
  their "id is free" evidence supports A but carries no weight on B or C [S24][S30].

## Not researched

- **TanStack Table v9 (`table-core@9.2.4`).** `src/types.ts` and `src/types/ColumnDef.ts` both 404
  on unpkg [S33]; only `dist/index.d.ts` is shipped. Whether v9 keeps the `id`/`accessorKey`/
  `accessorFn` split, `getGroupingValue`, or the `getCanX` predicates is **unknown** — no claim here
  covers v9.
- AG Grid's server-side row model (`server-side-model-grouping`) and pivot mode — grouping semantics
  there may differ from the client-side row model read in `valueService.ts`.
- MUI X aggregation (`aggregationModel`) key space — only `aggregable?: boolean` on the col def was
  read [S18]; the model's own type was not.
- Glide Data Grid, Vuetify and Element Plus data tables — not opened; PrimeNG and Handsontable were
  taken as the breadth pair.
- Stack Overflow / Reddit for integrator pain around non-field column ids — not searched; this is a
  design-question discovery, not a product-pain one.

## Unverified

- **AG Grid: whether `rowGroup: true` on a `valueGetter`-only column is _documented_ as supported.**
  Both the `value-getters` [S15] and `grouping-data` [S31] pages are silent on it. The claim in this
  doc rests on source (`getValue()` returns the `valueGetter` result before touching `field`, and
  `getKeyForNode()` builds the group key from `getValueFromData()` [S14]) plus the `keyCreator` doc
  comment naming grouping as a consumer [S11]. That is a strong inference, not a doc-confirmed
  statement. A runnable AG Grid example would confirm it.
- **AG Grid doc pages are JS-rendered and WebFetch returned partial content** for
  `grouping-complex-objects` [S34] — the `keyCreator` + `valueFormatter` example quoted in a search
  result snippet could not be re-read on the page itself and is therefore not cited as evidence.
- **CDK doc comments are read from `angular/components@main`, not from tag `22.1.7`** [S25][S26] —
  the pinned fesm2022 bundle has them stripped [S24]. The _behavior_ (`(data, name) => data[name]`
  fallback, `_columnDefsByName` lookup) is confirmed against the pinned bundle; only the prose is
  unpinned.
- **Handsontable docs carry no version marker**; `handsontable.com/docs/javascript-data-grid/...`
  was read on 2026-09-19 against registry latest `18.1.1` [S32]. The docs may describe a different
  minor.
- Whether TanStack's `getCanGroup` carve-out (`|| !!column.columnDef.getGroupingValue`) was a
  deliberate design decision or an incidental one — no ADR, RFC or PR was traced.

## Sources

|     | Source                                                                                                                | Version                 | Verified                                                                                                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | https://registry.npmjs.org/@tanstack/table-core/latest                                                                | 9.2.4                   | yes — registry read 2026-09-19; contradicts the brief's "v8" framing                                                                                                                                                      |
| S2  | https://unpkg.com/@tanstack/table-core@8.21.3/src/types.ts                                                            | 8.21.3                  | yes — source read; `ColumnIdentifiers`, `IdIdentifier`, `AccessorKeyColumnDefBase`, `AccessorFnColumnDefBase`                                                                                                             |
| S3  | https://unpkg.com/@tanstack/table-core@8.21.3/src/core/column.ts                                                      | 8.21.3                  | yes — source read; id derivation chain + the `Columns require an id when using an accessorFn` throw                                                                                                                       |
| S4  | https://unpkg.com/@tanstack/table-core@8.21.3/src/features/ColumnGrouping.ts                                          | 8.21.3                  | yes — source read; `GroupingState`, `GroupingColumnDef`, `row.getGroupingValue`, `getCanGroup`, `toggleGrouping`                                                                                                          |
| S5  | https://unpkg.com/@tanstack/table-core@8.21.3/src/utils/getGroupedRowModel.ts                                         | 8.21.3                  | yes — source read; `existingGrouping[depth]` + `row.getGroupingValue(columnId)`                                                                                                                                           |
| S6  | https://unpkg.com/@tanstack/table-core@8.21.3/src/features/RowSorting.ts                                              | 8.21.3                  | yes — source read; `ColumnSort`, `getCanSort`'s `!!column.accessorFn`. Corrects the guess that sorting lives in `ColumnSorting.ts` (404)                                                                                  |
| S7  | https://unpkg.com/@tanstack/table-core@8.21.3/src/features/ColumnFiltering.ts                                         | 8.21.3                  | yes — source read; `ColumnFilter`, `getCanFilter`'s `!!column.accessorFn`                                                                                                                                                 |
| S8  | https://unpkg.com/@tanstack/table-core@8.21.3/src/core/row.ts                                                         | 8.21.3                  | yes — source read; `row.getValue` returns `undefined` with no `accessorFn`                                                                                                                                                |
| S9  | https://unpkg.com/@tanstack/table-core@8.21.3/src/columnHelper.ts                                                     | 8.21.3                  | yes — full file read; `accessor` takes `AccessorFn \| DeepKeys<TData>`, function form requires `DisplayColumnDef`                                                                                                         |
| S10 | https://registry.npmjs.org/ag-grid-community/latest                                                                   | 36.2.0                  | yes — registry read 2026-09-19                                                                                                                                                                                            |
| S11 | https://unpkg.com/ag-grid-community@36.2.0/dist/types/src/entities/colDef.d.ts                                        | 36.2.0                  | yes — type read; `colId`, `field`, `ColDefField`, `valueGetter`, `keyCreator`, `filterValueGetter`, `rowGroup`, `aggFunc`, `comparator`                                                                                   |
| S12 | https://unpkg.com/ag-grid-community@36.2.0/dist/types/src/interfaces/gridState.d.ts                                   | 36.2.0                  | yes — type read; `RowGroupState.groupColIds`, `AggregationColumnState.colId`, `ColumnPinningState`                                                                                                                        |
| S13 | https://unpkg.com/ag-grid-community@36.2.0/dist/types/src/interfaces/iSortModelItem.d.ts                              | 36.2.0                  | yes — full file read; `SortModelItem.colId`                                                                                                                                                                               |
| S14 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/valueService/valueService.ts | b36.2.0                 | yes — source read; supplies the valueGetter-before-field precedence and the `keyCreator` application that **neither** AG Grid docs page states                                                                            |
| S15 | https://www.ag-grid.com/javascript-data-grid/value-getters/                                                           | 36.x (page unversioned) | yes — page read; explicitly silent on sort/filter/group over valueGetter values. Negative result                                                                                                                          |
| S16 | https://registry.npmjs.org/@mui/x-data-grid-premium/latest                                                            | 9.14.0                  | yes — registry read 2026-09-19                                                                                                                                                                                            |
| S17 | https://unpkg.com/@mui/x-data-grid@9.14.0/models/colDef/gridColDef.d.ts                                               | 9.14.0                  | yes — type read; `field: string` required, `valueGetter`, `sortComparator`, `groupable`                                                                                                                                   |
| S18 | https://unpkg.com/@mui/x-data-grid-premium@9.14.0/typeOverloads/modules.d.ts                                          | 9.14.0                  | yes — type read; `GridColDefPremium` adds `groupingValueGetter`, `groupingValueSetter`, `aggregable`, `pivotable`                                                                                                         |
| S19 | https://unpkg.com/@mui/x-data-grid-premium@9.14.0/models/gridGroupingValueGetter.d.ts                                 | 9.14.0                  | yes — full file read; the 4-arg signature carrying `row`                                                                                                                                                                  |
| S20 | https://unpkg.com/@mui/x-data-grid-premium@9.14.0/hooks/features/rowGrouping/gridRowGroupingInterfaces.d.ts           | 9.14.0                  | yes — full file read; `GridRowGroupingModel = string[]`, `GridGroupingRule.field`, `addRowGroupingCriteria(groupingCriteriaField)`                                                                                        |
| S21 | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/docs/data/data-grid/column-definition/column-definition.md        | v9.14.0                 | yes — doc source read at the tag; the `field: 'fullName'` snippet                                                                                                                                                         |
| S22 | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/docs/data/data-grid/row-grouping/row-grouping.md                  | v9.14.0                 | yes — doc source read at the tag; corrected the assumption that `groupingValueGetter` sees the `valueGetter` output — it sees `row[field]`                                                                                |
| S23 | https://registry.npmjs.org/@angular/cdk/latest                                                                        | 22.1.7                  | yes — registry read 2026-09-19                                                                                                                                                                                            |
| S24 | https://unpkg.com/@angular/cdk@22.1.7/fesm2022/table.mjs                                                              | 22.1.7                  | yes — bundle read; `_setNameInput`, `_columnDefsByName.get(columnId)`, `defaultDataAccessor \|\| ((data, name) => data[name])`. **Doc comments are stripped here** — contradicts the anchors note on Angular fesm bundles |
| S25 | https://raw.githubusercontent.com/angular/components/main/src/cdk/table/text-column.ts                                | main (unpinned)         | yes — source read; `dataAccessor` / `headerText` doc comments and `ngOnInit` defaults. Used only for prose; behavior confirmed at S24                                                                                     |
| S26 | https://raw.githubusercontent.com/angular/components/main/src/cdk/table/cell.ts                                       | main (unpinned)         | yes — source read; "Unique name for this column." on `CdkColumnDef.name`                                                                                                                                                  |
| S27 | https://registry.npmjs.org/primeng/latest                                                                             | 22.1.1                  | yes — registry read 2026-09-19                                                                                                                                                                                            |
| S28 | https://unpkg.com/primeng@22.1.1/fesm2022/primeng-table.mjs                                                           | 22.1.1                  | yes — bundle read; `sortSingle`/`sortMultiple` `resolveFieldData`, `groupRowsBy()` in `shouldRenderRowGroupHeader`, `customSort` → `sortFunction.emit`                                                                    |
| S29 | https://handsontable.com/docs/javascript-data-grid/binding-to-data/                                                   | docs current 2026-09-19 | yes — page read; `columns[].data` as a `(row, value)` accessor function                                                                                                                                                   |
| S30 | https://handsontable.com/docs/javascript-data-grid/api/options/#data                                                  | docs current 2026-09-19 | yes — page read; `data` as property name or dotted path                                                                                                                                                                   |
| S31 | https://www.ag-grid.com/javascript-data-grid/grouping-data/                                                           | 36.x (page unversioned) | yes — page read; silent on colId-vs-field and on valueGetter columns. Negative result                                                                                                                                     |
| S32 | https://registry.npmjs.org/handsontable/latest                                                                        | 18.1.1                  | yes — registry read 2026-09-19                                                                                                                                                                                            |
| S33 | https://unpkg.com/@tanstack/table-core@9.2.4/package.json                                                             | 9.2.4                   | yes — read; `types: ./dist/index.d.ts`, no `src/` shipped — why v9 stayed unverified                                                                                                                                      |
| S34 | https://www.ag-grid.com/javascript-data-grid/grouping-complex-objects/                                                | 36.x (page unversioned) | no — fetched, returned content lacking the `keyCreator` section; not used as evidence                                                                                                                                     |
| R1  | libs/table/src/api/types.ts:120                                                                                       | —                       | yes — read; `ColumnId<TRow>`                                                                                                                                                                                              |
| R2  | libs/table/src/api/features/with-grouping/types.ts:93                                                                 | —                       | yes — read; `GroupingPath<TRow>` keyed by `Extract<keyof TRow, string>`                                                                                                                                                   |
| R3  | libs/table/src/api/features/with-grouping/types.ts:70                                                                 | —                       | yes — read; `GroupingLevel.key: ColumnId<TRow>` — the wide space, inside grouping                                                                                                                                         |
| R4  | libs/table/src/api/features/with-grouping/schema.ts:54                                                                | —                       | yes — read; `applyGrouping<TRow, K extends Extract<keyof TRow, string>>`                                                                                                                                                  |
| R5  | libs/table/src/api/features/with-grouping/schema.ts:127                                                               | —                       | yes — read; `applyGroupOrder<TRow, K extends string>` — unnarrowed, unlike its siblings                                                                                                                                   |

</content>
</invoke>
