# Step 3 test plan — tree reads: `parentOf` / `descendantsOf`, and `removeRow(id[])`

Step: [step-3-tree-reads.plan.md](step-3-tree-reads.plan.md)
Spec files: `libs/table/src/api/features/with-tree.spec.ts` (new `describe('tree reads (parentOf / descendantsOf)')` block, reusing Step 2's flat fixture and `inContext()` helper); the row-mutations spec for seam K.

Fixture from Step 2: flat rows `r1` (root) → `c1`, `c2`; `c1` → `g1`; `r2` (root), with `withTree({ parentId: (row) => row.parentId })`.

## Stubs (red phase)
- `TreeSlice.parentOf(id: RowId): RowId | null` — added to the `TreeSlice` interface and to the `tree` object in `buildTreeSpec`; throws `not implemented: parentOf`
- `TreeSlice.descendantsOf(id: RowId): RowId[]` — same place; throws `not implemented: descendantsOf`
- `removeRow<TRow>(ids: RowId[]): RowUpdater<TRow>` overload — declared; the array branch throws `not implemented: removeRow(ids)`

## Seams — in red-green order

### A. `parentOf(childId)` → the id its `parentId` names, at depth 1 and 2
- Test: `it('parentOf(id) returns the parent id of a child and of a grandchild')`
- Asserts: `parentOf('c1')` is `'r1'`; `parentOf('g1')` is `'c1'`.
- Why this seam: the base lookup. Catches the read resolving the wrong row (for example indexing by position, not by `trackBy` id) or returning the row instead of its id.
- Order reason: independent — the base case.

### B. `parentOf(rootId)` → `null`
- Test: `it('parentOf(id) of a root row returns null')`
- Asserts: `parentOf('r1')` and `parentOf('r2')` are both `null` (`toBeNull()`, not `toBeFalsy()`).
- Why this seam: the accessor may return `undefined` for a root. Catches `undefined` leaking out where the contract says `null`.
- Order reason: builds on A (same lookup, the root branch).

### C. `parentOf(unknownId)` → `null`
- Test: `it('parentOf(id) of an id not in data() returns null')`
- Asserts: `parentOf('nope')` is `null`, and it does not throw.
- Why this seam: the lookup misses the row entirely. Catches a throw on a missing index entry, or `undefined` from a failed map read.
- Order reason: builds on A (the row-miss branch of the same lookup).

### D. `descendantsOf(id)` → every descendant at any depth, never self, depth-first in data() order
- Test: `it('descendantsOf(id) returns every descendant depth-first in data() order and excludes the row itself')`
- Asserts: `descendantsOf('r1')` equals `['c1', 'g1', 'c2']` exactly; `descendantsOf('c1')` equals `['g1']`.
- Why this seam: catches a walk that stops at direct children (misses `g1`), that includes the starting id, or that returns an unstable order.
- Order reason: builds on A (walks the same resolved links, downward).

### E. `descendantsOf(unknownId)` → `[]`
- Test: `it('descendantsOf(id) of an id not in data() returns an empty array')`
- Asserts: `descendantsOf('nope')` equals `[]`, no throw.
- Why this seam: catches a throw, or `undefined`, when the start id has no row.
- Order reason: builds on D.

### F. Reads walk all of `data()`, not the pipeline's view
- Test: `it('parentOf and descendantsOf read data(), so a row the pipeline dropped still counts')`
- Setup: compose a local `createTableFeature` that claims the `'filter'` pipeline stage and drops `c1` (same pattern as the spec's existing `claimsTreeStage`; deliberately not `withFiltering()`, which is another domain).
- Asserts: `store.rows()` does not contain `c1` (proves the setup); `parentOf('g1')` is still `'c1'`; `descendantsOf('r1')` is still `['c1', 'g1', 'c2']`.
- Why this seam: `TreeInput` today exposes only `rows()`, the pipeline output. Catches the reads being built on `rows()` instead of `value()` — the cascade would then miss filtered-out descendants and leave them behind.
- Order reason: builds on A and D.

### G. A cycle terminates and resolves through the tree-links rule
- Test: `it('a parentId cycle never loops: the first row of the cycle is a root')`
- Setup: rows `a` (parent `b`), `b` (parent `a`). Spy `console.error` with a no-op to silence any tree-stage report; no count assertion.
- Asserts: `parentOf('a')` is `null`; `parentOf('b')` is `'a'`; `descendantsOf('a')` equals `['b']`; `descendantsOf('b')` equals `[]`. The test finishing at all is the "never loops" assertion.
- Why this seam: catches the reads walking the raw accessor instead of the resolved links from `engine/tree-links.ts`. A raw walk on a cycle hangs or overflows the stack.
- Order reason: builds on D.

### H. No `parentId` configured → `null` / `[]`
- Test: `it('without parentId, parentOf returns null and descendantsOf returns [] even when rows carry a parent field')`
- Setup: same flat fixture, `withTree()` with no config.
- Asserts: `parentOf('c1')` is `null`; `descendantsOf('r1')` equals `[]`.
- Why this seam: catches a fallback that reads a conventional field when the accessor is omitted. The old `row.children` fallback was removed on purpose (D2/E6), and a read-only fallback would bring it back.
- Order reason: independent (the config branch). Placed after G so every with-accessor seam is green first.

### I. Cascade: `removeRow([id, ...descendantsOf(id)])` removes the subtree
- Test: `it('removeRow([id, ...tree.descendantsOf(id)]) cascades the delete in one write')`
- Setup: `store.value.update(removeRow(['r1', ...store.tree.descendantsOf('r1')]))`, then `TestBed.tick()`.
- Asserts: `store.value().map((r) => r.id)` equals `['r2']`.
- Why this seam: the spec's must-have (D12). Catches `descendantsOf` returning ids a row write cannot use (render ids, or ids already moved out of `data()`). Also pins that the tree slice leaves the delete to the row write.
- Order reason: builds on D and K.

### J. Removing only the parent leaves its children as roots
- Test: `it('removing only a parent leaves its children in data at the top level, and parentOf reports them as roots')`
- Setup: `store.value.update(removeRow('r1'))`, `TestBed.tick()`.
- Asserts: `value()` still contains `c1`, `c2`, `g1`; `parentOf('c1')` is `null`; `parentOf('g1')` is still `'c1'`; in `renderRows()`, `c1` and `c2` have `depth` 0.
- Why this seam: catches the reads using a link map captured once and never refreshed after a data write. Also pins the "no silent cascade" half of D12.
- Order reason: builds on C (an absent parent resolves as `null`) and on I (the same data-write path).

### K. `removeRow(ids[])` removes every listed id in one write; unknown ids are skipped
- Test: `it('removeRow(ids) removes every listed id in one write and skips ids not in the rows')` (in the row-mutations spec)
- Asserts: applying `removeRow(['b', 'nope', 'd'])` to rows `a, b, c, d` returns `a, c`; applying `removeRow([])` returns the input unchanged; the single-id form still behaves as before.
- Why this seam: the D32 widened-arity delete. Catches an array form that stops at the first unknown id, or one that splices by stale indices after the first removal and deletes the wrong row.
- Order reason: independent. It is a pure updater; I builds on it.

## Types phase (after green)
- `expectTypeOf(removeRow<Row>(['a'])).toEqualTypeOf<RowUpdater<Row>>()` and the same for the single-id form — pins that both overloads resolve.
The two tree reads have explicit, non-generic return types; the existing `expectTypeOf(store.tree).toMatchTypeOf<TreeSlice>()` already covers the interface.

## Not tested
- Self-parent and absent-parent resolution rules on their own. They belong to `engine/tree-links.ts` and are tested there (Step 1). G checks that the reads use that module; J covers absent-parent at the store level only because it is this step's acceptance case.
- Broken-link report counts. Owned by Step 2; the reads never report.
- "The tree slice never writes rows" as its own test — no write path exists to break; I and J cover the observable half.
- `descendantsOf` for a leaf — same seam as D's "excludes self".
- `parentOf` for a group header id — not in `data()`, same bug as C.
- `contextRowIds()` — out of scope (#169).
- `patchRow(id[])` and `batch()` — D32's other halves, not built here.

## Decisions (resolved in review, 2026-09-29)
- The cascade uses `removeRow` with an array (D32 widened arity), built in this step. `removeRows` is not added — D32 rejects plural verbs.
- `descendantsOf` order: depth-first in `data()` order, parent before child.
- The reads never report.
- `withTree`'s input widens to include `value`.
