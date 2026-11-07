**Issue:** #239 — Table: treegrid row focus, expand and collapse by keyboard
**Branch:** feat/239-treegrid-row-navigation
**Worktree:** .claude/worktrees/feat-239-treegrid-row-navigation

```mermaid
graph LR
  S1 --> S2
  S1 --> S3
  S1 --> S4
  S1 --> S5
  S2 --> S6
  S3 --> S6
  S4 --> S6
  S5 --> S6
```

Parallel-safe: [S2, S3, S4, S5] after S1 (no compile edge); S2, S3, S5 edit ngp-table.directive.ts, so run them in order S2 → S3 → S5; S4 is independent of them; S6 after all.

| Step | Title                                                                        | Status       |
| ---- | ---------------------------------------------------------------------------- | ------------ |
| 1    | [Treegrid role and row focus](step-1-treegrid-role-row-focus.plan.md)        | ⬚ pending |
| 2    | [Treegrid key map](step-2-treegrid-key-map.plan.md)                          | ⬚ pending |
| 3    | [Tree row ARIA and keys](step-3-tree-row-aria-keys.plan.md)                  | ⬚ pending |
| 4    | [Pointer-only toggle](step-4-pointer-only-toggle.plan.md)                    | ⬚ pending |
| 5    | [Row Tab walk](step-5-row-tab-walk.plan.md)                                  | ⬚ pending |
| 6    | [Treegrid row navigation docs](step-6-treegrid-row-navigation-docs.plan.md)  | ⬚ pending |
