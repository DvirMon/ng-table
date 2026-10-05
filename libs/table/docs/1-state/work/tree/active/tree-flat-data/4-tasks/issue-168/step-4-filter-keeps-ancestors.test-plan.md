# Step 4 test plan — Filter keeps ancestors

Step: [step-4-filter-keeps-ancestors.plan.md](step-4-filter-keeps-ancestors.plan.md)
Spec file: `libs/table/src/api/features/with-filtering/feature.spec.ts` (new `describe('tree retention (#168)')` block)

Placement: these tests go in the filtering spec, not `with-tree.spec.ts`. To break any of them you would have to change `with-filtering/feature.ts`. `withTree()` only supplies `ctx.parentOf` (spec-files-assert-own-domain-only).

Fixture: `makeFlatRows()` / `FlatRow` from `table.mock.ts`. Input order is `[g1, r1, c1, r2, c2]`, with the tree r1 → c1 → g1, r1 → c2, and r2 as a leaf.

Local helpers:

- A local `makeFlatColumns()` without a return annotation: `createColumns(noData<FlatRow>(), (col) => [col('name')])`. With no annotation, `path.name` keeps its literal id, as in the file's own `makeColumns()`.
- A `setup({ includeDescendants?, manual? })` that builds `createTable(signal(makeFlatRows()), { trackBy: 'id', columns }, withTree({ parentId: (row) => row.parentId }), withFiltering({ schema: (path) => ({ name: contains(path.name) }), includeDescendants, manual }))` inside `inContext`.

Needles, each matching exactly one row:

- `'Grand'` matches g1.
- `'Parent'` matches r1.

## Stubs (red phase)

- No function stubs. The step creates no new function that the tests import. `retainTreeMatches` comes from step 3, and `RenderRow.isContextRow` and the `contextRows` slot come from step 1.
- Type-only addition, needed so seam C compiles: `includeDescendants?: boolean` on `WithFilteringConfig<TRow, TValues, S>` in `api/features/with-filtering/feature.ts`. It is a field with no runtime behaviour.

## Seams — in red-green order

### A. Filter matches a grandchild → `rows()` keeps it plus its ancestors, in input order

- Test: `it('keeps a matched row's ancestors, in input order')`
- Asserts: after `store.filters.name().value.set('Grand')`, `store.rows().map(r => r.id)` equals `['g1', 'r1', 'c1']`.
- Why this seam: it catches two bugs:
  - the stage still calling `rows.filter(matcher)` when `ctx.parentOf` is set, which would give `['g1']`;
  - the stage never reading `ctx.parentOf` at all.
    This seam covers the acceptance criterion "in input order"; ordering logic itself is step 3's seam C.
- Order reason: independent. It is the base case.

### B. Same filter → ancestors are flagged `isContextRow`, the match is not

- Test: `it('flags retained ancestors as context rows and leaves the match unflagged')`
- Asserts: after `store.tree.expand(['r1', 'c1'])` and setting `'Grand'`, `store.renderRows().filter(r => r.isContextRow).map(r => r.id)` equals `['r1', 'c1']`.
  - This filters on truthiness, so the test does not depend on whether step 1 stamps non-context rows `false` or `undefined`.
  - `expand(ids)` opens exactly the given ids and does not scan the view, so this test does not depend on reveal or filtered-view `expand()`.
- Why this seam: it catches three bugs:
  - `contextRows` not contributed;
  - the closure box never written;
  - the box holding the kept ids instead of kept minus matches, which would also flag g1.
- Order reason: builds on A. It needs the retention branch to run so the box has something to hold.

### C. `includeDescendants: true`, filter matches a parent → its whole branch is kept

- Test: `it('includeDescendants keeps a matched parent's whole branch')`
- Asserts: `setup({ includeDescendants: true })`, then set `'Parent'`. `store.rows().map(r => r.id)` equals `['g1', 'r1', 'c1', 'c2']`, and r2 is dropped.
- Why this seam: it catches `config.includeDescendants` not being passed to `retainTreeMatches`, which would give `['r1']`.
- Order reason: builds on A, the same retention branch with one more config input.

### E. Clearing the filter → no row stays flagged

- Test: `it('drops every context flag once the filter is cleared')`
- Asserts, in sequence:
  1. `expand(['r1', 'c1'])`, then set `'Grand'`.
  2. Precondition: the flagged ids equal `['r1', 'c1']`.
  3. `store.filters().reset(null)`.
  4. The flagged ids now equal `[]`, and `store.rows()` has length 5.
- Why this seam: it catches a stale closure box. When the filter becomes inactive, the stage takes its early-return path. If that path does not reset `box.ids` to empty, or if `contextRows` does not recompute when the pipeline does, ancestors stay flagged after the search is cleared.
- Order reason: builds on B. It needs the box populated first.

### F. `manual: true` with a tree → no retention, no context rows

- Test: `it('runs no tree retention and flags nothing under manual filtering')`
- Asserts: `setup({ manual: true })`, set `'Grand'`; `store.rows()` has length 5 and no row is flagged `isContextRow`.
- Why this seam: catches a green that moves the `ctx.parentOf` branch above the `manual` guard, which would run retention on server-filtered data.
- Order reason: builds on B (needs the flag read to mean something).

## Types phase (written in red, proven by green's typecheck)

None — no public type surface in this step. `includeDescendants?: boolean` is a plain optional field with no generic or inferred type. Adding `'trackBy'` to the `FilteringInput` Pick changes a constraint, not an inferred result type. The existing `types` block in `feature.spec.ts` (`toEqualTypeOf<RowStore>`) already pins that `withFiltering()` still resolves to the same store.

## Not tested

- **No schema with a tree.** The stage is a no-op and there is no matcher. Nothing is decided in this step's logic.
- **`withTree()` without `parentId`, or no `withTree()`, so `ctx.parentOf` is undefined.** The engine decides whether `parentOf` exists (step 1, ADR-0028). The rest of this file's suite already runs without a tree and would fail if the non-tree path changed.
- **Cycles, broken links, orphans, and which ids go into `contextIds` under `includeDescendants`.** These are `retainTreeMatches` edge cases owned by step 3.
- **`isContextRow` is `undefined` when no feature contributes context rows.** This is step 1's central stamping.
- **`matcher()` is called once per evaluation on the tree path.** The existing once-per-evaluation test pins the call site.
- **Reveal, `revealContextRow`, and closed-while-revealed.** A later issue owns these.
- **`hasChildren`, `totalRowCount`, `selectAllIds()`.** Step 6's separate test step.
- **The `data-context-row` attribute.** The directive spec (step 5).
- **Sort carrying through retention.** A pins input order, and ordering inside the helper belongs to step 3.

## Resolved

- Seam F (manual + tree) added.
- Seam D dropped: the default is covered by step 3 seam A.
