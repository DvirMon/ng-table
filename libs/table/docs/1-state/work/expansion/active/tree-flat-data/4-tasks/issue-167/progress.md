# Implementation Progress — Table: withTree({ parentId }) nests flat rows

**Issue:** #167
**Branch:** feat/167-flat-tree-nesting
**Worktree:** C:/Users/dmena/git/ng-table/.claude/worktrees/feat-167-flat-tree-nesting
**Status:** 1 / 6 complete

## Graph

```
Step 1 ──► Step 2 ──┬──► Step 3 ─────────────┐
                    ├──► Step 4 ──► Step 5 ──┴──► Step 6
                    └──────────────► Step 5
```

Parallel-safe: [3, 4] after 2 · Dependency: 1 → 2 → 4 → 5 → 6

## Steps

| Step | Title | Status |
|---|---|---|
| 1 | tree-links: resolve parent links, degrade broken ones | ✅ done |
| 2 | `withTree({ parentId })` nests flat rows | ⬚ pending |
| 3 | tree reads: `parentOf` / `descendantsOf`, and `removeRow(id[])` | ⬚ pending |
| 4 | Move the grouping story fixture to flat rows | ⬚ pending |
| 5 | Remove `childrenAccessor` | ⬚ pending |
| 6 | Docs: flat-data tree contract | ⬚ pending |
