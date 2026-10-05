---
title: Design — duplicate a row
type: plan
status: implemented 2026-08-27 — see docs/tasks/progress.md (4/4 steps)
date: 2026-08-27
parent: ../../features/row-editing.md
---

# Duplicate a row

Product input: [`0-product/row-editing.md`](../../../../../0-product/row-editing.md) §4.1/§4.2, which
marks duplicate ❌ not covered — it exists only as one line in D18's actions snippet
(`addRow({ ...row, id: newId() })`), with no story, no placement rule, and no uniqueness handling.

**Finding up front: duplicate needs no new API in either mode.** In gated mode it is `beginEdit`
with `{ insert }`, already shipped for the blank-row flow (D42); in live mode it is `insertRow` plus
`removeRow` on rejection. What the exercise turned up was a **doc/code mismatch** in `beginEdit`'s
header (fixed, below) and two renames.

> **Implemented 2026-08-27.** All four steps landed — the `insertRow` rename, the `beginEdit`
> invariant-comment fix, the doc updates, and a Duplicate action in `gated-edit/`. `clearEditing` →
> `clearEdit` followed on the same day. Both tsconfig projects typecheck clean. This file is the
> reasoning; the shipped surface is in
> [`features/row-editing.md`](../../../../features/row-editing.md).

## What duplicate is, mechanically

An add whose initial value comes from an existing row instead of from blank. Every question it
raises is an add question with a different starting value — which is why D42's work mostly covers
it.

| Question                            | Answer                                                                                   | Owner    |
| ----------------------------------- | ---------------------------------------------------------------------------------------- | -------- |
| What id does the copy get?          | consumer-supplied — the library never fabricates one (D26)                               | consumer |
| Which fields are copied?            | all, unless the consumer overrides — the library cannot know which fields must be unique | consumer |
| Where does the copy land in `data`? | immediately after its source: `at: sourceIndex + 1`                                      | library  |
| Where does it land _on screen_?     | see the limitation below                                                                 | neither  |
| Does it open?                       | gated: yes, already open. Live: it is editable like every row                            | library  |
| What does Cancel do?                | consumer's choice, one call either way (OQ-1)                                            | consumer |

## Gated mode — existing composition, no new verb

```ts
protected duplicateRow(sourceId: RowId): void {
  const source = this.data().find((row) => this.table.trackBy(row) === sourceId);
  if (source === undefined) return;

  const at = this.data().indexOf(source) + 1;
  this.table.editing.update(
    beginEdit(crypto.randomUUID(), { insert: { ...source, id: newId }, at }),
  );
}
```

One call. The copy is inserted, its restore point is captured (the row itself, per D42), and it
opens — the same three effects the blank-row flow gets.

**Cancel follows OQ-1 and needs nothing new**, now that D46 made both outcomes one call:
`revertEdit(id)` resets the copy to its inserted values, `discardEdit(id)` removes it. Which one the
Cancel button calls is the app's product decision, recorded as consumer policy.

**Recommended default for a consumer to copy:** `discardEdit`. A stray full copy of a real row looks
like real data in a way a stray blank row does not.

## Live mode — no new verb needed

An earlier draft of this design proposed `insertEdit(row, { at })` to complete D47's
capture-composing family (`removeEdit`, `patchEdit`, …). **Rejected 2026-08-27.**

**Capture exists to preserve information that would otherwise be lost.** Deleting a row loses its
values and its position, so `removeEdit` must snapshot them before the write. Inserting loses
nothing — the prior state _is_ nothing, and undoing an insert needs only the row's id, which the
caller already holds because it supplied it (D26). There is nothing to save first.

So an optimistic create on a live table is complete as:

```ts
table.value.update(insertRow(copy, { at }));
// server rejects:
table.value.update(removeRow(copy.id));
```

**The asymmetry in D47's family is principled, not an oversight** — and the feature spec should say
so, since "why is there no `insertEdit`?" is an obvious question for anyone reading the family.

## Rename — `addRow` → `insertRow` (decided 2026-08-27)

The verb inserts at an index with `Array.prototype.splice(at, 0, row)` semantics, which
`row-mutations.md` already spends a warning box distinguishing from `at()`. "Insert" describes that;
"add" does not. It also reads correctly for the duplicate flow, which is an insertion at a specific
position rather than an addition to a set.

Breaking change to a public export (`index.ts`), taken now because D46's `ABSENT` removal is already
breaking the surface this cycle — the two migrate together at no extra cost.

Call sites: `index.ts`, `row-mutations.ts`, `row-edit-mutations.ts` (`beginEdit`'s `{ insert }`
branch), `optimistic-mutations.ts` (`revertEdit`'s re-insert path), the specs, and the stories.

### The suffix rule, stated (2026-08-27)

**A verb that affects editing state gets `*Edit`. A verb that only writes rows gets `*Row`.**

Editing state means `snapshots` **and** `open` — restore points are editing state, not a separate
concept. So a verb that writes rows _and_ touches a restore point is an `*Edit` verb; writing rows
is not disqualifying, writing _only_ rows is.

Checked against the shipped surface, every name already complies:

| Verb                                      | Touches editing state         | Suffix     |
| ----------------------------------------- | ----------------------------- | ---------- |
| `insertRow`, `removeRow`, `patchRow`      | no — rows only                | `*Row` ✅  |
| `beginEdit`, `endEdit`                    | `open`                        | `*Edit` ✅ |
| `captureEdit`, `releaseEdit`              | `snapshots`                   | `*Edit` ✅ |
| `revertEdit`, `discardEdit`, `removeEdit` | `snapshots` + `open` (+ rows) | `*Edit` ✅ |
| `patchEdit`                               | `snapshots` (+ rows)          | `*Edit` ✅ |

**No renames follow from this beyond `insertRow`.** An earlier draft argued `removeEdit`/`patchEdit`
were misnamed because they have nothing to do with an _edit session_ — that read `Edit` as "session"
rather than "editing state". Under the rule above they are correct as they stand.

**One real inconsistency, now fixed:** `clearEditing` was the only verb using the gerund. Renamed to
**`clearEdit`** on 2026-08-27, alongside `insertRow`. Definition, export, spec, stories and JSDoc
all updated; both tsconfig projects typecheck clean.

## Defect found — `beginEdit` does not no-op on a live table — **FIXED 2026-08-27**

Resolved by the second of the two options below: the claim was deleted and replaced with what the
code actually does. `row-edit-mutations.ts`'s header now states that the verbs write `open`
unconditionally, that this is _meaningless-but-not-inert_ on a `withOptimistic()`-only table, and
that populating `open` there silently shrinks `pending` — the signal a live table actually reads.

The original entry follows.

`row-edit-mutations.ts`'s header stated:

> The edit-session verbs — `withRowEdit()`'s slice (D37). They write `open`, so they no-op on a
> table composing only `withOptimistic()`, where nothing opens a row.

**The code does not do this.** `beginEdit` writes `withOpen(state.open, id)` unconditionally; there
is no feature check anywhere in the file. `withOptimistic()` exposes the same `editing` view, so
calling `beginEdit` on a live table **populates `open`** — breaking the documented invariant that
`table.editing()` is always empty there, and silently shrinking `pending` (derived as `snapshots`
minus `open`), which is the signal a live table actually reads.

Not covered by tests: `with-optimistic.spec.ts` never calls `beginEdit`.

Two ways out, both cheap: make the claim true (the editing store knows whether an open set is
meaningful, so the updaters can be no-ops under `withOptimistic` alone), or delete the claim and say
plainly that the edit-session verbs are meaningless-but-not-inert on a live table. **Either is fine;
leaving the doc asserting an untrue invariant is not.** — _The second was taken; the code is
unchanged and only the comment moved._

## Limitation — "below its source" is storage order, not display order

`at: sourceIndex + 1` places the copy after its source **in `data`**. Under an active sort the
pipeline reorders, and `row-mutations.md` is explicit that no value of `at` can place a row at a
chosen display position — it is unrepresentable in storage coordinates, not a mapping waiting to be
written.

So the product requirement "the copy appears immediately below its source, because the person needs
to compare the two" **holds only when no sort is active**. Under a sort the copy lands wherever its
values sort to.

This is the same shape as §2.2 (finding a newly added row under a sort) and belongs with it: it
wants the row held in place for the duration of the edit, which is OQ-3's gated row-hold. Duplicate
is the strongest argument for that hold, since comparing source and copy side by side is the entire
point of the operation.

## Story this owed — delivered

`gated-edit/` gains a Duplicate action — the first demonstration of it anywhere. It should show the
copy landing directly under its source and Cancel removing it, since that pairing is what
distinguishes duplicate from add.

## Open questions

- ~~**Should `beginEdit({ insert })` still capture the inserted row as a restore point?**~~
  **RESOLVED 2026-08-27: yes, unconditionally.** An earlier draft argued the capture "pre-decides
  what Cancel means". It does not. Cancel is a UI event, and the button calls one of two verbs:
  `discardEdit(id)` removes the row, `revertEdit(id)` restores it. **That call site is the decision**
  — there is no branch inside either verb, and no policy in the capture. What the capture does is
  make the second verb _available_: without a restore point, `revertEdit` has nothing to restore and
  only one of the two outcomes exists. Capturing costs one map entry and keeps both open.

  This also states the rule for the whole family, which was previously implicit: **capture never
  chooses an outcome, it only preserves the option.** `insertEdit` was rejected above because an
  insert has no option to preserve — not because capture decides anything.

- **Does a duplicated row's unique field get cleared automatically?** Recommendation: no — the
  library cannot know which fields are unique, and the consumer already spreads the source row, so
  clearing is one property in their own object literal. Product's §4.1 asks for such fields to be
  _flagged_, which is a UI concern (validation on an open row), not a state one.
