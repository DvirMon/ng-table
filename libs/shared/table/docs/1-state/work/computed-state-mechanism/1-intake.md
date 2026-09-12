---
title: Intake — cross-feature computed/derived state mechanism
type: research
status: answered; see 3-decisions.md
date: 2026-09-11
audience: developers
---

# Cross-feature computed/derived state — intake

Not a feature spec. This is the starting context for the design session, which has now happened —
the answers live in [`3-decisions.md`](3-decisions.md). Kept as the record of what was asked and why.

## Motivating cases

Two now, satisfying this doc's own process note (below) that one data point isn't enough to
commit to a shape.

1. **"N selected, M currently hidden" indicator** — needs to read across `withSelection()`'s
   `selectedRows()` and core table state (`table.rows()` / `table.value()`). Raised while writing
   [`docs/0-product/filtering.md`](../../../0-product/filtering.md) — see OQ-2 and story F-S1.
2. **"Are all currently-visible rows selected?"** — the read side a select-all checkbox needs to
   render checked/indeterminate/unchecked and to decide select-vs-deselect on click. Same shape as
   #1 (compare `selectedRows()` against `table.rows()`/`table.renderRows()`), different comparison.
   Surfaced verifying `selectAllIds()` (the plain write-side helper designed alongside this intake,
   see `selection.md` once recorded) against TanStack Table
   [#4781](https://github.com/TanStack/table/issues/4781) — `getIsAllRowsSelected()` reporting
   true when only the current page is selected, because nothing distinguishes "all" from "all
   visible" on the read side either.

Both are read-side derived values over the same two signals (`selectedRows()` + a row-set from
core). A design here should account for both, not solve #1 and rediscover #2 later.

## Seams that already exist

- **Consumer-space:** any public signal (`table.rows`, `table.selectedRows`, once composed) can be
  combined in the consumer's own `computed()`. Works today, zero library changes.
- **Feature-authoring:** the factory's second parameter, `composed` — documented in
  `libs/shared/table/CLAUDE.md` as "the feature-to-feature seam: earlier features' members at
  factory time, all features' members when read later." **No feature uses it today.**

## What was proposed in-session, and rejected

1. A stateless exported pure helper (`hiddenSelectedCount(selected, visibleRows, trackBy)`) —
   rejected: still consumer-level, not state the library owns.
2. Consumer-authored `computed()` in userland — same rejection, same reason.

## What's actually wanted

Computed/derived state declared **at the feature or table-composition level**, so it shows up as
a real signal member on the table store — analogous to NgRx SignalStore's `withComputed()`. Not
assembled by the consumer, not a plain exported function.

## Explicit constraint

Do not let this become an enumerated helper-function surface, the way row-editing's mutation verbs
did (`captureEdit`/`releaseEdit`/`revertEdit`/`discardEdit`/`removeEdit`/`patchEdit` in
`src/mutations/optimistic-mutations.ts`) — cited directly as the failure mode to avoid repeating.

## Architecture the design must respect

- Feature contract: `createTableFeature<TRow, Members>((core) => TableFeatureSpec)`
  (`engine/types.ts`).
- `composeTable()` folds features (`engine/compose-table.ts`).
- `SlotRegistry` (`engine/slots.ts`) enforces single-occupancy on member keys and stages — any new
  mechanism for declaring members must go through it or explain why not.
- "Features declare, never mutate" (`CLAUDE.md`) — a feature returns a `TableFeatureSpec`; writing
  behavior into the store object directly is not supported.
- No ADR exists for this topic yet — it's new territory. ADR-0007 (member-key collisions) is the
  closest existing precedent to read first.

## Open technical question to start from — **answered**

> Does formalizing `composed` — e.g. making it reactive rather than a point-in-time snapshot —
> already solve this, or does it need a new `withComputed()`-shaped primitive layered on top of the
> plugin system?

**Neither.** Formalizing `composed` does not solve it and should not be reopened: ADR-0007 closed
that shape deliberately, and a typed `composed` is the same shape with better ergonomics, which
makes it more dangerous rather than less. Nor is a consumer-level `withComputed()` the answer.

Derived state is declared **on the feature that owns the state it derives from**, as a `computed`
block in that feature's config, because the re-classification below shows one owner almost always
holds everything the derivation needs. Cross-feature reach, where genuinely required, is a
*declared requirement* checked order-free at composition. See [`3-decisions.md`](3-decisions.md) D19-D22.

## Process note — **answered on evidence, not waived**

The note asked for a second or third concrete case before committing to a shape, or an explicit
named call that one case is enough.

Five candidate cases were examined. **Four collapse to single-owner** once you notice that
`core.rows` is the pipeline output and `core.value` the raw array — both already on `TableCore`, so
"reads the filtered rows" is not "reads filtering's members":

- selected-but-hidden count (the motivating case) → `withSelection()`
- `expansionState` → the tree feature
- filtered match count / page total → `withFiltering()`
- O17, validity of rows the user cannot see → `withRowEdit()`

**One does not:** the group-header tick and indeterminate state under an active filter
(grouping X-G1 / OQ-1), which reads selection's members and grouping's group→descendant mapping.

So the shape is designed for the single-owner majority, with a declared-requirement path for the
one real cross-owner case — not a general cross-feature seam justified by a single data point.
