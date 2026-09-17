---
id: sidebar
kind: layout
atomic: Organism
spec: specs/layout/Sidebar Navigation.md
frame: components/Sidebar Navigation.dc.html
owns:
  - "Sidebar container width, padding, right divider"
  - "Section label + section group spacing"
  - "The mobile slide-over drawer"
does_not_own:
  - "The nav item itself — see Sidebar Nav Item.md"
depends_on:
  - "Sidebar Nav Item.md (nav-item)"
  - "foundations/Responsive and Breakpoints.md (responsive)"
  - "foundations/Radius and Elevation.md (shape)"
  - "foundations/Spacing.md (spacing)"
states:
  - "desktop (static column)"
  - "mobile (drawer closed)"
  - "mobile (drawer open + scrim)"
a11y:
  - "role=\"navigation\" aria-label=\"Docs\"; drawer traps focus and closes on Escape"
tokens: [--ngpt-sys-layout-sidebar-width, --ngpt-sys-space-700, --ngpt-sys-space-500, --ngpt-comp-row-divider, --ngpt-sys-typescale-label-large, --ngpt-sys-space-100, --ngpt-sys-comp-nav-section-gap, --ngpt-sys-space-250, --ngpt-text-muted, --ngpt-sys-layout-drawer-width, --ngpt-bg-app, --ngpt-sys-z-drawer, --ngpt-sys-z-drawer-scrim, --ngpt-sys-scrim, --ngpt-sys-scrim-blur, --ngpt-border-subtle]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

# Layout — Sidebar Navigation (container)

The left column of the page grid. Holds the nav item tree (see `specs/Sidebar Nav Item.md` for the item-level spec) — this file covers the container that holds them.


## Container

| Property | Value | Token |
| --- | --- | --- |
| Grid column width | 270px | --ngpt-sys-layout-sidebar-width |
| padding | 28px 20px | --ngpt-sys-space-700 --ngpt-sys-space-500 |
| border-right | 1px solid oklch(0.24 0.005 260) | --ngpt-comp-row-divider |
| font-size (base) | 13.5px | --ngpt-sys-typescale-label-large |


## Section group spacing

| Property | Value | Token |
| --- | --- | --- |
| Gap between stacked items in a group | 4px | --ngpt-sys-space-100 |
| Section label top margin | 18px (except first "Overview" item) | --ngpt-sys-comp-nav-section-gap |
| "Overview" item bottom margin | 10px | --ngpt-sys-space-250 |



```html
<nav class="sidebar">
  <a class="nav-item is-active">Overview</a>

  <div class="nav-section-label">1. State Layer</div>
  <div class="nav-section-group">
    <a class="nav-item" href="#">Architecture</a>
    <a class="nav-item" href="#">PRD</a>
    <!-- … -->
  </div>

  <div class="nav-section-label">3. UI Layer</div>
  <div class="nav-section-group">
    <a class="nav-item nav-item--accent is-active" href="#">Sorting</a>
    <!-- … -->
  </div>
</nav>
```


```css
.sidebar {
  padding: 28px 20px;
  border-right: 1px solid var(--ngpt-comp-row-divider, oklch(0.24 0.005 260));
  font-size: 13.5px;
}
.nav-section-label {
  font: 600 11px Inter, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ngpt-text-muted);
  margin: 18px 0 4px;
}
.nav-section-group { display: flex; flex-direction: column; gap: 4px; }
```


Item-level states (default/hover/active/focus, two color treatments) are fully specified in `specs/Sidebar Nav Item.md` — this file only covers the container's own box model and section rhythm.

## Empty sections

A section with no visible entries — none authored, or all `hidden` — renders **nothing**: no label, no
group, no gap. A label above an empty group reads as a loading failure. `Content Model.md` § Order owns
the rule; this file owns the omission.

## Sticky behavior

The sidebar is `position: sticky` at `top: var(--ngpt-sys-layout-scroll-offset)` with
`max-height: calc(100vh - var(--ngpt-sys-layout-scroll-offset))` and `overflow-y: auto`, matching the TOC.

Sticky, not scroll-with-page: navigation that scrolls out of reach forces a trip back to the top before
every page change. Its own overflow scroll matters more here than in the TOC — the full tree will outgrow
the viewport well before an individual article's heading list does.

The two columns scroll independently of the article and of each other. Below `md` (1024px) the sidebar
becomes the drawer and none of this applies.

## Mobile variant: slide-over drawer

Below the `md` breakpoint (1024px), this container moves into a slide-over drawer instead of simply hiding (see `specs/foundations/Responsive and Breakpoints.md` for the confirmed mechanism):

| Property | Value | Token |
| --- | --- | --- |
| Trigger | Hamburger icon, far left of navbar | — |
| Position | fixed, left edge, full height | — |
| Width | ~300px | --ngpt-sys-layout-drawer-width |
| Background | oklch(0.16 0.005 260) | --ngpt-bg-app |
| Drawer layer | z 30 | --ngpt-sys-z-drawer |
| Scrim fill | oklch(0 0 0 / 0.5) + blur(2px) | --ngpt-sys-scrim / --ngpt-sys-scrim-blur |
| Scrim layer | z 25 | --ngpt-sys-z-drawer-scrim |

The scrim is the shared one, not a drawer-specific surface — fill, blur, dismiss-on-click and scroll-lock all come from `foundations/Radius and Elevation.md`. This file only says the drawer uses it.

Drawer header (new, not present on desktop): logo + product name on the left, a close (×) button on the right, separated from the nav list by a 1px divider (`--ngpt-border-subtle`).

The nav list itself (labels, items, states) is unchanged from desktop — only the container and the added header/close button are new. Content scrolls independently inside the drawer when it overflows.

```html
<div class="sidebar-drawer-overlay is-open"></div>
<div class="sidebar-drawer is-open">
  <div class="drawer-header">
    <div class="navbar-left"><!-- logo + name --></div>
    <button class="drawer-close" aria-label="Close">×</button>
  </div>
  <nav class="sidebar"><!-- same nav list as desktop --></nav>
</div>
```

