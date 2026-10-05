# Decisions — NGP Table core directives

**Backfilled 2026-08-07.** The grill and spec stages ran as architecture-drilling sessions before this workspace existed, so their decisions live in the domain's own docs rather than here. This file is an index into them plus the backfill's own notes — it is not the primary record.

## Where the real decisions live

| Decision                                                                                                           | Recorded in                                                |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Store reaches directives via a required `[ngpTable]` input + `useExisting` self-provide, not `provideTableStore()` | `../../../directives/core.md` — "Store Connection Pattern" |
| `ngpTableRow` binds `RenderRow<TRow>`, not raw `TRow` and not a bare `RowId`                                       | `../../../directives/core.md` — "Directive: `ngpTableRow`" |
| Header `<tr>` carries no `ngpTableRow`                                                                             | `../../../directives/core.md`                              |
| Store owns the data contract; directives may override presentation only                                            | `../../../directives/columns.md` — "The Override Boundary" |
| `store.columns()` is unfiltered/unsorted — templates derive visible/order themselves                               | `../../../directives/columns.md`                           |
| Attribute-only directives; no custom Angular structural directives                                                 | `../../../overview.md` (locked)                            |
| State as `data-*` attributes, values as CSS custom properties                                                      | `../../../cross-cutting/styling-tokens.md`                 |
| Conditional `aria-label` only; one table-level `aria-live`, never per-cell                                         | `../../../cross-cutting/accessibility.md`                  |

## Backfill decisions (made 2026-08-07, in this session)

**Workspace root is the table domain path `libs/shared/design-system/src/ui/table`.** State is tracked at `docs/3-ui/work/core-directives/` (within the domain's own docs folder), not in a separate ticket tracker at repo root.

**Ticket lives at the table domain's own `docs/ticket.md` (and snapshots in `docs/work/<slug>/1-ticket.md`)** per `docs/agents/ticket-tracker.md`. The table is the owning domain for all four directives; no shared-ancestor placement needed.

**`checklist.grill` and `checklist.spec` marked `true` without those skills having run.** The drilling sessions produced what those stages produce — interviewed decisions with rejected alternatives, and a spec a developer can build against. Marking them `false` would send `/to-issues` back through work already done. Recorded here because the flags claim skill runs that never happened.

**`isComplex: true`.** Four directives, two DI tokens, a generic store type crossing the directive boundary as `unknown`, and a documented interaction with CDK virtual scroll.

**`specPath` points at `core.md` alone,** though the spec is split across `core.md` (three directives) and `columns.md` (the fourth). `state.json` holds one `specPath`; `core.md` is the larger share and links to `columns.md`. Anything reading `specPath` and stopping there will miss `ngpTableColumn` — read both.

## Deliberately deferred (not decisions, open questions)

These are recorded as open in `../../../architecture.md` and must **not** be resolved by whoever implements this ticket:

- `ColumnDef` presentation fields (`width`, `label`) — keeps `[ngpColumnWidth]` out of scope
- Custom header/cell template mechanism (`ngpColumnHeader`-style)
- Row height / CDK `itemSize` value
- `aria-live` status message ownership — deferred by decision, blocks nothing
