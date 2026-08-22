---
id: motion
kind: foundation
atomic: Token
spec: specs/foundations/Motion.md
frame: null
owns:
  - "Duration + easing tokens"
  - "The per-pattern table mapping every interaction to a duration/easing pair"
  - "prefers-reduced-motion policy"
  - "The shared baseline transition on interactive controls"
does_not_own:
  - "Component-specific transforms (e.g. the pagination arrow shift)"
depends_on: []
states: []
a11y:
  - "All motion is suppressed under prefers-reduced-motion: reduce"
tokens: [--ngpt-sys-motion-duration-fast, --ngpt-sys-motion-duration-base, --ngpt-sys-motion-duration-slow, --ngpt-sys-motion-easing-standard, --ngpt-sys-motion-easing-decelerate, --ngpt-sys-motion-easing-accelerate]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

> Distributed here from the design handoff bundle (`apps/ng-table/docs/design-handoff/`) during Wave 0 spec distribution — this is the single source of truth for its token `:root` block; `src/styles/tokens/` mirrors it verbatim.

# Foundations — Motion

Short, flat transitions. Nothing in this UI bounces, springs, or staggers: motion exists to make a state change legible, not to decorate it. Three durations and three easings cover every pattern in the system.

## Duration tokens

| Token | Value | Usage |
| --- | --- | --- |
| --ngpt-sys-motion-duration-fast | 120ms | Color/border changes on hover and focus, tab active swap, arrow nudges |
| --ngpt-sys-motion-duration-base | 180ms | Popover and menu open, copy confirmation, result-list changes |
| --ngpt-sys-motion-duration-slow | 260ms | Mobile drawer slide, search overlay |

## Easing tokens

| Token | Value | Usage |
| --- | --- | --- |
| --ngpt-sys-motion-easing-standard | cubic-bezier(0.2, 0, 0.2, 1) | Default — anything that changes in place (color, background, transform on an element that stays put) |
| --ngpt-sys-motion-easing-decelerate | cubic-bezier(0, 0, 0.2, 1) | Entrances — element arriving on screen |
| --ngpt-sys-motion-easing-accelerate | cubic-bezier(0.4, 0, 1, 1) | Exits — element leaving screen |

**Rule:** exits run one duration step faster than their matching entrance (a drawer opens at `slow`, closes at `base`). Leaving feels sluggish at the same speed it arrived.

## Per-pattern table

| Pattern | Property | Duration | Easing |
| --- | --- | --- | --- |
| Nav item / TOC item hover | background, color | fast | standard |
| Control hover (icon button, pill, dropdown pill) | background, border-color, color | fast | standard |
| Focus ring appear | box-shadow | fast | standard |
| Tab Switcher active swap | background, color | fast | standard |
| Dropdown menu open | opacity, translateY(-4px → 0) | base | decelerate |
| Dropdown menu close | opacity | fast | accelerate |
| Search overlay open | scrim opacity; panel opacity + translateY(-8px → 0) | slow | decelerate |
| Search overlay close | scrim + panel opacity | base | accelerate |
| Mobile drawer open | translateX(-100% → 0); scrim opacity | slow | decelerate |
| Mobile drawer close | translateX(0 → -100%) | base | accelerate |
| Pagination arrow nudge | transform translateX(±3px) | fast | standard |
| Copy confirmation | icon opacity swap, holds `--ngpt-comp-icon-btn-confirm-hold` (1400ms) before reverting — every copy affordance in the system, docs and marketing alike | base | standard |
| TOC scroll-to-section | scroll position | native `scroll-behavior: smooth` | — |

Never transition `width`, `height`, `top`, or `left` — use `transform` and `opacity` so nothing reflows mid-animation.

## Reduced motion

Under `prefers-reduced-motion: reduce`, transforms and smooth scrolling are dropped entirely; opacity and color transitions stay but collapse to `fast`. State changes must still be visible — reduced motion means less movement, not no feedback.

`foundations/Focus and Keyboard.md` § Reduced motion states the same policy for skip-link and TOC
activation: the destination and the focus target are identical either way, only the transit changes. The
two files must move together.

```css
:root {
  --ngpt-sys-motion-duration-fast: 120ms;
  --ngpt-sys-motion-duration-base: 180ms;
  --ngpt-sys-motion-duration-slow: 260ms;
  --ngpt-sys-motion-easing-standard: cubic-bezier(0.2, 0, 0.2, 1);
  --ngpt-sys-motion-easing-decelerate: cubic-bezier(0, 0, 0.2, 1);
  --ngpt-sys-motion-easing-accelerate: cubic-bezier(0.4, 0, 1, 1);
}

html { scroll-behavior: smooth; }

/* baseline for every interactive control */
.nav-item, .toc-item, .icon-button, .pill-button, .dropdown-pill, .tab-item, .page-card {
  transition:
    background-color var(--ngpt-sys-motion-duration-fast) var(--ngpt-sys-motion-easing-standard),
    border-color var(--ngpt-sys-motion-duration-fast) var(--ngpt-sys-motion-easing-standard),
    color var(--ngpt-sys-motion-duration-fast) var(--ngpt-sys-motion-easing-standard),
    box-shadow var(--ngpt-sys-motion-duration-fast) var(--ngpt-sys-motion-easing-standard);
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after {
    transition-duration: var(--ngpt-sys-motion-duration-fast) !important;
    animation-duration: var(--ngpt-sys-motion-duration-fast) !important;
  }
  .dropdown-menu, .search-panel, .sidebar-drawer { transform: none !important; }
}
```
