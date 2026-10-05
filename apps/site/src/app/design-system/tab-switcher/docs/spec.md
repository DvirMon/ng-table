---
id: tab-switcher
kind: component
atomic: Molecule
spec: specs/Tab Switcher.md
frame: components/Tab Switcher.dc.html
owns:
  - 'Segmented track + item: track bg, item padding, active pill bg, inactive text'
does_not_own:
  - 'The panels it switches — see Preview Window.md'
depends_on:
  - 'foundations/Radius and Elevation.md (shape)'
  - 'foundations/Color.md (color)'
  - 'foundations/Motion.md (motion)'
  - 'foundations/Typography.md (typography)'
states:
  - 'item inactive'
  - 'item hover'
  - 'item active'
  - 'item focus-visible'
a11y:
  - 'role="tablist"; arrow keys move between tabs, aria-selected on the active one'
tokens:
  [
    --ngpt-comp-tab-track-bg,
    --ngpt-sys-shape-corner-small,
    --ngpt-sys-space-075,
    --ngpt-sys-space-150,
    --ngpt-comp-tab-item-px,
    --ngpt-comp-tab-item-active-bg,
    --ngpt-sys-shape-corner-extra-small-alt,
    --ngpt-text-primary,
    --ngpt-comp-tab-text-inactive,
    --ngpt-border-subtle,
    --ngpt-sys-typescale-label-large-sm,
    --ngpt-sys-typescale-label-large-medium,
    --ngpt-focus-ring,
    --ngpt-bg-active,
  ]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

> Distributed here from the design handoff bundle (`apps/site/docs/design-handoff/`) during Wave 0 spec distribution — spec wins over the reference frame there.

# Tab Switcher

**Atomic level:** Molecule

Two-way (Preview/Source) segmented control used at the top of live example windows.

## Composition

- Track container (rounded, padded)
- 2 tab items inside the track

## States

| State                  | Trigger        | Visual change                            |
| ---------------------- | -------------- | ---------------------------------------- |
| Active tab             | selected       | Filled bg, radius, white 500-weight text |
| Inactive tab (default) | —              | No bg, muted text                        |
| Inactive tab (hover)   | Pointer enters | Subtle bg lift                           |
| Inactive tab (focus)   | Keyboard focus | 2px accent ring                          |

## Build spec

| Property              | Value                                  | Token                                                         |
| --------------------- | -------------------------------------- | ------------------------------------------------------------- |
| Track background      | oklch(0.22 0.005 260)                  | `--ngpt-comp-tab-track-bg`                                    |
| Track radius          | 8px                                    | `--ngpt-sys-shape-corner-small`                               |
| Track padding         | 3px                                    | `--ngpt-sys-space-075`                                        |
| Item padding          | 6px 14px                               | `--ngpt-sys-space-150 --ngpt-comp-tab-item-px`                |
| Active item bg        | oklch(0.3 0.005 260)                   | `--ngpt-comp-tab-item-active-bg`                              |
| Active item radius    | 6px                                    | `--ngpt-sys-shape-corner-extra-small-alt`                     |
| Active text           | white / 500 weight                     | `--ngpt-text-primary`                                         |
| Inactive text         | oklch(0.64 0.01 260)                   | `--ngpt-comp-tab-text-inactive`                               |
| Inactive hover bg     | oklch(0.26 0.005 260)                  | `--ngpt-border-subtle (reused as tint)`                       |
| Font                  | Inter, 13px / 400 inactive, 500 active | `--ngpt-sys-typescale-label-large-sm` / `-label-large-medium` |
| Focus ring (inactive) | 0 0 0 2px oklch(0.68 0.22 328 / 0.6)   | `--ngpt-focus-ring`                                           |

## Notes

Inactive text was 0.60, which measured 4.39:1 against the 0.22 track and missed AA; at 0.64 it reaches
5.15:1.

The active item needs more lift than the global `--ngpt-bg-active` (0.24) provides against this control's own 0.22 track, so it carries a component-level token instead.

Sits left in the preview-window toolbar row, `space-between` against the right-side toolbar.

## HTML/CSS mock

```html
<div class="tab-switcher" role="tablist">
  <button class="tab-item is-active" role="tab" aria-selected="true">Preview</button>
  <button class="tab-item" role="tab" aria-selected="false">Source</button>
</div>
```

```css
.tab-switcher {
  display: inline-flex;
  background: var(--ngpt-comp-tab-track-bg);
  border-radius: var(--ngpt-sys-shape-corner-small);
  padding: var(--ngpt-sys-space-075);
}
.tab-item {
  padding: var(--ngpt-sys-space-150) var(--ngpt-comp-tab-item-px);
  border-radius: var(--ngpt-sys-shape-corner-extra-small-alt);
  border: none;
  background: transparent;
  color: var(--ngpt-comp-tab-text-inactive);
  font: var(--ngpt-sys-typescale-label-large-sm);
  cursor: pointer;
}
.tab-item.is-active {
  background: var(--ngpt-comp-tab-item-active-bg);
  color: var(--ngpt-text-primary);
  font: var(--ngpt-sys-typescale-label-large-medium);
}
.tab-item:not(.is-active):hover {
  background: var(--ngpt-border-subtle);
}
.tab-item:focus-visible {
  box-shadow: 0 0 0 2px var(--ngpt-focus-ring);
  outline: none;
}
```
