# Implementation Progress — Table: filter reveal opens context rows

**Issue:** #169
**Branch:** feat/169-filter-reveal
**Worktree:** C:/Users/dmena/git/ng-table/.claude/worktrees/feat-169-filter-reveal
**Status:** 0 / 9 complete

## Graph

```
Step 1 ──┐
         ├──► Step 3 ──► Step 4 ──► Step 5 ──► Step 6 ──► Step 7 ──► Step 8 ──► Step 9
Step 2 ──┘                                                                        ▲
   └──────────────────────────────────────────────────────────────────────────────┘
```

Parallel-safe: [1, 2] · Dependency: 1 → 3 → 4 → 5 → 6 → 7 → 8 → 9

Steps 3–8 all edit `api/features/with-tree/feature.ts`, so they run in order.

## Steps

| Step | Title                             | Status  |
| ---- | --------------------------------- | ------- |
| 1    | Split with-tree into a folder     | ✅ done |
| 2    | Engine read of context rows       | ✅ done |
| 3    | table.tree.contextRowIds          | ✅ done |
| 4    | Reveal context rows               | ✅ done |
| 5    | Close a revealed row              | ✅ done |
| 6    | Open-set writes clear closed rows | ✅ done |
| 7    | expand() includeHidden            | ✅ done |
| 8    | state() includeHidden             | ✅ done |
| 9    | Docs and decisions                | ✅ done |
