# Implementation Progress — Table: declared stages — anchors, ordering and dev checks

**Issue:** #155
**Branch:** feat/155-declared-stages
**Worktree:** C:/Users/dmena/git/ng-table/.claude/worktrees/docs-feature-authoring-155
**Status:** 3 / 5 complete

## Graph

```
Step 1 ──► Step 2 ──┬──► Step 3 ──► Step 4
                    └──► Step 5
```

Parallel-safe: [3, 5] after 2 · Dependency: 1 → 2 → 3 → 4

Edge 3 → 4 added by /implement: both edit
`compose-table.spec.ts` (step 4's pointer comment in step 2's
fixtures).

## Steps

| Step | Title | Status |
|---|---|---|
| 1 | The stage order resolver | ✅ done |
| 2 | Run the resolved order | ✅ done |
| 3 | Duplicate stage claim is dev-only | ▶ in progress |
| 4 | Declared names typed to the registries | ⬚ pending |
| 5 | Drop stale #155 notes | ✅ done |
