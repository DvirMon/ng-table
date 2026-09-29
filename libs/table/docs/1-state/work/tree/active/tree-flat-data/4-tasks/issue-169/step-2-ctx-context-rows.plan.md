---
step: 2
type: code
commit: feat
depends_on: []
files:
  - libs/table/src/engine/types.ts
  - libs/table/src/engine/core.ts
  - libs/table/src/engine/compose-table.ts
  - libs/table/src/engine/compose-table.spec.ts
  - libs/table/src/engine/types.types.spec.ts
---
# Step 2 — Engine read of context rows

This step lets a feature read the engine's union of context rows through `ctx.contextRows()`.
No feature reads it yet; Step 3 does.

Decisions: [D27](../../1-decisions.md), [A2](../../3-architecture.md), ADR-0028

## Do

- Add `contextRows?(): ReadonlySet<RowId>` to `StageContext<TRow>`, in method syntax:

  ```ts
  export type StageContext<TRow> = {
    parentOf?(row: TRow): RowId | null;
    contextRows?(): ReadonlySet<RowId>;
  };
  ```

- In `core.ts`, expose the existing `context` union on `TableCoreHandle` as `readonly contextRows: Signal<ReadonlySet<RowId> | undefined>`. `undefined` still means "no contributor" for the stamp.
- In `compose-table.ts`, wire `stageContext.contextRows` to read that signal. Map `undefined` to an empty set.

## Watch out

- The member stays optional, like `parentOf`. Hand-built literals in `pipeline.spec.ts` and `render-stages.spec.ts` must still compile.
- Its JSDoc repeats the `parentOf` rule: read it lazily, never in a factory body, because a feature folded later may contribute.

## Out of scope

- Any feature reading the member (Step 3).
- The `isContextRow` stamp, which is unchanged.

## Done when

- [ ] `ctx.contextRows()` returns the union of every contribution.
- [ ] `ctx.contextRows()` returns an empty set when nothing contributes.

---
← [Step 1: Split with-tree into a folder](step-1-split-with-tree-folder.plan.md) | [Step 3: table.tree.contextRowIds](step-3-context-row-ids.plan.md) →
