# ADR-0005 — Generic table host: native `<table>` and `<div>` grid, one directive set

**Status:** proposed
**Date:** 2026-08-17
**Supersedes:** the "Native `<table>` only" locked invariant in `src/ui/table/CLAUDE.md`
**Related:** [ADR-0004](0004-table-source-layout.md) (directive folder this touches),
`docs/3-ui/cross-cutting/accessibility.md` (ARIA principles this extends). Research:
[`research-cdk-precedent.md`](../3-ui/work/generic-table-host/research-cdk-precedent.md).
Open questions: [`3-ui/work/generic-table-host/2-decisions.md`](../3-ui/work/generic-table-host/2-decisions.md).

Row-reorder animation work needs consumers able to lay out rows as `<div>`-based grids
(flex/grid CSS), not only native `<table>`/`<tr>`/`<td>` — but the existing directives are
tag-scoped selectors relying entirely on native HTML table semantics for accessibility. One
directive set now serves both host kinds, injecting ARIA roles unconditionally regardless of
tag, matching Angular CDK Table's own implementation.

## Decision

1. **Drop the "Native `<table>` only" invariant.** Directive selectors become dual-tag:
   `table[ngpTable], div[ngpTable]`; `tr[ngpTableRow], div[ngpTableRow]`;
   `th[ngpTableHeaderCell], div[ngpTableHeaderCell]` (**new**); `td[ngpTableCell], div[ngpTableCell]` (**new**).
2. **No native-vs-div tag detection for accessibility.** Roles (`table`/`row`/`columnheader`/`cell`)
   are static host metadata, applied unconditionally — a redundant role on a native element is a
   WAI-ARIA no-op, not a duplicate announcement.
3. **Header cell and data cell are separate directives**, not one with an `isHeader` boolean —
   the selector alone encodes intent, and header-only concerns (`aria-sort`) never leak onto the
   data-cell directive's public API. Matches CDK's `CdkHeaderCell`/`CdkCell` split.
4. **Structural tag-detection stays, scoped to layout only** (e.g. whether `<thead>/<tbody>`
   wrapper markup is expected), never to accessibility.

## Consequences

- **New fields, not yet implemented:** `RenderRow.index` (`aria-rowindex` — div-grid loses the
  free DOM-order inference native `<table>` gives) and a `totalRowCount` member on `TableStore`
  (`aria-rowcount` under virtualization/pagination).
- Every existing directive spec gains div-host test cases alongside native-table ones.
- `aria-rowindex`/`aria-colindex`/`aria-rowcount`/`aria-colcount` must stay in sync with actual
  render order — a real risk once row-reorder animation (FLIP transforms) moves DOM position
  independent of these derived values.
- `src/ui/table/CLAUDE.md`'s locked-invariants section needs updating to remove "Native
  `<table>` only" and reference this ADR.
