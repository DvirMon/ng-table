# ADR-0029 — Directives own accessibility

**Status:** accepted — decided 2026-10-01.
**Related:** [ADR-0005](0005-generic-table-host.md) (dual-tag host directives),
[ADR-0026](0026-headless-styling-contract.md) (headless styling, no shipped CSS),
[ADR-0012](0012-split-expansion-into-panel-and-tree.md) (expansion panel),
`docs/3-ui/cross-cutting/accessibility.md` (Core Principle, aria-live ownership),
`docs/0-product/expansion.md` (OQ-exp-2, OQ-exp-8, OQ-exp-9).

## Decision

Every feature's directives (core table/row/cell, sorting, expansion panel, tree, grouping, selection, and any future feature) own accessibility completely and by default. A consumer composing the shipped directives gets correct accessibility without wiring any of it. The library owns the mechanism; the product owns the words. The consumer owns:

(a) the visual side, which ADR-0026 already leaves to them: contrast, focus-ring styling, target size;
(b) product-specific text for accessible names and announcements, including translation — for accessible names the consumer writes `aria-label` or text on the native element itself (amended 2026-10-01, category 3);
(c) very specific cases a directive cannot know, opted into explicitly.

Wiring accessibility is never part of the consumer's normal job.

### Categories directives own

1. **Semantics and roles:** native elements first; roles injected where the host is a `<div>` grid (ADR-0005).

2. **States and properties:** `aria-sort`, `aria-expanded` on the toggle button (never on a `role="table"` row), `aria-controls`, `aria-selected`, `aria-level`, `aria-rowindex`/`aria-rowcount`.

3. **Accessible names:** consumer-owned (amended 2026-10-01, #199 E55). The library writes no text: no label input, no generic default, no dev warning. The consumer names the control on the native element (`aria-label` or visible text). The library owns the relations only: `aria-controls`, `aria-labelledby` wiring, ids. Same as ng-primitives 0.130.3, whose collapsible trigger binds only `aria-controls`/`aria-expanded` and whose pagination icon buttons ship no label.

4. **Keyboard operation of triggers:** Enter/Space on sort headers and toggles (native `<button>`).

5. **Keyboard navigation between rows and cells:** the APG grid/treegrid patterns (arrow keys, Home/End, a single Tab stop). Includes stepping to the next/previous visible data row, skipping group headers and stopping at the end, which each feature plugs into: the panel follows the focused row in single-open, the tree adds →/← expand/collapse, group headers are steppable rows.

6. **Focus management:** focus never lost to `<body>`. It returns to the toggle when a panel closes while focus is inside it; it moves to a sensible row when the focused row is removed, filtered out or re-sorted; it never lands in hidden content. Opening a disclosure doesn't move focus (APG).

7. **Hidden and inert content:** `inert` on closed or closing panels (E41).

8. **Live announcements:** the library owns the region, when to announce, and a generic default message (e.g. "Sorted by Name, ascending"). The product overrides the wording, including translation.

9. **Reduced motion:** motion recipes respect `prefers-reduced-motion`, and directives that time animations honour it.

State hooks (`data-*`) for anything the consumer styles, e.g. focus visible and open/closed, per the existing "state as data-* attributes" invariant.

## Why

Accessibility done by the consumer is accessibility done inconsistently or not at all. Community discovery for expansion found the loudest pain is exactly this: Angular Material's example failing keyboard-only use, open since 2019 (`angular/components#15020`); MUI VoiceOver can't enter the panel (`mui/mui-x#18455`); MUI's tab order skips the panel (`mui/mui-x#4219`).

The existing principle in `docs/3-ui/cross-cutting/accessibility.md` covered dynamic ARIA and trigger keyboard operation only. It was silent on navigation, focus and the consumer boundary, and that silence let a design drift toward "the consumer binds ↓" (expansion OQ-exp-9, 2026-10-01).

The user's ruling: accessibility is a major responsibility of the primitives, not something to leave to the consumer except in very specific cases.

## Alternatives considered

- **Consumer wires a11y with library helpers/recipes:** rejected. Easy to forget, nothing warns, and it fails silently, which is the community pain above.

- **A separate opt-in a11y directive per feature:** rejected as the default. A11y must not be opt-in. A separate internal or composed directive is fine as an implementation detail, as long as the consumer doesn't have to add it.

- **Library owns the visual side too (focus-ring CSS):** rejected. It conflicts with ADR-0026 (no shipped CSS); the library exposes `data-*` hooks instead.

- **Dev-mode warning when an icon-only control has no label:** rejected. Naming is the consumer's responsibility (category 3); the library does not police it.

- **A label input with a generic default (e.g. "Toggle details"):** accepted 2026-10-01, then reversed the same day (#199, E55). Words are product-specific and need translation; a library default would be English text nobody chose.

## Consequences

- Every feature's UI spec must list its a11y contract across the nine categories, or say "not applicable".

- Keyboard navigation (category 5) is a new cross-feature capability with no owner yet; it needs its own issue (#201).

- Panel a11y directives (#199) are the first application.

- `docs/3-ui/cross-cutting/accessibility.md`'s Core Principle is extended to match and points here, and its `aria-live` ownership question is closed by category 8.

- Existing directives that don't meet this are gaps, not precedent.

- The tree toggle's shipped nameless warning (TR39) contradicts category 3; removing it is #209's.
