# Step 1 — Shared `valueOf` resolver + `GroupingHandle` value-typing

**PR scope:** standalone, additive — nothing reads the new module yet.
**Depends on:** none (#114, #115, #125 already shipped
`readAccessor`/`ColumnValueMap`). **Parallel-safe with:** none (everything
else in this plan depends on it, except Step 4 and Step 5, which are
independent of it and of each other).

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/engine/resolvers.ts` (new)
- `libs/table/src/api/features/with-grouping/types.ts` (edit)
- `libs/table/src/api/features/with-grouping/schema.ts` (edit)
- `libs/table/src/api/features/with-grouping/feature.ts` (edit —
  `WithGroupingConfig` generic)

## Why This Step Exists

Once a feature reads through the accessor (ADR-0024), a rule callback
holding raw rows has no legal way to read a _different_ declared column's
value — the accessor is the value source and `readAccessor`
(`engine/cells.ts`) is engine-internal. ADR-0027 Rule 3 names this
resolver `valueOf(path, row)` — unbound-tier, since it reads data, not a
declaration. This step builds the one shared primitive both grouping's
`when` (Step 2) and sorting's `sortFn` (Step 3) need, and fixes a latent
gap: `GroupingHandle`/`GroupingPath` (unlike `SortingHandle`/
`FilterHandle`) carry no phantom value type today, so
`ctx.valueOf(path.total, row)` would resolve to `unknown` instead of
`total`'s declared value type.

## What To Do

1. **`engine/resolvers.ts` (new).** Export:

   ```ts
   export interface ValueOfHandle<K extends string = string, V = unknown> {
     readonly id: K;
     /** @internal phantom — the column's resolved value type. */
     readonly __value?: V;
   }

   /** Resolves a declared column's accessor value for one row. Unbound-tier
    * per ADR-0027 Rule 3 — reads data, so it takes a path AND a subject. */
   export interface ValueOfContext<TRow> {
     valueOf<K extends string, V>(handle: ValueOfHandle<K, V>, row: TRow): V;
   }

   /** `columns` is a getter, not a snapshot, matching
    * `FiltersInternal.columns` — `table.columns` is writable, so a context
    * built once must still see a later `setColumns()` write. */
   export function buildValueOfContext<TRow>(
     columns: () => readonly ColumnDef<TRow>[]
   ): ValueOfContext<TRow> { ... }
   ```

   The implementation builds a `Map<string, ColumnDef<TRow>>` from
   `columns()` **on each call** (mirrors `FilterEvaluator`'s
   per-evaluation-not-per-row rebuild — but here there is no single
   "evaluation" object to cache it on, since `valueOf` is called from
   inside consumer callbacks invoked at arbitrary points; a fresh lookup
   per call is correct and matches `readGroupValue`'s existing per-call
   `columnById.get(columnId)` pattern in `engine/grouping/clusters.ts`).
   Reads through `readAccessor(column, row, reportedColumns)`
   (`engine/cells.ts`) — never `column.accessor` directly (ADR-0014). An
   id naming no known column reads `undefined` (matches the existing
   "removed column" degrade pattern elsewhere, e.g. `readGroupValue`'s doc
   comment: "An unknown `columnId` reads `undefined`") — Step 6 adds the
   _construction_-time reject for a genuinely undeclared id; this file's
   own body only handles the "known-at-declare-time, since removed"
   runtime case.
   Needs its own `reportedColumns: Set<string>` for ADR-0014's
   throw-reporting, scoped to the context instance (built fresh per call
   site that needs one — Steps 2/3 each build their own instance rather
   than sharing one across features).

2. **`with-grouping/types.ts`.** Retrofit `GroupingHandle`/`GroupingPath`
   to carry a value type, mirroring `with-sorting/types.ts`'s
   already-shipped `SortingHandle`/`SortingPath` exactly:

   ```ts
   export interface GroupingHandle<TRow, K extends string = string, V = unknown> {
     readonly id: K;
     readonly __value?: V; // new
     readonly [PATH_RECORDER]: PathRecorder<TRow, AnyGroupingRule<TRow>>;
   }

   export type GroupingPath<TRow, TValues extends ColumnValueMap> = {
     readonly [K in ColumnIdIn<TValues>]: GroupingHandle<TRow, K, TValues[K]>;
   };

   export type GroupingSchemaFn<TRow, TValues extends ColumnValueMap> = (
     path: GroupingPath<TRow, TValues>,
   ) => void;
   ```

   This changes `GroupingPath`'s second type parameter from
   `TId extends string` to `TValues extends ColumnValueMap` — a breaking
   rename of the type parameter, not of any consumer-facing call shape
   (`path.foo` access is unchanged). Every declarator signature in
   `schema.ts` that takes `GroupingHandle<TRow, K>` still compiles
   unchanged (`V` defaults to `unknown`).

3. **`with-grouping/schema.ts`.** `buildGroupingPath<TRow, TId extends
string>` becomes `buildGroupingPath<TRow, TValues extends
ColumnValueMap>`, same body — only the generic parameter and its use in
   `GroupingPath<TRow, TValues>`/`createPathProxy` cast change.
   `runGroupingSchemaFn` follows the same substitution.

4. **`with-grouping/feature.ts`.** `WithGroupingConfig<TRow, TId>`'s
   `schema` field and `buildGroupingSpec`'s call to
   `runGroupingSchemaFn<TRow, TId>` currently key by `TId =
ColumnIdIn<TValues>` directly (not by `TValues` itself, unlike
   sorting). Change `WithGroupingConfig` to also carry `TValues extends
ColumnValueMap` (mirroring `WithSortingConfig<TRow, TValues>`) so
   `schema?: GroupingSchemaFn<TRow, TValues>` typechecks. Trace every call
   site of `WithGroupingConfig`/`buildGroupingSpec` in this file (the
   `withGrouping` overloads near the bottom of the file) and thread
   `TValues` through the same way `with-sorting/feature.ts`'s
   `withSorting` overloads already do — copy that pattern exactly, don't
   invent a new one.

## Implementation Notes

- Take the simplest signature first ([[simplest-signature-first]]) —
  `ValueOfHandle`'s generic `<K, V>` on the _method_, not the interface,
  mirrors `FilterValueOfContext.valueOf`'s existing per-call generic
  (`engine/filters/types.ts:34`). Don't add a class or a builder.
- `engine/resolvers.ts` imports only from `engine/cells.ts`
  (`readAccessor`) and `api/types.ts` (`ColumnDef`) — no feature imports,
  matching `engine/`'s existing "nothing here is exported, nothing here
  imports a feature" invariant (`libs/table/CLAUDE.md`).

## Risks / Watchouts

- **`WithGroupingConfig`'s generic-parameter change is the riskiest edit
  in this whole plan.** Every overload of `withGrouping()` and every
  internal helper typed against `WithGroupingConfig<TRow, TId>` must be
  re-checked. Compare line-for-line against `with-sorting/feature.ts`'s
  already-shipped `WithSortingConfig<TRow, TValues>` overloads (#100) —
  that migration solved the identical problem for sorting.
- Don't let `engine/resolvers.ts` import anything from `api/features/*` —
  it must stay feature-agnostic so both grouping (Step 2) and sorting
  (Step 3) can depend on it without a cross-feature import.

## Non-Goals

- No change to `FilterValueOfContext` (Step 4 owns the filtering rename).
- No `stateOf` (Step 5 owns column rules; different context, different
  domain).
- No construction-time "unknown id" throw yet (Step 6).

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` clean.
- [ ] `engine/resolvers.ts` imports nothing from `api/features/*`.
- [ ] `GroupingHandle`/`SortingHandle` have matching shapes (`id`,
      `__value?`, recorder symbol).

---

[Step 2: Grouping `when` reads `ctx.valueOf`](step-2-grouping-when.plan.md) →
