# Implementation Progress — Collapsible grouping composes `withTree()`; grouping spec decoupled

**Issue:** #120
**Status:** 3 / 3 complete

| Step | Title | Status | PR |
|---|---|---|---|
| 1 | The collapsible grouping story composes `withTree()` | ✅ done | — |
| 2 | The collapse cases move to the tree's spec | ✅ done | — |
| 3 | The documented spelling | ✅ done | — |

## Graph

```
Step 1      Step 2      Step 3
story +     spec        mdx + JSDoc
template    ownership   + comment
```

No edges. **Parallel-safe: [1, 2, 3]** — the story does not import a
spec, the specs do not import the story, and the prose is read by
neither. Any one can land first.

**Blocked by #119**, which has shipped: every verb this migration
calls (`table.tree.expand/collapse/toggle`, `WithTreeConfig.childrenAccessor`)
is introduced there. Confirm `withTree` is exported from
`libs/table/src/index.ts` before starting.

Step 1 carries the migration's real gate — `nx run shared-table:typecheck`
on a second, source-clean run, because the story template is the only
in-repo caller of the removed verbs and bare `tsc` never opens a
`.html`.
