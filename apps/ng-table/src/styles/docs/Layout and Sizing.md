---
id: sizing
kind: foundation
atomic: Token
spec: specs/foundations/Layout and Sizing.md
frame: null
owns:
  - "Layout dimension tokens: grid columns, column widths, content measure, drawer width, scroll offset"
  - "The base font-family token"
  - "Fixed component sizes and hold durations that are dimensions rather than colors"
does_not_own:
  - "Which component uses which value — the component spec picks a token"
  - "Spacing steps (padding, gaps) — see foundations/Spacing.md"
  - "Breakpoints and grid collapse — see foundations/Responsive and Breakpoints.md"
depends_on: []
states: []
a11y:
  - "The scroll offset is what keeps anchor targets and focused elements clear of the sticky navbar"
tokens: [--ngpt-sys-font-family-base, --ngpt-sys-layout-grid-columns, --ngpt-sys-layout-sidebar-width, --ngpt-sys-layout-content-max-width, --ngpt-sys-layout-toc-width, --ngpt-sys-layout-drawer-width, --ngpt-sys-layout-scroll-offset, --ngpt-sys-layout-wide-measure, --ngpt-sys-comp-eyebrow-gap, --ngpt-sys-comp-nav-section-gap, --ngpt-comp-navbar-height, --ngpt-comp-navbar-logo-size, --ngpt-comp-navbar-dot-size, --ngpt-comp-navbar-dot-border, --ngpt-comp-nav-border-width, --ngpt-comp-toc-nested-indent, --ngpt-comp-list-indent, --ngpt-comp-icon-btn-size, --ngpt-comp-icon-btn-confirm-hold, --ngpt-comp-code-gutter-width, --ngpt-comp-tab-item-px, --ngpt-comp-select-px, --ngpt-comp-search-field-width, --ngpt-comp-search-field-height, --ngpt-comp-search-panel-width, --ngpt-comp-search-panel-max-height, --ngpt-comp-search-input-height, --ngpt-comp-menu-min-width, --ngpt-comp-menu-max-height, --ngpt-comp-pagination-arrow-shift]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

> Distributed here from the design handoff bundle (`apps/ng-table/docs/design-handoff/`) during Wave 0 spec distribution — this is the single source of truth for its token `:root` block; `src/styles/tokens/` mirrors it verbatim.

# Foundations — Layout and Sizing

Every fixed dimension in the system that is not a spacing step. `Spacing.md` owns the ramp used for
padding and gaps; this file owns the one-off sizes that only make sense for a specific region or control,
and it exists so component specs can cite a token instead of printing a number nobody can resolve.

## Layout

| Token | Value | Usage |
| --- | --- | --- |
| --ngpt-sys-font-family-base | Inter, system-ui, sans-serif | Page shell font stack |
| --ngpt-sys-layout-grid-columns | 270px 1fr 220px | The 3-column page grid |
| --ngpt-sys-layout-sidebar-width | 270px | Sidebar grid column |
| --ngpt-sys-layout-content-max-width | 760px | Content column cap. A cap, not a width — between 1024px and ~1330px of viewport the centre track is narrower than this and the column simply takes what the grid gives it. |
| --ngpt-sys-layout-toc-width | 220px | TOC grid column |
| --ngpt-sys-layout-drawer-width | 300px | Mobile sidebar drawer |
| --ngpt-sys-layout-scroll-offset | 72px | Anchor targets, sticky sidebar/TOC top, focus scroll clearance |
| --ngpt-sys-layout-wide-measure | 1080px | Marketing section content box — `pages/Home.md` only |
| --ngpt-sys-layout-prose-measure | 720px | Marketing copy cap from the rail — `pages/Home.md` only |

**On the scroll offset.** It is **not** the navbar's height. The navbar is
`--ngpt-comp-navbar-height` (56px); the offset is 56px plus 16px of clearance, so an anchored heading
lands below the bar rather than tight against it. Any spec that describes 72px as "the height the navbar
occupies" is wrong — the two values are independent and only this file relates them.

## Component sizes

| Token | Value | Usage |
| --- | --- | --- |
| --ngpt-sys-comp-eyebrow-gap | 6px | Category badge → H1 |
| --ngpt-sys-comp-nav-section-gap | 18px | Sidebar section label top margin |
| --ngpt-comp-navbar-height | 56px | Top navbar |
| --ngpt-comp-navbar-logo-size | 22px | Logo mark, square |
| --ngpt-comp-navbar-dot-size | 16px | Navbar status dot |
| --ngpt-comp-navbar-dot-border | 1.5px | Navbar status dot border width |
| --ngpt-comp-nav-border-width | 2px | Nav item / TOC item left border |
| --ngpt-comp-toc-nested-indent | 22px | H3 TOC item padding-left |
| --ngpt-comp-list-indent | 22px | Prose list padding-left |
| --ngpt-comp-icon-btn-size | 30px | Icon button, square |
| --ngpt-comp-icon-btn-confirm-hold | 1400ms | Copy confirmation hold before revert — the single value for every copy affordance in the system |
| --ngpt-comp-code-gutter-width | 40px | Code block line-number gutter |
| --ngpt-comp-tab-item-px | 14px | Tab switcher item horizontal padding |
| --ngpt-comp-select-px | 18px | Select trigger horizontal padding |
| --ngpt-comp-search-field-width | 220px | Navbar search field |
| --ngpt-comp-search-field-height | 32px | Navbar search field |
| --ngpt-comp-search-panel-width | 560px | ⌘K panel |
| --ngpt-comp-search-panel-max-height | 60vh | ⌘K panel |
| --ngpt-comp-search-input-height | 52px | ⌘K input row |
| --ngpt-comp-menu-min-width | 180px | Dropdown menu floor |
| --ngpt-comp-menu-max-height | 320px | Dropdown menu, then scrolls |
| --ngpt-comp-pagination-arrow-shift | 3px | Pagination arrow nudge distance |

```css
:root {
  --ngpt-sys-font-family-base: Inter, system-ui, sans-serif;
  --ngpt-sys-layout-grid-columns: 270px 1fr 220px;
  --ngpt-sys-layout-sidebar-width: 270px;
  --ngpt-sys-layout-content-max-width: 760px;
  --ngpt-sys-layout-toc-width: 220px;
  --ngpt-sys-layout-drawer-width: 300px;
  --ngpt-sys-layout-scroll-offset: 72px;
  --ngpt-sys-layout-wide-measure: 1080px;
  --ngpt-sys-layout-prose-measure: 720px;
  --ngpt-sys-comp-eyebrow-gap: 6px;
  --ngpt-sys-comp-nav-section-gap: 18px;
  --ngpt-comp-navbar-height: 56px;
  --ngpt-comp-navbar-logo-size: 22px;
  --ngpt-comp-navbar-dot-size: 16px;
  --ngpt-comp-navbar-dot-border: 1.5px;
  --ngpt-comp-nav-border-width: 2px;
  --ngpt-comp-toc-nested-indent: 22px;
  --ngpt-comp-list-indent: 22px;
  --ngpt-comp-icon-btn-size: 30px;
  --ngpt-comp-icon-btn-confirm-hold: 1400ms;
  --ngpt-comp-code-gutter-width: 40px;
  --ngpt-comp-tab-item-px: 14px;
  --ngpt-comp-select-px: 18px;
  --ngpt-comp-search-field-width: 220px;
  --ngpt-comp-search-field-height: 32px;
  --ngpt-comp-search-panel-width: 560px;
  --ngpt-comp-search-panel-max-height: 60vh;
  --ngpt-comp-search-input-height: 52px;
  --ngpt-comp-menu-min-width: 180px;
  --ngpt-comp-menu-max-height: 320px;
  --ngpt-comp-pagination-arrow-shift: 3px;
}
```
