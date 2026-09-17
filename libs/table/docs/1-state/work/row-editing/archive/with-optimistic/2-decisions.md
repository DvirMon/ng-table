---
title: Decisions — Optimistic Rollback (NGP Table state layer)
type: decisions
status: implemented 2026-08-26 — see "Amended during implementation"
date: 2026-08-26
---

# Decisions — Optimistic Rollback

Episodic work folder for splitting optimistic rollback out of `withRowEdit()` so a live
(always-editable) table can use it. Continues the numbering of
[`work/with-row-editing/2-decisions.md`](../../active/with-row-editing/2-decisions.md) and
[`work/with-mutations/2-decisions.md`](../with-mutations/2-decisions.md) — D-numbers and
O-numbers are global across all three folders. Last allocated before this file: **D36**, **O23**.

**This file is the reasoning, not the contract.** The shipped surface is specced in
[`features/row-editing.md`](../../../../features/row-editing.md); the gap register is
[`work/with-row-editing/5-gaps.md`](../../active/with-row-editing/5-gaps.md).

Two decisions below were **amended while implementing them** — `cancelEdit` turned out to be a
duplicate verb, and the internal composition took a simpler shape than D37 described. Both are
recorded at the end rather than edited away, since the reasoning that produced them is still
the reasoning that justifies the result.

## What started this

Two observations, in order:

1. **The live table has no optimistic story.** S1 (`docs/3-ui/work/row-edit-stories/1-proposal.md`)
   composes no editing feature at all (D29), so it has no `snapshots` map and nothing to roll back
   to. `beginEdit` and `addNewRow` are the only writers of a restore point, and a live table calls
   neither.
2. **Rollback should be the table's added value, not a flag.** Everything else an editable table
   needs — field values, dirty, validity — is already Signal Forms' job (D1/D22). What the table
   uniquely owns is the restore point around an async commit.

---

## D37 — Optimistic rollback is its own feature, composed by `withRowEdit()` (2026-08-26)

**Decision:** split the editing state into two features over one shared state shape.

```ts
interface EditingState<TRow> {
  readonly snapshots: SnapshotMap<TRow>;   // restore points  — withOptimistic
  readonly open: ReadonlySet<RowId>;       // rows showing inputs — withRowEdit
}
```

- `withOptimistic()` owns `snapshots`, exposes `captureEdit` / `releaseEdit` / `revertEdit`.
- `withRowEdit(config)` composes the same state **internally** (never via the `features` array)
  and adds `open`, `multiple`, and `beginEdit` / `endEdit` / `clearEditing`.

Both expose the same member, `table.editing` — one door for the consumer regardless of which
feature is composed. `withRowEdit` does not re-expose a second `table.optimistic` slice.

**Rationale — the coupling was one-directional and shallow.** Audited against the shipped code:

| Updater | Reads `open` | Survives `open` permanently empty |
|---|---|---|
| `settleEdit` | guard only | yes — degenerates to "has snapshot" |
| `revertEdit` | not at all (the `withoutOpen` call is a no-op) | yes |
| `pendingIds` | as a subtraction | yes — pending becomes all snapshots |
| `beginEdit` | **writes it** | no |

Only `beginEdit` genuinely couples the two, because it is the sole *capture* entry point and also
opens the row. Giving the optimistic slice its own capture verb (D40) removes that, and the rest
degenerates harmlessly — the live table needs no `open`, and `withRowEdit` needs no `live` flag.

**This partially resolves O22, and deliberately not all of it.** O22 laid out two designs and
picked neither. Its Option 2 — *"Optimistic-ness becomes its own concern… `withRowEdit()` would
compose it rather than own it"* — has two halves:

| Half of O22 Option 2 | Status |
|---|---|
| Own feature, composed by `withRowEdit()` | **taken** — this decision |
| Inverse operation instead of a value snapshot | **still deferred** |

We keep value snapshots. So **G5 stays open**: optimistic rollback still covers update and create
only, and still cannot cover delete or move — `revertEdit` replaces in place and cannot re-insert,
and a snapshot holds a value, never an index. Splitting the feature changes *who owns* the
restore point, not *what a restore point can express*.

**Rejected — snapshots move to core instead of a feature.** Every table would carry a restore-point
map whether or not it edits, and "restore point for a write" would become a property of the value
slice, contradicting D8's core/feature line. Cheaper for the consumer (composes nothing), more
expensive for every non-editing table.

**Consequences:** ADR-0006's `onRowsRemoved` splits — session prunes `open`, optimistic prunes
`snapshots` and owns the `ABSENT` exemption (D28). G2 was closed by that code; the split must
preserve it, and the exemption list in the table's `CLAUDE.md` needs updating.

## D38 — The feature's name must carry its scope (2026-08-26)

**Decision:** the feature is `withOptimistic()`, and its JSDoc must state the non-coverage inline —
update and create only, never delete or move, with a pointer to G5/O22.

**Rationale:** while rollback lived inside `withRowEdit()` its scope was self-evident from the name
— optimistic *editing*, not optimistic *CRUD*, exactly as O22 observed. Standalone and named for
the general concept, it now reads as covering optimistic delete, which it does not and cannot
(D37). The gap is unchanged; its *discoverability* got worse. A gaps file is not where a consumer
looks before calling a verb.

**Alternatives considered:** `withRowRollback()` / `withRestorePoints()` — both encode the
limitation in the name rather than the JSDoc, and are more honest for it. Weighed against
`withOptimistic()` reading better at the composition site and matching the vocabulary D31 already
established (`pending`, "optimistic save").

## D39 — Live tables compose `withOptimistic()`; D29 narrows (2026-08-26)

**Decision:** an always-editable table that wants rollback composes `withOptimistic()`. It never
composes `withRowEdit()`.

**D29 is narrowed, not superseded.** Its claim — `withRowEdit()` is not what an always-edit table
uses — still holds exactly. What changes is the corollary "the minimal live table composes
nothing": true only for a table with no rollback story.

**The edit session is the focus session.** A live table is not "always in edit mode" from the state
layer's view — the focused row *is* the row being edited. That reframe is what makes the same verbs
work in both modes:

```ts
// focus
table.editing.update(captureEdit(id));
// blur
table.value.update(patchRow(id, partial));
// server
ok ? table.editing.update(releaseEdit(id))
   : table.editing.update(revertEdit(id));
```

Falls out for free: focus is inherently single-row, so D31.2's *"`{ multiple: true }` combined with
optimistic save is undesigned"* narrows to button mode only. G4 is unaffected either way.

**Consequences:** E2's `table-edit-demo` must keep composing nothing (D29, and G12 pins it as the
reference for the minimal table). The live-table-optimistic path needs its **own** story, not a
change to E2.

## D40 — `captureEdit` replaces `rebaseEdit`; supersedes D34 (2026-08-26)

**Decision:** `captureEdit(id, row?)` — captures a restore point, **overwriting** any existing one.
Omitting `row` re-reads `data()` for the id (`ABSENT` if gone). No open-guard.

**Supersedes D34.** `rebaseEdit` did exactly this, with one extra condition: it no-opped unless the
row was open. That guard was only ever meaningful because capture lived on the session slice. Post
D37 it would make the verb dead on a live table — the one place it is now the primary entry point.

**The distinction against `beginEdit` is preserved, not lost.** `beginEdit` captures *if absent*
(D31.1 — oldest restore point wins, so Cancel returns to the true pre-edit state);
`captureEdit` overwrites. That difference is the whole of what D34 existed to express, so it
survives the rename as the difference between two verbs rather than a flag on one.

**G12's risk is already retired.** That register (2026-08-25) records `rebaseEdit` as *"a shipped
public verb, exercised only in unit tests"*, with a "simulate server push" control as the suggested
fix. That control now exists — `src/stories/external-write/` pushes a write to `data` underneath an
open row and calls `rebaseEdit(id, pushed)`. The verb we are renaming has field validation; 5-gaps
predates the story and is stale on this point.

## D41 — `endEdit` closes, `releaseEdit` drops; `keepSnapshot` is removed (2026-08-26)

**Decision:** the two things `endEdit` did become two verbs.

| Verb | Does |
|---|---|
| `endEdit(id)` | closes the row. Always keeps the restore point |
| `releaseEdit(id)` | drops the restore point |

Both take a **required** id. Bulk teardown is `clearEditing()`, which is not absorbed — see D44.

**Supersedes D31's `keepSnapshot` sub-decision.** `settleEdit` is renamed to `releaseEdit`, pairing
with `captureEdit` as acquire/release. `endEdit(id, { keepSnapshot: false })` becomes `endEdit(id)`
+ `releaseEdit(id)`.

**Rationale:** the flag existed only because one verb did two things. Optimistic becomes the default
by composition rather than by a boolean — which is the stated goal, and follows the house preference
for one composable operation over a flag per case.

**Why both verbs require an id.** An earlier draft let each take an optional id meaning "all". That
is unsafe in both directions. `endEdit()` closes every open row while keeping its restore point,
leaking every one of them into `pending` forever. `releaseEdit()` meaning "all restore points"
discards in-flight rollbacks — harmless on a button table where most restore points belong to rows
the user is typing in, catastrophic on a live table where **nothing is ever open**, so every restore
point belongs to a request still waiting on the server: a later rejection has nothing to roll back
to, `revertEdit` no-ops, and the rejected value stays on screen with no error and no way back.

Bulk teardown is one atomic verb (D44), not a pair of bulk forms that must be called in the right
order. There is deliberately no way to bulk-release *pending* rows — each settles on its own server
response, and a bulk release of in-flight saves has no legitimate caller.

**Accepted cost:** a non-optimistic close is now two calls instead of one. Between them the row
reads as `pending`, so any UI bound to `pending()` shows a one-tick "saving" flicker on a
local-only table. Real, minor, and must be stated in the spec rather than discovered.

## D42 — `beginEdit(id, { insert })` replaces `addNewRow`; supersedes D35/D36 (2026-08-26)

**Decision:** `beginEdit(id, { insert?: TRow; at?: number })`. With `insert`, the row is added to
`data` first, then captured as its own restore point and opened.

**Supersedes D35/D36 without changing their behavior.** D36 established that the restore point is
the row itself, not `ABSENT`, making `addNewRow` behaviorally identical to `addRow` + `beginEdit`
— *"pure ergonomics (one call instead of two), not a separate intent"*. A verb that is explicitly
not a separate intent should not be a separate verb. Same one call, one fewer name.

D36's consequence is unchanged: plain `revertEdit(id)` **resets** such a row rather than removing
it. Removal is still composed explicitly (`removeRow` + `endEdit`).

Session-slice only, so unavailable on a live table — correct, since a live table has no `open` to
insert into. It uses `addRow` + `captureEdit`.

## D43 — Trigger detection stays out of the engine; a consumer-placed directive may call the verbs (2026-08-26)

**Decision:** D20's rule holds unchanged — the engine detects nothing. It does not watch focus,
blur, dirty state, or `data`. "Editing" has exactly one definition: membership in the state.

A **directive the consumer places** on a row may call `captureEdit` on focus and `patchRow` +
`endEdit` on blur. That is consumer trigger policy expressed as a reusable directive, not engine
behavior — the same standing D18 gives row actions, which are consumer template code calling the
same updaters.

**Why this needed saying:** D20's rejected list names *"library-detected edit triggers (blur hooks,
dirty checking)"* explicitly. A focus/blur directive is a blur hook by any reading. The distinction
that keeps D20 intact is **who installs it**: opt-in, placed by the consumer, tree-shakeable,
absent unless asked for — versus the engine doing it for every table.

**Scope it with G1/G9/G10, not separately.** Those three (keyboard, focus management, a11y) are
already one directive effort by G12's ordering; a focus/blur commit trigger is a fourth
responsibility on the same element. Splitting it produces a directive that captures restore points
but does not restore focus.

## D44 — Bulk teardown stays one atomic verb: `clearEditing()` survives (2026-08-26)

**Decision:** `clearEditing()` is unchanged — closes every open row and drops their restore points
in a single write. D41 does **not** absorb it.

**Rationale — the split makes the composed form silently wrong.** With `endEdit()` and
`releaseEdit()` as bulk forms, the natural call order leaks:

1. `endEdit()` closes every open row — `open` is now empty
2. `releaseEdit()` scopes to open rows (nothing else is safe, see D41) — finds nothing
3. Every restore point survives with no open row behind it, so every row is **`pending` forever**

Which is precisely the failure `clearEditing`'s own doc comment says dropping-on-close exists to
prevent: *"closing without `keepSnapshot` and leaving the restore point behind would mark the row
`pending`, arming a rollback for a save nobody started."* The reverse order works, and nothing
enforces it — the wrong order fails with no error.

Splitting a verb is only safe when both halves are independently meaningful. `endEdit` and
`releaseEdit` are, **per row**. In bulk they are not: the first destroys the set the second needs.

**Consequence — two fused verbs, both for the same reason.** `revertEdit(id)` (restore + close)
and `clearEditing()` (close all + release all) both do two things in one write because their
halves must land together. That is the rule, not two exceptions.

*(Originally this named a third verb, `cancelEdit`. See A1 — it was a duplicate of `revertEdit`
and was dropped during implementation. Final count is six verbs, not seven.)*

Rejected: a bulk `revertEdit()` as the teardown form. It reverts rather than keeps, so
`gated-edit`'s "Close all" — which today keeps whatever the user typed — would start discarding it.
Different semantics, not a cheaper spelling of the same one.

**Not affected by D37's split.** `clearEditing` writes both slices, exactly as `beginEdit` does, so
it belongs to `withRowEdit()` and is unavailable on a live table. Correct: a live table has no open
rows to clear.

---

## Amended during implementation (2026-08-26)

### A1 — `cancelEdit` dropped: it was `revertEdit`

**D41/D44 introduced `cancelEdit(id)` as "revert and close, in one write."** Writing it revealed
that the shipped `revertEdit` already closes the row — its final write is
`{ snapshots: withoutSnapshot(...), open: withoutOpen(...) }`. `cancelEdit` would have been
byte-identical.

The error came from D37's framing: once `open` belongs to `withRowEdit`, it *looks* like the
optimistic slice cannot touch it, which implies a separate closing verb. But leaving `open` is
not the same as owning it — `withoutOpen` on a table where nothing is open is a no-op, which is
the same degeneration D37's own audit table already relied on for `revertEdit` and `pendingIds`.

**Final surface is six verbs**, not seven:

```
withOptimistic()   captureEdit · releaseEdit · revertEdit
withRowEdit()      beginEdit · endEdit · clearEditing
```

D44's rule is unchanged, only its examples: the two fused verbs are `revertEdit` and
`clearEditing`.

### A2 — both features call one shared factory, rather than one composing the other

**D37 says `withRowEdit()` calls `withOptimistic()`'s factory directly.** The implementation
instead extracts `createEditingStore()` (`api/features/editing-state.ts`) — not a feature — and
*both* `with-*()` files call it.

Same guarantees, one fewer moving part:

| D37's requirement | Held? |
|---|---|
| No cross-feature signal reads | yes — neither feature sees the other's state |
| Composition independent of `features` array order | yes — nothing is read from `composed` |
| One member (`table.editing`) either way | yes |
| Listing both in `features` throws | yes (ADR-0007) |

It also removes a risk the migration plan called out: `TableFeatureSpec` carries a single
`onRowsRemoved`, so a feature wrapping another's spec would have had to chain the two hooks by
hand, with silent state retention if anyone forgot. With one factory there is one hook and
nothing to chain.

`withRowEdit()`'s single-mode trim (D14) reaches the shared store through an `onWrite` option,
so the invariant still lives with the feature that owns it.

---

## Open — carried forward

- **O22** *(narrowed 2026-08-26 by D37)* ~~Is optimistic rollback an editing concern or a mutation
  concern?~~ **Ownership half resolved** — it is its own feature, composed by `withRowEdit()`
  (Option 2's composition half). What remains open is only the **representation**: a restore point
  holds a *value*, so delete and move stay uncoverable (G5, tracked as [#54](https://github.com/DvirMon/acme/issues/54)). Re-derive an inverse-operation
  representation when a consumer needs optimistic delete, reading it against D32 (a batched write
  is one rollback unit, not N) and against ADR-0006 (which locks in "no optimistic delete" rather
  than fixing it).
- **O24** *(new, from D37, tracked as [#53](https://github.com/DvirMon/acme/issues/53))* **Where does `swapRowId(from, to)` live after the split?** G3's leading
  fix re-keys whichever of `open` / `snapshots` hold `from` — post-D37 those sit in different
  features, so it straddles the boundary the same way `beginEdit` does. Plan G3 **after** this
  effort, not in parallel.
- **O25** ~~*(new, from D41)* `releaseEdit()` with no id discards every in-flight rollback.~~
  **Closed 2026-08-26 by D41 + D44** — there is no bulk form. Both verbs require an id; bulk
  teardown is `clearEditing()`, which stays atomic. The footgun cannot be spelled.
**The index of what is still open lives in the gap registers**, mapped to the gaps each question
gates: [state](../with-row-editing/5-gaps.md#open-decisions),
[UI](../../../3-ui/work/row-editing/5-gaps.md#open-decisions).

- **O11**, **O15**, **O16**, **O17**, **O19**, **O23** — unchanged, see
  [`../with-row-editing/2-decisions.md`](../../active/with-row-editing/2-decisions.md).

**Resolved here:** O22 (ownership half) → D37, O25 → D41 + D44.

## Engine change — needs an ADR, not a D

`withRowEdit()` composing `withOptimistic()` internally means a consumer writing
`features: [withOptimistic(), withRowEdit()]` composes it twice. Today `foldFeatures()` does
`Object.assign(composed, spec.members)` — `SlotRegistry` guards `stages` and `renderRows` only, so
the second silently overwrites the first and one snapshot signal is orphaned with no error.

**[ADR-0007](../../../../../adr/0007-feature-member-claims.md)** — written 2026-08-26, status
`proposed`. `SlotRegistry` gains a member-key claim alongside `claimStage` / `claimRenderRows`,
failing at construction with the same named-feature message. It changes the feature contract for
every feature, not just this pair, which is why it is an ADR. No feature composed today declares a
colliding member, so nothing existing starts throwing.

## Downstream doc updates this effort owes

| Doc | Change |
|---|---|
| `features/row-editing.md` | the whole verb surface; the `pending` flicker (D41) |
| `work/with-row-editing/5-gaps.md` | **stale** — predates `src/stories/`. G12's `rebaseEdit`, `clearEditing` and `{ multiple: true }` lines are closed by the `external-write` and `gated-edit-multiple` stories; only pessimistic save remains. Also: G5 restated against D38, G3 sequenced after (O24) |
| `table/CLAUDE.md` | ADR-0006 exemption list; `writable-view.ts` row naming `with-row-edit.ts` as the `editing` owner |
| `docs/3-ui/work/row-edit-stories/1-proposal.md` | S1 stays feature-free (D39); new story for the live-optimistic path |

## Story migration this effort owes

Five stories exist under `src/stories/`. Every one except `live-table` calls a renamed verb.

| Story | Change |
|---|---|
| `optimistic-save` | `endEdit(id, { keepSnapshot: true })` → `endEdit(id)`; `settleEdit` → `releaseEdit` |
| `external-write` | `rebaseEdit(id, pushed)` → `captureEdit(id, pushed)` |
| `gated-edit` | `addNewRow(...)` → `beginEdit(id, { insert })`; save-success `endEdit(id)` → `endEdit(id)` + `releaseEdit(id)`. `clearEditing()` unchanged (D44) |
| `form-write-mutations` | save-success `endEdit(id)` → `endEdit(id)` + `releaseEdit(id)` |
| `live-table` | unchanged (composes nothing, D39). Needs a **new** sibling story for the live-optimistic path |

The two save-success sites are where D41's accepted cost lands in real code: both are purely local
saves that were one call and become two, with a one-tick `pending` flicker between.
