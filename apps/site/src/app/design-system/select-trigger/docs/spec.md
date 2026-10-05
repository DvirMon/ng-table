---
id: select-trigger
kind: component
atomic: Molecule
spec: specs/Select Trigger.md
frame: components/Select Trigger.dc.html
owns:
  - 'Full-radius combobox trigger: padding, border, placeholder color, chevron'
does_not_own:
  - 'The option list — see Dropdown Menu.md'
depends_on:
  - 'Dropdown Menu.md (dropdown-menu)'
  - 'foundations/Radius and Elevation.md (shape)'
  - 'foundations/Color.md (color)'
  - 'foundations/Iconography.md (icons)'
states:
  - 'empty/placeholder'
  - 'filled'
  - 'hover'
  - 'focus-visible'
  - 'open'
a11y:
  - 'role="combobox" aria-expanded aria-controls'
tokens:
  [
    --ngpt-sys-space-275,
    --ngpt-comp-select-px,
    --ngpt-sys-shape-corner-full,
    --ngpt-border-strong,
    --ngpt-accent,
    --ngpt-focus-ring,
    --ngpt-bg-raised,
    --ngpt-comp-select-placeholder,
  ]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

> Distributed here from the design handoff bundle (`apps/site/docs/design-handoff/`) during Wave 0 spec distribution — spec wins over the reference frame there.

# Select / Combobox Trigger

**Atomic level:** Molecule

Pill-shaped clickable field that opens a select/combobox dropdown.

## Composition

- Placeholder or selected-value text
- Trailing chevron

## States

| State                               | Trigger         | Visual change                               |
| ----------------------------------- | --------------- | ------------------------------------------- |
| Default                             | —               | Neutral border, muted placeholder text      |
| Active/focus (multi-select variant) | open or focused | Accent border + ring, brighter text/chevron |

## Build spec

| Property         | Value                                       | Token                                        |
| ---------------- | ------------------------------------------- | -------------------------------------------- |
| Padding          | 11px 18px                                   | `--ngpt-sys-space-275 --ngpt-comp-select-px` |
| Border radius    | 24px (pill)                                 | `--ngpt-sys-shape-corner-full`               |
| Border (default) | 1px solid oklch(0.34 0.005 260)             | `--ngpt-border-strong`                       |
| Border (active)  | 1.5px solid oklch(0.68 0.22 328) + 2px ring | `--ngpt-accent` + `--ngpt-focus-ring`        |
| Background       | oklch(0.17 0.005 260)                       | `--ngpt-bg-raised`                           |
| Placeholder text | oklch(0.6 0.01 260), 14px                   | `--ngpt-comp-select-placeholder`             |
| Chevron size     | 12px                                        | `—`                                          |
| Chevron color    | matches text; accent when active            | `--ngpt-accent (active)`                     |
| Width            | 280px in examples; flexible in real usage   | `—`                                          |

## HTML/CSS mock

```html
<button class="select-trigger" aria-haspopup="listbox">
  <span>Select an option</span>
  <span aria-hidden="true">▾</span>
</button>
```

```css
.select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 280px;
  padding: 11px 18px;
  border-radius: 24px;
  border: 1px solid var(--ngpt-border-strong);
  background: var(--ngpt-bg-raised);
  color: var(--ngpt-comp-select-placeholder);
  font-size: 14px;
  cursor: pointer;
}
.select-trigger[aria-expanded='true'],
.select-trigger.is-active {
  border: 1.5px solid var(--ngpt-accent);
  box-shadow: 0 0 0 2px var(--ngpt-focus-ring);
  color: var(--ngpt-text-secondary);
}
.select-trigger.is-active span:last-child {
  color: var(--ngpt-accent);
}
```
