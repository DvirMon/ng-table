# Implementation Progress — Table: tree toggle runs on a shared collapsible core

**Issue:** #215
**Branch:** feat/215-tree-toggle-on-collapsible-core
**Worktree:** C:/Users/dmena/git/ng-table/.claude/worktrees/feat-215-tree-toggle-on-collapsible-core
**Status:** 0 / 5 complete

## Graph

```
Step 1 ──┐
         ├──► Step 3 ──┬──► Step 4
Step 2 ──┘             └──► Step 5
```

Parallel-safe: [1, 2] · then [4, 5] after 3 · Dependency: {1, 2} → 3 → {4, 5}

## Steps

| Step | Title | Status |
|---|---|---|
| 1 | The collapsible trigger core | ⬚ pending |
| 2 | Drop the nameless-toggle warning | ⬚ pending |
| 3 | Tree toggle extends the core | ⬚ pending |
| 4 | Stories drop the manual button type | ⬚ pending |
| 5 | Tree docs retrofit | ⬚ pending |
