---
step: 7
type: code
commit: feat
depends_on: [6]
files:
  - libs/table/src/api/features/with-tree/types.ts
  - libs/table/src/api/features/with-tree/feature.ts
  - libs/table/src/api/features/with-tree/feature.spec.ts
  - libs/table/src/index.ts
---

# Step 7 — expand() includeHidden

This step lets `expand()` open every expandable row in `data()`, not only those in the filtered view.
`state()` gets the same option in Step 8.

Decisions: [D8](../../1-decisions.md) (spec stories 32, 33)

## Do

- Add `TreeWriteOptions = ExpansionWriteOptions & { includeHidden?: boolean }` to `types.ts`.
- Change the signature to `expand(ids?, options?: TreeWriteOptions)`.
- With no ids and `includeHidden`, run the discovery walk over `input.value()` instead of `input.rows()`.
- With ids given, `includeHidden` has no effect.
- Export `TreeWriteOptions` from `src/index.ts`, beside `ExpansionWriteOptions`.

  ```ts
  table.tree.expand(undefined, { includeHidden: true });
  ```

## Watch out

- Forward the rest of `options` (for example `emitEvent`) to the store unchanged.
- The default still scans `input.rows()`. Keep it.

## Out of scope

- `state` (Step 8).

## Done when

- [ ] `expand()` opens only the rows that are expandable in the filtered view.
- [ ] `expand(undefined, { includeHidden: true })` opens every expandable row in `data()`.

---

← [Step 6: Open-set writes clear closed rows](step-6-open-writes-clear-closed.plan.md) | [Step 8: state() includeHidden](step-8-state-include-hidden.plan.md) →
