# Step 3 — The documented spelling

**PR scope:** ships alone. **Parallel-safe with: Step 1, Step 2** — no
step reads another's artifact.

**Task type:** docs

**Skills used:** none

**Scaffolding agent:** none — main thread

## Files

- `libs/table/src/stories/grouping/grouping.mdx` (edit)
- `libs/table/src/api/features/with-grouping/feature.ts` (edit —
  JSDoc only)
- `libs/table/src/engine/grouping/queries.spec.ts` (edit — comment
  only)

## Why This Step Exists

Three places in the library teach `expandAll(table.groupIds())` as the
way to open every group. Once the story composes `withTree()`, that
spelling names a verb no composition in the repo reaches. A reader
copying it gets a compile error, and an agent reading `groupIds()`'s
own JSDoc gets the pre-split API.

These are prose corrections with no behavioral half, which is why they
are one step and not three: the unit of review is "does the repo teach
the right spelling", answered by reading the diff.

## What To Do

### 1. `grouping.mdx` — three sites, not one

The issue's acceptance criteria name only the Collapsible section. Two
earlier paragraphs name `withExpansion()` too, and leaving them makes
the page contradict itself.

**Line ~57** — the "each story composes the fewest features its lesson
needs" paragraph lists `` `withExpansion()` in `Collapsible` ``.
Becomes `withTree()`.

**Line ~70** — the Basic story's paragraph: "deliberately no
`withExpansion()`, because a chevron with nothing to expand is a
control that does nothing". Becomes `withTree()`. The point is that
Basic composes **no expansion feature at all**, and `withTree()` is
now the feature a reader would otherwise reach for.

**Lines ~422-428** — the Collapsible section:

- `` `withGrouping()` + `withExpansion()`, and nothing else `` →
  `withTree()`.
- "`expandAll()` on its own discovers data rows through
  `childrenAccessor`" → `tree.expand()`.
- "the outline needs `expandAll(table.groupIds())`" →
  `tree.expand(table.groupIds())`.

**Keep the `childrenAccessor` sentence.** It reads as an aside today;
after Step 1 it is literally the story's own config
(`withTree({ childrenAccessor: (row) => row.children })`), so it gets
*more* accurate, not less. Same for "A deal carrying `children`
renders a second, separately-keyed chevron from the `'tree'` stage" —
unchanged and still true.

The `row.isExpanded` / `flattenVisible()` paragraph and everything
below the `<Canvas>` are unchanged.

### 2. `with-grouping/feature.ts` — the `groupIds()` JSDoc

Line ~64. The member doc ends:

```
   * derives from the cluster tree, not `renderRows()`. `[]` when ungrouped. Feeds
   * `expandAll(table.groupIds())`. */
```

The last sentence becomes `` Feeds `table.tree.expand(table.groupIds())`. ``

One line, one identifier. Per
`.claude/rules/terse-jsdoc-for-ai-and-humans.md`, do not grow the
block, do not add a rationale sentence, and do not explain the split —
that is the ADR's job.

### 3. `engine/grouping/queries.spec.ts` — one comment

Line ~52, inside
`describe('collectGroupIds — stability across a row reorder')`. The
comment explains what the collapsible story's sort toggles rest on and
ends:

> That is what lets `expandedRows` survive a sort — withExpansion
> never hears about the sort, it just keeps matching the same ids.

The story it describes now composes `withTree()`. Correct the feature
name. Keep `expandedRows` as the slot name — that is the engine's own
accumulating slot and it does not change here.

**Comment only.** No assertion, no fixture, no import changes in this
file.

### 4. Verified — nothing to do

Acceptance criterion #8 on the issue says `engine/core.spec.ts` and
`engine/compose-table.spec.ts` "stay as they are, but comments naming
`withExpansion()` are corrected".

**There are none.** Both files build their own fake contributors
(`const withA: AnyTableFeature = () => ({ expandedRows: … })`,
`createTableCore()` with `expandedSources` pushed directly), and their
comments name `core.ts`, `compose-table.ts`, `flattenVisible`,
ADR-0017 and ADR-0012 — never a library feature. Nothing to correct.

Stated here so the criterion closes without a second person
re-checking.

## Implementation Notes

- Grep before editing and after:
  `grep -rn "expandAll\|collapseAll\|toggleExpanded\|withExpansion" libs/table/src`.
  Expected remaining hits after this step and Steps 1-2:
  `with-expansion.ts` and `with-expansion.spec.ts` (the panel's own
  files, #121's), `expansion/state.ts`'s two comments (#121's), and the
  toolbar component's `expandAll` / `collapseAll` **outputs**, which
  are named after the story's buttons and stay.
- The mdx is Storybook docs, not a spec — no frontmatter, no
  `docs/status.md` regeneration, nothing generated from it.

## Risks / Watchouts

- `grouping.mdx` is long and mentions `withExpansion` in three
  unrelated paragraphs. Fix all three in one pass; a partial rename
  leaves the page teaching two different compositions for the same
  story.
- Do not "improve" the `groupIds()` JSDoc while in there. It is at the
  length the convention wants.

## Non-Goals

Everything below belongs to [#122](https://github.com/DvirMon/ng-table/issues/122),
which reconciles the expansion docs and ADR-0012 with the split. Do
not touch:

- `libs/table/CLAUDE.md` (lines ~286, ~292-293, ~316, ~331 name
  `withExpansion()` as the `'tree'` claimant).
- `docs/1-state/features/expansion.md`, `docs/1-state/features/grouping.md`,
  `docs/1-state/prd.md`, `docs/1-state/architecture.md`,
  `docs/1-state/state-persistence.md`.
- `docs/adr/0012-*`, ADR-0015, `docs/decisions/expansion.md`.
- `apps/site/src/app/pages/home/home.content.ts` and
  `apps/site/.../docs/decisions.md`.
- `npm run llms` / `npm run llms:check` regeneration.

## Acceptance Checks

- [ ] `grouping.mdx` names `withTree()` at all three sites and no
      longer contains `withExpansion` or a bare `expandAll(`.
- [ ] `groupIds()`'s JSDoc names `table.tree.expand(table.groupIds())`
      and is no longer than it was.
- [ ] `queries.spec.ts`'s comment names `withTree`; its assertions are
      byte-identical.
- [ ] `nx run shared-table:typecheck` clean — a JSDoc edit cannot break
      it, which is the point of confirming.

---
← [Step 2: The collapse cases move to the tree's spec](step-2-collapse-cases-move-to-tree-spec.plan.md)
