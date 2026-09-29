---
step: 4
type: code
commit: feat
depends_on: [3]
files:
  - libs/table/src/api/features/with-tree/reveal.ts (new)
  - libs/table/src/api/features/with-tree/types.ts
  - libs/table/src/api/features/with-tree/feature.ts
  - libs/table/src/api/features/with-tree/feature.spec.ts
---
# Step 4 — Reveal context rows

This step makes context rows render expanded under a filter, without writing the open set.
Closing a revealed row is Step 5.

Decisions: [D20 (a, b)](../../1-decisions.md), ADR-0014 (spec stories 26, 27, 29)

## Do

- Create `reveal.ts`. It builds the revealed set: the context ids whose row passes `revealContextRow`. Look each row up from `input.rows()` by `trackBy`.
- Add `revealContextRow?: (row: TRow) => boolean` to `WithTreeConfig`. The default reveals every context row. `() => false` turns reveal off.
- Contribute `expandedRows` as the open set unioned with the revealed set.

  ```ts
  withTree({ parentId: (row) => row.parentId, revealContextRow: (row) => row.parentId == null });
  ```

## Watch out

- Never write the open set. `changed` never fires for reveal.
- A throwing predicate reveals that row and reports once per evaluation. Reuse the file's `guardCallback`.
- Create the report flag per evaluation, not in the factory scope.

## Out of scope

- Closing a revealed row (Step 5).
- `includeHidden` (Steps 7 and 8).

## Done when

- [ ] Context rows render expanded under a filter.
- [ ] Clearing the filter restores the person's own open set exactly.
- [ ] A narrower predicate reveals only the matching rows.

---
← [Step 3: table.tree.contextRowIds](step-3-context-row-ids.plan.md) | [Step 5: Close a revealed row](step-5-close-revealed-row.plan.md) →
