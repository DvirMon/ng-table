---
id: callout
kind: component
atomic: Molecule
spec: specs/Callout.md
frame: components/Callout.dc.html
owns:
  - 'Note / Warning / Tip block: left accent, tinted bg, icon, title + body'
does_not_own: []
depends_on:
  - 'foundations/Iconography.md (icons)'
  - 'foundations/Color.md (color)'
  - 'foundations/Radius and Elevation.md (shape)'
  - 'foundations/Typography.md (typography)'
  - 'foundations/Spacing.md (spacing)'
states:
  - 'note'
  - 'warning'
  - 'tip'
a11y:
  - 'Warning callouts get role="note"; the icon is aria-hidden and the variant is named in the visible title'
tokens:
  [
    --ngpt-sys-space-300,
    --ngpt-sys-space-350,
    --ngpt-sys-space-400,
    --ngpt-sys-shape-corner-small-alt,
    --ngpt-sys-space-600,
    --ngpt-sys-icon-size-md,
    --ngpt-sys-typescale-label-large,
    --ngpt-sys-typescale-body-medium,
    --ngpt-comp-callout-note-bg,
    --ngpt-comp-callout-note-border,
    --ngpt-comp-callout-note-accent,
    --ngpt-comp-callout-warning-bg,
    --ngpt-comp-callout-warning-border,
    --ngpt-status-warning,
    --ngpt-comp-callout-tip-bg,
    --ngpt-comp-callout-tip-border,
    --ngpt-status-success,
    --ngpt-text-tertiary,
  ]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

> Distributed here from the design handoff bundle (`apps/site/docs/design-handoff/`) during Wave 0 spec distribution — spec wins over the reference frame there.

# Callout

**Atomic level:** Molecule

Admonition block for notes, warnings, and tips inside docs prose. Three variants, distinguished by hue and icon.

## API

**Selector:** `aside[ngptCallout]` — attribute-hosted on the consumer's own `<aside>`, per
[ADR-0005](../../../../../docs/adr/0005-attribute-hosted-components.md). No wrapper element ships;
`:host` in `callout.css` _is_ the `<aside>`. (Was `ngpt-callout` through Wave 2.)

| Input     | Type                                           | Default     | Notes                                                                                                                                                                               |
| --------- | ---------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kind`    | `CalloutKind` (`'note' \| 'tip' \| 'warning'`) | `'note'`    | Drives the `data-kind` host attribute (tint + border) and the icon                                                                                                                  |
| `heading` | `string \| undefined`                          | `undefined` | Optional visible title line, colored per `kind`. **Named `heading`, not `title`** — `title` is a global HTML attribute on the `<aside>` host and would collide (see `decisions.md`) |

Body content arrives through the default `<ng-content />`.

**Host attributes:** `role="note"` (static, all three kinds — `<aside>`'s implicit role is
`complementary`, and `generic` once nested in prose; neither satisfies the `a11y` front-matter's
`role="note"`, which `<aside>` explicitly permits as an override) and `[attr.data-kind]`.

```html
<aside ngptCallout kind="warning" heading="Breaking in v2">
  <p><code>createTable</code> no longer accepts a bare array.</p>
</aside>
```

## Variants

| Variant | Hue         | Icon                | Use for                                   |
| ------- | ----------- | ------------------- | ----------------------------------------- |
| Note    | Neutral     | lucideInfo          | Context, asides, "worth knowing"          |
| Warning | 85 (amber)  | lucideTriangleAlert | Breaking changes, footguns, deprecations  |
| Tip     | 150 (green) | lucideLightbulb     | Recommendations, shortcuts, best practice |

**Why Note is neutral:** the system's accent (hue 52, orange) already means "link, active, identifier." A note tinted with it would read as interactive. Note therefore uses the raised-surface neutral, and only warning and tip carry hue.

## Build spec

| Property           | Value                                                                | Token                                       |
| ------------------ | -------------------------------------------------------------------- | ------------------------------------------- |
| Layout             | grid, `20px 1fr`, gap 12px, align-items start                        | `--ngpt-sys-space-300`                      |
| Padding            | 14px 16px                                                            | `--ngpt-sys-space-350 --ngpt-sys-space-400` |
| Radius             | 10px                                                                 | `--ngpt-sys-shape-corner-small-alt`         |
| Border             | 1px solid, per variant                                               | see below                                   |
| Margin             | 0 0 24px                                                             | `--ngpt-sys-space-600`                      |
| Icon size          | 16px, variant-colored, offset 1px down to sit on the first text line | `--ngpt-sys-icon-size-md`                   |
| Title (optional)   | Inter 13.5px / 600, variant-colored, margin-bottom 4px               | `--ngpt-sys-typescale-label-large`          |
| Body               | Inter 14.5px / 1.65, oklch(0.62 0.01 260)                            | `--ngpt-sys-typescale-body-medium`          |
| Inline code inside | Unchanged from Inline Code Chip                                      | `—`                                         |

### Variant colors

| Variant | Background                                           | Border                                                   | Icon + title                                          |
| ------- | ---------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------- |
| Note    | oklch(0.19 0.005 260) `--ngpt-comp-callout-note-bg`  | oklch(0.28 0.005 260) `--ngpt-comp-callout-note-border`  | oklch(0.7 0.01 260) `--ngpt-comp-callout-note-accent` |
| Warning | oklch(0.21 0.03 85) `--ngpt-comp-callout-warning-bg` | oklch(0.34 0.06 85) `--ngpt-comp-callout-warning-border` | oklch(0.8 0.12 85) `--ngpt-status-warning`            |
| Tip     | oklch(0.21 0.03 150) `--ngpt-comp-callout-tip-bg`    | oklch(0.34 0.06 150) `--ngpt-comp-callout-tip-border`    | oklch(0.75 0.13 150) `--ngpt-status-success`          |

This extends `--ngpt-status-warning` and `--ngpt-status-success` from typographic-only into surface tints, holding chroma at 0.03 for backgrounds and 0.06 for borders so the tint reads as tone rather than color.

## Notes

Body text never carries the variant hue — only the icon and title do. Tinting a whole paragraph amber makes it harder to read and no more urgent. Callouts don't nest, and don't contain preview windows.

## HTML/CSS mock

```html
<div class="callout callout--warning">
  <ng-icon name="lucideTriangleAlert" size="16px" />
  <div>
    <div class="callout__title">Breaking in v2</div>
    <p><code>createTable</code> no longer accepts a bare array.</p>
  </div>
</div>
```

```css
.callout {
  display: grid;
  grid-template-columns: 20px 1fr;
  gap: 12px;
  align-items: start;
  padding: 14px 16px;
  margin: 0 0 24px;
  border-radius: var(--ngpt-sys-shape-corner-small-alt);
  border: 1px solid;
  font: var(--ngpt-sys-typescale-body-medium);
  color: var(--ngpt-text-tertiary);
}
.callout ng-icon {
  margin-top: 1px;
}
.callout__title {
  font-size: 13.5px;
  font-weight: 600;
  margin-bottom: 4px;
}
.callout p {
  margin: 0;
}

.callout--note {
  background: var(--ngpt-comp-callout-note-bg);
  border-color: var(--ngpt-comp-callout-note-border);
}
.callout--note ng-icon,
.callout--note .callout__title {
  color: var(--ngpt-comp-callout-note-accent);
}

.callout--warning {
  background: var(--ngpt-comp-callout-warning-bg);
  border-color: var(--ngpt-comp-callout-warning-border);
}
.callout--warning ng-icon,
.callout--warning .callout__title {
  color: var(--ngpt-status-warning);
}

.callout--tip {
  background: var(--ngpt-comp-callout-tip-bg);
  border-color: var(--ngpt-comp-callout-tip-border);
}
.callout--tip ng-icon,
.callout--tip .callout__title {
  color: var(--ngpt-status-success);
}
```
