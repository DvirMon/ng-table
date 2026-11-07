# Step 1 test plan — Treegrid role and row focus targets

Step: [step-1-treegrid-role-row-focus.plan.md](step-1-treegrid-role-row-focus.plan.md)
Spec file: `libs/table/src/directives/ngp-table.treegrid.spec.ts` (new; `ngp-table.directive.spec.ts` is already ~2000 lines, and the split follows `keyboard-nav.grid.spec.ts`)

## Behaviour coverage
| Id | Behaviour | Source | Tested by |
|---|---|---|---|
| AC1 | Host role is `treegrid` only when `withTree()` is composed. It never switches at runtime. | issue AC 1; spec §Role and ARIA | A, B |
| AC4b | Core row keeps `role`, `aria-rowindex` and `data-*` (the core half of AC 4; the tree-row ARIA half is step 3) | issue AC 4; K5c | Not tested |
| US2 | First Tab into a treegrid lands on the first data row itself (row focus) | spec US 2; K3 | C |
| US3 | Tab back into the grid returns to the last focused row | spec US 3; K3 | D |
| US13 | A whole row is a focus target in a treegrid | spec US 13; spec §Store contract (`columnId: null`) | D, E, H |
| US5 | Focus landing on a row or cell (click, Tab) moves the stored position there | spec US 5; arch §focusin | F, G |
| GRID | A grid row is not a focus target and writes no row target | decision: rows register only under `treegrid` | I |
| SWAP | Role follows the current store, including a swapped `ngpTable` input | decision: role read from the current store | J |
| KEY | A row and a column with id `'null'` stay distinct in the registry | decision: `row|` registry key | K |
| OOS | Group rows and panels stay out of row focus | outline Out of scope (#240/#241) | Not tested |

## Stubs (red phase)
- None. The tests drive existing public symbols only: `NgpTableDirective`, `NgpTableRowDirective`, `NgpTableCellDirective`, `createTable`, `withTree`, `withExpansion`. This step adds no new symbol for a test to import. The red phase fails on assertions.

## Seams — in red-green order
### A. `withTree()` composed, every row a leaf → host `role="treegrid"`
- Test: `it('sets role="treegrid" when withTree() is composed, even when no row has children')`
- Asserts: a host whose table is `createTable(signal(mockGroupingRows), …, withTree())` has `getAttribute('role') === 'treegrid'`. Its cells keep `role="gridcell"`.
- Covers: AC1
- Risk: damage low, likelihood high
- Why this seam: catches a role computed from the data (any row with `depth > 0` or `hasChildren`) instead of from the composed `tree` member. A leaf-only fixture fails such an implementation, and it also fails "tree composed AND has children". Real tree data would hide that bug. This is the base case for the new role branch.
- Order reason: independent; base case.

### B. `withExpansion()` without `withTree()` → host stays `role="grid"`
- Test: `it('keeps role="grid" when withExpansion() is composed without withTree()')`
- Asserts: a host whose table composes `withExpansion()` only has `role="grid"`.
- Covers: AC1
- Risk: damage low, likelihood low
- Why this seam: catches a role check on the wrong member, for example `expansion` or `isExpanded` on render rows. ADR-0012 split the panel feature from the tree feature, so "expandable" no longer means "tree".
- Order reason: builds on A (the same role branch, other side).

### C. Treegrid, nothing focused → the only `tabindex="0"` is on the first data row element
- Test: `it('puts the only tabindex="0" on the first data row itself in a treegrid when nothing is focused')`
- Asserts: on a treegrid host with `mockTaskTreeRows` and `withTree({ parentId })`:
  - `directive().activeTarget()` equals `{ area: 'body', rowId: 't1', columnId: null }`;
  - `[tabindex="0"]` matches exactly one element, the first `[role="row"]`;
  - every `[role="gridcell"]` has `tabindex="-1"`.
- Covers: US2, US13
- Risk: damage low, likelihood high
- Why this seam: catches the first-entry default still picking `renderColumns()[0]` in a treegrid. It also catches the row binding no tabindex, or cells keeping their `0`, which would give zero or two Tab stops.
- Order reason: builds on A (needs the treegrid branch).

### D. `focus.moveTo` a row target → that row becomes the Tab stop
- Test: `it('moves the single tabindex="0" to the row named by focus.moveTo with columnId null')`
- Asserts: after `moveTo({ area: 'body', rowId: 't2', columnId: null })` and `detectChanges()`:
  - exactly one `[tabindex="0"]`, the row whose cells read `t2`;
  - the first row has gone back to `tabindex="-1"`.
- Covers: US3, US13
- Risk: damage low, likelihood high
- Why this seam: catches a row tabindex that matches "first row" or ignores `rowId`. C alone passes such code because it only checks the default.
- Order reason: builds on C (the row tabindex binding exists).

### E. Treegrid, a cell target → the cell is the only Tab stop and its row is not
- Test: `it('keeps the row at tabindex="-1" while a cell in it is the active target')`
- Asserts: after `moveTo({ area: 'body', rowId: 't1', columnId: 'status' })`, exactly one `[tabindex="0"]`, the `status` cell of row `t1`. That row has `tabindex="-1"`.
- Covers: US13
- Risk: damage low, likelihood high
- Why this seam: catches a row `isActive` that compares `rowId` only. That gives two Tab stops, the row and its cell. It also catches the registry's `register(row)`, which runs `markDescendants` on the row: it would mark the row's own cells `-1` and strip the active cell's `0`.
- Order reason: builds on D (the row must compare `columnId === null` too).

### F. `focusin` on a row element → store writes the row target
- Test: `it('writes { area: body, rowId, columnId: null } when focus lands on a row')`
- Asserts: `rowElement.focus()` on row `t2`, then `host.table.focus()` equals `{ area: 'body', rowId: 't2', columnId: null }`.
- Covers: US5, US13
- Risk: damage high, likelihood high
- Why this seam: catches a row missing from the registry, or `followFocusIn` that drops a `null` column or does not tell a row from a cell. Any of these leaves the store on the old position. A consumer side panel that reads `focus()` would then show the wrong row.
- Order reason: builds on C (the row is registered and focusable via `tabindex`).

### G. `focusin` on a cell inside a registered row → store writes the cell, not the row
- Test: `it('writes the cell target, not the row, when focus lands on a cell inside a treegrid row')`
- Asserts: `cellElement.focus()` on the `status` cell of row `t1`, then `host.table.focus()` equals `{ area: 'body', rowId: 't1', columnId: 'status' }`.
- Covers: US5
- Risk: damage high, likelihood high
- Why this seam: `focusin` bubbles from cell to row to host. If the row has its own `(focusin)` listener, as the outline's wording allows, or the registry lookup returns the outer row, the row write wins and the store says "row" while DOM focus sits in a cell. This is a different bug from F. A row-only implementation passes F and fails here.
- Order reason: builds on F (the same `focusin` path).

### H. `focusElement: true` on a row target → DOM focus lands on the row
- Test: `it('focuses the row element on a focusElement request for a row target')`
- Asserts: focus starts on `#outside`. After `moveTo({ area: 'body', rowId: 't2', columnId: null }, { focusElement: true })` and a render flush, `document.activeElement` is row `t2`'s element.
- Covers: US13
- Risk: damage low, likelihood high
- Why this seam: today `toGridCell` returns `null` for `columnId: null`, so the sync effect drops every row target. Steps 2 (key map) and 4 (toggle click focuses the row) need this path.
- Order reason: builds on D (row target resolution).

### I. A grid row binds no tabindex and a click on row padding writes no `columnId: null` target
- Test: `it('binds no tabindex on a grid row and writes no row target when its padding is clicked')`
- Asserts: on a host with no `withTree()`, no `[role="row"]` in the body has a `tabindex` attribute. After a click on a row element, `host.table.focus()` is unchanged and holds no `columnId: null` target.
- Covers: AC1, US13
- Risk: damage low, likelihood high
- Why this seam: catches a row that registers and binds tabindex without checking the role. In a grid, a `columnId: null` target means a group-header cell, so a click on row padding would write a position the grid cannot show.
- Order reason: builds on A and B (the role branch decides whether rows register).

### J. Role follows the store: swapping the `ngpTable` input flips treegrid to grid
- Test: `it('switches role from treegrid to grid when the ngpTable input is swapped to a store without withTree()')`
- Asserts: start with a `withTree()` store: `role="treegrid"`. Swap the `ngpTable` input to a plain store: `role="grid"`, and rows no longer bind `tabindex`.
- Covers: AC1
- Risk: damage low, likelihood low
- Why this seam: catches a role read once at construction. The role is read from the current store, so a swapped input must change it.
- Order reason: builds on A and B (both sides of the role branch).

### K. A column whose id is `'null'` and a row target stay distinct in the registry
- Test: `it('keeps a row target and a column with id "null" apart in the registry')`
- Asserts: in a treegrid with a column whose id is `'null'`, `moveTo` the `'null'` cell resolves to that cell and not to its row. `moveTo` the row target resolves to the row and not to the cell.
- Covers: US13
- Risk: damage low, likelihood low
- Why this seam: catches a row registry key built from `columnId` stringified (`…|null`), which collides with the `'null'` column. The row key uses its own `row|` prefix, like `header|`.
- Order reason: builds on D and E (row and cell targets both resolve).

## Types phase (after green)
None — no public type surface in this step. (`FocusTarget` already allows `columnId: null`.)

## Not tested
- Core row keeps `role`, `aria-rowindex`, `data-row-kind` — covered by `ngp-table.directive.spec.ts` — 'puts the only tabindex="0" on the first data row\'s first cell when nothing is focused yet' (reads `aria-rowindex` through `[role="row"]`) and 'skips group header rows when choosing the first-entry cell' (`data-row-kind`). Adding tabindex is a new host binding with no branch over these.
- Grid (no tree) first-entry default still on the first cell — covered by `ngp-table.directive.spec.ts` — 'puts the only tabindex="0" on the first data row\'s first cell when nothing is focused yet'.
- `role="treegrid"` on the div host — the same host binding, no branch on the host tag. The grid parity is covered by 'sets role="grid" on the %s host and role="gridcell" on its cells'.
- Group rows and panels as row targets in a treegrid — out of scope (#240/#241).
- `focusin` on the already active row writes nothing — the no-op guard has no observable result without spying on internals. Damage low.
- Keys pressed while a row is focused (→/←/Enter, ↑ to header) — sibling steps 2 and 3.

## Decisions applied
- Rows register and bind `tabindex` only under `treegrid`. In a grid they register nothing and bind no tabindex (seam I).
- The role is read from the current store, so a swapped `ngpTable` input changes it (seam J).
- A row has its own registry key with a `row|` prefix, so a column id `'null'` cannot collide (seam K).
- Step 1 owns the DOM-focus sync for row targets (seam H).

---
Sources read: `libs/table/src/directives/ngp-table.directive.ts`, `ngp-table-row.directive.ts`, `ngp-table-cell.directive.ts`, `focus-registry.ts`, `keyboard-nav.types.ts`, `ngp-table.directive.spec.ts`, plus the spec, the architecture doc and decisions K3/K5/K5c/K27/K35/K39 under `libs/table/docs/3-ui/work/keyboard/active/treegrid-keyboard-model/`.
Fixtures: `mockTaskTreeRows` (tree), `mockGroupingRows` (leaf-only), both in `libs/table/src/table.mock.ts`. Imports: `withTree` from `../api/features/with-tree/feature`, `withExpansion` from `../api/features/with-expansion`.