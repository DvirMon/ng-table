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
features: [withOptimistic<Person>(), withRowEdit<Person>()]
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
Error: feature #1 already claims member 'editing' (claimed by feature #0)
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
resulting members as its own — one claim, not two. The alternative shape (both features in the
`features` array, the second detecting and reusing the first's state through the `composed` seam)
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
