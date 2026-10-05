# Step 1 — Render stages exchange a nested node tree

**PR scope:** One PR. Blocks Steps 2, 3, 4, 5, 6.
`Parallel-safe with: Step 7`

**Task type:** `code`
**Stack:** `angular`
**Skills used:** `angular-developer`
**Scaffolding agent:** `angular-implementer`

## Files

| Path                                              | Action                            |
| ------------------------------------------------- | --------------------------------- |
| `libs/table/src/engine/render-stages.ts`          | rewrite                           |
| `libs/table/src/engine/flatten.ts`                | **new**                           |
| `libs/table/src/engine/rows.ts`                   | edit (`buildDefaultRenderNodes`)  |
| `libs/table/src/engine/core.ts`                   | edit (`renderRows`, two comments) |
| `libs/table/src/engine/compose-table.ts`          | edit (import + fold)              |
| `libs/table/src/api/features/compose-features.ts` | edit (import + fold)              |
| `libs/table/src/engine/grouping/render.ts`        | rewrite walk (`buildGroupNodes`)  |
| `libs/table/src/api/features/with-expansion.ts`   | rewrite `buildTreeStage`          |
| `libs/table/src/api/types.ts`                     | edit (3 field comments)           |
| `libs/table/src/engine/types.ts`                  | edit (2 slot docs)                |

## Why This Step Exists

The stage signature changes from `RenderRowTransform` to
`RenderNodeTransform`. Both synthesizing stages — `'group'` and
`'tree'` — consume and produce it, so they move in the same commit
or nothing compiles. Teaching the fold both shapes to stage the
migration would add more machinery than this change deletes
(issue #107, "Why it can't be split").

This is the only step that changes runtime behaviour.

## What To Do

`3-architecture.md` carries the exact types and snippets. Follow
them; this section is the order, not a second source of truth.

1. **`engine/render-stages.ts`** — replace the whole file:
   `RenderNode<TRow>` (`id`, `kind`, `data`, `groupKey?`,
   `aggregates?`, `hasChildren?`, `children`),
   `RENDER_ORDER = ['group', 'tree']`, `RenderNodeTransform`,
   `RenderStages` (no `Exclude`), `mapNodes`, `runRenderStages`.
   **Delete** `StagedRow`, `RenderRowTransform`,
   `CLAIMABLE_RENDER_STAGES`, `pruneUnexpandedDescendants`, the
   `stage === 'prune'` branch and the `expanded` parameter.
2. **`engine/flatten.ts`** — new: `FlatRenderRow<TRow>` and
   `flattenVisible(nodes, expanded)`.
3. **`engine/rows.ts`** — `buildDefaultRenderRows` becomes
   `buildDefaultRenderNodes`; drop `depth: 0`, add `children: []`.
   Swap the `StagedRow` import for `RenderNode`.
4. **`engine/core.ts`** — `renderRows` runs
   `runRenderStages(seed, renderStages)`, then
   `flattenVisible(tree, expanded())`, then the existing `.map`
   **byte-identical**. Rename the local `seedRenderRows` to
   `seedRenderNodes`. Fix the `expandedSources` and `expanded`
   comments that name the `'prune'` stage.
5. **Both folds** — `compose-table.ts:104` and
   `compose-features.ts:51` iterate `RENDER_ORDER`.
6. **`engine/grouping/render.ts`** — `emitGroupRows` becomes
   `buildGroupNodes`: nested output, no `depth`, no `parentId`, no
   `hasChildren` stamp. `buildGroupRenderRows` keeps its name and
   parameter list; only its element type changes. Rewrite the two
   JSDoc blocks that describe flat emission and the `'prune'` stage.
7. **`api/features/with-expansion.ts`** — `toChildRenderRow` becomes
   `toChildNode`; `buildTreeStage(trackBy, childrenAccessor,
isExpandable)` uses `mapNodes` and **drops the `expandedRows`
   parameter entirely**. Delete the "read the signal inside the
   transform" JSDoc paragraph along with it. Drop the argument at the
   `renderStages.tree` registration site. `spec.expandedRows` stays.
8. **Field comments** — `api/types.ts` `isExpanded` / `hasChildren` /
   `parentId` now read _derived by the walk_, not _stamped by a
   stage_. `engine/types.ts` `renderStages` and `expandedRows` slot
   docs lose the `'prune'` references.

## Implementation Notes

- `mapNodes` is **post-order**: `fn` sees a node whose `children` are
  already mapped, and its return value is used as-is, never
  re-descended. `fn` returns one node, not an array.
- `flattenVisible`'s descent is `isOpen` **alone**, never
  `isOpen && hasChildren`. An explicit `hasChildren: true` on a lazy
  row must not gate a later-loaded array.
- `buildGroupRenderRows`'s `isRowData` guard and its "group stage must
  run first" throw are **unchanged** (X6).
- `collectExpandableRowIds` is untouched — it walks raw `TRow`s.
- Renaming `buildGroupRenderRows` to `buildGroupRenderNodes` is left
  to your judgment (architecture open question 3). If you rename it,
  rename `grouping/render.spec.ts`'s describe block too and say so in
  the PR body, because Step 3 asserts against that file.

## Risks / Watchouts

- **The D1a trap — silent when wrong.** `isExpanded` is stamped only
  when `expanded !== undefined` **and** the node has children.
  Dropping the first condition makes a grouping-only table report
  every header as expanded, inventing state a table without an
  expansion feature does not have. It compiles, it passes a
  grouping-only smoke test, and it is wrong.
- **X1 — zero contributors ≠ empty set.** `expanded === undefined`
  means everything is open. A defined-but-empty `Set` means a feature
  contributed and every nested row hides. Never a `size === 0` check.
- The specs do **not** compile after this step —
  `render-stages.spec.ts` imports `CLAIMABLE_RENDER_STAGES` and
  `StagedRow`, `core.spec.ts` imports `RenderRowTransform`. That is
  expected; Steps 2-5 fix it. Run `typecheck`, not `typecheck-spec`,
  to gate this step.

## Non-Goals

- Pagination and any post-flatten phase (`'paginate'` already left in
  #106).
- The `withExpansion()` / `withTree()` split (#101 / ADR-0012) — this
  lands first, on purpose (F1).
- Cycle guarding: a cyclic `children` array still overflows the stack
  (C5). Not a regression, not a fix.
- Any change to `index.ts`. `RenderNode` and `RenderNodeTransform`
  are engine-internal.
- Story hosts, ADRs and maintainer docs — Steps 6 and 7.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` clean, on a **second,
      source-clean run**.
- [ ] `grep -rn "prune\|StagedRow\|CLAIMABLE_RENDER_STAGES\|RenderRowTransform" libs/table/src`
      returns nothing outside `*.spec.ts`.
- [ ] `RENDER_ORDER` is exactly `['group', 'tree'] as const`, and
      `RenderStages` has no `Exclude<…>`.
- [ ] `runRenderStages` takes two parameters and its reduce has no
      per-stage branch.
- [ ] `buildTreeStage` takes no `Signal` and reads no expansion state.
- [ ] `buildGroupNodes` stamps none of `depth`, `parentId`,
      `hasChildren`; the "group stage must run first" throw survives.
- [ ] `flattenVisible` is the only function in `libs/table/src` that
      reads `expanded`.

---

[Step 2: The engine IR seam pair](step-2-flatten-and-fold-specs.plan.md) →
