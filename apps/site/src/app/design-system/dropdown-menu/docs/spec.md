---
id: dropdown-menu
kind: component
atomic: Organism
spec: specs/Dropdown Menu.md
frame: components/Dropdown Menu.dc.html
owns:
  - "The floating menu panel: bg, border, radius, elevation, z, min/max size"
  - "Menu item, section label, separator, checked/disabled item"
  - "Open/close motion"
  - "Full keyboard model"
does_not_own:
  - "What opens it — see Dropdown Pill.md / Select Trigger.md"
depends_on:
  - "foundations/Radius and Elevation.md (shape)"
  - "foundations/Motion.md (motion)"
  - "foundations/Color.md (color)"
  - "foundations/Iconography.md (icons)"
  - "foundations/Spacing.md (spacing)"
states:
  - "item default"
  - "item hover"
  - "item active/checked"
  - "item disabled"
  - "panel entering"
  - "panel exiting"
a11y:
  - "role=\"menu\" / \"listbox\"; roving focus, Home/End, Escape closes and returns focus to the trigger"
tokens: [--ngpt-bg-hover, --ngpt-comp-menu-text-disabled, --ngpt-bg-elevated, --ngpt-border-subtle, --ngpt-sys-shape-corner-small-alt, --ngpt-sys-elevation-level2, --ngpt-sys-space-150, --ngpt-comp-menu-min-width, --ngpt-comp-menu-max-height, --ngpt-sys-z-popover, --ngpt-sys-typescale-label-small-alt, --ngpt-sys-space-200, --ngpt-sys-space-250, --ngpt-sys-shape-corner-extra-small-alt, --ngpt-sys-typescale-label-large-sm, --ngpt-sys-space-050, --ngpt-text-tertiary, --ngpt-text-secondary, --ngpt-bg-active, --ngpt-accent, --ngpt-sys-icon-size-sm, --ngpt-sys-motion-duration-base, --ngpt-sys-motion-easing-decelerate, --ngpt-text-muted]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

> Distributed here from the design handoff bundle (`apps/site/docs/design-handoff/`) during Wave 0 spec distribution — spec wins over the reference frame there.

# Dropdown Menu

**Atomic level:** Organism

The floating surface that opens from a **Dropdown Pill** (the preview toolbar's "Example CSS") or a **Select Trigger** (combobox). One spec serves both — the trigger differs, the menu does not.

Depends on the floating-surface recipe and z-index scale in `foundations/Radius and Elevation.md`, and the open/close timings in `foundations/Motion.md`.

## Composition

- Floating surface (elevated panel)
- Optional group label
- Option rows: label + optional trailing check
- Scroll region when the list exceeds max-height

## States

| State | Trigger | Visual change |
|---|---|---|
| Option default | — | Transparent bg, tertiary text |
| Option hover | Pointer enters | `--ngpt-bg-hover` fill, text lifts to secondary |
| Option focused | Keyboard arrow lands on it | Same fill as hover (hover and roving focus are visually identical) |
| Option selected | Is current value | Accent text + trailing check icon; fill unchanged |
| Option disabled | — | Text drops to `--ngpt-comp-menu-text-disabled`, no fill, `cursor: default` |
| Trigger while open | Menu visible | Trigger keeps its hover/active treatment for as long as the menu is open |

## Build spec

| Property | Value | Token |
|---|---|---|
| Surface background | oklch(0.2 0.005 260) | `--ngpt-bg-elevated` |
| Surface border | 1px solid oklch(0.26 0.005 260) | `--ngpt-border-subtle` |
| Surface radius | 10px | `--ngpt-sys-shape-corner-small-alt` |
| Surface shadow | 0 8px 24px oklch(0 0 0 / 0.35) | `--ngpt-sys-elevation-level2` |
| Surface padding | 6px | `--ngpt-sys-space-150` |
| Min width | matches trigger width, floor 180px | `--ngpt-comp-menu-min-width` |
| Max height | 320px, then scrolls | `--ngpt-comp-menu-max-height` |
| Offset from trigger | 6px | `--ngpt-sys-space-150` |
| Alignment | Left-aligned to trigger; flips to right edge if it would overflow the viewport | `—` |
| z-index | 40 | `--ngpt-sys-z-popover` |
| Group label | 11px / 600 / uppercase / 0.05em, oklch(0.55 0.01 260), padding 8px 10px 4px | `--ngpt-sys-typescale-label-small-alt` |
| Option padding | 8px 10px | `--ngpt-sys-space-200 --ngpt-sys-space-250` |
| Option radius | 6px | `--ngpt-sys-shape-corner-extra-small-alt` |
| Option font | Inter 13px | `--ngpt-sys-typescale-label-large-sm` |
| Option gap (stacked) | 2px | `--ngpt-sys-space-050` |
| Option text (default) | oklch(0.62 0.01 260) | `--ngpt-text-tertiary` |
| Option text (hover/focus) | oklch(0.85 0.01 260) | `--ngpt-text-secondary` |
| Option bg (hover/focus) | oklch(0.2 0.005 260) → use `--ngpt-bg-active` (0.24) for contrast against the elevated surface | `--ngpt-bg-active` |
| Option text (selected) | oklch(0.68 0.22 328) | `--ngpt-accent` |
| Selected check icon | lucideCheck, 13px, accent | `--ngpt-sys-icon-size-sm` |
| Option text (disabled) | oklch(0.42 0.005 260) | `--ngpt-comp-menu-text-disabled` |
| Divider between groups | 1px solid oklch(0.26 0.005 260), margin 6px -6px | `--ngpt-border-subtle` |

**Note on the hover fill:** the menu surface sits at 0.20, so the global `--ngpt-bg-hover` (also 0.20) is invisible on it. Options use `--ngpt-bg-active` (0.24) instead. This is the only place a hover state uses the active token.

## Keyboard and ARIA

| Key | Behavior |
|---|---|
| Enter / Space / ↓ on trigger | Opens, focus moves to first option (or the selected one) |
| ↑ / ↓ | Moves roving focus, wrapping at the ends |
| Home / End | First / last enabled option |
| Enter | Commits the focused option, closes, returns focus to trigger |
| Esc | Closes without committing, returns focus to trigger |
| Tab | Closes and moves on |
| Printable key | Typeahead to the next option starting with that character |

Also closes on outside click. Trigger carries `aria-haspopup="listbox"` (Select) or `"menu"` (Dropdown Pill) plus `aria-expanded`. Menu is `role="listbox"` / `role="menu"`, options `role="option"` with `aria-selected` / `role="menuitem"`. Disabled options get `aria-disabled="true"` and stay in the tab-around order but are skipped by arrows.

## HTML/CSS mock

```html
<div class="dropdown-menu" role="listbox">
  <div class="menu-label">Framework</div>
  <div class="menu-option is-selected" role="option" aria-selected="true">
    <span>Example CSS</span>
    <ng-icon name="lucideCheck" size="13px" />
  </div>
  <div class="menu-option" role="option" aria-selected="false"><span>Tailwind</span></div>
  <div class="menu-option is-disabled" role="option" aria-disabled="true"><span>Bootstrap</span></div>
</div>
```

```css
.dropdown-menu {
  position: absolute;
  z-index: var(--ngpt-sys-z-popover, 40);
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: var(--ngpt-comp-menu-min-width);
  max-height: var(--ngpt-comp-menu-max-height);
  overflow-y: auto;
  margin-top: 6px;
  padding: 6px;
  border-radius: var(--ngpt-sys-shape-corner-small-alt);
  border: 1px solid var(--ngpt-border-subtle);
  background: var(--ngpt-bg-elevated);
  box-shadow: var(--ngpt-sys-elevation-level2);
  opacity: 0;
  transform: translateY(-4px);
  transition:
    opacity var(--ngpt-sys-motion-duration-base) var(--ngpt-sys-motion-easing-decelerate),
    transform var(--ngpt-sys-motion-duration-base) var(--ngpt-sys-motion-easing-decelerate);
}
.dropdown-menu.is-open { opacity: 1; transform: translateY(0); }

.menu-label {
  font: 600 11px Inter, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ngpt-text-muted);
  padding: 8px 10px 4px;
}
.menu-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--ngpt-sys-shape-corner-extra-small-alt);
  font: var(--ngpt-sys-typescale-label-large-sm);
  color: var(--ngpt-text-tertiary);
  cursor: pointer;
}
.menu-option:hover,
.menu-option.is-focused { background: var(--ngpt-bg-active); color: var(--ngpt-text-secondary); }
.menu-option.is-selected { color: var(--ngpt-accent); }
.menu-option.is-disabled { color: var(--ngpt-comp-menu-text-disabled); cursor: default; background: none; }
```
