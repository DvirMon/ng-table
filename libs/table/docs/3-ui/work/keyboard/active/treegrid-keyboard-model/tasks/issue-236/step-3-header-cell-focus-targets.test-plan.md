# Step 3 test plan — Header cells as focus targets

Step: [step-3-header-cell-focus-targets.plan.md](step-3-header-cell-focus-targets.plan.md)
Spec file: `libs/table/src/directives/ngp-table.directive.spec.ts` (new `describe('NgpTableDirective header cells', …)` block, new host components); `libs/table/src/directives/focus-registry.spec.ts` (new file, seam A only)

## Behaviour coverage

| Id    | Behaviour                                                                                     | Source                          | Tested by |
| ----- | --------------------------------------------------------------------------------------------- | ------------------------------- | --------- |
| S2/K3 | First Tab entry still lands on the first data row; the header row gets no first-entry default | spec story 2, K3                | B         |
| S5    | Clicking (focusing) a header cell moves the keyboard position there                           | spec story 5, applied to header | E         |
| S35   | Focus on a widget inside a header cell (sort button) counts as that header cell               | spec story 35 (focus half only) | E         |
| DW1   | The registry takes header cells next to body cells; their keys stay distinct                  | step file Do                    | A         |
| DW2   | Header cell binds roving tabindex: 0 when `activeTarget()` is its header target, else -1      | step file Do                    | B, C, D   |
| DW3   | Header cell resolves its column via `renderColumns()[index].id`                               | step file Do                    | D         |
| DW4   | `followFocusIn` writes `{area:'header', columnId}` for focus inside a registered header cell  | step file Do                    | E         |

## Stubs (red phase)

- `HeaderCell` is the type from step 1 (`keyboard-nav.types.ts`); until step 1 lands, declare `type HeaderCell = { readonly area: 'header'; readonly columnId: string }` there.
- `FocusRegistry` widened in `focus-registry.ts`: `register(cell: BodyCell | HeaderCell, element)`, `elementOf(cell: BodyCell | HeaderCell)`, `cellContaining(node, boundary): BodyCell | HeaderCell | null`.
- `createFocusRegistry()` bodies: a header argument hits `throw new Error('not implemented: header registration')`; body-cell paths stay unchanged so existing specs keep passing.
- Directive changes (header-cell injects, `[attr.tabindex]` binding, `followFocusIn` header branch) are not stubbed: their seams fail on assertions against today's code.

## Seams — in red-green order

### A. Header `name` and body cell `(1, 'name')` registered → `elementOf` returns each one's own element

- Test: `it('keeps a header cell and a body cell of the same column apart')`
- Asserts: after `register({rowId: 1, columnId: 'name'}, bodyEl)` and `register({area: 'header', columnId: 'name'}, headerEl)`, `elementOf` returns `bodyEl` for the body cell and `headerEl` for the header cell. `cellContaining(childOfHeaderEl, boundary)` returns `{area: 'header', columnId: 'name'}`, and `cellContaining(bodyEl, boundary)` returns the body cell.
- Covers: DW1
- Risk: damage high, likelihood high
- Why this seam: every header shares a column id with a whole column of body cells. A key that drops the type tag, or a header key built from `rowId: undefined`, makes one entry overwrite the other, and focus goes to the wrong element.
- Order reason: independent. The directive seams depend on it.

### B. Body cell `(1, 'name')` active → the `name` header cell is `tabindex="-1"`, and the only stop is the body cell

- Test: `it('keeps header cells out of the tab order while a body cell of the same column is active')`
- Asserts: on a host with a `<thead>` row of `[ngpTableHeaderCell]="i"` cells, after `focus.moveTo({area:'body', rowId:1, columnId:'name'})`, every header cell has `tabindex="-1"` and `tabStops()` equals `[cell(1,'name')]`. A second assertion with nothing focused: `tabStops()` is still only the first data row's first cell, and header cells are `-1` (K3).
- Covers: S2/K3, DW2
- Risk: damage high, likelihood high
- Why this seam: a tabindex computed that compares `columnId` only, without `area === 'header'`, gives two Tab stops (header + body). The first Tab could also land on the header, which breaks K3.
- Order reason: base case. Introduces the header host and the tabindex binding.

### C. `focus.moveTo({area:'header', columnId:'name'})` → that header cell is the single `tabindex="0"` in the grid

- Test: `it('moves the single tabindex="0" to the header cell named by focus.moveTo')`
- Asserts: `tabStops()` equals `[headerCell('name')]`. The other header cells and all body cells are `-1`.
- Covers: DW2
- Risk: damage high, likelihood high
- Why this seam: catches a binding that never yields 0 for a header target, and a body cell that still claims the stop when the target is a header.
- Order reason: builds on B (same host, same binding, positive branch).

### D. First declared column hidden → header cell at index 0 resolves to `renderColumns()[0]`

- Test: `it("resolves a header cell's column through renderColumns() when the first declared column is hidden")`
- Asserts: on a header host with `region` hidden, after `focus.moveTo({area:'header', columnId:'category'})`, the stop is the header cell with `aria-colindex="1"`.
- Covers: DW3
- Risk: damage high, likelihood low
- Why this seam: reading `columns()` instead of `renderColumns()` shifts every header cell by one column when any column is hidden; register and tabindex then name the wrong column.
- Order reason: builds on C (same positive branch, different column source).

### E. Body cell `(1,'name')` focused, then focus moves into the `name` header (the cell itself / a button inside it) → store holds `{area:'header', columnId:'name'}`

- Test: `it.each([['the header cell itself', false], ['a button inside the header cell', true]])('writes the focused header cell to the store on focusin (%s)')`
- Asserts: `host.table.focus()` equals `{area:'header', columnId:'name'}`. `tabStops()` equals `[headerCell('name')]`. `document.activeElement` is still the focused target (no focus pulled off the in-cell button).
- Covers: S5, S35, DW4
- Risk: damage high, likelihood high
- Why this seam: catches three bugs at once: header cells never registered so `cellContaining` finds nothing; `followFocusIn` still builds a body target from the result; the "already active" check ignores `area`, so starting from body `(1,'name')` wrongly skips the write.
- Order reason: builds on A (registry returns header cells) and C (tabindex reflects a header target).

## Types phase (after green)

None — no public type surface. `FocusRegistry` and `HeaderCell` are internal (not exported from `src/index.ts`); `FocusTarget` is unchanged.

## Not tested

- Focusin on the already-active header cell writes nothing: the write would be idempotent, low damage. Seam E covers the harmful direction (a wrongly skipped write).
- Registry `cellContaining` walking up from a nested node, as its own directive-level test: the button variant of E fails on the same bug.
- Header cell unregisters on destroy / column hide: no code in this step reads `elementOf` for a header; `unregister` is element-keyed and shared with body cells. Step 4 moves DOM focus to header cells.
- `activeTarget` passing a header `focus()` through unchanged: K23, unchanged code; covered by the existing 'moves the single tabindex="0" to the cell named by focus.moveTo' path plus seam C.
- `role="columnheader"` / `aria-colindex` on header cells: existing behaviour, unchanged.
- Div-grid header parity: the binding is the same on both host tags (#238).
- DOM `.focus()` on a header target: step 4.
- A header cell rendered outside `ngpTable`: the store inject is required (K41); nothing renders one that way.
