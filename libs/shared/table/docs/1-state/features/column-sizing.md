---
title: State Layer Reference — withColumnSizing()
type: architecture
version: 0.1
date: 2026-09-05
capability: column-sizing
spec: drafted
code: none
audience: developers
parent: ../architecture.md
---

# withColumnSizing()

## Executive Summary

Runtime-resizable per-column width as a state slice. **Only exists when width is
resizable** — static width stays column-owned (a `columnsSchema` seed plus consumer CSS),
per the ownership resolution in
[2-columns/reference/tier-2-layout.md](../../2-columns/reference/tier-2-layout.md#open-questions-tier-2)
(2026-07-25): *"Static, non-resizable width stays on the column def / CSS; there is no
in-between state."* `applyWidth`/`applyFlex` then seed this feature's initial state rather
than writing a `ColumnDef` field — the same seed-into-a-feature pattern `applyPinned` uses
for [`withColumnPinning()`](./column-pinning.md).

The drag itself is not specced here. This feature owns **numbers**; the pointer
interaction, the drag handle, the ghost line and the sticky cursor are UI layer.

## Blocker

**Presentation-fields ADR — unwritten.** `libs/shared/table/CLAUDE.md`'s `ColumnDef`
footprint warning records `ColumnDef.width` as documented-but-unimplemented and explicitly
blocked on that ADR; the field is a sketch in
[2-columns/reference/tier-2-layout.md](../../2-columns/reference/tier-2-layout.md), and no
code path in `src/` reads a width today. This spec therefore describes the intended state
contract only. It does not unblock itself: the ADR has to settle *which presentation facts
the engine is allowed to hold at all* before either the `ColumnDef` seed field or this
feature's state slice can land.

Second, softer dependency: [state-persistence.md](../state-persistence.md) is sequenced
after this feature (gap-analysis priority #5 before #6), so this spec fixes the width
serialization shape and persistence consumes it — not the reverse.

## State Shape (sketch — not locked)

```ts
/** Author-side sizing config, produced by `applyWidth`/`applyFlex`. Seed only. */
interface ColumnSizeConfig {
  width?: number;   // fixed px
  flex?: number;    // grow factor — mutually exclusive with `width`; flex wins if both set
  min?: number;     // clamp floor, px
  max?: number;     // clamp ceiling, px
}

interface ColumnSizingState {
  /**
   * Resolved widths in px, keyed by column id. **Sparse:** an id is present only once the
   * user has actually resized that column. Absent id = "not resized" — the seed or the CSS
   * decides, and the state layer says nothing.
   */
  columnSizing: Record<string, number>;
}
```

The sparseness is load-bearing, not an optimisation:

- A snapshot round-trips only real user intent. Nothing fabricates a width for a column
  nobody touched, so a restore cannot pin a column to a width that was really a measured
  layout artefact — the shape of PrimeNG's `expand`-mode width corruption (#12398).
- `resetColumnWidth(id)` is `delete`, not "write the default back". There is one
  representation of "unsized", not two.

### The four modes, and where each is resolved

| Mode | Declared by | Resolved by |
|---|---|---|
| `fixed` | `applyWidth(col, px)` seed | Consumer CSS, unless resized → `columnSizing[id]` |
| `flex` | `applyFlex(col, grow)` seed | UI layer (flex distribution across the visible rail) |
| `min` / `max` | `applyWidth`'s `opts.min`/`opts.max` | **State layer** — clamped in the updater, see below |
| `auto` | absence of both | UI layer (content/intrinsic sizing) |

`auto` has no state representation on purpose. "No entry" already means it.

## Behavior

- **Resize is state-only.** The feature exposes `setColumnWidth(id, px)`. Pointer capture,
  the `pointermove` → px math, the double-click-to-autofit affordance and any live preview
  are a resize directive's problem (`3-ui/directives/`), consistent with every other
  feature's store/UI split.
- **Clamping lives in the updater, not the caller.** `setColumnWidth` applies
  `min`/`max` from the column's `ColumnSizeConfig` before writing. Any caller — a drag
  directive, a "reset to 200px" button, a restored snapshot — gets the same clamp. This is
  the single-point-of-truth answer to width values arriving from three unrelated paths,
  which is where the competitors' width bugs come from.
- **Unknown ids are rejected, not stored.** `setColumnWidth` on an id absent from
  `columns()` is a no-op. Otherwise a stale snapshot silently grows the record forever.
- **Does not reshape rows.** No pipeline stage, no render stage — `RENDER_ORDER` is a
  `RenderRow[] → RenderRow[]` chain and sizing touches neither rows nor row count. A reader
  expecting a stage here should not find one.

## Methods

| Method | Description |
|---|---|
| `setColumnWidth(id: string, px: number)` | Set one column's width; clamped to its `min`/`max`; no-op for an unknown id |
| `resetColumnWidth(id: string)` | Drop the id from `columnSizing` — back to seed/CSS resolution |
| `resetAllColumnWidths()` | Clear the record entirely |
| `columnWidth(id: string): number \| undefined` | Resolved override, or `undefined` when unsized |

## Feature Plugin Shape

```ts
withColumnSizing<TRow>({ /* config TBD — see open questions */ })
```

Contributes `members` only: no `stages`, no `renderStages`, no `setup`. It stores **column
ids, not `RowId`s**, so [ADR-0006](../../adr/0006-row-id-state-reconciliation.md)'s
`onRowsRemoved` obligation does not apply — but see the open question about the missing
column-side equivalent.

## Interaction with `withColumnPinning()`

Independent state, one shared consumer. Pinned-rail offsets (`left: 0`, `left: 120px`, …)
are cumulative sums of the widths of the columns before them in the rail. Neither feature
computes that: pinning exposes rail membership and index, sizing exposes width overrides,
and the UI layer — the only layer that can also measure the unsized columns — adds them up.
Putting offsets in state would force sizing to be a hard dependency of pinning and would
make an unsized column unrepresentable.

## Interaction with State Persistence

Sizing is one slice of the atomic snapshot described in
[state-persistence.md](../state-persistence.md), not its own save/restore path. The
contract this feature owes persistence:

1. `columnSizing` is directly serialisable — a flat `Record<string, number>`, no functions,
   no measured DOM values, no `undefined` holes.
2. Restore goes through `setColumnWidth`'s clamp, so a snapshot written against an older
   `min`/`max` config cannot reintroduce an out-of-range width.
3. Widths persist **per column id**, folded into that column's entry in the snapshot's
   per-column record alongside `order`/`visible`/`pinned` — one atomic entry per column, not
   four independent slice arrays that can restore out of step.
4. A restored width for an id no longer in `columns()` is dropped silently. It is not an
   error, and it is not retained "in case the column comes back".

## Open questions

- [ ] **Flex distribution: state or UI?** `flex` is declared as a seed here but resolved by
  the UI. If a resize of one flex column has to redistribute the others (AG Grid's
  `columnFlexService` behaviour), that redistribution is arithmetic over all visible
  columns and may belong in the state layer after all. Not decided; `width`-only resizing
  is the smaller v1.
- [ ] **Auto-fit needs measurement.** `autoFitColumn(id)` (fit to widest rendered cell) is
  the most-requested sizing affordance and is inherently DOM-dependent. Does the UI measure
  and call `setColumnWidth`, or does the state layer gain a measurement callback? The
  former keeps the state layer pure and is the current preference, unvalidated.
- [ ] **No column-removal reconciliation hook exists.** ADR-0006 gives features
  `onRowsRemoved` for `RowId` state; there is no `onColumnsRemoved` for features keyed by
  column id. `setColumns()` can drop a column and leave a dead entry in `columnSizing`
  (and in `columnPinning`). Whether to generalise ADR-0006's diff-and-prune to columns, or
  to let both features filter lazily on read, is unresolved — and it is a shared question
  with `withColumnPinning()`, not a sizing-local one.
- [ ] **Do `min`/`max` come from the metadata+reducer core?**
  [signal-forms-techniques.md §1](../../2-columns/reference/signal-forms-techniques.md)
  notes `opts.min`/`opts.max` would fall out of `MetadataReducer.min`/`.max` for free if
  that core is adopted. If it isn't, this feature needs its own clamp config storage.
- [ ] **Not yet drilled.** `spec: drafted` — no decisions session has validated any shape
  above.

## Competitive position

**Verdict: missing** — no sizing state of any kind in `src/`, while all four competitors
ship column sizing and resizing in their free/core tier.

Assessed 2026-09-05 against TanStack Table v8, AG Grid, Material React Table,
and PrimeNG. Full reasoning: [gap-analysis.md](../work/state-feature-competitive-audit/gap-analysis.md).
