---
title: Tree UI layer — decisions
type: decisions
ticket: "#165"
date: 2026-09-30
audience: developers
---

# Tree UI layer — decisions (#165)

Scoped to #165. One-line decisions, dated. Cross-ticket tree
decisions also get a `TR`-row in
[`decisions/tree.md`](../../../../../decisions/tree.md).

## Dependency ranking (2026-09-30)

| Node | Sub-feature | Depends on | Rank |
|---|---|---|---|
| N1 | Directive family — which directives carry tree UI; fate of `expansion.md`'s tree path | — | core |
| N3 | Treegrid role on the table host and cells | N1 | dependent |
| N2 | Row semantics — `aria-level`, `aria-expanded` ownership, `data-*` presence hooks | N1, N3 | dependent |
| N4 | Row toggle — activation, keyboard, disabled, host variants | N1 | dependent |
| N5 | Indentation — `data-depth` to a CSS value / shipped sheet | N2 | dependent |
| N6 | Context-row styling beyond the `data-context-row` hook | N5 | dependent |
| N7 | Group-header rows in a tree + grouping table | N1, N4 | dependent |
| N8 | Treegrid keyboard navigation (arrow keys) | N3, N4 | dependent |

## Decisions

- **D1** (2026-09-30, N1) — Tree UI is a tree-only directive pair: `ngpTableTreeRow` grows into the row's semantics and `data-*` hooks; a new `ngpTableTreeToggle` activates `table.tree.toggle()`. `expansion.md`'s `ngpTableExpandable`/`ngpTableExpandToggle` narrow to detail panels only — after ADR-0012 the tree and the panel no longer share a store, so a shared toggle would have to resolve which feature it serves.
- **D2** (2026-09-30, N3) — A tree table stays `role="table"`; `aria-expanded` lives on the `ngpTableTreeToggle` button (disclosure pattern), rows carry no `aria-level`/`aria-expanded`, depth goes out as `data-depth` only. Core `ngpTableRow`'s row `aria-expanded` binding is removed — row `aria-expanded` is treegrid-only (MDN, row role). Treegrid (role, `gridcell`, `aria-level`, APG arrow-key focus — N3 + N8) is a separate, table-wide issue with its own ADR: `treegrid` promises an interaction model every capability must live inside, so one feature doesn't set it.
- **D3** (2026-09-30, N2) — `ngpTableTreeRow` emits presence attributes `data-expandable` (from `RenderRow.hasChildren`) and `data-expanded` (from `isExpanded`), alongside the existing `data-context-row`; `data-depth` stays on core. Named `data-expandable`, not `data-has-children`: `hasChildren` is overridden by `isExpandable`, so a lazy parent with no loaded children is expandable but has no children — the hook names what styling keys on (a toggle shows), not the field.
- **D4** (2026-09-30, N4) — `ngpTableTreeToggle` selector is `button[ngpTableTreeToggle]` only. Native click/Enter/Space and focus; `aria-expanded` valid on it (D2); no `isNativelyInteractive` branch, no nesting guard. A whole-row mouse trigger stays consumer `(click)` on the `<tr>` calling `table.tree.toggle(row.id)` — a `<tr>` host would add a stray focus stop per row and cannot carry a valid `aria-expanded` in `role="table"`.
- **D5** (2026-09-30, N2) — No attribute is bound by two directives on one element. Ownership after #165: core `ngpTableRow` — `role`, `data-row-kind`, `data-depth`, `aria-rowindex`; `ngpTableTreeRow` — `data-expandable`, `data-expanded`, `data-context-row`; `ngpTableTreeToggle` (on the button, not the row) — `aria-expanded`, plus its own hooks. Core's `aria-expanded` binding is deleted (D2), not shadowed, so no two host bindings race on one attribute.
- **D6** (2026-09-30, N4) — On a non-expandable row, `ngpTableTreeToggle` sets `disabled`, `aria-hidden="true"` and presence `data-disabled`: out of tab order and the accessibility tree, while a `visibility: hidden` rule keeps its width so leaf labels align with parent labels (product 2.6: no toggle that does nothing). A consumer may still `@if` it away.
- **D7** (2026-09-30, N4) — The toggle's accessible name is consumer-owned; the library ships no text. Under `ngDevMode`, the directive warns once when its button has no accessible name (no `aria-label`, `aria-labelledby`, or text content). A library label would open a first i18n surface, and a state-changing label on top of `aria-expanded` announces the state twice.
- **D8** (2026-09-30, N4) — `ngpTableTreeToggle` on a table composed without `withTree()` is a wiring error (ADR-0014): it throws on first render under `ngDevMode`, naming the directive and the missing feature; stripped in production, where the toggle is inert. `NGP_TABLE_STORE` is type-erased, so the check is runtime. A missing `ngpTableTreeRow` on the `<tr>` is not an error — the toggle reads the row from `NGP_TABLE_ROW` and works without it.
- **D9** (2026-09-30, N5) — Core `ngpTableRow` binds the output custom property `--ngp-table-row-depth` from the required `depth` field (ADR-0026 rule 2), beside `data-depth`. Consumers indent with one rule, `calc(var(--ngp-table-row-depth) * <step>)`; typed `attr()` is Chromium-only, and `data-depth` alone forces one selector per depth. Core owns it because `depth` is required (RenderRow field ownership); it serves grouping's indentation too. Implementation must verify `[style.--ngp-table-row-depth]` binds (ADR-0026 Consequences: "untested").
- **D10** (2026-09-30, N5/N6) — #165 ships no stylesheet. The tree's styling surface is the `data-*` hooks (D3, D6) plus core's `--ngp-table-row-depth` (D9); the library stays primitive, with ng-primitives as the reference. The CSS — toggle self-indenting off the inherited depth variable, chevron rotation on `[data-expanded]`, `visibility: hidden` on `[data-disabled]` leaves, context-row dimming — is a consumer-owned "Styling recipe" in the tree UI spec. No `data-tree-toggle` hook: it existed only so a shipped sheet could avoid directive selectors; consumer CSS selects `[ngpTableTreeToggle]`.
- **D11** (2026-09-30, N7) — Group headers use the same pair: `ngpTableTreeRow` + `ngpTableTreeToggle`. Collapsible grouping is `withGrouping() + withTree()` and a group collapses through `table.tree.toggle(groupId)`; `engine/flatten.ts` stamps `hasChildren`/`isExpanded` on group nodes too, so no extra code. `3-ui/directives/grouping.md` is re-pointed from `ngpTableExpandToggle` (narrowed to panels by D1). Accepted cost: "Tree" in the name on a group header. Spec snippets bind the row as `<tr [ngpTableRow]="row" ngpTableTreeRow>` — never a redundant bare `ngpTableRow` beside the binding.
- **D12** (2026-09-30, failure modes) — A whole-row `(click)` on the `<tr>` plus the toggle button inside it double-toggles to a no-op; that is the consumer's to handle. The row click is consumer markup, so `ngpTableTreeToggle` neither calls `preventDefault()` nor `stopPropagation()`. The spec's whole-row example states in one line that the button's click bubbles to the row.
- **Complexity** (2026-09-30) — `isComplex: false`. Two directives with no new types or engine work; the risky edits are core `ngpTableRow` (drop row `aria-expanded`, add `--ngp-table-row-depth`) and re-pointing `expansion.md`/`grouping.md`, which a spec covers.
- **Follow-up** (2026-09-30) — Treegrid (role, `gridcell`, row `aria-level`/`aria-expanded`, APG arrow-key focus) is its own table-wide issue with an ADR (D2); not yet opened.
