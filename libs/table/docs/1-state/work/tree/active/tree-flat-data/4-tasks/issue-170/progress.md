# Implementation Progress — Table: grouping a tree groups roots only

**Issue:** #170
**Branch:** feat/170-grouping-tree-roots
**Worktree:** C:/Users/dmena/git/ng-table/.claude/worktrees/feat-170-grouping-tree-roots
**Status:** 4 / 6 complete

## Graph

```
Step 1 ─────────────────┐
Step 2 ──► Step 3 ──────┴──► Step 4 ──► Step 5
Step 6 (independent)
```

Parallel-safe: [1, 2, 6] · Dependency: 2 → 3 → 4 → 5; 1 → 4

## Steps

| Step | Title | Status |
|---|---|---|
| 1 | Feature factories receive the stage context | ✅ done |
| 2 | Cluster by root value in the group stages | 🧪 awaiting CI |
| 3 | Group queries follow the root | ✅ done |
| 4 | Wire the parent link into withGrouping() | ▶ in progress |
| 5 | Show roots-only grouping in the collapsible story | ⬚ pending |
| 6 | Record the roots-only grouping contract | ✅ done |
