---
step: 3
type: code
commit: feat
depends_on: [1, 2]
files:
  - libs/table/src/api/features/with-tree/types.ts
  - libs/table/src/api/features/with-tree/feature.ts
  - libs/table/src/api/features/with-tree/feature.spec.ts
---
# Step 3 — table.tree.contextRowIds

This step adds `table.tree.contextRowIds`, a read of the current context rows.
Reveal, which uses it, is Step 4.

Decisions: [D20, D27](../../1-decisions.md) (spec story 30)

## Do

- Add `readonly contextRowIds: Signal<ReadonlySet<RowId>>` to `TreeSlice`.
- Build it as a `computed` over `ctx.contextRows?.() ?? empty`.
- Make the `withTree` factory take `(input, ctx)` and pass `ctx` into `buildTreeSpec`.

  ```ts
  table.tree.contextRowIds(); // ReadonlySet<RowId>
  ```

## Watch out

- Read `ctx` only inside the `computed`. `withFiltering()` is folded after `withTree()`, so a read in the factory body sees no contributor.

## Out of scope

- Reveal (Step 4).

## Done when

- [ ] `contextRowIds()` lists every context row, including rows hidden under a collapsed parent.

---
← [Step 2: Engine read of context rows](step-2-ctx-context-rows.plan.md) | [Step 4: Reveal context rows](step-4-reveal-context-rows.plan.md) →
