---
title: State Layer Reference — withVirtualScroll()
type: architecture
version: 0.1
date: 2026-07-31
status: drafted — not yet fully specced (added alongside the renderRows render-layer design)
audience: developers
parent: ../1-state/architecture.md
---

# withVirtualScroll()

## Executive Summary

Windowed rendering over `renderRows()`. Decoupled from `withGrouping()`/`withExpansion()` by design — it operates purely on the already-flattened, collapse-resolved `renderRows: Signal<RenderRow<TRow>[]>` (see `with-grouping.md`, "Render Layer"), the same way AG Grid's DOM virtualization and MUI X's `renderContext` slice a pre-flattened row list without any awareness of tree/grouping state.

## State Shape (sketch — not locked)

```ts
interface VirtualScrollState {
  visibleRange: { start: number; end: number };
}
```

## Behavior (sketch)

- Reads `renderRows().length` for total extent — never `rows()` directly, so grouping/collapse changes automatically reflow the window without this feature needing to know why the length changed.
- `estimatedRowHeight` config seeds initial range math; per-row measured height can refine it once rendered (open question below).
- `scrollToIndex(i)` operates against `renderRows()` indices — a group header and a leaf row are equally addressable positions.

## Methods (sketch)

| Method | Description |
|---|---|
| `scrollToIndex(index: number)` | Scroll the viewport so `renderRows()[index]` is visible |

## Compile-Time Dependencies

None. Reads only `renderRows()`, which is always present on the core store (see `with-grouping.md`) — composes with or without `withGrouping()`/`withExpansion()` in `features: []`.

## Open Questions

- [ ] Fixed vs. dynamic/measured row height — AG Grid starts with `rowHeightEstimated: true` and refines on measure; not yet decided whether we need that two-pass approach or can require a fixed `estimatedRowHeight`.
- [ ] Overscan/buffer config shape (`overscan?: number`, rows or pixels?) not yet decided.
- [ ] Interaction with `depth`-based indentation (does virtualization need to account for variable-width group-header rows differently from leaf rows)?
- [ ] Not yet drilled in an interview session — this file is a placeholder capturing the render-layer contract it depends on, per the 2026-07-31 grouping/expansion research session.
