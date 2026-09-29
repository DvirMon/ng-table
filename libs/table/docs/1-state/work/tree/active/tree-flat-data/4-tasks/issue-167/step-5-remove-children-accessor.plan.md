---
step: 5
type: code
commit: feat
depends_on: [2, 4]
files:
  - libs/table/src/api/features/with-tree.ts
  - libs/table/src/api/features/with-tree.spec.ts
  - libs/table/src/api/features/with-expansion.spec.ts
  - libs/table/src/table.mock.ts
---
# Step 5 — Remove `childrenAccessor`

This step deletes `withTree()`'s nested-data path so the flat
`parentId` path is the only way to build a tree.
It leaves all other flat-tree behavior from Steps 2 and 3
unchanged.

Decisions: [D1](../../1-decisions.md), [D3](../../1-decisions.md).

## Do

- Delete `childrenAccessor`, `toChildNode`, the nested
  recursion in `collectExpandableRowIds`, and every
  accessor-only branch. `'tree'` is now claimed only when
  `parentId` is set.
- Migrate `with-tree.spec.ts` cases to the flat fixture from
  Step 2, keeping each case's original intent:
  - Most cases swap the nested r1 → c1 → g1, r2 fixture for
    `makeFlatRows()`; assertions stay the same.
  - Keep the case at `:346` (a grandchild needs both ancestors
    open), `:532` (zero features), and `:1154` (a throwing
    `isExpandable`) — on the flat fixture.
  - Keep `:624` (collapse-only plus a claimant). Delete its
    accessor-collision half if Step 2's seam N already asserts
    it.
  - `:661`, `:685`, `:838`, `:1062` need no accessor change —
    only fix the imported fixture.
  - Delete `:476` (custom children key) and `:1111` (a
    throwing `childrenAccessor`).
  - Migrate `:1175` and `:1196` to `parentId` plus
    `isExpandable` — these are the only tests of separate
    per-callback dedupe flags.
  - In `with-expansion.spec.ts:369-386`, switch the 3 uses to
    `withTree({ parentId })` on the flat fixture, keeping the
    order-independence intent.
  - Line numbers are as of this plan; re-locate cases by test
    name, not by line.

## Watch out

- This is a test-after-code migration, not a new seam. No new
  `step-5.test-plan.md` is written or needed.

## Out of scope

- Any new behavior — this step only removes the old path and
  updates existing tests to the flat fixture.

## Done when

- [ ] `grep -r childrenAccessor libs/table/src` finds nothing.

Commit body must say:
`BREAKING CHANGE: childrenAccessor removed; use parentId.`

---
← [Step 4: Move the grouping story fixture to flat rows](step-4-grouping-story-flat-fixture.plan.md) | [Step 6: Docs — flat-data tree contract](step-6-docs.plan.md) →
