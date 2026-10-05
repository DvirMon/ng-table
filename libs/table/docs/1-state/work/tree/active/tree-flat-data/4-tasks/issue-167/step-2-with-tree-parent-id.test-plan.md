# Step 2 test plan — `withTree({ parentId })` nests flat rows

Step: [step-2-with-tree-parent-id.plan.md](step-2-with-tree-parent-id.plan.md)
Spec file: `libs/table/src/api/features/with-tree.spec.ts`

New cases go in a new `describe('flat data — parentId (#167)')` block. The broken-link cases go in a nested describe that reuses the `vi.spyOn(console, 'error')` before/after pattern from `describe('the ADR-0014 degrade')`.

Fixture: `makeFlatRows()` in `src/table.mock.ts`.

- It builds the same r1 → c1 → g1 / c2, r2 tree.
- Row type: `FlatRow { id; name; parentId?: string | null }`.
- Input order: `[g1, r1, c1, r2, c2]`.
  - g1 comes before its parent, which tests a forward reference.
  - r1 has `parentId: null`. r2 omits `parentId` (undefined).

## Stubs (red phase)

- `WithTreeConfig<TRow>.parentId?: (row: TRow) => RowId | null | undefined`
  - A type-only field. `withTree()` ignores it in red.
  - No function stub: every test goes through the existing `withTree()` export.
  - The Step 1 `engine/tree-links.ts` helper is imported by `with-tree.ts` only, never by these tests.

## Seams — in red-green order

### A. Flat rows + `parentId`, r1 and c1 open → the tree the nested fixture renders, with no report

- Test: `it('a flat fixture with parentId renders the same tree the nested fixture renders — ids, depth, parentId, hasChildren, isExpanded — and reports nothing')`
- Setup: `withTree({ parentId: (row) => row.parentId, initial: ['r1', 'c1'] })`. Spy on `console.error`.
- Asserts:
  - ids `['r1','c1','g1','c2','r2']`
  - depth `[0,1,2,1,0]`
  - parentId `[undefined,'r1','c1','r1',undefined]`
  - hasChildren `[true,true,false,false,false]`
  - isExpanded `[true,true,undefined,undefined,undefined]`
  - `console.error` not called
- Why this seam:
  - It is the base nesting. It catches a single-pass index that drops or orphans g1 because g1 comes before its parent.
  - It catches `null` and `undefined` not both meaning root. A `null` read as the id `"null"` falls into the absent-parent path and reports falsely. The zero-report assertion catches that; the depth check alone would not.
- Order reason: independent. This is the base case.

### B. Children are real rows: sourceIndex, counts and selectAllIds include collapsed children

- Test: `it('children are real rows — a child carries its data() sourceIndex, and totalRowCount and selectAllIds() count collapsed children')`
- Asserts:
  - Nothing open: `renderRows()` ids are `['r1','r2']`. This precondition is what fails in red.
  - Also nothing open: `totalRowCount()` is `5`, and `selectAllIds(store).sort()` is `['c1','c2','g1','r1','r2']`.
  - After `toggle('r1')`: c1's `sourceIndex` is `2` and c2's is `4`, their positions in `data()`, not in the render order.
- Why this seam: it catches nesting in a pipeline stage (children taken out of `rows()`) instead of the `'tree'` render stage. That would undercount `totalRowCount` and `selectAllIds()`. It also catches a child node whose id is not the child's `trackBy` id, which leaves `sourceIndex` undefined.
- Order reason: builds on A (nesting must exist first).

### C. Sorting by name desc → every sibling list follows the sort

- Test: `it('siblings at every level follow the pipeline sort order')`
- Setup: compose `withSorting()`, open r1 and c1, call `setSorting([{ columnId: 'name', direction: 'desc' }])`, then `TestBed.tick()`.
- Asserts: ids `['r2','r1','c2','c1','g1']`. Roots are swapped and r1's children are swapped.
- Why this seam: catches ordering siblings by the parent's list, by id, or by a `data()`-order index instead of the order of the stage's input nodes.
- Order reason: builds on A.

### D. Group headers pass through; nesting happens inside a header's member list

- Test: `it('composed after withGrouping(), a group header passes through and a child nests under its parent inside the header')`
- Fixture: flat `{id, region, parentId}` rows. p1 is US, c1 is US with `parentId: 'p1'`, p2 is EU. It mirrors the existing C1 test.
- Asserts:
  - After toggling the US header then p1: c1 is at depth 2 with `parentId === 'p1'`.
  - The US header is still `kind: 'group'`.
  - `console.error` is not called.
- Why this seam:
  - Catches indexing links over the top-level nodes only. Those are headers, so c1 would never find p1.
  - Catches resolving a header (`data === null`) as a row, which would throw or report it as a broken link.
- Order reason: builds on A.

### E. `isExpandable` given → it decides `hasChildren`; a lazy row's child nests once appended

- Test: `it('isExpandable decides hasChildren — a lazy row shows a toggle before children exist, and an appended child row nests under it')`
- Setup: rows `lazy` and `leaf`, with `isExpandable: (row) => row.id === 'lazy'`.
- Asserts:
  - lazy has `hasChildren: true` with no child in the input.
  - After `toggle('lazy')` the ids are unchanged.
  - After appending `{ id: 'lazy-child', parentId: 'lazy' }` and `TestBed.tick()`: ids `['lazy','lazy-child','leaf']`, and lazy-child is at depth 1.
- Why this seam: catches precedence inverted to "has a child" (no toggle before load). Also catches `hasChildren` computed from a snapshot that does not update when `data()` grows.
- Order reason: builds on A.

### F. `expand()` with no ids and `state` discover expandable rows from flat `input.rows()`

- Test: `it('expand() with no ids opens every row with a child in flat data, leaves leaves closed, and state() reads "all"')`
- Asserts:
  - `[...tree()].sort()` is `['c1','r1']`.
  - `state()` is `'all'`.
  - Before `expand()`, `state()` is `'none'`. This fails in red because the stub discovers nothing, so it reads `'none'` for the wrong reason. The `'all'` assertion is what fails.
- Why this seam: the current discovery walk recurses `childrenAccessor`. With `parentId` alone it finds nothing, so `expand()` is a no-op. This catches `expand()` or `state` not switching to the flat scan.
- Order reason: builds on A (uses the same "has a child" rule).

### G. Self-parent → the row renders at depth 0 with its subtree; one report

- Test: `it('a self-parent row renders at depth 0 with its subtree intact and reports once per evaluation')`
- Fixture:
  - `s1` with `parentId: 's1'`.
  - `s1c` with `parentId: 's1'`.
  - `s2` with `parentId: 's2'`, a second self-parent, to test the dedupe.
- Asserts:
  - After `toggle('s1')`: s1 is at depth 0 with `hasChildren: true`, s1c at depth 1, s2 at depth 0.
  - `console.error` is called exactly once for one `renderRows()`.
- Why this seam: catches a self-link that nests a row under itself, so it vanishes or loops. Catches a per-row report instead of a per-evaluation one.
- Order reason: builds on A.

### H. Parent absent from the input → the row renders at depth 0 with its subtree; one report

- Test: `it('a row whose parent is absent renders at depth 0 with its subtree intact and reports once per evaluation')`
- Fixture:
  - `o1` with `parentId: 'missing'`.
  - `o1c` under o1.
  - `o2` with `parentId: 'gone'`.
- Asserts:
  - After `toggle('o1')`: o1 is at depth 0, o1c at depth 1, o2 at depth 0.
  - One `console.error` call.
- Why this seam: catches the data-loss bug. An unresolved parent drops the row and its whole subtree (US 11, US 16).
- Order reason: builds on A.

### I. Cycle → the first cycle member in input order is the root; the rest nest under it; one report

- Test: `it('a cycle renders its first member in input order at depth 0 with the rest nested beneath, and reports once')`
- Fixture: `[k3→k2, k1→k2, k2→k1]`. k3 is not in the cycle but hangs off k2.
- Asserts:
  - With everything open: ids `['k1','k2','k3']`, depth `[0,1,2]`. k2's parentId is `'k1'`.
  - One report.
  - The test finishes (no hang).
- Why this seam: catches breaking the cycle at the node where the walk detects it. Walking from k3, that is k2, not k1, the first member in input order. Also catches an unbounded walk.
- Order reason: builds on A. This detection is separate from G and H.

### J. Throwing `parentId` → that row is a root, and rows naming it as parent still nest under it; one report

- Test: `it('a parentId that throws for a row degrades that row to depth 0, keeps its children beneath it, and reports once naming parentId')`
- Fixture: `parentId` throws for `t1` and `t2`. `t1c` resolves to `'t1'` normally.
- Asserts:
  - After `toggle('t1')`: t1 is at depth 0, t1c at depth 1, t2 at depth 0.
  - `console.error` is called exactly once.
  - `mock.calls[0][0]` contains `'parentId'`.
- Why this seam: catches an unguarded callback that takes down `renderRows()` (ADR-0014). Catches per-row reporting. Catches a degraded row losing its children because its id was never indexed as a parent.
- Order reason: builds on A.

### K. Dedupe is per kind and per evaluation

- Test: `it('two broken kinds in one evaluation report once each, and a second evaluation reports again')`
- Fixture: one self-parent and one absent-parent row, in a writable `signal`.
- Asserts:
  - First `renderRows()`: 2 calls.
  - After `data.set(rows.map((r) => ({ ...r })))`, `TestBed.tick()` and `renderRows()` again: 4 calls.
- Why this seam: catches one flag shared across kinds (1, not 2). Catches a flag hoisted to module scope, which reports once per process (2, not 4). The existing `resolveCallbacks` comment warns about exactly this mistake.
- Order reason: builds on G and H.

### L. Reports also fire in production (`ngDevMode` false)

- Test: `it('broken-link reports fire with ngDevMode false — production too')`
- Setup: `setNgDevMode(false)` in a `try/finally` that restores the previous value. Uses the H fixture.
- Asserts: one `console.error` call.
- Why this seam: catches dev-gating the report (ADR-0014 and US 15), which makes the unreproducible data problems invisible.
- Order reason: builds on H.

### M. The contributed `parentLink` is total: parent id, `null` for a root, `null` when `parentId` throws or returns undefined

- Test: `it('parentId contributes a total parentLink — a pipeline stage reads the parent id, and null for a null, undefined or throwing parentId')`
- Setup: a spec-local test feature, `recordsParentOf`, built with public `createTableFeature` and `stageSchema('pipeline')`. It claims `s.filter`, records `[id, ctx.parentOf?.(row)]` per row and returns the rows unchanged. This follows the pattern of the existing `claimsTreeStage` helper. The `parentId` returns null for r1, undefined for r2, and throws for `t1`.
- Asserts:
  - The recorded entries include `['c1','r1']`, `['r1',null]`, `['r2',null]`, `['t1',null]`.
  - `rows()` does not throw.
- Why this seam: the filter (#168) and group (#170) stages will call this link with no guard of their own. An unwrapped throw, or an `undefined` leaking through, would take down or confuse them.
- Order reason: independent. No nesting is needed.

### N. `parentId` set → claims the `'tree'` stage and the parent link; omitted → claims neither

- Test: `it('withTree({ parentId }) claims the tree render stage and the parent link; withTree() without it claims neither')`
- Setup: a spec-local `contributesParentLink` feature built with `createTableFeature(() => ({ parentLink: () => null }))`.
- Asserts:
  - `claimsTreeStage` + `withTree({ parentId })` throws `/both provide the "tree" render stage/`.
  - `contributesParentLink` + `withTree({ parentId })` throws `/both provide the parent link/`.
  - `contributesParentLink` + `withTree()` does not throw.
- Why this seam:
  - Catches the `renderStages` gate still keyed on `childrenAccessor` only, so the tree never nests.
  - Catches `parentLink` contributed unconditionally. That breaks collapse-only composition beside a future link owner (E13).
- Order reason: independent.

### O. `expand()` and `state()` degrade on broken links without reporting

- Test: `it('expand() and state() treat broken links as roots and never report — only the tree stage reports')`
- Setup: the H fixture plus a `parentId` that throws for one row. Spy on `console.error`. Do not read `renderRows()`.
- Asserts:
  - `state()` and `expand()` do not throw.
  - `expand()` opens the rows that have a child in the input (o1).
  - `console.error` is not called.
- Why this seam: catches the discovery walk reusing the reporting path, which logs the same data problem two or three times per data change.
- Order reason: builds on F and H.

## Types phase (after green)

Add these to the existing `describe('types')` block in `with-tree.spec.ts`. That is where this file already keeps its `expectTypeOf` checks.

- `withTree({ parentId: (row) => { expectTypeOf(row).toEqualTypeOf<FlatRow>(); return row.parentId; } })` inside `createTable(signal<FlatRow[]>(…), …)`
  - Pins that `parentId`'s row parameter is inferred as `RowOf<In>`, not `any`.
- `// @ts-expect-error` on `withTree({ parentId: () => ({}) })`
  - Pins the return type to `RowId | null | undefined`.

## Not tested

- **Collapse-only behaviour with no `parentId`:** the existing `describe('collapse-only (D9/E13)')` tests already cover it and the outline keeps them unchanged. N covers only the new half: no parent-link claim.
- **The `childrenAccessor` path:** the existing tests stay as they are; Step 5 removes the accessor.
- **Hiding descendants of a collapsed row:** `flattenVisible` owns this and existing tests cover it. It is not this step's logic (spec-files-assert-own-domain-only).
- **The wording of the parent-link collision message:** the engine owns it, and `compose-table.spec.ts` already asserts the full text. N matches only a fragment, to prove `withTree` is the claimant.
- **`tree-links` resolution, kind by kind, as a unit:** Step 1's own spec on the pure engine helper covers it. Here it is tested only through the store (the spec's seam 1).
- **Report message text for self, absent and cycle:** no wording is specified, so asserting one would be tautological. Only the count is asserted, plus `'parentId'` for the throw case, which mirrors the existing `isExpandable` test.
- **A child whose parent sits in a different group:** roots-only grouping is #170, out of scope.
- **Filter interplay, context rows, reveal:** #168.
- **`parentOf` / `descendantsOf` reads:** Step 3.
- **`isExpanded` / `aria-rowcount` in the directive:** directive layer, #165.

## Decisions (resolved in review, 2026-09-29)

- Only the `'tree'` stage reports. `expand()` and `state()` degrade silently (seam O).
- `parentLink` maps a throw or `undefined` to `null` without reporting; a self-parent id passes through as-is (tree-links resolves it).
- Fixture lives in `src/table.mock.ts`.
- Type checks stay in the spec's `describe('types')` block.
- Seam M is kept: it observes the link only through the public `createTableFeature` surface.
