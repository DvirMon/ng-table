---
id: navbar
kind: layout
atomic: Organism
spec: specs/layout/Top Navbar.md
frame: components/Top Navbar.dc.html
owns:
  - "Navbar container: height, sticky, bg, bottom border, z"
  - "Left group (logo mark + product name)"
  - "Right group action slots + the status dot"
  - "The search slot position"
does_not_own:
  - "The search field itself — see Search.md"
  - "Icon button internals — see Icon Button.md"
depends_on:
  - "navbar-search-field"
  - "Icon Button.md (icon-button)"
  - "foundations/Radius and Elevation.md (shape)"
  - "foundations/Color.md (color)"
  - "foundations/Iconography.md (icons)"
states:
  - "default"
  - "scrolled (border becomes visible)"
  - "mobile (name truncates, search collapses to icon)"
a11y:
  - "role=\"banner\"; the bar is 56px tall and anchor targets clear it by --ngpt-sys-layout-scroll-offset (72px), which is not the same number"
tokens: [--ngpt-comp-navbar-height, --ngpt-sys-space-600, --ngpt-sys-z-navbar, --ngpt-bg-deep, --ngpt-border-subtle, --ngpt-sys-space-250-alt, --ngpt-comp-navbar-logo-size, --ngpt-sys-shape-corner-extra-small-alt, --ngpt-accent, --ngpt-sys-typescale-title-nav, --ngpt-text-primary, --ngpt-sys-space-400, --ngpt-sys-typescale-label-large-sm, --ngpt-text-tertiary, --ngpt-comp-navbar-dot-size, --ngpt-comp-navbar-dot-border]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

> Distributed here from the design handoff bundle (`apps/site/docs/design-handoff/`) during Wave 0 spec distribution — spec wins over the reference frame there.

# Layout — Top Navbar

Full-width bar above the page grid. Sticky to the top of the viewport, sits above all content (including the sidebar).

## Anatomy

```
<navbar>                              (sticky, height 56px)
├─ .navbar-left                       (flex, gap 10px)
│  ├─ logo swatch (22×22, radius 6, bg accent)
│  └─ product name text
└─ .navbar-right                      (flex, gap 16px)
   ├─ Search field (see "../Search.md")
   ├─ Sponsor (Pill Button atom)
   ├─ circular icon (16×16, avatar/status dot)
   ├─ "Discord" text
   └─ "GitHub" text
```


## Container

| Property | Value | Token |
| --- | --- | --- |
| display | flex, align-items:center, justify-content:space-between | — |
| height | 56px | --ngpt-comp-navbar-height |
| padding | 0 24px | --ngpt-sys-space-600 |
| position | sticky; top:0; z-index:10 | --ngpt-sys-z-navbar |
| background | oklch(0.11 0.004 260) | --ngpt-bg-deep |
| border-bottom | 1px solid oklch(0.26 0.005 260) | --ngpt-border-subtle |


## Left group (logo + name)

| Property | Value | Token |
| --- | --- | --- |
| gap | 10px | --ngpt-sys-space-250-alt |
| logo size | 22×22px | --ngpt-comp-navbar-logo-size |
| logo radius | 6px | --ngpt-sys-shape-corner-extra-small-alt |
| logo background | oklch(0.68 0.22 328) | --ngpt-accent |
| product name font | 600 / 15px | --ngpt-sys-typescale-title-nav |
| product name color | white | --ngpt-text-primary |


## Right group (actions)

| Property | Value | Token |
| --- | --- | --- |
| gap | 16px | --ngpt-sys-space-400 |
| font | 13px | --ngpt-sys-typescale-label-large-sm |
| text color | oklch(0.62 0.01 260) | --ngpt-text-tertiary |
| status dot size | 16×16px, border-radius 50% | --ngpt-comp-navbar-dot-size |
| status dot border | 1.5px solid oklch(0.6 0.01 260) | --ngpt-comp-navbar-dot-border / --ngpt-text-muted |



```html
<div class="navbar">
  <div class="navbar-left">
    <div class="navbar-logo"></div>
    <span class="navbar-title">NGP Table</span>
  </div>
  <div class="navbar-right">
    <button class="pill-button">Sponsor</button>
    <span class="navbar-dot"></span>
    <span>Discord</span>
    <span>GitHub</span>
  </div>
</div>
```


```css
.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--ngpt-comp-navbar-height, 56px);
  padding: 0 24px;
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--ngpt-bg-deep);
  border-bottom: 1px solid var(--ngpt-border-subtle);
}
.navbar-left { display: flex; align-items: center; gap: 10px; }
.navbar-logo { width: 22px; height: 22px; border-radius: 6px; background: var(--ngpt-accent); }
.navbar-title { font: var(--ngpt-sys-typescale-title-nav); letter-spacing: -0.01em; color: var(--ngpt-text-primary); }
.navbar-right { display: flex; align-items: center; gap: 16px; font-size: 13px; color: var(--ngpt-text-tertiary); }
.navbar-dot { width: var(--ngpt-comp-navbar-dot-size); height: var(--ngpt-comp-navbar-dot-size); border-radius: 50%; border: var(--ngpt-comp-navbar-dot-border) solid var(--ngpt-text-muted); display: inline-block; }
```


## Search slot

The right group's first item is the Search field from `specs/Search.md` — 220px, 32px tall, before the Sponsor pill. It is a button, not an input; it opens the ⌘K overlay.

## Mobile

Below `md` (1024px): a hamburger (lucideMenu, 20px) is added at the far left of the left group, before the logo, opening the sidebar drawer. The search field collapses to a 32px icon-only button.

Below `sm` (640px): "Discord" and "GitHub" text labels collapse to icon-only; the Sponsor pill is dropped rather than shrunk — it is the least load-bearing item in the bar.

| Viewport | Left group | Right group |
| --- | --- | --- |
| ≥ 1024px | logo + name | search field, Sponsor, dot, Discord, GitHub |
| 640–1023px | hamburger + logo + name | search icon, Sponsor, dot, Discord, GitHub |
| < 640px | hamburger + logo | search icon, dot, Discord icon, GitHub icon |
