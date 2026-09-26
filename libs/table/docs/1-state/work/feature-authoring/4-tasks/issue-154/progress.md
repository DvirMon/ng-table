# Implementation Progress — Table: stage rule form replaces the object form for built-in claims

**Issue:** #154
**Branch:** feat/154-stage-rule-claims
**Worktree:** C:\Users\dmena\git\ng-table\.claude\worktrees\feat-154-stage-rule-claims
**Status:** 0 / 11 complete

## Graph

```
Step 1 ─┐
Step 2 ─┼─► Step 4 ─► Step 5 ─► Step 6 ─┬─► Step 7 ─┐
Step 3 ─┘                               ├─► Step 8 ─┼─► Step 10
                                        └─► Step 9 ─┘
                                                      Step 11 (after 1,2,3,9)
```

Parallel-safe: [1, 2, 3] at the start; [7, 8, 9] once 6 is done.
Dependency: 1,2,3 → 4 → 5 → 6 → {7, 8, 9} → 10; 11 depends on 1, 2, 3, 9.

**Note:** typecheck is expected RED from step 4 through step 8, first GREEN again at step 9 — this is an accepted, documented mid-sequence state (the object form's removal and the four feature refactors are one atomic change per architecture.md, but committed as separate steps per the user's own choice).

## Steps

| Step | Title | Status |
|---|---|---|
| 1 | Stage authoring surface (stageSchema + stage) | ✅ done |
| 2 | Pipeline anchors + registry | ✅ done |
| 3 | Render-stage anchors + registry | ✅ done |
| 4 | TableFeatureSpec retype | ✅ done |
| 5 | core.ts + compose-table.ts fold | ✅ done |
| 6 | compose-features.ts fold | ✅ done |
| 7 | Refactor withSorting + withFiltering | ✅ done |
| 8 | Refactor withGrouping | ⬚ pending |
| 9 | Refactor withTree | ⬚ pending |
| 10 | Barrel export | ⬚ pending |
| 11 | CLAUDE.md doc fix | ⬚ pending |
