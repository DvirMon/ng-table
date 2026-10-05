# Implementation Progress — `withTree()`: the row tree, the `'tree'` stage and `state()`

**Issue:** #119
**Status:** 3 / 3 complete

| Step | Title                                                                   | Status  | PR  |
| ---- | ----------------------------------------------------------------------- | ------- | --- |
| 1    | `withTree()`: the feature, the conditional `'tree'` stage and `state()` | ✅ done | —   |
| 2    | `with-tree.spec.ts`: the inherited row-tree behavior                    | ✅ done | —   |
| 3    | `with-tree.spec.ts`: collapse-only, `state()` and the ADR-0014 degrade  | ✅ done | —   |

## Graph

```
Step 1 ──► Step 2 ──► Step 3
feature    inherited   new surface
+ barrel   behavior    + types
```

Dependency: `Step 1 → Step 2 → Step 3`. Parallel-safe: none — Step 2
needs the `table.tree` slice Step 1 introduces, and Step 3 appends to
the file Step 2 creates.

**Blocked by #118.** `withTree()` builds its own `createExpansionStore()`
instance, and Step 1 consumes E18's `ExpansionChange` shape. Check
`api/features/expansion/state.ts` exports `ExpansionChange` before
starting Step 1.
