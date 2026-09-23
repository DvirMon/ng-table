---
title: UI Layer — Styling & Tokens (Cross-Cutting)
type: architecture
version: 0.2
date: 2026-09-23
status: draft — drilled
audience: developers
---

# UI Layer — Styling & Tokens (Cross-Cutting)

## Executive Summary

Applies to every NGP Table directive: `data-*` attributes for state, CSS custom properties for themeable values. Both are natively consumable by Tailwind's arbitrary-value/data-variant syntax, with no plugin required.

The contract is [ADR-0026](../../adr/0026-headless-styling-contract.md) (headless styling contract); this page is the convention's reference.

---

## The Convention

| Concern | Mechanism | Example |
|---|---|---|
| State (sorted, selected, disabled, etc.) | `data-*` attribute | `data-sort-direction="asc"` |
| Themeable value (color, spacing, radius) | CSS custom property | `--ngp-table-cell-bg` |

```html
<th [ngpTableColumn]="col.id" ngpTableSort data-sort-direction="asc"
    class="data-[sort-direction=asc]:text-brand-600 data-[sort-direction=desc]:rotate-180">

<td ngpTableCell class="bg-[var(--ngp-table-cell-bg)] p-[var(--ngp-table-cell-padding)]">
```

**Tailwind fit, specifically:**
- `data-*` → Tailwind's built-in data-variant syntax reads the attribute directly: `data-[sort-direction=asc]:...`
- CSS variables → Tailwind arbitrary values reference `var()` directly: `bg-[var(--token)]`, or map into `tailwind.config` theme extension for idiomatic utilities (e.g. `p-cell`)

---

## Rejected

- **Fixed classes only** (no `data-*`, no CSS variables) — poor Tailwind fit; consumers would fight specificity or need `!important`/`@apply` to override hardcoded rules, rather than composing utilities.
- **ng-primitives' fully headless model** — **superseded by [ADR-0026](../../adr/0026-headless-styling-contract.md):** the in-house-DS premise below is gone after the extraction to a standalone library. Original rejection, kept for history: (zero shipped default styling) — considered and rejected as a wholesale model, since NGP Table is a design system component expected to ship a real default appearance (references actual Atera tokens), not a behavior-only headless library. The `data-*` state-attribute *pattern* itself was adopted from ng-primitives' convention; the "ship nothing" philosophy was not.
- **Default CSS-only sort icon** (`::after` pseudo-element driven by `data-sort-direction`) — considered as a zero-DOM-insertion way to ship a default icon, but ultimately dropped entirely per explicit instruction: no default visual is shipped for sort; 100% consumer-authored CSS from day one.

---

## Open Questions

- [ ] Full token catalog (naming convention per directive, which values are themeable) — not yet specced; deferred to a dedicated styling/tokens session (see `3-ui/architecture.md` next steps).
- [ ] Row height / CDK `itemSize` value — depends on this catalog; blocks finalizing `virtual-scroll.md`.
