# Step 3 test plan — Tree toggle extends the collapsible core

Step: [step-3-tree-toggle-extends-core.plan.md](step-3-tree-toggle-extends-core.plan.md)
Spec file: `libs/table/src/directives/ngp-table-tree-toggle.directive.spec.ts`

## Stubs (red phase)
None. The tests import only `NgpTableTreeToggleDirective`, which
already exists. They assert rendered attributes only, never core
members. Against today's toggle (no core, no `type` binding, leaf
omits `aria-expanded`), all three seams fail on an assertion, so
the red phase is real without a stub.

## Seams — in red-green order
### A. Template with no `type` → rendered toggle has `type="button"`
- Test: `it('renders the toggle as type="button" when the template sets no type')`
- Setup: `setup(TreeHost)`. `TOGGLE_TABLE_TEMPLATE` already has
  no `type`, so no new host is needed.
- Asserts: `toggle('t1').getAttribute('type')` is `'button'`.
  Also `toggle('t2')` (the leaf) is `'button'`. The core binding
  covers every row, not only parents.
- Why this seam: catches the toggle not inheriting the core's
  `type` host binding: a missing `extends`, or a subclass
  `host` block that drops the inherited binding. That bug is the
  form-submit bug the spec exists to fix (user stories 1–2).
- Order reason: independent. This is the base case: the
  inherited binding exists at all.

### B. Template `type="submit"` → rendered toggle still `type="button"`
- Test: `it('forces type="button" even when the template sets type="submit"')`
- Setup: new `SubmitTypeHost`, built like the existing check
  hosts: `checksTemplate('<button ngpTableTreeToggle aria-label="Toggle row" type="submit"></button>')`
  plus `createCheckTable(CHECK_ROWS, true)`, rendered with
  `renderChecks`. Place the test in the main
  `NgpTableTreeToggleDirective` describe, not the dev-checks one.
- Asserts: every `button` in the fixture has
  `getAttribute('type') === 'button'`.
- Why this seam: catches a core that sets `type` as a static
  host attribute (`type: 'button'`) instead of the dynamic
  `[attr.type]` binding. A consumer's static attribute wins
  over that, so A passes and B fails. That makes it a separate
  bug from A (user story 3, Step 1's "binds dynamically").
- Order reason: builds on A. It needs the inherited binding in
  place; then the binding must override the consumer's attribute.

### C. Leaf row → toggle is `aria-expanded="false"`, still disabled and hidden
- Test: rename the existing
  `it('disables and hides the toggle on a row without children, with no aria-expanded')`
  to
  `it('disables and hides the toggle on a row without children, with aria-expanded="false"')`
- Asserts: change only
  `expect(leaf.hasAttribute('aria-expanded')).toBe(false)` to
  `expect(leaf.getAttribute('aria-expanded')).toBe('false')`.
  Keep the rest unchanged: leaf `disabled`,
  `aria-hidden="true"`, `data-disabled=""`, no `data-expanded`.
  Parent: not disabled, no `aria-hidden`, no `data-disabled`.
- Why this seam: catches the old `ariaExpanded` computed (or a
  subclass `[attr.aria-expanded]` binding) left in place. That
  would be a second writer on the attribute (TR37), and it would
  keep the leaf omission that TR48 removes. The unchanged
  disabled-branch assertions catch the opposite mistake: deleting
  the leaf host bindings along with `(click)` and the expanded
  bindings.
- Order reason: independent of A and B. It depends on the core's
  `aria-expanded` binding, not on `type`.

## Types phase (written in red, proven by green's typecheck)
None. This step has no public type surface. `isOpen`/`toggle`
become protected `override`s, and the directive's public shape
does not change.

## Not tested
- Kept unchanged, no new test: open/close on click
  (`aria-expanded` `'true'`/`'false'`, `data-expanded`
  `''`/absent), group header collapse under `withGrouping()` +
  `withTree()`, click bubbles without `preventDefault`, and the
  `withTree()` dev throw. These existing tests already pin the
  behaviour that now comes from the core. After the refactor they
  are regression guards, not new seams.
- Clicking inside a real `<form>` does not submit it. That is
  browser behaviour of `type="button"`. Covered by A and B
  (unit-test skip list: framework/platform behaviour).
- `override` on `isOpen`/`toggle`, the `super()` call, removing
  the `ariaExpanded` member: implementation details with no
  observable effect beyond C. The spec rules "tests assert
  rendered attributes only, never core members" (skip list:
  private/implementation internals).
- The core's own contract in isolation: no separate spec, by the
  Testing Decisions ("its whole contract is observable through
  the toggle"). That belongs to Step 1, not this step.
- Removing the nameless-button warning tests: done by Step 2
  (`depends_on`), not this step.
- JSDoc text: documentation, not logic.

## Open questions
- None. Step 2 keeps `checksTemplate`, `createCheckTable`,
  `CHECK_ROWS`, `CHECK_IMPORTS` and `renderChecks`, so seam B's
  helpers are in place.
