---
title: Handoff — swapRowId(from, to), closing G3
type: plan
status: shipped 2026-09-03
date: 2026-09-03
parent: ../with-row-editing/2-decisions.md
---

# Handoff — `swapRowId(from, to)`

Self-contained brief. Everything needed is here or linked. Closes
[G3](../../active/with-row-editing/5-gaps.md) via [D49](../with-row-editing/2-decisions.md#d49--o20-resolved-swaprowidfrom-to-no-forced-end-edit-2026-09-03),
tracked as [#19](https://github.com/DvirMon/ng-table/issues/19).

## Why now

An optimistically created row gets a temp client-side id. When the server confirms and returns
the real id, nothing today reconciles it:

1. **A pending create settled under the server id silently no-ops.** `snapshots` still holds the
   entry under `tempId` (exempt from ADR-0006 pruning while `ABSENT`/ un-settled), so any call
   addressed by the server id finds nothing. The row stays `pending` forever.
2. **A row open for edit when the swap lands silently drops out of edit mode.** `open` is not
   exempt from ADR-0006's reconciliation, so the moment the row's id changes underneath it, the
   removal-diff prunes the entry — no error, no event, the editor just closes.

Both are reachable on the first optimistic-create round-trip any consumer builds.

## Scope — decided 2026-09-03

**The product requirement, stated directly:** an optimistic table must never gate a
consumer-visible action on the state layer's internal sync. A row stays editable through a
create/save round-trip regardless of when the server responds — no field disables, no forced
close, no blocked reopen.

That requirement decides O20: **"enforce end-edit-first" is rejected**, not deferred. Both of its
implementations (block the swap until the row closes, or block opening a still-pending row) gate
a consumer action on internal state — exactly what's ruled out. The only remaining option is
**migrate the key while the row stays open** — see D49 for the full elimination.

## The fix

One new `EditingUpdater`, same file and shape as `discardEdit`/`removeEdit`
(`mutations/optimistic-mutations.ts`):

```ts
/**
 * Re-keys `from` to `to` in whichever of `open`/`snapshots` hold it — the temp-id → server-id
 * swap on an optimistic create. Does not touch `data`; the caller writes the row's new identity
 * there (e.g. via `patchRow`) in the same synchronous handler, before this call. No-op when
 * neither map holds `from` (house rule).
 */
export function swapRowId<TRow>(from: RowId, to: RowId): EditingUpdater<TRow> {
  return (state) => {
    const heldOpen = state.open.has(from);
    const heldSnapshot = state.snapshots.get(from);
    if (!heldOpen && heldSnapshot === undefined) {
      return state; // house rule: no-op on a miss
    }

    let open = state.open;
    if (heldOpen) {
      open = new Set(open);
      open.delete(from);
      open.add(to);
    }

    let snapshots = state.snapshots;
    if (heldSnapshot !== undefined) {
      snapshots = new Map(snapshots);
      snapshots.delete(from);
      snapshots.set(to, heldSnapshot);
    }

    return { open, snapshots };
  };
}
```

**Deliberately does not call `writeData`.** `trackBy: TrackByFn<TRow>` is `(row) => RowId`, not
necessarily a key lookup — a consumer may supply an arbitrary function, so nothing outside
`createTable()`'s own config can generically know which field to overwrite to give a row a new
id. `swapRowId` re-keys the editing-state maps only; the consumer separately writes the row's new
identity into `data`.

## Consumer call site

```ts
// Create (optimistic) — createRow(id, row, opts?) wraps beginEdit(id, { insert: row }); a
// freshly created row is immediately open for editing, so this stays on the editing slice.
const tempId = crypto.randomUUID();
table.editing.update(createRow(tempId, draft));

// ... user can keep editing this row the whole time; save can land whenever ...

// Server confirms
async function onCreateConfirmed(tempId: RowId, payload: NewRowInput) {
  const saved = await api.createRow(payload);
  table.value.update(patchRow(tempId, saved));         // row's new identity lands in `data`
  table.editing.update(swapRowId(tempId, saved.id));    // open/snapshots follow, same handler
}
```

Two calls, one per slice (`table.value` / `table.editing`) — consistent with D30 (every write is
`table.<slice>.update(updater)`, no cross-slice write except through a slice's own
`writeData`/`indexById` context). `discardEdit`/`removeEdit` get to be one call because they only
ever act *within* the editing slice's own context (`writeData` writes `data`, but the *decision*
of what to write is theirs — a filter). `swapRowId` can't own that decision generically, so it
stays two calls.

## Why the order is safe

`patchRow(tempId, saved)` changes the row's trackBy-resolvable identity in `data`. On its own,
that would eventually make `tempId` vanish from `indexById`, which ADR-0006's reconciliation
(`engine/compose-table.ts`, an `effect()`) watches for — if it ran between the two lines above, it
would fire `onRowsRemoved([tempId])` and prune the very entry `swapRowId` is about to re-key.

It cannot run between them: Angular's `effect()` is scheduled, never synchronous within the
writing call stack. Both lines above execute synchronously in one consumer handler, so
`swapRowId`'s re-key always lands first; by the time the reconciliation effect flushes, `to` is
already the key and `from` never was — nothing to prune.

**This is a real invariant of the current effect-scheduling model, not a convention** — see Tests.

## Files

| File | Change |
|---|---|
| `mutations/optimistic-mutations.ts` | add `swapRowId()`, beside `discardEdit`/`removeEdit` |
| `mutations/optimistic-mutations.spec.ts` | tests below |
| `index.ts` | export `swapRowId` |
| `features/row-editing.md` | replace G3's two defects with shipped behavior; resolve O20/O24 in the open-questions table |
| `work/row-editing/active/with-row-editing/5-gaps.md` | close G3, point at this handoff |

**Landed ahead of this handoff, 2026-09-03:** `createRow(id, row, opts?)`
(`mutations/row-edit-mutations.ts`, exported from `index.ts`) — `beginEdit(id, { insert: row })`
under a name that reads as "create," not "begin editing." Independent of `swapRowId`, but the
create-path example above uses it; a consumer following this handoff should have it already.

## Tests

- `swapRowId` re-keys an `open` entry: `from` gone, `to` present, same membership otherwise.
- `swapRowId` re-keys a `snapshots` entry, preserving the `RowRestorePoint` value/`at`/`detached`
  unchanged — only the key moves.
- `swapRowId` when the row holds both `open` and `snapshots` under `from` — both re-key in one
  call.
- No-op when `from` holds neither — returns the same `state` reference (house rule).
- **The ordering invariant, explicitly**: compose a table with `withRowEdit()`, call
  `table.value.update(patchRow(tempId, saved))` then synchronously
  `table.editing.update(swapRowId(tempId, saved.id))`, flush effects (`TestBed.flushEffects()` /
  `await whenStable()`), assert `open`/`snapshots` hold `to` and `onRowsRemoved` never fired for
  `tempId`. This is the test that would catch a future change to effect scheduling reopening G3.
- Optimistic-create end-to-end: `insertRow` under `tempId` → `captureEdit`/`beginEdit` → `patchRow`
  + `swapRowId` → row still open/editable under `to`, `revertEdit(to)` restores correctly.

## Open — does not block

**Composition with a concurrent save.** A row that is both mid-edit and mid-save when the id
swap lands — does `swapRowId` need to compose with a `releaseEdit`-equivalent, or is that always
a separate consumer call? Not designed here; no consumer scenario has surfaced it yet. Revisit if
G4's `{ multiple: true }` combination with optimistic create exposes a real case.

## Not in scope

`G5`'s move half (optimistic rollback for a row *move*, tracked as
[#20](https://github.com/DvirMon/ng-table/issues/20)) — unrelated representation question (O22),
no consumer need yet.
