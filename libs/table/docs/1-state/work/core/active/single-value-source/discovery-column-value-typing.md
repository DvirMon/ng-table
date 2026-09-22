# How do typed table and form libraries carry a per-column/per-field value type from a declaration into downstream id-keyed declarations?

**Date:** 2026-09-21 · **Depth:** standard

## Answer

**No surveyed table library carries a per-column value type past the columns array — all three erase it
at the array boundary** (`ColumnDef<TData, any>[]` [S5], `readonly GridColDef<R>[]` [S17],
`ColDef<TData = any, TValue = any>` [S14]). The per-column type only lives inside one column's own
literal, which is exactly why `createColumnHelper` exists: a helper call per column is the only place
TanStack can infer `TValue` and feed it back into that column's `cell`/`meta` [S2][S3]. Even there it
never reaches `filterFn`/`sortingFn`/`aggregationFn` — those are typed `<TData>` only, and `Row.getValue`
is `<TValue>(columnId: string) => TValue`, a caller-supplied assertion [S7][S8][S9][S10].

**The libraries that do deliver a declared-key → value-type map all switched the declaration to an object
keyed by the identifier** (Drizzle `pgTable(name, {...})` + `BuildColumns` mapped type [S20][S21]; Zod
`object<T>(shape: T)` [S23]; Kysely, a hand-written interface [S22]). Angular Signal Forms is the same
mapped-type-over-keys shape, just over `keyof TModel` rather than declared ids [S12].

**For an array that must keep declaration order, the mechanism that actually works is a tuple-shaped
constraint** — Zod ships it publicly in `discriminatedUnion<Types extends readonly [X, ...X[]]>` [S24],
which infers a tuple from a plain inline array with no `as const` and no `const` modifier. Its one hard
limit is documented by TypeScript itself: literal/tuple inference "only affects … expressions that were
written within the call", so a hoisted `const columns = [...]` is already widened before the call sees
it [S25].

## Method

- Versions pinned: `@tanstack/table-core@8.21.3` (explicit pin — registry latest is **9.2.4** [S1], and v9
  ships no `src/`, so every v8 source read below is under the 8.21.3 pin); `@angular/forms@22.1.2` (read
  from `node_modules`, **not** registry latest); `ag-grid-community@36.2.0`; `@mui/x-data-grid@9.14.0`;
  `drizzle-orm@0.45.2` (registry [S18]); `zod@4.4.3` (installed, transitive via `@angular/forms`);
  `ts-pattern@5.9.0` (registry [S28]).
- How read: unpkg `src/` + `dist/types/` fetches for published packages; `node_modules` reads for
  `@angular/forms` and `zod`; AG Grid docs at the `b36.2.0` tag as `.mdoc`. All 2026-09-21.
- Reliability: the AG Grid, MUI and TanStack claims come from **type declarations**, which is the right
  artifact here — the prose docs for all three are silent on value-type flow. TanStack's own column-defs
  guide says `createColumnHelper` gives "the highest type-safety possible" and then says nothing about
  what is or is not inferred [S11] — a qualified claim, not a mechanism statement.

## Evidence

### 1. TanStack Table v8 — inferred at the helper call, erased at the array

- `ColumnHelper<TData>.accessor` infers `TValue` from the accessor argument: an `AccessorFn<TData, infer
  TReturn>` yields `TReturn`; a `DeepKeys<TData>` string yields `DeepValue<TData, TAccessor>` [S2].
- The return type is a *conditional* on the same argument — `AccessorFnColumnDef<TData, TValue>` vs
  `AccessorKeyColumnDef<TData, TValue>` — so the helper is doing two jobs: inferring the value and picking
  the column kind [S2].
- `DeepKeys` / `DeepValue` are recursive path types with a hard **depth cap of 5** (`TDepth['length']
  extends 5 ? never`), plus a 40-element `ComputeRange` used to bound tuple index inference [S4]. This is
  the only place in the library where inference cost is nontrivial.
- **The type dies at the options boundary:** `CoreOptions<TData>.columns: ColumnDef<TData, any>[]` — `any`,
  explicitly [S5]. `_getColumnDefs()` returns `ColumnDef<TData, unknown>[]` and
  `getAllColumns()` returns `Column<TData, unknown>[]` [S5].
- `createColumn<TData, TValue>` keeps `TValue` in its signature but "uses `CoreColumn<TData, any>`
  internally before casting the final return" [S6] — the runtime never has the type.
- **Which slots see `TValue` at all**, from `ColumnDefExtensions<TData, TValue>` [S3]:
  `ColumnFiltersColumnDef<TData>` — **no `TValue`**; `SortingColumnDef<TData>` — **no `TValue`**;
  `GroupingColumnDef<TData, TValue>` — `TValue` reaches `aggregatedCell` only, while `aggregationFn` is
  `AggregationFnOption<TData>` and `getGroupingValue?: (row: TData) => any` [S9].
- So the typed surface is exactly the render/meta templates: `cell`, `footer`, `header`, `meta`,
  `aggregatedCell` [S3][S9]. The *rule* callbacks this repo cares about are all `<TData>`-only:
  `FilterFn<TData>` takes `columnId: string, filterValue: any` [S7]; `SortingFn<TData>` takes
  `(rowA, rowB, columnId: string) => number` [S8]; `AggregationFn<TData>` returns `any` [S9].
- The escape hatch is an unchecked caller assertion: `getValue: <TValue>(columnId: string) => TValue`,
  same for `getUniqueValues` and `renderValue` [S10]. `TValue` here has no constraint and no inference
  source — writing `row.getValue<number>('total')` is `as number` with extra steps.
- `accessorKey: (string & {}) | keyof TData` [S3] — the id/key space is deliberately widened past
  `keyof TData`, i.e. TanStack chose *not* to make the key space the model's key space.

### 2. Angular Signal Forms — a branded path token carrying the value type

- The path proxy's type is a mapped type over the model's keys:
  ```ts
  type SchemaPathTree<TModel, TPathKind extends PathKind = PathKind.Root> =
    (… SchemaPath<TModel, SchemaPathRules.Supported, TPathKind>) &
    (… TModel extends Record<string, any>
      ? { [K in keyof TModel]: MaybeSchemaPathTree<TModel[K], PathKind.Child> }
      : unknown);
  ```
  [S12]
- Each node carries its value type in a **branded phantom slot**, not as a real property:
  ```ts
  type SchemaPath<TValue, TSupportsRules extends SchemaPathRules = SchemaPathRules.Supported,
                  TPathKind extends PathKind = PathKind.Root> = {
    [ɵɵTYPE]: { value: () => TValue; supportsRules: TSupportsRules; pathKind: TPathKind };
  };
  ```
  [S12]
- Every rule recovers `TValue` by inferring it **from the path argument only**, with `NoInfer` blocking the
  callback from contributing an inference candidate:
  ```ts
  declare function validate<TValue, TPathKind extends PathKind = PathKind.Root>(
    path: SchemaPath<TValue, SchemaPathRules.Supported, TPathKind>,
    logic: NoInfer<FieldValidator<TValue, TPathKind>>): void;
  ```
  Same shape for `disabled`, `hidden`, `readonly`, `required`, `metadata`, `apply`, `applyWhen`,
  `applyEach` [S13].
- **Where the analogy breaks:** the key space is `keyof TModel`, so there is no author-declared id to map
  from — a carrier column with no model property has no path to mint. Also the `supportsRules` brand is a
  *second* fact carried in the same token, which is how they express "this path exists but cannot take
  rules" (`CompatSchemaPath` for `AbstractControl` interop) [S12]. That second slot is the transferable
  idea: the brand is a record, not a single type.

### 3. Declared-key → value-type maps outside tables

- **Drizzle** — columns are an **object literal**, inferred as a whole:
  `pgTable<TTableName extends string, TColumnsMap extends Record<string, PgColumnBuilderBase>>(name,
  columns: TColumnsMap, …)` [S21]. The map is then a mapped type over that object's keys:
  ```ts
  type BuildColumns<TTableName, TConfigMap extends Record<string, ColumnBuilderBase>, TDialect> = {
    [Key in keyof TConfigMap]: BuildColumn<TTableName, { _: Omit<TConfigMap[Key]['_'], 'name'> & {
      name: TConfigMap[Key]['_']['name'] extends '' ? Assume<Key, string> : TConfigMap[Key]['_']['name'];
    } }, TDialect>;
  } & {};
  ```
  [S20]
- Drizzle's key→value fact is then consumed everywhere downstream via
  `InferSelectModel<TTable> = InferModelFromColumns<TTable['_']['columns'], 'select', TConfig>` and the
  `readonly $inferSelect` property [S19] — one declaration, every query typed by it.
- Note the **declared-key fallback**: `name: … extends '' ? Assume<Key, string> : …` [S20] — Drizzle lets
  the object key *be* the column name when the builder wasn't given one. That is precisely an
  author-declared id acting as the key space, and it only works because the declaration is an object.
- **Zod** — same shape, generic inferred from an object literal:
  `object<T extends core.$ZodLooseShape = …>(shape?: T, params?) : ZodObject<util.Writeable<T>, core.$strip>`
  [S23]. Keys are author-declared; each key's schema keeps its own type.
- **Kysely** — the key space is a **hand-written TypeScript interface** (`interface Database { person:
  PersonTable; pet: PetTable }`), not inferred from any runtime declaration; "Kysely only deals with types
  in the TypeScript level" [S22]. Zero inference machinery, zero runtime declaration, and the author
  maintains the map by hand.
- **AG Grid** — `ColDef<TData = any, TValue = any>` [S14]; `ValueGetterFunc<TData = any, TValue = any,
  TContext = any>` returns `TValue | null | undefined` [S14]. `TValue` is **written by hand, never
  inferred**: the docs say "Set the cell value type directly on the column definition interface via
  `ColDef<TData, TValue>`", with `ColDef<ICar, number>` as the example, and nowhere state that `TValue`
  derives from `field` [S15]. So AG Grid's per-column value type is an annotation, not a derivation — and
  `field` is a string, `colId` is a separate id used "to identify the column in the API for sorting,
  filtering etc." [S14].
- **MUI X DataGrid** — `GridBaseColDef<R extends GridValidRowModel = GridValidRowModel, V = any, F = V>`
  [S16], so `valueGetter: GridValueGetter<R, V, F>`, `sortComparator: GridComparatorFn<V>` and
  `renderCell` are all typed by `V` *within one column literal*. The grid prop then erases it:
  `columns: readonly GridColDef<R>[]` — `V` and `F` fall back to their `any` defaults [S17].

### 4. Tuple vs object — what each library actually chose

- **Every library that needs the per-key map chose an object.** Drizzle [S21], Zod [S23], Kysely [S22],
  Signal Forms (mapped over `keyof TModel`) [S12]. None of them has an ordering requirement.
- **Every library with an ordered column array gave the map up.** TanStack [S5], MUI X [S17], AG Grid
  (`TValue` never inferred at all) [S15].
- **Nobody surveyed infers a per-key *value* map from an array of declarations.** Searched and not found;
  see **Unverified**.
- **But tuple inference from a plain array *is* shipped in a public API** — Zod's discriminated union keys
  a tuple of schemas by a literal discriminator field:
  ```ts
  declare function discriminatedUnion<
    Types extends readonly [core.$ZodTypeDiscriminable<Disc>, ...core.$ZodTypeDiscriminable<Disc>[]],
    Disc extends string
  >(discriminator: Disc, options: Types, params?): ZodDiscriminatedUnion<Types, Disc>;
  ```
  [S24] The constraint is tuple-shaped (`readonly [X, ...X[]]`), which is what makes TS infer a tuple
  rather than an array — no `as const` at the call site, no `const` modifier. This is the closest shipped
  precedent for keying an ordered array of declarations by a literal field.
- This repo already recovers the *id union* from an array the same way: `ColumnIdOf<S>` matches
  `ColumnDef<any, infer I>[]` [R2], and `createTable`'s overloads infer `TId extends string` from
  `TableConfig<TRow, TId>` [R3]. That works because `TId` is **one** parameter shared by every element —
  a union falls out, a per-element map cannot [R1].

### 5. `const` type parameters (TS 5.0+)

- What it buys, verbatim: adding `const` to a type parameter causes "`const`-like inference to be the
  default", removing the need for callers to write `as const` [S25].
- **Limitation 1 — the constraint must be `readonly`.** `fnBad<const T extends string[]>(["a","b","c"])`
  still infers `string[]`, because the `readonly ["a","b","c"]` candidate isn't assignable to a mutable
  constraint and inference silently falls back to the constraint [S25]. Directly relevant: a
  `ColumnDefInput<TRow>[]` constraint would defeat the modifier; it must be `readonly
  ColumnDefInput<TRow>[]`.
- **Limitation 2 — inline only.** "the `const` modifier only affects inference of object, array and
  primitive expressions that were written within the call, so arguments which wouldn't (or couldn't) be
  modified with `as const` won't see any change in behavior", with the explicit counter-example of a
  hoisted `const arr = ["a","b","c"]` where "'T' is still 'string[]' — the 'const' modifier has no effect
  here" [S25]. **This is exactly the repo's declaration style** (`const columns = [...] satisfies …`).
- **Who ships it in a public API:** `ts-pattern@5.9.0` — `match<const input, output = symbols.unset>` [S26],
  and `.with` in four overloads: `<const p extends Pattern<i>, …>`, `<const p1 …, const p2 …>`,
  `<const p1, const p2, const p3, const ps extends readonly Pattern<i>[], …>`, and the guard form
  `<const pat extends Pattern<i>, pred extends …>` [S27]. Note the `readonly Pattern<i>[]` constraint on
  the rest parameter — Limitation 1 applied correctly.
- Not found in the table libraries: TanStack v8 [S2][S3][S5], AG Grid [S14], MUI X [S16][S17] use no
  `const` type parameters on their column surfaces.

## Comparison

| Axis | TanStack Table@8.21.3 | AG Grid@36.2.0 | MUI X DataGrid@9.14.0 | Signal Forms (@angular/forms@22.1.2) | Drizzle@0.45.2 | Zod@4.4.3 | Kysely |
|---|---|---|---|---|---|---|---|
| Mechanism | per-column helper call infers `TValue` [S2] | hand-written `ColDef<TData, TValue>` [S15] | per-column generic `V` on the literal [S16] | mapped type over `keyof TModel` + branded path token [S12] | generic inferred from object literal + `BuildColumns` mapped type [S20][S21] | generic inferred from object literal [S23] | hand-written interface [S22] |
| Key space | `(string & {}) \| keyof TData` — author-declared [S3] | `colId`, falls back to `field` [S14] | `field: string` [S16] | `keyof TModel` — model-derived [S12] | object keys, falling back to the builder's own name [S20] | object keys [S23] | interface keys [S22] |
| Declaration shape | array of column defs [S5] | array of `ColDef` [S14] | `readonly GridColDef<R>[]` [S17] | the model object's own type [S12] | object literal [S21] | object literal [S23] | interface [S22] |
| Value type survives the collection? | **no** — `ColumnDef<TData, any>[]`, `Column<TData, unknown>[]` [S5] | **no** — `TValue` defaults to `any` and is never inferred [S14][S15] | **no** — `V` defaults to `any` at the prop [S17] | **yes** — every key mapped [S12] | **yes** [S19][S20] | **yes** [S23] | **yes** [S22] |
| Reaches rule callbacks? | filter/sort/aggregate: **no** [S7][S8][S9]; cell/meta/aggregatedCell: yes, in-literal [S3][S9] | `valueGetter`/`comparator` typed only if you annotate [S14][S15] | `valueGetter`/`sortComparator`/`renderCell` typed by `V` in-literal [S16] | yes — `validate`/`disabled`/`required` infer `TValue` from the path, `NoInfer` on the callback [S13] | yes — all queries [S19] | yes | yes |
| Consumer cost | one helper call per column [S2]; `getValue<T>()` assertions downstream [S10] | one explicit type argument per column [S15] | one explicit `V` per column literal [S16] | none (types follow the model) | none beyond writing an object | none | the whole map maintained by hand [S22] |
| Gives up | the array-wide map; recursion capped at depth 5 for `DeepKeys` [S4] | inference entirely | the array-wide map | any key not in the model [S12] | declaration order as a type-level fact | ordering | inference; drift risk |

## Synthesis

- **The array is the erasure point, and everyone knows it.** Three independent table vendors, three
  different type systems, same outcome: the moment column declarations enter a homogeneous array, the
  per-element value type is gone [S5][S17][S14]. TanStack's `createColumnHelper` is not a convenience —
  it is the *only* place a `TValue` exists, and it exists per column literal because the array cannot hold
  it. This directly answers the brief's question 1: yes, the helper-per-column pattern exists precisely
  because the array erases the type.
- **But the helper doesn't buy what this repo needs anyway.** Even inside one TanStack column literal,
  `filterFn`, `sortingFn` and `aggregationFn` are `<TData>`-only [S7][S8][S9]. The value type reaches only
  render templates. So "make the accessor's return type flow" and "make rule callbacks typed" are two
  separate wins, and no table library has taken the second one.
- **Signal Forms and Drizzle disagree with the table vendors, and the disagreement is about the key
  space, not about tuples.** Both get the map for free because the key space *is* a type they already
  have (`keyof TModel`, `keyof TColumnsMap`). The table vendors have an author-declared id union that
  exists only as runtime data. Drizzle's `Assume<Key, string>` fallback [S20] is the proof of concept
  that an author-declared id can be the key space — it just requires the declaration to be an object.
- **Order is the only reason a table can't copy Drizzle.** Drizzle, Zod, Kysely and Signal Forms all have
  unordered key spaces. A column set is ordered, and an object literal's order is a runtime property
  (`Object.keys` insertion order, with integer-like keys hoisted and reordered by the JS spec), not a
  type-level one. Moving to an object would trade a compiler-checked ordering for a convention plus an
  explicit `order` field — which this repo's `ColumnDef` already carries [R1], so the trade is smaller
  here than it looks, but the `'1'`/`'2'` column-id reordering hazard is real.
- **The tuple path is not theoretical — it's just unclaimed by table vendors.** Zod's
  `discriminatedUnion` proves a tuple-shaped constraint keys an ordered array by a literal field in a
  shipped public API [S24], and it needs neither `as const` nor a `const` modifier. What it needs is for
  the array literal to be written *at the call*. That single requirement, not any type-system limit, is
  what decides this design.

## Viable mechanisms for an array-of-column-defs API that must keep declaration order

Ranked by how much of the repo's current call shape survives.

1. **Tuple-shaped constraint + a mapped type keyed by `TCols[number]['id']`.** Constraint must be
   `readonly` [S25] and tuple-shaped (`readonly [ColumnDefInput<TRow>, ...ColumnDefInput<TRow>[]]`), the
   form Zod ships [S24]. Order is preserved because a tuple *is* ordered. Per-id value type comes from a
   conditional extract over the element whose `id` matches. **Blocker:** only fires for an array literal
   written inside the call [S25] — the repo's `const columns = [...] satisfies …` [R1 usage] is hoisted,
   so element types are already widened before `createTable` sees them.
2. **A `defineColumns([...])` wrapper carrying the tuple constraint.** Moves the "written within the call"
   requirement to a call the consumer *does* write inline, so hoisting the result is safe — the tuple is
   already captured in the variable's type. This is `createColumnHelper`'s trick [S2] applied once per
   array instead of once per column, and it is the only mechanism found that keeps the array, keeps the
   order, and keeps the hoisted-variable declaration style. Consumer cost: one wrapper call, and
   `satisfies ColumnDefInput<DealRow>[]` must be dropped (the wrapper's constraint replaces it).
3. **`const` type parameter on `createTable`'s `columns`.** Cheapest to write, and it removes the need for
   `as const` — but **only for inline arrays** [S25], so it does not solve the hoisted case at all. Useful
   as an additive belt on top of (2), not as the mechanism. Precedent: `ts-pattern@5.9.0` [S26][S27].
4. **Per-column helper (`col('owner', r => r.owner.name)`) returning a branded def.** Pins `TValue` per
   column without `as const` [S2]. Insufficient alone — an array of helper calls still infers as
   *array-of-union*, not a tuple, so it must be combined with (2). Pairs naturally with Signal Forms'
   branded-token idea [S12]: brand the def with `{ id, value }` so downstream `path.<id>` lookups read one
   phantom slot instead of re-deriving from the accessor signature.
5. **Object keyed by id.** The only mechanism with universal precedent [S20][S21][S23][S22] and zero
   inference tricks. Costs declaration order as a type-level fact and adds an integer-like-id reordering
   hazard. Viable only if `order` becomes required rather than defaulted from array index [R1].

**Not viable:** deriving the value type from a deep-path string à la `DeepKeys`/`DeepValue` [S4] — it
requires the key space to be `keyof TRow`, which the repo has already rejected (carrier columns like
`total` are not row fields), and it carries a depth-5 cap and a 40-wide tuple range.

## Against

- **Nobody built mechanism (2).** Three table vendors with far more users than this library all stopped at
  "erase it" [S5][S14][S17]. That is either an unclaimed win or a signal that the ergonomic cost —
  a mandatory wrapper call, worse error messages on a 50-column tuple, and a whole class of "why is my
  column type `never`" support questions — outweighs the payoff. Silence from three vendors is one data
  point about convention, not three about correctness, but it is not nothing.
- **AG Grid's answer is "make the consumer write it"** [S15] and AG Grid is the most feature-complete
  enterprise grid surveyed. An explicit per-column type argument is a real option that costs the library
  nothing.
- **TanStack's own escape hatch is an assertion** (`getValue<TValue>(columnId)`) [S10]. If the most
  type-invested headless table ships an unchecked cast as the downstream read, the value of full inference
  downstream may be lower in practice than it looks on paper.

## Not researched

- Compile-time cost measured on a wide (50+) column tuple. No benchmark was run — running one would be a
  build, which is out of scope for this agent. TanStack's depth-5 cap [S4] is evidence that *recursive path*
  inference is the expensive kind; a flat `TCols[number]['id']` extract is non-recursive, but that is an
  inference, not a measurement.
- `@tanstack/table-core@9.2.4` internals. Its `dist/index.d.ts` is a re-export index only; the actual
  declarations live in per-feature `.d.ts` files that were not fetched. Whether v9 changed the
  `columns: ColumnDef<TData, any>[]` erasure is **unknown**.
- Effect Schema and ArkType. Both were in the brief's candidate list and neither was opened.
- MUI X's `groupingValueGetter` (Premium) — not present in `gridColDef.d.ts` [S16]; lives in the premium
  package, not fetched.
- Whether any consumer-facing pain exists around this in the vendors' issue trackers.

## Unverified

- **"No shipped library infers a per-key value map from an array/tuple of declarations."** One web search
  for the pattern returned only general TS tuple-inference articles, no library. This is a *search came up
  empty* result, not a proof of absence. What would confirm it: a grep over a set of popular `.d.ts`
  bundles for a mapped type whose key source is `T[number]['id']`-shaped.
- **What `satisfies ColumnDefInput<DealRow>[]` does to the `id` literal types today.** The contextual type's
  `id` is `TId extends string = string` when instantiated bare [R1], which should widen `'status'` to
  `string` — but this is a reasoned inference about TS widening, not something read out of a spec or
  observed. What would confirm it: a `.types.spec.ts` probe asserting `ColumnIdOf<typeof table>` on a
  hoisted-`satisfies` declaration vs. an inline one. Worth running before choosing between mechanisms
  (1) and (2), because if the union already survives hoisting today, the widening story is more subtle
  than the TS release-note rule suggests.
- Whether a `readonly` tuple constraint conflicts with this repo's `ColumnsUpdater` write path
  (`table.columns.update(...)` targets `ColumnDef<TRow, TId>[]`, mutable [R2]). Not examined.

## Sources

| | Source | Version | Verified |
|---|---|---|---|
| S1 | https://registry.npmjs.org/@tanstack/table-core/latest | 9.2.4 | yes — registry read; forced the explicit 8.21.3 pin below |
| S2 | https://unpkg.com/@tanstack/table-core@8.21.3/src/columnHelper.ts | 8.21.3 | yes — full source read; `ColumnHelper.accessor` conditional inference |
| S3 | https://unpkg.com/@tanstack/table-core@8.21.3/src/types.ts | 8.21.3 | yes — source read; `ColumnDefExtensions` shows filtering/sorting take no `TValue` |
| S4 | https://unpkg.com/@tanstack/table-core@8.21.3/src/utils.ts | 8.21.3 | yes — source read; depth cap 5, `ComputeRange<40>` |
| S5 | https://unpkg.com/@tanstack/table-core@8.21.3/src/core/table.ts | 8.21.3 | yes — source read; **corrected the assumption that `createColumnHelper` preserves the type end-to-end** — `columns: ColumnDef<TData, any>[]` |
| S6 | https://unpkg.com/@tanstack/table-core@8.21.3/src/core/column.ts | 8.21.3 | yes — source read; internal `CoreColumn<TData, any>` + cast |
| S7 | https://unpkg.com/@tanstack/table-core@8.21.3/src/features/ColumnFiltering.ts | 8.21.3 | yes — source read; `ColumnFiltersColumnDef<TData>` has no `TValue` |
| S8 | https://unpkg.com/@tanstack/table-core@8.21.3/src/features/RowSorting.ts | 8.21.3 | yes — source read; `SortingColumnDef<TData>` has no `TValue` |
| S9 | https://unpkg.com/@tanstack/table-core@8.21.3/src/features/ColumnGrouping.ts | 8.21.3 | yes — source read; `aggregationFn` is `<TData>`-only, `getGroupingValue` returns `any` |
| S10 | https://unpkg.com/@tanstack/table-core@8.21.3/src/core/row.ts | 8.21.3 | yes — source read; `getValue: <TValue>(columnId: string) => TValue` is an unchecked caller assertion |
| S11 | https://tanstack.com/table/v8/docs/guide/column-defs | v8 docs (undated) | yes — page read; states "highest type-safety possible" and is **silent** on value-type inference |
| S12 | C:/Users/dmena/git/ng-table/node_modules/@angular/forms/types/_structure-chunk.d.ts (lines 1524-1559) | 22.1.2 | yes — read from node_modules; `SchemaPath` brand + `SchemaPathTree` mapped type |
| S13 | C:/Users/dmena/git/ng-table/node_modules/@angular/forms/types/signals.d.ts (lines 32-313) | 22.1.2 | yes — read; `validate`/`disabled`/`hidden`/`readonly`/`required` all infer `TValue` from the path with `NoInfer` on the logic |
| S14 | https://unpkg.com/ag-grid-community@36.2.0/dist/types/src/entities/colDef.d.ts | 36.2.0 | yes — read; `ColDef<TData = any, TValue = any>`, `ValueGetterFunc<TData, TValue, TContext>` |
| S15 | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/typescript-generics/index.mdoc | b36.2.0 | yes — doc source read; **settled that `TValue` is annotated by hand, never inferred from `field`** |
| S16 | https://unpkg.com/@mui/x-data-grid@9.14.0/models/colDef/gridColDef.d.ts | 9.14.0 | yes — read; `GridBaseColDef<R, V = any, F = V>` |
| S17 | https://unpkg.com/@mui/x-data-grid@9.14.0/models/props/DataGridProps.d.ts | 9.14.0 | yes — read; `columns: readonly GridColDef<R>[]` — `V`/`F` erased to `any` |
| S18 | https://registry.npmjs.org/drizzle-orm/latest | 0.45.2 | yes — registry read |
| S19 | https://unpkg.com/drizzle-orm@0.45.2/table.d.ts | 0.45.2 | yes — read; `InferSelectModel`, `$inferSelect` |
| S20 | https://unpkg.com/drizzle-orm@0.45.2/column-builder.d.ts | 0.45.2 | yes — read; `BuildColumns` mapped type + the `Assume<Key, string>` declared-key fallback |
| S21 | https://unpkg.com/drizzle-orm@0.45.2/pg-core/table.d.ts | 0.45.2 | yes — read; `TColumnsMap extends Record<string, PgColumnBuilderBase>` inferred from an object literal |
| S22 | https://kysely.dev/docs/getting-started | site (undated; `/getting-started/types` 404s) | yes — page read; `Database` interface is hand-written, "Kysely only deals with types in the TypeScript level" |
| S23 | C:/Users/dmena/git/ng-table/node_modules/zod/v4/classic/schemas.d.cts (line 490) | 4.4.3 | yes — read; `object<T extends core.$ZodLooseShape>(shape?: T)` |
| S24 | C:/Users/dmena/git/ng-table/node_modules/zod/v4/classic/schemas.d.cts (line 514) | 4.4.3 | yes — read; tuple-shaped constraint `readonly [X, ...X[]]` keyed by a literal `Disc` — the closest shipped precedent for an ordered array of declarations |
| S25 | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html | TS 5.0 | yes — release notes read; both documented limitations quoted verbatim (mutable constraint fallback; "written within the call") |
| S26 | https://unpkg.com/ts-pattern@5.9.0/dist/match.d.ts | 5.9.0 | yes — read; `match<const input, output = symbols.unset>` |
| S27 | https://unpkg.com/ts-pattern@5.9.0/dist/types/Match.d.ts | 5.9.0 | yes — read; four `.with` overloads using `const` type params, incl. `const ps extends readonly Pattern<i>[]` |
| S28 | https://registry.npmjs.org/ts-pattern/latest | 5.9.0 | yes — registry read |
| R1 | libs/table/src/api/types.ts:83-110 | — | yes — read; `ColumnDef<TRow, TId>` with `accessor: (row: TRow) => unknown`, `ColumnDefInput` |
| R2 | libs/table/src/engine/types.ts:103-105 | — | yes — read; `ColumnIdOf<S>` recovers the id union via `ColumnDef<any, infer I>[]` |
| R3 | libs/table/src/api/create-table.overloads.ts:14-17 | — | yes — read; `<TRow, TId extends string>(… config: TableConfig<TRow, TId>)` |
</content>
</invoke>
