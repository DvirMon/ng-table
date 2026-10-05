# Implementation Progress — Table: decouple the schema path mechanism from the columns schema

**Issue:** #111
**Status:** 6 / 6 complete

Reading chosen for AC #3: **B** — extract the recording runner only.
Recorded by Step 1 before any code moves.

| Step | Title                                                             | Type | Depends on | Status  | PR  |
| ---- | ----------------------------------------------------------------- | ---- | ---------- | ------- | --- |
| 1    | [Record reading B](step-1-record-reading.plan.md)                 | docs | —          | ✅ done | —   |
| 2    | [Decouple `path-proxy.ts`](step-2-decouple-path-proxy.plan.md)    | code | 1          | ✅ done | —   |
| 3    | [Shared recording runner](step-3-shared-recording-runner.plan.md) | code | 2          | ✅ done | —   |
| 4    | [Shared identifier check](step-4-shared-identifier-check.plan.md) | code | 1          | ✅ done | —   |
| 5    | [Spec the shared check](step-5-validate-spec.plan.md)             | test | 4          | ✅ done | —   |
| 6    | [Document the two new files](step-6-doc-new-files.plan.md)        | docs | 3, 4       | ✅ done | —   |

Status values: `⬚ pending`, `▶ in progress`, `✅ done`, `⏭ skipped`.

## Graph

```
        ┌─► 2 ─► 3 ──┐
1 ──────┤            ├─► 6
        └─► 4 ─► 5 ──┘
```

**Parallel-safe:** `[2, 4]` once Step 1 lands; `[3, 5]` after that.
**Longest chain:** `1 → 2 → 3 → 6`.

Steps 2 and 3 are sequenced because both rewrite
`columns-schema/schema.ts` and `api/features/with-grouping/schema.ts` —
a file edge, not a compile one. Step 4 touches neither.
