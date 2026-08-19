---
title: State Layer Reference — withExpansion()
type: architecture
version: 1.1
date: 2026-08-07
status: shipped — `everExpanded` specced, not yet implemented
audience: developers
parent: ../1-state/architecture.md
---

# withExpansion()

## Executive Summary

Multi-expand, hierarchical/tree-capable row expansion. Standalone feature with no compile-time dependencies — used both for detail-row expansion and (via delegation) group collapse/expand state in `withGrouping()`.

## State Shape

```ts
interface ExpansionState {
  expandedRows: Set<RowId>;   // any number of rows can be expanded simultaneously
  everExpanded: Set<RowId>;   // additive-only: every id that has been expanded at least once
}

interface Row {
  id: RowId;
  children?: Row[];   // optional — enables hierarchical/tree-style nesting
}
```

## Config

```ts
interface WithExpansionConfig<TRow> {
  childrenAccessor?: (row: TRow) => TRow[] | undefined;
}
```

`childrenAccessor` reads a row's nested children. Defaults to `(row) => (row as { children?: TRow[] }).children` — pass a custom accessor when children live under a different key. No `manual` config — see `2-decisions.md`; the `manual` contract below described no actual behavior difference from the default, so nothing exists for it to toggle.

## Behavior

- **Hierarchical/tree support:** rows may carry a `children: Row[]` property; expanding a row reveals its nested children recursively (tree-grid style), not just a flat detail panel.
- **Multi-expand:** any number of rows/groups can be expanded at once — no auto-collapse of siblings.
- **`everExpanded` — lazy-mount support (added 2026-08-07):** an additive-only set recording every id that has been expanded at least once. `toggleExpanded()` and `expandAll()` add to it; `collapseAll()` and `toggleExpanded()`-to-collapse never remove from it. Cleared only when the data source emits a new dataset, alongside `expandedRows`.

  It exists so consumers can gate detail-panel markup on `everExpanded.has(id)` instead of `isExpanded`, giving lazy-then-persist mounting: a never-opened panel costs nothing, and an opened one stays mounted so its collapse animation is a class flip rather than a teardown. Requested by the UI layer — see `../../3-ui/directives/expansion.md`, "Detail Panels Are Lazy and Persistent."

  Not exposed on `RenderRow`. It is keyed lookup, not per-row layout, and detail rows have no `RenderRow` to carry it. Consumers read `table.everExpanded()` directly.

  Known cost: grows monotonically within a dataset, bounded by how many rows a user actually opens. An LRU cap is possible later; deliberately not in v1.

- **Dual use:** this feature backs both (a) row detail/tree-child expansion, and (b) group row collapse/expand state for `withGrouping()` (see `with-grouping.md`) — group rows are treated as rows with an id, tracked in the same `expandedRows` set. A group row's id is synthesized by `withGrouping()`'s render layer (e.g. `` `group:${columnId}:${value}` ``), not a real `TRow` id — `expandedRows` doesn't care whether an id belongs to a real row or a synthetic group header, it's just a set of ids.

## Methods

| Method | Description |
|---|---|
| `toggleExpanded(rowId: RowId)` | Toggle a single row/group's expanded state |
| `expandAll()` | Expand every expandable row/group |
| `collapseAll()` | Collapse every row/group. Does **not** clear `everExpanded`. |

## Compile-Time Dependencies

None. `withExpansion()` is fully standalone — it only relies on the global `trackBy` (already required by `createTable()` itself for every table), not on any other feature.

## Render Layer

Contributes to the core store's optional `_buildRenderRows` hook alongside (or in place of) `withGrouping()` — see `with-grouping.md`, "Render Layer." When composed without grouping, `expandedRows` gates a plain row's `children` (from the `Row.children` tree shape above) the same way it gates a group's clustered members when grouping is present: a row's nested content is included in `renderRows()` only while its id is in `expandedRows`. Depth (`RenderRow.depth`) increments per nesting level, whether that nesting came from real `children` or from grouping's synthetic clusters — the render layer doesn't distinguish the two once ids are resolved.

**Detail panels are not part of this.** A non-tree detail panel has no `TRow` to wrap, never enters `renderRows()`, and has no `RenderRow` or `RowKind` of its own. It is consumer markup gated on `everExpanded`. Two mechanisms on purpose: a tree can reveal thousands of child rows at once, so those stay gated by `renderRows()` and are destroyed on collapse; a detail panel is one row the user deliberately opened, so it stays mounted.

`withExpansion()` overrides the render layer by **declaring** `renderRows` on its returned `TableFeatureSpec` — there is no `_buildRenderRows` store slot to mutate (removed with `@ngrx/signals`, see ADR-0003). At most one composed feature may declare `renderRows`; a second one throws at construction. Any future feature overriding the render layer (`withGrouping()`) is therefore mutually exclusive with `withExpansion()` until they are reconciled into one builder.

## Events Owned

- `rowExpanded` — fires whenever a row/group's expanded state changes (covers both expand and collapse — direction is inferable from current `expandedRows` state).

## Open Questions

- [x] Should `rowExpanded` fire separately for expand vs. collapse, or is a single event with inspectable state sufficient? Resolved — single `rowExpanded` event, direction inferable from `expandedRows` after the change. Shipped as specced.
- [ ] Precise lazy-load UX contract (e.g. per-row loading indicator) not addressed — likely a UI-layer concern once directives are specced, but the *state* for "is this row currently loading children" hasn't been assigned to any feature yet.
