# Implementation Progress — RenderRow.parentId + engine-owned prune stage

**Issue:** #132
**Status:** 7 / 7 complete

| Step | Title | Status | PR |
|---|---|---|---|
| 1 | ADR-0017: engine-owned descendant prune | ✅ done | — |
| 2 | `RenderRow.parentId` + both synthesizing stages stamp it | ✅ done | — |
| 3 | Accumulating `collapsedRows` slot + feature plumbing | ✅ done (renamed `expandedRows`) | — |
| 4 | `'prune'` stage + engine wiring | ✅ done | — |
| 5 | Engine tests — prune position, no-op, two contributors | ✅ done | — |
| 6 | Feature + compile-time tests — `parentId` on both paths | ✅ done | — |
| 7 | Mark D11 and ADR-0011 superseded | ✅ done | — |

## Dependency graph

```
1 ──┬──▶ 3 ──┐
    │        ├──▶ 4 ──┬──▶ 5
    └──▶ 7   │        └──▶ 6
2 ───────────┘        ▲
└─────────────────────┘
```

- **Parallel-safe:** `[1, 2]` at the start; `[3, 7]` once 1 lands; `[5, 6]` once 4 lands.
- **Dependency chain:** `1 → 3 → 4 → {5, 6}` and `2 → 4`.
- Steps 2 and 3 both edit `api/features/with-expansion.ts`, so they are **sequential despite no
  logical edge** — 2 stamps `parentId`, 3 declares the slot. Whichever runs second absorbs a
  trivial merge.

## Notes

- **Step 1 gates Step 3's type.** The ADR settles `collapsedRows` polarity (expanded-set vs
  collapsed-set), which fixes the slot's name and semantics. Do not start Step 3 from the
  architecture doc's sketch alone.
- **No pagination feature exists.** `'paginate'` is a reserved `RENDER_ORDER` slot with nothing
  behind it, so #132's "page size counts visible rows" criterion is covered structurally in
  `render-stages.spec.ts` with a fake transform. The real-feature assertion belongs to whoever
  builds `withPagination()`.
- **Behavior must not change.** Grouping keeps its own prune throughout (D6); every pre-existing
  test passes unedited. Deleting grouping's prune is #133.
- Verification is run manually by the repo owner: `nx run shared-table:typecheck`,
  `nx run shared-table:typecheck-spec`, `nx test shared-table`, and the grouping Storybook entry.
