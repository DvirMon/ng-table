---
id: icon-button
kind: component
atomic: Atom
spec: specs/Icon Button.md
frame: components/Icon Button.dc.html
owns:
  - "Square icon-only control: size, radius, border, icon color per state"
  - "The copy-confirmation variant (icon swap + hold duration)"
does_not_own:
  - "The icon glyph itself — see Iconography.md"
depends_on:
  - "foundations/Iconography.md (icons)"
  - "foundations/Color.md (color)"
  - "foundations/Radius and Elevation.md (shape)"
  - "foundations/Motion.md (motion)"
states:
  - "default"
  - "hover"
  - "focus-visible"
  - "active"
  - "confirmed (copy variant)"
  - "failed (copy variant)"
a11y:
  - "aria-label required. Copy confirmation announces via aria-live=\"polite\"."
tokens: [--ngpt-comp-icon-btn-size, --ngpt-sys-shape-corner-small, --ngpt-comp-control-border-default, --ngpt-comp-pill-border-hover, --ngpt-text-tertiary, --ngpt-text-secondary, --ngpt-text-primary, --ngpt-bg-hover, --ngpt-focus-ring, --ngpt-sys-space-200, --ngpt-accent, --ngpt-comp-icon-btn-confirm-hold]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

> Distributed here from the design handoff bundle (`apps/ng-table/docs/design-handoff/`) during Wave 0 spec distribution — spec wins over the reference frame there.

# Icon Button

**Atomic level:** Atom

Fixed-size square button holding a single glyph (copy, run, etc.), used in toolbars.

## Composition

- Single centered icon glyph, no label

## States

| State | Trigger | Visual change |
|---|---|---|
| Default | — | Outline border, muted icon |
| Hover | Pointer enters | Border + icon lighten, bg fill appears |
| Focus | Keyboard focus | 2px accent ring, icon goes white |
| Disabled | disabled prop | Opacity 0.5 |

## Build spec

| Property | Value | Token |
|---|---|---|
| Size | 30×30px, fixed | `--ngpt-comp-icon-btn-size` |
| Border radius | 8px | `--ngpt-sys-shape-corner-small` |
| Border (default) | 1px solid oklch(0.3 0.005 260) | `--ngpt-comp-control-border-default` |
| Border (hover) | 1px solid oklch(0.45 0.005 260) | `--ngpt-comp-pill-border-hover` |
| Icon size | 13px | `—` |
| Icon color (default) | oklch(0.62 0.01 260) | `--ngpt-text-tertiary` |
| Icon color (hover) | oklch(0.85 0.01 260) | `--ngpt-text-secondary` |
| Icon color (focus) | white | `--ngpt-text-primary` |
| Background (hover/focus) | oklch(0.2 0.005 260) | `--ngpt-bg-hover` |
| Focus ring | 0 0 0 2px oklch(0.62 0.19 52 / 0.6) | `--ngpt-focus-ring` |
| Gap between buttons in a group | 8px | `--ngpt-sys-space-200` |


## HTML/CSS mock

```html
<button class="icon-button" aria-label="Copy">⧉</button>
```

```css
.icon-button {
  width: var(--ngpt-comp-icon-btn-size);
  height: var(--ngpt-comp-icon-btn-size);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid var(--ngpt-comp-control-border-default);
  background: transparent;
  color: var(--ngpt-text-tertiary);
  font-size: 13px;
  cursor: pointer;
}
.icon-button:hover {
  border-color: var(--ngpt-comp-pill-border-hover);
  background: var(--ngpt-bg-hover);
  color: var(--ngpt-text-secondary);
}
.icon-button:focus-visible {
  color: var(--ngpt-text-primary);
  box-shadow: 0 0 0 2px var(--ngpt-focus-ring);
  outline: none;
}
```

## Confirmation variant (copy)

The toolbar copy button reports success in place rather than through a toast.

| Property | Value | Token |
|---|---|---|
| Icon (rest) | lucideCopy, oklch(0.65 0.01 260) | `--ngpt-text-tertiary` |
| Icon (confirmed) | lucideCheck, oklch(0.75 0.13 150) | `--ngpt-status-success` |
| Icon (failed) | lucideTriangleAlert, oklch(0.7 0.19 25) | `--ngpt-status-error` |
| Border (confirmed) | unchanged | `—` |
| Hold duration | 1400ms, then reverts | `--ngpt-comp-icon-btn-confirm-hold` |
| Transition | opacity, base / standard | see `foundations/Motion.md` |

The button stays the same size and border throughout — only the glyph changes, so nothing in the toolbar shifts. Re-clicking during the hold restarts the timer rather than queueing. Both outcomes are announced through a polite live region (`aria-live="polite"`) because a glyph swap alone is invisible to screen readers.

**The failure state is not theoretical.** `navigator.clipboard.writeText` can exist and still reject — an
unfocused document, a permissions policy, a non-secure context, or an iframe without `clipboard-write` all
produce a rejected promise rather than a missing API. So the selection fallback (hidden textarea +
`document.execCommand`, whose boolean return is checked) is wired to **both** the rejection handler and the
no-API branch, and only after both fail does the button show `failed`. `aria-label` and `title` change with
the glyph, and on failure the label tells the reader to select the text manually. A button that appears
inert on click is worse than one that reports failure.

Success is `--ngpt-status-success`, not `--ngpt-accent`: the accent already means link / active /
identifier everywhere else, and a green check is the one place in the system where a state color earns
its own hue.

```css
.icon-button.is-confirmed { color: var(--ngpt-status-success); }
.icon-button.is-failed { color: var(--ngpt-status-error); }
```
