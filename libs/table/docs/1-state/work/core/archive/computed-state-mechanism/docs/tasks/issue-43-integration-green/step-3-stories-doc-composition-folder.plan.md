---
title: 'Step 3 — docs/3-ui/stories.md: composition/ in the layout tree and fixtures table'
type: task-step
issue: 77
---

# Step 3 — `docs/3-ui/stories.md`: `composition/` in the layout tree and fixtures table

**PR scope:** One markdown file, two edits. Prose only.

**Task type:** docs

**Skills used:** —

**Depends on:** Step 1 (names the files it documents)
**Parallel-safe with:** Step 2

**Scaffolding agent:** main thread

## Files

- `libs/shared/table/docs/3-ui/stories.md` (edit — "File layout" tree, fixtures table)

## Why This Step Exists

`stories.md` is the standing convention doc for `src/stories/` and lists every feature folder
and fixture file. Step 1 adds a folder it does not know about; leaving it out makes the doc
wrong the moment Step 1 lands (the same discipline #41 Step 3 applied for `schema.ts`).

## What To Do

1. **Layout tree** (line ~67, `└── filtering/  grouping/  selection/ ← fixtures/ only; hosts
land when those stories ship`): add `composition/` as its own line above that one —
   `├── composition/ ← fixtures/ + derived-state/: the positional-composition showcase
(withComputed() in both placements)`. Keep the trailing line for the three fixture-only
   folders unchanged unless the `selection-stories` ticket has already edited it — then merge,
   don't overwrite.
2. **Fixtures table** (lines ~84–92): add three rows after the `row-edit/ui/*` row —
   `composition/fixtures/types.ts` (`CompositionRow`), `composition/fixtures/mock.ts`
   (`COMPOSITION_ROWS_MOCK`, `COMPOSITION_DEPT_OPTIONS`), `composition/fixtures/schema.ts`
   (`derivedStateConfig`, `createDerivedStateFilters()`). Same register as the existing rows —
   one sentence, exact identifiers, no rationale.
3. Nothing else. The "story-host component" and "mdx" sections already describe the shape
   Steps 1–2 followed.

## Implementation Notes

- The file is modified by the in-flight `filtering-stories` / `grouping-stories` /
  `selection-stories` tickets too. Read the working-tree version, not `HEAD`, before editing.

## Risks / Watchouts

- Table columns are pipe-aligned by hand; keep the cell count at two.

## Non-Goals

- Library README/CLAUDE.md, the migration table, ADRs — #44.

## Acceptance Checks

- [ ] `grep -c "composition/" libs/shared/table/docs/3-ui/stories.md` → ≥ 4 (tree + 3 rows)
- [ ] Every identifier in the new rows exists in Step 1's files (`grep` each)
- [ ] `git diff --stat` lists only `stories.md`

---

← [Step 2: `derived-state.stories.ts` + `.mdx`](step-2-derived-state-story.plan.md) | [Step 4: Agent-run static gates](step-4-static-gates.plan.md) →
