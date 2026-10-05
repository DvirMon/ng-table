# Step 3 — Sorting: `sortFn` comparator reads `ctx.valueOf`

**PR scope:** standalone. **Depends on:** Step 1. **Parallel-safe with:**
Step 2, Step 4, Step 5.

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/api/features/with-sorting/schema.ts` (edit —
  `sortFn`'s `compare` type)
- `libs/table/src/api/features/with-sorting/feature.ts` (edit —
  `guardCompare`, `sortRows`)

## Why This Step Exists

#100's own Step 1 plan explicitly deferred this: _"No `ctx` argument to
the comparator. `ctx.valueOf(path.x, row)` is #117's; this step only
supplies the `path`."_ #100 shipped `sortFn(path, compare)` with
`compare: (a: TRow, b: TRow) => number` unchanged. This step is exactly
that deferred widening — the workspace `decisions.md` (R6/S1 note)
already ruled that no new `withSorting` API is needed: the schema fn's
own `path` parameter is already in scope via closure inside the
comparator; only the comparator's own signature needs the `ctx`
parameter added.

## What To Do

1. **`with-sorting/schema.ts`.** `sortFn`'s `compare` parameter type
   becomes `compare: (a: TRow, b: TRow, ctx: ValueOfContext<TRow>) =>
number` (import `ValueOfContext` from `../../../engine/resolvers`,
   Step 1). The recorded `SortFnRule.comparator` field type (in
   `with-sorting/types.ts`) follows the same widening. This is additive:
   an existing 2-argument comparator `(a, b) => a - b` still satisfies
   the new 3-argument type (TypeScript allows a function of fewer
   declared parameters to satisfy a type expecting more).

2. **`with-sorting/feature.ts`.**
   - `guardCompare<TRow>(compare, columnId, reportedColumns)` returns
     `(a: TRow, b: TRow) => number` today — it must return a function
     taking `ctx` too, or build `ctx` inside `sortRows` and call
     `compare(a, b, ctx)` directly inside the guarded closure. Prefer:
     widen `guardCompare`'s returned closure to `(a, b, ctx) => { try {
return compare(a, b, ctx) } catch {...} }` and have `sortRows` pass
     `ctx` at each call site.
   - `sortRows<TRow>(rows, rules, columns, nullsByColumn,
compareByColumn)` — build `const ctx =
buildValueOfContext<TRow>(() => columns);` **once per `sortRows`
     call** (it is already called once per pipeline evaluation, matching
     the "once per evaluator instance" discipline). Thread `ctx` into
     every `compare(a, b, ctx)` call inside the `comparators` `flatMap`
     closure (the returned `(a, b) => number` closures at line ~215 must
     close over `ctx` and pass it to the guarded `compare`).

## Implementation Notes

- `columns` is already a plain array parameter to `sortRows` (not a
  getter) — `buildValueOfContext` expects `() => readonly
ColumnDef<TRow>[]`, so wrap it: `() => columns`.
- Keep `detectComparator`'s auto-detected fallback comparator untouched —
  it never reads `ctx` and doesn't need to.

## Risks / Watchouts

- `sortRows`'s `comparators` array is built once per call, outside the
  `.sort()` callback, for performance — build `ctx` at that same outer
  scope, not inside the inner per-comparison closure, to avoid
  rebuilding the column map on every pairwise comparison.

## Non-Goals

- No change to `sortNulls`/`sortable` — neither reads a different
  column's value.
- No change to `withSorting`'s public config shape — confirmed
  unnecessary by #100's own plan and the workspace decisions log.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` clean.
- [ ] A 2-argument `sortFn` comparator (no `ctx` param) still typechecks
      unchanged.

---

← [Step 2: Grouping `when` reads `ctx.valueOf`](step-2-grouping-when.plan.md) | [Step 4: Filtering rename to `criterionOf`](step-4-filtering-criterionof-rename.plan.md) →
