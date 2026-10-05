# Should a table derive column ids one-to-one from the row model, as Angular Signal Forms derives fields?

**Date:** 2026-09-19 · **Depth:** standard

## Answer

The analogy does **not** transfer. Signal Forms' one-to-one mapping is **write-back-driven, not
stylistic**: every field's state exposes `value: WritableSignal<TValue>` and `form()` is documented
as holding no copy of the data, so a field with no model slot has literally nowhere to write
[S5][S7]. A table is a read projection — it has no write to place — so the mechanism that _forces_
one-to-one in a form is simply absent. [S5][S7]

The maintainer's own hypothesis ("maybe because this is a form and not a table there is a reason")
is **correct, and the reason is write-back.** [S5][S7][S16]

Strict model-derivation is buildable and someone shipped it in Angular — Tim Deschryver's
Zod-driven table — and it has no mechanism at all for a non-schema column [S37]. That is the cost,
concretely. The middle position (E) is not a compromise: it is what AG Grid, MUI X and react-admin
each independently converged on, and AG Grid types it explicitly as a _subset_ column
[S24][S31][S36].

> **Decided since.** The design question this fed is settled by
> [ADR-0024](../../adr/0024-single-value-source-accessor.md) (accepted 2026-09-20): the column
> accessor becomes the single value source for cells, sorting, grouping and filtering; data
> concerns key by declared column id; a value the table reads but never renders is a **carrier
> column**, `{ id, accessor, visible: false }`. The finding below that the Signal Forms analogy
> does not transfer — write-back is the forcing function, and a table has none — is what ruled out
> the model-derived alternative, and the seven-column-kinds cost table is cited in that ADR's
> Alternatives.

## Method

- Versions pinned: `@angular/forms` — **repo pins `22.1.2`** (`package.json:23-24`), registry
  latest is `22.1.7` [S1][S2]. **The brief's "pin 22.1.7" is wrong**; every Signal Forms claim
  below is read from the installed `22.1.2` copy under `node_modules/`, i.e. a published artifact,
  not a `main` branch.
- Signal Forms read as **installed `.d.ts` + installed fesm bundle**, not docs:
  `types/_structure-chunk.d.ts` and `fesm2022/_validation_errors-chunk.mjs`. The `signals` entry
  point re-exports from these two chunks [S2].
- Table libraries: unpkg published `src/`/`dist/types/`; AG Grid docs read as `.mdoc` source at tag
  `b36.2.0`.
- **What verification changed, three times:**
  1. The brief calls AG Grid's `valueGetter`/`valueFormatter` split "the cleanest anchor" for #4.
     **It is not.** AG Grid's own `value-getters` and `value-formatters` pages contain _no_
     comparison and never state which one sorting uses [S29][S30]. MUI X states it verbatim [S33]
     and is the real anchor.
  2. The Signal Forms **schema path proxy accepts any property name at runtime** —
     `get(node, property) { return node.getChild(property).fieldPathProxy }` [S15]. The one-to-one
     constraint on the _schema_ side is type-only. The _field tree_ side is genuinely
     runtime-enforced [S13][S14]. Reading only the types would have got this backwards.
  3. The AG Grid SSRM page does **not** say derived columns cannot be sorted (a search summary
     claimed it did). What it says is that the server performs the sort, keyed by `colId` [S26].
     The limitation is an inference from that, and is labelled as such below.

## Evidence — Signal Forms, the actual mechanism

- `Subfields` is a homomorphic mapped type over `keyof TModel`, with function-valued properties
  removed. There is no extra-key slot, no index signature, no union with `string`: [S3]
  ```ts
  type Subfields<TModel, TMode extends 'writable' | 'readonly' = 'writable'> = {
    readonly [K in keyof TModel as TModel[K] extends Function ? never : K]: MaybeFieldTree<
      TModel[K],
      string,
      TMode
    >;
  } & {
    [Symbol.iterator](): Iterator<[string, MaybeFieldTree<TModel[keyof TModel], string, TMode>]>;
  };
  ```
- `FieldTree` is that mapped type intersected with a callable returning field state [S4]:
  ```ts
  type FieldTree<
    TModel,
    TKey extends string | number = string | number,
    TMode extends 'writable' | 'readonly' = 'writable',
  > = (() => [TModel] extends [AbstractControl]
    ? CompatFieldState<TModel, TKey, TMode>
    : FieldStateByMode<TModel, TKey, TMode>) &
    (TModel extends AbstractControl
      ? object
      : TModel extends ReadonlyArray<infer U>
        ? ReadonlyArrayLike<MaybeFieldTree<U, number, TMode>>
        : TModel extends Record<string, any>
          ? Subfields<TModel, TMode>
          : object);
  ```
- **The write-back proof.** `ReadonlyFieldState.value` is `Signal<TValue>` [S6]; `FieldState`
  overrides it to `readonly value: WritableSignal<TValue>` [S5]. `form()`'s doc comment states the
  semantics outright: "`form` uses the given model as the source of truth and _does not_ maintain
  its own copy of the data. This means that updating the value on a `FieldState` updates the
  originally passed in model as well." and "@param model … The resulting field structure will match
  the shape of the model and any changes to the form data will be written to the model." [S7]
- **Runtime enforcement of field existence.** Children are materialized by iterating the live model
  object: `for (const key of Object.keys(value))`, and a key whose value is `undefined` is actively
  deleted from the children map and skipped [S13]. The field proxy returns `undefined` for any
  property that is not a materialized child [S14]. So "no model slot" → "no field" is enforced at
  runtime, not just in types. The docs restate it: "Fields set to `undefined` are excluded from the
  field tree. A model with `{value: undefined}` behaves identically to `{}`" [S17].
- **No virtual / derived / computed field exists.** The full export list of
  `@angular/forms/signals` contains no such primitive [S2]. The closest is `transformedValue`, and
  it is **bidirectional by construction** — a `parse`/`format` pair where "Returning `value` updates
  the model; omitting it leaves the model unchanged" [S16]. It lives on a custom _control_, not on
  the field tree, and creates no field.
- **`schema` / `apply` / `applyEach` / `applyWhen` are keyed by a branded path token, never by a
  string.** `SchemaPath<TValue>` is
  `{ [ɵɵTYPE]: { value: () => TValue; supportsRules; pathKind } }` [S9]; `SchemaPathTree` is
  `{ [K in keyof TModel]: MaybeSchemaPathTree<TModel[K], PathKind.Child> }` [S8]; and the functions
  take that token: `apply<TValue>(path: SchemaPath<TValue>, schema)`,
  `applyWhen<TValue>(path, logic, schema)`,
  `applyEach<TValue extends ReadonlyArray<any>>(path, schema)` [S10]. **This is the single biggest
  structural difference from a table**: a form addresses by _structural navigation of a typed
  tree_, a table addresses by _string column id_. There is no string key space in Signal Forms to
  widen or narrow.
- **But the schema-side restriction is type-only.** At runtime the path proxy mints a child node
  for any property name whatsoever [S15]. Only the field tree is data-enforced [S13].
- **The non-model side channel exists, and it is metadata, not a field.**
  `createMetadataKey<TWrite>()` and `metadata(path, key, logic)` attach arbitrary consumer data to
  an _existing_ field [S12]. `ng-table` already mirrors this with `createColumnMetaKey()` /
  `metadata()`.
- **The documented answer for a mismatch is a mapping layer:** "If your application uses classes
  for domain modeling, translate to plain objects at the form boundary." [S17]

## Evidence — the structural asymmetry, and how vendors type it

- **AG Grid states the derivation key in the `colId` doc comment itself:** "The unique ID to give
  the column. This is optional. If missing, the ID will default to the field. If both field and
  colId are missing, a unique ID will be generated. **This ID is used to identify the column in the
  API for sorting, filtering etc.**" — while `field?: ColDefField<TData, TValue>` is "The field of
  the row object to get the cell's data from." [S23] Two slots, two jobs, stated in one file.
- **AG Grid's server wire protocol carries both, independently optional** [S25]:
  ```ts
  /** Column Value Object */
  export interface ColumnVO {
    id: string;
    displayName: string;
    field?: string;
    aggFunc?: string;
  }
  ```
  A column crossing to the server for grouping has a required **id** and an optional **field**.
  This is the strongest single artifact against collapsing the two.
- **AG Grid types the selection column as a restricted subset:** "Configure the selection column,
  used for displaying checkboxes. Note that due to the nature of this column, this type is a subset
  of `ColDef`, which does not support several normal column features such as editing, pivoting and
  grouping." — `selectionColumnDef?: SelectionColumnDef` [S24]. That is position **E**, shipped and
  typed.
- **AG Grid puts three column kinds outside `columnDefs` entirely** — `selectionColumnDef`,
  `rowNumbers?: boolean | RowNumbersOptions`, `autoGroupColumnDef` [S24]; row numbers is "a Column
  that is always present at the start of the grid" produced by a grid option, not a column def
  [S28].
- **MUI X removes the model-mapping slot from its checkbox column** —
  `GridCheckboxSelectionColDef = Omit<GridColDef, 'field' | 'type'>` [S31] — then supplies a
  sentinel: `export const GRID_CHECKBOX_SELECTION_FIELD = '__check__';` [S32].
- **MUI X makes the actions column a discriminated first-class kind** [S31]:
  ```ts
  export interface GridActionsColDef<R extends GridValidRowModel = any, V = any, F = V>
    extends GridBaseColDef<R, V, F> {
    type: 'actions';
    getActions: (
      params: GridRowParams<R>,
    ) => readonly React.ReactElement<GridActionsCellItemProps>[];
  }
  ```
- **TanStack's display column is first-class, not a workaround** [S18]:
  ```ts
  export type DisplayColumnDef<TData extends RowData, TValue = unknown> = ColumnDefBase<
    TData,
    TValue
  > &
    ColumnIdentifiers<TData, TValue>;
  export type ColumnDef<TData extends RowData, TValue = unknown> =
    | DisplayColumnDef<TData, TValue>
    | GroupColumnDef<TData, TValue>
    | AccessorColumnDef<TData, TValue>;
  ```
  `createColumnHelper` gives it its own constructor:
  `display: (column: DisplayColumnDef<TData>) => DisplayColumnDef<TData, unknown>` [S19].
  **It survived the v9 rewrite** — `DisplayColumnDef`, `AccessorKeyColumnDefBase`,
  `AccessorFnColumnDefBase`, `IdIdentifier` are all still exported from `table-core@9.2.4` [S20]. A
  major-version rewrite is the cheapest moment to drop a kind; they kept it.
- **TanStack gates the data concerns on the accessor, at runtime, not on the id** — `getCanSort`
  and `getCanFilter` both end in `&& !!column.accessorFn` [S21][S22]. Same split as E, enforced
  dynamically instead of by type.
- **react-admin draws the line explicitly at the data concern.** `<FunctionField>`'s only required
  prop is `render`; `source` is optional — but "when used inside a `<Datagrid>`, providing the
  `source` prop (or the `sortBy` prop) is required to make the column sortable" [S36]. Its own
  example renders a derived value while keying the sort to a real model field:
  ```jsx
  <FunctionField
    source="last_name"
    render={(record) => `${record.first_name} ${record.last_name}`}
  />
  ```

## Evidence — the derive / format line (the "accessor must not modify data" constraint)

- **MUI X states the line verbatim.** `valueGetter` is for "Transform the value / Render a
  combination of different fields / Derive a value from a complex value", and its result is used
  for "Filtering, Sorting, Rendering". `valueFormatter` "lets you convert the value before
  displaying it", and "the value returned by `valueFormatter` is only used for rendering purposes.
  Filtering and sorting are based on the raw value (`row[field]`) or the value returned by
  `valueGetter`." [S33]
- Type-level, same file: `valueGetter` — "Function that returns specific data to render in the cell
  instead of using the field value"; `valueFormatter` — "Formats the cell value before rendering."
  [S31]
- **AG Grid does not document this split at all.** Its `value-getters` page only constrains purity
  — "All valueGetters must be pure functions", because "the grid will only call your valueGetter
  once during a redraw" [S29] — and its `value-formatters` page carries no comparison [S30]. AG
  Grid's ordering is provable only from source (`getValue()` returns the `valueGetter` result
  before reading `field`) [R8].
- **The constraint as stated is narrower than any vendor's accessor.** "An accessor is a read-only
  projection, not value derivation" would forbid `valueGetter`'s documented job #2, "render a
  combination of different fields" [S33] — which is exactly `fullName`. **No surveyed library draws
  the line where the constraint draws it.** The line every vendor draws is _derive vs. format_, and
  `first + ' ' + last` lands on the **derive** side in all of them. Note the constraint is also
  already contradicted by the repo: `ColumnId<TRow>`'s own doc comment says derived,
  `accessor`-only columns "stay expressible" [R2], and `accessor` is a required
  `(row: TRow) => unknown` [R1].

## Evidence — cost of "put it on the model first"

- **Mapping layer.** Signal Forms' documented answer for a domain model that doesn't fit is
  "translate to plain objects at the form boundary" [S17]. Transferred to a table, that is a
  DTO→row mapping the consumer now owns for every endpoint. _(Reasoning, from the analogy — not a
  table-library source.)_
- **Server-side operations — the real one.** Under server-side sorting the sort is not the table's
  to do:
  - AG Grid: "The actual sorting of rows is performed on the server when using the Server-Side Row
    Model", and the request carries `sortModel: [{ colId: 'country', sort: 'asc' }, …]` [S26].
    Grouping likewise: "The actual grouping of rows is performed on the server when using the
    SSRM", carrying `rowGroupCols: ColumnVO[]` [S27].
  - TanStack: `manualSorting` — "If this is `true`, you will be expected to sort your data before
    it is passed to the table", and the implementation short-circuits:
    `if (table.options.manualSorting || !table._getSortedRowModel) { return table.getPreSortedRowModel() }`
    [S21]. `manualFiltering` "Disables the `getFilteredRowModel` from being used to filter data"
    [S22].
  - MUI: `sortingMode="server"` + `onSortModelChange`, and the item is `{ field, sort }` [S34] —
    only a string crosses [S39].
  - **The inference** (labelled as such): a client-computed `fullName` that exists _only_ on the
    mapped row cannot be sorted, filtered or grouped by a server that never saw it, and cannot be
    computed across unfetched pages. No vendor documents this as an explicit limitation; it follows
    from the wire shape, which is a string key the server must recognize. **Crucially, forcing
    `fullName` onto the model does not fix this** — it moves the derivation from the accessor to
    the mapping layer, still client-side, still invisible to the server. Strict model-derivation
    buys nothing here.
- **Reactivity.** The mapped row set becomes a `computed()` over source rows: one extra array
  allocation plus one object per row per source change, on top of the render-row chain.
  **`trackBy` identity does not break** — `TrackByConfig<TRow>` is `keyof TRow | fn` and
  `normalizeTrackBy` reads the id off the row value [R6], so as long as the mapping carries the id
  field, identity is stable across recomputes. _(Reasoning from repo source; not measured.)_
- **Memory.** One extra materialized row object per source row, plus one field per derived column,
  held for the table's lifetime — against today's cost of one closure call per cell per render,
  memoized into `RenderRow.cells` [R4][R9]. _(Reasoning, unmeasured.)_

## Comparison — capability × strict model-derivation

| Capability                                      | Expressible if every column id is `keyof TRow`? | Workaround                                                               | Cost of the workaround                                                                                                                                                                                        |
| ----------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selection checkbox column                       | **No**                                          | Add a synthetic boolean to every row, or a sentinel key outside the type | MUI instead _removes_ `field` from the type [S31] and uses `'__check__'` [S32]; AG Grid moves it to `selectionColumnDef`, a subset of `ColDef` [S24]. Both chose "not a model column" over "fake model field" |
| Row-actions column                              | **No**                                          | Sentinel id, or a model field carrying nothing                           | MUI made it a discriminated kind, `type: 'actions'` + `getActions` [S31]. A `keyof`-only space cannot name it                                                                                                 |
| Expand / collapse toggle                        | **No**                                          | Reuse an existing data column's id                                       | Conflates toggle state with a data cell; loses independent visibility/order for the toggle                                                                                                                    |
| Drag handle                                     | **No**                                          | Sentinel id                                                              | Same as actions; no data concern to attach, so the restriction buys nothing on this column                                                                                                                    |
| Running row index                               | **No**                                          | Stamp `index` onto every row at mapping time                             | Index depends on sort/filter/pagination output, so a _pre-table_ model field is stale by construction. AG Grid keeps it out of `columnDefs` entirely: `rowNumbers?: boolean \| RowNumbersOptions` [S24][S28]  |
| Aggregate-only column                           | **No**                                          | A model field that is `undefined` on every leaf row                      | In `ng-table` group rows already source cells only from aggregates [R5]; a leaf-row field would be dead weight                                                                                                |
| Spacer / filler column                          | **No**                                          | Sentinel id                                                              | Pure layout; forcing a model field to exist for it is the clearest case of the restriction costing with no return                                                                                             |
| Derived value (`fullName`)                      | **Yes, if pre-computed**                        | Map DTO → row before the table                                           | The intended case, and it works. But it does **not** become server-sortable [S21][S26][S34] — the derivation is still client-side                                                                             |
| Formatting (currency, dates)                    | **Yes**                                         | Cell renderer / pipe                                                     | Unaffected — every vendor puts this after the value [S31][S33]. `ng-table` already says values are raw, "format with a pipe" [R9]                                                                             |
| Columns added at runtime via `setColumns()`     | **No**                                          | Widen `TRow` upfront to every possible column                            | Named as a supported case by `ColumnId<TRow>`'s own doc comment today [R2]                                                                                                                                    |
| Grouping / sorting / filtering by a model field | **Yes**                                         | —                                                                        | Already the shape: `GroupingPath<TRow>` and `FiltersPath<TRow>` are keyed by `Extract<keyof TRow, string>` [R7][R8]                                                                                           |

## Synthesis

**A. Write-back, not DX.** Decisively write-back. `FieldState` narrows `value` from
`Signal<TValue>` to `WritableSignal<TValue>` [S6][S5], `form()` is documented as keeping no copy so
a set on a field writes the model [S7], and the runtime builds children from `Object.keys(model)`
with `undefined`-valued keys actively deleted [S13]. The only transform primitive in the whole
entry point, `transformedValue`, is a bidirectional `parse`/`format` pair whose `parse` "updates
the model" [S16]. A virtual field would need somewhere to write and there is nowhere. The DX story
(structural navigation, `p.street` autocomplete) is a _consequence_ of the constraint, not its
cause — and note that half of it is type-only: the schema path proxy will happily mint
`p.anythingAtAll` at runtime [S15].

**B. Does it transfer? Argue both ways.**
_For transfer:_ a table's `cells` record is keyed by column id [R9], and a column with no accessor
produces `undefined` — the same "reads as nothing" that Signal Forms resolves by excluding the
field. ADR-0021's consequences section already books the price of not transferring: "A column's
`accessor` and a feature rule's `applyGroupKey` extractor can compute different things with nothing
checking they agree — a group header can disagree with the column beneath it" [R7]. That is a real,
accepted correctness gap that strict model-derivation would close. MUI demonstrates the same class
of leak: `groupingValueGetter` receives `row[field]`, not the `valueGetter` output [R8].
_Against transfer:_ the form's constraint is enforced by an operation the table does not have. A
table never writes to a row through a column; `readAccessor` is one-directional [R4]. And the
addressing model is different in kind — a form navigates a branded typed path [S9][S10], a table
passes a `string` id to the server [S25][S26][S34]. There is no string key space in Signal Forms to
restrict, so "narrow the key space to `keyof`" is not even the same move Signal Forms made.
_Conclusion:_ the correctness gap is real and worth addressing, but it is an
**accessor-vs-extractor agreement** problem, not a **key space** problem. Narrowing the key space
is not the instrument that fixes it, and it removes seven column kinds as a side effect.

**C. What is lost.** Concretely: selection checkbox, row-actions, expand toggle, drag handle,
running row index, aggregate-only and spacer columns — seven kinds, none of which has a row field
and, per AG Grid's and MUI's typing, none of which _should_ [S24][S31]. Plus runtime
`setColumns()` additions [R2]. Plus the row index specifically cannot be faked on the model,
because it depends on pipeline output that does not exist at mapping time [S28]. The one honest
precedent for full strictness — the Zod Angular table — simply has no mechanism for any of them
[S37].

**D. What is gained, and how much is already available.** Gained: one vocabulary instead of two
(ADR-0021's split disappears); `accessor` becomes unnecessary; the header/cell disagreement booked
in ADR-0021's consequences becomes unrepresentable [R7]; autocomplete on column ids. **But most of
it is already obtainable without the restriction.**
`ColumnId<TRow> = Extract<keyof TRow, string> | (string & {})` already gives `keyof` autocomplete
while admitting free ids [R2] — the same widening TanStack uses on `accessorKey` [S18]. The
grouping/filtering paths are _already_ narrowed to `Extract<keyof TRow, string>` [R7]. What is
genuinely unobtainable without the restriction is only the accessor↔extractor agreement guarantee —
and TanStack reaches a comparable safety property with a runtime gate instead
(`getCanSort`/`getCanFilter` require an `accessorFn`) [S21][S22], which a type-level `keyof`
narrowing cannot express because it cannot say "unless the column brought its own derivation".

**E. The middle position is the ecosystem's actual answer.** Not a compromise — a convergent one,
reached independently by four vendors with different architectures. AG Grid: free `colId` is the
derivation key [S23], typed `field` is the accessor [S23], and the non-model column is a _declared
subset_ that "does not support … pivoting and grouping" [S24]. MUI: actions column is a
discriminated kind [S31], checkbox column has `field` removed from its type [S31], `valueGetter`
result feeds sorting/filtering while `valueFormatter` does not [S33]. TanStack: display column is
first-class and survived v9 [S18][S20], data concerns gated on the accessor [S21][S22].
react-admin: `render` without `source` is fine, but sorting demands `source` or `sortBy` [S36].
**The ecosystem evidence supports ADR-0021, it does not undercut it.** ADR-0021's test — "a
capability belongs to the column surface if it needs nothing from the row data, to a feature if it
reads rows" [R7] — is the same cut AG Grid makes in `SelectionColumnDef` and react-admin makes with
`sortBy`. One refinement the evidence suggests: ADR-0021's open item on rendering is exactly where
AG Grid needed dedicated machinery too [R7], so that gap is shared, not a local defect.

**F. DX verdict: harder, and the pain is front-loaded.** Strict model-derivation makes the first
data column trivially easy and the first checkbox column impossible. Every vendor that tried to
collapse identity and accessor into one slot had to spend documentation un-teaching it: MUI's
`field` is typed "the unique identifier" but defaults to a row lookup, so the docs must show
`field: 'fullName'` on a row with no such property [R8]. TanStack pays for the _opposite_ choice
with a construction throw, `Columns require an id when using an accessorFn` [R8] — a real
integrator stumble, but one that fires on first run and names its fix, which is the cheap failure
class. **I could not find citable integrator pain specific to derived/non-model column ids** —
searches across `mui/mui-x` and `ag-grid/ag-grid` returned only adjacent issues (`mui-x#7705`,
closed, about wanting more than `{field, sort}` in the server sort model [S39]). Saying so plainly
rather than inflating it: the DX verdict above rests on vendor type/doc design, not on measured
user complaints.

## Against

- **The correctness gap ADR-0021 accepts is real and the maintainer is right to be bothered by
  it.** "A group header can disagree with the column beneath it" [R7] is a genuine bug class, and
  MUI shipped exactly that leak [R8]. Strict model-derivation would eliminate it by construction.
  The argument here is that the cost is disproportionate and the instrument is wrong — not that the
  worry is unfounded.
- **PrimeNG shows collapsing the slots is survivable in a widely used Angular table** —
  `resolveFieldData(row, field)` is the only lookup, with no per-column grouping override [R8]. Not
  the majority position, but not a toy either.
- **Signal Forms' restriction is enforced less than it looks, which cuts both ways.** The schema
  path proxy accepts any property at runtime [S15]. If the Angular team were treating one-to-one as
  a deep invariant rather than a type-level affordance, that proxy would validate. Read charitably,
  this means Signal Forms itself treats the restriction as a _typing_ convenience over a write-back
  mechanism — which weakens "Signal Forms proves strictness is right" in _both_ directions.
- **AG Grid's two-slot design has a real ongoing cost**: "which one do I pass, `colId` or `field`?"
  appears on every state API [S23][S25], and AG Grid's own docs never resolve
  getter-vs-formatter [S29][S30].

## Not researched

- Whether Signal Forms has a known friction case for genuinely non-model form controls
  (confirm-password, accept-terms, a search box filtering a picklist). No `angular/angular` issue
  or RFC was opened. This is the closest available test of whether one-to-one hurts _forms_ too,
  and it is not done.
- `@angular/forms/signals/compat` — not read.
- Handsontable, PrimeNG, CDK for this question specifically — taken as settled from the prior
  discovery [R8], not re-read.
- `refine`, JSON-Schema→table generators, tRPC/Zod table builders beyond the one Angular article
  [S37]. No evidence gathered on whether any shipped strict derivation and backed out.
- Memory and recompute cost of a mapping `computed()` at large row counts — not measured, and no
  benchmark located.
- Stack Overflow and Reddit — not searched (the anchors file records both as having produced
  nothing citable twice before).

## Unverified

- **That a `valueGetter`-derived column is unsortable under AG Grid's SSRM is an inference, not a
  documented statement.** The page says the server sorts and receives `colId` [S26]; it never says
  derived columns fail. A web-search summary claimed the docs state "the order is incorrect" —
  re-fetching the page at tag `b36.2.0` did **not** reproduce that wording, so it is not cited. A
  runnable SSRM example would settle it.
- All cost estimates in "Evidence — cost" marked _(Reasoning)_: mapping-layer burden, allocation
  cost, memory duplication. Reasoned from source shapes, not measured.
- `SelectionColumnDef`'s full member list — the doc comment naming it a subset was read from
  `gridOptions.d.ts` [S24]; the interface body itself was not located in `colDef.d.ts` [S23]. The
  quoted characterization is AG Grid's own, not my reading of the type.
- The claim that no vendor draws the accessor line where the maintainer's constraint draws it rests
  on MUI's explicit statement [S33] plus AG Grid/TanStack accessor signatures. A vendor with an
  explicitly read-only-projection accessor may exist outside the surveyed set.
- `@angular/forms@22.1.7` types were not read; all Signal Forms claims are from installed `22.1.2`
  [S2]. A patch-level change to these types is unlikely but unchecked.

## Sources

|     | Source                                                                                                                                      | Version                       | Verified                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | https://registry.npmjs.org/@angular/forms/latest                                                                                            | 22.1.7                        | yes — registry read 2026-09-19; exports map lists `./signals`                                                                                                                      |
| S2  | `node_modules/@angular/forms/package.json` and `package.json:23-24`                                                                         | 22.1.2                        | yes — read; **corrects the brief's "repo pins 22.1.7"**                                                                                                                            |
| S3  | `node_modules/@angular/forms/types/_structure-chunk.d.ts:1169-1173`                                                                         | 22.1.2                        | yes — type read; `Subfields` mapped over `keyof TModel`, functions excluded                                                                                                        |
| S4  | `node_modules/@angular/forms/types/_structure-chunk.d.ts:1153`                                                                              | 22.1.2                        | yes — type read; `FieldTree`                                                                                                                                                       |
| S5  | `node_modules/@angular/forms/types/_structure-chunk.d.ts:1375-1388`                                                                         | 22.1.2                        | yes — type read; `FieldState.value: WritableSignal<TValue>` — the write-back proof                                                                                                 |
| S6  | `node_modules/@angular/forms/types/_structure-chunk.d.ts:1210-1223`                                                                         | 22.1.2                        | yes — type read; `ReadonlyFieldState.value: Signal<TValue>`                                                                                                                        |
| S7  | `node_modules/@angular/forms/types/_structure-chunk.d.ts:1833-1861`                                                                         | 22.1.2                        | yes — doc comment + signature read; "does not maintain its own copy"                                                                                                               |
| S8  | `node_modules/@angular/forms/types/_structure-chunk.d.ts:1555-1559`                                                                         | 22.1.2                        | yes — type read; `SchemaPathTree` mapped over `keyof TModel`                                                                                                                       |
| S9  | `node_modules/@angular/forms/types/_structure-chunk.d.ts:1524-1530`                                                                         | 22.1.2                        | yes — type read; `SchemaPath` is a brand, not a string key                                                                                                                         |
| S10 | `node_modules/@angular/forms/types/_structure-chunk.d.ts:1980-2019`                                                                         | 22.1.2                        | yes — type read; `applyEach`, `apply`, `applyWhen` all take `SchemaPath`                                                                                                           |
| S11 | `node_modules/@angular/forms/types/_structure-chunk.d.ts:1644`                                                                              | 22.1.2                        | yes — type read; `SchemaFn`                                                                                                                                                        |
| S12 | `node_modules/@angular/forms/types/_structure-chunk.d.ts:31` and `:142`                                                                     | 22.1.2                        | yes — type read; `metadata()` / `createMetadataKey()` — the non-model side channel                                                                                                 |
| S13 | `node_modules/@angular/forms/fesm2022/_validation_errors-chunk.mjs:1167-1208`                                                               | 22.1.2                        | yes — bundle read; children from `Object.keys(value)`, `undefined` keys deleted. Runtime enforcement the types alone do not show                                                   |
| S14 | `node_modules/@angular/forms/fesm2022/_validation_errors-chunk.mjs:935-967`                                                                 | 22.1.2                        | yes — bundle read; `FIELD_PROXY_HANDLER` returns `undefined` for a non-child property                                                                                              |
| S15 | `node_modules/@angular/forms/fesm2022/_validation_errors-chunk.mjs:500-507`                                                                 | 22.1.2                        | yes — bundle read; **changed the finding** — `FIELD_PATH_PROXY_HANDLER` mints a child for any property, so the schema-side restriction is type-only                                |
| S16 | `node_modules/@angular/forms/types/signals.d.ts:735-783`                                                                                    | 22.1.2                        | yes — doc + signature read; `transformedValue` is a bidirectional parse/format pair                                                                                                |
| S17 | https://angular.dev/guide/forms/signals/models                                                                                              | unversioned (read 2026-09-19) | yes — page read; "mirrors your model's shape", "Fields set to `undefined` are excluded", "translate to plain objects at the form boundary"                                         |
| S18 | https://unpkg.com/@tanstack/table-core@8.21.3/src/types.ts                                                                                  | 8.21.3                        | yes — source read; `DisplayColumnDef`, `ColumnDef` union, `ColumnIdentifiers`, `AccessorKeyColumnDefBase`                                                                          |
| S19 | https://unpkg.com/@tanstack/table-core@8.21.3/src/columnHelper.ts                                                                           | 8.21.3                        | yes — source read; `display()` is its own constructor                                                                                                                              |
| S20 | https://unpkg.com/@tanstack/table-core@9.2.4/dist/index.d.ts                                                                                | 9.2.4                         | yes — d.ts read; `DisplayColumnDef` still exported — closes the prior discovery's v9 gap for this question                                                                         |
| S21 | https://unpkg.com/@tanstack/table-core@8.21.3/src/features/RowSorting.ts                                                                    | 8.21.3                        | yes — source read; `manualSorting` doc + short-circuit, `getCanSort`                                                                                                               |
| S22 | https://unpkg.com/@tanstack/table-core@8.21.3/src/features/ColumnFiltering.ts                                                               | 8.21.3                        | yes — source read; `manualFiltering` doc, `getCanFilter`                                                                                                                           |
| S23 | https://unpkg.com/ag-grid-community@36.2.0/dist/types/src/entities/colDef.d.ts                                                              | 36.2.0                        | yes — type read; `colId` doc "used to identify the column in the API for sorting, filtering etc", `field`, `valueFormatter`                                                        |
| S24 | https://unpkg.com/ag-grid-community@36.2.0/dist/types/src/entities/gridOptions.d.ts                                                         | 36.2.0                        | yes — type read; `selectionColumnDef` "subset of `ColDef` … does not support … pivoting and grouping", `rowNumbers`, `autoGroupColumnDef`                                          |
| S25 | https://unpkg.com/ag-grid-community@36.2.0/dist/types/src/interfaces/iColumnVO.d.ts                                                         | 36.2.0                        | yes — full file read; `ColumnVO { id; displayName; field?; aggFunc? }`                                                                                                             |
| S26 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/server-side-model-sorting/index.mdoc  | b36.2.0                       | yes — doc source read at tag; **corrected a search-summary claim** that the page documents derived-column sort failure — it does not                                               |
| S27 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/server-side-model-grouping/index.mdoc | b36.2.0                       | yes — doc source read at tag; `rowGroupCols: ColumnVO[]`, grouping performed on server                                                                                             |
| S28 | https://www.ag-grid.com/javascript-data-grid/row-numbers/                                                                                   | 36.x (page unversioned)       | yes — page read; `rowNumbers = true` grid option produces a synthetic column outside `columnDefs`                                                                                  |
| S29 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/value-getters/index.mdoc              | b36.2.0                       | yes — doc source read; purity requirement only. **Negative result: no getter-vs-formatter comparison**                                                                             |
| S30 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/value-formatters/index.mdoc           | b36.2.0                       | yes — doc source read. **Negative result**; disproves the brief's premise that AG Grid is the cleanest anchor for #4                                                               |
| S31 | https://unpkg.com/@mui/x-data-grid@9.14.0/models/colDef/gridColDef.d.ts                                                                     | 9.14.0                        | yes — type read; `GridActionsColDef`, `GridCheckboxSelectionColDef = Omit<GridColDef, 'field' \| 'type'>`, `valueGetter`/`valueFormatter` doc comments                             |
| S32 | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid/src/colDef/gridCheckboxSelectionColDef.tsx                         | v9.14.0                       | yes — source read at tag; `GRID_CHECKBOX_SELECTION_FIELD = '__check__'`                                                                                                            |
| S33 | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/docs/data/data-grid/column-definition/column-definition.md                              | v9.14.0                       | yes — doc source read at tag; the verbatim derive-vs-format rule. The real anchor for #4                                                                                           |
| S34 | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/docs/data/data-grid/sorting/sorting.md                                                  | v9.14.0                       | yes — doc source read at tag; `sortingMode="server"`, item is `{field, sort}`; silent on `valueGetter` columns                                                                     |
| S35 | https://registry.npmjs.org/react-admin/latest                                                                                               | 5.15.3                        | yes — registry read 2026-09-19                                                                                                                                                     |
| S36 | https://marmelab.com/react-admin/FunctionField.html                                                                                         | 5.15.3 (page unversioned)     | yes — page read; only `render` required; "providing the `source` prop (or the `sortBy` prop) is required to make the column sortable"                                              |
| S37 | https://timdeschryver.dev/blog/using-zods-schema-to-render-a-reusable-and-dynamic-angular-table-component                                   | undated                       | yes — page read; a shipped Angular model-derived table with **no** mechanism for non-schema columns                                                                                |
| S38 | https://registry.npmjs.org/@tanstack/table-core/latest                                                                                      | 9.2.4                         | yes — registry read 2026-09-19                                                                                                                                                     |
| S39 | https://github.com/mui/mui-x/issues/7705                                                                                                    | —                             | yes — issue read; closed, opened 2023-01-25, labels `scope: data grid` / `support: commercial`; confirms only `{field, sort}` crosses to the server. **Not** about derived columns |
| R1  | libs/table/src/api/types.ts:81-86                                                                                                           | —                             | yes — read; `ColumnDef.accessor: (row: TRow) => unknown`, required                                                                                                                 |
| R2  | libs/table/src/api/types.ts:115-120                                                                                                         | —                             | yes — read; `ColumnId<TRow>` + doc comment naming derived `accessor`-only columns as a supported case                                                                              |
| R3  | libs/table/src/api/types.ts:99-113                                                                                                          | —                             | yes — read; `accessor` defaults to `(row) => row[id]`                                                                                                                              |
| R4  | libs/table/src/engine/cells.ts:22-49                                                                                                        | —                             | yes — read; `readAccessor` / `buildDataCells`, keyed by `column.id`                                                                                                                |
| R5  | libs/table/src/engine/cells.ts:51-56                                                                                                        | —                             | yes — read; "column ids and row-field names are separate vocabularies (ADR-0021)"                                                                                                  |
| R6  | libs/table/src/engine/rows.ts:7-23                                                                                                          | —                             | yes — read; `normalizeTrackBy`, `keyof TRow \| fn`                                                                                                                                 |
| R7  | libs/table/docs/adr/0021-column-concerns-and-data-concerns-are-separate-surfaces.md                                                         | —                             | yes — read in full, Decision + Alternatives + Consequences + Open                                                                                                                  |
| R8  | libs/table/docs/2-columns/work/column-id-identity/discovery-non-field-column-ids.md                                                         | —                             | yes — read in full; treated as settled input per the brief                                                                                                                         |
| R9  | libs/table/src/api/types.ts:73-78                                                                                                           | —                             | yes — read; `RenderRow.cells` keyed by declared column id, "values are raw — format with a pipe"                                                                                   |

</content>
</invoke>
