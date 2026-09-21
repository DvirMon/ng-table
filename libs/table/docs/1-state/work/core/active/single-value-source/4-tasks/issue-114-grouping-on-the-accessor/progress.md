# Implementation Progress — Table: grouping reads the accessor; levels and aggregates key by column id

**Issue:** #114
**Status:** 0 / 9 complete

| Step | Title | Status | PR |
|---|---|---|---|
| 1 | Grouping ids validate at construction and on the writer | ⬚ pending | — |
| 2 | Both cluster walks read the accessor | ⬚ pending | — |
| 3 | Re-key the grouping surface to `TId` | ⬚ pending | — |
| 4 | `applyAggregate` keys by column id | ⬚ pending | — |
| 5 | Delete the raw-name label tier and the levels filter | ⬚ pending | — |
| 6 | The two-walks gate spec | ⬚ pending | — |
| 7 | The public-surface spec | ⬚ pending | — |
| 8 | Stories and fixtures migrate | ⬚ pending | — |
| 9 | Docs, decisions and `llms.txt` | ⬚ pending | — |

## Execution graph

```
1 ──► 2  walks read the accessor
1 ──┐
2 ──┴► 5  delete label fallback + levels filter
3 ──► 4  applyAggregate by column id

2,3     ──► 6  engine gate spec
1,3,4,5 ──► 7  public-surface spec
3,4,5   ──► 8  stories + fixtures ──► 9  docs
```

**Parallel-safe:** `[1, 3]` to start, then `[2, 4]`, then `[6, 7]`.
**Longest chain:** `3 → 4 → 8 → 9`.

## Notes

- **The tree is red between steps, by design.** Step 1's throw
  invalidates existing spec and story fixtures; Step 3 breaks
  `src/stories/**` until Step 8. Each step file says which run is
  expected to fail and which must stay clean — do not soften a check to
  get a green run early.
- **`nx run shared-table:typecheck` runs twice** wherever templates are
  in scope (Steps 8 and 9). `ngc` aborts at the first `.ts` error before
  reaching the template phase, so only a source-clean second run says
  anything about the story hosts.
- **One ruling was made while planning**, 2026-09-21: an unknown column
  id throws on **both** the declaration path and `table.grouping`'s
  writer. It has no AC of its own on the issue — Step 7 makes it binding
  and Step 9 registers it as a G-number.
