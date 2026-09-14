# ADR-0005 — Generic table host: native `<table>` and `<div>` grid, one directive set

**Status:** proposed
**Date:** 2026-08-17
**Supersedes:** the "Native `<table>` only" locked invariant in `src/ui/table/CLAUDE.md`
**Related:** [ADR-0004](0004-table-source-layout.md) (directive folder this touches), `docs/3-ui/cross-cutting/accessibility.md` (ARIA principles this extends)

## Context

Row-reorder animation work (`docs/3-ui/directives/row-animation.md`) surfaced a need for
consumers to lay out rows as `<div>`-based grids (flex/grid CSS) instead of native
`<table>`/`<tr>`/`<td>`, primarily for animation flexibility. The existing directives
(`ngp-table.directive.ts`, `ngp-table-row.directive.ts`) are tag-scoped selectors
(`table[ngpTable]`, `tr[ngpTableRow]`) that rely entirely on native HTML table semantics for
accessibility — they do not attach to `<div>` hosts at all, and provide no ARIA of their own.

Options considered, in order of discussion:

1. **Two separate directive sets** (one native-table-only, one div-grid-only) — rejected:
   duplicates maintenance, consumer must pick a whole different API depending on host choice.
2. **One directive, runtime tag-detection, skip ARIA when native** — rejected after research
   (below): no prior art supports "detect and skip"; adds a branch for no verified benefit.
3. **One directive, always injects ARIA roles unconditionally, regardless of host tag** —
   adopted. Matches Angular CDK Table's actual implementation.

## Research

Angular CDK Table (`@angular/cdk/table`, `table.ts`/`row.ts`/`cell.ts`, confirmed against
source) already solves this exact problem:

- One component, two selector forms: `cdk-table, table[cdk-table]` — same directive/selector
  set handles both native `<table>` and div-flex mode. The consumer picks the shape by which
  tags they write, not by runtime auto-detection.
- CDK does check host tag (`_isNativeHtmlTable = nodeName === 'TABLE'`), but that flag only
  gates whether `<thead>/<tbody>/<tfoot role="rowgroup">` **structural wrapper markup** renders
  — it does not gate ARIA.
- Roles are set **unconditionally**, even on native `<table>`/`<tr>`/`<td>`:
  `setAttribute('role', 'table')` always runs; row/cell directives hardcode `role="row"` /
  `role="cell"` / `role="columnheader"` / `role="gridcell"` regardless of tag. Source comment:
  *"we set role='cell' even on native td elements, because some browsers seem to require it"*
  (`cell.ts`, referencing angular/components#29784).
- Cell role (`columnheader` vs `cell`) is decided by **separate directive classes**
  (`CdkHeaderCell` vs `CdkCell`, distinct selectors `th[cdk-header-cell]` vs `td[cdk-cell]`),
  not a shared directive with a boolean input.

TanStack Table: fully headless, renders zero DOM and injects zero ARIA — no relevant prior art
for role injection; third-party guides pair it with a separate a11y-primitives library instead
of reimplementing roles.

WAI-ARIA APG: no documented pattern for runtime tag-detection to conditionally skip roles. An
explicit role matching an implicit native role is a documented no-op, not a conflict — consistent
with CDK's practice of always setting it.

## Decision

1. **Drop the "Native `<table>` only" invariant.** Directive selectors become dual-tag:
   - `table[ngpTable], div[ngpTable]`
   - `tr[ngpTableRow], div[ngpTableRow]`
   - `th[ngpTableHeaderCell], div[ngpTableHeaderCell]` — **new directive**
   - `td[ngpTableCell], div[ngpTableCell]` — **new directive**

2. **No native-vs-div tag detection for accessibility.** Roles are static host metadata,
   applied unconditionally: `role: 'table'` / `role: 'row'` / `role: 'columnheader'` /
   `role: 'cell'`. A redundant role on a native element is a no-op per WAI-ARIA, not a
   duplicate announcement — confirmed against CDK's own rationale.

3. **Header cell and data cell are separate directives**, not one directive with an
   `isHeader` boolean input. Reasons: selector alone encodes intent (no forgettable input, no
   wrong-default risk); header cell carries header-only future concerns (`aria-sort`,
   sort-trigger affordance) that shouldn't appear on the data-cell directive's public API;
   matches CDK's own `CdkHeaderCell`/`CdkCell` split.

4. **Structural tag-detection stays, scoped to layout only** (not accessibility) — e.g.
   whether `<thead>/<tbody>` wrapper markup is expected, matching CDK's `_isNativeHtmlTable`
   usage. This is a template-structure concern, not an ARIA concern.

## Consequences

**New fields required, not yet implemented:**
- `RenderRow.index` (`api/types.ts`) — needed for `aria-rowindex`, since div-grid loses the
  free DOM-order inference native `<table>` gives.
- `totalRowCount` on `TableStore` (`engine/types.ts`) — needed for `aria-rowcount` when
  virtualized/paginated (rendered count ≠ total count). A feature claims it legitimately because
  the engine deliberately leaves it out of its core pre-claim ([ADR-0007](0007-feature-member-claims.md)'s
  2026-09 amendment, #67), so a server-paged table reports the true total without an engine change.

**Gained**
- Single directive/selector set serves both native-table and div-grid consumers — no forked API.
- Matches a proven, actively-maintained prior-art implementation (CDK Table) rather than
  inventing an unverified pattern.

**Cost**
- Every existing directive spec (`ngp-table.directive.spec.ts`, `ngp-table-row.directive.spec.ts`)
  gains div-host test cases alongside native-table ones.
- `aria-rowindex`/`aria-colindex`/`aria-rowcount`/`aria-colcount` must stay in sync with actual
  render order — a real risk once row-reorder animation (FLIP transforms) changes DOM position
  independent of these derived values. Not yet verified against the FLIP work in
  `docs/3-ui/directives/row-animation.md`.
- `src/ui/table/CLAUDE.md`'s locked-invariants section needs updating to remove "Native
  `<table>` only" and reference this ADR.

## Open questions

- [ ] Does the row-reorder FLIP animation (`docs/3-ui/directives/row-animation.md`) still need
  the div-grid escape hatch at all, now that FLIP transforms directly on `<tr>` (commit
  `6d6a70d`) may have resolved the original native-`<tr>` transform-quirk motivation? Verify
  before implementing the div path.
- [ ] `role="table"` vs `role="grid"` — CDK's own upstream has an open issue (#22122) that
  `role="grid"` is wrong for non-interactive tables. Decide per-table based on actual
  interactivity (sortable/selectable cells), not a fixed default.
