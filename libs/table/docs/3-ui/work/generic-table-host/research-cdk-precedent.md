# Research relocated from ADR-0005 (D7, trim-docs #46)

CDK Table / TanStack / WAI-ARIA investigation that informed
[ADR-0005](../../../adr/0005-generic-table-host.md)'s decision to inject ARIA roles
unconditionally regardless of host tag.

Angular CDK Table (`@angular/cdk/table`, `table.ts`/`row.ts`/`cell.ts`, confirmed against
source) already solves this exact problem:

- One component, two selector forms: `cdk-table, table[cdk-table]` — same directive/selector
  set handles both native `<table>` and div-flex mode. The consumer picks the shape by which
  tags they write, not by runtime auto-detection.
- CDK does check host tag (`_isNativeHtmlTable = nodeName === 'TABLE'`), but that flag only
  gates whether `<thead>/<tbody>/<tfoot role="rowgroup">` structural wrapper markup renders —
  it does not gate ARIA.
- Roles are set unconditionally, even on native `<table>`/`<tr>`/`<td>`:
  `setAttribute('role', 'table')` always runs; row/cell directives hardcode `role="row"` /
  `role="cell"` / `role="columnheader"` / `role="gridcell"` regardless of tag. Source comment:
  "we set role='cell' even on native td elements, because some browsers seem to require it"
  (`cell.ts`, referencing angular/components#29784).
- Cell role (`columnheader` vs `cell`) is decided by separate directive classes (`CdkHeaderCell`
  vs `CdkCell`, distinct selectors `th[cdk-header-cell]` vs `td[cdk-cell]`), not a shared
  directive with a boolean input.

TanStack Table: fully headless, renders zero DOM and injects zero ARIA — no relevant prior art
for role injection; third-party guides pair it with a separate a11y-primitives library instead
of reimplementing roles.

WAI-ARIA APG: no documented pattern for runtime tag-detection to conditionally skip roles. An
explicit role matching an implicit native role is a documented no-op, not a conflict — consistent
with CDK's practice of always setting it.
