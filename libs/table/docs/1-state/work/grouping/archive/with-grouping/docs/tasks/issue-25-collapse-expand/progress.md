# Implementation Progress — NGP Table — withGrouping() collapse/expand via withExpansion()

**Issue:** #25
**Status:** 0 / 5 complete

| Step | Title | Status | PR |
|---|---|---|---|
| 1 | Render-stage collapse (engine) | ✅ done | — |
| 2 | Collapse-independent rowsOf (engine) | ✅ done | — |
| 3 | Wire withGrouping() | ✅ done | — |
| 4 | Tests | ✅ done | — |
| 5 | Docs | ✅ done | — |

**Graph:** Steps 1 and 2 are parallel-safe; 3 depends on both; 4 depends on 3; 5 depends on 3 and
is parallel-safe with 4.

```
1 (render-stage collapse) ─┐
                            ├─→ 3 (wire withGrouping()) ─┬─→ 4 (tests)
2 (rowsOf collapse-indep) ─┘                             └─→ 5 (docs)
```
