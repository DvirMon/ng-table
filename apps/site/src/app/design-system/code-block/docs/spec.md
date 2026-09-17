---
id: code-block
kind: component
atomic: Organism
spec: specs/Code Block.md
frame: components/Code Block.dc.html
owns:
  - "Block container: bg, border, radius, padding, mono type"
  - "Gutter (line numbers) via CSS counter on .line"
  - "Line-highlight treatment driven by fence meta"
  - "Copy button placement"
does_not_own:
  - "Syntax colors — Shiki owns those; we only force the theme background transparent"
  - "The copy button internals — see Icon Button.md"
depends_on:
  - "Icon Button.md (icon-button)"
  - "foundations/Typography.md (typography)"
  - "foundations/Color.md (color)"
  - "foundations/Radius and Elevation.md (shape)"
states:
  - "default"
  - "numbered (5+ lines)"
  - "unnumbered (under 5 lines)"
  - "highlighted line"
  - "horizontally scrolling"
a11y:
  - "Scrollable region is focusable and has an accessible name"
tokens: [--ngpt-bg-deep, --ngpt-border-subtle, --ngpt-comp-code-gutter-width, --ngpt-comp-code-gutter-text, --ngpt-bg-app, --ngpt-accent, --ngpt-sys-space-400, --ngpt-sys-space-450, --ngpt-sys-shape-corner-small-alt, --ngpt-sys-typescale-code, --ngpt-text-secondary, --ngpt-sys-space-700]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

> Distributed here from the design handoff bundle (`apps/ng-table/docs/design-handoff/`) during Wave 0 spec distribution — spec wins over the reference frame there.

# Code Block

**Atomic level:** Organism

Block-level code surface. Composed of a surface atom (dark panel, border, radius) + the same mono-text styling as the Inline Code Chip, set as a full block instead of an inline run.

## Composition

- Surface panel (bg + border + radius)
- Line-number gutter
- Mono text content, left-aligned, multi-line, syntax-highlighted by Shiki

## Ownership boundary

Highlighting is **Shiki at build time**, used as shipped. The division of responsibility:

| Concern | Owner |
| --- | --- |
| Token colors (keyword, string, comment, type…) | Shiki theme — a built-in dark theme, not derived from `--ngpt-*` |
| Language grammars (TypeScript, Angular HTML) | Shiki |
| Line highlighting for callouts | Shiki meta — ` ```ts {2,4-6} ` |
| Panel bg, border, radius, padding | This spec (`--ngpt-bg-deep`, `--ngpt-border-subtle`) |
| Line-number gutter | This spec |
| Copy affordance | **Not here** — lives in the Preview Window toolbar as an Icon Button. A code block outside a Preview Window therefore has no copy button; that is deliberate, not an omission. |

Syntax colors are the one place the system deliberately does not use its own palette: forcing the accent-orange scale onto code tokens costs readability for no gain. Set the Shiki theme's own background to `transparent` so `--ngpt-bg-deep` still owns the surface.

## Line numbers

Shiki emits one `.line` element per line but no numbers — they come from a CSS counter.

**The gutter is opt-in per block.** `pages/Doc Article.md` turns it on at 5+ lines and omits it below
that, so the counter rules hang off a class (`.code-block--numbered`) set by whatever renders the fence,
not off `.code-block` itself. A three-line snippet with a number column reads as a file rather than a
fragment.

| Property | Value | Token |
|---|---|---|
| Gutter width | 40px | `--ngpt-comp-code-gutter-width` |
| Number color | oklch(0.58 0.005 260) | `--ngpt-comp-code-gutter-text` |
| Number alignment | right | `—` |
| Gutter separator | none (whitespace only) | `—` |
| Highlighted-line bg | oklch(0.16 0.005 260) | `--ngpt-bg-app` (reused as tint) |
| Highlighted-line marker | 2px left border, `--ngpt-accent` | `—` |

## Build spec

| Property | Value | Token |
|---|---|---|
| Padding | 16px 18px | `--ngpt-sys-space-400 --ngpt-sys-space-450` |
| Border radius | 10px | `--ngpt-sys-shape-corner-small-alt` |
| Background | oklch(0.11 0.004 260) | `--ngpt-bg-deep` |
| Border | 1px solid oklch(0.26 0.005 260) | `--ngpt-border-subtle` |
| Font | JetBrains Mono, 13px / 1.6 line-height | `--ngpt-sys-typescale-code` |
| Text color | oklch(0.85 0.01 260) | `--ngpt-text-secondary` |
| Margin-bottom | 28px (before next H2) | `--ngpt-sys-space-700` |

## Notes

Composition: surface atom + mono-text atom (shared token set with Inline Code Chip — same font/color, different container). The `--ngpt-text-secondary` text color below applies to unhighlighted blocks and to any run Shiki leaves untokenized.

Long lines **scroll horizontally at every viewport** — `overflow-x: auto`, never `white-space: pre-wrap`. Wrapping destroys indentation, which carries meaning in code. Give the scroll container `tabindex="0"` and an accessible name so a keyboard user can scroll it.

## HTML/CSS mock

Shiki's output, with the gutter added:

```html
<pre class="code-block shiki"><code>
  <span class="line"><span>readonly store = createTable(data, opts);</span></span>
  <span class="line is-highlighted"><span>…</span></span>
</code></pre>
```

```css
.code-block {
  font: var(--ngpt-sys-typescale-code);
  padding: 16px 18px;
  border-radius: 10px;
  background: var(--ngpt-bg-deep);
  border: 1px solid var(--ngpt-border-subtle);
  color: var(--ngpt-text-secondary);
  overflow-x: auto;
  margin: 0 0 28px;
}

/* line-number gutter — Shiki emits .line, the counter supplies the number.
   Opt-in: only blocks carrying --numbered get a gutter. */
.code-block--numbered code { counter-reset: line; display: block; }
.code-block--numbered .line { counter-increment: line; }
.code-block--numbered .line::before {
  content: counter(line);
  display: inline-block;
  width: var(--ngpt-comp-code-gutter-width, 40px);
  margin-right: 16px;
  text-align: right;
  color: var(--ngpt-comp-code-gutter-text);
  user-select: none;
}
.code-block .line.is-highlighted {
  background: var(--ngpt-bg-app);
  box-shadow: inset 2px 0 var(--ngpt-accent);
}
```
