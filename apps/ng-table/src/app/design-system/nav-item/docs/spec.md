---
id: nav-item
kind: component
atomic: Atom
spec: specs/Sidebar Nav Item.md
frame: components/Sidebar Nav Item.dc.html
owns:
  - "Nav link: padding, 2px left border, label type, per-state bg/text"
  - "The --accent variant used for the current section"
  - "Section label styling"
does_not_own:
  - "Sidebar container + grouping — see layout/Sidebar Navigation.md"
depends_on:
  - "foundations/Color.md (color)"
  - "foundations/Motion.md (motion)"
  - "foundations/Typography.md (typography)"
  - "foundations/Spacing.md (spacing)"
states:
  - "default"
  - "hover"
  - "focus-visible"
  - "active"
  - "accent + active"
a11y:
  - "aria-current=\"page\" on the active item"
tokens: [--ngpt-sys-space-225, --ngpt-sys-space-250, --ngpt-sys-space-100, --ngpt-sys-shape-corner-none, --ngpt-comp-nav-border-width, --ngpt-sys-typescale-label-large, --ngpt-comp-nav-text-default, --ngpt-text-secondary, --ngpt-bg-hover, --ngpt-bg-active, --ngpt-text-primary, --ngpt-accent-bg, --ngpt-accent, --ngpt-focus-ring, --ngpt-sys-typescale-label-small-alt, --ngpt-sys-comp-nav-section-gap, --ngpt-sys-space-500]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

> Distributed here from the design handoff bundle (`apps/ng-table/docs/design-handoff/`) during Wave 0 spec distribution — spec wins over the reference frame there.

# Sidebar Nav Item

**Atomic level:** Atom

Single clickable row in the left nav. The TOC's items look similar but are owned by
`layout/TOC Column.md`, which sets its own sizes and colors — this file does not cover them. Two color treatments: neutral (top-level pages) and accent (nested feature items).

## Composition

- Optional 2px left accent border
- Text label

## States

| State | Trigger | Visual change |
|---|---|---|
| Default | — | Neutral text, no bg, transparent border |
| Hover | Pointer enters | Bg lift, text lightens |
| Active (neutral) | selected page | Bg lift, left border accent, bold white text |
| Active (accent/nested) | selected feature | Accent-tinted bg, left border + text in accent |
| Focus | Keyboard focus | 2px accent ring |

## Build spec

| Property | Value | Token |
|---|---|---|
| Padding | 9px 10px | `--ngpt-sys-space-225 --ngpt-sys-space-250` |
| Gap between stacked items | 4px | `--ngpt-sys-space-100` |
| Border radius | 0 (flush with left border) | `--ngpt-sys-shape-corner-none` |
| Left border width | 2px | `--ngpt-comp-nav-border-width` |
| Font | Inter, 13.5px, 400 / 600 active | `--ngpt-sys-typescale-label-large` |
| Text (default) | oklch(0.78 0.005 260) | `--ngpt-comp-nav-text-default` |
| Text (hover) | oklch(0.85 0.01 260) | `--ngpt-text-secondary` |
| Bg (hover) | oklch(0.2 0.005 260) | `--ngpt-bg-hover` |
| Bg (active, neutral) | oklch(0.24 0.005 260) | `--ngpt-bg-active` |
| Text (active, neutral) | white | `--ngpt-text-primary` |
| Bg (active, accent) | oklch(0.2 0.04 52) | `--ngpt-accent-bg` |
| Text/border (active, accent) | oklch(0.62 0.19 52) | `--ngpt-accent` |
| Focus ring | 0 0 0 2px oklch(0.62 0.19 52 / 0.6) | `--ngpt-focus-ring` |
| Section label above group | 11px / 600 / uppercase / 0.05em | `--ngpt-sys-typescale-label-small-alt` |
| Section label margin-top | 18px | `--ngpt-sys-comp-nav-section-gap` |

## Variants

- Neutral treatment — top-level docs pages
- Accent treatment — nested feature items (e.g. Sorting)

## Notes

Labels **wrap** at the column width; they are never truncated or ellipsised. A nav label is the page's
name and a clipped name is not a usable target.

`--ngpt-accent-bg` was 0.24, where accent text on it measured 4.28:1 and failed AA. At 0.20 the same text
reaches 4.70:1 — see `foundations/Color.md`.

Negative 10px horizontal margin so the row full-bleeds inside the 20px sidebar padding (`--ngpt-sys-space-500`).

## API (as shipped)

Attribute-hosted on the consumer's `<a>` — no wrapper element ships (ADR-0005).

| | |
|---|---|
| Selector | `a[ngptNavItem]` |
| Inputs | `active = input(false, { transform: booleanAttribute })`, `nested = input(false, { transform: booleanAttribute })` |
| Host attributes | `data-active` / `data-nested` (empty-string presence attributes), `aria-current="page"` when `active` — all on the single anchor |
| Content | projected label |

`href` is **not** an input — the consumer sets the native attribute. No router wiring this round.

```html
<nav class="sidebar-nav">
  <a ngptNavItem href="/docs/intro">Introduction</a>
  <a ngptNavItem active href="/docs/styling">Styling</a>
  <a ngptNavItem nested active href="/docs/sorting">Sorting</a>
</nav>
```

## HTML/CSS mock

```html
<nav class="sidebar-nav">
  <a class="nav-item" href="#">Introduction</a>
  <a class="nav-item is-active" href="#">Styling</a>
  <a class="nav-item nav-item--accent is-active" href="#">Sorting</a>
</nav>
```

```css
.sidebar-nav { display: flex; flex-direction: column; gap: 4px; }
.nav-item {
  padding: 9px 10px;
  border-left: var(--ngpt-comp-nav-border-width) solid transparent;
  border-radius: var(--ngpt-sys-shape-corner-none);
  color: var(--ngpt-comp-nav-text-default);
  font: var(--ngpt-sys-typescale-label-large);
  text-decoration: none;
}
.nav-item:hover { background: var(--ngpt-bg-hover); color: var(--ngpt-text-secondary); }
.nav-item:focus-visible { box-shadow: 0 0 0 2px var(--ngpt-focus-ring); outline: none; }
.nav-item.is-active {
  background: var(--ngpt-bg-active);
  border-left-color: var(--ngpt-accent);
  color: var(--ngpt-text-primary);
  font-weight: 600;
}
.nav-item--accent.is-active {
  background: var(--ngpt-accent-bg);
  border-left-color: var(--ngpt-accent);
  color: var(--ngpt-accent);
}
```
