# Decisions — generic table host

Relocated from [ADR-0005](../../../adr/0005-generic-table-host.md), which is trimmed to its
decision per doc-contracts/adr.md — open questions live here instead.

## Open questions

- Does the row-reorder FLIP animation (`docs/3-ui/directives/row-animation.md`) still need the
  div-grid escape hatch at all, now that FLIP transforms directly on `<tr>` (commit `6d6a70d`)
  may have resolved the original native-`<tr>` transform-quirk motivation? Verify before
  implementing the div path.
- `role="table"` vs `role="grid"` — CDK's own upstream has an open issue (#22122) that
  `role="grid"` is wrong for non-interactive tables. Decide per-table based on actual
  interactivity (sortable/selectable cells), not a fixed default.
