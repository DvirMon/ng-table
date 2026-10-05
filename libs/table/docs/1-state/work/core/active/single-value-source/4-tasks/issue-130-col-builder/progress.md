# Implementation Progress — `col()` builder and `ColumnSet` exist, unused

**Issue:** [#130](https://github.com/DvirMon/ng-table/issues/130)
**Status:** 4 / 4 complete

| Step | Title                                        | Status  | PR  |
| ---- | -------------------------------------------- | ------- | --- |
| 1    | Declaration types and the data-first builder | ✅ done | —   |
| 2    | Runtime spec: `create-columns.spec.ts`       | ✅ done | —   |
| 3    | Type proofs: `create-columns.types.spec.ts`  | ✅ done | —   |
| 4    | Record the probe answers                     | ✅ done | —   |

## Graph

```
1 ──┬──► 2
    └──► 3 ──► 4
```

Parallel-safe: [2, 3] after 1. Dependency: 1 → 3 → 4.

## Scope note

Data first is the only call form (`decisions.md` R9,
2026-09-24): the builder-first form was dropped because
`(data, build)` and `(build, schemaFn)` are indistinguishable
at runtime without invoking `data`. The curried
`createColumns<TRow>()` stays until #138 rewrites its callers.
