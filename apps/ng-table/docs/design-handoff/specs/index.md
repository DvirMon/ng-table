# Spec Index

One read gets you the whole map. Every row is a single-responsibility unit: one spec file, optionally one renderable frame.

**How to use this repo**
1. Read this file.
2. Read `specs/pages/<archetype>.md` for the page you are building — it tells you which components fill which slots.
3. Read only the component specs that page names. Each has front-matter (`owns` / `does_not_own` / `depends_on` / `states` / `a11y` / `tokens`) so one file is enough context.
4. Resolve any token value in `specs/foundations/`. Never hardcode a value that has a token.
5. Never hand-author a nav list, prev/next pair, or search group — derive them from `Content Model.md`,
   and resolve what a URL makes active with `Routing and Page State.md`.
6. Frames are reference, not source. Read `Frame Annotation.md` before reading any `*.dc.html`: its
   `data-role` / `data-spec` / `data-purpose` / `data-content` attributes tell you which blocks are
   derived and which copy is invented placeholder.
7. If a spec exists, do not invent. If it does not, say so before improvising.

## Content model — the page list

| Spec | id | Owns |
| --- | --- | --- |
| Content Model.md | `content-model` | The nav tree: sections, order, slugs, archetypes. Sidebar, TOC, pagination, search, and active state all derive from it. |
| Routing and Page State.md | `routing` | URL → page state: which archetype renders, what is active, hash and title behavior. |
| Search Index.md | `search-index` | What is indexed, the result record shape, groups, ranking, and what select does. |
| Assets and Content Source.md | `assets` | Brand asset inventory, font delivery, and where article Markdown lives. |

Read these before any page. They are what make the site a site rather than a set of templates.

## Foundations — tokens only, no markup

| Spec | id | Owns |
| --- | --- | --- |
| foundations/Color.md | `color` | All color values, including every `--ngpt-comp-*` color; dark-only |
| foundations/Typography.md | `typography` | Type scale + families |
| foundations/Spacing.md | `spacing` | Spacing ramp |
| foundations/Layout and Sizing.md | `sizing` | Layout dimensions, fixed component sizes, scroll offset, base font stack |
| foundations/Radius and Elevation.md | `shape` | Radius, elevation, z-index, scrim, floating-surface recipe |
| foundations/Motion.md | `motion` | Durations, easings, per-pattern table, reduced motion |
| foundations/Iconography.md | `icons` | Icon library, sizes, glyph mapping |
| foundations/Responsive and Breakpoints.md | `responsive` | Breakpoints + grid collapse |
| foundations/Focus and Keyboard.md | `focus` | Tab order, skip link, focus-visible policy, overlay and route-change focus |

## Layout — page regions

| Spec | id | Frame | Owns |
| --- | --- | --- | --- |
| layout/Page Structure Overview.md | `page-shell` | — | Anatomy tree, body shell, 3-col grid |
| layout/Top Navbar.md | `navbar` | components/Top Navbar.dc.html | Sticky navbar, logo, actions, search slot |
| layout/Sidebar Navigation.md | `sidebar` | components/Sidebar Navigation.dc.html | Sidebar container + mobile drawer |
| layout/Content Column.md | `content-column` | — | Content width + vertical rhythm |
| layout/TOC Column.md | `toc` | components/TOC Column.dc.html | On-this-page column + scroll-spy |
| layout/Page Footer.md | `page-footer` | components/Page Footer.dc.html | Site-wide bottom footer |

## Components

| Spec | id | Atomic | Frame | Depends on |
| --- | --- | --- | --- | --- |
| Pill Button.md | `pill-button` | Atom | ✅ | — |
| Icon Button.md | `icon-button` | Atom | ✅ | icons |
| Category Badge.md | `category-badge` | Atom | ✅ | — |
| Inline Code Chip.md | `code-chip` | Atom | ✅ | — |
| Inline Link.md | `inline-link` | Atom | ✅ | — |
| Sidebar Nav Item.md | `nav-item` | Atom | ✅ | — |
| Dropdown Pill.md | `dropdown-pill` | Molecule | ✅ | pill-button, dropdown-menu |
| Select Trigger.md | `select-trigger` | Molecule | ✅ | dropdown-menu |
| Tab Switcher.md | `tab-switcher` | Molecule | ✅ | — |
| Table Row.md | `table-row` | Molecule | ✅ | — |
| Callout.md | `callout` | Molecule | components/Callout.dc.html | icons |
| Pagination Footer.md | `pagination` | Molecule | ✅ | — |
| Dropdown Menu.md | `dropdown-menu` | Organism | components/Dropdown Menu.dc.html | shape, motion |
| Code Block.md | `code-block` | Organism | ✅ | icon-button |
| Preview Window.md | `preview-window` | Organism | ✅ | tab-switcher, code-block, icon-button |
| Search.md | `search` | Organism | components/Search.dc.html | shape, motion, icons |
| Content Prose.md | `prose` | Template | components/Content Prose.dc.html | code-chip, inline-link |

## Pages

| Archetype | Spec | Frame |
| --- | --- | --- |
| Home (marketing, `/`) | pages/Home.md | pages/Home Page.dc.html |
| Doc Article (the default docs page) | pages/Doc Article.md | pages/Doc Article.dc.html |
| Section Landing | pages/Section Landing.md | pages/Section Landing.dc.html |
| API Reference | pages/API Reference.md | pages/API Reference.dc.html |
| Examples Gallery | pages/Examples Gallery.md | pages/Examples Gallery.dc.html |
| Not Found | pages/Not Found.md | pages/Not Found.dc.html |

## Out of scope — do not spec, do not restyle

- The NGP Table product component (rows, sorting UI, headers) — styled by the shipped library.
- Syntax highlighting colors — Shiki owns them; we only set the container and force the theme background transparent.
- Light theme, breadcrumbs, version selector — reviewed and declined. See Coverage Review.md.

## Non-spec history

`AUDIT-REPORT.md` (project root) records the 2026-08-22 spec-sufficiency audit — every point where an
agent building from these files had to invent. Its token findings are closed; the ones that need a human
decision are listed there and still open.
`Coverage Review.md` records the page-scope review and its decisions.
`Site Readiness Review.md` records the site-scope review — what a browsable multi-page build still needs.
`Frame Annotation.md` defines how reference frames label their own blocks and mark placeholder copy.
Neither review is a build instruction; the annotation convention is.
