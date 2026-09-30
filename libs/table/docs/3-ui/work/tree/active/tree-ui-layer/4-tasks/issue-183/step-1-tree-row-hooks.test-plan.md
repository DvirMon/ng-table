# Step 1 test plan — tree-row hooks

Step: [step-1-tree-row-hooks.plan.md](step-1-tree-row-hooks.plan.md)
Spec file: `libs/table/src/directives/ngp-table-tree-row.directive.spec.ts`

## Stubs (red phase)
- None. The step adds no new symbol. It adds two host
  bindings to the existing `NgpTableTreeRowDirective`. The
  tests import only what already exists (`HostComponent`,
  `setup()`, `mockDataRenderRow()`), so red fails on
  assertions, not on imports.

## Seams — in red-green order
Reuse the existing `HostComponent` / `setup()` / `update()`.
`mockDataRenderRow()` leaves `hasChildren` and `isExpanded`
`undefined` by default. `update()` rebuilds the row from
defaults, so every `update` call must pass the full set of
overrides (`id`, `hasChildren`, `isExpanded`).

### A. `hasChildren: true` → `data-expandable=""`
- Test: `it('marks an expandable row with an empty data-expandable attribute')`
- Asserts: `hasAttribute('data-expandable')` is `true` and
  `getAttribute('data-expandable')` is `''`.
- Why this seam: catches a missing binding, and catches a
  value binding (`"true"`) that breaks the presence-only
  contract (ADR-0026 rule 1). CSS keys on
  `[data-expandable]`.
- Order reason: independent. It is the base case and creates
  the first host binding.

### B. `hasChildren: false | undefined` → no `data-expandable`
- Test: `it.each([false, undefined])('omits data-expandable when hasChildren is %s')`
- Asserts: `hasAttribute('data-expandable')` is `false`.
- Why this seam: catches `? '' : false` or
  `: undefined`-style slips that render `"false"`, and
  catches truthiness bugs on `undefined` (the value on every
  table without `withTree()`).
  Same shape as the existing `data-context-row` `it.each`.
- Order reason: builds on A. It pins the `null` branch of
  the binding A introduced.

### C. `isExpanded: true` → `data-expanded=""`
- Test: `it('marks an expanded row with an empty data-expanded attribute')`
- Asserts: with `{ hasChildren: true, isExpanded: true }`,
  `hasAttribute('data-expanded')` is `true` and
  `getAttribute('data-expanded')` is `''`.
- Why this seam: catches a missing or value-typed second
  binding.
- Order reason: independent of A/B in logic. Placed after
  them so the green phase adds the second binding by copying
  the proven shape of the first.

### D. `hasChildren: true`, `isExpanded: false | undefined` → `data-expandable` present, `data-expanded` absent
- Test: `it.each([false, undefined])('omits data-expanded on an expandable row when isExpanded is %s')`
- Asserts: `hasAttribute('data-expandable')` is `true`
  and `hasAttribute('data-expanded')` is `false`.
- Why this seam: catches cross-wiring. If `data-expanded`
  is keyed off `hasChildren` (or both off one computed),
  C still passes but this test fails. It is the only test
  that tells the two attributes apart. It is also the
  collapsed-parent state CSS styles most.
- Order reason: builds on A and C. It needs both bindings
  to exist so it can prove they are independent.

### E. same row changes → attribute removed
- Test: `it.each(['data-expandable', 'data-expanded'])('removes %s when the same row stops matching')`
- Asserts: `setup({ id: 'row-1', hasChildren: true, isExpanded: true })`.
  Assert the attribute is present. Then call
  `update({ id: 'row-1', hasChildren: <false for data-expandable, true otherwise>, isExpanded: false })`.
  Assert the attribute is absent.
- Why this seam: catches a non-reactive read (the row read
  once, not through `computed`/a signal read in the host
  binding). A collapse must drop `data-expanded`. An
  `isExpandable` override flipping off must drop
  `data-expandable`. Mirrors the existing
  `removes data-context-row …` case.
- Order reason: builds on A–D. Reactivity is only
  meaningful once both static branches are pinned.

## Types phase (written in red, proven by green's typecheck)
None — no public type surface in this step.

## Not tested
- Existing `data-context-row` cases: kept unchanged, not
  rewritten. They must still pass as a regression guard
  (Done-when). They are not a new seam.
- `isExpandable` overriding `hasChildren`: the engine
  resolves this upstream (`with-tree/feature.spec.ts:444`).
  Asserting it here would pull the engine's behaviour into
  the directive's spec. The directive only sees the resolved
  `hasChildren`, which E already drives.
- `div[ngpTableRow][ngpTableTreeRow]` host variant: same
  `host` bindings on the same class. A second host would fail
  on the same bug as the `tr` host.
- Attribute ownership (D5): checked statically. Removing row
  `aria-expanded` belongs to #182, not this step.
- Truthy non-boolean values (`1`, `'yes'`): both fields are
  typed `boolean | undefined`, so the type system rules these
  out.
- Directive internals (the `computed` signals): protected, so
  only DOM output is asserted.

Resolved: `data-expanded` is not gated on `hasChildren` (D3 as
written); the engine never stamps `isExpanded` on a childless
row (`with-tree/feature.spec.ts:444`).
