---
title: State Layer Reference — withExpansion()
type: architecture
version: 2.0
date: 2026-09-21
capability: expansion
spec: drilled
code: shipped
audience: developers
parent: ../architecture.md
---

# withExpansion()

The **detail-panel** feature — open/closed id tracking only, no row synthesis, no render
stage, no `parentId`. Split from the tree-grid case by
[ADR-0012](../../adr/0012-split-expansion-into-panel-and-tree.md) (`accepted`); the tree half
is [`withTree()`](tree.md).

## Executive Summary

Multi-expand open/closed id tracking for a detail panel: arbitrary consumer markup, not more
rows. Standalone feature with no compile-time dependencies. Declares **no** render stage and
contributes nothing to the `expandedRows` union `engine/flatten.ts`'s `flattenVisible` walk
reads — opening a panel can never reveal rows, by construction (D8/E12).

## State Shape

`table.expansion` is one callable slice (ADR-0015), the same shape as `table.tree`:

```ts
interface ExpansionSlice {
  (): ReadonlySet<RowId>;
  readonly everExpanded: Signal<ReadonlySet<RowId>>;
  readonly changed: Observable<ExpansionChange>; // { added: RowId[]; removed: RowId[] }
  toggle(id: RowId, options?: ExpansionWriteOptions): void;
  expand(ids?: readonly RowId[], options?: ExpansionWriteOptions): void;
  collapse(ids?: readonly RowId[], options?: ExpansionWriteOptions): void;
  set(ids: readonly RowId[], options?: ExpansionWriteOptions): void;
  release(ids?: readonly RowId[]): void; // specced, not shipped (E39, #200)
}
```

> **Pending (#200):** `release` is specced, not shipped — `code: shipped` covers everything else on this
> slice. See `0-product/expansion.md` OQ-exp-8 part 2.

`expansion()` is the primary read — the open set. `everExpanded`, `changed` are properties
(ADR-0015's primary-signal rule).

## Config

```ts
interface WithExpansionConfig {
  initial?: readonly RowId[];
}
```

Not generic in `TRow` — nothing in it reads a row. `initial` is covered under
[Initial State and Persistence](#initial-state-and-persistence).

## Behavior

- **Multi-expand:** any number of rows can be open at once — no auto-collapse of siblings.
  Single-open (incl. a side panel) is a consumer use of `set(isOpen ? [] : [id])`, not a mode —
  `0-product/expansion.md` OQ-exp-1, OQ-exp-7.
- **`everExpanded` — lazy-mount support:** a set recording every id that has been opened at least
  once. `expand()`/`toggle()`-to-open add to it; `collapse()` and `toggle()`-to-close never remove
  from it. It shrinks only through `release()` (E39, specced, not shipped) — exempt from
  `onRowsRemoved` pruning ([ADR-0006](../../adr/0006-row-id-state-reconciliation.md)), unlike the
  open set.

  It exists so consumers can gate detail-panel markup on `everExpanded().has(id)` instead of
  `expansion().has(id)`, giving lazy-then-persist mounting: a never-opened panel costs nothing,
  and an opened one stays mounted so its collapse animation is a class flip rather than a
  teardown. Requested by the UI layer — see `../../3-ui/directives/expansion.md`, "Detail
  Panels Are Lazy and Persistent."

  Not exposed on `RenderRow`. It is keyed lookup, not per-row layout, and detail rows have no
  `RenderRow` to carry it. Consumers read `table.expansion.everExpanded()` directly.

  **Mount lifetime — resolved 2026-10-01 (`0-product/expansion.md` OQ-exp-8, #195).** Default
  recipe unmounts on close (gate `expansion().has(id)`, `animate.leave`); keeping inner state is a
  per-row opt-in, `expansion().has(id) || (keepMounted(row) && everExpanded().has(id))` (E40).
  `release(ids?)` frees kept panels (E39, pending in #200). Panel a11y directives ship in #199 (E41). The
  panel stays outside `renderRows()` (E12 kept); virtual scroll must support it (E42).

- **No discovery walk.** `expand()` with no `ids` targets every row in `rows()` — the panel has
  no `parentId` and no concept of hierarchy, so "expand everything" is the flat row set, not a
  tree walk. `withTree()`'s `expand()` differs here (it scans flat data for `parentId` links).

## Methods

| Method                                     | Description                                                                                                                                                                |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `table.expansion.toggle(rowId, options?)`  | Toggle a single row's open state. Emits `changed` once.                                                                                                                    |
| `table.expansion.expand(ids?, options?)`   | Adds. Omitted `ids`: every row in `rows()`, unioned with what's already open.                                                                                              |
| `table.expansion.collapse(ids?, options?)` | Removes. Omitted `ids`: everything currently open.                                                                                                                         |
| `table.expansion.set(ids, options?)`       | Atomic replace — the restore path.                                                                                                                                         |
| `table.expansion.release(ids?)`            | **Specced, not shipped (E39, #200).** Removes ids from `everExpanded`; omitted `ids` clears it. Never touches the open set; emits nothing on `changed`. Frees kept panels. |

Every write verb takes `options?: ExpansionWriteOptions` (`{ emitEvent?: boolean }`) — see
[Silent writes](#silent-writes-emitevent-false).

There is no tri-state `state` member on this slice — "are all panels open?" is not a
meaningful toolbar question the way "are all groups expanded?" is. `withTree()` ships `state`
for that reason (D5/E9); the panel's one-line equivalent, if a consumer ever needs it, is
`table.expansion().size === table.rows().length` at the call site.

## Initial State and Persistence

### `initial` — a construction-time seed

```ts
withExpansion({ initial: savedIds() });
```

A **plain array, read once** when the feature factory runs. It seeds `expansion()` and
`everExpanded()` (a restored-open row _has_ been opened, so its detail panel mounts
immediately rather than waiting for a toggle) and emits **no** `changed` — nothing changed, the
table started this way.

Deliberately not a `Signal<RowId[]>` and not a predicate — same reasoning as `withTree()`'s
`initial`: storing a signal forces an answer to "what happens when it emits again?" that has no
good answer (the two-writer problem), and a predicate presumes the condition lives in row data,
which is only one of the real cases. `readonly RowId[]` rather than `Set<RowId>` because that
is what round-trips through JSON to a storage backend without a converter.

### Silent writes (`emitEvent: false`)

Every write verb takes `options?: { emitEvent?: boolean }`. `{ emitEvent: false }` sets the
state without emitting on `changed`. Precedent: Angular reactive forms'
`setValue(v, { emitEvent: false })`; adopted from `withSelection()` D18 — the shape is shared
across every id-set feature, not invented per feature.

Its reason to exist: **a restore carries no user intent.** A subscriber lazy-loading a panel's
content on open, or saving state on change, should not see a restore as an interaction.

### Snapshot slice

Expansion's whole participation in `serialize()`/`restore()`, under
[state-persistence.md](../state-persistence.md)'s proposed `FeatureSnapshotSlice` mechanism:

```ts
{
  key: 'expansion',
  read: () => [...table.expansion()],
  write: (ids) => table.expansion.set(ids, { emitEvent: false }),
}
```

`write()` goes through the silent-write path above, satisfying that spec's Rule 2 ("feature
`*Changed` events must not fire N times mid-restore"). `everExpanded` is **not** in the slice —
it is a lazy-mount ledger, not layout, and `write()` seeding it is `initial`'s job at
construction.

## Compile-Time Dependencies

None. `withExpansion()` is fully standalone — it only relies on the global `trackBy` (already
required by `createTable()` itself), not on any other feature. Composes with `withTree()`, in
either argument order, on the same table (they are two independently-keyed `createExpansionStore()`
instances — see [ADR-0012](../../adr/0012-split-expansion-into-panel-and-tree.md)).

## Render Layer

**Declares no render stage and no `expandedRows` contribution.** Unlike every feature that
touches the flatten walk's unioned `expandedRows` slot, `withExpansion()` contributes nothing
to it at all — this is what makes composing it with `withGrouping()`/`withTree()` safe.
`renderRows()` for a table with only `withExpansion()` composed is always 1:1 with `rows()`:
every row is at `depth === 0`, and `isExpanded` is unstamped (`undefined`) on every row, because
there is no contributor to the union for `engine/flatten.ts`'s `flattenVisible` walk to read.

**Detail panels are consumer markup.** A panel has no `TRow` to wrap, never enters
`renderRows()`, and has no `RenderRow` or `RowKind` of its own — it is gated on
`table.expansion()` / `table.expansion.everExpanded()` in the consumer's own template.

## Events Owned

- `table.expansion.changed: Observable<ExpansionChange>` (`{ added: RowId[]; removed: RowId[] }`)
  — one emission per write, carrying the whole symmetric difference, not one emission per id.
  `toggle()` emits once; `expand()`/`collapse()`/`set()` each emit once per call, with every
  affected id present in `added` or `removed`.

  **Completes on destroy.** `TableFeatureSpec.onDestroy` destroys the underlying
  `createExpansionStore()`, so subscribers terminate with the table.

  Emission order: state is written first, then the emission fires — a subscriber always reads
  the post-change `expansion()` regardless of which verb fired it.

## Open Questions

- [x] **Non-expandable rows.** **Resolved 2026-09-30 — consumer-owned, no library gate**
      (`0-product/expansion.md` OQ-exp-4). No per-row predicate, no `isExpandable(id)`; this
      deliberately does not mirror selection's D58 (`enableRowSelection`). Reason: whether a row has
      detail depends on panel content, which is consumer data (OQ-exp-5), unlike selection's lock state
      on the row itself. Recipe: hide the toggle per row in the template; expand-all passes filtered
      ids, `expand(rows().filter(hasDetail).map(trackBy))`. Bare `expand()` means every row.
- [ ] Should `everExpanded` be seeded by a snapshot `restore()`, or only by `initial`?
- [ ] Precise lazy-load UX contract (e.g. a per-row loading indicator) not addressed — likely a
      UI-layer concern once directives are specced, but the _state_ for "is this panel currently
      loading" hasn't been assigned to any feature yet.
- [x] **Stale restored ids.** `initial` (and a snapshot `write()`) can carry ids whose rows are
      absent from `data` — deleted server-side since the state was saved. **Resolved — keep them;
      staleness is caller-owned.** Adopts selection's [D8](../work/with-selection/2-decisions.md)
      verbatim: neither id-set feature carries a data-backed invariant, and an id matching no row
      renders nothing. `onRowsRemoved` prunes the open set (`table.expansion()`), never
      `everExpanded` (ADR-0006 exemption, deliberate — it's an additive ledger).
- [x] **Does `expansionState` land here or in `withTree()`?** Resolved — it shipped as
      `withTree()`'s `state` property (tri-state depends on the discovery walk, which only the
      tree feature has). See [tree.md](tree.md).

---

## Competitive position

**Verdict: on par.** `withExpansion()` covers the detail-panel use MRT keeps as a separate
concept, composing freely with grouping and pagination since it claims no render stage. The
tree-grid case (matching TanStack / Material React Table's sub-rows) is
[`withTree()`](tree.md), split out by [ADR-0012](../../adr/0012-split-expansion-into-panel-and-tree.md).

Full reasoning: [gap-analysis.md](../work/meta/archive/state-feature-competitive-audit/gap-analysis.md).
