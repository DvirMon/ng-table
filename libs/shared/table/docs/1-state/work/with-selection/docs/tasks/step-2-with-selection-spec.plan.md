---
title: "Step 2 — withSelection() colocated spec"
type: task-step
issue: 55
---

# Step 2 — `withSelection()` colocated spec

**PR scope:** Depends on Step 1 (tests the public members it produces).

**Task type:** test

**Skills used:** unit-test (test selection policy), angular-developer (TestBed conventions)

**Scaffolding agent:** test-implementer

## Files

- `libs/shared/table/src/api/features/with-selection.spec.ts` (new)

## Why This Step Exists

The spec's Testing Decisions section is explicit: only external behavior, through the public store, composed via the table factory — no reaching into feature internals, no assertions on how state is stored or recompute counts. This step is the executable form of that coverage list, mirroring `with-expansion.spec.ts`'s structure (already prior art cited in the spec itself).

## Depends on

Step 1 — needs `withSelection()`'s public members to exist.

## What To Do

1. Set up the test harness exactly like `with-expansion.spec.ts`:
   - `makeStore(cfg, rows)` helper: `TestBed.runInInjectionContext(() => createTable(signal(rows), cfg))`.
   - Use the **shared fixtures** from `table.mock.ts` (`mockRows`, `mockTrackBy`) per the spec's Testing Decisions ("uses the shared row fixtures rather than inlining new ones") — do not define a local `Row`/`makeRows()` the way `with-expansion.spec.ts` does; that predates this instruction. Build `ColumnDef[]` minimally (one column) the same way `with-expansion.spec.ts` does.

2. Cover every item in the spec's "Coverage" list (`3-spec.md` → Testing Decisions), one `it()` per bullet or tightly grouped where natural:
   - Toggling adds, toggling again removes, repeated toggles alternate.
   - Bulk `select`/`deselect` apply in one write; duplicate ids within a call collapse (assert `selectedRows()` size and the emitted `added`/`removed`).
   - `clearSelection()` empties the set.
   - With `enableMultiRowSelection: false` (table-wide): `toggle()` on a second row replaces rather than adds; `select(['a','b'])` keeps only the last id; the same case throws when `ngDevMode` is truthy (see note below on testing the dev-mode throw).
   - With `enableMultiRowSelection` as a per-row predicate: co-selection is forbidden only for the rows the predicate returns `false` for; other rows remain multi-selectable.
   - An id absent from the seeded row data still toggles/selects (D8).
   - `selectionStateOf(ids)` returns `'none'`/`'some'`/`'all'` correctly for the given id set, and is unaffected by selection state on ids outside that set.
   - Every write verb (`toggle`, `select`, `deselect`, `clearSelection`) emits exactly one `selectionChanged` delta with the correct `added`/`removed`; a no-op write (e.g. `deselect` on an unselected id, `select([])`) emits nothing; a write with `{ emitEvent: false }` changes `selectedRows()` but the subscriber sees no emission.
   - `initialSelection` seeds `selectedRows()` and emits nothing — including to a subscriber that subscribes to `selectionChanged` immediately after construction (assert no synchronous emission reaches it).
   - Removing a row from the table's `data()` (via `table.value.update(...)` or re-seeding the `data` signal, matching the pattern ADR-0006 tests elsewhere in this package use) prunes its id from `selectedRows()` and emits nothing on `selectionChanged`.
   - Selection is unaffected by sorting (compose `withSorting()` alongside `withSelection()`, sort, assert `selectedRows()` unchanged) and by a data write that reorders without removing.
   - `selectionChanged` completes when the table/injector is destroyed (assert via an `complete`/`finalize` subscriber, matching however `with-expansion.spec.ts` or another feature spec in this package asserts `onDestroy` behavior — check `with-row-edit.spec.ts`/`with-optimistic.spec.ts` for the established destroy-testing pattern before inventing a new one).

3. For the dev-mode throw (D14): find how (if at all) `ngDevMode` is stubbed/asserted elsewhere in this repo's test suite first (it wasn't found in `libs/shared/table/src` as of this plan — check the broader monorepo/Angular test setup, e.g. a global test setup file that defines `ngDevMode`). If no existing convention exists, set `(globalThis as any).ngDevMode = true` for the duration of that one test (restore afterward) rather than inventing a new global test helper — keep the footprint local to this spec file.

## Implementation Notes

- Assert emissions by subscribing before the write and pushing results into a local array (`const emissions: SelectionChange[] = []; store.selectionChanged.subscribe(c => emissions.push(c));`), then asserting on `emissions` — matches how RxJS-stream features are typically asserted in this codebase (check `with-expansion.spec.ts`'s `rowExpanded` assertions, if any, for the exact idiom; if expansion doesn't test its stream, `with-row-edit.spec.ts`/`with-optimistic.spec.ts` are the next reference).
- Keep every test asserting only on `SelectionMembers` (the public surface) plus `store.value`/`store.rows` where needed to mutate underlying data (e.g. to test removal reconciliation) — never reach into `with-selection.ts` internals.

## Risks / Watchouts

- Don't let the "no-op emits nothing" tests become flaky by asserting `emissions.length === 0` only at test end without a synchronous-emission guarantee — RxJS `Subject.next()` is synchronous, so a plain array-push subscriber is sufficient; no need for `fakeAsync`/`tick()`.
- The "subscriber attached immediately after construction sees nothing from `initialSelection`" test must subscribe *after* `makeStore()` returns (mirroring real consumer timing) — subscribing before construction would trivially pass for the wrong reason (nothing has run yet either way pre-construction), so this test only means something if the subscribe happens post-construction, pre-any-write.

## Non-Goals

- No DOM/structural/directive-layer tests here — those belong to the UI-layer directive specs, tracked separately.
- No test of counts of internal recomputation (e.g. asserting a `computed()` ran N times).

## Acceptance Checks

- [ ] Every bullet in `3-spec.md`'s Testing Decisions → Coverage list has a corresponding passing test.
- [ ] All tests compose `withSelection()` through `createTable()` — none instantiate the feature factory directly or import internals not exported from `with-selection.ts`'s public surface.
- [ ] Uses `table.mock.ts`'s `mockRows`/`mockTrackBy` rather than inlining new fixtures.
- [ ] `npm run test` (or the project's scoped equivalent for this package) passes — user runs this, per this repo's "never run tests unprompted" convention; report what's worth verifying instead of running it.

---
← [Step 1: withSelection() feature plugin](step-1-with-selection-plugin.plan.md)
