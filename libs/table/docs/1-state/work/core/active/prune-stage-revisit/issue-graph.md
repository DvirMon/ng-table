# Issue graph — prune-stage-revisit epic (#105)

Epic: [#105](https://github.com/DvirMon/ng-table/issues/105) — render stages exchange a nested
node tree; an engine-owned flatten walk replaces the terminal `'prune'` stage (supersedes
ADR-0017 D2).

## Nodes

| # | Title | State | Depends on | Blocks |
|---|---|---|---|---|
| [#106](https://github.com/DvirMon/ng-table/issues/106) | Drop the unclaimed `'paginate'` render stage | 🟡 OPEN · `ready-for-agent` | — | #107 |
| [#107](https://github.com/DvirMon/ng-table/issues/107) | Render stages exchange a nested node tree; a flatten walk replaces the prune | 🟡 OPEN · `needs:tasks` | #106 | #108, #109 |
| [#108](https://github.com/DvirMon/ng-table/issues/108) | Group headers report expansion through `row.isExpanded` | 🟡 OPEN · `ready-for-agent` | #107 | — |
| [#109](https://github.com/DvirMon/ng-table/issues/109) | Record the tree-shaped render IR across the ADR set | 🟡 OPEN · `needs:grill` | #107 | — |

## Graph

```
#106  drop 'paginate'          (prefactor)
  │
  ▼
#107  nested node IR + flattenVisible
  │   RenderNode · RenderNodeTransform · mapNodes
  │   four prune constructs deleted
  ├──────────────┐
  ▼              ▼
#108           #109
row.isExpanded  ADR set
in stories      (new ADR, 0011 amend,
 + MDX           0020 in place)
```

## Summary

- **Parallel-safe:** #108 and #109. No edge between them; they touch disjoint files (story
  host + MDX vs. `docs/adr/`) and share only #107 upstream.
- **Sequenced:**
  - #106 → #107, gated on `RENDER_ORDER` and `render-stages.spec.ts`: #106 removes an entry
    and its fake-stage fixtures from exactly the two files #107 rewrites wholesale.
  - #107 → #108, gated on the field itself: group headers carry no `isExpanded` until the
    flatten walk stamps it (D1), so the template migration has nothing to read before then.
  - #107 → #109, gated on shipped-vs-described: an ADR recording the IR must not land
    before the IR does.
- **Current frontier:** **#106** — the only issue with no open blocker.

### Why #107 is one issue and not three

The stage signature changes from a row transform to a node transform, so `engine/grouping/render.ts`
and `api/features/with-expansion.ts` must move in the same commit or nothing compiles. Staging it
expand–contract would mean teaching the fold both shapes — more machinery than a change whose
whole point is deleting machinery.

D1 (uniform `isExpanded`) is also not separable from #107: `flattenVisible` stamps it by
construction, and the `'tree'` stage stops reading `expandedRows` entirely, so a #107 that
skipped the stamp would leave tree rows without the field. Only the **consumer migration** is
separable, and that is #108.

### The one open question in the epic

#109 carries it, scoped to itself: with `'paginate'` (#106) and `'prune'` (#107) both gone,
ADR-0020 D2's anchor set has **no post-flatten anchor at all**. Add one deliberately or state
there is none — either way the edit has to say which. #106, #107 and #108 are unaffected.

## Source

Edges user-confirmed 2026-09-20 via `/to-issues`, re-derived at execution grain from
`1-decisions.md`'s node ranking (which ordered *discussion*, not *build* — the grilling ranking
had `'paginate'` ownership as a leaf, but at build grain it gates the file #107 rewrites).
Titles, states and labels pulled from `gh issue view` on 2026-09-20.

Related docs: [`2-spec.md`](2-spec.md) · [`3-architecture.md`](3-architecture.md) ·
[`1-decisions.md`](1-decisions.md).
