# Step 2 test plan — Runtime row-id checks in `runRenderStages`

Step: [step-2-runtime-row-id-checks.plan.md](step-2-runtime-row-id-checks.plan.md)
Spec file: `libs/table/src/engine/compose-table.spec.ts`
(new `describe('runtime row-id checks (#156)')` block, placed
after `describe('declared stages (#155)')`)

## Stubs (red phase)

- None. The step creates no new exported symbol.
  `runRenderStages` already exists, and the tests reach it only
  through `composeTable`. Red fails on assertions:
  `console.error` is never called today.

Fixtures to add next to the existing render fixtures
(`groupWrappingStage`, `renderTaggingStage`):

- `duplicatingStage()` claims `s.tree`.
  `run: (nodes) => [...nodes, ...nodes]`.
- `inventingStage()` claims `s.tree` and appends one real row
  (`id: 'x'`, `data` a full `Row`, `children: []`).
- `wrapAndInventStage()` claims `s.group` and returns
  `[{ id: 'group-1', kind: 'group', data: null,
children: [...nodes, invented] }]`.
- Keep `invented` in one module-level const.

Spy pattern, from `engine/cells.spec.ts`:
`vi.spyOn(console, 'error').mockImplementation(() => {})`,
restored in `finally`. Read `store['renderRows']()` to trigger
one evaluation. Existing helpers: `makeRows` (:52, rows r1/r2),
`composeWithRows` (:63), `renderTaggingStage` (:141),
`groupWrappingStage` (:158).

## Seams — in red-green order

### A. A stage emits duplicate ids → one report, output passed through

- Test: `it('reports a stage emitting duplicate ids once and still renders its output')`
- Asserts: `composeWithRows(makeRows(), [duplicatingStage()])`
  does not throw. The spy has exactly 1 call. The first argument
  is a string containing `'[createTable]'`, `'"tree"'` and
  `'feature 1'`. The ids in `renderRows` equal
  `['r1', 'r2', 'r1', 'r2']`.
- Why this seam: base case. Catches a missing uniqueness check.
  Two ids are duplicated but one report is expected, so it also
  catches a report per id or per row instead of once per stage.
  The id list catches a check that de-duplicates or drops the
  output instead of passing it through. The label check catches
  a report that names only the stage, not the feature.
- Order reason: independent. Builds the report path every later
  seam asserts through.

### B. A stage invents a real row → one report, row still renders

- Test: `it('reports a stage inventing a real row id once and still renders it')`
- Asserts: `composeWithRows(makeRows(), [inventingStage()])`.
  The spy has exactly 1 call. The message contains
  `'[createTable]'`, `'"tree"'` and `'feature 1'`. The ids in
  `renderRows` equal `['r1', 'r2', 'x']`.
- Why this seam: catches a missing containment check (output
  real ids ⊆ input ids), and a check that throws or removes the
  invented row instead of passing it through.
- Order reason: independent of A's check; after A because it
  reuses A's report path.

### C. An invented id nested under a header is found, and only its stage is blamed

- Test: `it('finds an invented id nested under a made-up row and reports only the stage that added it')`
- Asserts: compose with `[wrapAndInventStage(),
renderTaggingStage('tree', 'tree>')]`. The spy has exactly 1
  call. The message contains `'"group"'` and does not contain
  `'"tree"'`. The ids in `renderRows` equal
  `['group-1', 'r1', 'r2', 'x']`.
- Why this seam: three bugs, one mistake (the id set is not a
  recursive walk of the previous stage's output):
  - checking only the top level gives 0 reports (`x` sits in
    `children`);
  - comparing every stage against the seed rows also blames
    `'tree'` → 2 reports;
  - building the next input set from the top level only (just
    `group-1`) also blames `'tree'` → 2 reports.
- Order reason: builds on B (same check, nested, across two
  stages).

### D. Made-up header rows are exempt; a later inventor is still reported

- Test: `it('does not report a made-up data:null row, only a later stage that invents a real row')`
- Asserts: compose with `[groupWrappingStage('group-1'),
inventingStage()]`. The spy has exactly 1 call. The message
  contains `'"tree"'` and does not contain `'"group"'`. The
  `renderRows` ids include `'x'`.
- Why this seam: pins the `data === null` exemption (ruling
  2026-09-30) at engine level. A check that treats the
  `group-1` header as an invented real row blames `"group"` →
  2 reports. The inventor makes the test fail in red; a bare
  "no report" test would pass against today's code.
- Order reason: builds on B (same check, plus the exemption).

### E. Reports still fire with ngDevMode off

- Test: `it('reports duplicate ids even when ngDevMode is false')`
- Asserts: inside the `getNgDevMode`/`setNgDevMode(false)`
  try/finally pattern (as in
  `'lets the later render claim win without throwing when ngDevMode is false'`),
  compose with `[duplicatingStage()]`. The spy has exactly 1
  call. The message contains `'[createTable]'`.
- Why this seam: catches a report wrapped in an `ngDevMode`
  check, copied from the construction checks in
  `stage-order.ts`. ADR-0014: runtime reports reach production.
- Order reason: builds on A (same fixture, gate off).

## Types phase (written in red, proven by green's typecheck)

None — no public type surface in this step.

## Not tested

- Walking each output only once and reusing the set as the next
  input: a performance choice with no visible behaviour. Seam C
  pins the correctness it must keep.
- Reporting again on a second evaluation: `composeWithRows` does
  not expose its `data` signal. Kept out to stay within 5 seams.
- `withGrouping`'s real header rows: already pinned by
  `api/features/with-grouping/feature.spec.ts:1273` (no
  `console.error` on `renderRows()`); once this step lands that
  test proves grouping triggers no report. Seam D covers the
  exemption at engine level.
- `synthesizesRows` being ignored at runtime: construction-only
  flag; C and D cover the `data === null` exemption.
- A stage that drops rows causes no report: subset output is
  allowed; D fails if the check is written the wrong way round.
- Pipeline stages: out of scope.
- Exact report wording: tests match fragments only.
- A dedicated `render-stages.spec.ts` case: spec says runtime
  checks are covered through `composeTable` only.

Trimmed: the planner's seam "withGrouping + inventor" was dropped
— it imported `api/features/with-grouping` into an engine spec and
its no-grouping-report half is already pinned at
with-grouping/feature.spec.ts:1273. Replaced by seam D above.
