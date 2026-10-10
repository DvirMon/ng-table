# ADR-0006 — Features reconcile their own row-id state when rows leave `data`

**Status:** accepted — implemented 2026-08-25
**Related:** [ADR-0003](0003-in-house-table-store-engine.md) (the feature contract this extends),
[ADR-0004](0004-table-source-layout.md) (where the helper lives),
`docs/1-state/work/effect-free-column-reactivity/` (the effect policy this ADR argues against).
Prior-art survey (TanStack/AG Grid/NgRx), memory analysis, and the open trackBy-swap question:
[`work/row-id-state-reconciliation/research-prior-art.md`](../1-state/work/row-id-state-reconciliation/research-prior-art.md).

Several features store state keyed by `RowId` (`withExpansion()`'s `expandedRows`/`everExpanded`,
`withRowEdit()`'s `editing`) separate from `data`, and nothing reconciled it against `data` —
delete a row that's expanded or open for editing and its id lingered forever, corrupting counts
and iteration in any consumer reading the raw signal. Rendering itself was always safe (the
render-row builder walks `data` and looks up intent per row), so the fix targets state, not
display.

## Decision

**A feature that stores `RowId`-keyed state declares `onRowsRemoved`, and cleans that state
itself.** The engine detects which ids left `data` (via an effect watching `data`, not a hook
inside `updateRows` — a full `data.set(...)` replacement bypasses `table.value.update(...)`
entirely, which a write-site hook can't see) and announces; it never reaches into feature state.

```ts
// engine/types.ts — one optional field on TableFeatureSpec
onRowsRemoved?: (ids: readonly RowId[]) => void;
```

Each feature implements it via a pure helper (`engine/rows.ts`), so the delete loop is written
once and stays plain `vitest`:

```ts
export function pruneByIds<V>(
  container: ReadonlyMap<RowId, V>,
  removedIds: readonly RowId[],
  keep?: (value: V) => boolean,
): ReadonlyMap<RowId, V>;
export function pruneByIds(
  container: ReadonlySet<RowId>,
  removedIds: readonly RowId[],
): ReadonlySet<RowId>;
```

**Exemptions are per feature, not centralized** — a core registry that reconciled every id-keyed
slice uniformly couldn't express either: `withRowEdit()`'s `ABSENT` snapshots (D28's blank-row-add
puts an id in `editing` before the row exists in `data`) and `withExpansion()`'s `everExpanded`
(an additive ledger by design, answers "ever expanded", not "is this row live"). Row removal
never prunes it. It has exactly one explicit, consumer-called remover, `release()`, which skips
ids that are currently open.

## Alternatives considered

- **Derive on read + prune on write.** Rejected — correct-when-read, not correct: the raw map
  disagrees with reality between writes, so a devtool or a feature reading another's state via
  `composed` sees rows that no longer exist.
- **Consumer cleans up** (pair every `removeRow` with `endEdit`). Rejected — the call people
  forget; TanStack issue #5850 is the evidence for where that leads.
- **State on the row object** (AG Grid's model). Rejected — blocked by the locked
  `rows()`-returns-no-wrappers invariant and `RenderRow` being rebuilt per recompute.
- **Central reconciler.** Rejected — can't express the `ABSENT`/`everExpanded` exemptions, and
  couples the core to the set of features that exist.

## Consequences

- **`withExpansion()`'s behavior changes**: expand a row, delete it, re-add the same id, and it no
  longer returns expanded. A shipped-code behavior change, needs a test.
- **`indexById` moves from a `createTableCore()` closure onto `TableCore`** — internal only, public
  API unchanged.
- **Not enforced by the type system.** A future feature that stores `RowId`s and forgets
  `onRowsRemoved` reproduces this bug invisibly. Mitigated only by documentation
  (`CLAUDE.md`'s feature-plugin section).
- **`revertEdit` on a deleted row becomes a no-op by construction** — the entry is gone before
  anything can call it, closing review finding #6 without a separate decision.
