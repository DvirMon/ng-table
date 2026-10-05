# Step 3 — Unit tests for `updateRows` + updaters

**PR scope:** Independent, deployable on its own.
**Task type:** test
**Stack:** angular
**Skills used:** unit-test
**Scaffolding agent:** test-implementer

**Depends on: Step 2**

## Files

- `libs/shared/design-system/src/ui/table/api/row-mutations.spec.ts` (new)

## Why This Step Exists

Acceptance criteria for issue #12 require unit tests for `updateRows` and all three updaters.
Per D19, the updaters must be testable standalone (no store) — that's the majority of this
spec; `updateRows` itself needs one thin test proving write-through.

## What To Do

Colocated `*.spec.ts`, plain `vitest` (no `TestBed` — nothing here touches Angular DI or
signals-in-a-component; a bare `signal()` stands in for the consumer's `WritableSignal`).

1. **`addRow`** (pure, no store)
   - Appends when `at` omitted.
   - Inserts at `{ at: 0 }` (prepend).
   - Inserts at a mid-range index — matches `Array.prototype.splice` behavior directly.
   - `at: -1` inserts before the last row (D27's `[1,2,3]` → `[1,2,X,3]` example, verbatim).
   - `at` beyond array length clamps to append; `at` below `-length` clamps to prepend. Both
     must not throw.

2. **`removeRow`** (pure, no store)
   - Removes the row whose `trackBy` result matches the given id.
   - No-op (returns an equivalent array) when the id isn't present.

3. **`patchRow`** (pure, no store)
   - Shallow-merges `partial` into the row matching the id; other rows unchanged (same
     reference, to confirm no unnecessary copying beyond the array wrapper).
   - No-op when the id isn't present.

4. **`updateRows`**
   - Build a minimal fake `TableStore`-shaped object: `{ data: signal(rows), trackBy }` cast
     the same way `updateRows` internally expects (per Step 2's cast). Call
     `updateRows(fakeTable, addRow(newRow))` and assert `fakeTable.data()` reflects the change
     — proves write-through to the signal, not just the pure updater logic.
   - One combined case is enough here; the updater-specific edge cases already live in 1–3.

## Implementation Notes

- Use `table.mock.ts`'s existing fixtures for row shape/`trackBy` if they fit; don't invent a
  parallel fixture set.
- Keep the `updateRows` fake-store object minimal — only `data` and `trackBy`, not a full
  `composeTable()` instance. This test is about the write-back mechanism, not integration with
  the rest of the engine.

## Risks / Watchouts

- Don't reach for `TestBed`/`createTable()` here — `engine/`'s testing rule in `table/CLAUDE.md`
  applies by extension: this logic has no Angular dependency, so a full store setup would be
  the wrong-file smell the CLAUDE.md warns about.

## Non-Goals

- Integration test through a real `createTable()` instance with the pipeline — out of scope;
  covered by this being a pure-function + signal test.
- Testing `withRowEdit()`/editing flows — not built yet (later issue).

## Acceptance Checks

- [ ] `addRow`, `removeRow`, `patchRow` each have passing tests covering the cases above
- [ ] `updateRows` has a passing write-through test
- [ ] `nx test shared-design-system --testPathPattern=row-mutations` passes

---

← [Step 2: Row updaters and updateRows](step-2-row-updaters-and-updaterows.plan.md)
