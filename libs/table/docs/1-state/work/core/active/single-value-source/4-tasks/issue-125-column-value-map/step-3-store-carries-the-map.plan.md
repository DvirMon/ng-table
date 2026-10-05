# Step 3 — The store shape carries the map

**PR scope:** standalone. **Depends on:** Step 1 (`ColumnValueMap`,
`ColumnIdIn` and `ColumnValues` must exist before anything can be typed
against them).
**Parallel-safe with:** Step 2 — that spec asserts `ColumnValues` directly
and never touches the store.

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/api/types.ts` (edit)
- `libs/table/src/engine/types.ts` (edit)
- `libs/table/src/api/create-table.spec.ts` (edit)

## Why This Step Exists

#113 gave `TableStore` a second type parameter, `TId extends string`, and
threaded it into `columns`. That parameter carries the _id union_ and
nothing else — there is no slot on the store for the value behind each id,
and no way to add one without a carrier, because `columns` only ever
mentions `keyof TValues & string` and nothing infers a map from a `keyof`.

This step replaces that parameter with the map itself and recovers the
union from it. The trade is deliberate: one parameter carrying strictly
more information, rather than two parameters that can disagree. `TId`
stays derivable as `ColumnIdIn<TValues>`, so `ColumnIdOf<S>` and
everything #113 built keep working with no edit.

No feature config changes here and no consumer reads the map — the map
does not even reach a feature slot until Step 4 regenerates the overloads.
That is deliberate, so this step's diff is reviewable as a type-parameter
swap rather than as a migration.

## What To Do

**1. `api/types.ts` — `TableStore` carries `TValues`.**

```ts
export interface TableStore<TRow, TValues extends ColumnValueMap = ColumnValueMap> {
  readonly columns: WritableView<
    ColumnDef<TRow, ColumnIdIn<TValues>>[],
    ColumnsUpdater<TRow, ColumnIdIn<TValues>>
  >;
  // …every other member unchanged

  /** Phantom. `TValues` is otherwise unrecoverable: `columns` carries only
   * `keyof TValues & string`, and nothing infers a map from a `keyof`. Read by
   * `ColumnValuesOf<S>`. Precedent: `FilterRule.__criterion` / `__row`
   * (`engine/filters/types.ts:61-73`). */
  readonly __columnValues?: TValues;
}
```

**2. `engine/types.ts` — `TableCore` the same way.** Both `columns` and
`baseColumns` re-key to `ColumnIdIn<TValues>`; `TableCore` takes the same
phantom, for the same reason.

**3. `api/types.ts` — `TableConfig` takes the declaration, not the map.**

```ts
export interface TableConfig<
  TRow,
  TCols extends readonly ColumnDefInput<TRow, string>[] = readonly ColumnDefInput<TRow, string>[],
> {
  trackBy: TrackByConfig<TRow>;
  columns: TCols;
  columnsSchema?: ColumnsSchemaFn<TRow, ColumnIdIn<ColumnValues<TRow, TCols>>> | ColumnSchema<TRow>;
  injector?: Injector;
}
```

The asymmetry — `TCols` on the config, `TValues` on the store — is the
point, and the comment must say so: **`TCols` is what a call site can
infer, `TValues` is what downstream reads.** Deriving at the config
boundary is what keeps #113's id-union inference working for a plain
array; a `TValues`-on-the-config shape would have nothing to infer from
(you cannot infer `T` from a `keyof T` position) and every un-helped array
would fall back to the constraint, silently losing the literal union that
#113 shipped.

**4. `engine/types.ts` — add `ColumnValuesOf<S>` beside `ColumnIdOf<S>`.**
`ColumnIdOf` itself is **unchanged**: it reads structurally off `columns`,
so it recovers `ColumnIdIn<TValues>` with no edit at all. Confirm that by
reading it, not by editing it.

`ColumnValuesOf` recovers the map off the phantom. See Risks below — the
naive spelling is wrong.

**5. `Shape` stays `{ rows: Signal<readonly unknown[]> }`.** Settled at
#113 Step 1 and unchanged here: do not add a `columns` or `__columnValues`
carrier to it. At a real call site `In` is bound to the concrete
`TableStore<TRow, TValues> & O1 & …`, which carries both structurally; the
fallback arms exist for the narrowed-to-`Shape` case only.

**6. `api/create-table.spec.ts` — re-parameterize the one probe.**
`withReversibleSort<TId extends string = string>(): Feature<TableStore<Row, TId>, …>`
(around `:62`) is the only non-generated two-argument `TableStore<>`
reference in the repo. It becomes
`<TValues extends ColumnValueMap = ColumnValueMap>`. Its existing comment
explains why it is generic at all — so the feature stays assignable to any
`createTable()` slot's inferred id union — and should be updated to say
"value map" instead.

## Implementation Notes

- **Defaulted, so the diff is additive.** Every one-argument
  `TableStore<Row>` / `TableCore<TRow>` reference across the lib, the
  directives and the stories resolves to `TValues = ColumnValueMap`, whose
  `ColumnIdIn` is `string` — byte-for-byte what they get today. If one of
  them fails to compile, the parameter was threaded into a member that
  should not have it.
- **`ColumnIdIn<ColumnValueMap>` must be exactly `string`.** That identity
  is what makes the default harmless; check it with a one-line probe before
  chasing any downstream error.
- **The phantom is optional and never assigned.** It exists only as an
  inference channel. Nothing in `engine/core.ts` or anywhere else should
  produce a value for it — if the implementation feels the need to, the
  recovery type is wrong, not the runtime.
- **Do not widen `ColumnsUpdater` or the write path.** A `readonly`
  constraint lives on `createColumns`' parameter, not on `columns`' own
  type. `setColumns`, `reorderColumns` and `ColumnsUpdater` are untouched
  precisely because the map rides in the phantom rather than in the
  `columns` member's type.

## Risks / Watchouts

- **`ColumnValuesOf<S>`'s naive spelling matches every object type.**
  `S extends { readonly __columnValues?: infer V } ? V : never` succeeds
  against _any_ object, because the member is optional — a store without
  the phantom infers `V = unknown` and the `never` arm is unreachable. The
  recovery must constrain the result back to `ColumnValueMap` and fall back
  to `ColumnValueMap` — **not** `never` — so a partial store or a test
  double keeps behaving like today's `string` id space. Verify both arms
  with a probe (`ColumnValuesOf<TableStore<Row, {a: number}>>` and
  `ColumnValuesOf<{ rows: Signal<Row[]> }>`); do not assume either.
- **`ColumnsSchemaStore<TRow>` (`columns-schema/types.ts`)** declares
  `baseColumns: Signal<ColumnDef<TRow>[]>` and is satisfied structurally by
  `TableCore`. With `TValues` defaulted, `ColumnDef<TRow, ColumnIdIn<TValues>>[]`
  stays assignable to `ColumnDef<TRow, string>[]`. Leave that interface
  alone — same call as #113 Step 1; widening it here would pull the wiring
  into this step's scope for no gain.
- **`src/stories/**/fixtures/schema.ts`uses`satisfies TableConfig<DealRow>`.**
That now defaults `TCols` to the widened array type — which is what the
  annotation already produced, and the fixture's own comment already says
  so. Confirm the stories still compile; **do not migrate them**.
- **Do not touch `create-table.overloads.ts` or
  `compose-features.overloads.ts`.** Both are generated; Step 4 owns them,
  and `npm run table:overloads:check` must still be clean at the end of
  this step.
- **`api/types.ts` ↔ `engine/types.ts` is a deliberate type-only import
  cycle.** Both sides must stay `import type`; `engine/types.ts` importing
  `ColumnValueMap` / `ColumnIdIn` from `api/types.ts` is fine as a type
  import and breaks the build as a value import.
- **`ngc` aborts at the first `.ts` error and never reaches the template
  phase.** Fix, re-run, and only the source-clean second run says anything
  about the story templates
  (`.claude/rules/typecheck-angular-templates.md`).

## Non-Goals

- **No feature config changes.** `withGrouping`, `withFiltering` and
  `withSorting` keep their current signatures —
  [#115](https://github.com/DvirMon/ng-table/issues/115),
  [#100](https://github.com/DvirMon/ng-table/issues/100) and the grouping
  retrofit own those.
- **No runtime change.** Nothing in this step emits code.
- **No generated file edited.** Step 4 regenerates them.
- **No spec beyond the one probe repair.** The guard is Step 5's, and it
  cannot assert the map off a store until Step 4 puts `TValues` in the
  return type.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` clean, **run twice** — the second
      run is the one that covers the story templates.
- [ ] `nx run shared-table:typecheck-spec` clean.
- [ ] `npm run table:overloads:check` still clean — this step must not
      have made the generated files drift.
- [ ] `ColumnIdOf<S>` is unchanged in `git diff`.
- [ ] `ColumnValuesOf<S>`'s fallback arm verified by probe, both
      directions.
- [ ] `git diff --stat` shows exactly three files changed.

---

← [Step 2: The capture guard](step-2-capture-guard.plan.md) | [Step 4: The generator carries the map into every slot](step-4-generator-carries-the-map.plan.md) →
