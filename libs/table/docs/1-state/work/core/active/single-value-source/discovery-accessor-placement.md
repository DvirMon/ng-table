# Should a column's value accessor be an option on the column definition, or a rule in the column schema?

**Date:** 2026-09-22 · **Depth:** standard

## Answer

**Keep `accessor` in `col()`. The move is possible but strictly worse.** [S1][S9][S12]

The type flow *can* survive — but only by converting the columns schema from G62's recording
form to its declaring form, and the question's own framing ("a callback receiving a path handle")
is the one variant that **cannot** work: a `void` return has no outbound type channel, so `V` is
unrecoverable and the map falls to its `TRow[C['id']]` arm. [R1]

Every surveyed data-table vendor places value access on the column definition next to the id, and
the single library that separates them — Angular Material — pays for it with an **untyped,
string-keyed** accessor. [S1][S3][S4][S6][S7] The schema-carrying libraries (Drizzle, Zod) put the
type-carrying static shape in one argument and the rule block in a deliberately type-neutral
second one; `pgTable(name, columns, extraConfig)` is structurally identical to
`createColumns(data, build, schema)`, and the rule slot contributes no types. [S9][S10]

## Method

- Versions pinned from `registry.npmjs.org/<pkg>/latest` on 2026-09-22: `@tanstack/table-core`
  **9.2.4** latest — v8 source read at an explicit `@8.21.3` pin because v9 ships no `src/`;
  `ag-grid-community` **36.2.0**; `@mui/x-data-grid` **9.14.0**; `@progress/kendo-angular-grid`
  **25.1.0**; `drizzle-orm` **0.45.3**; `@pothos/core` **4.15.1**.
- `@angular/material` read at **22.1.7** from unpkg (`types/table.d.ts`, located via the package's
  own `exports` map — `table/index.d.ts` and `table.d.ts` both 404).
- `zod` read from **installed** `node_modules/zod/v4/classic/schemas.d.cts`, not the registry.
- Repo TypeScript: **6.0.3** (`package.json:73`) — every mechanism below is available.
- Reliability: AG Grid's and MUI X's `TValue`/`V` generics are *hand-annotated*, never inferred
  from `field` — so their presence in a signature is not evidence of a working type flow. [S11]

## Evidence — (a) placement

- TanStack v8 puts both accessor forms **inside** the column def object: `accessorFn:
  AccessorFn<TData, TValue>` on `AccessorFnColumnDefBase`, `accessorKey: (string & {}) | keyof
  TData` on `AccessorKeyColumnDefBase`. [S1]
- AG Grid puts `field?: ColDefField<TData, TValue>` and `valueGetter?: string |
  ValueGetterFunc<TData, TValue>` on the **same** `ColDef<TData = any, TValue = any>`; neither is
  required. [S3]
- MUI X: `field: string` (required) and `valueGetter?: GridValueGetter<R, V, F>` on
  `GridBaseColDef<R, V, F>`, documented as "Function that returns specific data to render in the
  cell instead of using the field value." [S4]
- Kendo Angular Grid `ColumnComponent` has `field: string` ("Sets the field that the column binds
  to.") and **no** accessor/value-getter input anywhere in the package's type surface. [S6]
- **Angular Material is the only separator, and it is the negative result.** `MatColumnDef` has
  only `name`; it carries no data binding at all — the template supplies the value. Value access
  for sorting therefore lives on the *data source*:
  `sortingDataAccessor: (data: T, sortHeaderId: string) => string | number` — separated, keyed by
  a raw string id, and its return type erased to `string | number`. [S7] Filtering is separated
  the same way, as `filterPredicate: (data: T, filter: string) => boolean`. [S7]

## Evidence — (b) optionality

- **No surveyed library treats the accessor as the exceptional case.** TanStack goes the opposite
  way: the accessor is the *kind discriminator*. `ColumnHelper<TData>` exposes exactly three
  makers — `accessor`, `display`, `group` — and on `.accessor(...)` the accessor is the **first
  positional, required** argument. [S2] A `display` column has no accessor slot at all
  (`DisplayColumnDef = ColumnDefBase & ColumnIdentifiers`). [S1]
- The consuming design's ADR-0024 "carrier column" (`{ id, accessor, visible: false }`) is
  TanStack's accessor-kind-without-render. Demoting the accessor to a rule inverts the one axis
  TanStack uses to *classify* columns. [S1][S2]
- Defaulting to the id-as-row-key is universal but is expressed as a **sibling field**, not as
  rule-vs-default: AG Grid `field` [S3], MUI X `field` [S4], Kendo `field` [S6], TanStack
  `accessorKey` [S1].

## Evidence — (c) type flow, the decisive one

- **The recording form cannot carry `V`.** `ColumnsSchemaFn<TRow, TId> = (path:
  ColumnsPath<TRow, TId>) => void` [R1]; `applyVisible`/`metadata` return `void` and write through
  `recorder.record(rule)` [R2][R3], a runtime side effect with no type representation. The only
  outbound channel a `void` function has is its parameter, and `path` is built from ids already
  known before the body runs [R4]. A path-handle accessor rule therefore degrades the map to its
  `C['id'] extends keyof TRow ? TRow[C['id']] : unknown` arm. [R5]
- **The declaring form can.** The repo already ships the exact mechanism, for filtering: the
  schema is `schema?: (path: FiltersPath<TRow>) => S` with `S extends Record<string, AnyRule>`,
  and the criterion type is recovered from a phantom member —
  `FilterRule<TCriterion, TRow> { readonly __criterion?: TCriterion }`, read by
  `CriterionOf<R> = R extends FilterRule<infer C> ? C : never` and mapped by `StateOf<S>`. [R6][R7]
- Applied to accessors, the minimum working signature — phantom carrier plus key remapping, so
  the id comes from the **path handle** rather than an object key:

```ts
type AccessorDecl<K extends string, V> = {
  readonly kind: 'accessor';
  readonly id: K;
  readonly __value?: V;            // phantom; mirrors FilterRule.__criterion
};

declare function accessor<TRow, K extends string, V>(
  path: ColumnHandle<TRow, K>,
  read: (row: TRow) => V
): AccessorDecl<K, V>;

// the schema fn must RETURN a tuple — `void` is what blocks this
type ColumnsSchemaFn<TRow, TId extends string, TDecls extends readonly AccessorDecl<TId, any>[]> =
  (path: ColumnsPath<TRow, TId>) => TDecls;

type ValuesOfDecls<TDecls extends readonly AccessorDecl<string, any>[]> = {
  [D in TDecls[number] as D['id']]: D extends AccessorDecl<any, infer V> ? V : never;
};

type ColumnValues<TRow, TCols extends readonly AnyDecl<TRow>[], TDecls> = {
  [C in TCols[number] as C['id']]:
    C['id'] extends keyof ValuesOfDecls<TDecls> ? ValuesOfDecls<TDecls>[C['id']]
    : C['id'] extends keyof TRow ? TRow[C['id']]
    : unknown;
};
```

  Call site, with the body now mixed — some calls returned, some called for effect:

```ts
createColumns(
  this.deals,
  (col) => [col('region', { label: 'Region' }), col('amount'), col('owner')],
  (path) => {
    visible(path.region, { when: () => true });          // recording, returns void
    metadata(path.owner, WIDTH_KEY, 120);                // recording, returns void
    return [accessor(path.owner, (row) => row.owner.name)] as const;   // declaring
  }
);
```

- **Version constraints:** key remapping (`as` in a mapped type) is TS **4.1**+; `NoInfer` is
  **5.4**+ and is already used in `metadata()` [R3]; the `as const` above is avoidable with a
  `const` type parameter (TS **5.0**+), but note TS's own documented limit — a `const` modifier
  "only affects inference of object, array and primitive expressions that were written within the
  call", so a hoisted schema fn defeats it. [S8] Repo is on TS 6.0.3, so nothing here is blocked
  by version.
- **The filtering-shaped variant keys off the object literal, not the path** — `(path) => ({
  owner: accessor((row) => row.owner.name) })`, with `build.ts` stamping the key from the
  property name [R7]. That works too, and is closer to precedent, but the path proxy is then
  unused for this one rule and the column id is written twice.
- **Cost the type flow does not cover:** a standalone compiled schema erases —
  `ColumnSchema<TRow> { readonly rules: readonly ColumnRule<TRow>[] }` [R1]. Passing a shared
  `columnSchema()` value as `createColumns`' third argument (design-brief probe P5b) would
  silently drop every accessor in it to the `TRow[id]` fallback, unless `ColumnSchema` itself
  becomes generic in its value map and that generic is threaded through every reuse site.

## Evidence — (d) static vs reactive coherence

- **Drizzle separates them by argument position, and the rule slot is type-neutral.**
  `pgTable(name, columns: TColumnsMap, extraConfig?: (self: BuildExtraConfigColumns<...>) =>
  PgTableExtraConfigValue[])` — `TColumnsMap extends Record<string, PgColumnBuilderBase>`, and the
  table's types come from `BuildColumns<TTableName, TColumnsMap, 'pg'>`, i.e. **arg 2 only**.
  `extraConfig` receives a path handle and returns indexes/constraints, contributing nothing to
  the column types. [S9]
- **Zod's rules are type-neutral by construction.** `refine<Ch>(check: Ch, …): Ch extends (arg:
  any) => arg is infer R ? this & ZodType<R, …> : this` — a plain predicate returns `this`
  unchanged; `superRefine(...): this` always does. The shape declaration (`z.object({…})`) is what
  carries the type. [S10]
- **Pothos keys its exposure by model key in the declaration call**: `exposeString<Name extends
  CompatibleTypes<Types, ParentShape, 'String', true>>(name: Name, …)` — the value source is the
  first positional argument of the field declaration, type-constrained against the parent shape.
  [S13]
- **Angular Signal Forms carries the value type in a branded phantom slot on the *path*, and every
  rule infers `TValue` from the path argument only, with `NoInfer` on the callback** —
  i.e. types flow *into* rules, never out of them. [S14]
- **The repo's own engine already rules against it.** `foldColumnRules` re-reads every rule's
  `result()` signal per fold and rebuilds `ColumnDef`s from the results [R8]; an accessor arriving
  that way gets a fresh function identity per fold, invalidating `RenderRow.cells` (stamped via
  `readAccessor` [R9]) — or needs a carve-out that exempts it from the fold, i.e. a static value
  parked in a reactive registry. `applyVisible`'s own doc comment states the existing convention
  verbatim: "Static visibility never goes through the schema — set `visible` directly on the
  `columns` array literal instead." [R2] An accessor is *more* static than `visible`, which can at
  least legitimately change.

## Comparison

| Axis | TanStack@8.21.3 | AG Grid@36.2.0 | MUI X@9.14.0 | Kendo@25.1.0 | Angular Material@22.1.7 |
|---|---|---|---|---|---|
| Value access on the column def | yes — `accessorFn`/`accessorKey` [S1] | yes — `field`/`valueGetter` [S3] | yes — `field`/`valueGetter` [S4] | yes — `field` [S6] | **no** — `MatColumnDef` has only `name` [S7] |
| Separated from presentation | no [S1] | no [S3] | no [S4] | no [S6] | yes — on the data source [S7] |
| Accessor is an exceptional rule | no — it is the column *kind* [S2] | no — sibling field [S3] | no — sibling field [S4] | no — sibling field [S6] | n/a (no column-level accessor) |
| Value type inferred from the accessor | yes — `infer TReturn` in `ColumnHelper.accessor` [S2] | no — `TValue` hand-annotated [S11] | no — `V` defaults to `any` [S4][S11] | no — `field: string` [S6] | no — erased to `string \| number` [S7] |
| Declared where the id is declared | yes [S1] | yes [S3] | yes [S4] | yes [S6] | no — keyed by `sortHeaderId: string` [S7] |

## Synthesis

- **The only disagreement in the survey is Angular Material, and it disagrees for a reason that
  does not transfer.** `MatColumnDef` carries no data binding because the *template* renders the
  value (`*matCellDef="let row"`), so there is no declaration object to put an accessor on and
  sorting had to grow its own [S7]. This repo has the opposite premise: ADR-0024 makes one
  accessor serve cells, sorting, grouping and filtering, so the declaration object exists and is
  already the single value source. Material's separated accessor is also the survey's only
  *untyped* one — evidence of the cost, not of the benefit.
- **TanStack and Drizzle agree from opposite ends.** TanStack keeps the accessor in the def and
  gets `TValue` by `infer TReturn` at the call [S2]; Drizzle keeps the shape in arg 2 and gets
  types from `BuildColumns` [S9]. Both put the type-carrying declaration in the *declaration*
  slot and leave the rule slot type-free. Moving `accessor` into the schema is the only
  arrangement in the survey where a rule surface is load-bearing for types.
- **G62's two forms settle the mechanism question, not the design question.** The declaring form
  exists and demonstrably carries per-key types (filtering does it today [R6][R7]), so "impossible"
  is the wrong verdict. The right one is that it would make the columns schema a *hybrid* — some
  calls recorded for effect, some returned for their type — which is a third authoring form G62
  does not license.
- **Ergonomics argue weakly for the move and the schema is where per-column concerns are
  converging** (G61, G69: sorting gains its own schema fn). That is the strongest case on the
  other side and it is answered by the split every schema library already makes: shape in the
  declaration, rules in the schema.

## Against

- If `ColumnSchema<TRow>` were made generic in its value map, the standalone-reuse degradation
  above disappears, and the "two declaration sites" objection weakens to a style preference. That
  is a real, buildable answer — it just propagates a second type parameter through every reuse
  site and through `TableConfig`. [R1]
- Filtering already proves the repo tolerates a declaring-form schema whose return type is
  load-bearing [R6] — so "a rule surface must not carry types" is not this codebase's rule, only
  the columns schema's current shape.
- `applyGroupKey`'s extractor already receives accessor output rather than `TRow[K]` (G68), so
  schema-side code is not innocent of the accessor today.

## Not researched

- Syncfusion EJ2 Grid — surveyed Kendo instead of Syncfusion for the Angular commercial-grid slot;
  Syncfusion's `valueAccessor` was not opened.
- SlickGrid, PrimeNG, Handsontable, DevExtreme — prior anchors record that PrimeNG and Handsontable
  have no id/accessor split; not re-verified this run.
- Valibot — named in the brief, not surveyed. Zod and Drizzle covered the same (d) point.
- Whether a `const` type parameter on the schema fn removes the `as const` in the (c) sketch was
  reasoned from TS's documented limits [S8], not probed against this repo's compiler.

## Unverified

- **Pothos `t.field({ type, resolve })`.** `dts/fieldBuilder.d.ts` 404s and
  `dts/fieldUtils/builder.d.ts` does not contain a `field` method; only the `expose*` family was
  read [S13]. The claim that `resolve` sits inside the field-definition options object is a
  reasonable inference from the `expose*` shape, not a doc-confirmed fact. Fetching
  `@pothos/core@4.15.1/dts/fieldUtils/root.d.ts` or the published docs would confirm it.
- **No compiled probe was run.** The (c) sketch is derived from the mechanism filtering already
  ships [R6][R7] plus TS's documented mapped-type and `const`-parameter rules [S8]; it has not
  been compiled. A `.types.spec.ts` with `expectTypeOf` under `nx run shared-table:typecheck-spec`
  would confirm it — and is worth writing only if the verdict is overturned.
- Whether AG Grid's `valueGetter`-only columns are groupable is documented nowhere; prior anchors
  record both doc pages as silent on it.

## Sources

| | Source | Version | Verified |
|---|---|---|---|
| S1 | https://unpkg.com/@tanstack/table-core@8.21.3/src/types.ts | 8.21.3 | yes — source read; `accessorFn`/`accessorKey` are members of the column def, `DisplayColumnDef` has neither |
| S2 | https://unpkg.com/@tanstack/table-core@8.21.3/src/columnHelper.ts | 8.21.3 | yes — source read; `TValue` obtained by `TAccessor extends AccessorFn<TData, infer TReturn>` at the call site, accessor is arg 1 and required |
| S3 | https://unpkg.com/ag-grid-community@36.2.0/dist/types/src/entities/colDef.d.ts | 36.2.0 | yes — source read; `field` and `valueGetter` both optional members of one `ColDef` |
| S4 | https://unpkg.com/@mui/x-data-grid@9.14.0/models/colDef/gridColDef.d.ts | 9.14.0 | yes — source read; `GridBaseColDef<R, V = any, F = V>`, `valueGetter?: GridValueGetter<R, V, F>` |
| S5 | https://registry.npmjs.org/@tanstack/table-core/latest | 9.2.4 | yes — registry read; confirms the v8 pin is deliberate, not stale |
| S6 | https://unpkg.com/@progress/kendo-angular-grid@25.1.0/index.d.ts | 25.1.0 | yes — source read; `field: string` on `ColumnComponent`, no accessor/value-getter input in the package |
| S7 | https://unpkg.com/@angular/material@22.1.7/types/table.d.ts | 22.1.7 | yes — source read; corrected the assumption that Material has no separated accessor — it has one, on the data source, untyped and string-keyed |
| S8 | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html | TS 5.0 | no — cited only, from prior verified anchor notes (`const` modifier affects only expressions written within the call) |
| S9 | https://unpkg.com/drizzle-orm@0.45.3/pg-core/table.d.ts | 0.45.3 | yes — source read; `pgTable(name, columns, extraConfig)` — types from arg 2 via `BuildColumns`, arg 3 returns `PgTableExtraConfigValue[]` |
| S10 | node_modules/zod/v4/classic/schemas.d.cts (line 38-39, 742-743) | 4.4.3 installed | yes — source read; `refine` returns `this` unless the check is a type predicate, `superRefine` always returns `this` |
| S11 | https://unpkg.com/ag-grid-community@36.2.0/dist/types/src/entities/colDef.d.ts | 36.2.0 | yes — source read; `ColDef<TData = any, TValue = any>` — `TValue` is a hand-annotated parameter, not inferred from `field` |
| S12 | https://registry.npmjs.org/drizzle-orm/latest | 0.45.3 | yes — registry read |
| S13 | https://unpkg.com/@pothos/core@4.15.1/dts/fieldUtils/builder.d.ts | 4.15.1 | yes — source read; `exposeString<Name extends CompatibleTypes<...>>(name: Name, …)` — value source is arg 1 of the declaration |
| S14 | node_modules/@angular/forms/types/_structure-chunk.d.ts | 22.1.2 installed | no — cited from prior verified anchor notes (`SchemaPath<TValue>` brand; rules infer `TValue` from the path argument, `NoInfer` on callbacks) |
| R1 | libs/table/src/columns-schema/types.ts:29-37 | — | yes — read; `ColumnsSchemaFn` returns `void`; `ColumnSchema<TRow>.rules` erases to `ColumnRule<TRow>[]` |
| R2 | libs/table/src/columns-schema/rules.ts:6-20 | — | yes — read; `applyVisible` returns `void`, doc comment states static visibility never goes through the schema |
| R3 | libs/table/src/columns-schema/metadata.ts:33-47 | — | yes — read; `metadata()` returns `void`, records through `recorderOf(path)`; uses `NoInfer<T>` |
| R4 | libs/table/src/schema/run.ts:13-21 | — | yes — read; `runRecordedSchema` builds the path, calls `fn`, discards its return, returns `session.rules` |
| R5 | libs/table/src/api/types.ts:122-131 | — | yes — read; `ColumnValues`' fallback arm is `C['id'] extends keyof TRow ? TRow[C['id']] : unknown` |
| R6 | libs/table/src/api/features/with-filtering/feature.ts:14, 30-32 | — | yes — read; `schema?: (path: FiltersPath<TRow>) => S`, `S extends Record<string, AnyRule>`, member type is `StateOf<S>` |
| R7 | libs/table/src/engine/filters/types.ts:61-91 | — | yes — read; phantom `__criterion`/`__row`, `CriterionOf<R> = R extends FilterRule<infer C> ? C : never`; key stamped from the schema object's property name |
| R8 | libs/table/src/engine/columns.ts:143-177 | — | yes — read; `foldColumnRules` calls `entry.result()` per entry per fold and rebuilds `ColumnDef` objects |
| R9 | libs/table/src/engine/cells.ts:22-49 | — | yes — read; `readAccessor`/`buildDataCells` stamp `RenderRow.cells` from `column.accessor` |
| R10 | libs/table/docs/decisions/grouping.md (G61, G62, G68, G69, G70) | — | yes — read; two authoring forms permanent, sorting gains a recording-form schema |
| R11 | libs/table/docs/1-state/work/core/active/single-value-source/design-create-columns.md | — | yes — read; `ColumnBuilder<TRow>` overloads, probe P5b (standalone `columnSchema()` as arg 3) |
| R12 | libs/table/src/engine/columns.ts:48-62 | — | yes — read; `resolveColumnDefs` applies `(row) => row[def.id]` as the documented default accessor |
