---
id: dropdown-pill
kind: component
atomic: Molecule
spec: specs/Dropdown Pill.md
frame: components/Dropdown Pill.dc.html
owns:
  - "Pill button + trailing chevron used as a menu trigger"
  - "Open-state border/text treatment"
does_not_own:
  - "The menu that opens — see Dropdown Menu.md"
depends_on:
  - "Pill Button.md (pill-button)"
  - "Dropdown Menu.md (dropdown-menu)"
  - "foundations/Iconography.md (icons)"
  - "foundations/Color.md (color)"
states:
  - "default"
  - "hover"
  - "focus-visible"
  - "open"
a11y:
  - "aria-haspopup=\"menu\" + aria-expanded"
tokens: [--ngpt-sys-typescale-label-large-sm, --ngpt-sys-space-150, --ngpt-sys-space-300, --ngpt-sys-shape-corner-large, --ngpt-comp-control-border-default, --ngpt-comp-pill-border-hover, --ngpt-accent, --ngpt-comp-dropdown-text, --ngpt-bg-hover, --ngpt-focus-ring]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

> Distributed here from the design handoff bundle (`apps/site/docs/design-handoff/`) during Wave 0 spec distribution — spec wins over the reference frame there.

# Dropdown Pill

**Atomic level:** Molecule

Outline pill control with a trailing chevron, used for select-style toolbar dropdowns (e.g. "Example CSS ▾").

## Composition

- Text label
- Trailing chevron glyph (▾), 10px

## States

| State | Trigger | Visual change |
|---|---|---|
| Default | — | Outline border, muted text |
| Hover | Pointer enters | Border + text lighten, bg fill appears |
| Focus | Keyboard focus | 2px accent ring, text + chevron go white |

## Build spec

| Property | Value | Token |
|---|---|---|
| Font | Inter, 13px | `--ngpt-sys-typescale-label-large-sm` |
| Padding | 6px 12px | `--ngpt-sys-space-150 --ngpt-sys-space-300` |
| Border radius | 20px | `--ngpt-sys-shape-corner-large` |
| Border (default) | 1px solid oklch(0.3 0.005 260) | `--ngpt-comp-control-border-default` |
| Border (hover) | 1px solid oklch(0.45 0.005 260) | `--ngpt-comp-pill-border-hover` |
| Border (focus) | 1px solid oklch(0.68 0.22 328) | `--ngpt-accent` |
| Text color | oklch(0.75 0.01 260) | `--ngpt-comp-dropdown-text` |
| Background (hover/focus) | oklch(0.2 0.005 260) | `--ngpt-bg-hover` |
| white-space | nowrap (must not wrap to 2 lines) | `—` |
| Focus ring | 0 0 0 2px oklch(0.68 0.22 328 / 0.6) | `--ngpt-focus-ring` |

## Notes

Critical constraint: label + chevron must render on one line — apply `white-space:nowrap` or the pill breaks into a stacked block.

## HTML/CSS mock

```html
<button class="dropdown-pill">
  Example CSS <span aria-hidden="true">▾</span>
</button>
```

```css
.dropdown-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  border: 1px solid var(--ngpt-comp-control-border-default);
  background: transparent;
  color: var(--ngpt-comp-dropdown-text);
  font: var(--ngpt-sys-typescale-label-large-sm);
  white-space: nowrap; /* required — must not wrap to 2 lines */
  cursor: pointer;
}
.dropdown-pill:hover {
  border-color: var(--ngpt-comp-pill-border-hover);
  background: var(--ngpt-bg-hover);
}
.dropdown-pill:focus-visible {
  border-color: var(--ngpt-accent);
  box-shadow: 0 0 0 2px var(--ngpt-focus-ring);
  outline: none;
}
```
