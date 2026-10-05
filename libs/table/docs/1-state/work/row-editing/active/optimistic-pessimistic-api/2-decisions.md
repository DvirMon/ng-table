---
title: Decisions — optimistic and pessimistic as a definitive API
type: decisions
status: open — D50–D57 reserved, rationale written per step as it lands
date: 2026-09-05
parent: ./1-proposal.md
---

# Optimistic / pessimistic API — decisions

> **This file is the reasoning, not the contract.** The shipped surface is specced in
> [`features/row-editing.md`](../../../../features/row-editing.md); the concept and its supersessions are
> in [ADR-0013](../../../../../adr/0013-optimistic-and-pessimistic-are-call-site-facts.md).

D- and O-numbers are **global** across the `1-state/work/` folders. Last allocated before this
file: **D49** (`swapRowId`, in [`with-row-editing/2-decisions.md`](../with-row-editing/2-decisions.md)),
**O26**.

## How this file gets written

Each decision below is **reserved, not yet written**. Per this repo's practice, the rationale lands
in the same commit as the code implementing it — D45–D47 shipped inside
`🎸 feat(shared-table/row-edit): optimistic delete rollback (D45-D47)` (2026-08-27), and D49 was
appended after `swapRowId` landed. Pre-writing all eight would be inventing rationale for code that
does not exist, and this repo's decision logs already show amendments (A1/A2 in
[`with-optimistic/2-decisions.md`](../../archive/with-optimistic/2-decisions.md)) where implementation taught
something the design pass missed.

Reserving the numbers now is the part that _is_ urgent: the sequence is global, so a concurrent
effort could otherwise take D50.

## Reserved

| #       | Title                                                                                           | Lands with                                                                                      |
| ------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **D50** | Optimistic and pessimistic are call-site facts, named by the verb — not configuration           | [ADR-0013](../../../../../adr/0013-optimistic-and-pessimistic-are-call-site-facts.md) (written) |
| **D51** | `beginEdit` loses its `{ insert }` data write; `createRow` becomes the only insert-and-arm verb | step 3a/3b                                                                                      |
| **D52** | `endEdit` splits into `commitEdit` (keep the restore point) and `closeEdit` (release it)        | step 3a/3b                                                                                      |
| **D53** | `RowRestorePoint.detached` becomes `op: 'create' \| 'update' \| 'delete'`                       | step 1                                                                                          |
| **D54** | `unconfirmed` becomes a library slice — unconfirmed identity outlives a restore point           | step 2                                                                                          |
| **D55** | Per-row error state stays consumer-side; the library cannot know when to clear it               | step 5                                                                                          |
| **D56** | A pessimistic create shows no row at all — composer form, no render-stage injection             | step 6                                                                                          |
| **D57** | Session verbs warn in dev mode on a `withOptimistic()`-only table                               | step 4                                                                                          |

## D50 — Optimistic and pessimistic are call-site facts, named by the verb (2026-09-05)

**Decision:** adopt the product-level definition — _optimistic_ is reflected before the server
answers, _pessimistic_ only after it confirms — as a **per-operation** axis (create / update /
delete) applying to live and gated tables alike. The mode is not library configuration but a
property of where in the async flow the call sits, so the verb names it rather than a config flag.

Full reasoning, the four verb families, the rejected alternatives, and the two doc claims this acts
on: **[ADR-0013](../../../../../adr/0013-optimistic-and-pessimistic-are-call-site-facts.md)**.

**Consequences:** supersedes [`3-ui/stories.md`](../../../../../3-ui/stories.md) :142 (which scoped the
axis to gated tables only); narrows — does not reverse —
[`0-product/row-editing.md`](../../../../../0-product/row-editing.md) OQ-7, whose finding that a flow is
undetectable _at composition time_ remains true. Obliges D51–D57 and the step sequence in
[`1-proposal.md`](1-proposal.md).

## D53 — `RowRestorePoint.detached` becomes `op: 'create' | 'update' | 'delete'` (2026-09-05)

**Decision:** replace the boolean `detached` field with `op: PendingOp` (`'create' | 'update' |
'delete'`), exported from `index.ts` alongside `RowRestorePoint`. The ADR-0006 keep-predicate in
`createEditingStore()`'s `onRowsRemoved` becomes `(v) => v.op === 'delete'` — `detached` was always
exactly `op === 'delete'` (ADR-0013 Decision 6), so this is a lossless field rename plus recovering
the information `false` used to erase.

**Where each value is assigned** — `detached: false` collapsed two different call-site facts into
one boolean, so restoring the distinction is a per-site judgment, not a mechanical find/replace:

| Verb                                                      | Site                                       | `op`                              |
| --------------------------------------------------------- | ------------------------------------------ | --------------------------------- |
| `captureEdit`, `patchEdit`                                | snapshot the row already present in `data` | `'update'`                        |
| `beginEdit(id)` (no `{ insert }`)                         | same — captures the found row              | `'update'`                        |
| `beginEdit(id, { insert })`, `createRow` (both overloads) | the row is new — inserted, not found       | `'create'`                        |
| `removeEdit`                                              | takes the row out of `data`                | `'delete'` (was `detached: true`) |

`revertEdit`, `discardEdit`, `releaseEdit`, `swapRowId` only read or re-key an existing snapshot —
none constructs a new one, so none needed a change beyond the type.

**Consequences:**

- Public breaking change lands now (foretold by D50/ADR-0013): `RowRestorePoint.detached` is gone;
  `RowRestorePoint.op` and `PendingOp` are the replacement, both exported from `index.ts`.
- `editing-state.ts`, `optimistic-mutations.ts`, `row-edit-mutations.ts` and their colocated specs
  all updated in the same commit; `detached` appears nowhere in `src/` afterward (confirmed by
  grep, including `src/stories/` as the proposal predicted).
- No behavior change — `pending()`, `onRowsRemoved`'s pruning outcome, and every existing test
  assertion are unchanged; only the vocabulary a failure handler can branch on grew (`op ===
'create'` is now askable, where before only `detached` — always `false` on every path except
  `removeEdit` — was).
- Sets up D54 (`unconfirmed`, step 2), which reads `op === 'create'` as its starting point before
  layering in the "outlives a restore point" gap noted in `1-proposal.md`.

## D54 — `unconfirmed` becomes a library slice (2026-09-05)

**Decision:** add `unconfirmed: ReadonlySet<RowId>` to `EditingState`, `pendingOps: ReadonlyMap<RowId,
PendingOp>` alongside the existing `pending`, and export both as members from `createEditingStore()`
— so `withOptimistic()` and `withRowEdit()` gain them identically, from the one store (D37/A2).
`pendingOps` replaces `pendingIds`'s internal role: `pendingIds` is now a thin projection of it
(`new Set(pendingOps().keys())`), so the two can never disagree (ADR-0013 Decision 6).

**Why not derive it from `op === 'create'` alone:** nearly works, but a failed create's
`revertEdit` spends the restore point — the exact verb a failure handler calls — while the row
must still POST on retry. `unconfirmed` is the identity that survives that spend; `op` does not
(`1-proposal.md`'s "State: what the library owns").

**Per-verb effect** (the table `1-proposal.md` specifies, implemented verb-for-verb):

| Verb                                                                                                | Effect                                                              | Where                     |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------- |
| `createRow` (single overload, via `beginEdit`'s `{ insert }` branch) / `createRow` (array overload) | adds                                                                | `row-edit-mutations.ts`   |
| `swapRowId(from, to)`                                                                               | deletes `from`, never adds `to` — a swap **is** the acknowledgement | `optimistic-mutations.ts` |
| `releaseEdit(id)`                                                                                   | clears                                                              | `optimistic-mutations.ts` |
| `discardEdit(id)`                                                                                   | clears                                                              | `optimistic-mutations.ts` |
| `removeEdit(id)`                                                                                    | keeps (unchanged, via full-state spread)                            | `optimistic-mutations.ts` |
| `revertEdit(id)`                                                                                    | keeps (unchanged, via full-state spread)                            | `optimistic-mutations.ts` |
| `captureEdit`, `patchEdit`, `beginEdit` (no `{ insert }`)                                           | untouched — these are `'update'`, not a create                      | both files                |

**`releaseEdit`'s guard relaxes** (`1-proposal.md`'s R1 risk, foretold): it bailed when
`!state.snapshots.has(id)`, which is exactly the state a reverted-then-retried create is in —
`unconfirmed` still holds the id, no snapshot left to spend a second time. The guard now bails
only when **neither** `snapshots` nor `unconfirmed` holds the id, and clears whichever it finds.

**`pruneByIds`'s Set overload gains an id-keyed `keep` predicate** (`engine/rows.ts`) — it had
none; the Set branch silently ignored a third argument if one were passed. `onRowsRemoved`
(ADR-0006) now prunes `unconfirmed` with the same exemption `snapshots` already has: an id whose
surviving restore point is `op: 'delete'` (i.e. `removeEdit` deliberately took it out of `data`)
keeps its `unconfirmed` membership too, so a subsequent `revertEdit` reinserts a row that still
correctly demands a retry POST. Verified by a new integration test (`with-row-edit.spec.ts` and
`optimistic-mutations.spec.ts`): create → `removeEdit` → flush the ADR-0006 effect → `unconfirmed`
and `pending` both survive → `revertEdit` → row is back in `data`, still `unconfirmed`, no longer
`pending`.

**Every full-state-literal return in `optimistic-mutations.ts` and `row-edit-mutations.ts` now
spreads `...state`** (`revertEdit`, `discardEdit`, `removeEdit`, `beginEdit`'s two non-insert
branches) instead of naming `{ snapshots, open }` by hand — the previous 2-field shape happened to
be exhaustive; a 3rd field made the omission a real bug (silently dropping `unconfirmed` on every
one of those returns) rather than a style choice. `closeAll` and `closeAllButLast`
(`with-row-edit.ts`) get the same fix; neither touches `unconfirmed` per the table above, so both
pass it through unchanged.

**Consequences:**

- Additive, non-breaking: `pending`'s shape and behavior are unchanged; `EditingState` gains a
  required field, but it is constructed only inside `editing-state.ts`, `table.mock.ts`, and test
  `state()` helpers — all updated in this commit, so nothing outside the library can observe the
  widening as a break.
- `OptimisticMembers<TRow>` (and therefore `RowEditMembers<TRow>`, which extends it) gains
  `pendingOps` and `unconfirmed`. Both features declare them from the same `createEditingStore()`
  call, so R2 (`1-proposal.md`) — the two features' member sets silently diverging — cannot occur
  without editing this one factory.
- Sets up step 5 (`1-proposal.md`): `pendingCreateIds`, hand-rolled in 6 stories, is now
  redundant — every read it answers (`table.unconfirmed().has(id)`) is a library fact.

## D51, D52, D55–D57

Reserved; see the table above. Each is written when its step lands.

## Open questions

None allocated yet. Next free: **O27**.
