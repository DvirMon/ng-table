---
title: Architecture — State Layer Feature Specs
type: architecture
version: 0.4
date: 2026-09-09
status: draft — partial (4 of 8 features drilled, 1 superseded mid-grill)
audience: developers
---

# Architecture — State Layer Feature Specs

## Executive Summary

This document indexes the feature-by-feature design of the NGP Table state layer (`createTable()`), continuing from the top-level decisions locked in `overview.md`. Each feature has its own reference file with full detail: state shape, methods, events, `manual` contract, compile-time dependencies, and open questions. **This is an architecture/spec document, not an implementation** — it defines the contract a developer builds against, not the working `composeTable()` / `TableFeatureSpec` code itself.

The remaining undrilled features are present as stub files awaiting a future drilling session.

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
[`work/row-editing/archive/with-mutations/2-decisions.md`](work/row-editing/archive/with-mutations/2-decisions.md), D5–D8). The
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
[sorting.md](features/sorting.md)). Those scenarios span several definitions of "empty",
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
| [`columns`](columns.md) — column definitions, runtime-mutable order/visibility | ✅ Drilled |
| [`createColumns`'s schema argument](../2-columns/architecture.md) — declarative column schema DX (bare-named rules, e.g. `visible`/`sortNulls`/`grouping`) layered on `columns` core config; detail in [`2-columns/reference/`](../2-columns/reference/) | 📝 Spec only |

`createColumns`'s schema argument can seed the initial state of the two not-yet-drilled `withColumnPinning()` / `withColumnSizing()` features below (via `applyPinned` / `applyWidth`+`applyFlex`) — see [2-columns/reference/tier-2-layout.md](../2-columns/reference/tier-2-layout.md).

## Features — Drilled

| Feature | Reference | Summary |
|---|---|---|
| `withSorting()` | [with-sorting.md](features/sorting.md) | Multi-column, three-state toggle, additive by click order |
| `withGrouping()` | [with-grouping.md](features/grouping.md) | Single-level, `aggregate` declared through `schema`; collapse via `withExpansion()` when composed (optional, not required — revised 2026-07-31) |
| `withExpansion()` | [with-expansion.md](features/expansion.md) | Multi-expand, hierarchical/tree-capable, standalone (no dependencies) |
| `withFiltering()` | [with-filtering.md](features/filtering.md) | ⚠️ Superseded (2026-09-09) — imperative `setColumnFilter()`/`setGlobalFilter()` design walked back mid-grill; redirected to a standalone `createFilters()` primitive, see [work/with-filtering/design-options-hybrid-api.md](work/with-filtering/design-options-hybrid-api.md) |
| `withSelection()` | [with-selection.md](features/selection.md) | Flat id set, no scope concept (D1); single-select is a rule on the write verbs via `enableMultiRowSelection`, never stored mode state (D2); standalone (no dependencies) |

## Features — Not Yet Drilled

| Feature | Reference | Known from Overview |
|---|---|---|
| `withPagination()` | [with-pagination.md](features/pagination.md) | `{ pageIndex, pageSize, totalRows }` |
| `withInfiniteScroll()` | [with-infinite-scroll.md](features/infinite-scroll.md) | `{ hasMore, isLoading }` |
| `withDragDrop()` | [with-drag-drop.md](features/drag-drop.md) | `{ dragState }` |
| `withColumnPinning()` | not yet started | `{ columnPinning: { left: string[]; right: string[] } }` — TanStack-modeled, plus start/center/end region derivation. Seedable via `createColumns`'s schema argument's `applyPinned`. |
| `withColumnSizing()` | not yet started | Per-column resizable width/flex state, only when sizing is runtime-resizable (static width stays column-owned CSS). Seedable via `createColumns`'s schema argument's `applyWidth`/`applyFlex`. |
| `withVirtualScroll()` | [with-virtual-scroll.md](features/virtual-scroll.md) | Windowed rendering over `renderRows()`; no dependency on grouping/expansion — added 2026-07-31 alongside the `renderRows` render-layer design |

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

## Composition: argument order sets member visibility, not execution order

Features are trailing positional arguments to `createTable()`. No feature call carries a row
type — it is inferred from `data` and recovered inside the feature as `RowOf<In>`:

```ts
createTable(
  this.departments,
  { trackBy: 'id', columns },
  withExpansion(),
  withSorting(),
);
```

Three rules govern what a feature can see, and they are easy to conflate:

**1. The base store is built before the fold.** `composeTable()` builds core first, then folds
features left to right, handing each one the store *as accumulated so far*. A feature sees the
core members plus every feature to its **left**, and none to its right.

**2. Member visibility follows argument order. Pipeline execution order does not.** The pipeline
runs in `PIPELINE_ORDER` (`filter → group → sort → expand`) regardless of how the consumer
ordered the arguments. Reordering arguments changes what each feature can *read*; it never
changes what runs when.

**3. Types are stricter than runtime.** The store is one shared object reference, so a read
deferred into a computed or a method sees every feature, including ones declared later. The type
of slot N, however, is the base store plus only the preceding slots — a trailing `withComputed()`
block reading `s.expandedRows` off the accumulated `In` type is typed only when `withExpansion()`
precedes it, even though the runtime store would have the member either way (D25). `withGrouping()`
was the worked example for this rule before #99/ADR-0017: it used to read `composed['expandedRows']`
as a lazy guarded read inside its group render stage. That read is gone — `withGrouping()` now
composes with zero knowledge of expansion, in any argument order, and collapse/expand visibility
is entirely `engine/flatten.ts`'s `flattenVisible` walk's job — the only function in `src` that
reads `expandedRows` (ADR-0023, #107; it replaced the engine-owned `'prune'` render stage ADR-0017
had introduced). Writing the compile-time-legal order
is still the convention for any future feature that reads a later slot's member off the shared
store reference; the guard exists because the runtime cannot enforce it.

The type-level arity cap is 15 features; nest a `composeFeatures(...)` composite into one slot to
go past it.

### History: inferring `TRow` into `with-*()` calls (tested 2026-08-09, shipped 2026-09)

This section previously recorded row-type inference as rejected, then as deferred. It shipped on
#33, by positional composition rather than by the `features: (ctx) => [...]` shape explored here.
[ADR-0003](../adr/0003-in-house-table-store-engine.md)'s 2026-09 amendment owns the reasoning —
what shipped, by which mechanism, and why the functional surface made it typable. Not restated
here.

What survives is the blocker that sent the engine in-house, because
[ADR-0003](../adr/0003-in-house-table-store-engine.md)'s context depends on it:

**`TRow` could not reach a feature call through an expected type under `@ngrx/signals`.** Two
approaches were tested against the real code in 2026-08 and both failed. Tightening the `Features`
constraint so it contextually types each array element is sound in isolation — constraints do
contextually type elements and do not widen them — but features took ngrx's `InnerSignalStore`,
not our `TableStore`. Parameter types are contravariant, so the carrier had to satisfy everything
every feature demanded, and the tightened constraint rejected even the explicitly annotated
sorting call that compiled at the time. Rebuilding the carrier in `InnerSignalStore`'s
shape then failed on ngrx's `[STATE_SOURCE]` brand — reconstructing ngrx internals in our own
types, the exact coupling `AnyTableFeature` exists to avoid.

Independent of assignability: an unannotated `withExpansion()` still resolved to
`Signal<unknown[]>` with the carrier in place. `SignalStoreFeature<Input, Output>`'s parameter is
a conditional/mapped type, and TypeScript does not infer through those, so there was no inference
site for `TRow` to land in. No carrier shape fixes that — the problem was not the carrier.

Removing `@ngrx/signals` (ADR-0003) dissolved the root cause, and that move had independent
justification: Angular upgrades gated on ngrx releases, and a peer dependency is an adoption tax
if this ships as a standalone primitive library. Intake ticket in
[`work/drop-ngrx-engine/1-ticket.md`](work/drop-ngrx-engine/1-ticket.md). Do not re-run the two
approaches above — they are settled, and the ngrx types they failed against are gone.

## Cross-Cutting Open Questions (span multiple features)

These were flagged during drilling as needing resolution before the remaining 4 features can be safely specced, since they involve two or more features at once:

- [x] ~~**PRIORITY — `renderRows` single-occupancy blocks feature combination.**~~ — resolved 2026-09-03 by [ADR-0011](../adr/0011-chained-render-stages.md) (accepted): `renderRows` single-claim is replaced by an ordered, multi-claim `RENDER_ORDER` stage chain over `RenderRow[]`, mirroring `PIPELINE_ORDER`. `SlotRegistry.claimRenderRows()` is deleted; collision moves to per-named-stage. Unblocks `withGrouping()`, `withPagination()` and `withSelection()` drilling. `withVirtualScroll()` was never blocked — it reads `renderRows()` and declares nothing. The competing "merge the two builders into one" sketch in `features/grouping.md` was considered and rejected in that ADR. `withExpansion()` migrated to claim the `'tree'` stage.
- [ ] **`withPagination()` vs `withInfiniteScroll()`** — mutually exclusive in practice. Hard compile-time conflict, or documented convention only?
- [x] ~~**`withSelection()` "select all" scope**~~ — resolved 2026-09-06 by D1 (`work/with-selection/2-decisions.md`): **there is no scope concept.** `withSelection()` stores `RowId`s only; no `scope: 'page' | 'filtered' | 'all'` config and no per-call scope argument. "Select all" is the call site passing the id set it means (`table.rows().map(r => r.id)`, a server-supplied list, whatever), so the feature has **no runtime or compile-time dependency on `withPagination()` / `withFiltering()`**. The audit's #2 sentiment finding is that no competitor resolved this cleanly — AG Grid encodes it after the fact in a 16-value event `source` enum, MRT leaks it as a `forceAll` handler flag — so refusing the denominator is how we lead rather than inherit it. The generalized rule: reject config whose meaning depends on state the feature does not own; accept config that parameterizes a verb it does own.
- **Convention for any id-keyed feature — declare `onRowsRemoved`** ([ADR-0006](../adr/0006-row-id-state-reconciliation.md)). Not an open question; recorded here because this is the list a new feature's drilling session reads. A feature storing `RowId`s must declare the hook and prune with `pruneByIds()` (`engine/rows.ts`), or it silently retains dead ids until someone deletes a row and notices. Not enforced by the type system. Exemptions are per slice and belong to the feature — `everExpanded` (additive ledger) and `op: 'delete'` restore points are the two that exist. `withSelection()` declares it with no exemption (D11), and its pruning is deliberately **silent**: reconciliation is not a write verb, so it emits no `selectionChanged`.
- [ ] **`withDragDrop()` vs active sort** — does drag-reorder require sort to be cleared, or does it no-op silently while a sort is active?
- [ ] **`withDragDrop()` vs `withGrouping()`** — dropping an ungrouped row onto a group assigns it that group; dropping a row across groups needs a configurable block/allow; dragging a whole group onto another group (bulk-reassigning its rows) is a separate opt-in. Config shape undecided. **Constraint (settled, not open):** the two features must not read each other's state or API directly — an engine-owned mechanism mediates, same precedent as [ADR-0017](../adr/0017-engine-owned-descendant-prune.md)'s expansion/grouping decoupling.
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

---

## Competitive position

**Verdict: ahead** — [ADR-0006](../adr/0006-row-id-state-reconciliation.md)'s diff-and-prune
row-removal reconciliation has no documented equivalent in any of the four; none of them documents
a generalized "notify every feature when rows disappear" hook.

Full reasoning: [gap-analysis.md](./work/meta/archive/state-feature-competitive-audit/gap-analysis.md).
