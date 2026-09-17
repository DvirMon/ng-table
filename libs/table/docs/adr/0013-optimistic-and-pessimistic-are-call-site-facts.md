# ADR-0013 — Optimistic and pessimistic are call-site facts, named by the verb

**Status:** proposed
**Date:** 2026-09-05
**Supersedes:** [`3-ui/stories.md`](../3-ui/stories.md)'s "Save-mode (Pessimistic/Optimistic) is a
**gated**-only axis" (quoted below)
**Narrows:** [`0-product/row-editing.md`](../0-product/row-editing.md) OQ-7's "'an optimistic flow'
is a consumer wiring pattern, not config"
**Related:** [ADR-0006](0006-row-id-state-reconciliation.md) (the `unconfirmed` slice needs its
pruning exemption), [ADR-0007](0007-feature-member-claims.md) (the new members are claimed from one
store), [ADR-0011](0011-chained-render-stages.md) (supplies the render slot this ADR declines to use)

## Context

The library is optimistic by default and silent about it. `beginEdit(id, { insert })` names a
*session* operation and writes `data`:

```ts
// mutations/row-edit-mutations.ts:66-67
const nextData = insertRow<TRow>(insert, { at })(data, { trackBy, indexById });
writeData(nextData);
```

So every add-a-row flow in the library is eager, whether or not the caller wants it. There is no
pessimistic create path anywhere in the engine.

The cost is already paid, and visible:

| Symptom | Evidence |
|---|---|
| Stories claim a mode they don't implement | `gated-single-pessimistic` and `sorting-editing` claim pessimistic and add eagerly; `form-write-mutations` claims "pessimistic save" while binding `form(this.data)` |
| The axis never actually varied | 6 of 7 stories with an add path add eagerly |
| Consumers re-derive what the library knows | `pendingCreateIds` hand-rolled in 6 stories, with a byte-identical `removePendingCreate` in 5 — because `pending()` cannot say *which* operation is in flight |
| The term means two things | see the two claims below |

### The two claims this ADR acts on

`3-ui/stories.md` :142 —

> Save-mode (Pessimistic/Optimistic) is a **gated**-only axis — it means "does the row stay open
> until the server confirms, or close right away" (`endEdit` after vs. before the fetch), which
> only makes sense where there's a session to hold open in the first place. A live table has no
> session (D29), so `live-pessimistic/` […] was removed; live's only axis is rollback vs. no
> rollback.

`0-product/row-editing.md` :848 (OQ-7, RESOLVED 2026-08-27) —

> Refusing was rejected on a practical ground as well as a product one: "an optimistic flow" is a
> consumer wiring pattern, not config, so there is nothing reliable to detect at composition time.

These are not equally wrong. **OQ-7 is correct and stays correct** — you still cannot detect a
consumer's flow at `createTable()` time, so refusing `multiple: true` on that basis remains
impractical. What changes is only *where* the fact becomes legible: not at composition time, but at
the **call site**, because the verb now names it. That is a narrowing, not a reversal.

`stories.md` :142 is superseded outright. Its framing ties the axis to the presence of an edit
session, which makes it inapplicable to live tables — yet `live-table` adds a row eagerly with no
request at all, which is the most optimistic thing in the codebase.

## Decision

**1. The definition, product-level and mode-agnostic:**

> **Optimistic** — the action is reflected to the user *before* the server answers.
> **Pessimistic** — the action is reflected only *after* the server confirms.

A **per-operation** axis (create / update / delete), not a per-session one. It applies to live
tables and gated tables alike.

**2. The mode is a call-site fact, not library configuration.** Every verb is called synchronously;
the library never sees a request. Optimism is therefore not a property the library can *hold* — it
is *where in the async flow the call sits*. Consequently there are **no `optimisticX`/`pessimisticX`
verb pairs**: they would double the public surface and misrepresent where the fact lives. Instead
every verb states whether it writes `data` at call time, and every operation has a verb usable in
the after-response position.

**3. The invariant**, which is the whole concept in one testable line:

> **A row is in `pending` iff an optimistic write is in flight. A pessimistic operation never
> writes `snapshots`.**

A correctly-wired pessimistic table can never show a `pending` row.

**4. Four verb families:**

| Family | Verbs | Writes `data`? | Arms rollback? | Call position |
|---|---|---|---|---|
| Row data (`RowUpdater`) | `insertRow`, `removeRow`, `patchRow` | yes | no | **pessimistic** — after the response |
| Session (`EditingUpdater`) | `beginEdit`, `closeEdit`, `clearEdit` | **never** | no | mode-neutral, local |
| Optimistic-arm | `createRow`, `commitEdit`, `patchEdit`, `removeEdit`, `captureEdit` | yes | yes → `pending` | **optimistic** — before the response |
| Optimistic-settle | `releaseEdit`, `revertEdit`, `discardEdit`, `swapRowId` | some | spends it | on the response |

The three `RowUpdater`s **are** the pessimistic data surface — they write and hold nothing, which is
exactly the after-response shape. No new pessimistic verbs are required. Two verbs change to make
the families honest: `beginEdit` loses its `{ insert }` data write (`createRow` becomes the only
insert-and-arm verb), and `endEdit` splits into `commitEdit` (keep the restore point → `pending`)
and `closeEdit` (release it → clean), because keep-vs-drop *is* "is a request still in flight?"

**5. A pessimistic create shows no row at all.** Nothing enters `data` *or* `renderRows()` before
the response. The typing surface is a composer form outside the row set, with its own signal and
its own `form()`; on success the consumer calls `insertRow(saved, { at })`. Zero engine change.

**6. The library owns the CRUD-pending facts a consumer cannot derive** — `RowRestorePoint.op:
'create' | 'update' | 'delete'` (replacing `detached`, which is exactly `op === 'delete'`) and an
`unconfirmed: ReadonlySet<RowId>` slice. It does **not** own per-row error state: it does not own
the request, cannot type the error without dictating a message format or forcing a banned cast, and
cannot know when to clear it — the four stories that have one clear on cancel, on discard, on
save-start, and on dismiss, in four different combinations.

## Alternatives considered

| Option | Why not |
|---|---|
| `optimisticAddRow()` / `pessimisticAddRow()` verb pairs | Doubles the public surface and lies about where the fact lives. A "pessimistic" verb would be identical to the optimistic one called later — the difference is the caller's `await`, which the library cannot see. |
| A `mode: 'optimistic' \| 'pessimistic'` config on `withOptimistic()` / `withRowEdit()` | This is what OQ-7 already rejected and still rejects: the flow is consumer wiring, undetectable at composition time. A config flag would be an unenforceable assertion. |
| Keep `beginEdit({ insert })`, document that it is eager | The mislabel is the mechanical cause of all three broken stories. Documenting a trap is not removing it — and the docs already described the hazard in prose (`row-edit-mutations.ts:15-24`) without preventing any of it. |
| A capture-and-defer-the-write verb (arm rollback now, write `data` later) | A pessimistic write shows nothing, so there is nothing to roll back *to*. This is the fastest available way to break the invariant in Decision 3. |
| `PatchEditOptions.capture: 'never'` | Byte-identical to `table.value.update(patchRow(id, p))`. Splits one concept across two families for no gain. The pessimistic patch is `patchRow`. |
| A `'drafts'` render stage + `withPendingCreates()`, injecting unconfirmed rows into `RenderRow[]` | The mechanism exists and is proven (`with-expansion.ts:93-96` does it for children), and ADR-0011 makes the slot cheap to claim — but injecting an unconfirmed row **is** showing a row before the server answers, precisely what Decision 1 rules out. It also has no residual use case: optimistic create already writes `data`, which is correct. Rejected, not deferred. |
| Eager insert, marked non-participating (in `data`, excluded from the pipeline) | The row is in `data`, therefore on screen, before the server answers — optimistic by the definition, wearing a pessimistic label. Also pollutes the consumer's own `data()` signal and `draft`'s index parallelism. |

## Consequences

**Gained**

- Eagerness is readable at every call site without consulting a doc.
- The invariant is executable: a spec asserting `closeEdit` leaves `pending` empty catches the
  entire class of mis-wired pessimistic flows.
- `pendingCreateIds` disappears from 6 stories in favour of `table.unconfirmed()`.
- A failure handler can branch on `op` — `op === 'create' ? discardEdit(id) : revertEdit(id)` —
  instead of each consumer tracking create-ness by hand.

**Cost**

- Public breaking changes: `BeginEditOptions` removed, `beginEdit`'s options param removed,
  `endEdit` replaced by `commitEdit`/`closeEdit`, `RowRestorePoint.detached` renamed to `op`.
  No deprecation window (no consumers outside this repo, per D46/OQ-B).
- 8 `endEdit` call sites across 6 story hosts must each be classified by hand; a wrong pick
  silently strands a row in `pending`. Mitigated by the invariant test and an on-canvas
  `pending`/`unconfirmed` badge.
- `unconfirmed` needs the same ADR-0006 pruning exemption `snapshots` has, which requires widening
  `pruneByIds`'s Set overload with a `keep` predicate (`engine/rows.ts:86-89` — the Map overload has
  one, the Set overload does not).

**Obliges an update to**

- [`1-state/features/row-editing.md`](../1-state/features/row-editing.md) — verb families, the
  invariant, the new state shape.
- [`1-state/row-mutations.md`](../1-state/row-mutations.md) — name the three `RowUpdater`s as the
  pessimistic data surface.
- [`3-ui/stories.md`](../3-ui/stories.md) :142 — superseded, per above.
- [`0-product/row-editing.md`](../0-product/row-editing.md) OQ-7 — narrowed, per above.
- [ADR-0006](0006-row-id-state-reconciliation.md) :198-209 — its "Open" section is **already stale**
  independently of this ADR: G3/O20 was closed 2026-09-03 by `swapRowId` (D49), and `ABSENT` was
  removed by D46. This ADR adds the `unconfirmed` exemption to the same section.
- `libs/shared/table/CLAUDE.md` — the per-file verb lists in the file table.

**Working notes:**
[`1-state/work/optimistic-pessimistic-api/`](../1-state/work/optimistic-pessimistic-api/1-proposal.md)
(the sequenced plan and D50–D57).
