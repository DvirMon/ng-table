---
id: page-shell
kind: layout
atomic: Template
spec: specs/layout/Page Structure Overview.md
frame: null
owns:
  - "The anatomy tree — what regions exist and in what order"
  - "Page shell (body font/color/bg/min-height)"
  - "The 3-column grid container"
does_not_own:
  - "Anything inside a region"
depends_on:
  - "foundations/Color.md (color)"
  - "foundations/Typography.md (typography)"
  - "foundations/Responsive and Breakpoints.md (responsive)"
  - "foundations/Layout and Sizing.md (dimensions)"
states: []
a11y:
  - "Landmark order: header > nav > main > aside > footer"
tokens: [--ngpt-bg-app, --ngpt-sys-font-family-base, --ngpt-text-base, --ngpt-sys-layout-grid-columns, --ngpt-sys-breakpoint-lg]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

# Layout — Page Structure Overview

Full anatomy of a docs page, top to bottom. Every region below has its own detailed spec file in this `layout/` folder; this file is the map + the outer shell that holds them together.

## Anatomy tree

```
<body> (bg: --ngpt-bg-app)
└─ Page shell
   ├─ Top Navbar (fixed height, sticky)
   └─ Page Grid (3 columns, max-width 1440px, centered)
      ├─ Sidebar Navigation      → see "Sidebar Navigation.md"
      ├─ Content Column          → see "Content Column.md"
      │   └─ Pagination Footer   → see "../specs/Pagination Footer.md"
      └─ TOC Column ("On this page") → see "TOC Column.md"
   └─ Page Footer (full-width, below the grid) → see "Page Footer.md"
```

## Page shell

| Property | Value | Token |
| --- | --- | --- |
| Font family | Inter, system-ui, sans-serif | --ngpt-sys-font-family-base |
| Text color | oklch(0.92 0.005 260) | --ngpt-text-base |
| Background | oklch(0.16 0.005 260) | --ngpt-bg-app |
| Min height | 100vh | — |


## Grid container (wraps Sidebar / Content / TOC)

| Property | Value | Token |
| --- | --- | --- |
| display | grid | — |
| grid-template-columns | 270px 1fr 220px | --ngpt-sys-layout-grid-columns |
| max-width | 1440px | --ngpt-sys-breakpoint-lg |
| margin | 0 auto | — |



```css
.page-shell {
  font-family: var(--ngpt-sys-font-family-base);
  color: var(--ngpt-text-base);
  background: var(--ngpt-bg-app);
  min-height: 100vh;
}
.page-grid {
  display: grid;
  grid-template-columns: var(--ngpt-sys-layout-grid-columns);
  max-width: var(--ngpt-sys-breakpoint-lg);
  margin: 0 auto;
}
```


See `specs/foundations/Responsive and Breakpoints.md` for how this grid collapses below 1440px.
