---
title: UI Layer — Grouping (group row rendering)
type: architecture
version: 0.2
date: 2026-09-20
capability: grouping
spec: stub
code: none
audience: developers
---

# UI Layer — Grouping (group row rendering)

**State-layer contract: [`1-state/features/grouping.md`](../../1-state/features/grouping.md).
Decision history: [`decisions/grouping.md`](../../decisions/grouping.md).**

`spec: stub` / `code: none` is accurate and not a gap to close by writing a directive — the
scope decision below is that grouping needs none. What is genuinely undrilled is what a group
row _renders_, in the To Drill list at the bottom.

> **Rewritten 2026-09-20.** The previous version described an API that never shipped
> (`setGrouping(columnId)`, a `_buildRenderRows` override slot), claimed `withGrouping()` was
> unimplemented, and said a group's value comes from the column's `accessor`. All four were
> wrong. They are removed rather than corrected in place; the state-layer contract is the one
> source for API shape.

## Scope: no new directive

**Decided 2026-08-07, still holds.** Everything grouping needs at the directive level already
exists:

| Need                                    | Already covered by                                                                                                                                                                |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Distinguish a group row from a data row | `ngpTableRow`'s `data-row-kind` host binding (`core.md`)                                                                                                                          |
| Nesting indentation                     | `ngpTableRow`'s `data-depth` host binding (`core.md`)                                                                                                                             |
| Collapse/expand a group                 | `ngpTableTreeRow` + `ngpTableTreeToggle` ([`tree.md`](tree.md)) — collapsible grouping is `withGrouping()` + `withTree()`, a group collapses through `table.tree.toggle(groupId)` |
| Iterating group and data rows uniformly | `renderRows()` (`core.md`)                                                                                                                                                        |

**Rejected: an `ngpTableGroupBy` directive on `<th>`.** It would mirror `ngpTableSort`, but
`ngpTableSort` earns its existence by owning modifier-key detection, `aria-sort` and keyboard
activation. A group-by control owns none of that — it is one `table.grouping.update()` call the
consumer can wire to any control, in a toolbar as easily as a header.

A dynamic group-by panel reads `table.groupingLevels()` for the chip strip and
`table.isGroupedBy(id)` for a per-column toggle row. Both ship; neither needs a directive.

## What this file is for

The state layer defines _what_ an aggregate is, not how or where it renders. That question lands
here.

## To drill

Two of the five original items are now answered by decisions taken since.

- [ ] **Group row cell structure** — one `<td [attr.colspan]>` spanning the table, versus one
      `<td>` per visible column so each column's aggregate lands under its own column. Narrowed
      but not closed: [ADR-0022](../../adr/0022-render-row-cell-values.md)'s `buildGroupCells`
      spreads `aggregates` into column-id-keyed `cells`, which is the per-column shape — the
      remaining question is whether the shipped template default spans or not.
- [x] ~~`data-depth` to indentation~~ — answered by `--ngp-table-row-depth`, bound by
      `ngpTableRow` ([`core.md`](core.md)). Indent with
      `calc(var(--ngp-table-row-depth) * <step>)`; recipe in [`tree.md`](tree.md#styling-recipe).
- [ ] **Virtual scroll interaction** — group rows and data rows have different natural heights,
      but CDK's `itemSize` assumes a fixed one. Either group rows match data-row height, or
      grouping and virtual scroll are documented as not composing.
- [x] ~~Where the aggregate value comes from in the template~~ — answered by
      [ADR-0022](../../adr/0022-render-row-cell-values.md): `RenderRow.cells` is column-id-keyed
      and `buildGroupCells` spreads `aggregates` into it.
- [x] ~~Group label content~~ — answered by G36 and G39. The group value comes from the **row
      field**, never the column's `accessor`, optionally through `groupKey`. The label
      resolves explicit `label` on the `initial` entry → a matching column's label → the raw
      field name, and arrives on `RenderRow.groupKey` already resolved.
