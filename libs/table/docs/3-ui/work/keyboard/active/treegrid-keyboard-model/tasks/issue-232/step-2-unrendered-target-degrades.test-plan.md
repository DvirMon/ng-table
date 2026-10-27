# Step 2 test plan — Unrendered target degrades

Step: [step-2-unrendered-target-degrades.plan.md](step-2-unrendered-target-degrades.plan.md)
Spec file: `libs/table/src/api/create-table.spec.ts` — new `describe('focus.moveTo — unrendered target (#232)')` next to step 1's `focus` block.

## Stubs (red phase)

- None. Tests reach the helper only through `createTable(...).focus.moveTo`. Red fails on assertions: step 1's `moveTo` writes any target and reports nothing.

Fixtures:

- `makeStore(makeRenderColumns(), rows)`: `status` declared `visible: false` — in `columns()`, not in `renderColumns()`. Rendered columns: `name`, `id`.
- Rows `r1`, `r2`: reuse the file's existing rows if they fit; otherwise add to `table.mock.ts`, never inline.
- `withDroppedRow(id)`: a local `createTableFeature` that claims `s.tree` and filters `id` out of the render output. The row stays in `data`, `indexById` and `rows()`, but not in `renderRows()`.
- Spy: `vi.spyOn(console, 'error').mockImplementation(() => {})`, restored in `finally` — the `withConsoleErrorSpy` pattern from `engine/compose-table.spec.ts:223`, copied, not imported across specs.
- Each test first moves to `{ area: 'body', rowId: 'r1', columnId: 'name' }`, then makes the bad write. "Unchanged" means "still r1/name".

## Seams — in red-green order

### A. Unrendered target → no move, one report naming the id (it.each)

- Test: `it.each(...)('ignores %s and reports it once')` over four cases:
  - body, unknown row: `{ area: 'body', rowId: 'missing', columnId: 'name' }` → id `"missing"`
  - body, hidden column: `{ area: 'body', rowId: 'r2', columnId: 'status' }` → id `"status"`
  - header, hidden column: `{ area: 'header', columnId: 'status' }` → id `"status"`
  - panel, unknown row: `{ area: 'panel', rowId: 'missing' }` → id `"missing"`
- Asserts: no throw; `focus()` still r1/name; spy called exactly once; first argument contains the quoted id.
- Why this seam: one guard, four branches. Catches a missing guard, a throwing guard, a report that doesn't name the id, a check against `columns()` instead of `renderColumns()` (status exists in `columns()`), a guard that checks only rows (header case), and one that checks rows only for body (panel case).
- Order reason: independent. Builds the guard and report path the rest go through.

### B. A row in the data but dropped from render → no move

- Test: `it('treats a row present in data but absent from renderRows as unrendered')`
- Asserts: store composed with `withDroppedRow('r2')`; `moveTo({ area: 'body', rowId: 'r2', columnId: 'name' })`; `focus()` unchanged; spy 1 call containing `'"r2"'`.
- Why this seam: catches membership checked in `indexById` or `rows()` instead of `renderRows()`. Seam A's `missing` is absent everywhere, so it can't catch this. Covers "a collapsed tree child counts as unrendered".
- Order reason: builds on A.

### C. Targets with no column id still move

- Test: `it.each(...)('moves to a rendered %s target that carries no column id')` with `{ area: 'body', rowId: 'r2', columnId: null }` and `{ area: 'panel', rowId: 'r2' }`.
- Asserts: `focus()` equals the target; spy 0 calls.
- Why this seam: catches a column check run without a column id, which would reject every row-focus and panel write.
- Order reason: builds on A.

### D. Two bad calls → two reports

- Test: `it('reports each rejected write, not only the first')`
- Asserts: two `moveTo` calls with `rowId: 'missing'`; spy 2 calls.
- Why this seam: catches a lifetime dedupe copied from `engine/grouping/render.ts`. Each write is its own runtime event.
- Order reason: builds on A.

### E. Still degrades and reports with ngDevMode off

- Test: `it('reports an unrendered target even when ngDevMode is false')`
- Asserts: inside the `getNgDevMode`/`setNgDevMode(false)` try/finally pattern (`compose-table.spec.ts:341`), the unknown-row write leaves `focus()` unchanged and the spy has 1 call.
- Why this seam: catches a guard or report wrapped in `ngDevMode`. Ids arrive at runtime, so the check stays ungated.
- Order reason: builds on A.

## Types phase (after green)

None — no public type surface in this step.

## Not tested

- `engine/focus.ts` own spec: internal helper; every branch is reached through `moveTo`.
- Real `withTree()` collapse: seam B covers the same check; withTree's own spec owns what it renders.
- Column hidden at runtime: same `renderColumns()` lookup as seam A's hidden-column cases.
- Row and column both unrendered → one report: message-format edge, dropped in review.
- Exact report wording: tests match the bad id only.
- Recovery after rows/columns change: #233.
