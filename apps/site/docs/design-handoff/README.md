# Handoff: NGP Table documentation site

## Overview

A dark-only documentation website for **NGP Table**, a headless Angular table primitive: a marketing page
at `/` and a docs zone under `/docs` built on a 3-column shell (sidebar / content / on-this-page), with a
⌘K search overlay, a mobile drawer, and six page archetypes.

**This bundle is unusual, and it matters for how you use it.** The design is not primarily a set of HTML
files with a README describing them — it is a **specification repository** (`specs/`, 46 files) that is the
source of truth, plus six annotated HTML **reference frames** that show the intended render. The README you
are reading is a map and a build order, not a restatement of the specs. Do not transcribe values from this
file: every value lives in exactly one spec, and that is the property that keeps the system consistent.

Read `specs/index.md` first. It is a one-page manifest of every spec, what each one owns, and which page
archetype uses which components.

## About the design files

The files in `frames/` are **design references created in HTML** — prototypes showing intended look and
behavior, not production code to copy. Your task is to **recreate these designs in the target codebase**
using its established patterns. `specs/foundations/Iconography.md` prescribes ng-icons with the Lucide pack
and shows an Angular `app.config.ts`, which is the only place the specs name a stack; nothing else in the
system is framework-specific, so if you are not building in Angular, swap the icon library and keep
everything else.

The frames are Design Components (`.dc.html`): each opens directly in a browser (they need the sibling
`support.js`) and is styled entirely with inline literals rather than CSS variables, because they stream
into a live preview. **That is a frame implementation detail, not the design.** Your build should define the
token layer from `specs/foundations/` as real custom properties and reference it — never hardcode a value
that has a token. Frames also carry `data-role` / `data-spec` / `data-purpose` / `data-content` annotation
attributes and an amber "Reference frame" banner with a "Show roles" toggle; all of that is scaffolding and
gets stripped (`specs/Frame Annotation.md`).

**Where a frame and a spec disagree, the spec wins.** Frames were reconciled against the specs on
2026-08-22, but that rule stands permanently.

## Fidelity

**High-fidelity.** Every color, size, spacing step, radius, duration, easing, z-index and breakpoint is
specified as a token with a value, and every text-on-surface pair has been contrast-computed against WCAG
AA (`specs/foundations/Color.md` carries the measured ratios). Recreate the UI faithfully.

The exception is **content**: all body prose, code samples, callout copy and marketing copy in the frames is
invented placeholder, marked `data-content="MOCK"`. Never ship it. Anything marked `data-content="derived"`
is showing a computed result (a nav item, an eyebrow, an H1, a prev/next card) — wire it up, do not copy the
literal text.

## Architecture — read this before any screen

Five surfaces are views of **one** structure, and none may be hand-authored per page: the sidebar, the
on-this-page TOC, prev/next pagination, search results, and active state. They all derive from the nav tree
in `specs/Content Model.md`, resolved against the current URL by `specs/Routing and Page State.md`. If you
find yourself writing the sidebar twice, the content model has been bypassed — that is the bug the spec
exists to prevent.

| Concern                                                                                                | Spec                                 |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| The page list: sections, order, entry fields, slug rules                                               | `specs/Content Model.md`             |
| URL → archetype / active entry / eyebrow / H1 / prev / next / title, hash behavior, route-change focus | `specs/Routing and Page State.md`    |
| What is indexed, the result record shape, groups, ranking, what select does                            | `specs/Search Index.md`              |
| Brand assets, font delivery, where article Markdown lives                                              | `specs/Assets and Content Source.md` |

## Screens / views

Six archetypes. Each spec is `composes_only` — it assigns components to slots and makes page-only
decisions, and never restates styling. The component spec named in the slot table owns the appearance.

| Archetype        | Spec                              | Frame                             | What is different about it                                                                                                                                                                              |
| ---------------- | --------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home (`/`)       | `specs/pages/Home.md`             | `frames/Home Page.dc.html`        | Marketing. Drops the sidebar, the TOC, the grid and pagination. Four sections: full-bleed accent hero band containing the navbar, feature grid, install command row, footer. Two-state sticky navbar.   |
| Doc Article      | `specs/pages/Doc Article.md`      | `frames/Doc Article.dc.html`      | The default docs page. Every docs route is this unless named otherwise.                                                                                                                                 |
| Section Landing  | `specs/pages/Section Landing.md`  | `frames/Section Landing.dc.html`  | Lede + a link list to the section's pages. Usually no TOC. The frame renders the docs root, which has no parent section — so the eyebrow resolves to `null` and is absent, and pagination is next-only. |
| API Reference    | `specs/pages/API Reference.md`    | `frames/API Reference.dc.html`    | Table-dense lookup page. Real `<table>` per API surface, TOC always renders.                                                                                                                            |
| Examples Gallery | `specs/pages/Examples Gallery.md` | `frames/Examples Gallery.dc.html` | H2 → one paragraph → `preview-window`, repeated. No bare code blocks.                                                                                                                                   |
| Not Found        | `specs/pages/Not Found.md`        | `frames/Not Found.dc.html`        | Keeps the chrome, sidebar with nothing active, no TOC, no pagination, real HTTP 404.                                                                                                                    |

Page regions live in `specs/layout/` (page shell and grid, top navbar, sidebar + mobile drawer, content
column, TOC column, page footer). Components live in `specs/` — seventeen of them, atoms through templates,
each with front-matter listing `owns` / `does_not_own` / `depends_on` / `states` / `a11y` / `tokens`. One
component spec is enough context to build that component.

## Interactions & behavior

Specified in full; each of these has an owning file rather than a paragraph here.

- **Search** — two surfaces, one feature: a navbar field that is a `<button>`, and the ⌘K overlay it opens.
  Full keyboard model, focus trap, empty / no-results states, recent searches. `specs/Search.md` for the UI,
  `specs/Search Index.md` for the data.
- **Motion** — three durations, three easings, and a per-pattern table mapping every interaction to a pair.
  Exits run one step faster than entrances. Reduced motion drops transforms and smooth scroll.
  `specs/foundations/Motion.md`.
- **Focus and keyboard** — landmark tab order, one skip link, `:focus-visible` only, overlay focus traps,
  focus on route change, scroll clearance. `specs/foundations/Focus and Keyboard.md`.
- **Responsive** — three breakpoints; below `md` (1024px) the TOC drops and the sidebar becomes a
  left-edge slide-over drawer. `specs/foundations/Responsive and Breakpoints.md`. Note that the frames
  implement this collapse in JS (a `matchMedia` listener driving inline styles) because a Design Component
  has no stylesheet — **your build should use the media query in that spec**, not the JS.
- **Overlays and layering** — one z-index ladder, one scrim, one floating-surface recipe shared by the
  dropdown menu and the search panel. `specs/foundations/Radius and Elevation.md`.

## State management

There is one piece of derived state and everything reads it: the **page state** object in
`specs/Routing and Page State.md` § Page state (`archetype`, `entry`, `section`, `eyebrow`, `h1`,
`prev`/`next`, `headings`, `title`). Two active nav items at once means a surface computed its own state
instead of reading that one. Beyond it: search overlay open/query/active-row, drawer open, TOC scroll-spy
active heading, and per-control open/copied/failed states — each specified in its component's spec.

## Design tokens

Do not read token values out of this README — there are none here on purpose. They live in
`specs/foundations/`, one file per concern, each ending in a copy-pasteable `:root` block:

`Color.md` (surfaces, borders, text, accent, status, callout tints — with measured contrast per text token)
· `Typography.md` (17 roles, valid `font` shorthand) · `Spacing.md` (2px-based ramp) ·
`Layout and Sizing.md` (grid columns, column widths, content measure, the 72px scroll offset, fixed
component sizes) · `Radius and Elevation.md` (radius, elevation, z-index, scrim) · `Motion.md` ·
`Iconography.md` · `Responsive and Breakpoints.md`.

Dark only. There is no light theme and no theme toggle — do not add one.

## Assets

Nothing in this bundle is real artwork. `specs/Assets and Content Source.md` § Brand assets is an honest
inventory: the logo mark, favicon, apple-touch icon and OG image **do not exist**. A 22px rounded accent
square stands in for the mark. Placeholder policy is a reserved box at final dimensions — never a stretched
stand-in, never a stock substitute — so dropping the artwork in later changes nothing but the pixels inside
the box.

Fonts are Inter (400/500/600/700) and JetBrains Mono (400) from **Google Fonts**, `display=swap`, both
preconnects, weights pinned to the five faces the scale uses. Self-hosting the same faces is a swap of three
tags for a `@font-face` block and changes nothing else.

Icons: ng-icons with the Lucide pack. The frames use text glyphs (`▾ ⧉ ⚡ ← → ≡ × ⌕ ✓ ⓘ ⚠`) as stand-ins;
`specs/foundations/Iconography.md` carries the placeholder → icon mapping table.

## Two open items — you will hit these

1. **The nav tree is incomplete.** `specs/Content Model.md` § Seed tree carries the docs root and two
   sections (1 and 3); sections 2 and 4+ are named by the numbering but their entries are unknown. They are
   authored content, not design. Until they exist, the API Reference and Examples Gallery frames show no
   active sidebar item, which is why their banners say so.
2. **There is no article content.** The mechanism is specified — one Markdown file per tree entry, keyed by
   slug, `content/<section>/<entry>.md`, H2 and H3 only, the H1 composed from `entry.label`
   (`specs/Assets and Content Source.md` § Content source) — but every word in the frames is invented.

## Out of scope — do not build, do not restyle

The NGP Table product component itself (rows, sorting UI, headers — styled by the shipped library); Shiki
syntax colors (we set the container and force the theme background transparent, nothing else); light theme;
breadcrumbs; version selector; edit-this-page meta. `specs/index.md` § Out of scope is the authoritative
list, and `specs/Coverage Review.md` records why each was declined.

## Recommended build order

1. The token layer from `specs/foundations/`, as real custom properties.
2. The page shell and the 3-column grid (`specs/layout/Page Structure Overview.md`), then the navbar,
   sidebar, content column, TOC and footer.
3. The nav tree as data, and the URL → page-state function. Everything else reads these two.
4. Atoms and molecules, in the order `specs/index.md` § Components lists them (dependencies point upward).
5. Doc Article, then the other archetypes — each is a slot composition over what you already have.
6. Search: the field and overlay, then the index.

## Files

```
specs/                       46 files — the source of truth. Start at specs/index.md
  foundations/               8 token files
  layout/                    6 page-region specs
  pages/                     6 page archetypes
  *.md                       17 component specs + 4 site-level contracts + 3 meta files
frames/                      6 annotated HTML reference frames + support.js (required to open them)
screenshots/                 One capture per frame, in build order:
                             01-home, 02-doc-article, 03-section-landing,
                             04-api-reference, 05-examples-gallery, 06-not-found.
                             Captured at desktop width with the amber annotation banner visible —
                             that banner is frame scaffolding and is not part of the design.
AUDIT-REPORT.md              The 2026-08-22 spec-sufficiency audit: every gap found, what was closed,
                             what still needs a human decision. Read the top section.
```

`specs/Coverage Review.md` and `specs/Site Readiness Review.md` are decision history, not build
instructions — useful when you want to know why something is the way it is.
