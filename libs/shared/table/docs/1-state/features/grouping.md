---
title: State Layer Reference — withGrouping()
type: architecture
version: 1.0
date: 2026-07-19
capability: grouping
spec: drafted
code: none
audience: developers
parent: ../architecture.md
---

# withGrouping()

## Executive Summary

Single-level grouping (one active group-by column at a time) with per-column aggregate computation. Group collapse/expand state is deliberately delegated to `withExpansion()` rather than duplicated — but `withExpansion()` is an optional composition, not a hard requirement (see Compile-Time Dependencies, decided 2026-07-31).

## State Shape

```ts
interface GroupingState {
  grouping: string | null;   // single column id, or null = no grouping active
}
```

> Note: this diverges from the `string[]` shape originally sketched in `overview.md` (which anticipated possible multi-level nesting). This session confirmed **single-level only** — the shape is corrected here to `string | null`.

## Behavior

- **Single-level only** — one group-by column active at a time. No nested/hierarchical multi-level grouping.
- **Collapse/expand:** group rows are treated as rows with an id; when `withExpansion()` is also composed, its `expandedRows: Set<id>` tracks whether a given group is expanded or collapsed. `withGrouping()` does not maintain its own collapse state.
- **Static grouping (no `withExpansion()`):** valid standalone use. All group rows render flat/always-expanded — no collapse affordance exists without `withExpansion()` in the feature list.
- **UI-layer split:** the store-level optionality above is only half the story — the template layer needs its own opt-in. Group row rendering is wrapped with an expand directive/template outlet only when the consumer chooses to (e.g. an `*ngpExpandableRow`-style directive reading/toggling `expandedRows`). Store never dictates template structure; it only exposes `expandedRows` for that directive to consume when present. This split (store composition + template composition, independently opt-in) is the actual mechanism behind "expansion is optional" — not a single switch.
- **Aggregation:** per-column `aggregateFn(rows)` computes a summary value per group per column. The store recomputes this reactively whenever group membership changes (data, grouping, or filters change). This is purely a computed value — it defines *what* the aggregate is, not how/where it's rendered (that's UI-layer/template concern).
- **No per-column opt-out** — every column can be grouped by; there is no `enableGrouping` flag (explicitly decided against, unlike `enableSorting`/`enableFiltering`).

## Methods

| Method | Description |
|---|---|
| `setGrouping(columnId: string \| null)` | Set (or clear, via `null`) the active group-by column |
| `clearGrouping()` | Convenience method equivalent to `setGrouping(null)` |

## `manual` Contract

```ts
withGrouping({ manual: true })
```

- State updates normally on `setGrouping`.
- Pipeline **skips the client-side grouping stage**.
- `groupChanged` event fires; consumer's own `effect()` fetches pre-grouped data from the server and writes it into their own `data` signal.
- Consistent with `withSorting()`'s manual contract.

## Aggregation Contract

```ts
interface ColumnDef {
  aggregateFn?: (rows: Row[]) => unknown;
}
```

- Chosen over: (a) no aggregation at all (consumer computes manually, more boilerplate/reactivity work for them), and (b) fixed built-in aggregates only (count/sum/avg — less flexible).
- Store owns recomputation/reactivity; consumer owns the aggregation logic itself — same division of responsibility as `sortFn`.

## Compile-Time Dependencies

- **`withExpansion()`** — **optional, not required** (revised 2026-07-31; supersedes the original "must fail to compile without it" framing). `withGrouping()` composes standalone for static grouping. When `withExpansion()` is also in `features: []`, group rows gain collapse/expand via its `expandedRows` set — detected at runtime (e.g. an optional prop/method check), not enforced via a `type<>` compile-time contract.
- Reads `aggregateFn` from core `columns` config directly (no feature dependency — see `columns.md`; retroactively corrected from an earlier "depends on `withColumns()`" framing).

## Pipeline Stage: Clustering, Not Tree-Building

**Resolved 2026-07-31** (was an open question — see research summary below). The `group` pipeline stage stays `TRow[] => TRow[]`, matching `PipelineStages<TRow>`'s existing signature (`engine/pipeline.ts`) — **no breaking change** to the stage contract `withSorting()` (#3) already relies on.

`group` performs **stable clustering**: same-key rows are gathered into contiguous runs, order otherwise preserved. `sort` (running after `group`, per the fixed `filter → group → sort → expand` order) then sorts *within* each cluster — a stable sort keeps clusters contiguous, so no coordination is needed between the two stages beyond ordering.

```ts
group: (rows) => clusterByKey(rows, grouping(), columns())
```

Group *headers* and *aggregates* are not produced here — they're synthesized downstream by the render layer (below), which is also where filtering-before-grouping resolves cleanly: `aggregateFn` always receives post-filter, pre-render-flatten rows, since clustering runs after the `filter` stage.

## Render Layer: `renderRows`

Introduces a second, render-oriented signal on the core store (`api/create-table.ts`), additive to — not replacing — `rows: Signal<TRow[]>`:

```ts
// api/types.ts
interface RenderRow<TRow> {
  readonly id: RowId;
  readonly depth: number;              // 0 for flat/ungrouped
  readonly kind: 'row' | 'group';
  readonly data: TRow | null;          // null only for kind: 'group'
  readonly groupKey?: { columnId: string; value: unknown };
  readonly aggregates?: Record<string, unknown>;
  readonly isExpanded?: boolean;       // only meaningful if withExpansion() composed
  readonly hasChildren?: boolean;
}
```

`store.renderRows: Signal<RenderRow<TRow>[]>` is always present on the core store, degenerating to a 1:1 wrap of `rows()` (`{ kind: 'row', depth: 0, data: row, id: trackBy(row) }`) when no grouping is composed — **zero behavior change for every table shipped before this feature**.

> **Blocker resolved 2026-09-03 — [ADR-0011](../../adr/0011-chained-render-stages.md) (accepted,
> implemented).** From 2026-08-11 (ADR-0003) until then, `renderRows` was a single-occupancy slot
> and `withExpansion()` already claimed it, so `withGrouping()` could not be composed alongside
> expansion. This doc previously proposed merging the two render-row builders into one; **that
> option was rejected** in ADR-0011 as an enumerated fix (every new reshaping feature would edit
> one shared function). Instead the engine now has an ordered, multi-claim `RENDER_ORDER` chain
> over `RenderRow[]`, mirroring `PIPELINE_ORDER` — `withExpansion()` already migrated to claim the
> `'tree'` stage, leaving `'group'` free. `withGrouping()` claims `'group'` once built; tree
> children will move to `withTree()`'s `'tree'` stage under
> [ADR-0012](../../adr/0012-split-expansion-into-panel-and-tree.md) (`proposed`, not yet
> implemented).

`withGrouping()` claims the `'group'` render stage to walk the clustered `rows()`, insert a `kind: 'group'` header at each cluster boundary — `id` synthesized as e.g. `` `group:${columnId}:${value}` ``, `aggregates` computed via each column's `aggregateFn` over that cluster's rows — and, when `withExpansion()` is also composed, check `store.expandedRows?.()` (optional read) to omit a cluster's member rows if its group id isn't in the set. This is why `withExpansion()`'s `expandedRows: Set<RowId>` transparently covers group ids alongside real row ids (see `with-expansion.md`, Dual Use).

**Consumer split:** logic-layer code (exports, `effect()`s, `aggregateFn` inputs, anything not rendering) reads `rows()` — pure `TRow[]`, unaffected by grouping/collapse. UI-layer/template/virtual-scroll code reads `renderRows()` — flattened, collapse-aware, ready to slice for virtualization. Neither `withVirtualScroll()` (future) nor template directives need to know grouping exists; they only ever consume `renderRows()`.

### Prior art informing this design

Researched against three popular table libraries before locking this shape:

- **TanStack Table** — single `Row<TData>` wrapper for every row (leaf or group), composed via mixins, `subRows`/`getIsGrouped()` distinguish structurally. ([Row Models Guide](https://tanstack.com/table/v8/docs/guide/row-models))
- **MUI X DataGrid** — tree kept fully separate from data: `GridTreeNode = GridLeafNode | GridGroupNode | ...` (discriminated union, keyed by `type`) references row ids; actual `TData` stays in a flat id-keyed lookup, untouched. ([source](https://github.com/mui/mui-x/blob/master/packages/x-data-grid/src/models/gridRows.ts))
- **AG Grid** — same separation: tree/grouping structure is a derived layer over flat data; `rowNode.rowIndex` is `null` unless the row survived the current filter+collapse pass — index is never stored, only assigned during a flatten/visible-rows walk. ([Row Overview](https://www.ag-grid.com/javascript-data-grid/row-interface/))

`renderRows` follows the MUI/AG-Grid separation (keeps `rows: Signal<TRow[]>` untouched, matching our "expansion is optional" decision) rather than TanStack's always-wrap approach, which would have forced every consumer — including ungrouped tables — to unwrap `.original`.

## Events Owned

- `groupChanged` — fires on every grouping state change.

## Open Questions

- [x] ~~Precise data shape for "group node" objects~~ — resolved above via `RenderRow<TRow>` + `renderRows`.
- [x] ~~Whether/how grouping interacts with active filters~~ — resolved: `aggregateFn` receives post-filter rows, since `group` clustering runs after the `filter` stage.

## Competitive position

**Verdict: missing** — spec drafted, zero code: no `withGrouping()`, no `aggregateFn` consumption, no `'group'` pipeline/render stage claimed though both slots are reserved; the single-level scope **deliberately** sidesteps TanStack's unresolved depth-0 aggregation-correctness bug by not attempting depth at all in v1 — do not "fix" the scope by adding arbitrary depth.

Assessed 2026-09-05 against TanStack Table v8, AG Grid, Material React Table,
and PrimeNG. Full reasoning: [gap-analysis.md](../work/state-feature-competitive-audit/gap-analysis.md).
