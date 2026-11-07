# Step 4 test plan — Pointer-only toggle

Step: [step-4-pointer-only-toggle.plan.md](step-4-pointer-only-toggle.plan.md)
Spec file: `libs/table/src/directives/ngp-table-tree-toggle.directive.spec.ts`

## Behaviour coverage
| Id | Behaviour | Source | Tested by |
|---|---|---|---|
| US22 | Toggle button hidden from screen readers; expanded state not announced twice | spec § User Stories 22, K5 | A, B |
| US23 | Clicking the toggle still expands the row and moves keyboard focus to that row | spec § User Stories 23, K5 | C (toggle half: existing specs, see Not tested) |
| AC5 | Toggle has `tabindex="-1"`, `aria-hidden="true"`, no `aria-expanded`; click toggles and focuses the row | issue AC | A, B, C |
| AC7 | Collapsible trigger's `aria-expanded` binding split so the panel toggle keeps it | issue AC | A (tree side); panel side: Not tested (covered) |
| DW1 | Leaf toggle stays disabled; `data-expanded` stays on the tree toggle | Done when / outline | A (`data-expanded`), B (leaf disabled) |
| K35 | A cell holding tree toggle + checkbox still counts as a single widget | decisions K35 | Not tested (covered) |

## Stubs (red phase)
None. The step creates no new symbol that a test imports. The tests
use the existing `NgpTableTreeToggleDirective` and fail on their
assertions against current code: it binds `aria-expanded`,
binds `aria-hidden` only on leaves, binds no `tabindex`, and does
not move focus on click.

## Seams — in red-green order
### A. Tree toggle state goes to `data-expanded`, never `aria-expanded`
- Test: `it('binds no aria-expanded on the tree toggle, collapsed, open or leaf, while data-expanded follows the row')`
- Asserts: on `TreeHost`, `toggle('t1')` and `toggle('t2')` (leaf)
  have no `aria-expanded` attribute. After `clickToggle('t1')`,
  `toggle('t1')` still has no `aria-expanded`, and
  `data-expanded` is `''`.
- Covers: AC5, AC7, US22, DW1
- Risk: damage high, likelihood high
- Why this seam: the step moves `aria-expanded` out of
  `NgpTableCollapsibleTrigger`. Two bugs are possible. The binding
  can stay in the base, so the button and the row (step 3) both
  announce the state, which breaks K5's single owner. Or
  `data-expanded` can move out with it and drop silently, which
  breaks consumer CSS hooks. The open state is checked after the
  click because an `"false"` that never changes looks like a
  missing binding.
- Order reason: independent. It is the structural split, so it
  goes first.

### B. Every tree toggle is out of the tab order and hidden from AT; a leaf toggle stays disabled
- Test: `it('binds tabindex="-1" and aria-hidden="true" on parent and leaf toggles, and keeps the leaf disabled')`
- Asserts: `toggle('t1')` (parent) and `toggle('t2')` (leaf) both
  have `tabindex="-1"` and `aria-hidden="true"`.
  `toggle('t2').disabled === true` and `data-disabled=''`.
  `toggle('t1').disabled === false`.
- Covers: AC5, US22, DW1
- Risk: damage high, likelihood high
- Why this seam: current code puts `aria-hidden` behind
  `isLeaf()`. The obvious edit leaves that condition in place, so
  a parent toggle is still announced as a second control. A missing
  `tabindex="-1"` brings back one Tab stop per row, which is the
  "200 Tab presses" problem the spec opens with. Checking the leaf
  catches an edit that drops the existing `disabled` binding while
  rewriting the host map.
- Order reason: independent of A. It changes the tree toggle's own
  host bindings, not the base.

### C. Clicking a tree toggle moves DOM focus to its row
- Test: `it('moves focus to its row when the toggle is clicked, even with focus outside the grid')`
- Asserts: attach the fixture to `document.body`, the same way
  `ngp-table.directive.spec.ts` does. `document.activeElement` is
  `document.body` first. After `clickToggle('t1')` (plus
  `TestBed.tick()`/`flushEffects` for the `afterNextRender` sync),
  `document.activeElement` is t1's `<tr>`, and the child row `t1a`
  is rendered.
- Covers: AC5, US23
- Risk: damage high, likelihood high
- Why this seam: this catches three bugs. It fails if `moveTo` is
  missing, if the target is wrong (a cell instead of
  `columnId: null`, or the wrong row id), or if
  `{ focusElement: true }` is missing. Without that flag, K9d
  leaves DOM focus where it was, because focus started outside
  the grid. A test that only reads the store would miss the
  missing flag. The child-row check guards against the new focus
  call replacing the `table.tree.toggle` call instead of
  following it.
- Order reason: independent of A and B. It relies on step 1's row
  focus registration and the `ngpTable` sync effect.

## Types phase (after green)
None — no public type surface in this step.

## Not tested
- The panel toggle keeps `aria-expanded` after the split. Covered
  by `ngp-table-panel-toggle.directive.spec.ts`: 'reflects the
  store when the row is opened by something other than the toggle'
  checks `"true"`, and 'opens its row on click: the store holds the
  row id' checks `"false"`.
- Click toggles open, then closed. Covered by the existing
  `ngp-table-tree-toggle.directive.spec.ts` tests 'opens a
  collapsed parent on click…' and 'closes an open parent on a
  second click…' once they are amended (see Decisions applied).
- Group header toggle under `withGrouping()` + `withTree()`. Covered
  by 'opens and collapses a group header under withGrouping() +
  withTree()'. Focus on a group-header row uses the same `moveTo`
  call as C, so a second test would fail on the same bug.
- `type="button"` and the click bubbling to the row are unchanged.
  Covered by 'renders the toggle as type="button"…', 'forces
  type="button"…' and 'lets the click bubble to the row without
  preventing default'.
- K35: a tree toggle plus a checkbox in one cell classifies as
  `single`. Covered by `cell-widgets.spec.ts` — 'classifies a cell
  holding a tree toggle plus a checkbox as single'.
- A click on a leaf toggle does not move focus. A disabled button
  fires no click in the browser, so this tests the platform, not
  our logic.
- A click while focus is already on another cell in the grid. Same
  `moveTo` path as C; it would fail on the same bug.
- Browser mousedown-focus order: the button gets focus, `focusin`
  writes the cell, then the click's `moveTo` writes the row. jsdom
  `.click()` does not focus the button, so a unit test cannot
  reproduce this. Check it manually in Storybook.
- The dev-mode `withTree()` assertion is unchanged. Covered by
  'throws on first render when the table has no withTree()'.

## Decisions applied
- The four existing toggle specs are amended per K5 (user word 11-07), in their own `test` commit before red.
- The `aria-expanded` split is local (the panel toggle binds it in its own host map) pending #209.

---
Relevant paths:
- libs/table/src/directives/ngp-table-tree-toggle.directive.spec.ts
- libs/table/src/directives/ngp-table-panel-toggle.directive.spec.ts
- libs/table/src/directives/cell-widgets.spec.ts
- libs/table/src/directives/ngp-table.directive.spec.ts (pattern for attaching to document and asserting `document.activeElement`, around line 366)
