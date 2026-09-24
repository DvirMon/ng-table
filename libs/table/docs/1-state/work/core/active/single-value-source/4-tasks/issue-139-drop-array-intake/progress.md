# Implementation Progress — Contract: delete the array intake

**Issue:** [#139](https://github.com/DvirMon/ng-table/issues/139)
**Status:** 5 / 5 complete

| Step | Title | Status | PR |
|---|---|---|---|
| 1 | Move specs off `resolveColumnsConfig` | ✅ done | — |
| 2 | `TableConfig` takes a `ColumnSet` only | ✅ done | — |
| 3 | Generator constraint, regenerated | ✅ done | — |
| 4 | Array-rejection proofs: `create-table.types.spec.ts` | ✅ done | — |
| 5 | Record the ruling | ✅ done | — |

## Graph

```
1 ──► 2 ──┬──► 3
          ├──► 4
          └──► 5
```

Parallel-safe: [3, 4, 5] after 2.
Dependency: 1 → 2.

## Gate

#137 (specs, mocks, fixtures) was still open when this plan was
written. Don't start Step 1 until it closes. The compiler's
census in Step 2 is only meaningful once every known caller
has moved.

## Scope note

Shaping ruling (2026-09-24): the compile step folds into the
intake, and `resolve.ts` is deleted. `ColumnDefInput` stays as
the resolved-input shape.
