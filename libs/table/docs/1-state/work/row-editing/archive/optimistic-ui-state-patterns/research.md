---
title: Research — Optimistic UI State Architecture Patterns
type: research
status: complete — informs future ADRs on withOptimistic(); not itself a decision record
date: 2026-09-05
parent: ../../features/row-editing.md
---

# Optimistic UI state — architecture patterns research

Answers a practical question: **when you build optimistic UI, what state do you actually have to
keep, and does its shape depend on which CRUD operation you're doing?** Compares three external
architecture families against this repo's own `withOptimistic()` (`docs/1-state/features/row-editing.md`
§2, `src/api/features/editing-state.ts`, `src/mutations/optimistic-mutations.ts`).

This is a **research doc, not a decision record** — nothing here changes shipped behavior. It
exists to sanity-check the current design against real prior art and to answer "how would I do
this in a different context" for future work.

**Verification status:** every claim about TanStack Query, Apollo Client, RTK Query, Replicache,
and AG Grid (all open source) has been checked against actual library source, not just
documentation — see §6. Linear and Figma remain doc/blog-sourced only; both are closed-source
with no public repo to check (Linear's mechanism-level detail is corroborated by a
CTO-endorsed reverse-engineering of their minified frontend — see §3, Family B).

---

## 1. What "optimistic UI" means, practically

The abstract definition: a write is reflected in the UI **immediately**, before the server has
confirmed it. If the server later rejects it, the UI has to undo what it already showed.

Practically, that definition hides a state-management requirement that every system researched
here solves the same way at the top level, and differently underneath:

> **Before you apply a speculative write, you must capture enough information to reverse it —
> and what "enough" means depends on the write.**

That's the whole of it. Everything below is different systems answering: *what exactly do you
capture, keyed by what, and how do you know when it's safe to throw the capture away?*

---

## 2. Does the state depend on the action type? — yes, and here's the shape

Across every system researched (query-cache libraries, sync engines, and grid transaction APIs),
the same four-way split recurs. This table is the practical answer to "what do I need to save":

| Action | What must be captured **before** the write | Why | What "undo" means |
|---|---|---|---|
| **Create** | Nothing about prior state (there is none) — but an **identity strategy**: either a permanent client-generated id used from the start, or a temporary id that gets swapped for the server's real id on confirmation | The row didn't exist before, so there's no "old value." The only open problem is *identity*, not *value* | Remove the row by its (temp or permanent) id |
| **Update** | The row's **prior value** — whole-record or field-level, and whichever granularity you pick determines whether two concurrent edits to different fields on the same row can both survive | Reverting means restoring what was there | Overwrite the current value with the captured prior value |
| **Delete** | The row's prior value **and its position** (index, or a neighbor reference) | Reverting means the row has to come back — and it has to come back in the right place, not just exist again | Re-insert the captured value at the captured position |
| **Bulk (N rows)** | The same per-row capture as above, run N times — **no system researched here treats bulk as a structurally different capture**. What differs is failure-handling: does one row's failure roll back the whole batch, or only that row? | Concurrency risk compounds with batch size | Either N independent per-row reverts, or one coarse "refetch and reconcile" for the whole batch |

The load-bearing distinction is **create vs. everything else**: create needs an *identity*
decision, update/delete need a *value* (and delete additionally needs a *position*). This is
exactly why this repo's own design gives create no capture-composing verb at all (`row-editing.md`
§2, "Why there is no `insertEdit`") — capture exists to preserve information that would
otherwise be lost, and a create loses nothing.

---

## 3. Three external design families

### Family A — Query-cache mutation libraries (TanStack Query, Apollo Client, RTK Query)

The web/mobile-app default: a client-side cache mirrors server data; a mutation patches the cache
immediately, keeping enough of a snapshot to undo the patch on failure.

| | TanStack Query | Apollo Client | RTK Query |
|---|---|---|---|
| Unit of "unconfirmed" | Caller-built context object from `onMutate` (usually a whole-query snapshot) | A separate optimistic **layer** shadowing the real normalized-cache entry | A `PatchCollection` — Immer forward + inverse JSON patches, with a bound `undo()` |
| Granularity | Whole query-key value | Whole normalized entity | Field-level, via structural patches |
| Create / temp id | Not addressed by the library — caller convention only | Documented convention: caller supplies a placeholder id, library discards the optimistic layer once the real id lands | Not addressed — caller manually pushes into the cached list |
| Delete restore | Whole-array snapshot restored; position implicit in array order | Requires a manual `cache.modify`/`update`; **documented bug**: `cache.evict` breaks automatic rollback | Inverse patch restores the removed element **and its index**, automatically |
| Bulk | None — same per-call mechanism repeated | None — N stacked optimistic layers | None — and RTK Query is the only one of the three to **explicitly warn** this is unsafe |

> "Where many mutations are potentially triggered in short succession causing overlapping
> requests, you may encounter race conditions if attempting to roll back patches using the
> `.undo` property on failures. For these scenarios, it is often simplest and safest to
> invalidate the tags on error instead." — [Redux Toolkit docs, Manual Cache Updates](https://redux-toolkit.js.org/rtk-query/usage/manual-cache-updates)

**Cross-cutting gap in this whole family:** none of the three document what happens when a fresh
server push (subscription, websocket, polling refetch) arrives for the same row while an
optimistic write is still in flight. Each library's own guard only defends against *its own*
refetch machinery, not an out-of-band writer.

Full detail: [research-query-cache.md source](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates), [Apollo optimistic UI docs](https://www.apollographql.com/docs/react/performance/optimistic-ui), [RTK Query manual cache updates](https://redux-toolkit.js.org/rtk-query/usage/manual-cache-updates).

### Family B — Local-first sync-engine mutation logs (Linear, Replicache, Figma)

The collaborative-app answer: instead of one client guessing and one server confirming, treat
every write as a prediction against a **single ordered log** that one arbiter (the server)
ultimately authors.

| | Linear | Replicache | Figma |
|---|---|---|---|
| Unit of "unconfirmed" | A staged **transaction** (captured field diffs) in an in-memory queue; IndexedDB holds only confirmed state | A queued **mutator invocation** (function name + args) — replayed from scratch, not diffed | A per-**property** optimistic value, shown until the server's echo of that exact write arrives |
| Create id | Permanent client UUID from the start — no swap step; server delta later cancels the redundant local record | Client-generated id passed as a mutator arg — **must** be stable, since the mutator is replayed | Client id embedded in a client-namespaced object id — collision-proof by construction |
| Update granularity | Field-level, via observable setters | Whole-mutator re-execution (granularity is whatever the mutator author chose) | Single property, atomic — concurrent edits to the *same* property don't merge, they clobber (an owned, documented limitation) |
| Delete | Distinct transaction type; soft "archive" is the real-world default | Just another mutator call, no special shape | No server tombstone at all — last value lives only in the deleting client's own undo buffer |
| Bulk | First-class: transactions sharing a `batchIndex` merge into one request | No batch concept needed — sequential log entries batch naturally | Time-windowed (~1 frame) buffering + property coalescing |
| Rejection | Explicit `rollback()` compensating the failed transaction | No explicit reject signal — permanent failures are silently folded into confirmed state | No general reject path; the one exception is tree-cycle prevention |

> "Replicache is modeled under the hood like git. It maintains historical versions of the Client
> View and ... rewinds the state of the Client View to the last version it got from the server,
> applies the patch ..., and then replays any pending mutations on top." — [How Replicache Works](https://doc.replicache.dev/concepts/how-it-works)

> "Since Figma is centralized (our server is the central authority), we can simplify our system
> by removing this extra overhead [of CRDTs]." — [How Figma's multiplayer technology works](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/)

**Where responsibility for conflicts sits is the real design axis** in this family: Figma pushes
it into data-model granularity (finer properties, fewer real conflicts, no cross-property
atomicity); Replicache pushes it into application code (mutators must be safe to re-run against
unknown future state); Linear pushes it into field-level diffing plus an explicit rollback path —
the most machinery, but the only one built for a relational schema with cross-entity invariants.

Full detail: [Scaling the Linear Sync Engine](https://linear.app/now/scaling-the-linear-sync-engine), [reverse-linear-sync-engine](https://github.com/wzhudev/reverse-linear-sync-engine), [How Replicache Works](https://doc.replicache.dev/concepts/how-it-works), [How Figma's multiplayer technology works](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/).

**Repo-status note (found during §6 source verification, not the original docs pass):**
`github.com/rocicorp/replicache` — the repo a reader would naturally reach for — is archived and
contains only a README pointing at the docs site. The real sync/mutation source lives in
`github.com/rocicorp/mono/packages/replicache/src`, which is also where Rocicorp's actively
developed **Apache-2.0 successor, Zero,** now lives. Replicache's public npm package has moved
toward closed/commercial distribution (minified, no sourcemaps; a debuggable build is reportedly
customer-only). All four mutation-queue/rebase claims above were confirmed directly against that
mono-repo source — the architecture description holds — but frame Replicache here as a
**legacy reference design**, not Rocicorp's current OSS investment.

### Family C — Grid/spreadsheet transaction + command pattern (AG Grid, generic)

The table-specific answer, and the most directly comparable prior art to this repo.

**AG Grid's Transaction API** (`applyTransaction({ add, addIndex, update, remove })`) is
whole-row, keyed by row id or object-reference equality — never field-level. Critically:

> `applyTransaction` never calls the server. It is a pure client-side, in-memory mutation of the
> grid's row model. There is no documented "undo this transaction" or "roll back on server
> rejection" API. — synthesized from [AG Grid: Transaction Updates](https://www.ag-grid.com/javascript-data-grid/data-update-transactions/)

Delete inside a transaction retains **nothing** for undo — the removed row's data is simply gone
from the grid's model. AG Grid's separate Undo/Redo API only covers cell edits/paste/fill (10-step
default stack), explicitly **excludes** row add/remove, and any transactional data update **clears
the undo stack outright**:

> "Performing data updates (except for cell edits), or grid operations that change the row /
> column order ... will clear the undo / redo stacks." — [AG Grid: Undo / Redo Edits](https://www.ag-grid.com/javascript-data-grid/undo-redo-edits/)

**§6's source verification found what the public docs don't state**: the actual undo-stack entry
(`CellValueChange`, `interfaces/iUndoRedo.ts`) is `{ rowPinned, rowIndex, columnId, oldValue,
newValue }` — keyed by **positional `rowIndex`, not row id**. `undo()` resolves whatever row
currently occupies that index at undo time, so a sort/filter/add/remove between the edit and the
undo can make it **silently target the wrong row**. A confirmed, source-level correctness gap —
see §6 for the exact code path.

So AG Grid ships **two unrelated primitives** — a fast local mutator with no undo and no
server-awareness, and a narrow cell-only undo history with no transaction-awareness. Neither one
is an "optimistic mutation with rollback" system on its own; a consumer has to build that on top
of both, using the generic **Command pattern**:

> "Before executing any command, the editor makes a backup and connects it to the command
> object" — to undo, "the app restores the past state ... saved by that command." — [Refactoring Guru: Command](https://refactoring.guru/design-patterns/command)

The practical implication: an invertible edit command must capture, at minimum,
`{ rowKey, colKey, oldValue, newValue }` (or the whole row for a delete) — enough to run either
direction without re-deriving anything from ambient state.

Full detail: [research-grid-transactions.md sources](https://www.ag-grid.com/javascript-data-grid/data-update-transactions/), [AG Grid Immutable Data](https://www.ag-grid.com/javascript-data-grid/data-update-row-data/), [Handsontable Undo/Redo](https://handsontable.com/docs/javascript-data-grid/undo-redo/).

---

## 4. Cross-family comparison

| | Family A (query-cache) | Family B (sync-engine) | Family C (grid transaction) | **This repo (`withOptimistic`)** |
|---|---|---|---|---|
| Unit of "unconfirmed" | Whole-value snapshot or JSON patch, per cache key | Per-property value, or a replayable mutator call | Whole-row transaction; undo shape undocumented internally | `RowRestorePoint { row, at, op }` per row id, in a `SnapshotMap` |
| Tagged by operation type? | No — same mechanism for create/update/delete | Only Linear (distinct transaction types); Replicache/Figma no | No — `applyTransaction`'s three arrays are symmetric, untagged | **Yes** — `op: 'create' \| 'update' \| 'delete'` on every restore point (ADR-0013) |
| Delete retains position? | RTK Query: yes (patch is positional). TanStack/Apollo: only if caller preserves array order | Figma/Replicache: no dedicated position concept. Linear: n/a (soft-archive is preferred) | **No** — transaction API keeps nothing for undo | **Yes** — `at` captured at removal, read only if the row is still missing at revert |
| Create identity strategy | Undocumented by all three — caller convention only | Permanent client id from the start (Linear, Replicache); no swap needed | Undocumented — caller invents the id | **Temp id + explicit swap** (`swapRowId`, D49) — closer to Apollo's convention than Linear/Replicache's |
| Bulk / concurrent-row safety | RTK Query explicitly warns `.undo()` is unsafe under overlapping ops | Handled by log ordering (Linear/Replicache) or LWW (Figma) — not a per-item concern | Explicitly undocumented, left to consumer | `unconfirmed` set is independent of `snapshots`, so a retried create's identity survives a spent rollback (ADR-0013) |
| Rollback left to the consumer to design from scratch? | Yes, in all three | No — it's the framework's core job | **Yes, explicitly** (AG Grid states this) | N/A — this **is** the framework-provided answer |

**The headline finding:** every other system researched here treats "what to capture on
delete" and "how to reconcile a create's identity" as either undocumented or explicitly the
consumer's problem. This repo's `RowRestorePoint` (value + position + operation tag) plus a
separate `unconfirmed` set for temp-id creates is a **more complete, structurally-enforced answer
to both of those gaps** than any of the eight systems surveyed ship natively — which is also
`docs/1-state/features/row-editing.md`'s own "Competitive position" verdict, reached independently
against a different comparison set (TanStack Table, AG Grid, Material React Table, PrimeNG — the
table libraries, not the general optimistic-UI patterns surveyed here).

---

## 5. Practical checklist — building optimistic UI state from scratch

If you're asked to add optimistic UI to some Angular feature and want to know what state to
introduce, in order:

1. **One map, keyed by the entity's id**, holding a restore point per pending item — not a
   parallel array, not per-field flags scattered on the entity itself. Every system surveyed
   converges on "one place to look up: is this id in flight, and what do I restore it to."
2. **Tag each restore point with which operation armed it** (`create` / `update` / `delete`).
   Untagged systems (Family A, AG Grid) push that knowledge onto whoever reads the map later;
   tagging it once at capture time is cheap and this repo's own experience (ADR-0013) is that it's
   needed almost immediately — e.g. to decide whether ADR-0006-style pruning should keep or drop
   an entry when the underlying row disappears.
3. **For update/delete, capture the value.** For delete, also capture **position** — nothing else
   in the researched prior art gives you this for free (RTK Query's patch-based approach is the
   only external system that does, and only because Immer's JSON patches happen to encode index).
4. **For create, decide identity up front**: permanent client-generated id (Linear/Replicache —
   simpler, no swap step, but requires your id-generation scheme to guarantee uniqueness without
   the server) vs. temp id + swap on confirmation (Apollo/this repo — more moving parts, but
   doesn't require changing how your backend issues ids).
5. **Separate "confirmed" from "restore point exists."** A restore point can be spent (reverted)
   while the underlying identity is still unconfirmed and must be retried — this repo's
   `unconfirmed` set exists specifically because a single boolean or a single map conflates these
   two facts (ADR-0013). None of Family A's three libraries model this distinction explicitly.
6. **Decide your bulk-failure policy before you need it, not during an incident.** No system
   surveyed treats bulk as structurally different from N single-item operations — but RTK Query's
   docs are the one explicit warning that naive per-item rollback becomes unsafe once operations
   overlap. Decide up front: independent per-row rollback, or a coarser
   "abandon-fine-grained-undo, refetch from source of truth" fallback once more than one optimistic
   op touches the same collection concurrently.
7. **Decide what "a fresh write from elsewhere" does to a pending item**, explicitly — this is the
   one gap every family in this research leaves undocumented or unsolved (a subscription push, a
   websocket message, another tab's write, all landing while your optimistic write is in flight).
   This repo's answer is "revert wins by default, consumer can override via an explicit
   `captureEdit(id, row)`" (`row-editing.md` §5, "External write while a row is open") — a
   documented, deliberate default where the research surveyed here found only silence.

---

## 6. Source verification pass (2026-09-05)

The initial research (§§1–5) was written from official docs and engineering blog posts. Five of
the eight systems surveyed are open source; this section is a second pass that fetched their
actual GitHub source to confirm, correct, or extend those doc-derived claims. **Linear and Figma
are excluded — both are closed-source with no public repo**, so their sections above stand on
docs/blog sourcing only (Linear's is additionally corroborated by a CTO-endorsed reverse-engineering
of its minified frontend, already noted in §3).

| System | Verdict | What changed |
|---|---|---|
| TanStack Query | **Confirmed** | None — `mutation.ts` threads `onMutate`'s return value through as an opaque generic `context`, exactly as documented. (Minor caveat: absence of a temp-id helper was checked in the two mutation-lifecycle files, not a full-repo search.) |
| Apollo Client | **Confirmed** | The "separate optimistic layer" is a literal `Layer extends EntityStore` linked chain (`parent: EntityStore`); rollback is literally unlinking a layer node. Issue #7321 (`cache.evict` breaks auto-rollback) verified live. |
| RTK Query | **Confirmed** | `updateQueryData` literally calls Immer's `produceWithPatches`; `.undo()` is literally "dispatch the inverse patches." Confirmed there is **no code-level guard** against the race condition the docs warn about — the safety warning exists only in prose, not as a version/sequence check anywhere in source. |
| Replicache | **Confirmed, plus a correction** | All four mutation-queue/rebase claims held against real source (`rocicorp/mono/packages/replicache`, not the archived `rocicorp/replicache` repo the docs point toward). **New finding:** Replicache is now a legacy product line — Rocicorp's active Apache-2.0 investment moved to a successor, Zero, in the same monorepo. Treat Replicache here as a historical reference design, not a currently-maintained one. |
| AG Grid | **Confirmed, plus new information** | All four transaction/undo claims held. **New finding the docs-only pass couldn't get:** the undo-stack entry shape (`CellValueChange { rowPinned, rowIndex, columnId, oldValue, newValue }`) is keyed by **positional row index, not row id** — a real, source-confirmed bug class (undo can silently hit the wrong row after a sort/filter/add/remove). Also corrected: Immutable Data mode does **not** share the Transaction API's object-reference-equality fallback — it always requires `getRowId`. |

**Why this matters for the comparison in §4:** the AG Grid finding sharpens the headline claim
there. This repo's `RowRestorePoint` is keyed by **row id** (via `trackBy`) and only reads its
captured `at` index when the row is *missing* at revert time — a present row is replaced in place,
never located by stale index. AG Grid's undo stack does the opposite: it always resolves by index,
even when the row is still present, which is exactly the class of bug a source-level read
surfaces and a docs-only pass cannot.

---

## Sources

**Family A (docs + source-verified, §6):** [TanStack Query — Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates) · [TanStack Query — Mutations](https://tanstack.com/query/latest/docs/react/guides/mutations) · [`query-core/src/mutation.ts` (main)](https://github.com/TanStack/query/blob/main/packages/query-core/src/mutation.ts) · [Apollo Client — Optimistic mutation results](https://www.apollographql.com/docs/react/performance/optimistic-ui) · [Apollo Client — Updating the cache after a mutation](https://www.apollographql.com/docs/react/data/mutations) · [`cache/inmemory/entityStore.ts` (main)](https://github.com/apollographql/apollo-client/blob/main/src/cache/inmemory/entityStore.ts) · [Apollo `cache.evict` rollback issue #7321](https://github.com/apollographql/apollo-client/issues/7321) · [Redux Toolkit — Manual Cache Updates](https://redux-toolkit.js.org/rtk-query/usage/manual-cache-updates) · [`query/core/buildThunks.ts` (master)](https://github.com/reduxjs/redux-toolkit/blob/master/packages/toolkit/src/query/core/buildThunks.ts)

**Family B (docs; Replicache also source-verified, §6):** [Scaling the Linear Sync Engine](https://linear.app/now/scaling-the-linear-sync-engine) · [Rebuilding Linear's delta sync read path](https://linear.app/now/rebuilding-delta-sync-read-path) · [reverse-linear-sync-engine (community reverse-engineering, CTO-endorsed)](https://github.com/wzhudev/reverse-linear-sync-engine) · [How Replicache Works](https://doc.replicache.dev/concepts/how-it-works) · [Replicache — Server Push reference](https://doc.replicache.dev/reference/server-push) · [Replicache — Local Mutations](https://doc.replicache.dev/byob/local-mutations) · [`mono/packages/replicache/src/sync/push.ts` @ `50289a5`](https://github.com/rocicorp/mono/blob/50289a53a2df6976e9a4291a745dd18cad7082ac/packages/replicache/src/sync/push.ts) · [`.../sync/pull.ts` @ `50289a5`](https://github.com/rocicorp/mono/blob/50289a53a2df6976e9a4291a745dd18cad7082ac/packages/replicache/src/sync/pull.ts) · [How Figma's multiplayer technology works](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/) · [Making multiplayer more reliable](https://www.figma.com/blog/making-multiplayer-more-reliable/)

**Family C (docs + source-verified, §6):** [AG Grid — Transaction Updates](https://www.ag-grid.com/javascript-data-grid/data-update-transactions/) · [AG Grid — Updating Row Data (Immutable Data)](https://www.ag-grid.com/javascript-data-grid/data-update-row-data/) · [AG Grid — Updating Data](https://www.ag-grid.com/javascript-data-grid/data-update/) · [AG Grid — High Frequency Updates](https://www.ag-grid.com/javascript-data-grid/data-update-high-frequency/) · [AG Grid — SSRM Transactions](https://www.ag-grid.com/javascript-data-grid/server-side-model-updating-transactions/) · [AG Grid — Undo/Redo Edits](https://www.ag-grid.com/javascript-data-grid/undo-redo-edits/) · [`clientSideNodeManager.ts` @ `44839e5`](https://github.com/ag-grid/ag-grid/blob/44839e5f554a9226a16f1e6319407abbe0659f88/packages/ag-grid-community/src/clientSideRowModel/clientSideNodeManager.ts) · [`undoRedo/undoRedoStack.ts` @ `44839e5`](https://github.com/ag-grid/ag-grid/blob/44839e5f554a9226a16f1e6319407abbe0659f88/packages/ag-grid-community/src/undoRedo/undoRedoStack.ts) · [`interfaces/iUndoRedo.ts` @ `44839e5`](https://github.com/ag-grid/ag-grid/blob/44839e5f554a9226a16f1e6319407abbe0659f88/packages/ag-grid-community/src/interfaces/iUndoRedo.ts) · [Handsontable — Undo and redo](https://handsontable.com/docs/javascript-data-grid/undo-redo/) · [Refactoring Guru — Command pattern](https://refactoring.guru/design-patterns/command)

**This repo:** [`docs/1-state/features/row-editing.md`](../../../../features/row-editing.md) · [`src/api/features/editing-state.ts`](../../../../../../src/api/features/editing-state.ts) · [`src/mutations/optimistic-mutations.ts`](../../../../../../src/mutations/optimistic-mutations.ts) · [ADR-0013](../../../../../adr/0013-optimistic-and-pessimistic-are-call-site-facts.md)
