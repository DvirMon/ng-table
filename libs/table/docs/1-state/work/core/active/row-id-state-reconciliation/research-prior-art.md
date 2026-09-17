# Research relocated from ADR-0006 (D7, trim-docs #46)

Prior art, memory analysis, and the open trackBy-swap question that were previously inline in
[ADR-0006](../../../../../adr/0006-row-id-state-reconciliation.md) — the decision and its accepted
alternatives stay in the ADR; this is the research that informed it.

## Prior art

**TanStack Table has this exact bug.** `rowSelection` is a flat `Record<id, boolean>` that is not
cleaned when rows are removed. [Issue #5850](https://github.com/TanStack/table/issues/5850) asked
for a remove-by-id API or documented guidance and was closed with no fix and no maintainer
response. [Issue #4369](https://github.com/TanStack/table/issues/4369): after deleting every
selected row, `getSelectedRowModel()` correctly returns empty while `getIsSomeRowsSelected()`
still returns `true` — the API that walks rows is right, the one reading raw state is wrong.
Their de-facto guidance is to hoist selection into consumer scope and clean it manually.

**AG Grid sidesteps it architecturally.** No separate id set — state lives on the row node itself
(`RowNode.expanded`, `isSelected()`, `rowIndex`, `destroyed`). Removing a node via
`applyTransaction({ remove })` takes its state with it. Not available to us: `rows()` never
returns wrapper objects, and `RenderRow` is rebuilt on every recompute, so it cannot hold
persistent state; AG Grid's `RowNode` is identity-stable across updates, ours deliberately isn't.

**NgRx SignalStore derives instead of cleaning** — `selectedEntities: computed(() =>
entities().filter(e => selectedIds()[e.id]))`. Orphans persist in the raw record but never
surface, because nothing iterates the record. NgRx also
[declined](https://github.com/ngrx/platform/discussions/4722) to build selection into
`withEntities`, on the grounds that collections want different selection semantics — precedent
for opt-in-per-feature over core reconciliation.

## Memory analysis (the rejected derive-on-read alternative's strongest argument)

An orphaned `expandedRows` id costs ~50–100 B; an orphaned `editing` entry costs ~300–500 B
(retains a full row snapshot). Bounded scenarios are negligible: one entry per open-then-delete
under single mode (~10 KB/session), ~100 KB for a 1,000-row bulk delete. The only scenario
reaching tens of MB is a table alive for hours with continuous id churn (a WebSocket feed, or
paging where rows never return) while the user keeps expanding rows: ~58,000 entries ≈ 6 MB over
an 8-hour session. Re-fetching the *same* ids leaks nothing. Memory was never the deciding factor
in either direction.

## Open — trackBy-swap interaction (tracked as G3/O20 in the gap register)

Does `onRowsRemoved` fire for ids that leave via a trackBy change (a temp-id swap: `patchRow`
replaces a client id with the server's)? Under a pure id diff, yes — the old id is genuinely
gone — which would clean `editing` for a row the user is still editing mid-swap.

Confirmed against the implementation: `open` *is* pruned on a swap, so a row swapped while still
open silently leaves edit mode. `snapshots` is *not* pruned when the snapshot is `ABSENT` (the
optimistic-create case), so a pending entry orphans under the temp key instead. Neither is fixed.
Engine-side swap detection was rejected: `{removed: [temp], added: [server]}` in one recompute is
indistinguishable from a delete plus an unrelated insert.
