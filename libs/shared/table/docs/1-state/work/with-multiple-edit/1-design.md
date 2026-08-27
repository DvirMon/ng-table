---
title: Design — multiple open rows (`multiple: true`) semantics
type: plan
status: implemented — resolves G4 / product OQ-7; no open questions
date: 2026-08-27
parent: ../../features/row-editing.md
---

# Multiple open rows — semantics

Closes **G4** (`multiple: true` is a flag with no design) and product **OQ-7**, which chose
"design the semantics" over "refuse the combination" — refusing was impractical as well as
unattractive, since "an optimistic flow" is a consumer wiring pattern, not config, so there is
nothing reliable to detect at composition time.

Product input: [`0-product/row-editing.md`](../../../0-product/row-editing.md) §1.8.

## What is actually undefined — narrower than the label

D31.2 records `multiple: true` + optimistic save as undesigned, framed as "N open rows × M
in-flight saves." Checked against the shipped code, most of that is already well-defined:

| Concern | Status |
|---|---|
| Per-row isolation | **Fine.** `snapshots` is a map and `open` a set, both keyed by id. There is no shared editing state for N rows to contend over. |
| Partial failure of a batched save | **Fine.** Restore points are per row, so reverting row 2 out of a 3-row batch is three ordinary calls. D32's "a batched write is one rollback unit" constrains the *write*, not the recovery. |
| Save-all as a loop over `table.editing()` | **Fine.** Each iteration is an independent per-row sequence. |
| `open ⊆ snapshots` invariant | **Fine.** Every updater preserves it. |
| Bulk close while a save is in flight | **Broken — see below.** |

So one defect, with two entry points.

## The defect — bulk close discards live restore points

**D41 already established the rule this breaks.** `releaseEdit` was deliberately given no bulk
form, because dropping every restore point at once discards in-flight rollbacks: a later rejection
finds nothing to restore and the rejected value stays on screen silently.

Two operations do exactly that bulk discard anyway:

1. **`clearEditing()`** — drops the restore point of every open row (`row-edit-mutations.ts`).
2. **`closeAllButLast()`** — the single-mode trim, which deletes the snapshots of every displaced
   row (`with-row-edit.ts:26`).

In single mode both are at most one row wide, which is why this has never bitten. Under
`multiple: true` they are N rows wide.

### The reachable path, and it is not exotic

The pessimistic save flow — the one `features/row-editing.md` §5 documents — **keeps the row open
for the whole round trip**. So with `multiple: true`:

1. Open rows A, B, C. Save them pessimistically; all three stay open with saves in flight.
2. `multiple` flips false. The config's own documented idiom is `multiple: () => isWide()`, so
   this is a **window resize**, not a user action.
3. `onMultipleChanged` fires `closeAllButLast`, deleting A's and B's restore points.
4. A's save rejects. `revertEdit(A)` finds no restore point and **no-ops silently**. The rejected
   value stays on screen with no error and no rollback.

`clearEditing()` reaches the same end state from a "Cancel all" button while pessimistic saves are
in flight.

### The root cause — `pending` cannot express "open and saving"

`pending` is defined as *has a restore point and is not open*. A row that is open **and** has a
save in flight is therefore invisible to it, and indistinguishable from a row the user is merely
typing in. The library cannot tell them apart, so a bulk close cannot know which restore points are
load-bearing.

That is the real content of "N open rows × M in-flight saves." It is a state-modelling gap, not a
concurrency one.

## Recommended semantics

**Under `multiple: true`, bulk edit is optimistic-only: a save closes its row before it fires.**

```ts
// Save all — the defined shape
for (const id of table.editing()) {
  table.editing.update(endEdit(id));        // closes; row becomes `pending`
}
// then fire the writes; per row:
//   ok     -> table.editing.update(releaseEdit(id));
//   reject -> table.editing.update(revertEdit(id));
```

This makes every hazard above unreachable **with no new state**:

- A row with a save in flight is `pending`, never `open`.
- `clearEditing()` and `closeAllButLast()` only ever touch open rows, so they cannot reach a
  live restore point. D41's rule stops having a loophole.
- Partial failure is per row and already expressible.
- The UI follows naturally: click Save All, every row closes at once, each shows its own saving
  state, failures reopen or mark individually.

**Pessimistic save is unsupported under `multiple: true`** — and should be, independently of this
defect: holding N rows open across N round trips gives the person N editors they must not touch,
with no indication which are still live.

### How that is enforced

Preferred: **document it and let the shape carry it.** The safe sequence is also the natural one —
a Save All button closes the rows it saved. No runtime check, no new API.

Weaker alternatives, recorded so the choice is visible: a dev-mode warning when `clearEditing()`
or the single-mode trim would drop more than one restore point at once (cheap, catches the resize
path, noisy for legitimate Cancel-all); or an explicit `busy` set the consumer marks around a save
(honest, but it is a third row state the library has no other use for, and it exists only to make
pessimistic bulk edit work — a mode we are declining to support).

## Definitions this settles

| Affordance | State-layer meaning |
|---|---|
| **Save all** | `endEdit` per open row, then one write or N; `releaseEdit` / `revertEdit` per row as answers arrive |
| **Cancel all** | `clearEditing()` — closes every open row and drops their restore points in one write. Pending rows untouched (D44), which is now load-bearing rather than incidental |
| **Partial failure** | per-row `revertEdit`; failed rows may be re-opened with `beginEdit`, which is capture-if-absent and so restores the *original* pre-edit point (D31.1) |
| **Mode flip `true` → `false`** | closes every open row and drops their restore points, one write — no survivor chosen. Pending rows untouched. See the section below |

## Mode flip `true` → `false` — closes everything (decided 2026-08-27)

Two paths currently share `closeAllButLast`, and only one of them should.

| Path | Trigger | Behavior |
|---|---|---|
| **Single-mode trim** | a write that would leave >1 row open — `beginEdit(B)` while A is open | unchanged: keep the row just opened, close the rest (D14) |
| **Mode flip `true` → `false`** | `multiple` accessor turns false with N rows open | **close all N.** No survivor is chosen |

**Why no survivor.** `closeAllButLast` keeps the most recently opened row, which is meaningful for
the trim path — the user just asked for that row. On a mode flip nobody asked for anything; the
"most recent" row is whichever they happened to open last, possibly minutes ago. Picking it is
arbitrary, and it leaves one row open in a state the person did not request. Closing all is the
honest reading of "this table now edits one row at a time."

Mechanically this is `clearEditing()`'s behavior: close every open row, drop their restore points,
in one write. Rows that are `pending` are untouched — and under the optimistic-only rule above, an
in-flight save is always `pending` and never `open`, so **no live restore point can be dropped by a
mode flip.** That is what makes closing all safe here, and it is the same property that closes the
defect at the top of this document.

**Context on how live reaction got here.** The accessor form and its effect landed in `5170003`
(2026-08-26) for one stated reason: a Storybook arg control needs to flip `multiple` without
rebuilding the table. `multiple: () => isWide()` appears in the JSDoc as an illustration and has no
caller. So responsive collapse is not a use case anyone has yet — which is further reason not to
build survivor-selection logic for it.

## What this unblocks

- **O23** — `applyEditable({ when })`, declarative openness. A predicate matching N rows forces
  `multiple: true`, which was undesigned; it now has semantics to be designed against.
- **Bulk edit** generally — D32 routes it through this decision. Still needs `withSelection()` for
  the affordance; the **semantics** above do not depend on it.

## Not covered

- The Save All / Cancel All **affordances** — UI layer, and gated behind `withSelection()`.
- `batch()` (D32) — N `endEdit` calls are N signal writes and so N pipeline runs. Correctness is
  unaffected; this is the first flow with a real appetite for batching.
- Announcing bulk state changes to a screen reader — UI layer, G10.
