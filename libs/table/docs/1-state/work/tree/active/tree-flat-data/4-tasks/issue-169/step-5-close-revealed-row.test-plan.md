# Step 5 test plan — Close a revealed row

Step: [step-5-close-revealed-row.plan.md](step-5-close-revealed-row.plan.md)
Trimmed: seams D and E moved to step 6 when the step was split (7 seams > ~5).
Spec file: `libs/table/src/api/features/with-tree/feature.spec.ts`

Placement: a nested `describe('closing a revealed row (D20c)')` inside step 4's filter-reveal describe.

Fixture:

- `makeFlatRows()` (r1 → c1 → g1, r1 → c2, r2) with `withTree({ parentId: (row) => row.parentId })` and `withFiltering({ schema: (path) => ({ name: contains(path.name) }) })`.
- Filter `'Grand'` matches only g1, so the context ids are {r1, c1} and `renderRows()` shows `[r1, c1, g1]`.
- Filter `'Two'` matches only c2, so the context ids are {r1}.
- `''` clears the filter.
- Every assertion goes through `renderRows()`, `tree()` and `tree.changed`. No test reads the internal closedWhileRevealed set.

## Stubs (red phase)

- None. The step adds no exported symbol. It only changes the internals of `tree.toggle` and the `expandedRows` contribution in `with-tree/reveal.ts` / `with-tree/feature.ts`. Red fails on assertions.

## Seams — in red-green order

### A. toggle(id) on a revealed context row → the row closes; the open set and `changed` are untouched

- Test: `it('toggle on a revealed context row closes it without writing the open set or emitting changed')`
- Asserts: filter `'Grand'`, subscribe a spy to `tree.changed`, `tree.toggle('c1')`. Then:
  - `renderRows()` ids equal `['r1', 'c1']`
  - the c1 row has `isExpanded: false`
  - `tree()` is an empty set
  - the spy was never called
- Why this seam: catches toggle still writing the open set for a revealed id (today's path). That pollutes saved state and emits `changed`, against D20.
- Order reason: independent. Base case; needs only step 4's reveal.

### B. The closed row stays closed while the filter changes but it stays a context row

- Test: `it('a closed revealed row stays closed while typing continues and it remains a context row')`
- Asserts: as in A, then read `renderRows()`. Set the filter to `'Grandc'`: the context ids are still {r1, c1}, but in a new Set instance. `renderRows()` ids still equal `['r1', 'c1']`.
- Why this seam: catches a closed set that resets whenever its source changes. That is D17's reset-on-keystroke behaviour, which D20 rejected. A `linkedSignal` computation that ignores `previous` fails here. This is spec story 28's acceptance line.
- Order reason: builds on A.

### C. A second toggle on a closed revealed row → it reopens, still silently

- Test: `it('toggling a closed revealed row again reopens it, still without writing the open set')`
- Asserts: filter `'Grand'`, `tree.toggle('c1')` twice. Then:
  - `renderRows()` ids equal `['r1', 'c1', 'g1']`
  - `tree()` is empty
  - the `changed` spy was never called
- Why this seam: catches an add-only closed set (the outline says the toggle flips). Without it the person can't undo their close while filtering.
- Order reason: builds on A.

### F. After the filter clears, the person's own open set is back exactly, including a row closed while revealed

- Test: `it('clearing the filter restores the open set exactly, including a row closed while revealed')`
- Asserts: `withTree({ parentId, initial: ['r1'] })`, filter `'Grand'`, `tree.toggle('r1')`. Then:
  - `renderRows()` ids equal `['r1']`
  - `tree()` equals `new Set(['r1'])`

  Set the filter to `''`. Then:
  - `renderRows()` ids equal `['r1', 'c1', 'c2', 'r2']`
  - `tree()` equals `new Set(['r1'])`

- Why this seam: catches either of two bugs.
  - A toggle that removed r1 from the open set: r1 comes back closed after the clear.
  - A closed entry that outlives the filter: the subtraction keeps hiding r1.
- Order reason: builds on A.

### G. A closed id that stops being context, then becomes context again → revealed again

- Test: `it('a closed row that stops being a context row is revealed again when it becomes one again')`
- Asserts: filter `'Grand'`, `tree.toggle('c1')`. Set the filter to `'Two'`: `renderRows()` ids equal `['r1', 'c2']`. Set it back to `'Grand'`: `renderRows()` ids equal `['r1', 'c1', 'g1']`.
- Why this seam: catches a `linkedSignal` computation that keeps `previous` without intersecting it with the new context set. The stale id would silently hide a later match (D20c, self-clearing).
- Order reason: builds on B. B keeps the ids that stay; G drops the ones that leave.
- Watch out: `linkedSignal` only recomputes when read. The `renderRows()` read after `'Two'` is load-bearing; keep it in the test.

## Types phase (written in red, proven by green's typecheck)

None — no public type surface in this step.

## Not tested

- Re-typing the same term after a clear reveals the closed row again. Same bug as G; both tests would fail together.
- Toggle on a context row that `revealContextRow` excluded writes the open set. Step 6, seam D.
- `expand` / `set` / `collapse` interaction with the closed set. Step 6.
- Pruning closed-while-revealed ids on `onRowsRemoved`. A removed row can't be a context row, so the context-set intersection already drops it.
- `state()` after closing. It reads the open set, which this step never writes.
- Toggle with no active filter. Already covered by the existing `toggle(id) flips…` and `changed emits once per write…` tests.
