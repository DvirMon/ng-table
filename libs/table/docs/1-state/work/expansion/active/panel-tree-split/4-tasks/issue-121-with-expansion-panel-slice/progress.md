# Implementation Progress — `withExpansion()` narrows to the detail panel and ships as a slice

**Issue:** #121
**Status:** 3 / 3 complete

| Step | Title                                         | Status  | PR  |
| ---- | --------------------------------------------- | ------- | --- |
| 1    | `withExpansion()` narrows to the detail panel | ✅ done | —   |
| 2    | `with-expansion.spec.ts` narrows to the panel | ✅ done | —   |
| 3    | Docs and ADRs catch up                        | ✅ done | —   |

## Graph

```
Step 1 ──► Step 2      Step 3
code       test         docs
```

Dependency: `Step 1 → Step 2` — the spec rewrite targets the
`expansion` slice Step 1 introduces. **Parallel-safe: [3]** with
either — every doc edit in Step 3 is fully pinned by `2-spec.md`
already, nothing there is discovered during implementation.

**Blocked by nothing today** — #118 (`createExpansionStore()`) and
#119 (`withTree()`) have both shipped; `with-tree.ts` and
`with-tree.spec.ts` are the patterns Steps 1-2 mirror throughout.
#120 (collapsible-grouping story migration) has also shipped, so the
one in-repo consumer of the old tree-shaped `withExpansion()` API is
already off it.

Step 2 also lands the type-level D25 case `with-tree.spec.ts` (line 1275) explicitly deferred to this issue.
