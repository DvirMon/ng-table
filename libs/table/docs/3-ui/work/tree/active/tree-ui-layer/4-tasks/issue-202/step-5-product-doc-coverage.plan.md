---
step: 5
type: docs
commit: docs
depends_on: [3, 4]
files:
  - libs/table/docs/0-product/tree.md
---
# Step 5 — Product doc coverage for U6 and 1.6

`tree.md` records that `grouping-collapsible/` now covers story 1.6 and resolves gap U6.
It changes no other claim in the doc.

Decisions: [TR43](../../../../../../../decisions/tree.md) | [G79](../../../../../../../decisions/grouping.md)

## Do
- Section 1.6: mark it covered by `grouping-collapsible/`. Rewrite "Covered by" to state what the canvas now shows.
- U6 row in the gaps table (~line 855): mark it resolved by #202.
- Canvas table row for `grouping-collapsible/` (~line 80) and the prose at ~lines 83, 129 and 158–159: drop the "hand-written chevron" and "per-depth `[data-depth]` rule" claims.
- Story 1.2's coverage: update it likewise if it cites U6.

## Watch out
- Change only claims that #202 makes true. Do not touch other gaps.

## Out of scope
- Decisions logs, specs and code.

## Done when
- [ ] No sentence in `tree.md` says `grouping-collapsible/` uses a hand-written chevron or per-depth CSS.
- [ ] The 1.6 heading no longer says "not covered".

---
← [Step 4: One depth rule in grouping-story.css](step-4-single-depth-rule.plan.md)
