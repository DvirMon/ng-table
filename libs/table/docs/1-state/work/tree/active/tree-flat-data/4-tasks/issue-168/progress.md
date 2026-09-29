# Implementation Progress — Table: filtering a tree keeps ancestors as context rows

**Issue:** #168
**Branch:** feat/168-filter-context-rows
**Worktree:** C:/Users/dmena/git/ng-table/.claude/worktrees/feat-168-filter-context-rows
**Status:** 1 / 7 complete

## Graph

```
Step 1 ──┬──► Step 2
         ├──► Step 5 ─────────┐
         └──┐                 ▼
Step 3 ─────┴──► Step 4 ──┬─► Step 7
                          └─► Step 6
```

Parallel-safe: [1, 3] first · [2, 4, 5] after 1 (4 also after 3) · [6, 7] after 4 (7 also after 5) · Dependency: 1 → 4 → 6

## Steps

| Step | Title | Status |
|---|---|---|
| 1 | Context-rows engine slot | ▶ in progress |
| 2 | Compose context rows | ⬚ pending |
| 3 | Tree retention helper | ✅ done |
| 4 | Filter keeps ancestors | ⬚ pending |
| 5 | Tree-row directive | ⬚ pending |
| 6 | hasChildren follows the filtered view | ⬚ pending |
| 7 | Feature docs | ⬚ pending |
