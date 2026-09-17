# ADR-0007 — Features claim their member keys, and a collision throws

**Status:** accepted — implemented 2026-08-26
**Date:** 2026-08-26
**Related:** [ADR-0003](0003-in-house-table-store-engine.md) (the feature contract this extends),
[ADR-0006](0006-row-id-state-reconciliation.md) (the other contract obligation features carry),
`docs/1-state/work/with-optimistic/2-decisions.md` (D37, the split that surfaced this)

## Context

`composeTable()` folds features by merging what each one declares into a shared object:

```ts
Object.assign(composed, spec.members);
```

`SlotRegistry` guards two of the three things a feature can declare. A second feature claiming an
occupied `stages` key throws; a second claiming `renderRows` throws. **Members are not guarded at
all** — the later feature silently wins, and the earlier feature's state signal is orphaned: still
written by its own closures, read by nobody.

Nothing composed today collides, so the hole has never fired. D37 changes that. `withRowEdit()`
composes `withOptimistic()` internally, and both declare `editing` and `pending`. A consumer
writing the reasonable-looking:

```ts
createTable(data, config, withOptimistic(), withRowEdit())
```

gets two independent snapshot signals. `table.editing.update(captureEdit(id))` writes one;
`table.pending()` reads the other. No error, no warning — restore points that are captured and
then never found, which surfaces as rollback silently doing nothing.

The failure is worse than a stage collision precisely because it is *quiet*. A duplicated sort
stage produces visibly wrong row order. A duplicated member produces a feature that appears to
work until the exact moment its state is needed.

## Decision

`SlotRegistry` gains a member-key claim alongside `claimStage` and `claimRenderRows`.
`foldFeatures()` claims every key in `spec.members` before merging it, and a collision throws at
construction with the same named-feature message shape the existing claims use:

```
[createTable] feature 1 (withOptimistic) and feature 2 (withRowEdit) both provide the "editing" store member. Only one feature may provide each member.
```

This is a change to the **feature contract**, not to one feature — which is why it is an ADR and
not a decision in the editing work folder. Every feature is subject to it; every future feature
inherits it.

## Consequences

**Nothing composed today starts throwing.** `withSorting()`, `withExpansion()`,
`withColumnsSchema()` and `withRowEdit()` declare disjoint member sets. The claim is a guard
against future composition, not a migration.

**Two features can no longer deliberately override each other's members.** That capability was
never used and never documented; it existed only as a property of `Object.assign`. Anything
wanting it now needs an explicit mechanism rather than merge order.

**Feature-to-feature composition must be explicit about who declares what.** Under D37,
`withRowEdit()` composes `withOptimistic()` by calling its factory directly and re-exposing the
resulting members as its own — one claim, not two. The alternative shape (both features passed as
positional arguments, the second detecting and reusing the first's state through the `composed` seam)
becomes impossible, which is intended: it was order-dependent, and its failure mode when the
order was wrong was the same silent one this ADR closes.

**One more thing that can fail at construction.** Consistent with the existing slot claims and
with `createTable()`'s general posture — configuration errors surface when the table is built, not
when a user clicks something.

## Alternatives considered

**Warn instead of throw.** Rejected. The whole problem is a failure nobody notices; a console
warning in a library is a failure nobody notices.

**Let `withRowEdit()` check `composed` and throw itself.** Rejected as the primary fix — it is a
narrow guard for one pair that leaves the general hole open, and it reintroduces the array-order
dependency it was meant to remove. Nothing prevents adding it as a friendlier message on top of
the registry claim.

**Namespace members per feature** (`table.rowEdit.editing`). Rejected. It solves collisions by
making them impossible, but at the cost of the flat store surface every existing feature and
directive reads, and it would make D37's "one door — `table.editing` regardless of composition"
unexpressible.

## Amendment (2026-09, #67): core-key pre-claims, the unclaimed `totalRowCount`, derive-block claimants

Positional composition (`createTable(data, config, ...features)`, ADR-0003's 2026-09 amendment)
extended the claim mechanism in three ways a feature author hits directly.

**The engine pre-claims its own core members.** `composeTable()` builds the base store before the
fold and calls `registry.claimCoreMembers()` first, so `columns`, `rows`, `trackBy`, `value`,
`renderRows` and `indexById` (`CORE_MEMBER_KEYS`, `engine/slots.ts`) are already claimed under the
owner name `core` when the first feature runs. A feature declaring one collides at construction
like any other member clash instead of silently shadowing the engine's own:

```
[createTable] core and feature 2 (withSelection) both provide the "rows" store member. Only one feature may provide each member.
```

A feature-vs-feature collision reads the same way, with both sides named by argument position:

```
[createTable] feature 1 (withRowEdit) and feature 2 (withOptimistic) both provide the "editing" store member. Only one feature may provide each member.
```

Positions are 1-based and are the consumer's own argument positions — the pre-claim does not shift
them. Engine-spliced features (the column-schema wiring) fold first but are labelled
`internal feature N` on a separate count, and a feature nested inside a `composeFeatures()`
composite is labelled `composeFeatures inner feature N (displayName)`, since the composite's own
argument position is not knowable from inside a `Feature`.

**`totalRowCount` is deliberately not pre-claimed.** It is the one core-adjacent key a feature is
allowed to provide, typed as `OverridableCoreKey` and excluded from `CORE_MEMBER_KEYS` by
construction — `exhaustiveCoreMemberKeys()` stops compiling if any *other* core member is left off
the list. The reason is ADR-0005: `totalRowCount` is the documented override point for
`aria-rowcount`, so a server-paged table must be able to report a total larger than the rows it
holds. This is the one place a feature wins over the engine by design rather than by collision.
Do not "fix" it by pre-claiming it.

**A derive block is a claimant too.** A trailing derive block contributes members through its host
feature, so its keys reach the fold already merged — invisible to `claimMember`. `mergeMembers()`
(`api/create-table-feature.ts`) therefore throws first, with the same wording, naming the block
rather than a position:

```
[createTable] the feature and its derive block both provide the "selectedCount" store member. Only one feature may provide each member.
```

A top-level `withComputed()` is an ordinary positional feature and carries `displayName:
'withComputed'`, so its collisions read `feature 3 (withComputed)`. The registry stays the single
collision authority in both cases; only the label differs.
