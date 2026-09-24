# Implementation Progress — Construction checks relocate into `createColumns` and go dev-only

**Issue:** [#132](https://github.com/DvirMon/ng-table/issues/132)
**Status:** 5 / 5 complete

| Step | Title | Status | PR |
|---|---|---|---|
| 1 | Split the shared body; gate the construction half | ✅ done | — |
| 2 | Move the checks into `createColumns` | ✅ done | — |
| 3 | Construction-check specs | ✅ done | — |
| 4 | G76 split specs | ✅ done | — |
| 5 | Record it | ✅ done | — |

## Graph

```
1 ──┬──────────► 4 ──┐
    └──► 3 ◄── 2     ├──► 5
         └───────────┘
```

Parallel-safe: [1, 2] at start; [2, 4] once 1 is done;
[3, 4] once 1 and 2 are done.
Dependency: {1, 2} → 3 → 5; 1 → 4 → 5.

## Notes

- **Grouping's two throw sites used the same function body
  (verified 2026-09-24).** `with-grouping/feature.ts:112`
  and `:169` both call `assertDeclarationsAreKnown`. Step 1
  splits them before the gate is added.
- **Gate placement (2026-09-24, R7 applied):** each check
  gates inside its own body, never at a call site.
- `typecheck-spec` fails from Step 2 until Step 3 lands.
