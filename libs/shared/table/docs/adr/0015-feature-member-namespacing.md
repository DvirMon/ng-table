# ADR-0015 — A feature exposes one callable slice, keyed by state concern

**Status:** accepted — decided 2026-09-13, unimplemented
**Related:** [ADR-0007](0007-feature-member-claims.md) (rejected namespacing as a collision fix —
this reopens it on different grounds, now that collisions throw at construction), [ADR-0003](0003-in-house-table-store-engine.md)
(the feature contract). Research: [`research-callable-slice-shape.md`](../1-state/work/feature-member-namespacing/research-callable-slice-shape.md)
(Angular precedent for a callable carrying non-state members, e.g. `signal()`, `model()`,
`FieldState.getError(kind)`).

Every feature exposes exactly one **callable slice**, keyed by state concern, not by feature name
(`table.grouping()` returns state, `table.grouping.rowIdsOf(g)` is behavior) — the shape
`WritableView<T, Updater>` (D30) already ships for `value`, `columns`, `editing` and `grouping`.
All four shipped features migrate; nothing is grandfathered. Slices are keyed by state concern
because two features can share one concern — `withRowEdit()` composes `withOptimistic()`
internally, so `table.editing` must mean the same thing under either.

## The primary-signal rule

A slice is a callable and a call returns exactly one value. The rule for what that value is:

1. **The call returns the feature's primary state** — "what is this feature's current setting?"
   Every other signal (e.g. `table.sorting.directions()`, `table.sorting.changed`) stays its own
   property on the slice.
2. **A slice call never returns a composite object.** `computed()` compares with `Object.is`, so a
   computed returning an object literal invalidates every reader on any field change. Composite
   for writing, per-field for reading — already the pattern `editing-state.ts` uses (one atomic
   `state` signal internally, four separate derived signals — `editing`, `pending`, `pendingOps`,
   `unconfirmed` — exposed).
3. **No obvious primary ⇒ the slice is not callable**, it's a plain namespace object instead
   (`table.filtering.columns()` / `table.filtering.global()` — `columnFilters` and `globalFilter`
   are peers, forcing one to be primary would be arbitrary).

| Slice | Call returns | Rule part |
|---|---|---|
| `value` | `TRow[]` | 1 — already shipped |
| `columns` | `ColumnDef[]` | 1 — already shipped |
| `grouping` | `string[]` | 1 — already shipped |
| `editing` | `ReadonlySet<RowId>` (`open`) | 1 — already shipped |
| `sorting` | `SortRule[]` | 1 — `sortDirections`, `sortChanged` become properties |
| `selection` | `ReadonlySet<RowId>` | 1 — `selectionChanged` becomes a property |
| `expansion` | `Set<RowId>` | 1 — `everExpanded`, `rowExpanded` become properties |
| `filtering` | *(not callable)* | 3 — `columnFilters`/`globalFilter` are peers |

## `withComputed()` block placement

Placement follows declaration site: nested inside a feature (`withSelection(cfg,
withComputed(...))`) lands on that feature's slice — it can only see core plus that feature's
members (D22), so it's that feature's knowledge; top-level lands flat — it sees every earlier
feature and belongs to none of them. Once the four shipped features migrate, nothing
library-owned is flat, so a bare `table.hiddenSelected()` reads unambiguously as
consumer-declared.

## Alternatives considered

- **Leave flat** (`table.rowIdsOf(group)`). Rejected — feature-specific verbs with invisible
  preconditions accumulate on the flat surface.
- **Namespace behavior only, keep state flat.** Rejected — two permanent conventions, with the
  state/behavior boundary guessed per new member.
- **Namespace per feature** (`table.rowEdit.editing`). Rejected — `withRowEdit()` composes
  `withOptimistic()` internally, so this would produce two doors (`table.rowEdit.editing` and
  `table.optimistic.editing`) to one concern, exactly the coupling D37 removed.

## Consequences

**All four shipped features migrate; nothing is grandfathered.** `withSorting()`'s pre-D30 bare
verbs (`toggleSort`/`setSorting`/`clearSorting`) stop being grandfathered; every verb on
`sorting`/`selection`/`expansion` moves onto its slice (e.g. `table.toggleSort(id)` →
`table.sorting.toggle(id)`). `filtering` becomes a non-callable namespace.

- **Sequencing.** Do not start implementation before #77 (positional composition) is green —
  stacking a second structural migration on an unverified one gives any failure two candidate
  causes. Spec work is not blocked.
- **ADR-0007's member-claim registry stays**, and guards less: each feature claims one key, so
  collisions become near-impossible by construction. The D37 case still claims one key from two
  features, and consumer `withComputed` blocks still collide in the flat space.
