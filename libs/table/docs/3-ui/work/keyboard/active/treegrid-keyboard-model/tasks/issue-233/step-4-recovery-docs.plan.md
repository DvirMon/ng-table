---
step: 4
type: docs
commit: docs
depends_on: []
files:
  - libs/table/src/api/types.ts
  - libs/table/CONTEXT.md
---

# Step 4 — Document focus recovery

Consumer-facing description of recovery. Code is steps 1–3.

Decisions: K9a–K9e, K21

## Do

- `api/types.ts`: add JSDoc on `TableStore.focus` (or `TableFocus`). The store repairs the target when rows or columns change.
- List the cases: deleted or filtered row goes to the row at its old position; a moved row is followed; a collapsed row goes to its nearest visible ancestor; an empty table goes to the first header cell, or `null`; a hidden column goes to the column at its old position; a closed panel goes to its row.
- State that it never moves DOM focus.
- `CONTEXT.md` "Focused position" entry: add one line saying the engine keeps it valid when rows or columns change.

## Out of scope

- Permanent spec docs. Directive docs.

## Done when

- Both files are updated.
- `npm run llms:check` clean (the user runs it).
