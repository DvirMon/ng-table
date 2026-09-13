# ADR-0015 — A feature exposes one callable slice, keyed by state concern

**Status:** accepted — decided 2026-09-13, unimplemented
**Decision:** every feature exposes exactly one **callable slice**, keyed by state concern. All four
shipped features migrate in this migration — nothing is grandfathered.
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

## The D37 objection — real for feature namespacing, void for slices

The objection this ADR opened on: `withRowEdit()` composes `withOptimistic()` internally, so
`table.editing` means the same thing regardless of which the consumer composed. Namespacing would
give `table.rowEdit.editing` and `table.optimistic.editing` — two doors, the exact coupling D37
removed.

**That kills Options 2 and 3 and leaves Option 4 untouched**, because a slice is keyed by **state
concern**, not by feature. D37 already guarantees one slice per concern, which is precisely what
makes the slice shape work: `table.editing.captureEdit(id)` is reached through the same single door
as `table.editing()`, under either feature. This ADR does not overturn D37 — it depends on it. See
the naming corollary under the primary-signal rule.

## Options, weighed

1. **Leave flat.** `table.rowIdsOf(group)`. Zero migration. Rejected — the flat surface accumulates
   feature-specific verbs whose preconditions are invisible at the call site, and
   `selectionStateOf(ids)` already ships as exactly that.
2. **Namespace behavior only, keep state flat.** Rejected — ships two conventions permanently, and
   the state/behavior boundary has to be guessed for every new member.
3. **Namespace per feature** (`table.rowEdit.editing`). Rejected — the D37 objection above, in full
   force.
4. **A callable slice per state concern.** ✅ **Chosen.** `table.grouping()` returns state,
   `table.grouping.rowIdsOf(g)` is behavior — the shape `WritableView<T, Updater>` (D30) already
   ships for `value`, `columns`, `editing` and `grouping`.

**Correction to this ADR as originally written.** Option 4 was filed with a note that the Angular
Signal Forms analogy "is not precedent: `field.errors()` is state hanging off a callable, not a
function of an argument." That is wrong on the facts, and it was the sentence keeping Option 4
unweighed. Verified against installed `@angular/forms` 22.1.2: `FieldState` carries `getError(kind)`,
`metadata(key)` and `hasMetadata(key)` — functions of an argument, on a callable.

The stronger precedent is mainline Angular rather than Forms. `signal()` is itself built this way
(`core/fesm2022/_pending_tasks-chunk.mjs:2769` — a getter function with `set`/`update`/`asReadonly`
assigned onto it), and `model()` goes further, carrying `subscribe` and `destroyRef`: members that
are neither writes nor state. Angular already treats the callable as a general namespace for
everything belonging to that reactive cell. Full write-up:
[`research-callable-slice-shape.md`](../1-state/work/feature-member-namespacing/research-callable-slice-shape.md).

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

**Verified, 2026-09-13** — type-level probe against the shipped
`createTable`/`withComputed`/`Feature<In, Out>` (post-#69/#73). The probe was a scratch file, not
kept; the signature and results below are the record, and it is a few minutes to rebuild from them.

D22 recorded counter-evidence that an intersection in `withComputed`'s *return type* collapsed the
derived member to `Signal<any>` (`probe-r1-featurederive.ts.txt`). The intersection here sits inside
the members object instead — `Feature<In, { selection: SelectionSlice & D }>` — and slot inference
survives it. Four checks, all green:

| Check | Result |
|---|---|
| `table.selection` is not `any` | ✅ |
| `table.selection.hiddenSelected` is `Signal<number>`, not `Signal<any>` | ✅ |
| The slice's own callable and verbs still resolve alongside `D` | ✅ |
| `RowOf<In>` still flows to the **next** slot after a sliced feature | ✅ |

Negative control run: flipping the expected type to `Signal<string>` fails with `TS2344`, so the
assertions bite rather than passing vacuously.

The proposed host signature, as probed:

```ts
declare function withSelectionSliced<In extends Shape, D extends DerivedDict>(
  config: WithSelectionConfig<RowOf<In>> | undefined,
  derive: Feature<NoInfer<In> & { selection: SelectionSlice }, D>
): Feature<In, { selection: SelectionSlice & D }>;
```

## Consequences

**All four shipped features migrate here; nothing is grandfathered.** A bounded breaking change
ending in one convention beats a permanent mixed surface. `withSorting()`'s pre-D30 bare verbs
(`toggleSort`/`setSorting`/`clearSorting`), grandfathered by D30, stop being grandfathered.

**Cost, priced against the current tree.** Smaller than ADR-0007 assumed — it named "the flat store
surface every existing feature and directive reads", and the directive half is false:
`src/directives/` reads **zero** feature members. Of ~105 `src/` member reads, ~100 are Storybook
hosts.

| Slice | Change |
|---|---|
| `value`, `columns`, `grouping`, `editing` | already callable — siblings fold onto them |
| `sorting`, `selection`, `expansion` | no callable today; every verb moves |
| `filtering` | non-callable namespace (primary-signal rule, part 3) |

`editing` is nearly free: every `table.editing.update(verb)` call site is untouched, because D30
already put the write path on the slice. `sorting`/`selection`/`expansion` carry the real cost —
`table.toggleSort(id)` becomes `table.sorting.toggle(id)`, `table.selectionStateOf(ids)` becomes
`table.selection.stateOf(ids)`.

**The shared-pass window with the positional migration has closed.** Issues #72–#74 converted every
`with-*()` file to `Feature<In, Out>` and #75 rewrote the library's Storybook hosts, so this is a
second pass over those same files. Only #76's consumer apps (`apps/demo`, `apps/ng-table`) are still
unwritten and can absorb both changes at once.

**Sequencing.** Do not start implementation before #77 (*integrate and verify positional
composition*) is green. Stacking a second structural migration on an unverified one gives any
failure two candidate causes. Spec work is not blocked.

**The flat namespace becomes the consumer's.** Once migration completes no library member is flat,
so a bare `table.hiddenSelected()` reads unambiguously as declared by this team — see the
`withComputed()` placement rule.

**ADR-0007's member-claim registry stays, and guards less.** Each feature claims one key, so
collisions become near-impossible by construction rather than by check. Keep it: the D37 case still
claims one key from two features, and consumer `withComputed` blocks still collide in the flat space.

## Not in scope

The generic-parameter drift found alongside this (`withSorting<Person>()` in 20+ doc call sites,
and `ADR-0003:129`'s "Consumers still repeat `<TRow>` per feature", both now false — `NoInfer<TRow>`
on `TableSchema.features` makes bare calls infer) is a documentation sweep, unrelated to this
decision.
