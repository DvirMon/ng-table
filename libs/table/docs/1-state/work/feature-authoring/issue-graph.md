# Issue graph — feature-authoring epic (#102)

Epic: [#102](https://github.com/DvirMon/ng-table/issues/102) —
open registration for in-house pipeline/render stages (ADR-0020).

## Nodes

| # | Title | Slice slug | Depends on | Blocks |
|---|---|---|---|---|
| [#152](https://github.com/DvirMon/ng-table/issues/152) | Table: export the feature-author surface from @ngp/table | export-author-surface | — | 157 |
| [#153](https://github.com/DvirMon/ng-table/issues/153) | Table: probe stage-registry declaration merging through ngc + barrel | registry-merge-probe | — | 155 |
| [#154](https://github.com/DvirMon/ng-table/issues/154) | Table: stage rule form replaces the object form for built-in claims | stage-rule-claims | — | 155, 156 |
| [#155](https://github.com/DvirMon/ng-table/issues/155) | Table: declared stages — anchors, ordering and dev checks | declared-stages | 153, 154 | 157 |
| [#156](https://github.com/DvirMon/ng-table/issues/156) | Table: runtime row-id checks on render stages | runtime-row-id-checks | 154 | 157 |
| [#157](https://github.com/DvirMon/ng-table/issues/157) | Table: feature-authoring guide and stage-doc amendments | feature-authoring-guide | 152, 155, 156 | — |

The slice slug is what `/to-tasks` uses in the issue's branch
name, `<type>/<NN>-<slice-slug>`.

## Graph

```
152 -----------------------+
                            |
153 ----+                   |
        v                   v
154 --> 155 --------------> 157
   \                         ^
    +-> 156 ----------------+
```

## Summary

- **Parallel-safe:** #152, #153, #154 (no edges between them).
  After #154, #155 (once #153 is also done) and #156 run in
  parallel — both extend #154's rule form and fold, disjoint
  concerns (ordering/dev checks vs runtime reporting).
- **Sequenced:** #153 → #155 (gated on literal vs `string`
  declared names); #154 → #155 and #154 → #156 (gated on the
  `stageSchema`/`stage` rule form and the resolved-order fold);
  #152 + #155 + #156 → #157 (the guide documents all three).
- **Starting frontier:** #152, #153, #154. Note #155 is
  `needs:grill` (two questions in its body).

## Source

Edges user-confirmed 2026-09-26 in `/to-issues`, derived from
`2-spec.md` and `3-architecture.md` § Dependency notes for
slicing. Related docs: `plan.md`, `2-spec.md`,
`3-architecture.md`, ADR-0020.
