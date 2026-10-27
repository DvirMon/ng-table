# Step 2 test plan — Roles + roving tabindex

Step: [step-2-roles-roving-tabindex.plan.md](step-2-roles-roving-tabindex.plan.md)
Spec file: `libs/table/src/directives/ngp-table.directive.spec.ts` (new; step 3 adds its own describe block)

## Behaviour coverage

| Id   | Behaviour                                                                   | Source                                           | Tested by                  |
| ---- | --------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------- |
| AC1  | The host role is `grid` and cells are `gridcell`                            | issue #235 AC1; spec § Role and ARIA             | A                          |
| AC2a | On first entry, the only `tabindex="0"` is the first data cell              | issue #235 AC2; spec US2                         | B, C, D                    |
| AC2b | The only `tabindex="0"` is the last focused cell and follows `focus.moveTo` | issue #235 AC2; spec US3 (store half); Done when | E                          |
| US1  | The whole table is one Tab stop (exactly one `tabindex="0"`)                | spec US1                                         | B, E                       |
| US57 | A div host gets the same roles as a native table                            | spec US57; Testing Decisions S2 (div parity)     | A                          |
| DW1  | A cell outside `ngpTableRow` does not throw and gets no tabindex            | outline Do                                       | G                          |
| DW2  | Group-header cells get no tabindex in this slice                            | outline Do                                       | F                          |
| DW3  | `activeTarget` is null when there are no data rows or no render columns     | outline Do                                       | H                          |
| SR   | `treegrid` when `withTree()` is composed                                    | spec § Role and ARIA                             | Not tested (owned by #239) |

## Stubs (red phase)

- `NgpTableDirective.activeTarget: Signal<FocusTarget | null>`: a `computed(() => { throw new Error('not implemented: activeTarget'); })`.
  - Seam H reads it directly.
  - The other seams go red on assertions, because the role is still `table`/`cell` and no tabindex is bound yet.

## Seams — in red-green order

### A. Native and div hosts → host `role="grid"`, every body cell `role="gridcell"`

- Test: `it.each(['native table', 'div grid'])('sets role="grid" on the %s host and role="gridcell" on its cells')`
- Asserts:
  - the `[ngpTable]` element has `role === 'grid'`
  - every `[ngpTableCell]` element has `role === 'gridcell'`
  - no element has `role="table"` or `role="cell"`
- Covers: AC1, US57
- Risk: damage low, likelihood low
- Why this seam:
  - The role is the a11y contract the issue names. The spec's Testing Decisions ask for role assertions.
  - The div case catches one of the two dual-tag selectors keeping the old role.
  - It is one parametrised test, not one per tag.
- Order reason: independent

### B. Flat table, `focus()` null → exactly one `tabindex="0"`, on row 1 / column 1

- Test: `it('puts the only tabindex="0" on the first data row\'s first cell when nothing is focused yet')`
- Asserts:
  - `querySelectorAll('[tabindex="0"]')` has length 1
  - that element is the cell with `aria-colindex="1"`, inside the row with `aria-rowindex="1"`
  - every other body cell has `tabindex="-1"`
- Covers: AC2a, US1
- Risk: damage high, likelihood high
- Why this seam:
  - This is the K3 first-entry default, and the base path for every table.
  - It catches: no Tab stop at all (the grid cannot be reached), several `0`s (several Tab stops), or the default landing on the wrong cell.
  - The expected cell comes from DOM index attributes, not from re-running `renderRows()`, so the check is not tautological.
- Order reason: base case; builds `setup()` and the flat host that C, E and H reuse

### C. First declared column hidden → the cell index resolves through `renderColumns()`

- Test: `it('resolves a cell\'s column through renderColumns() when the first declared column is hidden')`
- Asserts:
  - Host columns: `col('region', { visible: false }), col('category'), col('amount')`.
  - The single `tabindex="0"` cell is the row-1 cell bound `[ngpTableCell]="0"`, which shows `category`.
- Covers: AC2a
- Risk: damage high, likelihood low
- Why this seam:
  - Catches the cell reading `columns()[index]`, or the default reading `columns()[0]`, instead of `renderColumns()`.
  - Either mismatch leaves zero `tabindex="0"`, so the grid drops out of the Tab order.
  - Reordered columns go through the same lookup, so this one test covers reorder too.
- Order reason: builds on B (same assertion, different column set)

### D. Grouped table (`withGrouping`, first render row is a group header) → the default skips the group row

- Test: `it('skips group header rows when choosing the first-entry cell')`
- Asserts:
  - exactly one `[tabindex="0"]`
  - its closest `[role="row"]` has `data-row-kind` other than `group`
  - it is the first such row in DOM order, at `aria-colindex="1"`
- Covers: AC2a
- Risk: damage high, likelihood high
- Why this seam:
  - The "first non-group row" filter is real logic.
  - A plain `renderRows()[0]` points the default at a group header. Its cells bind no tabindex (F), so a grouped table would have no Tab stop.
- Order reason: builds on B (same default, grouped host)

### E. `table.focus.moveTo({ area: 'body', rowId, columnId })` → the `0` moves there, the old cell drops to `-1`

- Test: `it('moves the single tabindex="0" to the cell named by focus.moveTo')`
- Asserts:
  - On the flat host, `moveTo` row 3 / `amount`, then `detectChanges()`.
  - That cell has `tabindex="0"`.
  - The B default cell now has `tabindex="-1"`.
  - `[tabindex="0"]` count is still 1.
- Covers: AC2b, US1
- Risk: damage high, likelihood high
- Why this seam:
  - Checks precedence: a non-null `focus()` beats the default.
  - Checks matching on rowId AND columnId. Matching on one id only gives several `0`s in a row or a column, which the count catches.
  - Checks reactivity: a binding that does not re-evaluate leaves the `0` on the old cell.
- Order reason: builds on B (needs the default cell as the "before" state)

### F. `moveTo` a group header row → its cells carry no `tabindex` attribute

- Test: `it('binds no tabindex on group header cells, even when focus() names the group row')`
- Asserts:
  - Grouped host: `moveTo({ area: 'body', rowId: <group row id>, columnId: 'category' })`, then `detectChanges()`.
  - Every cell under `[data-row-kind="group"]` has `hasAttribute('tabindex') === false`.
- Covers: DW2
- Risk: damage low, likelihood low
- Why this seam:
  - The `kind === 'group'` guard is the only thing stopping a group cell from matching a target that names its row.
  - Without the guard, the group cell gets `0` before #240 has defined group stops.
  - Testing only the default state cannot fail, because the default never names a group row.
- Order reason: builds on D (grouped host) and E (`moveTo` path)

### G. A cell inside a plain `<tr>` with no `ngpTableRow` → renders without throwing, no tabindex

- Test: `it('renders a cell outside ngpTableRow without throwing and without a tabindex')`
- Asserts:
  - `TestBed.createComponent(...)` + `detectChanges()` does not throw
  - the cell has `role="gridcell"`
  - the cell has `hasAttribute('tabindex') === false`
- Covers: DW1
- Risk: damage high, likelihood low
- Why this seam:
  - The guard is the optional injection.
  - A required inject throws a DI error, and that breaks every consumer template that uses a bare cell.
- Order reason: independent

### H. Empty data, or every column hidden → `activeTarget()` is null, no throw

- Test: `it.each(['no data rows', 'every column hidden'])('reports a null activeTarget when the table has %s')`
- Asserts: on the flat host with `data = []`, and on the flat host with every column `visible: false`, the directive instance (via `By.directive(NgpTableDirective)`) has `activeTarget() === null`.
- Covers: DW3
- Risk: damage low, likelihood low
- Why this seam:
  - With no rows or no columns, no cell renders, so the DOM cannot show this bug.
  - A `renderRows().find(...)!.id` style default throws, or returns `{ rowId: undefined }` / `{ columnId: undefined }`.
  - Step 3's focusin and key handlers will read `activeTarget`, and this guards them.
- Order reason: builds on B (the same computed, empty input)

## Types phase (after green)

None — no public type surface in this step. `activeTarget` is a plain `Signal<FocusTarget | null>` member.

## Not tested

- `role="treegrid"` under `withTree()`: owned by #239.
- Header cells (`ngpTableHeaderCell`) role and tabindex: unchanged in this slice; owned by #236.
- Group headers as arrow stops / full-width group cell focus: #240.
- Keyboard, `focusin`, DOM `.focus()`, the `focusElement` sync: step 3.
- `moveTo` rejecting unrendered ids: covered by `libs/table/src/api/create-table.spec.ts`, `describe('focus.focusRequests (#232)')`, `'does not increment focusRequests when moveTo rejects the target'` and the sibling `focus` specs.
- `tabindex` following focus recovery (row deleted, filtered, collapsed): engine recovery, out of this step's scope.
- `aria-colindex` / `aria-rowindex` / `aria-rowcount`: unchanged bindings, simple passthrough with no logic.
- Column reorder as its own test: same `renderColumns()` lookup as C. Both tests fail on the same bug, so they are one seam.
- A `focus()` holding a header or panel target, which leaves zero `tabindex="0"` among the body cells: no fallback by decision (K23); #236 and the panel slice define those targets.

## Fixtures

- Reuse `mockGroupingRows` / `mockGroupingTrackBy` from `libs/table/src/table.mock.ts`, with columns `region`, `category`, `amount`.
  - Flat host: no features.
  - Grouped host: `withGrouping({ initial: ['region'] })`. No `withTree`, so every row renders.
- Host and `setup()` pattern follows `libs/table/src/directives/ngp-table-tree-toggle.directive.spec.ts`.

## Resolved

- A header or panel `focus()` gets no fallback: `activeTarget` is `focus()` as is.
- Every column hidden gives `null` (H row added).
- `activeTarget` is typed as a plain `Signal<FocusTarget | null>`.
