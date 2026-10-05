---
step: 4
type: code
commit: refactor
depends_on: [2]
files:
  - libs/table/src/stories/grouping/fixtures/types.ts
  - libs/table/src/stories/grouping/fixtures/mock.ts
  - libs/table/src/stories/grouping/fixtures/handlers.ts
  - libs/table/src/stories/grouping/fixtures/http.ts
  - libs/table/src/stories/grouping/grouping-collapsible/grouping-collapsible-story-host.component.ts
  - libs/table/src/stories/grouping/grouping-collapsible/grouping-collapsible-story-host.component.html
  - libs/table/src/stories/grouping/grouping.mdx
---

# Step 4 — Move the grouping story fixture to flat rows

This step moves the grouping story's deal fixture from nested
`children` arrays to a flat `parentId` field, and switches the
story host to `withTree({ parentId })`.
It leaves `childrenAccessor` in place for other stories; Step 5
removes it.

Decisions: [D1](../../1-decisions.md), [D15](../../1-decisions.md).

## Do

- In `fixtures/types.ts`, replace `DealRow.children` with
  `parentId: string | null`.
- In `fixtures/mock.ts`, make `d4-a` and `d4-b` top-level
  entries in the flat list, each with `parentId: 'd4'`.
- `d4`'s own amount changes from 42000 to 8000. North East /
  Services' group total becomes 50000.
- In `fixtures/handlers.ts` and `fixtures/http.ts`, serve the
  flat rows as-is — drop the recursive mapping that used to
  build `children`.
- In the story host, swap
  `withTree({ childrenAccessor })` for
  `withTree({ parentId: (row) => row.parentId })`.

## Watch out

- Update any total shown in `grouping.mdx` that assumed d4 was 42000.

## Out of scope

- Removing `childrenAccessor` from `withTree()` itself — Step 5.
- Any other story's fixture.

## Done when

- [ ] No `children` field remains in the grouping fixtures.
- [ ] Manual Storybook check of `grouping-collapsible`: the
      tree nests under its root, d4's group total reads 50000,
      and collapse state survives a refetch. (Run manually —
      this plan does not start Storybook.)

(No test plan for this step — planner returned Seams: none.)

---

← [Step 3: tree reads — parentOf / descendantsOf, and removeRow(id[])](step-3-tree-reads.plan.md) | [Step 5: Remove childrenAccessor](step-5-remove-children-accessor.plan.md) →
