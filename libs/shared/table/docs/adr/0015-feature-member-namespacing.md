# ADR-0015 — Should a feature's behavior functions live under a feature namespace?

**Status:** proposed — not decided, opened 2026-09-11
**Date:** 2026-09-11
**Related:** [ADR-0007](0007-feature-member-claims.md) (rejected namespacing as a collision fix —
this reopens it on different grounds), [ADR-0003](0003-in-house-table-store-engine.md) (the feature
contract), `docs/1-state/work/with-grouping/2-decisions.md` (D1, the `WritableView` shape),
`docs/1-state/work/with-optimistic/2-decisions.md` (D30, D37)

## Context

`composeTable()` merges every feature's declared members onto one flat object, so a composed table
reads as `table.selectedRows()`, `table.toggle(id)`, `table.grouping.update(...)`.

This is settled for **state**. It is unexamined for **behavior functions that take an argument and
belong to one feature's domain**, because until now there were almost none.

`withGrouping()` produces the first clear case. Designing group selection
(`docs/0-product/grouping.md` §X-G1, OQ-1) landed on the library exposing one thing — the leaf row
ids beneath a group header — and letting the consumer own the cascade:

```ts
rowIdsOf(group: RenderRow<TRow>): readonly RowId[]
```

Flattened, that is `table.rowIdsOf(group)`, which reads as a core capability of every table. It is
not: it is meaningless unless `withGrouping()` is composed, and it is entirely grouping's knowledge.
Contrast `table.grouping.rowIdsOf(group)`, where the receiver states the precondition.

The question generalises past grouping: as features grow behavior surface rather than state surface,
does the flat store still read correctly?

## What ADR-0007 already decided, and why this is not a re-litigation

ADR-0007 considered namespacing and rejected it — but **only as a solution to member-key
collisions**, which it solved instead with a construction-time claim. Its rejection reads in full:

> **Namespace members per feature** (`table.rowEdit.editing`). Rejected. It solves collisions by
> making them impossible, but at the cost of the flat store surface every existing feature and
> directive reads, and it would make D37's "one door — `table.editing` regardless of composition"
> unexpressible.

Two things follow.

**The collision argument is gone.** Member collisions throw at construction as of 2026-08-26. Any
reopening that leads with "namespacing prevents collisions" is arguing against a solved problem and
should be refused on that ground alone.

**The new argument is different and was never weighed.** ADR-0007 was reasoning about *state*
members (`editing`, `pending`) reached through one door. The case here is a *function of an
argument* whose flat name misrepresents which feature it requires. Whether the "one door" principle
extends to behavior functions is the actual open question, and ADR-0007 does not answer it because
it never faced one.

## The objection that must be answered

D37's "one door" is the serious obstacle, not the migration cost.

`withRowEdit()` composes `withOptimistic()` internally and re-exposes its members as its own, so
`table.editing` means the same thing regardless of which of the two the consumer composed. Under
namespacing, `table.rowEdit.editing` and `table.optimistic.editing` are different doors, and the
consumer must know which feature is underneath — precisely the coupling D37 removed.

A proposal that namespaces everything contradicts this directly. Any proposal that survives must
either overturn D37's one-door property deliberately, or draw a defensible line between state
(flat, one door) and behavior functions (namespaced) — and a line that the composing-feature case
does not immediately break.

## Options, not yet weighed

1. **Leave flat.** `table.rowIdsOf(group)`. Zero migration. Accepts that the flat surface will
   accumulate feature-specific verbs whose preconditions are invisible at the call site.
2. **Namespace behavior only, keep state flat.** `table.selectedRows()` stays; `table.grouping
   .rowIdsOf(g)` is new-style. Answers the readability problem without touching D37's state doors —
   but ships two conventions, and the state/behavior boundary needs defining precisely enough that
   nobody has to guess which side a new member falls on.
3. **Namespace everything.** Consistent, and a breaking change to four shipped features plus every
   story template and directive that reads them. Must overturn D37 explicitly.
4. **A callable slice object** — `table.grouping()` returns state, `table.grouping.rowIdsOf(g)` is
   behavior, the shape `WritableView<T, Updater>` (D30) already has. Note the Angular Signal Forms
   analogy that prompted this is **not** precedent: `field.errors()` is state hanging off a
   callable, not a function of an argument. The shape may still be right; the citation is not
   support for it.

## The primary-signal rule (settled 2026-09-11)

Independent of which option wins, a slice is a callable and a call returns exactly one value. Most
features own several state signals, so "which one does the call return?" needs a rule, not a
judgment per feature — six unwritten judgments is how a convention drifts.

**The rule, in three parts.**

1. **The call returns the feature's primary state** — the single value answering "what is this
   feature's current setting?" Every other state signal stays **its own signal**, exposed as a
   property on the slice.

   ```ts
   table.sorting()              // SortRule[]        — primary
   table.sorting.directions()   // Map               — still its own node
   table.sorting.changed        // Observable
   table.sorting.toggle(id)     // behavior
   ```

2. **A slice call never returns a composite object.** `computed()` compares with `Object.is`, so a
   computed building an object literal is never equal to its previous value: every reader
   invalidates when any field changes, and the fan-out is readers × fields. `withOptimistic()`
   alone would put four fields behind one node.

   This is not hypothetical — the codebase already made the correct split.
   `api/features/editing-state.ts:212` holds one composite `state` signal (so a write is atomic and
   `pending` can never read a half-applied state), and `OptimisticMembers` exposes `editing`,
   `pending`, `pendingOps`, `unconfirmed` as four separate derived signals. **Composite for
   writing, per-field for reading.** A composite slice call would undo the read half.

   A consumer can re-memoize with `computed(() => table.optimistic().editing)`, so this is a DX
   regression rather than a correctness bug — but it is one the library already pays for them.

3. **No obvious primary ⇒ the slice is not callable.** It is a plain namespace object instead.
   `withFiltering()` is the live case: `columnFilters` and `globalFilter` are peers, and forcing
   one to be primary would be arbitrary and breaking to revisit.

   ```ts
   table.filtering.columns()    // no table.filtering() at all
   table.filtering.global()
   ```

   A non-callable slice is a deliberate, visible outcome of the rule — not an exception to it.

**Primary per feature, applying the rule:**

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

Four of the eight already satisfy the rule, which is the point: it describes what `WritableView`
has been doing since D30 rather than introducing a new shape.

**Corollary — slices are named after the state concern, not the feature.** `selection`, `sorting`,
`grouping` and `expansion` coincide with their feature names, which makes it easy to miss that they
are not the same thing. `editing` is the case where they differ: `withOptimistic()` and
`withRowEdit()` both feed `table.editing`, and naming slices after features would produce
`table.optimistic` / `table.rowEdit` — the two doors D37 exists to prevent.

## Where a `withComputed()` block lands (settled 2026-09-12)

`docs/1-state/work/computed-state-mechanism/` (D21/D22, `ready for issues`) lets a consumer declare
derived state in two positions. Under a flat surface both land flat. Under slices, placement needs a
rule, because the nested position has an obvious owner and the top-level one does not.

**The rule: placement follows declaration site.**

```ts
createTable(data, config,
  withSelection(cfg, withComputed((store) => ({ hiddenSelected: ... }))),  // → table.selection.hiddenSelected()
  withGrouping(),
  withComputed((store) => ({ groupTick: ... })),                           // → table.groupTick()
);
```

- **Nested in a feature** → that feature's slice. A derive declared there can only *see* core plus
  that feature's members (D22), so it is that feature's knowledge, and the receiver states the
  precondition — the same argument `rowIdsOf` is decided on, applied to consumer code.
- **Top-level** → flat. It sees every feature before it and belongs to none of them.

**This does not break D22's "one type serves both placements."** `withComputed` returns the same
`Feature<In, D>` either way and does not know where it sits; the **host** decides the merge target —
`withSelection()` merges `D` onto its own slice, `createTable()` merges it flat. D22's unification is
about the type, not the merge site.

**Three properties this buys.**

1. **Placement is derivable, not judged.** The consumer chooses by where they write the block. No
   per-derivation decision, and moving a block moves its member — visibly.
2. **Flat becomes the consumer namespace; slices are the library namespace.** Once the four shipped
   features migrate, nothing library-owned is flat, so a bare `table.hiddenSelected()` reads
   unambiguously as consumer-declared. The two spaces stop competing for the same keys.
3. **Fewer collisions, not more.** Two features each nesting a derive named `count` produce
   `table.selection.count` and `table.grouping.count`. Flat, they collide and ADR-0007 throws.

**To verify before implementing.** `withSelection(cfg, derive)` must return
`Feature<In, { selection: SelectionSlice & D }>`. D22 recorded counter-evidence that an intersection
in the *return type* of `withComputed` breaks slot inference (`probe-r1-featurederive.ts.txt`,
degrading to `Signal<any>`). The intersection here sits inside the members object rather than in the
feature's return type, so it should be unaffected — but it is the same mechanism and wants its own
probe, not an assumption.

## Consequences of deciding either way

Deciding **flat**: `withGrouping()`'s remaining unbuilt members (D4, D6–D8, D11) ship flat and the
question is closed for this feature. Cheapest, and the accumulated cost lands on whoever reads the
table surface in a year.

Deciding **namespaced**: grouping is the cheapest feature to shape, since most of its surface is
unbuilt. Shipped features migrate as separate work rather than blocking it — which means a period
with two conventions live either way, and a decision on whether that period is bounded.

## Not in scope

The generic-parameter drift found alongside this (`withSorting<Person>()` in 20+ doc call sites,
and `ADR-0003:129`'s "Consumers still repeat `<TRow>` per feature", both now false — `NoInfer<TRow>`
on `TableSchema.features` makes bare calls infer) is a documentation sweep, unrelated to this
decision.
