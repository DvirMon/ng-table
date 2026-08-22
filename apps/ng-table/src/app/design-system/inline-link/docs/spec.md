---
id: inline-link
kind: component
atomic: Atom
spec: specs/Inline Link.md
frame: components/Inline Link.dc.html
owns:
  - "Accent-colored prose link + hover/focus treatment"
does_not_own: []
depends_on:
  - "foundations/Color.md (color)"
  - "foundations/Motion.md (motion)"
states:
  - "default"
  - "hover"
  - "focus-visible"
  - "visited (no change)"
a11y:
  - "Never color-only: underlined at rest as well as on hover and focus — accent text against tertiary body copy is a 1.06:1 difference, so color alone does not distinguish a link from the sentence around it"
tokens: [--ngpt-accent, --ngpt-comp-link-hover, --ngpt-focus-ring]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

> Distributed here from the design handoff bundle (`apps/ng-table/docs/design-handoff/`) during Wave 0 spec distribution — spec wins over the reference frame there.

# Inline Link

**Atomic level:** Atom

Standard hyperlink used within paragraph text.

## Composition

- Text run, inherits surrounding size

The resting underline is a WCAG 1.4.1 requirement, not a stylistic choice: `--ngpt-accent` and
`--ngpt-text-tertiary` sit at the same lightness, so their ratio to each other is 1.06:1 and a reader who
cannot separate the hues cannot find the link at all. It is drawn at 40% alpha with a 2px offset so a
paragraph with several links still reads as prose.

## States

| State | Trigger | Visual change |
|---|---|---|
| Default | — | Accent color, underlined at 40% alpha with a 2px offset |
| Hover | Pointer enters | Slightly brighter accent, underline goes solid |
| Focus | Keyboard focus | 2px accent ring |

## Build spec

| Property | Value | Token |
|---|---|---|
| Color (default) | oklch(0.62 0.19 52) | `--ngpt-accent` |
| Color (hover) | oklch(0.68 0.19 52) | `--ngpt-comp-link-hover` |
| Text decoration (default) | underline, `text-decoration-color: oklch(0.62 0.19 52 / 0.4)`, `text-underline-offset: 2px` | `--ngpt-accent` |
| Text decoration (hover) | underline, full-strength color | `—` |
| Focus ring | 0 0 0 2px oklch(0.62 0.19 52 / 0.6) | `--ngpt-focus-ring` |
| Font | inherits body size (13.5–15px) | `—` |
| Margin | none — inline within text flow | `—` |


## API (as shipped)

Attribute-hosted on the consumer's `<a>` — no wrapper element ships (ADR-0005).

| | |
|---|---|
| Selector | `a[ngptInlineLink]` |
| Inputs | `external = input(false, { transform: booleanAttribute })` |
| Host attributes | `target="_blank"` + `rel="noopener noreferrer"` when `external`; otherwise the consumer's own authored values are preserved |
| Content | projected label, followed by a visually-hidden `" (opens in new tab)"` span when `external` |

`href` is **not** an input — the consumer sets the native attribute. So are `target` and `rel`
for the non-external case; `external` is a shorthand that owns all three of `target`, `rel` and the
screen-reader text together (see `docs/decisions.md`).

```html
<a ngptInlineLink href="/docs/directives">Core directives</a>
<a ngptInlineLink external href="https://github.com/…">GitHub</a>
```

## HTML/CSS mock

```html
<a href="#" class="inline-link">Core directives</a>
```

```css
.inline-link {
  color: var(--ngpt-accent);
  text-decoration: underline;
  text-decoration-color: oklch(0.62 0.19 52 / 0.4);
  text-underline-offset: 2px;
}
.inline-link:hover {
  color: var(--ngpt-comp-link-hover);
  text-decoration-color: currentColor;
}
.inline-link:focus-visible {
  box-shadow: 0 0 0 2px var(--ngpt-focus-ring);
  outline: none;
}
```
