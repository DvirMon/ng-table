---
title: State Layer Reference — State Persistence
type: architecture
version: 0.2
date: 2026-09-07
capability: state-persistence
spec: drafted
code: none
audience: developers
parent: ./architecture.md
---

# State Persistence

## Executive Summary

Save and restore a table's layout — sort, column order/visibility/width/pin, filters,
pagination, grouping — as **one atomic, versioned, round-trippable object**.

**Not a `with-*()` feature** (same reasoning as [row-mutations.md](./row-mutations.md), D8,
which is why this file is its sibling rather than living under `features/`). Persistence is
not one plugin's state: it serialises whatever features happen to be composed, plus core
column state that belongs to no feature at all. A `withPersistence()` that reached into
five other features' internals would be an enumerated surface that every new feature has to
edit — see the mechanism proposed below.

**Sequenced last, deliberately.** Priority #6 in
[gap-analysis.md](./work/state-feature-competitive-audit/gap-analysis.md#priority-ranking-for-what-to-build-next):
column sizing, pinning, filtering and pagination all have to exist before there is a layout
worth persisting. Today the snapshot would contain sort rules and column order and nothing
else — and a shape fixed against that toy payload is a shape that needs migrating four
times before it is ever useful. This spec exists now to *fix the contract each of those
features writes toward*, not to be built now.

## Why this doc is unusually prescriptive

PrimeNG is the only one of the four competitors with a *named* persistence API
(`[stateStorage]`/`[stateKey]`), and it has accumulated five confirmed correctness bugs
(see [audit.md](./work/state-feature-competitive-audit/audit.md#state-persistence)). AG Grid,
the closest thing to a real answer (`getState()`/`setState()`), has its own post-init reapply
gap (#7445) and does not capture row order (#11492). Both retrofitted persistence onto
features that already shipped their own state, one slice at a time.

The audit's #2 cross-cutting gap is exactly this: *atomic, round-trippable layout state is
genuinely hard, not a solved problem any of these four can be copied wholesale.* So the
design rules below are written as constraints on the eventual implementation, and the
competitors' bug list is transcribed into a test list rather than left as prose.

## State Shape (sketch — not locked)

```ts
type SnapshotVersion = 1;

/** One entry per column: every layout fact about that column, together. */
interface ColumnSnapshotEntry {
  id: string;
  order: number;
  visible: boolean;
  width?: number;                 // withColumnSizing() — omitted when unsized
  pinned?: 'left' | 'right';      // withColumnPinning() — omitted when unpinned
}

interface TableSnapshot {
  version: SnapshotVersion;
  columns: ColumnSnapshotEntry[];
  sorting?: SortRule[];                                       // withSorting()
  filters?: { columnFilters: FilterRule[]; globalFilter: string };  // withFiltering()
  pagination?: { pageIndex: number; pageSize: number };       // withPagination()
  grouping?: string | null;                                   // withGrouping()
}
```

**Per-column entries, not parallel slice arrays.** This is the one shape decision worth
defending. AG Grid's `getColumnState()` — an array of per-column records — is the audit's
"closest to one coherent object", and the alternative (an order array, a width map, a pin
map, a hidden-ids array) is precisely what makes a restore land out of step: three
independent passes, three chances to apply one and skip another, which is the failure class
behind PrimeNG's order-restore regression (#14888). One entry per column restores atomically
or not at all.

Feature slices are **optional keys, present only when that feature is composed**. An absent
key is not `null` and is not a default — it is "this table had no such state", so restoring
into a differently-composed table has an unambiguous answer (skip it) rather than a guess.

## Design rules

Each rule closes a specific, confirmed failure in a shipped competitor.

1. **One write path, one read path.** `serialize(table): TableSnapshot` and
   `restore(table, snapshot)`. No per-feature save/restore hooks a consumer can call
   individually. Piecemeal restore is how order gets lost (#14888).
2. **Restore is one transaction, applied before first render.** Not N sequential feature
   writes. Feature `*Changed` events must not fire N times mid-restore, and any consumer
   `effect()` watching them must see the restored state once, settled. This is the
   generalized form of AG Grid's post-init reapply gap (#7445).
3. **Restoring must not trigger a save.** The save trigger has to be suppressed for the
   duration of a restore, or the first restore immediately rewrites storage with a
   half-applied state — PrimeNG #6969.
4. **The snapshot is the authority for restored values; nothing measured is written back.**
   No DOM-measured width, no post-layout flex resolution, ever re-enters the snapshot. A
   width enters the snapshot only from an explicit `setColumnWidth`. This is the direct
   answer to PrimeNG's `expand`-mode width corruption (#12398), and the reason
   [features/column-sizing.md](./features/column-sizing.md) keeps `columnSizing` sparse.
5. **Unknown ids and inapplicable slices are dropped silently, never applied blind.** A
   `pagination` slice restored into a table with no `withPagination()` is discarded, not
   half-applied (PrimeNG #9076, spurious restore of properties that don't apply). A column
   entry whose `id` is absent from `columns()` is dropped, and columns present in the table
   but absent from the snapshot keep their configured defaults.
6. **A `setColumns()` replacement invalidates the restore.** Replacing the column list is a
   new layout, not a mutation of the old one; the snapshot is re-derived from the new list
   rather than reapplied over it (PrimeNG #8902 — state not resynced when the `columns`
   input array is replaced).
7. **Versioned, with an explicit unknown-version policy.** A snapshot whose `version` is
   unrecognised is discarded whole. Never partially applied, never best-effort migrated by
   field-probing.
8. **Storage is consumer-supplied, not an enum.** A small interface, not
   `'local' | 'session'` — PrimeNG's restriction to those two is an open feature request
   (#14461) precisely because URL query params, a server-side user profile and IndexedDB
   are all legitimate backends.

   ```ts
   interface TableStateStorage {
     read(key: string): TableSnapshot | null | Promise<TableSnapshot | null>;
     write(key: string, snapshot: TableSnapshot): void | Promise<void>;
     clear(key: string): void | Promise<void>;
   }
   ```

9. **Round-trip law.** For every composition of features,
   `restore(t, serialize(t))` leaves `t` observably unchanged. This is a property, not an
   example — it is the one assertion that catches a slice someone forgot to serialize.

## Proposed mechanism — features contribute their own slice

Open enough to need an ADR (it changes `TableFeatureSpec`, an engine contract), but recorded
here because the alternative shapes the whole spec.

Persistence must not enumerate the features it knows about. Each feature already declares
what it contributes (`members`, `stages`, `renderStages`, `setup`); the same shape extends
to a persisted slice:

```ts
// engine/types.ts — proposed addition to TableFeatureSpec
interface FeatureSnapshotSlice<TSlice> {
  key: string;                        // claimed via SlotRegistry, like a stage key
  read(): TSlice;                     // called by serialize()
  write(slice: TSlice): void;         // called by restore(), inside the transaction
}
```

Consequences that make this the preferred shape:

- A new feature opts in by declaring one slot. Persistence never changes. This is the
  general-mechanism-over-enumerated-cases posture the rest of the engine already takes with
  `PIPELINE_ORDER`/`RENDER_ORDER`.
- Slot collisions are already solved: `engine/slots.ts` throws at construction for a
  duplicate key, so two features cannot silently share a snapshot slice.
- Core column state (`order`/`visible`) belongs to no feature, so the core contributes the
  `columns` entry directly rather than through a slice — the only enumerated part, and it
  is enumerated because `columns` is core API, not a plugin.
- Rule 2 (one transaction) becomes implementable: `restore()` calls every `write()` inside
  one batch and emits change events once at the end.

## Test list

Transcribed from confirmed competitor bugs, so each has a known failure mode rather than a
speculative one. These are the acceptance tests, not a wishlist.

| # | Test | Origin |
|---|---|---|
| T1 | Column **order** survives a full serialize → reload → restore cycle | PrimeNG #14888 (broken until 17.12.0) |
| T2 | Column **width** is not corrupted by restore under flex/expand-style sizing; a restored width equals the width written | PrimeNG #12398 |
| T3 | A slice whose feature is **not composed** is discarded, not partially applied | PrimeNG #9076 (spurious restores) |
| T4 | Restore does **not** trigger a save write | PrimeNG #6969 |
| T5 | `setColumns()` replacing the column list **invalidates** the snapshot rather than reapplying it | PrimeNG #8902 |
| T6 | State applied during restore is settled **before first render**; no post-init reapply pass | AG Grid #7445 |
| T7 | Every slice a composed feature owns is actually captured — no silently-missing slice | AG Grid #11492 (row order never captured) |
| T8 | Round-trip identity: `restore(t, serialize(t))` is observably a no-op, for each composition | Rule 9 |
| T9 | Unknown `version` → snapshot discarded whole, table keeps its configured defaults | Rule 7 |
| T10 | Unknown column ids dropped; columns missing from the snapshot keep their defaults | Rule 5 |
| T11 | Corrupt/empty/non-JSON payload is handled as "no snapshot", never as a partial one | Rule 7 |
| T12 | Change events fire **once** per restore, not once per slice | Rule 2 |

## Non-goals

- **Row data.** The snapshot describes layout. `data` is the consumer's signal (D3/D11 in
  [row-mutations.md](./row-mutations.md)) and is never serialised here.
- **In-flight editing state.** `withOptimistic()`/`withRowEdit()` restore points, open edit
  sessions and pending ids are a transaction mid-flight, not a layout. Persisting them would
  restore a rollback target for a server round trip that already resolved.
- **Scroll position.** Meaningless before `withVirtualScroll()` lands, and it is a viewport
  fact rather than a state fact.
- **Validation of the storage backend.** Quota, encryption and eviction belong to the
  consumer's `TableStateStorage`.

## Open questions

- [ ] **Is selection persisted?** PrimeNG deliberately excludes selection and expansion from
  its persisted slice set. Selection is arguably session state, not layout — but it is also
  the audit's #1 gap and `withSelection()` doesn't exist yet, so this cannot be decided until
  the selection-scope concept (page/filtered/all) is settled.
- [x] **Is expansion persisted?** Resolved 2026-09-07 — **yes, as a slice**, and the slice
  mechanism above is the *only* restore path expansion gets. `withExpansion()` contributes
  `{ key: 'expansion', read: () => [...expandedRows()], write: (ids) => … }`; it deliberately
  ships **no** `initialExpandedAsync` config, because a per-feature async restore violates rule 1
  (a second write path) and cannot satisfy rule 2 (each feature's resource resolves on its own
  clock, so cross-feature atomicity is unachievable per-feature). A separate, non-persistence
  `initialExpanded?: readonly RowId[]` construction seed exists for synchronously-available
  state; it is not part of this mechanism. See
  [features/expansion.md](./features/expansion.md#initial-state-and-persistence).

  Still open, and shared with selection: the stale-id hazard. `expandedRows` holds `RowId`s and a
  restored id may no longer exist in `data`; ADR-0006's prune runs on removal, so an id whose row
  never arrives is never pruned. Drop-unknown-at-apply breaks async data that arrives later;
  keep-unknown matches how synthetic `group:*` ids already live in that Set. Decide once, for
  both features.
- [ ] **Migration policy beyond "discard".** Rule 7 discards an unknown version. A
  `migrate?: (unknown) => TableSnapshot | null` escape hatch would let consumers upgrade
  their own stored payloads, but invites exactly the field-probing rule 7 forbids.
- [ ] **Snapshot key scoping.** PrimeNG's `stateKey` is a bare string, which collides across
  two tables on one route and across two users on one device. Whether the key is
  consumer-supplied, route-derived or user-scoped is undecided.
- [ ] **Async restore and first paint.** A `TableStateStorage` returning a `Promise` (server
  profile, IndexedDB) cannot satisfy rule 2's "before first render" without a gate. Does the
  table render defaults and reflow, or hold until the snapshot resolves?
- [ ] **Does the snapshot mechanism need an ADR before any of it lands?** The
  `FeatureSnapshotSlice` addition changes `TableFeatureSpec`. Assumed yes; not written.
- [ ] **Not yet drilled.** `spec: drafted` — no decisions session has validated any shape
  above.

## Competitive position

**Verdict: missing** — no serialize/restore of any table state exists in `src/`; PrimeNG is
the only competitor with a named API here, and its confirmed bug list is what this spec's
test list is built from.

Assessed 2026-09-05 against TanStack Table v8, AG Grid, Material React Table,
and PrimeNG. Full reasoning: [gap-analysis.md](./work/state-feature-competitive-audit/gap-analysis.md).
