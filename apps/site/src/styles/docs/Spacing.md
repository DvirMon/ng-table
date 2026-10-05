---
id: spacing
kind: foundation
atomic: Token
spec: specs/foundations/Spacing.md
frame: null
owns:
  - 'The full spacing ramp as tokens'
does_not_own:
  - 'Which gap any component uses'
depends_on: []
states: []
a11y: []
tokens:
  [
    --ngpt-sys-space-050,
    --ngpt-sys-space-075,
    --ngpt-sys-space-100,
    --ngpt-sys-space-150,
    --ngpt-sys-space-200,
    --ngpt-sys-space-225,
    --ngpt-sys-space-250,
    --ngpt-sys-space-275,
    --ngpt-sys-space-300,
    --ngpt-sys-space-350,
    --ngpt-sys-space-400,
    --ngpt-sys-space-450,
    --ngpt-sys-space-500,
    --ngpt-sys-space-600,
    --ngpt-sys-space-700,
    --ngpt-sys-space-800,
    --ngpt-sys-space-900,
    --ngpt-sys-space-1000,
  ]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

> Distributed here from the design handoff bundle (`apps/site/docs/design-handoff/`) during Wave 0 spec distribution — this is the single source of truth for its token `:root` block; `src/styles/tokens/` mirrors it verbatim.

# Foundations — Spacing

A 2px-based grid, named following Material's spacing-scale convention: token suffix = px × 25 (e.g. 8px → `space-200`).

| Token                 | Value | Usage                                                                                          |
| --------------------- | ----- | ---------------------------------------------------------------------------------------------- |
| --ngpt-sys-space-050  | 2px   | Icon-to-label micro gap                                                                        |
| --ngpt-sys-space-075  | 3px   | Tab switcher track padding                                                                     |
| --ngpt-sys-space-100  | 4px   | Gap between stacked nav items                                                                  |
| --ngpt-sys-space-150  | 6px   | Inline code chip vertical padding, dropdown pill padding                                       |
| --ngpt-sys-space-200  | 8px   | Small internal gaps, icon-button group gap                                                     |
| --ngpt-sys-space-225  | 9px   | Nav item vertical padding                                                                      |
| --ngpt-sys-space-250  | 10px  | Nav item horizontal padding                                                                    |
| --ngpt-sys-space-275  | 11px  | Table row padding                                                                              |
| --ngpt-sys-space-300  | 12px  | Pill button / dropdown pill horizontal padding                                                 |
| --ngpt-sys-space-350  | 14px  | Pagination card vertical padding                                                               |
| --ngpt-sys-space-400  | 16px  | Card / row horizontal padding                                                                  |
| --ngpt-sys-space-450  | 18px  | Code block / pagination card horizontal padding                                                |
| --ngpt-sys-space-500  | 20px  | Sidebar horizontal padding, nested list indent                                                 |
| --ngpt-sys-space-600  | 24px  | Block margin-bottom (list, blockquote, callout, pagination top gap), navbar horizontal padding |
| --ngpt-sys-space-700  | 28px  | Sidebar / footer vertical padding, code block margin-bottom, lede-to-first-section gap         |
| --ngpt-sys-space-800  | 32px  | Section-to-section vertical rhythm, preview canvas horizontal padding                          |
| --ngpt-sys-space-900  | 36px  | Content column and TOC top padding                                                             |
| --ngpt-sys-space-1000 | 40px  | Preview canvas vertical padding, content column horizontal padding                             |

There are no `-alt`, `-b` or `-ish` variants. Earlier revisions of the layout specs cited
`--ngpt-sys-space-700-alt`, `-700-b`, `-700-ish`, `-900`, `-1000-alt`, `-350-alt` and `-250-alt` for
values this ramp already carries (28px, 36px, 40px, 14px, 10px). Those names never existed; the three
real gaps — 24px, 28px, 36px — are the rows added above.

```css
:root {
  --ngpt-sys-space-050: 2px;
  --ngpt-sys-space-075: 3px;
  --ngpt-sys-space-100: 4px;
  --ngpt-sys-space-150: 6px;
  --ngpt-sys-space-200: 8px;
  --ngpt-sys-space-225: 9px;
  --ngpt-sys-space-250: 10px;
  --ngpt-sys-space-275: 11px;
  --ngpt-sys-space-300: 12px;
  --ngpt-sys-space-350: 14px;
  --ngpt-sys-space-400: 16px;
  --ngpt-sys-space-450: 18px;
  --ngpt-sys-space-500: 20px;
  --ngpt-sys-space-600: 24px;
  --ngpt-sys-space-700: 28px;
  --ngpt-sys-space-800: 32px;
  --ngpt-sys-space-900: 36px;
  --ngpt-sys-space-1000: 40px;
}
```
