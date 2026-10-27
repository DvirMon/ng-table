---
step: 2
type: code
commit: feat
depends_on: [1]
files:
  - libs/table/src/engine/focus.ts
  - libs/table/src/api/create-table.spec.ts
---

# Step 2 — Collapse recovers to the nearest visible ancestor

A row hidden by a collapse sends focus to its nearest visible ancestor row (row focus).
Closed panels are step 3.

Decisions: K9b, K12b, K24

## Do

- In `recoverFocus`, before the old-index rule: a data row id still in `rows()` but not in next render rows is hidden.
- A synthetic row (`data === null`, a group header) gone from render is hidden when its nearest earlier ancestor in `prev` (smaller depth) that is still rendered now has `isExpanded === false`. Otherwise it was regrouped away: use the old-index rule.
- For a hidden row, walk `prev` backwards from the old index to the nearest row with smaller `depth`.
- If that row is not rendered, keep walking with its depth as the new bound. Group headers count as ancestors.
- Result: `{ area: 'body', rowId: ancestorId, columnId: null }`.
- No rendered ancestor found: use the old-index rule.

## Watch out

- The depth bound is strict `<`.
- Group headers are never in `rows()`. Find them in `prev`.

## Out of scope

- Closed panel (step 3). DOM.

## Done when

- The test plan is green.
- `nx run shared-table:typecheck` and `nx run shared-table:typecheck-spec` clean.
