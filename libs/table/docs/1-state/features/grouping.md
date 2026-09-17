---
title: State Layer Reference — withGrouping()
type: architecture
version: 1.2
date: 2026-09-13
capability: grouping
spec: drilled
code: partial
audience: developers
parent: ../architecture.md
---

# withGrouping()

> **⚠️ Two sections superseded — D1–D17 all settled and shipped (issues #7, #24, #25, #26, #31),
> except the two items `2-decisions.md`'s Open section leaves deliberately unbuilt.**
> [work/with-grouping/2-decisions.md](../work/grouping/archive/with-grouping/2-decisions.md) (D1–D17) settles the
> API surface, and [work/with-grouping/3-spec.md](../work/grouping/archive/with-grouping/3-spec.md) (`status: ready`)
> writes it up as a contract. Superseded here:
> - **Methods** — `setGrouping()`/`clearGrouping()` never shipped. The real write surface is
>   `table.grouping.update(updater)` with pure updater factories in `mutations/update-grouping.ts`
>   (D1) — `setGroupLevels`/`addGroupLevel`/`removeGroupLevel`/`reorderGroupLevels`. On top of that,
>   `table.grouping` folds an optional `groupingRule`/`rules`-array/schema-fn overlay over that base
>   value — `applyGrouping()`/`applyGroupingAsync()` declarative sugar (D6–D8, issue #26), the
>   schema fn reached through `config.schema` since #84. Cluster
>   order is `groupOrder` on `withGrouping()`'s config (D4, issue #24) — omitted, stable
>   first-occurrence order; supplied, orders siblings within a parent by their contents, fully
>   decoupled from `sorting` (D5). Full contract: 3-spec.md's own Methods section — not restated
>   here.
> - **Single-level only** — wrong. `withGrouping()` ships multi-level clustering. `grouping` is
>   `string[]`, ordered, index 0 = outermost level (D3), with aggregation computed at every depth
>   from that cluster's own leaves, never a descendant's already-computed aggregate (D9). Grand
>   totals and pivoting stay out of scope (D9).
> - **Group selection has no cascade** — `rowsOf(group)` (D16, issue #31) returns every leaf row
>   beneath a header, at any depth; the consumer owns any selection cascade. A group's row count is
>   `rowsOf(group).length` — there is no separate count field on `RenderRow`.
> - **`groupIds` publishes every header id (issue #97)** — `table.groupIds(): Signal<RowId[]>`
>   returns every group header's id, at every level, collapse-independent (derives from the
>   cluster tree, not `renderRows()`). `[]` when ungrouped. It's what `expandAll(table.groupIds())`
>   uses to open every level in one call, since expansion's own discovery only walks real data rows.
>
> - **`groupingLevels`/`isGroupedBy` publish the column↔level relation (issue #81)** —
>   `table.groupingLevels(): Signal<ColumnDef<TRow>[]>` is the current levels as full `ColumnDef`s,
>   ordered outermost first; `table.isGroupedBy(columnId): boolean` is the O(1) inverse membership
>   check. Both derive from the same resolved level list `grouping()`/`renderRows()` already use,
>   so a level naming no known column is dropped from both, never from just one. A dynamic
>   group-by panel (chip strip + per-column toggle row) reads both directly instead of hand-rolling
>   the `grouping()` ↔ `columns()` join itself.
>
> - **Collapse/expand shipped, `withGrouping()` has zero knowledge of it (#99, ADR-0017)** —
>   `withGrouping()`'s render stage emits every cluster member unconditionally, each carrying its
>   parent's id. Collapsing a group id omits its descendants from `renderRows()` via the
>   engine-owned `'prune'` render stage, which unions every composed feature's `expandedRows`
>   contribution; the header itself always still renders. `rowsOf(group)` stays correct under
>   collapse (D17, issue #25) — it re-derives the cluster tree from `rows()` (pipeline output)
>   rather than scanning `renderRows()`.
>
> - **Clusters admit by default; `when` (#85) can leave one flat.** Every built cluster
>   renders as a group unless `config.when` rejects it — a table-wide predicate over that
>   cluster's own contents. A rejected cluster's rows exit the grouping tree entirely (no header,
>   no group id, no aggregates, not sub-clustered by a deeper level) and render flat at the
>   parent's depth. Full contract: 3-spec.md's Public surface; mechanism and rejected alternatives:
>   [work/with-grouping/design-group-admission.md](../work/grouping/archive/with-grouping/design-group-admission.md).
>
> Still open, deliberately unbuilt: `manual: true` and routing a header click to `groupOrder` — see
> `2-decisions.md`'s Open section. Neither blocks the rest of this contract.

## Executive Summary

Multi-level grouping (`table.grouping: string[]`, D3) with per-column aggregate computation, resolved from a base value optionally overlaid by a declarative `groupingRule`/rules-array/schema-fn (D6–D8, issue #26). Group collapse/expand state is deliberately delegated to `withExpansion()` rather than duplicated — but `withExpansion()` is an optional composition, not a hard requirement (see Compile-Time Dependencies, decided 2026-07-31).

## State Shape

See [3-spec.md](../work/grouping/archive/with-grouping/3-spec.md) for the current contract —
`table.grouping: WritableView<string[], GroupingUpdater<TRow>>`, folding a base value with an
optional `groupingRule`/`rules`/schema-fn overlay (D6–D8). Not restated here.

## Behavior

- **Multi-level, ordered.** `grouping: string[]` — index 0 is the outermost level; aggregation runs at every depth from that cluster's own leaves, never a descendant's already-computed aggregate (D9). See 3-spec.md.
- **Collapse/expand:** group rows are treated as rows with an id; when `withExpansion()` is also composed, its `expandedRows: Set<id>` tracks whether a given group is expanded or collapsed, and the engine-owned `'prune'` render stage (ADR-0017) hides a group's descendants when its id is missing from that set. `withGrouping()` does not maintain its own collapse state, and its render stage does not read `expandedRows` at all (#99) — it emits every cluster member unconditionally and lets the prune stage decide.
- **Static grouping (no `withExpansion()`):** valid standalone use. All group rows render flat/always-expanded — no collapse affordance exists without `withExpansion()` composed.
- **UI-layer split:** the store-level optionality above is only half the story — the template layer needs its own opt-in. Group row rendering is wrapped with an expand directive/template outlet only when the consumer chooses to (e.g. an `*ngpExpandableRow`-style directive reading/toggling `expandedRows`). Store never dictates template structure; it only exposes `expandedRows` for that directive to consume when present. This split (store composition + template composition, independently opt-in) is the actual mechanism behind "expansion is optional" — not a single switch.
- **Aggregation:** per-column `aggregateFn(rows)` computes a summary value per group per column. The store recomputes this reactively whenever group membership changes (data, grouping, or filters change). This is purely a computed value — it defines *what* the aggregate is, not how/where it's rendered (that's UI-layer/template concern).
- **No per-column opt-out** — every column can be grouped by; there is no `enableGrouping` flag (explicitly decided against, unlike `enableSorting`/`enableFiltering`).

## Methods

`setGrouping()`/`clearGrouping()` never shipped. See [3-spec.md](../work/grouping/archive/with-grouping/3-spec.md)'s
Methods section for the real write surface — `table.grouping.update(updater)`, the
`mutations/update-grouping.ts` updater factories, and the `groupingRule`/`applyGrouping()`/
`applyGroupingAsync()` declarative overlay (D6–D8, issue #26). Not restated here.

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

- **`withExpansion()`** — **optional, not required** (revised 2026-07-31; supersedes the original "must fail to compile without it" framing). `withGrouping()` composes standalone for static grouping, with zero knowledge of expansion (#99) — no lazy read, no guard, no argument-order dependency at runtime. When `withExpansion()` is also composed, group rows gain collapse/expand entirely through the engine-owned `'prune'` render stage (ADR-0017), which unions every feature's `expandedRows` contribution centrally.
- Reads `aggregateFn` from core `columns` config directly (no feature dependency — see `columns.md`; retroactively corrected from an earlier "depends on `withColumns()`" framing).

## Pipeline Stage: Clustering, Not Tree-Building

**Resolved 2026-07-31** (was an open question — see research summary below). The `group` pipeline stage stays `TRow[] => TRow[]`, matching `PipelineStages<TRow>`'s existing signature (`engine/pipeline.ts`) — **no breaking change** to the stage contract `withSorting()` (#4) already relies on.

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

`withGrouping()` claims the `'group'` render stage (`withExpansion()` claims `'tree'`, leaving
`'group'` free — [ADR-0011](../../adr/0011-chained-render-stages.md)).

`withGrouping()` claims the `'group'` render stage to walk the clustered `rows()`, insert a `kind: 'group'` header at each cluster boundary — `id` synthesized as e.g. `` `group:${columnId}:${value}` ``, `aggregates` computed via each column's `aggregateFn` over that cluster's rows — and stamps every header and leaf with its parent's id, emitting the full tree unconditionally (#99). Omitting a cluster's member rows when its group id isn't expanded is no longer this stage's concern: the engine-owned `'prune'` render stage (ADR-0017) does that centrally, over the unioned `expandedRows` from every contributing feature. This is why `withExpansion()`'s `expandedRows: Set<RowId>` transparently covers group ids alongside real row ids (see `with-expansion.md`, Dual Use).

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
- [x] ~~Whether a row sort disturbs group order~~ — **it does, answered on screen 2026-09-14.**
  `PIPELINE_ORDER` is `filter → group → sort → expand`, and the `'group'` render stage re-clusters
  the **sorted** rows, so with no `groupOrder` supplied, first-occurrence group order follows the
  sort. Rows *within* a group stay contiguous and undisturbed; the headers reorder. So D5's
  decoupling of grouping from sorting is **`groupOrder`-only** — supply one to pin group order
  across sort changes. `grouping-collapsible/` carries an on-canvas notice stating this; pipeline
  verification is tracked in issue #8.

## Competitive position

**Verdict: shipped** — see the banner above for what's built (D1–D17) vs. deliberately deferred
(`manual: true`, header-click routing to `groupOrder`).

> **Scope sentence corrected 2026-09-10.** This paragraph previously read "the single-level scope
> **deliberately** sidesteps TanStack's unresolved depth-0 aggregation-correctness bug by not
> attempting depth at all in v1 — do not 'fix' the scope by adding arbitrary depth." **D9 did
> exactly that**, and deliberately: full multi-level ships. The reasoning that produced the old
> sentence was that TanStack's depth bug came from depth itself; re-examined, it comes from its
> `Row`-wrapper row-model architecture, which this codebase does not share. D9's two invariants —
> aggregates always compute over a cluster's own **leaf** rows, never over a child cluster's
> already-computed aggregate, and `groupOrder` orders siblings within a parent — are what actually
> close that bug class, and they hold at any depth. Grand totals and pivoting remain out of scope.

Full reasoning: [gap-analysis.md](../work/meta/archive/state-feature-competitive-audit/gap-analysis.md).
