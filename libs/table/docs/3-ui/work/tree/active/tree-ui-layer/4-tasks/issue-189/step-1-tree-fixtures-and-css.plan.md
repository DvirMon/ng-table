---
step: 1
type: story
commit: feat
depends_on: []
files:
  - libs/table/src/stories/tree/fixtures/types.ts (new)
  - libs/table/src/stories/tree/fixtures/mock.ts (new)
  - libs/table/src/stories/tree/fixtures/schema.ts (new)
  - libs/table/src/stories/tree/tree-story.css (new)
---
# Step 1 — Tree fixtures and recipe CSS

Adds the shared flat project-plan fixture, its column schema and the tree styling recipe.
Leaves the three hosts, the mdx page and the doc edits for later steps.

Decisions: [TR38, TR41, TR42](../../../../../../../decisions/tree.md)

## Do

Fixture plan and layout: see [story-plan.md](story-plan.md) §3 "Fixture plan".

```ts
// fixtures/types.ts
export interface TaskRow { id: string; parentId: string | null; name: string; owner: string; status: string }
// fixtures/schema.ts
export const treeColumns = createColumns<TaskRow>(/* `name` first */);
export const treeConfig = { trackBy: 'id', columns: treeColumns };
```

- `types.ts` holds `TaskRow`.
- `mock.ts` exports `TREE_ROWS_MOCK`: about 22 flat rows, depth 0 to 3, three roots (one a root leaf).
- Every depth has a leaf beside a parent. Each level has siblings.
- The search term "review" must produce these cases (story-plan §3):
  - a depth-3 leaf under two non-matching ancestors;
  - a second matching leaf in another branch;
  - a parent whose own name matches while none of its children match.
- Keep one branch with no match.
- `schema.ts` exports `treeColumns` (`createColumns`, `name` first) and `treeConfig` (`trackBy: 'id'`).
  Cells are plain strings.
- `tree-story.css` is the styling recipe from the [tree UI spec](../../../../../../directives/tree.md), copied verbatim.
  It includes the `prefers-reduced-motion` branch and the `[data-context-row]` dim.

## Watch out
- Every `parentId` is `null` or the `id` of another row. No self-parents, no cycles.
- Plain string cells; no pipes file.
- The recipe must match the spec text. Do not restyle it.

## Out of scope
- Broken-link, self-parent or cycle rows.
- Per-depth CSS rules.
- Any host, toolbar or story file.

## Done when
- [ ] `TREE_ROWS_MOCK` reaches depth 3 and has a leaf beside a parent at every depth.
- [ ] The term "review" yields the three match cases above and leaves one branch with none.
- [ ] `tree-story.css` equals the spec's recipe, including the reduced-motion branch.
- [ ] No file in `src/` imports these files yet.

---
[Step 2: Basic tree story](step-2-basic-tree-story.plan.md) →
