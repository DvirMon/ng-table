---
id: typography
kind: foundation
atomic: Token
spec: specs/foundations/Typography.md
frame: null
owns:
  - "Type scale: size, weight, line-height, letter-spacing per role"
  - "Font families (Inter, JetBrains Mono)"
does_not_own:
  - "Prose vertical rhythm — see Content Prose.md"
  - "Content max-width — see layout/Content Column.md"
  - "Font delivery — see Assets and Content Source.md"
depends_on: []
states: []
a11y:
  - "Never below 11px, and 11–12px only for uppercase labels. Body copy 14.5px minimum."
tokens: [--ngpt-sys-typescale-display-large, --ngpt-sys-typescale-headline-marketing, --ngpt-sys-typescale-headline-large, --ngpt-sys-typescale-title-large, --ngpt-sys-typescale-title-nav, --ngpt-sys-typescale-title-medium, --ngpt-sys-typescale-title-small, --ngpt-sys-typescale-body-large, --ngpt-sys-typescale-body-medium, --ngpt-sys-typescale-label-large, --ngpt-sys-typescale-label-large-sm, --ngpt-sys-typescale-label-large-medium, --ngpt-sys-typescale-label-large-strong, --ngpt-sys-typescale-label-small, --ngpt-sys-typescale-label-small-alt, --ngpt-sys-typescale-label-small-2, --ngpt-sys-typescale-code]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

> Distributed here from the design handoff bundle (`apps/site/docs/design-handoff/`) during Wave 0 spec distribution — this is the single source of truth for its token `:root` block; `src/styles/tokens/` mirrors it verbatim.

# Foundations — Typography

Inter for UI text, JetBrains Mono for code. Roles are named after the Material 3 type-scale tiers (headline / title / body / label) with a project-specific `code` extension since M3 has no monospace role.

The three `label-large-*` steps differ only in weight at one size — 13px is the system's control-label
size, and 400 / 500 / 600 are the three weights it appears at. A component picks the weight it needs by
picking the token; it never overrides the weight of another one.

| Token | Size / weight / line-height | Letter-spacing | Usage |
| --- | --- | --- | --- |
| --ngpt-sys-typescale-display-large | 64px / 700 / 1.05 | -0.025em | Marketing hero H1 only — see `pages/Home.md`, which renders it as `clamp(38px, 6vw, 64px)`. Never on a docs page. Was 52px; moved to 64px on 2026-08-22 so the token is the design size rather than a value nothing used. |
| --ngpt-sys-typescale-headline-marketing | 36px / 700 / 1.15 | -0.02em | Marketing section H2 — `pages/Home.md` only, which renders it as a `clamp()` down to 26px. A docs H2 (`title-large`, 19px) on a marketing page makes the page read as documentation. |
| --ngpt-sys-typescale-headline-large | 32px / 700 / 1.2 | -0.01em | Docs H1 |
| --ngpt-sys-typescale-title-large | 19px / 600 / 1.35 | — | Docs H2 |
| --ngpt-sys-typescale-title-nav | 15px / 600 / 1.2 | -0.01em | Navbar product name |
| --ngpt-sys-typescale-title-medium | 16px / 600 / 1.4 | — | Docs H3 |
| --ngpt-sys-typescale-title-small | 14.5px / 600 / 1.4 | — | Docs H4 |
| --ngpt-sys-typescale-body-large | 15px / 400 / 1.7 | — | Intro paragraph copy, search input |
| --ngpt-sys-typescale-body-medium | 14.5px / 400 / 1.65 | — | Section body copy, list items, callout body |
| --ngpt-sys-typescale-label-large | 13.5px / 400 / 1.4 | — | Sidebar / TOC nav item, search result title (600 when active) |
| --ngpt-sys-typescale-label-large-sm | 13px / 400 / 1.4 | — | Navbar right group, TOC base size, footer, menu option, dropdown pill, tab item |
| --ngpt-sys-typescale-label-large-medium | 13px / 500 / 1.4 | — | Pill button label, tab switcher active item |
| --ngpt-sys-typescale-label-large-strong | 13px / 600 / 1.4 | — | Table header cell |
| --ngpt-sys-typescale-label-small | 12px / 700 / 1.3 | 0.08em, uppercase | Eyebrow / category badge |
| --ngpt-sys-typescale-label-small-alt | 11px / 600 / 1.3 | 0.05em, uppercase | Sidebar section label, TOC label, menu + search group label |
| --ngpt-sys-typescale-label-small-2 | 12.5px / 400 / 1.4 | — | Pagination eyebrow, nested (H3) TOC item |
| --ngpt-sys-typescale-code | 13px / 400 / 1.6 | — | Inline code + code block |

```css
:root {
  --ngpt-sys-typescale-display-large: 700 64px/1.05 Inter, sans-serif;
  --ngpt-sys-typescale-headline-marketing: 700 36px/1.15 Inter, sans-serif;
  --ngpt-sys-typescale-headline-large: 700 32px/1.2 Inter, sans-serif;
  --ngpt-sys-typescale-title-large: 600 19px/1.35 Inter, sans-serif;
  --ngpt-sys-typescale-title-nav: 600 15px/1.2 Inter, sans-serif;
  --ngpt-sys-typescale-title-medium: 600 16px/1.4 Inter, sans-serif;
  --ngpt-sys-typescale-title-small: 600 14.5px/1.4 Inter, sans-serif;
  --ngpt-sys-typescale-body-large: 400 15px/1.7 Inter, sans-serif;
  --ngpt-sys-typescale-body-medium: 400 14.5px/1.65 Inter, sans-serif;
  --ngpt-sys-typescale-label-large: 400 13.5px/1.4 Inter, sans-serif;
  --ngpt-sys-typescale-label-large-sm: 400 13px/1.4 Inter, sans-serif;
  --ngpt-sys-typescale-label-large-medium: 500 13px/1.4 Inter, sans-serif;
  --ngpt-sys-typescale-label-large-strong: 600 13px/1.4 Inter, sans-serif;
  --ngpt-sys-typescale-label-small: 700 12px/1.3 Inter, sans-serif;
  --ngpt-sys-typescale-label-small-alt: 600 11px/1.3 Inter, sans-serif;
  --ngpt-sys-typescale-label-small-2: 400 12.5px/1.4 Inter, sans-serif;
  --ngpt-sys-typescale-code: 400 13px/1.6 "JetBrains Mono", monospace;
}

/* usage — letter-spacing and text-transform are not part of the font shorthand,
   so the roles that need them set them alongside the token */
h1 { font: var(--ngpt-sys-typescale-headline-large); letter-spacing: -0.01em; }
.eyebrow { font: var(--ngpt-sys-typescale-label-small); letter-spacing: 0.08em; text-transform: uppercase; }
code, pre { font: var(--ngpt-sys-typescale-code); }
```

Every value above is a valid `font` shorthand (`weight size/line-height family`), so
`font: var(--ngpt-sys-typescale-…)` resolves as written. An earlier revision of this file listed the
parts in scale order (`52px 700 -0.02em Inter`), which is not parseable as `font` — no rule using it
applied.
