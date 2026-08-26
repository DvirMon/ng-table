# ADR-0006 — Features reconcile their own row-id state when rows leave `data`

**Status:** accepted — implemented 2026-08-25
**Date:** 2026-08-25
**Related:** [ADR-0003](0003-in-house-table-store-engine.md) (the feature contract this extends),
[ADR-0004](0004-table-source-layout.md) (where the helper lives),
`docs/1-state/work/effect-free-column-reactivity/` (the effect policy this ADR argues against)

## Context

Several features store state keyed by `RowId`, in a structure separate from `data`:

| Feature | Structure | Status |
|---|---|---|
| `withExpansion()` | `expandedRows: Set<RowId>`, `everExpanded: Set<RowId>` | shipped |
| `withRowEdit()` | `editing: Map<RowId, TRow \| ABSENT>` | shipped |
| `withSelection()` | selected ids | not yet written |

Nothing reconciles these against `data`. Delete a row that is expanded or open for editing and its
id remains in the feature's structure for the life of the table.

**Rendering is already safe.** The render-row builder walks rows from `data` and asks
`expandedRows.has(id)` per row — reality iterated, intent looked up. An orphaned id can never
produce a rendered row. The damage is confined to consumers reading the raw signal:

- **Wrong counts** — an "N rows being edited" badge counts rows that are not on screen.
- **Wrong iteration** — a "Save All" that walks `editing()` attempts to save deleted rows.
- **Retained memory** — entries and their snapshots are never released.

This is not a `withRowEdit()` defect; it is the house pattern, and `withExpansion()` shipped with
it unnoticed. Left alone, `withSelection()` inherits it a third time.

### Prior art

**TanStack Table has this exact bug.** `rowSelection` is a flat `Record<id, boolean>` that is not
cleaned when rows are removed. [Issue #5850](https://github.com/TanStack/table/issues/5850) asked
for a remove-by-id API or documented guidance and was **closed with no fix and no maintainer
response**. [Issue #4369](https://github.com/TanStack/table/issues/4369) is the sharpest evidence:
after deleting every selected row, `getSelectedRowModel()` correctly returns empty while
`getIsSomeRowsSelected()` still returns `true` — same library, two APIs, and the one that walks
rows is right while the one reading raw state is wrong. Their de-facto guidance is to hoist
selection into consumer scope and clean it manually.

**AG Grid sidesteps it architecturally.** There is no separate id set: state lives on the row node
itself (`RowNode.expanded`, `isSelected()`, `rowIndex`, `destroyed`). Removing a node via
`applyTransaction({ remove })` takes its state with it — nothing can fall out of sync because
there is no second structure. Not available to us: `CLAUDE.md` locks "**`rows()` never returns
wrapper objects**", and our `RenderRow` is rebuilt on every recompute, so it cannot hold persistent
state. AG Grid's `RowNode` is identity-stable across updates; ours deliberately is not.

**NgRx SignalStore derives instead of cleaning** — `selectedEntities: computed(() =>
entities().filter(e => selectedIds()[e.id]))`. Orphans persist in the raw record but never surface,
because nothing iterates the record. NgRx also
[declined](https://github.com/ngrx/platform/discussions/4722) to build selection into
`withEntities`, on the grounds that collections want different selection semantics and not all need
it — direct precedent for opt-in-per-feature over core reconciliation.

## Decision

**A feature that stores `RowId`-keyed state declares `onRowsRemoved`, and cleans that state
itself.** The engine detects which ids left `data` and announces; it never reaches into feature
state.

```ts
// engine/types.ts — one optional field on TableFeatureSpec
onRowsRemoved?: (ids: readonly RowId[]) => void;
```

Collected in `compose-table.ts` into a hooks array, exactly like the existing `onInit`/`onDestroy`.

**The trigger is an effect watching `data`**, not a hook inside `updateRows` — see "Effect policy"
below for why this ADR accepts an effect.

Each feature implements it via a pure helper, so the delete loop is written once:

```ts
// engine/rows.ts — pure, no signals, plain vitest
export function pruneByIds<V>(
  container: ReadonlyMap<RowId, V>,
  removedIds: readonly RowId[],
  keep?: (value: V) => boolean
): ReadonlyMap<RowId, V>;
export function pruneByIds(
  container: ReadonlySet<RowId>,
  removedIds: readonly RowId[]
): ReadonlySet<RowId>;
```

**As shipped this takes the container, not the signal.** The sketch above threaded a
`WritableSignal` through the helper; the implementation keeps it pure and returns the same
reference when nothing changed, so the feature owns its own `.set()` and the helper stays plain
`vitest`. It gained the `ReadonlySet` overload for the same reason — `withRowEdit` prunes a Set
(`open`) and a Map (`snapshots`) with one mechanism, and `withExpansion` prunes a Set.

```ts
// with-row-edit.ts — ABSENT entries are pending adds (D28), not orphans.
// `open` is pruned unconditionally: `pendingIds()` reads "has a snapshot but isn't open" as
// pending, so a removed id left in `open` would surface as newly pending.
const nextOpen = pruneByIds(current.open, ids);
const nextSnapshots = pruneByIds(current.snapshots, ids, (value) => value === ABSENT);

// with-expansion.ts — everExpanded is an additive ledger by design, exempt
const next = pruneByIds(expandedRows(), ids);
```

### Exemptions are per slice, owned by the feature

A feature decides which of its structures reconcile. Two exemptions exist today, both deliberate:

- **`ABSENT` snapshots** (`withRowEdit`) — D28's blank-row-add flow puts an id in `editing`
  *before* the row exists in `data`. Filtering it would delete the feature.
- **`everExpanded`** (`withExpansion`) — documented as additive-only, never shrinking on collapse.
  It answers "has this ever been expanded", not "is this row live".

A core registry that reconciled every id-keyed slice uniformly could not express either, which is
the concrete reason reconciliation is not centralized.

## Effect policy — why this ADR uses an effect

`docs/1-state/work/effect-free-column-reactivity/` is removing an `effect()` that writes into a
signal, and this decision adds one. That tension is deliberate, and rests on that work's own D1:
the violation it names is **one signal with multiple competing write sources** — declarative rules
fighting imperative writes over the same `columns` signal — not the use of `effect()` as such.

Removal reconciliation does not compete. It only ever deletes ids that cannot be valid, and can
never disagree with `beginEdit` about a row that exists. The write is subordinate to `data`, not a
second opinion about it.

**The alternative was rejected on coverage, not purity.** Announcing from inside the write path —
wrapping the `applyUpdater` of `core.value`'s `WritableView` (`engine/core.ts`), diffing ids before
and after — needs no effect and was the first choice, until the common case defeated it. `data` is
the consumer's own `WritableSignal` (ADR-0003, #46), so replacing the whole array — loading page 2,
refreshing from the server, applying a WebSocket snapshot — is a direct `data.set(...)` that never
passes through `table.value.update(...)`. That is precisely the case where *every* id is orphaned
at once, and precisely the case a write-site hook cannot see. A reconciliation mechanism that
misses full data replacement does not solve the problem it exists for.

## Consequences

- **`withExpansion()`'s behavior changes.** Expand a row, delete it, re-add the same id, and it no
  longer returns expanded. This is the fix, but it is a behavior change to shipped code and needs a
  test asserting the new expectation.
- **`indexById` moves from a `createTableCore()` closure onto `TableCore`.** Internal only — it is
  not added to `TableStore`, so the public API is unchanged.
- **The diff runs on every `data` change**, including a single blur commit under D24. It compares
  two id sets, O(n), and `indexById` is already rebuilt on the same change; the marginal cost is
  one pass. Features with no `onRowsRemoved` are not called, and when no composed feature declares
  one the effect is never created.
- **Opt-in is not enforced by the type system.** A future feature author who stores `RowId`s and
  forgets `onRowsRemoved` reproduces this bug, and it stays invisible until someone deletes a row.
  Mitigated only by documentation — `CLAUDE.md`'s feature-plugin section gains: *if your feature
  stores `RowId`s, declare `onRowsRemoved`.* The rejected derive-on-read alternative carries the
  identical exposure (an author who forgets to wrap leaks the same way), so this is not a cost of
  choosing cleanup over hiding.
- **`revertEdit` on a deleted row becomes a no-op by construction**, since the entry is gone before
  anything can call it. This closes review finding #5 without a separate decision: there is no
  "restore a row that no longer exists" case to design, because the state is reconciled at removal
  rather than inspected at revert.

## Alternatives considered

**Derive on read, plus prune on write (rejected — the closest call).** Keep the raw map untouched;
expose a `computed` that filters out ids absent from `data`, returning the same reference when
nothing was dropped so the identity fast path prevents a per-commit cascade. Pair it with pruning
the raw map inside writes the consumer already triggers (`beginEdit`, `toggleExpanded`), so memory
stays bounded without a watcher. Effect-free, covers direct `data.set(...)`, matches NgRx's pattern
and TanStack's one working API — and, most importantly, matches this codebase's own
`baseColumns`/`columns` shape, whose D3 states the `effect()` there existed *only* because a result
had to be written into a different signal.

Rejected because it is correct-when-read rather than correct. `editing()` filters, but the raw map
still disagrees with reality between writes, so any future code reading the base — a devtool, a
persistence layer, a feature reading another feature's state through the `composed` seam — sees
rows that no longer exist. The accepted cost is one effect whose write cannot conflict with
anything.

**Memory, for the record** (this was the argument that nearly carried the rejected option): an
orphaned `expandedRows` id costs ~50–100 B; an orphaned `editing` entry costs ~300–500 B because it
retains a full row snapshot. Bounded scenarios are negligible — one entry per open-then-delete under
single mode (~10 KB/session), ~100 KB for a 1,000-row bulk delete. The only scenario that reaches
tens of MB is a table alive for hours whose ids churn continuously (a WebSocket feed, or paging
where rows never return) while the user keeps expanding rows: ~58,000 entries ≈ 6 MB over an
8-hour session. Re-fetching the *same* ids leaks nothing. So memory was never the deciding factor
in either direction.

**Consumer cleans up (rejected).** Pair every `removeRow` with `endEdit`. This is TanStack's answer,
and issue #5850 is the evidence for where it leads: the call people forget, producing a bug that
surfaces far from its cause.

**State on the row object (rejected).** AG Grid's model. Blocked by the locked
`rows()`-returns-no-wrappers invariant and by `RenderRow` being rebuilt per recompute.

**Central reconciler (rejected).** A core-owned list of id-keyed slices pruned uniformly. Cannot
express the `ABSENT` and `everExpanded` exemptions, couples the core to the set of features that
exist, and defeats tree-shaking — the design NgRx explicitly refused.

## Open

- **Does `onRowsRemoved` also fire for ids that leave via a trackBy change** (D26's temp-id swap:
  `patchRow` replaces a client id with the server's)? Under a pure id diff it does — the old id is
  genuinely gone — which would clean `editing` for a row the user is still editing. D26's
  recommended order (`endEdit` under the old id, *then* `patchRow`) avoids it, but the ADR should
  not depend on call order alone.

  **Two halves, confirmed against the implementation.** `open` *is* pruned on a swap, so a row
  swapped while still open silently leaves edit mode. `snapshots` is *not*, when the snapshot is
  `ABSENT` — which is exactly the optimistic-create case — so a pending entry orphans under the
  temp key instead. Neither is fixed here. Tracked as **G3 / O20** in the gap register; engine-side
  swap detection was rejected there because `{removed: [temp], added: [server]}` in one recompute
  is indistinguishable from a delete plus an unrelated insert.
