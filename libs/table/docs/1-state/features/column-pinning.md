---
title: State Layer Reference — withColumnPinning()
type: architecture
version: 0.1
date: 2026-09-05
capability: column-pinning
spec: drafted
code: none
audience: developers
parent: ../architecture.md
---

# withColumnPinning()

## Executive Summary

Freeze columns to a left or right rail. **Table-level state, not a `ColumnDef` field** —
settled 2026-07-25 in
[2-columns/reference/tier-2-layout.md](../../2-columns/reference/tier-2-layout.md) against
fetched TanStack source: pinning is logic state (`columnPinning: { left, right }` plus
region derivation), not per-column geometry. AG Grid keeps `pinned` on the column def
because its column model is centralized internally either way; this table follows TanStack.
`columnsSchema`'s `applyPinned` therefore **seeds this feature's initial state** and writes
nothing onto `ColumnDef`.

The feature answers one question — *which rail is this column in, and where in it?* Sticky
positioning, offsets, rail shadows and horizontal scroll are UI layer.

## State Shape (sketch — not locked)

```ts
type PinSide = 'left' | 'right';

interface ColumnPinningState {
  /** Membership only. Order within a rail is NOT encoded here — see below. */
  columnPinning: { left: string[]; right: string[] };
}
```

Shape matches the stub already registered in
[architecture.md](../architecture.md)'s feature table, so the roll-up and this spec agree.

### Ordering is not duplicated

`ColumnDef.order` is the single ordering declaration for the table, written by
`reorderColumns(ids)` (`mutations/update-columns.ts`). The pin arrays record **membership**;
within-rail order is derived by sorting each rail's members by their `ColumnDef.order`.

The alternative — letting array position mean rail order — would create two hand-maintained
orderings of the same columns, the silent-drift failure `.claude/rules/file-organization.md`
names explicitly: reorder a pinned column and the two lists disagree, with nothing to catch
it. TanStack's arrays do carry order; this is a deliberate divergence, and the reason the
arrays remain arrays at all is snapshot stability (a stable serialized order diffs cleanly)
rather than semantics. See the open question about collapsing them to sets.

## Derived Regions

```ts
interface ColumnPinningMembers<TRow> {
  leftColumns:   Signal<ColumnDef<TRow>[]>;   // pinned left,  visible, ordered
  centerColumns: Signal<ColumnDef<TRow>[]>;   // unpinned,     visible, ordered
  rightColumns:  Signal<ColumnDef<TRow>[]>;   // pinned right, visible, ordered
}
```

Mirrors TanStack's `row_getStartVisibleCells` / `row_getCenterVisibleCells` /
`row_getEndVisibleCells`, computed once over `columns()` instead of per row. Three regions,
each already order-resolved and visibility-filtered, is what a template needs to render
three rails; asking a template to partition the column list itself would put the same
`filter`/`sort` in every consumer.

## Behavior

- **Pin membership survives hiding.** `toggleColumnVisibility(id)` does not remove the id
  from `columnPinning`; the region computeds filter by `visible`. Unhiding restores the pin.
  Dropping the pin on hide would make a visibility toggle silently destructive — and it is
  the kind of asymmetry that only shows up after a persistence round trip.
- **Pinning is idempotent and exclusive.** `pinColumn(id, 'left')` on a right-pinned column
  moves it; it never lands in both rails. Enforced in the updater, so no caller can produce
  the invalid state.
- **Unknown ids are rejected.** `pinColumn` on an id absent from `columns()` is a no-op —
  same rule as `withColumnSizing()`, same reason: a stale snapshot must not grow the state.
- **`reorderColumns()` stays pinning-unaware.** It writes `order` on `baseColumns` as it
  does today. The regions recompute because they read `columns()`. No coordination, no new
  coupling in `mutations/update-columns.ts` — this is the payoff of not duplicating order.
  Reordering a column *across* a rail boundary is a UI concern (a drop target decides both
  the new `order` and the new pin, and issues two updates).
- **Does not reshape rows.** No pipeline stage, no render stage. `RENDER_ORDER` operates on
  `RenderRow[]`; pinning partitions *columns* and never touches row count, row order or row
  identity.

## Methods

| Method | Description |
|---|---|
| `pinColumn(id: string, side: PinSide)` | Move a column into a rail; exclusive; no-op for an unknown id |
| `unpinColumn(id: string)` | Remove from whichever rail holds it |
| `isColumnPinned(id: string): PinSide \| false` | TanStack's `column_getIsPinned` shape |
| `pinnedIndex(id: string): number` | Position within its rail (`-1` when unpinned) — the index the UI needs for cumulative offsets |
| `resetColumnPinning()` | Empty both rails |

## Feature Plugin Shape

```ts
withColumnPinning({ initial?: { left?: string[]; right?: string[] } })
```

Contributes `members` only — no `stages`, no `renderStages`, no `setup`. `applyPinned`
seeds `initial`; per
[tier-2-layout.md](../../2-columns/reference/tier-2-layout.md#applypinned--freeze-left--right-seeds-withcolumnpinning-store-owned),
the seed has nothing to seed into until this feature exists, so this spec is the
prerequisite for that `apply*`, not the other way round.

Stores column ids, not `RowId`s, so ADR-0006's `onRowsRemoved` obligation does not apply.

## What belongs to the UI layer

Everything positional:

- `position: sticky` / `left` / `right` offsets, and the cumulative width sums that produce
  them. The state layer cannot compute those without measuring unsized columns — see
  [column-sizing.md](./column-sizing.md), "Interaction with `withColumnPinning()`".
- Rail separators, scroll shadows, the "is the center region scrolled" affordance.
- Drag-to-pin gestures and any pin menu.
- Horizontal scroll containment.

The state layer gives the UI exactly two facts per column — which region, and which index
in it. That is sufficient for the offset math and insufficient for anything to be
double-owned.

## Interaction with State Persistence

Pinning is one slice of the atomic snapshot in
[state-persistence.md](../state-persistence.md). Because rail order is derived rather than
stored, a snapshot carries one `pinned?: 'left' | 'right'` per column entry — folded into
the same per-column record as `order`, `visible` and `width`, so pin and order restore in
one pass and cannot land out of step (the failure mode behind PrimeNG's #14888
order-restore bug). Ids absent from the current `columns()` are dropped on restore.

## Open questions

- [ ] **Keep arrays, or collapse to sets?** With order derived, `{ left: string[]; right:
  string[] }` carries no information a `Set<string>` + a `PinSide` map wouldn't. Arrays are
  retained for TanStack shape familiarity and stable serialization; whether that is worth an
  ordered container whose order is meaningless is unresolved.
- [ ] **No column-removal reconciliation hook exists** — shared with
  [column-sizing.md](./column-sizing.md). `setColumns()` can drop a pinned column and leave
  a dead id in `columnPinning`. Generalise ADR-0006's diff-and-prune to column ids, or
  filter lazily on read? Undecided, and it should be decided once for both features.
- [ ] **Header/column groups.** `2-columns` treats column groups as declarative only. If a
  group is pinned, is every member pinned, and can a member be pinned to the opposite rail?
  No group runtime API exists to hang this on today.
- [ ] **Row pinning is a separate capability.** Frozen top/bottom rows share the vocabulary
  but not the state — they reshape `RenderRow[]` and would claim a render stage. Not in
  scope here; not specced anywhere yet.
- [ ] **Not yet drilled.** `spec: drafted` — no decisions session has validated any shape
  above.

## Competitive position

**Verdict: missing** — no pinning state in `src/`; all four competitors ship column pinning
(PrimeNG as "frozen columns") in their free/core tier.

Full reasoning: [gap-analysis.md](../work/meta/archive/state-feature-competitive-audit/gap-analysis.md).
