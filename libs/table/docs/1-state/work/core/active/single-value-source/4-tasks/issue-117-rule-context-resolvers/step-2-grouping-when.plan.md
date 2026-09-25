# Step 2 — Grouping: `when` reads `ctx.valueOf`

**PR scope:** standalone. **Depends on:** Step 1. **Parallel-safe with:**
Step 3, Step 4, Step 5.

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/api/types.ts` (edit — `GroupWhen<TRow>`)
- `libs/table/src/engine/grouping/clusters.ts` (edit —
  `evaluateGroupWhen`, `admitClusters`)
- `libs/table/src/engine/grouping/pipeline.ts` (edit — `clusterRows`
  builds+passes ctx)
- `libs/table/src/engine/grouping/render.ts` (edit — its `admitClusters`
  call site, ~line 185)

## Why This Step Exists

Grouping's `when` receives a `ClusterSummary` carrying `columnId`, `key`
and raw rows. The cluster's own key is already accessor-resolved (free);
a plain row field is free (real row objects); what has no spelling is
reading a *different* column's value — the carrier-column case this
epic (#110) introduces. ADR-0027 Rule 3 + the issue's own acceptance
criteria require widening `when`'s arity additively — every existing
one-argument `when` must keep typechecking untouched (TypeScript allows a
narrower-arity function where a wider one is expected, so this is a pure
widening, not a migration).

## What To Do

1. **`api/types.ts`.**
   `export type GroupWhen<TRow> = (cluster: ClusterSummary<TRow>, ctx: ValueOfContext<TRow>) => boolean;`
   Import `ValueOfContext` from `../engine/resolvers` (Step 1).
   `ClusterSummary<TRow>` itself is **unchanged** — still exactly
   `{ columnId, key, rows }` (issue AC: "`ClusterSummary` still carries
   exactly `columnId`, `key` and `rows`" — the resolver lives on `ctx`,
   never on the summary, per ADR-0027 Rule 3's `ClusterSummary`-never-
   carries-the-resolver ruling).

2. **`engine/grouping/clusters.ts`.**
   - `evaluateGroupWhen<TRow>(predicate, summary, columnId,
     reportedColumns, ctx: ValueOfContext<TRow>)` — add the `ctx`
     parameter, call `predicate(summary, ctx)`.
   - `admitClusters<T, TRow>(nodes, when, toRows, reportedColumns,
     columnWhen, columns: () => readonly ColumnDef<TRow>[])` — add a
     trailing `columns` parameter (needed to build the context), build
     `const ctx = buildValueOfContext(columns);` **once per
     `admitClusters` call** (not once per node — matches the existing
     "built once per evaluator instance" discipline elsewhere in this
     codebase), pass `ctx` into both `evaluateGroupWhen` calls. Recurse
     it into the recursive `admitClusters(node.children, ...)` call,
     passing the same `columns`/`ctx` through (don't rebuild `ctx` per
     recursion level).

3. **`engine/grouping/pipeline.ts`.** `clusterRows` already receives
   `columns: ColumnDef<TRow>[]` — pass it straight through to
   `admitClusters(nodes, opts?.when, ..., columns)`.

4. **`engine/grouping/render.ts`.** Same edit at its own
   `admitClusters(nodes, opts?.when, toRows, new Set(), opts?.columnWhen)`
   call (~line 185) — it already has `columns: ColumnDef<TRow>[]` in
   scope (its own parameter, ~line 166). Pass it through identically.
   This is the "two walks, one value" symmetry the workspace
   `decisions.md` risk section calls out — the pipeline stage and the
   render stage must resolve `ctx.valueOf` identically.

## Implementation Notes

- Build `ctx` from the **same** `columns` array both call sites already
  thread through — do not introduce a second `ColumnDef[] →
  ValueOfContext` construction path.
- A consumer `when` reading `ctx.valueOf(path.margin, cluster.rows[0])`
  per the issue's own example — this is the shape a runtime spec
  (Step 7) exercises.

## Risks / Watchouts

- `admitClusters` recurses on `node.children` — make sure `columns`/`ctx`
  flow into every recursive call, not just the top-level one, or a
  nested level's `when` silently gets a stale or missing context.

## Non-Goals

- No change to `columnWhen`'s type — it's already `GroupWhen<TRow>`, so
  it picks up the new arity for free.
- No change to `sortClusters`/`GroupOrder` — `groupOrder` is not in this
  issue's scope (its own two-row subject already has no "different
  column" gap the same way `when` does — out of scope per the issue
  body, which only lists grouping's `when` and sorting's `sortFn`).

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` clean.
- [ ] `ClusterSummary` in `api/types.ts` is unchanged (`columnId`, `key`,
      `rows` only).
- [ ] `admitClusters`'s recursive call passes `columns` through.

---
← [Step 1: Shared `valueOf` resolver](step-1-valueof-resolver.plan.md) | [Step 3: Sorting `sortFn` reads `ctx.valueOf`](step-3-sorting-sortfn.plan.md) →
