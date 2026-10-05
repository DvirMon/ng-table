---
id: icons
kind: foundation
atomic: Token
spec: specs/foundations/Iconography.md
frame: null
owns:
  - 'Icon library choice + setup'
  - 'Size scale'
  - 'The placeholder-glyph → real-icon mapping table'
does_not_own:
  - 'Icon color (inherits from the host component)'
depends_on: []
states: []
a11y:
  - 'Decorative icons get aria-hidden="true"; icon-only controls need aria-label'
tokens: [--ngpt-sys-icon-size-md, --ngpt-sys-icon-size-sm, --ngpt-sys-icon-size-lg]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

> Distributed here from the design handoff bundle (`apps/site/docs/design-handoff/`) during Wave 0 spec distribution — this is the single source of truth for its token `:root` block; `src/styles/tokens/` mirrors it verbatim.

# Foundations — Iconography

**Library: [ng-icons](https://ng-icons.github.io/ng-icons/)** with the Lucide icon pack. Replaces every placeholder glyph (▾ ⧉ ⚡ ← → etc.) used elsewhere in this design system — those were stand-ins only, not a real icon spec.

Reference frames in `components/` must use only the placeholders listed in the mapping table below. No glyph outside that table. Where no legible text glyph exists (lucideLightbulb), the frame carries a minimal inline stroked SVG instead of a character.

## Setup

```ts
// app.config.ts
import { provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideCopy,
  lucideZap,
  lucideArrowLeft,
  lucideArrowRight,
  lucideMenu,
  lucideX,
  lucideArrowUp,
  lucideSearch,
  lucideCheck,
  lucideInfo,
  lucideTriangleAlert,
  lucideLightbulb,
} from '@ng-icons/lucide';

export const appConfig: ApplicationConfig = {
  providers: [
    provideIcons({
      lucideChevronDown,
      lucideCopy,
      lucideZap,
      lucideArrowLeft,
      lucideArrowRight,
      lucideMenu,
      lucideX,
      lucideArrowUp,
      lucideSearch,
      lucideCheck,
      lucideInfo,
      lucideTriangleAlert,
      lucideLightbulb,
    }),
  ],
};
```

## Usage

```html
<ng-icon name="lucideChevronDown" size="var(--ngpt-sys-icon-size-md)" color="currentColor" />
```

## Size scale

| Token                   | Value | Usage                                    |
| ----------------------- | ----- | ---------------------------------------- |
| --ngpt-sys-icon-size-sm | 13px  | Icon buttons, toolbar glyphs (copy, run) |
| --ngpt-sys-icon-size-md | 16px  | Navbar dot/avatar, dropdown chevrons     |
| --ngpt-sys-icon-size-lg | 20px  | Drawer close button, hamburger trigger   |

```css
:root {
  --ngpt-sys-icon-size-sm: 13px;
  --ngpt-sys-icon-size-md: 16px;
  --ngpt-sys-icon-size-lg: 20px;
}
```

## Placeholder → icon mapping

Every glyph used as a stand-in across the component specs should be swapped for the matching ng-icon:

| Placeholder used in specs               | ng-icon name                       |
| --------------------------------------- | ---------------------------------- |
| ▾ (dropdown chevron)                    | lucideChevronDown                  |
| ↑ (sort ascending)                      | lucideArrowUp                      |
| ⧉ (copy)                                | lucideCopy                         |
| ⚡ (run/execute)                        | lucideZap                          |
| ← / → (pagination arrows)               | lucideArrowLeft / lucideArrowRight |
| ≡ (mobile menu trigger)                 | lucideMenu                         |
| × (drawer close)                        | lucideX                            |
| ⌕ (search)                              | lucideSearch                       |
| ✓ (selected / confirmed)                | lucideCheck                        |
| ⓘ (callout — note)                      | lucideInfo                         |
| ⚠ (callout — warning)                  | lucideTriangleAlert                |
| inline stroked bulb SVG (callout — tip) | lucideLightbulb                    |

## Added by later specs

| Usage                                   | ng-icon name        | Spec                                             |
| --------------------------------------- | ------------------- | ------------------------------------------------ |
| Search field + overlay input            | lucideSearch        | `specs/Search.md`                                |
| Selected menu option, copy confirmation | lucideCheck         | `specs/Dropdown Menu.md`, `specs/Icon Button.md` |
| Callout — note                          | lucideInfo          | `specs/Callout.md`                               |
| Callout — warning                       | lucideTriangleAlert | `specs/Callout.md`                               |
| Callout — tip                           | lucideLightbulb     | `specs/Callout.md`                               |

## Notes

- Icon color always follows `currentColor` — it inherits the text color already defined per component state (e.g. icon button's muted → hover → focus text tokens), never a hardcoded fill.
- Stroke width defaults to Lucide's standard (2px); no custom weight observed in source captures.
