---
title: Tree UI layer — spec
type: spec
ticket: '#165'
date: 2026-09-30
audience: developers
---

# Tree UI layer — spec (#165)

Decisions: [`1-decisions.md`](1-decisions.md) (D1–D13). Capability log:
[`decisions/tree.md`](../../../../../decisions/tree.md) TR33–TR46;
grouping log G79–G80.

## Problem Statement

A developer rendering a `withTree()` table gets correct rows from the
store but no UI help. They hand-write the expand/collapse button, its
click handler, its `aria-expanded`, the depth indentation, and the
hiding of toggles on leaf rows — and they usually get the
accessibility wrong. The library's one tree directive,
`ngpTableTreeRow`, only marks context rows. Worse, the core row
directive emits `aria-expanded` on a plain table row, which ARIA only
allows inside a treegrid — so every expandable table ships invalid
markup today.

The same gap hits collapsible grouping: its UI spec points group
headers at `ngpTableExpandToggle`, a directive that now serves detail
panels only.

## Solution

Two tree directives, primitive in the ng-primitives sense — state out
as `data-*` hooks, no stylesheet, no library text:

- `ngpTableTreeRow` on the `<tr>` grows to expose whether the row can
  open and whether it is open.
- A new `ngpTableTreeToggle` on a `<button>` inside the row opens and
  closes it through `table.tree.toggle()`, owns the button's
  `aria-expanded`, and steps out of the way on rows that cannot open.

Core `ngpTableRow` stops emitting row `aria-expanded` and starts
emitting the row's depth as a CSS custom property, so any consumer —
tree or grouping — indents with one CSS rule. The table stays
`role="table"`; a real treegrid is a separate, table-wide piece of
work.

```html
<tr [ngpTableRow]="row" ngpTableTreeRow>
  <td>
    <button ngpTableTreeToggle [attr.aria-label]="'Children of ' + row.data.name">▸</button>
    {{ row.data.name }}
  </td>
</tr>
```

## User Stories

1. As a developer, I want a toggle directive I put on a button, so that opening and closing a tree row needs no click handler of my own.
2. As a developer, I want the toggle to find its row and its table through the template, so that I never pass a row id to it.
3. As a developer, I want the toggle to call `table.tree.toggle()` for the row it sits in, so that my open state stays in the store's one open set.
4. As a screen-reader user, I want the toggle button to announce "expanded" or "collapsed", so that I know whether a row's children are showing.
5. As a screen-reader user, I want the table to be announced as an ordinary table, so that I am not dropped into an interactive grid mode that the table does not support.
6. As a keyboard user, I want the toggle to be a native button, so that Tab reaches it and Enter or Space activates it with no custom key handling.
7. As a keyboard user, I want leaf rows to have no focusable toggle, so that I do not tab through dead buttons.
8. As a screen-reader user, I want leaf rows to have no announced toggle, so that I do not hear a "collapsed button" that does nothing.
9. As a developer, I want a leaf row's toggle to keep its width, so that labels line up across leaves and parents at the same depth.
10. As a developer, I want the toggle to expose `data-expanded` and `data-disabled`, so that I can rotate a chevron and hide leaf toggles from my own CSS.
11. As a developer, I want the tree row to expose `data-expandable` when it can open, so that I can style parents differently from leaves.
12. As a developer with a lazy-loaded parent, I want `data-expandable` to follow `isExpandable`, so that a parent with no loaded children still shows as openable.
13. As a developer, I want the tree row to expose `data-expanded` when it is open, so that I can style open parents.
14. As a developer, I want `data-context-row` to keep working as today, so that my existing filter styling is untouched.
15. As a developer, I want every row to carry its depth as `--ngp-table-row-depth`, so that one `calc()` rule indents any depth.
16. As a developer, I want the depth variable to inherit into cells and buttons, so that I can indent the toggle itself instead of guessing which cell is the tree column.
17. As a developer using collapsible grouping, I want the same row and toggle directives on group headers, so that group collapse needs no separate directive.
18. As a developer using collapsible grouping, I want group rows indented by the same depth variable, so that tree and grouping share one indentation rule.
19. As a developer, I want no attribute written by two directives on the same element, so that I never debug which directive won.
20. As a developer, I want a dev-mode error when I put the toggle on a table without `withTree()`, so that a dead button is caught on first render.
21. As a developer, I want the error to name both the directive and the missing feature, so that I know the fix without reading source.
22. As a developer, I want a dev-mode warning when my toggle button has no accessible name, so that I do not ship an unnamed control.
23. As a developer, I want to choose the accessible name myself, so that it names the row in my product's words and language.
24. As a developer who wants whole-row clicking, I want the docs to show the row `(click)` pattern and warn that the button's click bubbles to the row, so that I avoid a double toggle.
25. As a developer, I want the toggle to leave click events alone, so that my other row listeners — selection, analytics — still receive them.
26. As a developer, I want a documented CSS recipe for indentation, chevron rotation, hidden leaves and dimmed context rows, so that I get a working look without the library shipping a stylesheet.
27. As a developer upgrading, I want a changelog note that rows no longer carry `aria-expanded`, so that I can move any selector or test that read it to the toggle button.

## Implementation Decisions

- **Directive family (D1).** Tree UI is `ngpTableTreeRow` (row hooks) plus a new public `ngpTableTreeToggle`. The expansion UI spec's `ngpTableExpandable` / `ngpTableExpandToggle` narrow to detail panels only; their tree-row path is removed from that doc.
- **Role (D2).** The table host stays `role="table"`, cells `role="cell"`. Rows carry no `aria-level` and no `aria-expanded`. `aria-expanded` lives on the toggle button (disclosure pattern).
- **Core row changes (D2, D9).** `ngpTableRow` drops its `aria-expanded` binding and adds the output custom property `--ngp-table-row-depth`, bound from the required `depth` field, beside the existing `data-depth`. The binding form (`[style.--…]`) must be proven by a test — an earlier record calls it untested.
- **Attribute ownership (D5).** No attribute is bound by two directives on one element:

  | Directive            | Element | Binds                                                                           |
  | -------------------- | ------- | ------------------------------------------------------------------------------- |
  | `ngpTableRow`        | row     | `role`, `data-row-kind`, `data-depth`, `aria-rowindex`, `--ngp-table-row-depth` |
  | `ngpTableTreeRow`    | row     | `data-expandable`, `data-expanded`, `data-context-row`                          |
  | `ngpTableTreeToggle` | button  | `aria-expanded`, `data-expanded`, `data-disabled`, `disabled`, `aria-hidden`    |

- **Row hooks (D3).** Presence-only per ADR-0026 rule 1. `data-expandable` reflects `RenderRow.hasChildren` (which `isExpandable` overrides); `data-expanded` reflects `isExpanded`. Named for what CSS keys on, not the field.
- **Toggle host (D4).** Selector is `button[ngpTableTreeToggle]` only — native activation and focus, no keyboard handlers, no host-type branching, no nesting guard.
- **Toggle identity.** Row from the ancestor row directive's token; table from the table directive's token. No inputs for either.
- **Toggle on a non-expandable row (D6).** Sets `disabled`, `aria-hidden="true"` and `data-disabled`. It stays in the DOM so width is kept; hiding it visually is the consumer's CSS. The consumer may still omit it with `@if`.
- **Toggle state.** `aria-expanded` and `data-expanded` follow the row's `isExpanded`; on a disabled toggle `aria-expanded` is omitted.
- **Accessible name (D7).** Consumer-owned; the library ships no text. Under `ngDevMode`, one warning per toggle whose button has no `aria-label`, `aria-labelledby` or text content, checked after first render so late-rendered text counts. A disabled leaf toggle is skipped — it is `aria-hidden`, so no assistive tech reaches it (D13).
- **Missing `withTree()` (D8).** A wiring error per ADR-0014: under `ngDevMode` the toggle throws on first render, naming itself and `withTree()`. In production the check is stripped and the toggle is inert. A missing `ngpTableTreeRow` is not an error.
- **Group headers (D11).** Collapsible grouping (`withGrouping()` + `withTree()`) already collapses groups through `table.tree.toggle(groupId)`, and flattening stamps `hasChildren` / `isExpanded` on group rows — so both directives work on group headers unchanged. The grouping UI spec is re-pointed.
- **Styling (D10).** No stylesheet ships. The surface is the hooks above plus `--ngp-table-row-depth`. A "Styling recipe" in the new tree UI spec shows: toggle `margin-inline-start: calc(var(--ngp-table-row-depth) * <step>)`, rotation on `[data-expanded]`, `visibility: hidden` on `[data-disabled]`, context-row dimming, and a reduced-motion branch.
- **Click bubbling (D12).** The toggle neither prevents default nor stops propagation. The whole-row `(click)` example states that the button's click bubbles to the row.
- **Public surface.** `NgpTableTreeToggleDirective` is exported from the library barrel beside `NgpTableTreeRowDirective`.
- **Docs.** A new permanent UI spec for the tree (frontmatter `capability: tree`) holds the directive contract, the ownership table, the whole-row example and the styling recipe. The expansion UI spec narrows to panels; the grouping UI spec's collapse row points at the tree pair and its "`data-depth` to indentation" item closes. The core UI spec lists `--ngp-table-row-depth` and drops row `aria-expanded`. `status.md` and `llms.txt` are regenerated.

## Testing Decisions

- **What a good test is here:** drive the directive the way a consumer's template does and assert what the DOM exposes — attributes, their presence/absence, and rendered rows. Never assert on directive internals or private signals. Per the shared testing principles, the table store is same-domain in-memory code, not a system boundary, so it is **not** mocked.
- **Seam 1 — tree-row directive (existing).** Host component feeds a `RenderRow`; assert `data-expandable` / `data-expanded` presence, absence, and removal when the same row changes. Prior art: the existing tree-row spec's `data-context-row` cases.
- **Seam 2 — core row directive (existing).** Assert no row `aria-expanded` for any `isExpanded` value, and `--ngp-table-row-depth` equal to `depth`, updating when depth changes. This proves the custom-property binding.
- **Seam 3 — toggle on a real table (new).** A host with a real `createTable(…, withTree({ parentId }))`, the table directive, `@for` over rendered rows and the toggle button. Cases: a click opens then closes a parent (child rows appear/disappear, `aria-expanded` flips); leaf toggle is `disabled` + `aria-hidden` + `data-disabled` with no `aria-expanded`; a group header under `withGrouping()` + `withTree()` collapses; the dev-mode throw without `withTree()`; the nameless-button warning fires once, and not when a name is present. Clicks use native `button.click()` in jsdom.
- **Not tested:** the CSS recipe (consumer-owned), production stripping of dev checks.
- Acceptance: `nx run shared-table:typecheck` and `typecheck-spec` clean (template-aware), scoped spec runs green.

## Out of Scope

- **Treegrid** — `role="treegrid"`, `gridcell`, row `aria-level` / `aria-expanded`, APG arrow-key focus. A table-wide issue with its own ADR (D2); not yet opened.
- A shipped `tree.css` or any default look (D10).
- Library-provided toggle text or an i18n token (D7).
- A `<tr>` or arbitrary-element toggle host (D4).
- Expand-all / collapse-all controls (product U1).
- Announcing rows revealed by a filter (product U4).
- Tree stories for flat data, filtered trees, broken links (product U2) — separate story work.
- Detail-panel directives (`expansion.md`'s narrowed pair).

## Further Notes

- **Breaking for consumers:** row `aria-expanded` disappears from every table, grouping included. Anything selecting or asserting on it moves to the toggle button. Changelog entry required.
- ADR-0026's Consequences note that `[style.--x]` was untested; seam 2 settles it. If the binding fails, fall back to a host `style` binding via the renderer — still an output property, still no inline style beyond it.
- Blocked by #163 (creates `ngpTableTreeRow` and the flat-data tree).
