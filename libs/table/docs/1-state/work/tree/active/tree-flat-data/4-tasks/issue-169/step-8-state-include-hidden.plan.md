---
step: 8
type: code
commit: feat
depends_on: [7]
files:
  - libs/table/src/api/features/with-tree/types.ts
  - libs/table/src/api/features/with-tree/feature.ts
  - libs/table/src/api/features/with-tree/feature.spec.ts
---
# Step 8 — state() includeHidden

This step turns `TreeSlice.state` from a `Signal` into a method that takes `includeHidden`.
The docs are Step 9.

Decisions: [D8, D26](../../1-decisions.md) (spec stories 32, 33)

## Do

- Change `TreeSlice.state` to a method.
- Build two internal `computed`s, one per variant. The method picks one.

  ```ts
  state(options?: { includeHidden?: boolean }): 'all' | 'some' | 'none';
  table.tree.state();                        // filtered view
  table.tree.state({ includeHidden: true }); // all of data()
  ```

## Watch out

- The options bag stays inline. Do not add a named type.
- No callers exist outside specs.

## Out of scope

- Docs (Step 9).

## Done when

- [ ] Both variants answer independently on one store.
- [ ] Both variants stay reactive.

---
← [Step 7: expand() includeHidden](step-7-expand-include-hidden.plan.md) | [Step 9: Docs and decisions](step-9-docs-and-decisions.plan.md) →
