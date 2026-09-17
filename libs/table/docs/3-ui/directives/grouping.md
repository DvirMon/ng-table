---
title: UI Layer — Grouping (group row rendering)
type: architecture
version: 0.1
date: 2026-08-07
capability: grouping
spec: stub
code: none
audience: developers
---

# UI Layer — Grouping (group row rendering)

## Status

**Scope decided 2026-08-07:** `withGrouping()` gets a UI-layer file but **no new directive**. Not yet drilled.

## Why No Directive

Everything grouping needs at the directive level already exists:

| Need | Already covered by |
|---|---|
| Distinguish a group `<tr>` from a data `<tr>` | `ngpTableRow`'s `data-row-kind` host binding (`core.md`) |
| Nesting indentation | `ngpTableRow`'s `data-depth` host binding (`core.md`) |
| Collapse/expand a group | `ngpTableExpandToggle` (`expansion.md`) — `withGrouping()` delegates collapse state to `withExpansion()`'s `expandedRows`, and a group id is just a synthetic `RowId` |
| Iterating group + data rows uniformly | `renderRows()` (`virtual-scroll.md`, `core.md`) |

Rejected: an `ngpTableGroupBy` directive on `<th>` calling `setGrouping(columnId)`. It would mirror `ngpTableSort`, but `ngpTableSort` earns its existence by owning modifier-key detection, `aria-sort`, and keyboard activation — a group-by control owns none of that; it is one setter call the consumer can wire to any control they like, in a toolbar as easily as a header.

## What This File Is Actually For

The unanswered question grouping leaves behind is **what a group row renders**, which `1-state/features/grouping.md` explicitly punts on ("purely a computed value — it defines *what* the aggregate is, not how/where it's rendered (that's UI-layer/template concern)"). No UI-layer file picks that up today; this one is where it lands.

## Known Blocker

The render seam exists — [#10](https://github.com/DvirMon/ng-table/issues/10) landed 2026-08-07, giving the core store `renderRows()` plus the `_buildRenderRows` override slot `withGrouping()` is meant to fill. But nothing emits `kind: 'group'` yet: `withGrouping()` itself is unimplemented, so the default 1:1 wrap is the only builder that exists. This file can be drilled on paper now; its examples can't be verified against a running table until `withGrouping()` ships.

## To Drill

- [ ] **Group row cell structure** — a single `<td [attr.colspan]>` spanning the table with a label, versus one `<td>` per visible column so each column's `aggregateFn` result lands under its own column. These are mutually exclusive layouts and the choice drives what `RenderRow.aggregates` must be keyed by.
- [ ] **Where the aggregate value comes from in the template** — `RenderRow.aggregates` is typed as optional in `with-grouping.md`'s sketch and its key shape is unspecified. Pin it to `Record<columnId, unknown>` or similar before writing examples.
- [ ] **`data-depth` to indentation** — CSS custom property driven off the attribute, or a consumer-authored style rule? Belongs with `styling-tokens.md`'s catalog session.
- [ ] **Virtual scroll interaction** — group rows and data rows have different natural heights, but CDK's `itemSize` assumes a fixed one (`virtual-scroll.md`). Either group rows match data-row height, or grouping and virtual scroll are documented as not composing.
- [ ] **Group label content** — the group's value is `unknown` (it comes from `accessor`), so rendering it as text needs either a per-column formatter or a consumer-supplied template. Overlaps `columns.md`'s open custom-cell-template question.
