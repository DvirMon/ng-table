# Progress — grouping-coverage

Status per step. `/implement` marks `▶ in progress` on dispatch and `✅ done` on verified return.

| Step | Task type | Status | Depends on |
|---|---|---|---|
| [1 — totals on one canvas only](step-1-single-aggregate-canvas.plan.md) | code | ✅ done | — |
| [2 — sticky headers arg](step-2-sticky-headers-arg.plan.md) | code | ✅ done | — |
| [3 — post-filter ordering assertion](step-3-post-filter-ordering-spec.plan.md) | test | ✅ done | — |
| [4 — grouping-order composes withSorting](step-4-group-order-vs-row-sort.plan.md) | code | ✅ done | — |
| [5 — rewrite 0-product/grouping.md](step-5-product-doc-rewrite.plan.md) | docs | ☐ todo | 1, 2, 3, 4 |
| [6 — amend the coverage re-audit](step-6-amend-reaudit.plan.md) | docs | ☐ todo | 5 |
| [7 — ADR-0022 dead link](step-7-adr-0022-link.plan.md) | docs | ✅ done | — |

Parallel-safe: 1, 2, 3, 4, 7 — no shared files.
Sequential: 5 after all four code steps (it records what shipped), 6 after 5.

## Working-tree caution

A parallel declarator split is uncommitted in this repo: `api/features/with-grouping/` source,
`engine/grouping/`, `src/stories/grouping/grouping-keys/`, `src/stories/grouping/fixtures/schema.ts`,
and several `docs/work/` folders. **Path-scope every `git add`.** No step here touches any of
those files except `fixtures/schema.ts`, which step 1 reads but must not write.
