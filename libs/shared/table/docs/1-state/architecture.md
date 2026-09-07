---
title: Architecture — State Layer Feature Specs
type: architecture
version: 0.2
date: 2026-07-19
status: draft — partial (4 of 8 features drilled)
audience: developers
---

# Architecture — State Layer Feature Specs

## Executive Summary

This document indexes the feature-by-feature design of the NGP Table state layer (`createTable()`), continuing from the top-level decisions locked in `overview.md`. Each feature has its own reference file with full detail: state shape, methods, events, `manual` contract, compile-time dependencies, and open questions. **This is an architecture/spec document, not an implementation** — it defines the contract a developer builds against, not the working `signalStoreFeature()` code itself.

**Status: 4 of 8 state layer features fully drilled**, plus the core `columns` config. The remaining 4 features are present as stub files awaiting a future drilling session.

---

## Standing design criterion — general mechanism over enumerated cases (2026-08-12)

Applies to every state-layer decision, not one feature.

**Prefer one general, composable mechanism plus optional defaults, over an API that enumerates
every scenario.** When a cluster of edge cases shows up, the first move is not to add a config flag
per case — it is to ask what single operation they are all instances of, and whether the engine can
expose *that* instead.

This usually means building **more** into the engine, not less. Reaching a mechanism general enough
for consumers to compose against can require reworking engine internals; that is the work, not
something to avoid. The thing being minimized is the *enumerated surface area*, not the engine.

### The reference case — `updateRows`

The row-mutation cluster is the worked example (see
[`work/with-mutations/2-decisions.md`](1-state/work/with-mutations/2-decisions.md), D5–D8). The
scenarios were add, remove, update, duplicate, bulk delete, import, and an open-ended tail. Rather
than shipping a method per scenario, the API is:

```ts
updateRows(table, updater)          // the one general operation
```

with a handful of pure updaters shipped as **convenience, not as the contract** — D19 ships exactly
`insertRow` / `removeRow` / `patchRow`, and explicitly defers `moveRow`, `compose`, and the plural
forms, because a raw lambda covers them until a real caller appears. Duplicate-a-row was never
designed: it falls out as `insertRow({ ...row, id: newId() })`.

The properties that make this work, and that a candidate mechanism should be checked against:

- **One write path**, so there is one place where invariants hold.
- **The extension point is a plain function**, so consumers compose without knowing the engine.
- **Defaults are subtractable** — every shipped updater could be deleted and consumers would still
  be unblocked.
- **Unanticipated cases cost the consumer a lambda**, not a library release.

### Applying it — a hypothesis, not a conclusion

Whether this shape transfers to a given cluster is an open question each time, answered by
attempting it, not assumed.

The live test is the null/empty-row ordering cluster (S1–S9 in
[sorting.md](1-state/features/sorting.md)). Those scenarios span several definitions of "empty",
a cell-level vs row-level split, and three candidate owners — exactly the shape that tempts a flag
per case. The question to try first is whether one general ordering mechanism accepts all of them
as composable rules, with a default or two shipped.

It may not transfer. Some clusters are genuinely better served by the library making the decision
and shipping the complete answer — a general mechanism that no consumer ever extends is cost
without payoff. That outcome is fine; it just has to be reached by trying the general shape first.

This criterion is why the composition rules elsewhere in this document exist (fixed pipeline order,
features declare rather than mutate, one stage per key) — they keep the seams predictable enough
that general mechanisms can be layered on them.

---

## Core Config

| Reference | Status |
|---|---|
| [`columns`](1-state/columns.md) — column definitions, runtime-mutable order/visibility | ✅ Drilled |
| [`columnsSchema`](2-columns/architecture.md) — declarative column schema DX (`apply*` rules) layered on `columns` core config; detail in [`2-columns/reference/`](2-columns/reference/) | 📝 Spec only |

`columnsSchema` can seed the initial state of the two not-yet-drilled `withColumnPinning()` / `withColumnSizing()` features below (via `applyPinned` / `applyWidth`+`applyFlex`) — see [2-columns/reference/tier-2-layout.md](2-columns/reference/tier-2-layout.md).

## Features — Drilled

| Feature | Reference | Summary |
|---|---|---|
| `withSorting()` | [with-sorting.md](1-state/features/sorting.md) | Multi-column, three-state toggle, additive by click order |
| `withGrouping()` | [with-grouping.md](1-state/features/grouping.md) | Single-level, per-column `aggregateFn`; collapse via `withExpansion()` when composed (optional, not required — revised 2026-07-31) |
| `withExpansion()` | [with-expansion.md](1-state/features/expansion.md) | Multi-expand, hierarchical/tree-capable, standalone (no dependencies) |
| `withFiltering()` | [with-filtering.md](1-state/features/filtering.md) | Per-column + global filter, AND combine logic, per-column opt-out |

## Features — Not Yet Drilled

| Feature | Reference | Known from Overview |
|---|---|---|
| `withSelection()` | [with-selection.md](1-state/features/selection.md) | Single public API, internal single/multi composition |
| `withPagination()` | [with-pagination.md](1-state/features/pagination.md) | `{ pageIndex, pageSize, totalRows }` |
| `withInfiniteScroll()` | [with-infinite-scroll.md](1-state/features/infinite-scroll.md) | `{ hasMore, isLoading }` |
| `withDragDrop()` | [with-drag-drop.md](1-state/features/drag-drop.md) | `{ dragState }` |
| `withColumnPinning()` | not yet started | `{ columnPinning: { left: string[]; right: string[] } }` — TanStack-modeled, plus start/center/end region derivation. Seedable via `columnsSchema`'s `applyPinned`. |
| `withColumnSizing()` | not yet started | Per-column resizable width/flex state, only when sizing is runtime-resizable (static width stays column-owned CSS). Seedable via `columnsSchema`'s `applyWidth`/`applyFlex`. |
| `withVirtualScroll()` | [with-virtual-scroll.md](1-state/features/virtual-scroll.md) | Windowed rendering over `renderRows()`; no dependency on grouping/expansion — added 2026-07-31 alongside the `renderRows` render-layer design |

---

## Compile-Time Dependency Graph (current)

```
withGrouping()      ──optionally composes with──▶  withExpansion()  (runtime-detected, not compile-time — revised 2026-07-31)
withVirtualScroll() ──reads──▶                      renderRows() only — no dependency on withGrouping()/withExpansion()
withSorting()       ──reads──▶                      columns (core config, not a feature dependency)
withGrouping()      ──reads──▶                      columns (core config, not a feature dependency)
withFiltering()     ──reads──▶                      columns (core config, not a feature dependency)
withExpansion()     ──requires──▶                   (none — standalone, only global trackBy)
```

> **Retroactive correction:** Earlier session notes described `withSorting()` and `withGrouping()` as having a "compile-time dependency on `withColumns()`." Since then, `columns` was decided to be **core config** (required on every `createTable()` call, like `trackBy`) rather than an opt-in `signalStoreFeature`. There is therefore no feature dependency to declare — these features simply read the always-present `columns` config. See `columns.md` for detail.

> **Revision 2026-07-31:** `withGrouping()`'s dependency on `withExpansion()` was downgraded from a compile-time `type<>` requirement to an optional runtime composition — `withGrouping()` now works standalone (static, non-collapsible groups). See `with-grouping.md`, "Compile-Time Dependencies" and "Render Layer," and `with-expansion.md`, "Dual Use." This was driven by introducing the `renderRows`/`RenderRow<TRow>` render-layer signal, researched against TanStack Table / MUI X DataGrid / AG Grid's row-model designs (see `with-grouping.md`, "Prior art").

## Rejected: inferring `TRow` into `with-*()` calls (tested 2026-08-09)

**Known DX cost, investigated and not fixable within the current composition shape.**

Today every feature call repeats the row type, even though `createTable()` / `createTableSchema()` already know it:

```ts
createTableSchema(columns, {
  features: [withExpansion<Department>(), withSorting<Department>()],
});
```

The tempting fix is to declare `Department` once and have it flow into each feature call. Two approaches were tested against the real code; both fail, for a reason that rules out the whole family.

> **Status update (2026-08-11):** `@ngrx/signals` has been removed (ADR-0003), so the root cause
> described below is gone and the surviving direction at the end of this section is now
> *implementable* — `composeTable()` builds core before folding features, so a real
> `TableCore<TRow>` exists to pass and no phantom placeholder is needed. It remains deliberately
> deferred; see ADR-0003, "Deferred: `features: (ctx) => [...]`". Approaches 1 and 2 below are kept
> as the record of why the contextual-typing family was abandoned — do not re-run them.

### What was tried

**1. Tighten the `Features` constraint so it contextually types each array element.**

```ts
Features extends readonly ((store: TableStore<NoInfer<TRow>>) => any)[]
```

The idea: a type parameter's constraint acts as the contextual type for the argument expression, so each `withExpansion()` would infer its own `TRow` from the expected return type — while `Features` still infers from the literal array, keeping each element's precise return type intact for [`ComposedFeatureMembers`](../../api/types.ts).

**This half is sound.** Verified against simplified stand-in types with exact-type assertions (`Equals<Department, Parameters<typeof table.toggleExpanded>[0]>`) plus negative cases that must error. Constraints do contextually type elements, and they do not widen them. So the "would it destroy the reconstructed method types?" fear is unfounded — that is *not* what blocks this.

**2. Reshape the carrier to match what features actually accept.**

Attempt 1 failed on assignability:

```
Type 'TableStore<NoInfer<Person>>' is not assignable to type
'InnerSignalStore<{ columns: ColumnDef<Person>[]; }, { _pipeline: PipelineStages<Person>; }, {}>'
```

Features take `@ngrx/signals`' `InnerSignalStore`, not our `TableStore`. Parameter types are contravariant, so the carrier must satisfy everything each feature demands — the tightened constraint rejected even the annotated `withSorting<Person>()` that compiles today.

Rebuilding the carrier in `InnerSignalStore`'s shape then failed on:

```
Property '[STATE_SOURCE]' is missing in type 'TableFeatureInput<Person>'
```

`@ngrx/signals` brands its store with a unique symbol. Satisfying it means reconstructing ngrx internals in our own types — the exact coupling the `AnyTableFeature` comment exists to avoid.

### Why the whole family is ruled out

Independent of assignability: in attempt 2 the unannotated `withExpansion()` still resolved to `Signal<unknown[]>`. The carrier was in place and `TRow` was **still not pushed down**.

`withExpansion` returns `SignalStoreFeature<Input, Output>`, whose parameter is `InnerSignalStore<…>` — a conditional/mapped type. TypeScript does not infer through those, so there is no inference site for `TRow` to land in. No carrier shape fixes this, because the problem isn't the carrier.

**Conclusion: `TRow` cannot reach a feature call through an expected type. It can only arrive as an actual argument.**

### What remains open

The one surviving direction is Signal Forms' schema shape — features receive a value carrying `TRow`, so inference happens from an argument rather than a contextual type:

```ts
features: (ctx) => [withExpansion(ctx), withSorting(ctx)]
```

`ctx` is typed `TableStore<Department>`, so each call infers from its argument — the most reliable inference path in the language — and features stay top-level imports, so tree-shaking survives (unlike a `f.expansion()` registry object, which bundles every feature into every consumer).

~~Unresolved: features compose at store-class build time, so no store instance exists to pass. This needs a phantom typed placeholder, the way Signal Forms' `schemaPath` is a proxy that exists only to carry types.~~ **Resolved 2026-08-11** — `composeTable()` builds `TableCore<TRow>` before folding features, so `ctx` can be the real core object. No placeholder needed.

Until it lands, repeating `<TRow>` per feature stands as an accepted cost. Do not re-run approach 1 or 2 — they are settled.

**Superseding direction (2026-08-09), landed 2026-08-11:** the root cause was `@ngrx/signals`' feature types, so removing that dependency dissolved this problem outright — and that move had independent justification (Angular upgrades gated on ngrx releases; a peer dependency is an adoption tax if this ships as a standalone primitive library). Delivered as [ADR-0003](../adr/0003-in-house-table-store-engine.md); intake ticket in [`work/drop-ngrx-engine/1-ticket.md`](work/drop-ngrx-engine/1-ticket.md).

**Why the `TRow` fix still hasn't shipped.** It is now possible but was deferred with the migration, for reasons independent of ngrx: `features: (t) => [...]` builds every spec inside one expression, so the feature-to-feature seam (`composed`) is always empty at factory time — a capability the new engine deliberately kept. Its gains are DX plus one real correctness win (a mismatched `withExpansion<Person>()` on a `Department` table currently compiles; under `ctx` it could not be expressed). Tree-shaking is unaffected either way — both shapes import features top-level. Revisit when a second feature actually wants another feature's state.

## Cross-Cutting Open Questions (span multiple features)

These were flagged during drilling as needing resolution before the remaining 4 features can be safely specced, since they involve two or more features at once:

- [x] ~~**PRIORITY — `renderRows` single-occupancy blocks feature combination.**~~ — resolved 2026-09-03 by [ADR-0011](../adr/0011-chained-render-stages.md) (accepted): `renderRows` single-claim is replaced by an ordered, multi-claim `RENDER_ORDER` stage chain over `RenderRow[]`, mirroring `PIPELINE_ORDER`. `SlotRegistry.claimRenderRows()` is deleted; collision moves to per-named-stage. Unblocks `withGrouping()`, `withPagination()` and `withSelection()` drilling. `withVirtualScroll()` was never blocked — it reads `renderRows()` and declares nothing. The competing "merge the two builders into one" sketch in `features/grouping.md` was considered and rejected in that ADR. `withExpansion()` migrated to claim the `'tree'` stage.
- [ ] **`withPagination()` vs `withInfiniteScroll()`** — mutually exclusive in practice. Hard compile-time conflict, or documented convention only?
- [x] ~~**`withSelection()` "select all" scope**~~ — resolved 2026-09-06 by D1 (`work/with-selection/2-decisions.md`): **there is no scope concept.** `withSelection()` stores `RowId`s only; no `scope: 'page' | 'filtered' | 'all'` config and no per-call scope argument. "Select all" is the call site passing the id set it means (`table.rows().map(r => r.id)`, a server-supplied list, whatever), so the feature has **no runtime or compile-time dependency on `withPagination()` / `withFiltering()`**. The audit's #1 sentiment finding is that no competitor resolved this cleanly — AG Grid encodes it after the fact in a 16-value event `source` enum, MRT leaks it as a `forceAll` handler flag — so refusing the denominator is how we lead rather than inherit it. The generalized rule: reject config whose meaning depends on state the feature does not own; accept config that parameterizes a verb it does own.
- **Convention for any id-keyed feature — declare `onRowsRemoved`** ([ADR-0006](../adr/0006-row-id-state-reconciliation.md)). Not an open question; recorded here because this is the list a new feature's drilling session reads. A feature storing `RowId`s must declare the hook and prune with `pruneByIds()` (`engine/rows.ts`), or it silently retains dead ids until someone deletes a row and notices. Not enforced by the type system. Exemptions are per slice and belong to the feature — `everExpanded` (additive ledger) and `detached` restore points are the two that exist. `withSelection()` declares it with no exemption (D11), and its pruning is deliberately **silent**: reconciliation is not a write verb, so it emits no `selectionChanged`.
- [ ] **`withDragDrop()` vs active sort** — does drag-reorder require sort to be cleared, or does it no-op silently while a sort is active?
- [x] ~~**`withGrouping()` aggregation vs `withFiltering()`**~~ — resolved 2026-07-31: `aggregateFn` runs over filtered rows. The `group` pipeline stage clusters after `filter` (fixed order `filter → group → sort → expand`), so `aggregateFn` never sees unfiltered rows. See `with-grouping.md`, "Render Layer."

## Feature-Specific Open Questions

See each reference file's own "Open Questions" section for issues local to that feature (e.g. sort auto-detection algorithm, expansion lazy-load loading state, group node data shape).

---

## Next Steps

- [ ] Resolve the remaining cross-cutting open questions above before drilling `withPagination()`, `withInfiniteScroll()`, `withDragDrop()`. Two of the five are resolved: the `renderRows` single-occupancy question (ADR-0011) and the selection-scope question (D1). `withSelection()` is drilled — spec at `work/with-selection/3-spec.md`.
- [ ] Drill remaining 4 features, one at a time, same process as this session.
- [ ] Regenerate this index (bump version) once all 8 features + `columns` are complete.
- [ ] Proceed to UI/directive layer spec only after full state layer sign-off.

---

**Generated by:** Claude Project Spec Interview
**Last Updated:** 2026-07-19

---

## Competitive position

**Verdict: ahead** — [ADR-0006](../adr/0006-row-id-state-reconciliation.md)'s diff-and-prune
row-removal reconciliation has no documented equivalent in any of the four; none of them documents
a generalized "notify every feature when rows disappear" hook.

Assessed 2026-09-05 against TanStack Table v8, AG Grid, Material React Table,
and PrimeNG. Full reasoning: [gap-analysis.md](./work/state-feature-competitive-audit/gap-analysis.md).
