---
title: Proposal — optimistic and pessimistic as a definitive API
type: plan
status: open — step 0 done (ADR-0013 + D50–D57 reserved); step 1 done (D53); step 2 done (D54); step 3a not started
date: 2026-09-05
parent: ../../features/row-editing.md
---

# Optimistic / pessimistic as a definitive API

> **Not the contract.** This is the intake proposal and the sequenced plan. The concept and its
> supersessions are decided in
> [ADR-0013](../../../../../adr/0013-optimistic-and-pessimistic-are-call-site-facts.md) (`proposed`);
> D51–D57 in [`2-decisions.md`](2-decisions.md) are reserved and written per step as each lands.
> The shipped surface, once this ships, is specced in
> [`features/row-editing.md`](../../../../features/row-editing.md).

## Context

The library is **optimistic by default and silent about it**. `beginEdit(id, { insert })` names a
_session_ operation but writes `data` ([`row-edit-mutations.ts`](../../../../../../src/mutations/row-edit-mutations.ts) :66-67),
so every add-a-row flow is eager whether the story wants it or not. There is no pessimistic create
path anywhere in the engine.

Already visible in the codebase:

- **3 of 9 stories are mislabeled.** `gated-single-pessimistic` and `sorting-editing` claim
  pessimistic but add eagerly; `form-write-mutations` claims "pessimistic save" while binding
  `form(this.data)`, so the value reaches `data` before the request.
- **6 of 7 stories with an add path add eagerly** — the axis the story names never varied.
- **The consumer re-derives what the library knows.** `pendingCreateIds` is hand-rolled in 6
  stories, with a byte-identical `removePendingCreate` in 5 of them, because `pending()` cannot
  distinguish an unconfirmed create from an unconfirmed edit from an unconfirmed delete.
- **Two docs define the term incompatibly.** [`3-ui/stories.md`](../../../../../3-ui/stories.md) :142
  calls it a gated-only save-mode axis; [`features/row-editing.md`](../../../../features/row-editing.md)
  §5 ships "Optimistic save — live (D39)".

**The definition this proposes:**

> **Optimistic** = the action is reflected to the user _before_ the server answers.
> **Pessimistic** = the action is reflected only _after_ the server confirms.

A **per-operation** axis (create / update / delete), not a per-session one — the reframe that
supersedes `stories.md:142`.

**Outcome:** eagerness legible at every call site, the library owning the CRUD-pending facts the
consumer cannot derive, each story demonstrating exactly one mode honestly.

## The governing invariant

Every verb is called synchronously; the library never sees a request. The mode is therefore not a
property the library can _hold_ — it is **where in the async flow the call sits**. So no
`optimisticX`/`pessimisticX` pairs (they would double the surface and lie). Instead:

> **A row is in `pending` iff an optimistic write is in flight. A pessimistic operation never
> writes `snapshots`.**

Testable, and it makes a correctly-wired pessimistic table one that can never show a `pending` row.

## The four verb families

| Family                         | Verbs                                                               | Writes `data`? | Arms rollback?  | Call position                        |
| ------------------------------ | ------------------------------------------------------------------- | -------------- | --------------- | ------------------------------------ |
| **Row data** (`RowUpdater`)    | `insertRow`, `removeRow`, `patchRow`                                | yes            | no              | **pessimistic** — after the response |
| **Session** (`EditingUpdater`) | `beginEdit`, `closeEdit`, `clearEdit`                               | **never**      | no              | mode-neutral, local                  |
| **Optimistic-arm**             | `createRow`, `commitEdit`, `patchEdit`, `removeEdit`, `captureEdit` | yes            | yes → `pending` | **optimistic** — before the response |
| **Optimistic-settle**          | `releaseEdit`, `revertEdit`, `discardEdit`, `swapRowId`             | some           | spends it       | on the response                      |

The three `RowUpdater`s **are** the pessimistic data surface — they write and hold nothing, which
is exactly the after-response shape. No new pessimistic verbs needed.

### Signature changes

```ts
// BREAKING — beginEdit loses its data write; BeginEditOptions deleted
export function beginEdit<TRow>(id: RowId): EditingUpdater<TRow>;
// absent id → full no-op (replaces today's "open with no snapshot" misuse branch, :79-82)

// createRow becomes standalone — the only insert-and-arm verb
export function createRow<TRow>(
  id: RowId,
  row: NoInfer<TRow>,
  opts?: { at?: number; open?: boolean },
): EditingUpdater<TRow>;
export function createRow<TRow>(
  rows: { id: RowId; row: NoInfer<TRow> }[],
  opts?: { at?: number; open?: boolean },
): EditingUpdater<TRow>;
// open defaults true (matches 4 gated call sites); { open: false } is the withOptimistic-only live case

// BREAKING — endEdit splits; keep-vs-drop IS "is a request still in flight?"
export function commitEdit<TRow>(id: RowId, partial?: Partial<TRow>): EditingUpdater<TRow>; // merge + close, KEEP restore point → pending
export function closeEdit<TRow>(id: RowId, partial?: Partial<TRow>): EditingUpdater<TRow>; // merge + close, RELEASE → clean
```

`closeEdit` collapses the `endEdit(...)` + `releaseEdit(...)` pair spelled by hand in 3 stories.
`clearEdit()` is already the bulk `closeEdit`; there is deliberately no bulk `commitEdit` — it
would leak N restore points with nothing to settle them.

**Rejected:** `PatchEditOptions.capture: 'never'` — byte-identical to
`table.value.update(patchRow(id, p))`, splitting one concept across two families.
**Rejected:** a capture-and-defer-the-write verb — a pessimistic write shows nothing, so there is
nothing to roll back to. Building it is the fastest way to break the invariant.

Unchanged: `captureEdit`, `revertEdit`, `discardEdit`, `removeEdit`, `patchEdit`, `swapRowId`,
`insertRow`, `removeRow`, `patchRow`.

## Pessimistic create — no row exists until the server confirms

**Decided by the product owner, 2026-09-05:** _"there is no row until the server returns true —
this is the point."_ Nothing enters `data` _or_ `renderRows()` before the response. The typing
surface is a **composer form outside the row set** — its own `signal<TRow>` and its own `form()`,
naturally placed in `<tfoot>`. On success: `table.value.update(insertRow(saved, { at }))`.
**Zero engine change**, and it survives sort/pagination trivially because it was never a pipeline
row.

**Explicitly rejected — do not re-derive:** a `'drafts'` render stage plus a
`withPendingCreates()` feature injecting unconfirmed rows into `RenderRow[]`. The mechanism exists
and is proven ([`with-expansion.ts`](../../../../../../src/api/features/with-expansion.ts) :93-96 does
exactly this for children), but injecting an unconfirmed row **is** showing a row before the
server answers — precisely what the definition rules out. It also has no remaining use case:
optimistic create already writes `data`, which is correct under the definition.

## State: what the library owns

```ts
export type PendingOp = 'create' | 'update' | 'delete';

export interface RowRestorePoint<TRow> {
  readonly row: TRow;
  readonly at: number;
  readonly op: PendingOp; // REPLACES `detached`; detached ≡ op === 'delete'
}

export interface EditingState<TRow> {
  readonly snapshots: SnapshotMap<TRow>;
  readonly open: ReadonlySet<RowId>;
  readonly unconfirmed: ReadonlySet<RowId>; // NEW — client ids the server never acknowledged
}
```

**`op` — library owns.** Zero new slices (it subsumes `detached`), and the consumer provably
cannot derive it: given `pending().has(id)`, nothing says which operation is in flight — yet that
is the exact branch every failure handler needs. Enables the library-supported
`op === 'create' ? discardEdit(id) : revertEdit(id)`.

**`unconfirmed` — library owns.** Nearly derivable from `op === 'create'`, but not quite, and the
gap is load-bearing: a _failed_ create calls `revertEdit`, spending the snapshot, yet the row must
still POST on retry — `gated-single-optimistic-story-host.component.ts:75-78` documents exactly
this. Unconfirmed identity outlives a restore point.

| Verb                  | Effect on `unconfirmed`                                                                                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createRow`           | adds                                                                                                                                                                                   |
| `swapRowId(from, to)` | **deletes `from`, does not add `to`** — a swap _is_ the acknowledgement                                                                                                                |
| `releaseEdit(id)`     | clears — **requires relaxing its early return** ([`optimistic-mutations.ts`](../../../../../../src/mutations/optimistic-mutations.ts) :58), which today bails when no snapshot is held |
| `discardEdit(id)`     | clears                                                                                                                                                                                 |
| `removeEdit(id)`      | **keeps** — `revertEdit` may bring the row back, still unconfirmed                                                                                                                     |
| `revertEdit(id)`      | keeps                                                                                                                                                                                  |

**Per-row error — stays consumer-side.** The library does not own the request, cannot type the
error without either dictating a message format (`string`) or forcing a banned cast (`unknown`),
and decisively cannot know _when to clear it_ — the 4 stories that have one clear on cancel, on
discard, on save-start and on dismiss, in four different combinations. Ship as a shared story
helper `src/stories/row-error-slot.ts`, mirroring the existing `src/stories/local-undo-slot.ts`.
Promotion later is non-breaking if consumers converge.

**Members** — declared from the single `createEditingStore()`, so the two features cannot diverge:

```ts
readonly pending: Signal<ReadonlySet<RowId>>;                 // shape UNCHANGED — non-breaking
readonly pendingOps: Signal<ReadonlyMap<RowId, PendingOp>>;   // new
readonly unconfirmed: Signal<ReadonlySet<RowId>>;             // new
```

`pendingIds()` is rewritten as `pendingOps()` with `pending` derived from it, so the two can never
disagree. **Keep the `NO_IDS` stable-empty-identity trick**
([`editing-state.ts`](../../../../../../src/api/features/editing-state.ts) :92-96) and add a `NO_OPS`
twin — it is load-bearing for downstream computeds.

## Steps

Stories import from source paths, not `index.ts`, so removing any export breaks 9 hosts in the
same commit — that drives the 3a/3b split. **The library compiles and tests green at every step.**

**Step 0 — ADR + D-number reservation** _(judgment, no code)_ · `Depends on: —` · **DONE 2026-09-05**
[ADR-0013](../../../../../adr/0013-optimistic-and-pessimistic-are-call-site-facts.md) written (status
`proposed`), and [`2-decisions.md`](2-decisions.md) reserves **D50–D57**.

Scope was deliberately narrowed from "write all eight decisions up front." This repo's practice is
**decisions land in the same commit as the code implementing them** — D45–D47 shipped inside
`🎸 feat(shared-table/row-edit): optimistic delete rollback (D45-D47)` (2026-08-27), D49 was
appended after `swapRowId` landed, and `with-optimistic/2-decisions.md` carries A1/A2 amendments
where implementation corrected the design pass. Pre-writing D51–D57 would invent rationale for code
that does not exist.

Two parts genuinely could not wait, and are done:

- **ADR-0013**, because it acts on two _currently published_ claims that contradict this work:
  it **supersedes** [`3-ui/stories.md`](../../../../../3-ui/stories.md) :142's gated-only framing, and
  **narrows — does not reverse** — [`0-product/row-editing.md`](../../../../../0-product/row-editing.md)
  OQ-7, whose finding that a flow is undetectable _at composition time_ remains true. What changes
  is only that the verb now names the mode at the **call site**.
- **D50–D57 reservation**, because the D-sequence is global across `1-state/work/` and a concurrent
  effort could otherwise take D50.

Still open in this step: `state.json`. D51–D57 rationale is written per step, below.

**Step 1 — `op` replaces `detached`** _(mechanical)_ · `Depends on: 0` (numbering only) · **DONE 2026-09-05**
`editing-state.ts`, `optimistic-mutations.ts`, `row-edit-mutations.ts`, colocated specs,
`index.ts` (+`PendingOp`). The ADR-0006 keep-predicate becomes `(v) => v.op === 'delete'`.
`detached` appears nowhere in `src/stories/` — verified. See [D53](./2-decisions.md#d53--rowrestorepointdetached-becomes-op-create--update--delete-2026-09-05).

**Step 2 — `pendingOps` + `unconfirmed`** _(additive, non-breaking)_ · `Depends on: 1` · **DONE 2026-09-05**
`editing-state.ts` (shape, `pendingOps()`, prune `unconfirmed` with the exemption),
`engine/rows.ts` — `pruneByIds`'s Set overload gains `keep?: (id: RowId) => boolean`,
`with-optimistic.ts`, `with-row-edit.ts`, `optimistic-mutations.ts` (including the relaxed
`releaseEdit` guard), `row-edit-mutations.ts`. All 9 stories still compile — no story reads either
new member yet (that's step 5). See
[D54](./2-decisions.md#d54--unconfirmed-becomes-a-library-slice-2026-09-05).

Not touched: `index.ts` — `pendingOps`/`unconfirmed` reach consumers as `OptimisticMembers`/
`RowEditMembers` fields (both types already exported), not as new standalone exports.

**Step 3a — new verbs alongside the old** _(judgment)_ · `Depends on: 2`
Add standalone `createRow` (with `open`), `commitEdit`, `closeEdit`. Mark `beginEdit`'s options
param and `endEdit` `@deprecated`, still working. The spec must assert **`closeEdit` leaves
`pending` empty** — the invariant made executable.

**Step 3b — migrate call sites, delete the deprecated** _(judgment, NOT mechanical)_ · `Depends on: 3a`
8 `endEdit` sites across 6 hosts; a wrong pick silently strands a row in `pending`:

| Site                                                | Becomes               |
| --------------------------------------------------- | --------------------- |
| `gated-single-optimistic:251` (before request)      | `commitEdit(id, row)` |
| `gated-single-pessimistic:240,244` (after response) | `closeEdit(...)`      |
| `gated-multiple-optimistic:272` (before request)    | `commitEdit`          |
| `sorting-editing:134-135` (after `await`)           | `closeEdit`           |
| `form-write-mutations:61-62` (after `await`)        | `closeEdit(id)`       |

Plus `beginEdit({insert})` → `createRow` at 5 sites. Then delete `BeginEditOptions` and `endEdit`.
No deprecation window (no external consumers, per D46/OQ-B) — the 3a/3b overlap exists only to keep
CI green across two PRs.

**Step 4 — dev-mode misuse guard** _(small, judgment)_ · `Depends on: 3b` · `Parallel-safe with: 5`
`createEditingStore(core, { supportsOpen })`; `beginEdit`/`closeEdit`/`clearEdit` emit an
`ngDevMode` warning on a `withOptimistic`-only table. Makes real the hazard
`row-edit-mutations.ts:15-24` currently only describes in prose.

**Step 5 — story-state extraction** _(mechanical, batchable)_ · `Depends on: 2, 3b` · `Parallel-safe with: 4`
New `src/stories/row-error-slot.ts` and `src/stories/gated-row-edit.state.ts` (the 8
byte-identical methods plus `forcedInvalid`, `needsUniqueName`, `insertAt`). Delete
`pendingCreateIds` at all 6 sites in favour of `table.unconfirmed()`; fold
`gated-bulk-optimistic.state.ts`'s `pendingIds` in. Reuse the existing `injectRowEditApi()`
(`src/stories/row-edit.http.ts`), `local-undo-slot.ts`, `commit-counter.component.ts`.

**Step 6 — fix the three mislabeled stories** _(judgment)_ · `Depends on: 3b, 5`

- `gated-single-pessimistic/` — **the real fix.** `addBlankRow` stops writing `data`; `<tfoot>`
  composer with its own `form()` → POST → `insertRow(saved, { at })`. Proves pessimistic create
  exists.
- `sorting-editing/` — the mislabel is only in the doc-comment; its save _is_ pessimistic, and its
  add exists to demo sort-under-insert, not save mode. Switch the adds to `createRow`, correct the
  comment. Do not restructure.
- `form-write-mutations/` — relabel "Pessimistic save" to **"local save"** (no rollback, binds
  `form(this.data)`). Note it composes `gatedTableSchema()`, so `table.draft` exists unused.
- **All row-edit stories: render a per-row `pending` / `unconfirmed` badge.** Cheap, and it makes a
  mis-migrated `commitEdit` visible instead of silent.

**Step 7 — specs and docs** _(judgment; specs are the contract, so they land matching the code)_ · `Depends on: all`
[`features/row-editing.md`](../../../../features/row-editing.md) (verb families, the invariant, the new
state shape), [`1-state/row-mutations.md`](../../../../row-mutations.md) (the three `RowUpdater`s named
as the pessimistic surface), [`3-ui/stories.md`](../../../../../3-ui/stories.md) :142,
[`0-product/row-editing.md`](../../../../../0-product/row-editing.md) OQ-7,
**[`adr/0006`](../../../../../adr/0006-row-id-state-reconciliation.md) :198-209 "Open" — stale: G3/O20
closed 2026-09-03, and `ABSENT` was removed by D46**, and `libs/table/CLAUDE.md`'s file
table.

```
0 ─> 1 ─> 2 ─> 3a ─> 3b ─┬─> 4 ─┐
                          ├─> 5 ─┴─> 6 ─> 7
```

`Parallel-safe: [4,5] after 3b`

## Critical files

[`api/features/editing-state.ts`](../../../../../../src/api/features/editing-state.ts) (state shape,
store, pruning) · [`mutations/row-edit-mutations.ts`](../../../../../../src/mutations/row-edit-mutations.ts)
(`beginEdit`/`createRow`/`endEdit`) ·
[`mutations/optimistic-mutations.ts`](../../../../../../src/mutations/optimistic-mutations.ts) (7 verbs,
the `releaseEdit` guard) · [`api/features/with-optimistic.ts`](../../../../../../src/api/features/with-optimistic.ts)
and [`with-row-edit.ts`](../../../../../../src/api/features/with-row-edit.ts) (members) ·
[`engine/rows.ts`](../../../../../../src/engine/rows.ts) (`pruneByIds` Set overload) ·
[`index.ts`](../../../../../../src/index.ts) (the only barrel) · 9 × `src/stories/**/*-story-host.component.ts`

## Verification

1. `npx tsc --noEmit -p libs/table/tsconfig.lib.json` after **every** step.
2. `nx test shared-table` — colocated specs. New tests required:
   - `closeEdit` leaves `pending` empty (the invariant).
   - delete → revert → retry-create keeps `unconfirmed` — **the `pruneByIds` exemption has no
     failing test until this path exists** (see R1).
   - `with-row-edit.spec.ts`: member key sets identical to `withOptimistic`'s (see R2).
3. Storybook — `gated-single-pessimistic`: clicking Add shows **no new row**; the composer accepts
   input; the row appears only once the POST resolves; with `forceFailure` on, no row ever appears.
   The `pending` / `unconfirmed` badges stay empty for the whole pessimistic flow.

## Risks

**R1 — `unconfirmed` × ADR-0006 pruning.** `removeEdit` takes the row out of `data`, so the
reconciliation effect prunes `unconfirmed` before `revertEdit` can restore it still-unconfirmed.
The `pruneByIds` `keep` predicate in step 2 is the mitigation, and **it is silently wrong if
skipped** — write the test named above.
Secondary: `swapRowId` deleting from `unconfirmed` relies on the same synchronous-before-the-effect
ordering D49 already pins with a test. If a consumer defers the swap, the effect prunes the id
first and the delete no-ops — benign here (the id is gone either way), unlike the `snapshots` case.
Say so in the spec so nobody "fixes" it.

**R2 — the two features must not diverge.** Both member sets come from one `createEditingStore()`.
If someone later declares `unconfirmed` on `withOptimistic` alone, gated tables lose it with no
ADR-0007 collision to catch it — absence, not collision.

**R3 — `commitEdit`/`closeEdit` mis-migration is silent.** Mitigated by the 3a test and the step-6
badge. Naming caveat: "commit boundary" already means "when a field value lands in the model" in
these docs, so `commitEdit(id, partial)` = "land the row's draft in `data`" is consistent with
existing vocabulary rather than colliding with it — but a reviewer will ask.

**R4 — `draft` index-parallelism is load-bearing** for `this.rows[sourceIndex]` in 4 hosts.
Nothing here touches it; the composer decision keeps it that way.

**R5 — step 5 must precede step 6**, or the composer work in `gated-single-pessimistic` is written
against code that is about to be extracted. Do not reorder.
