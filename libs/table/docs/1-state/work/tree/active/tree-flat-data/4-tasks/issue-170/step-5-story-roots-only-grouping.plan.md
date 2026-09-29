---
step: 5
type: story
commit: test
depends_on: [4]
files:
  - libs/table/src/stories/grouping/fixtures/mock.ts
---
# Step 5 — Show roots-only grouping in the collapsible story

This step changes the shared grouping fixture so the collapsible story shows a child grouped under its root.
It leaves host component changes alone.

Decisions: [TR16](../../../../../../../decisions/tree.md), [TR17](../../../../../../../decisions/tree.md), [D13, D14](../../1-decisions.md).

## Do

- Give `d4-b` a `rep` different from `d4`'s, using another existing rep name and owner.
  It still renders under `d4`'s rep group, nested under `d4`.
- Keep the own-value amounts: `d4` 8000, `d4-a` 25000, `d4-b` 17000.
- Update the fixture comment so it explains the group total (50000) and the roots-only behavior.

## Watch out

- `GROUPING_ROWS_MOCK` is shared by the `grouping-basic`, `grouping-aggregates` and `grouping-async-rule` hosts and by `handlers.ts`.
  Those stories have no `withTree`, so `d4-b` now groups by its own rep there.
  Grep for `50000`, `'Grace'` and `d4` to confirm no hard-coded count or total in those hosts or their `.mdx` breaks.

## Out of scope

- Host component changes.

## Done when

- [ ] The collapsible story's `d4` group total reads 50000 with `d4-b` under `d4`.

---
← [Step 4: Wire the parent link into withGrouping()](step-4-wire-grouping-parent-link.plan.md) | [Step 6: Record the roots-only grouping contract](step-6-docs-roots-only-grouping.plan.md) →
