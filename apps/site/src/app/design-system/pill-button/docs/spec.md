---
id: pill-button
kind: component
atomic: Atom
spec: specs/Pill Button.md
frame: components/Pill Button.dc.html
owns:
  - 'Pill-shaped text button: padding, radius, border, label type'
  - 'Hover/focus/active treatment'
does_not_own:
  - 'Dropdown affordance — see Dropdown Pill.md'
depends_on:
  - 'foundations/Color.md (color)'
  - 'foundations/Radius and Elevation.md (shape)'
  - 'foundations/Motion.md (motion)'
  - 'foundations/Typography.md (typography)'
states:
  - 'default'
  - 'hover'
  - 'focus-visible'
  - 'active/pressed'
a11y:
  - 'Real <button>; focus ring via --ngpt-focus-ring, never outline:none alone'
tokens:
  [
    --ngpt-sys-typescale-label-large-medium,
    --ngpt-sys-space-150,
    --ngpt-sys-space-300,
    --ngpt-sys-shape-corner-large,
    --ngpt-comp-pill-border-default,
    --ngpt-comp-pill-border-hover,
    --ngpt-accent,
    --ngpt-bg-hover,
    --ngpt-text-tertiary,
    --ngpt-text-secondary,
    --ngpt-text-primary,
    --ngpt-focus-ring,
    --ngpt-sys-space-400,
    --ngpt-onband-fill,
    --ngpt-onband-fill-inverse,
  ]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

> Distributed here from the design handoff bundle (`apps/site/docs/design-handoff/`) during Wave 0 spec distribution — spec wins over the reference frame there.

# Pill Button

**Atomic level:** Atom

Rounded outline button used for secondary actions (e.g. "Sponsor" in the top navbar).

## Composition

- Text label, no icon

## States

| State    | Trigger        | Visual change                          |
| -------- | -------------- | -------------------------------------- |
| Default  | —              | Outline border, muted text             |
| Hover    | Pointer enters | Border + text lighten, bg fill appears |
| Focus    | Keyboard focus | 2px accent ring, text goes full white  |
| Disabled | disabled prop  | Opacity 0.5, no pointer events         |

## Build spec

| Property                 | Value                                | Token                                       |
| ------------------------ | ------------------------------------ | ------------------------------------------- |
| Font                     | Inter, 13px / 500                    | `--ngpt-sys-typescale-label-large-medium`   |
| Padding                  | 6px 12px                             | `--ngpt-sys-space-150 --ngpt-sys-space-300` |
| Border radius            | 20px                                 | `--ngpt-sys-shape-corner-large`             |
| Border (default)         | 1px solid oklch(0.32 0.005 260)      | `--ngpt-comp-pill-border-default`           |
| Border (hover)           | 1px solid oklch(0.45 0.005 260)      | `--ngpt-comp-pill-border-hover`             |
| Border (focus)           | 1px solid oklch(0.68 0.22 328)       | `--ngpt-accent (border-mix)`                |
| Background (default)     | transparent                          | `—`                                         |
| Background (hover/focus) | oklch(0.2 0.005 260)                 | `--ngpt-bg-hover`                           |
| Text (default)           | oklch(0.62 0.01 260)                 | `--ngpt-text-tertiary`                      |
| Text (hover)             | oklch(0.85 0.01 260)                 | `--ngpt-text-secondary`                     |
| Text (focus)             | white                                | `--ngpt-text-primary`                       |
| Focus ring               | 0 0 0 2px oklch(0.68 0.22 328 / 0.6) | `--ngpt-focus-ring`                         |
| Width                    | hug content                          | `—`                                         |

## Variant: on-band (Home hero only)

The Home hero sits on a full-bleed `--ngpt-accent-surface` band, where the default outline variant has
nothing to read against — a translucent border on a saturated ground reads as a smudge. So both hero
actions are **filled**, and the hierarchy comes from light vs. dark rather than fill vs. outline.

|                    | Primary                      | Secondary                                           |
| ------------------ | ---------------------------- | --------------------------------------------------- |
| Background         | white (`--ngpt-onband-fill`) | oklch(0.18 0.02 328) (`--ngpt-onband-fill-inverse`) |
| Background (hover) | oklch(0.95 0.01 328)         | oklch(0.24 0.03 328)                                |
| Text               | oklch(0.2 0.03 328)          | white                                               |
| Border             | none                         | none                                                |
| Focus ring         | `--ngpt-focus-ring`          | `--ngpt-focus-ring`                                 |

There is deliberately **no accent-filled variant**. On a docs page an accent fill would outrank the
accent's other job (active state, links); on the band it would vanish into the background. If a page
needs a primary action off the band, use the default outline variant and let position carry the weight.

**Hero size override.** In the Home hero only, both pills step up to 14.5px / 600 with 11px 20px
padding — the 13px default is too small to anchor a 64px headline. This is a page-local override,
not a second component size.

## Notes

Sits inline in the navbar right-side flex group, 16px gap from siblings (`--ngpt-sys-space-400`).

## HTML/CSS mock

```html
<button class="pill-button">Sponsor</button>
```

```css
.pill-button {
  font: var(--ngpt-sys-typescale-label-large-medium);
  padding: 6px 12px;
  border-radius: 20px;
  border: 1px solid var(--ngpt-comp-pill-border-default);
  background: transparent;
  color: var(--ngpt-text-tertiary);
  cursor: pointer;
}
.pill-button:hover {
  border-color: var(--ngpt-comp-pill-border-hover);
  background: var(--ngpt-bg-hover);
  color: var(--ngpt-text-secondary);
}
.pill-button:focus-visible {
  color: var(--ngpt-text-primary);
  box-shadow: 0 0 0 2px var(--ngpt-focus-ring);
  outline: none;
}
.pill-button:disabled {
  opacity: 0.5;
  pointer-events: none;
}
```
