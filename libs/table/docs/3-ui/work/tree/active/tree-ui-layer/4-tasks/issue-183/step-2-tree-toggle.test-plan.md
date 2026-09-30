# Step 2 test plan — tree toggle

Step: [step-2-tree-toggle.plan.md](step-2-tree-toggle.plan.md)
Spec file: `libs/table/src/directives/ngp-table-tree-toggle.directive.spec.ts`

## Stubs (red phase)
- `@Directive({ selector: 'button[ngpTableTreeToggle]' }) export class NgpTableTreeToggleDirective { constructor() { throw new Error('not implemented: NgpTableTreeToggleDirective'); } }`
  in `libs/table/src/directives/ngp-table-tree-toggle.directive.ts`.
  The class has no inputs, so this is the full public signature.
  The selector is set in the stub so the host template compiles
  against the real one.
- `libs/table/src/index.ts`: `export * from './directives/ngp-table-tree-toggle.directive';`,
  placed beside the tree-row export. The spec imports the
  directive file directly, so this export only needs to
  typecheck.

## Fixture and host (shared by all seams)
- No new mock data is needed. Reuse `table.mock.ts`:
  - `mockTaskTreeRows` (`t1` > `t1a` > `t1a1`, leaf `t2`) with
    `trackBy: 'id'`.
  - `mockGroupingRows` with `mockGroupingTrackBy`.
- Columns go through `createColumns(noData<T>(), (col) => [...])`,
  written locally in the spec, following the sibling specs.
- Two host components, one per table, sharing one template
  constant. Keep the constant a plain identifier in
  `template:`, as in `ngp-table-row-animation.bench.spec.ts`,
  to avoid the angular-eslint ICU issue:
  - `TreeHost`:
    `createTable(signal(mockTaskTreeRows), { trackBy: 'id', columns }, withTree({ parentId: (r) => r.parentId }))`
  - `GroupedHost`:
    `createTable(signal(mockGroupingRows), { trackBy: mockGroupingTrackBy, columns }, withGrouping({ initial: ['region'] }), withTree())`
    — collapse-only `withTree()`, same composition as
    `with-grouping/feature.spec.ts` "rowsOf() on a collapsed
    group".
- Template:
  `<table [ngpTable]="table"><tbody>@for (row of table.renderRows(); track row.id) { <tr [ngpTableRow]="row" (click)="rowClicks.push($event)"> <td><button ngpTableTreeToggle [attr.aria-label]="'Toggle ' + row.id"></button></td> <td>{{ row.id }}</td> </tr> }</tbody></table>`
- The `aria-label` keeps every button named, so step 3's
  nameless-button warning never fires here. It also gives each
  toggle a label to query by:
  `querySelector('button[aria-label="Toggle t1"]')`.
- Visible rows: the trimmed ids read from
  `querySelectorAll('[role="row"]')`.
- `setup(HostType)` returns `{ fixture, toggle(id), visibleRowIds(), rowClicks }`.
- Clicks use native `button.click()` and then
  `fixture.detectChanges()` (user ruling).

## Seams — in red-green order
### A. Click on a collapsed parent → its child renders and the toggle reads expanded
- Test: `it('opens a collapsed parent on click: the child row renders and aria-expanded becomes "true"')`
- Asserts: before the click, `visibleRowIds()` equals
  `['t1', 't2']`. After `toggle('t1').click()`, it equals
  `['t1', 't1a', 't2']`. The `t1` button then has
  `aria-expanded="true"`, and `data-expanded` is present with
  value `""`.
- Why this seam: the base wiring, a click reaching
  `table.tree.toggle(row.id)`. It catches: the store or row
  injected from the wrong place; the wrong id passed; the click
  handler missing; the state bindings not following
  `isExpanded`.
- Order reason: independent. The base case.

### B. Second click on an open parent → the child is removed and the toggle reads collapsed
- Test: `it('closes an open parent on a second click: the child row is removed, aria-expanded is "false" and data-expanded is gone')`
- Asserts: after two clicks on `t1`, `visibleRowIds()` equals
  `['t1', 't2']`. `aria-expanded` is `"false"`, not absent.
  `hasAttribute('data-expanded')` is `false`.
- Why this seam: catches `expand()` instead of `toggle()`;
  catches `aria-expanded` bound presence-only (drops `"false"`);
  catches `data-expanded` rendered as `"false"` instead of
  removed.
- Order reason: builds on A.

### C. Leaf row → the toggle is inert and hidden, with no expanded state
- Test: `it('disables and hides the toggle on a row without children, with no aria-expanded')`
- Asserts: the `t2` button has `disabled === true`;
  `aria-hidden="true"`; `data-disabled` present with value `""`;
  `hasAttribute('aria-expanded') === false`;
  `hasAttribute('data-expanded') === false`. Contrast: the `t1`
  button has no `disabled`, no `aria-hidden`, no
  `data-disabled`.
- Why this seam: the D6 branch. Catches an inverted or missing
  branch; `aria-expanded="false"` leaking onto a leaf;
  `data-disabled` written as a string. The `t1` contrast
  catches a toggle disabled on every row.
- Order reason: independent of A and B; ordered after them so
  green builds the expandable path first.

### D. Group header click (withGrouping + withTree) → its members render, and a second click collapses them
- Test: `it('opens and collapses a group header under withGrouping() + withTree()')`
- Asserts: before any click, `visibleRowIds()` has the two
  headers and no leaf ids. After clicking
  `Toggle group:>region:string:US`, rows `1`, `2`, `3` are
  visible and the header button has `aria-expanded="true"`.
  After a second click, rows `1`–`3` are gone and
  `aria-expanded="false"`. The header id is the literal from
  `with-grouping/feature.spec.ts` (`US_HEADER_ID`).
- Why this seam (D11): a group row has `kind: 'group'` and
  `data: null`. A directive deriving the id from `row.data` or
  `trackBy`, or treating non-`'row'` kinds as non-expandable,
  breaks here. A–C cannot catch either bug. Kept although the
  engine path is pinned at `with-tree/feature.spec.ts:698`:
  the issue's acceptance criteria require it in this spec.
- Order reason: builds on A and B.

### E. Toggle click → the event bubbles to the row, default not prevented
- Test: `it('lets the click bubble to the row without preventing default')`
- Asserts: after `toggle('t1').click()`, the host's `rowClicks`
  has length 1 and `rowClicks[0].defaultPrevented === false`.
- Why this seam (D12): catches `stopPropagation()` or
  `preventDefault()` in the host listener.
- Order reason: builds on A.

## Not tested
- Clicking the disabled leaf toggle: a native `disabled` button
  dispatches no click — the browser, not our logic.
- Keyboard activation (Enter/Space): native `<button>`
  activation (D4); no key handlers.
- A row changing from leaf to expandable and back: framework
  reactivity; B and C cover each branch.
- The `button[...]` selector limit (D4): static metadata.
- The barrel export: static; the spec-config typecheck covers it.
- Dev-mode throw and nameless-button warning: step 3.
- The styling recipe and `visibility: hidden` on
  `[data-disabled]`: consumer CSS.
- Production stripping of dev checks.

Trimmed: none. Overlap note — child-row appear/disappear in A/B
restates `with-tree/feature.spec.ts:389,402`; kept as the
acceptance criteria's observable, the seam is the attribute flip.
