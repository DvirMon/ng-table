# Implementation Progress — Table: grouping-collapsible data rows use the tree pair + depth variable

**Issue:** #202
**Branch:** feat/202-grouping-collapsible-tree-pair
**Worktree:** C:/Users/dmena/git/ng-table/.claude/worktrees/feat-202-grouping-collapsible-tree-pair
**Status:** 4 / 5 complete

## Graph

```
Step 1 ──┐
Step 2 ──┼──► Step 4 ──► Step 5
Step 3 ──┤               ▲
         └───────────────┘
```

Parallel-safe: [1, 2, 3] · Dependency: {1,2,3} → 4 → 5

## Steps

| Step | Title | Status |
|---|---|---|
| 1 | Four grouping hosts bind the core directives | ✅ done |
| 2 | Four more grouping hosts bind the core directives | ✅ done |
| 3 | Collapsible data rows use the tree pair | ✅ done |
| 4 | One depth rule in grouping-story.css | ✅ done |
| 5 | Product doc coverage for U6 and 1.6 | ⬚ pending |
