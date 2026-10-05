---
step: 3
type: code
commit: feat
depends_on: []
files:
  - libs/table/src/api/features/with-filtering/tree-retention.ts (new)
  - libs/table/src/api/features/with-filtering/tree-retention.spec.ts (new)
---

# Step 3 — Tree retention helper

This step adds a pure helper that keeps each matching row with its ancestors.
It leaves wiring the helper into the filter stage to step 4.

Decisions: [D5, D7](../../1-decisions.md)

## Do

- Add the helper:

  ```ts
  retainTreeMatches<TRow>(rows: readonly TRow[], opts: {
    matches: (row: TRow) => boolean;
    parentOf: ParentLink<TRow>;
    trackBy: TrackByFn<TRow>;
    includeDescendants: boolean;
  }): { rows: TRow[]; contextIds: ReadonlySet<RowId> }
  ```

- Keep each match and all of its ancestors.
- With `includeDescendants`, also keep every descendant of a match.
- Return the kept rows in input order.
- Set `contextIds` to the kept rows that neither match nor were kept as a descendant of a match.
- Walk ancestors over `resolveTreeLinks(...).parentById` from `engine/tree-links.ts`.

## Watch out

- Id `0` is a real id. Use no truthiness checks on ids.
- `parentOf` is already silent. This helper reports nothing.
- Do not export the helper from `index.ts`.

## Out of scope

- Wiring into the filter stage (step 4).
- Guarding a throwing matcher (step 4).

## Done when

- [ ] Every seam in the test plan passes.

---

← [Step 2: Compose context rows](step-2-compose-context-rows.plan.md) | [Step 4: Filter keeps ancestors](step-4-filter-keeps-ancestors.plan.md) →
