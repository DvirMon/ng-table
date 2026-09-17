---
id: responsive
kind: foundation
atomic: Token
spec: specs/foundations/Responsive and Breakpoints.md
frame: null
owns:
  - "Breakpoint tokens"
  - "How the 3-column grid collapses at each breakpoint"
  - "The mobile sidebar mechanism (slide-over drawer)"
does_not_own:
  - "Per-component responsive tweaks — those live in the component spec"
depends_on:
  - "foundations/Radius and Elevation.md (shape)"
states: []
a11y: []
tokens: [--ngpt-sys-breakpoint-sm, --ngpt-sys-breakpoint-md, --ngpt-sys-breakpoint-lg, --ngpt-bg-app]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

> Distributed here from the design handoff bundle (`apps/site/docs/design-handoff/`) during Wave 0 spec distribution — this is the single source of truth for its token `:root` block; `src/styles/tokens/` mirrors it verbatim.

# Foundations — Responsive & Breakpoints

This is a documentation website: the responsive contract only needs to resolve the 3-column page grid (sidebar / content / TOC) down to smaller viewports — there's no product UI beyond that to reflow.

## Breakpoint tokens

| Token | Value | Behavior |
| --- | --- | --- |
| --ngpt-sys-breakpoint-sm | 640px | Mobile — further padding/density reductions within the single-column + drawer layout established at md |
| --ngpt-sys-breakpoint-md | 1024px | Tablet and below — TOC drops AND sidebar collapses into the slide-over drawer |
| --ngpt-sys-breakpoint-lg | 1440px | Desktop — full 3-column grid, matches the grid max-width |

## Layout collapse behavior

| Viewport | Behavior |
| --- | --- |
| ≥ 1440px (lg) | Full 3-column grid: 270px sidebar / flexible content / 220px TOC, centered at 1440px max-width. |
| 1024–1439px | Full 3-column grid, not yet at max-width: 270px sidebar / flexible content / 220px TOC. |
| 640–1023px (< md) | TOC column drops AND sidebar collapses behind a hamburger icon (left of navbar) into the slide-over drawer. Content becomes a single column at full width. |
| < 640px (sm) | Same single-column + drawer layout as above; navbar right-side items (Discord/GitHub labels) collapse to icon-only; content padding reduces from 40px to ~20px. |

## Confirmed: mobile sidebar mechanism

Below the `md` breakpoint (1024px), a left-edge **slide-over drawer** replaces the sidebar, not an accordion:

- Triggered by a hamburger icon at the far left of the navbar.
- Drawer slides in from the left, full viewport height, fixed width (~300px), sits above a dimmed/blurred overlay of the page behind it.
- Drawer has its own header: logo + product name + a close (×) button, top-aligned, separated from the nav list by a divider.
- Nav list below reuses the exact same Sidebar Nav Item styling/states as desktop (including the active item's left accent border) — no visual changes, just a different container.
- Drawer content scrolls independently when the nav list is taller than the viewport.
- Closes via the × button, an overlay click, or (recommended) Escape.

```css
:root {
  --ngpt-sys-breakpoint-sm: 640px;
  --ngpt-sys-breakpoint-md: 1024px;
  --ngpt-sys-breakpoint-lg: 1440px;
}

.page-grid {
  display: grid;
  grid-template-columns: 270px 1fr 220px;
  max-width: var(--ngpt-sys-breakpoint-lg);
  margin: 0 auto;
}

/* Drawer markup exists at every width; only the md query ever reveals it. */
.sidebar-drawer,
.sidebar-drawer-overlay { display: none; }

@media (max-width: 1023px) {
  .page-grid { grid-template-columns: 1fr; }
  .toc-column { display: none; }
  .sidebar-drawer.is-open {
    display: flex;
    flex-direction: column;
    position: fixed;
    inset: 0 auto 0 0;
    width: 300px;
    z-index: 30;
    background: var(--ngpt-bg-app, oklch(0.16 0.005 260));
    overflow-y: auto;
  }
  .sidebar-drawer-overlay.is-open {
    position: fixed;
    inset: 0;
    background: oklch(0 0 0 / 0.5);
    backdrop-filter: blur(2px);
    z-index: 25;
  }
}

@media (max-width: 639px) {
  main { padding: 20px; }
}
```

## Confirmed: code blocks scroll, never wrap

Long lines scroll horizontally at every viewport (`overflow-x: auto`). Wrapping breaks indentation, which is load-bearing in code. The scroll container is keyboard-focusable so it can be reached without a pointer. Owned by `specs/Code Block.md`; the same rule covers API Reference tables.
