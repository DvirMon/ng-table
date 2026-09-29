# Step 3 test plan — tree-retention

Step: [step-3-tree-retention.plan.md](step-3-tree-retention.plan.md)
Spec file: `libs/table/src/api/features/with-filtering/tree-retention.spec.ts`

Fixture style follows the sibling `engine/tree-links.spec.ts`:
- a local `Row { id: RowId; parent: RowId | null }`
- an `r(id, parent)` builder
- `trackBy = row => row.id`, `parentOf = row => row.parent`
- `matches` built from an id list, e.g. `(row) => ids.includes(row.id)`

A small `retain(rows, matchIds, { includeDescendants })` helper in the spec keeps each test to its fixture and its assertion. `includeDescendants` defaults to `false`. Assertions compare ids with `result.rows.map(trackBy)`, and compare `contextIds` with `toEqual(new Set([...]))`.

## Stubs (red phase)
- `retainTreeMatches<TRow>(rows: readonly TRow[], opts: { matches: (row: TRow) => boolean; parentOf: ParentLink<TRow>; trackBy: TrackByFn<TRow>; includeDescendants: boolean }): { rows: TRow[]; contextIds: ReadonlySet<RowId> }` in `libs/table/src/api/features/with-filtering/tree-retention.ts`. It throws `not implemented: retainTreeMatches`.
  - Imports: `RowId` and `TrackByFn` from `../../types`, `ParentLink` from `../../../engine/types`. All are `import type`.

## Seams — in red-green order

### A. A matching root with a non-matching child, flag off → only the root
- Test: `it('keeps a matching row and drops non-matching rows, children included')`
- Fixture: `[r('a', null), r('a1', 'a'), r('b', null)]`, match `a`
- Asserts: rows `['a']`, contextIds is an empty Set
- Why this seam: the base filter contract. It catches a helper that returns the whole pool, and one that keeps descendants without being asked.
- Order reason: independent. Base case.

### B. A matching grandchild → its whole ancestor chain is kept and flagged as context
- Test: `it('keeps every ancestor of a match and reports them as context rows')`
- Fixture: `[r('root', null), r('p', 'root'), r('leaf', 'p'), r('sib', 'p'), r('other', null)]`, match `leaf`
- Asserts: rows `['root', 'p', 'leaf']`, contextIds `{root, p}`
- Why this seam: the core D5 rule. It catches:
  - a walk that stops after one level (misses `root`)
  - a walk that pulls in an ancestor's other children (`sib`)
  - a walk that keeps unrelated roots (`other`)
- Order reason: builds on A (same output shape, adds the ancestor walk).

### C. A child listed before its parent → output keeps input order
- Test: `it('returns kept rows in input order even when a child precedes its parent')`
- Fixture: `[r('leaf', 'p'), r('p', null)]`, match `leaf`
- Asserts: rows `['leaf', 'p']`, contextIds `{p}`
- Why this seam: it catches two bugs:
  - a helper that emits ancestors before their descendant, which breaks sort order carrying through
  - a single forward pass that only finds parents already seen
- Order reason: builds on B.

### D. A matching ancestor → kept, but not a context row
- Test: `it('does not report an ancestor as a context row when it matches itself')`
- Fixture: `[r('p', null), r('c', 'p')]`, match `p` and `c`
- Asserts: rows `['p', 'c']`, contextIds is an empty Set
- Why this seam: glossary D7 says a matching row is never a context row. It catches `contextIds = all ancestors` with no match check.
- Order reason: builds on B.

### E. Two matches share one ancestor → that ancestor appears once
- Test: `it('keeps a shared ancestor once when several descendants match')`
- Fixture: `[r('p', null), r('c1', 'p'), r('c2', 'p')]`, match `c1` and `c2`
- Asserts: rows `['p', 'c1', 'c2']` (length 3), contextIds `{p}`
- Why this seam: it catches a helper that adds each ancestor chain to the output instead of marking a kept set and filtering the input.
- Order reason: builds on B.

### F. A root id of `0` → still a real ancestor
- Test: `it('treats a falsy parent id such as 0 as an ancestor link')`
- Fixture: `[r(0, null), r(1, 0)]`, match `1`
- Asserts: rows `[0, 1]`, contextIds `{0}`
- Why this seam: it catches a truthiness check (`while (parent)`) in the ancestor walk. That check would silently drop id `0`.
- Order reason: builds on B.

### G. `includeDescendants: true` → the whole subtree of a match, none of it context
- Test: `it('keeps every descendant of a match under includeDescendants, not as context rows')`
- Fixture: `[r('a', null), r('a1', 'a'), r('a11', 'a1'), r('b', null)]`, match `a`, flag on
- Asserts: rows `['a', 'a1', 'a11']`, contextIds is an empty Set
- Why this seam: it catches a descendant pass that goes only one level deep (misses `a11`). It also catches a helper that files descendants under `contextIds`.
- Order reason: builds on A (the same fixture shape, flag flipped).

### H. A row that is both a descendant of a match and an ancestor of a match, flag on → not a context row
- Test: `it('does not report a row kept as a descendant of a match as a context row, even when it is also an ancestor of one')`
- Fixture: `[r('a', null), r('a1', 'a'), r('a11', 'a1')]`, match `a` and `a11`, flag on
- Asserts: rows `['a', 'a1', 'a11']`, contextIds is an empty Set
- Why this seam: this is the precedence rule between the two keep reasons. Seam B shows that with the flag off, `a1` would be context. It catches `contextIds = ancestors − matches` computed without removing descendant-kept rows.
- Order reason: builds on D and G.

### I. A parent id missing from the pool → the walk stops there, and rows up to that point are kept
- Test: `it('stops the ancestor walk at a parent id absent from the rows')`
- Fixture: `[r('p', 'ghost'), r('c', 'p')]`, match `c`
- Asserts: rows `['p', 'c']`, contextIds `{p}`, and it does not throw
- Why this seam: it catches a helper that throws on the missing lookup, or adds `ghost` to `contextIds` (an id that has no row).
- Order reason: builds on B.

### J. A self-parented row → the walk ends, and the row is kept as context
- Test: `it('stops the ancestor walk at a self-parented row')`
- Fixture: `[r('p', 'p'), r('c', 'p')]`, match `c`
- Asserts: rows `['p', 'c']`, contextIds `{p}`
- Why this seam: it catches an infinite loop on `parentOf(p) === p`. The test hangs or times out instead of failing cleanly, so a vitest timeout is the red signal here.
- Order reason: builds on B.

### K. A cycle → it ends, and ancestry follows `resolveTreeLinks`' break point
- Test: `it('breaks a parent cycle where resolveTreeLinks does, so context rows match the rendered tree')`
- Fixture: `[r('a', 'b'), r('b', 'a'), r('x', null)]`, match `a`
- Asserts: rows `['a']`, contextIds is an empty Set
  - `resolveTreeLinks` breaks the cycle at `a`, the first row in input order. So `a` renders as a root, with `b` as its child.
- Why this seam: it catches an infinite loop. It also catches a naive visited-set walk, which would keep `b` as `a`'s "ancestor" (rows `['a', 'b']`, context `{b}`). That result contradicts the tree `withTree()` renders from the same links: a context row nested *under* its match.
- Order reason: builds on B and J.

## Types phase (written in red, proven by green's typecheck)
None — no public type surface in this step. `retainTreeMatches` is internal and not re-exported from `src/index.ts`, and its generic is a plain `TRow` pass-through with no inference to pin.

## Not tested
- A `matches` predicate that throws — the ADR-0014 guard wraps the consumer callback once per evaluation at the filter stage, which is step 4's call site. This helper receives an already-safe predicate. Testing it here would assert another domain's contract (`spec-files-assert-own-domain-only`).
- Broken-link reporting (`self` / `absent` / `cycle` reports) — `withTree()` owns reporting once per evaluation. `parentOf` here is the silent contributed `ParentLink`, so this helper reports nothing. Its only job on broken links is to stop the walk, which I, J and K cover.
- The precise cycle break point for longer or tail-attached cycles — that belongs to `resolveTreeLinks` and is already pinned in `engine/tree-links.spec.ts`. K only pins that this helper agrees with it.
- Duplicate row ids — out of scope (#156). `resolveTreeLinks` keeps the first declaration.
- Empty input and no-match input — no branch of their own. `[]` falls out of A's filter with nothing kept, so this would be a passthrough test that catches no logic bug.
- `includeDescendants` on a flat pool with no parent links — same code path as G with an empty subtree. It fails on no bug that A or G would miss.
- Wiring into the filter stage, the `contextRows` slot, and `isContextRow` stamping — step 4. They are covered through the `createTable()` seam (spec seam 1).

## Resolved
- 11 seams accepted in one step (pure helper, one file).
- H → not a context row (as asserted).
- K → the ancestor walk reuses `resolveTreeLinks(...).parentById` (as asserted).
