# Step 6 test plan — Open-set writes clear the closed set

Step: [step-6-open-writes-clear-closed.plan.md](step-6-open-writes-clear-closed.plan.md)
Trimmed: none. Seams D and E moved here from step 5; H2 added after the "named ids" ruling (D28).
Spec file: `libs/table/src/api/features/with-tree/feature.spec.ts`

Placement: a nested `describe('open-set writes and closed revealed rows')` beside step 5's describe. It uses the same fixture and filter terms as step 5.

## Stubs (red phase)

- None. No exported symbol is added. The change is inside `expand` / `set` in `with-tree/feature.ts` and its closed-set handle from `with-tree/reveal.ts`.

## Seams — in red-green order

### H. expand(ids) on a row closed while revealed → it shows open, the open set gains it, `changed` fires once

- Test: `it('expand(ids) on a row closed while revealed opens it, writes the open set and emits changed once')`
- Asserts: filter `'Grand'`, `tree.toggle('c1')` (closed; `renderRows()` ids `['r1', 'c1']`). Subscribe a spy to `tree.changed`, then `tree.expand(['c1'])`:
  - `renderRows()` ids equal `['r1', 'c1', 'g1']`
  - `tree()` equals `new Set(['c1'])`
  - the spy was called exactly once, with `{ added: ['c1'], removed: [] }`
- Why this seam: catches an `expand` that writes the open set but leaves the id in the closed set. The subtraction then keeps the row closed while `changed` reports it opened — the silent skip D28 removes, which would affect a filtered "expand all" button.
- Order reason: independent. Base case of the new behaviour; builds on step 5's close.

### H2. expand(ids) on an already-open row closed while revealed → it shows open again, `changed` silent

- Test: `it('expand(ids) on an already-open row closed while revealed shows it open again without emitting changed')`
- Asserts: `withTree({ parentId, initial: ['r1'] })`, filter `'Grand'`, `tree.toggle('r1')` (closed while revealed; r1 still in the open set). Subscribe a spy to `tree.changed`, then `tree.expand(['r1'])`:
  - `renderRows()` ids equal `['r1', 'c1', 'g1']`
  - `tree()` equals `new Set(['r1'])`
  - the spy was not called
- Why this seam: catches clearing only ids the write newly adds to the open set. r1 is already open, so that reading clears nothing and r1 stays closed. D28 rules named ids.
- Order reason: builds on H (same clear, the already-open case).

### I. set(ids) naming a row closed while revealed → it shows open

- Test: `it('set(ids) naming a row closed while revealed opens it')`
- Asserts: filter `'Grand'`, `tree.toggle('c1')`, spy on `changed`, `tree.set(['c1'])`:
  - `renderRows()` ids equal `['r1', 'c1', 'g1']`
  - `tree()` equals `new Set(['c1'])`
  - the spy was called once, with `{ added: ['c1'], removed: [] }`
- Why this seam: catches the clear being added to `expand` only. `expand` and `set` are separate public entry points with separate bodies today; no shared write helper makes them fail together. If green routes both through one helper, this test still pins `set`'s restore path.
- Order reason: builds on H (same mechanism, second entry point).

### E. collapse(ids) on a revealed id → writes only the open set; the reveal still shows the row open

- Test: `it('collapse on a revealed id writes only the open set and leaves the reveal showing the row open')`
- Asserts: `withTree({ parentId, initial: ['c1'] })`, filter `'Grand'`, `tree.collapse(['c1'])`:
  - `tree()` is empty
  - `changed` emitted `{ added: [], removed: ['c1'] }`
  - `renderRows()` ids still equal `['r1', 'c1', 'g1']`
- Why this seam: catches a shared write helper that touches the closed set on every write, including collapse. The ruling says collapse writes only the open set.
- Order reason: builds on H (the write path now touches the closed set; this pins where it stops).
- Red note: passes in red. Accepted guard.

### D. toggle(id) on a context row the predicate did not reveal → writes the open set as before

- Test: `it('toggle on a context row that revealContextRow excluded writes the open set and emits changed')`
- Asserts: `withTree({ parentId, revealContextRow: (row) => row.parentId == null })`, filter `'Grand'`. `renderRows()` ids are `['r1', 'c1']`: r1 is revealed; c1 is a context row but not revealed. Then `tree.toggle('c1')`:
  - `tree()` equals `new Set(['c1'])`
  - `changed` emitted once, with `{ added: ['c1'], removed: [] }`
  - `renderRows()` ids equal `['r1', 'c1', 'g1']`
- Why this seam: catches toggle branching on "is a context row" instead of "is currently revealed". That sends c1 into the closed set, and the click does nothing.
- Order reason: independent of H, H2, I and E. It guards step 5's branch condition.
- Red note: passes in red. Accepted guard.

## Types phase (written in red, proven by green's typecheck)

None — no public type surface in this step.

## Not tested

- `expand()` with no ids clearing discovered ids from the closed set. Same line as H: `target = ids ?? discovered` feeds one write. One bug, one seam.
- Toggle-to-open on a non-revealed id clearing the closed set. Unreachable: only a toggle on a revealed id adds to the closed set, and the closed set is always intersected with the context ids. The exception — a `revealContextRow` reading mutable row data that flips after a data replace — is not in the outline.
- `set(ids)` clearing closed ids it does not name. Unspecified; D28 covers only named ids.
- The internal closed set's contents. Implementation detail.
