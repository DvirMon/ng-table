# Implementation Progress — NGP Table — withGrouping() group-scoped row access (rowsOf)

**Issue:** #31
**Status:** 0 / 5 complete

| Step | Title                                 | Status  | PR  |
| ---- | ------------------------------------- | ------- | --- |
| 1    | renderRows on TableCore               | ✅ done | —   |
| 2    | rowsBeneathGroup() pure engine walk   | ✅ done | —   |
| 3    | rowsOf member on withGrouping()       | ✅ done | —   |
| 4    | rowsOf test coverage                  | ✅ done | —   |
| 5    | Docs: rowsOf on the grouping contract | ✅ done | —   |

**Graph:** Steps 1 and 2 are parallel-safe; 3 depends on both; 4 and 5 depend on 3 and are
parallel-safe with each other.

```
1 (core.renderRows) ─┐
                     ├─→ 3 (rowsOf member) ─┬─→ 4 (tests)
2 (engine walk) ─────┘                      └─→ 5 (docs)
```
