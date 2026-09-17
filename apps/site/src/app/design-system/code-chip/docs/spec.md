---
id: code-chip
kind: component
atomic: Atom
spec: specs/Inline Code Chip.md
frame: components/Inline Code Chip.dc.html
owns:
  - "Inline <code> run inside prose: mono type, chip bg, tight radius + padding"
does_not_own:
  - "Multi-line code — see Code Block.md"
depends_on:
  - "foundations/Typography.md (typography)"
  - "foundations/Color.md (color)"
  - "foundations/Radius and Elevation.md (shape)"
states:
  - "default"
  - "inside a link (inherits accent)"
a11y: []
tokens: [--ngpt-sys-typescale-code, --ngpt-sys-space-050, --ngpt-sys-space-150, --ngpt-sys-shape-corner-extra-small, --ngpt-bg-code-chip, --ngpt-text-secondary]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

> Distributed here from the design handoff bundle (`apps/site/docs/design-handoff/`) during Wave 0 spec distribution — spec wins over the reference frame there.

# Inline Code Chip

**Atomic level:** Atom

Monospace text run set on a tinted background, used inline within paragraph copy for identifiers/paths.

## Composition

- Mono text run on a filled background

## Build spec

| Property | Value | Token |
|---|---|---|
| Font | JetBrains Mono, 13px | `--ngpt-sys-typescale-code` |
| Padding | 2px 6px | `--ngpt-sys-space-050 --ngpt-sys-space-150` |
| Border radius | 4px | `--ngpt-sys-shape-corner-extra-small` |
| Background | oklch(0.24 0.005 260) | `--ngpt-bg-code-chip` |
| Text color | oklch(0.85 0.01 260) | `--ngpt-text-secondary` |
| Margin | none — inline within text flow | `—` |

## API

Attribute-hosted on the consumer's own `<code>` element (ADR-0005) — no wrapper element ships.

| | |
|---|---|
| Selector | `code[ngptCodeChip]` |
| Inputs | none — projected code text only |
| Outputs | none |
| Host attributes | none |

```html
<code ngptCodeChip>ng-primitives/table</code>
```

## Notes

Composes into **Code Block** (molecule) when placed inside a block-level surface instead of inline text.

## HTML/CSS mock

The reference mock below predates ADR-0005. It ships as the API above: the `.code-chip` class
becomes the `ngptCodeChip` attribute and its rules live on `:host`; the rendered DOM is the same
single `<code>` box.

```html
<code class="code-chip">ng-primitives/table</code>
```

```css
.code-chip {
  font: var(--ngpt-sys-typescale-code);
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--ngpt-bg-code-chip);
  color: var(--ngpt-text-secondary);
}
```
