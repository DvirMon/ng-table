---
id: site-readiness
kind: meta
atomic: —
spec: specs/Site Readiness Review.md
frame: null
owns:
  - 'The record of the site-scope review: what a browsable multi-page build still needs'
does_not_own:
  - 'Any build instruction — this file is a decision record, not spec'
depends_on: [coverage]
states: []
a11y: []
tokens: []
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

# Site Readiness Review

Product-design review, 2026-08-21. Follows `Coverage Review.md`, which asked "can we replicate the page?"
This one asks the next question: **can we replicate the site?**

## Scope, as confirmed in review

| Question                                 | Answer                                                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| What must a developer be able to finish? | Several real pages with a working sidebar tree — a site you can browse.                   |
| Is the table in scope?                   | No. The table is the product. The docs site only hosts it inside Preview Window canvases. |
| Which page types exist?                  | Doc article, plus a landing / home page. Page count not yet known.                        |
| Is there a Figma file?                   | No, and none is planned.                                                                  |
| Who maintains the specs?                 | One person, who wants to maintain exactly one source.                                     |
| What generates the code?                 | An AI agent reading these Markdown specs.                                                 |

## Verdict

**Component and page coverage is sufficient. Site-level coverage is not.**

Every spec answers "what does this look like and how does it behave when touched." Nothing answers
"what does this site contain, and how does one page know it is the current one." Five page archetypes
exist, but a page archetype is a template — it does not say how many pages there are, what they are
called, how they nest, or what the sidebar reads to draw itself.

An agent handed this repo today builds five beautiful templates and then stalls at the first link.

## Gaps — ranked

### 1. ~~No content model~~ — closed 2026-08-21

`Content Model.md` written: two-level tree, entry fields (`label` / `slug` / `archetype`, optional
`eyebrow` / `hidden`), flatten-for-prev-next order, active state by exact slug match. The page list
itself is seeded from the frames and deliberately incomplete — sections 2 and 4+ are authored content,
not design. Where the tree physically lives is left as an implementation choice.

Original finding, for the record:

The single highest-value missing spec. The sidebar tree, the TOC, the prev/next Pagination Footer,
the search index, and the active state of every nav item are five views of **one** structure, and that
structure is written down nowhere. Today an agent would hand-author each of them per page, and they
would disagree by the third page.

Needs one file defining the nav tree as data — sections, ordered items, labels, slugs, page archetype
per entry — and stating that all five consumers derive from it.

### 2. ~~No home page spec~~ — closed 2026-08-21

`pages/Home.md` written. A marketing page at `/`, no sidebar, no TOC, off the 3-column grid, inspired by
`angularprimitives.com`: hero → logo row → feature grid → install command → testimonials → footer. Its
hero visual, company logos, and testimonial avatars are placeholders — real assets still needed. The
section eyebrow / H2 / one-paragraph opening is the page's repeating device; the four page-local blocks
(hero, logo row, feature grid, testimonial) stay page-local until a second page needs them.

Original finding, for the record:

`Section Landing` is a _section_ index inside the docs shell. A product home page is normally a
different animal: no sidebar, no TOC, wider than the content column, hero and feature blocks that
have no equivalent anywhere in the component set. It is the one confirmed page type with zero coverage.

Needs its own archetype, and an explicit statement of which shell regions it drops.

### 3. ~~Routing and current-page state~~ — closed 2026-08-21

`Routing and Page State.md` written: three-step resolution (`/` → exact slug → `Not Found`), the page-state
fields every surface reads, a per-surface consequence table, hash behavior on load vs. in-page nav, title
composition, and the three things a client-side route change must do explicitly (scroll reset, focus to
H1, title before focus).

One inconsistency surfaced while writing it and was resolved the same day: every docs entry now lives
under `/docs`, so the marketing zone and the docs zone can never collide and the zone test is a prefix
check rather than a lookup.

Original finding, for the record:

Given a URL, what is lit up? Which sidebar section is expanded, which item is active, what the TOC is
tracking, what prev/next point at, what the document title is. Each component specs its own active
_appearance_; nothing maps a location to a set of states.

### 4. ~~Search index source~~ — closed 2026-08-21

`Search Index.md` written. One record per heading rather than per page (a page-level record makes a table
of contents, not a search); H2/H3 only, matching the TOC; groups are tree sections in tree order, never
reordered by score; prefix and substring matching, no fuzzy; inline code indexed but code blocks not.
Home is excluded — its copy is positioning, not documentation.

Original finding, for the record:

`Search.md` fully specs the surface — field, overlay, grouped results, empty and no-match states.
It does not say what is indexed (headings? body prose? code?), where the result groups come from, or
what happens on select. For an agent, the visual half without the data half is unbuildable.

### 5. ~~Assets and content source~~ — closed 2026-08-21

`Assets and Content Source.md` written: a seven-row asset inventory with honest status, a placeholder
policy (reserved box at final dimensions, never a stock stand-in), self-hosted subset fonts with two
preloads, and Markdown-per-entry keyed by slug. The load-bearing rule is **the tree is the index, the
file is the body** — a content file never declares its own label or order, or the sidebar degrades into a
directory listing.

Still blocked on real artwork: logo, favicon, OG image, hero visual, company logos, avatars. I cannot
generate any of those.

Original finding, for the record:

Logo and wordmark, favicon, OG image, how Inter is delivered, and where article content comes from
(Markdown files? MDX? a CMS?). Small, but every one of them blocks a first build.

### 6. Carried forward from Coverage Review, still open

- ~~Focus order and skip link~~ — closed 2026-08-21: `foundations/Focus and Keyboard.md`. Tab order follows
  landmark order with no positive `tabindex`; the TOC sits after `main` in the DOM so a reader reaches the
  article's own links first. One skip link, focus moved to the H1 rather than the hash.
- ~~Sidebar and TOC sticky vs. scroll~~ — closed 2026-08-21: both sticky at the 72px scroll offset with
  their own `max-height` and overflow scroll, so a long tree or heading list scrolls within its column
  instead of clipping.
- ~~Code block on mobile~~ — closed 2026-08-21: horizontal scroll, never wrap.
- ~~404~~ — closed, `pages/Not Found.md` now exists.
- ~~Marketing H2 size~~ — closed 2026-08-21: `--ngpt-sys-typescale-headline-marketing`, 36px.

### 7. Fixed 2026-08-21 — spec-vs-spec contradictions

Found on a second read; all three would have misled a generator.

- **Drawer overlay token collision.** `Sidebar Navigation.md` cited `--ngpt-sys-z-drawer-overlay`, which foundations never defined, in a row that read as a color. Replaced with the four real tokens (`-z-drawer`, `-z-drawer-scrim`, `-scrim`, `-scrim-blur`) and a pointer to the shared scrim.
- **Responsive band contradiction.** The collapse table claimed 640–1439px was single-column; the CSS beside it collapsed at 1023px. The CSS was right; the table now has a 1024–1439px row.
- **Desktop drawer leak.** `.sidebar-drawer { display: none }` sat inside the `max-width` query, so nothing hid the drawer above 1024px. Moved outside.

`Table Row.md` was also checked — its `does_not_own` already disclaims the product table, so no change needed.

## The Figma question — declined

The original question was whether to split the specs so each maps to a Figma frame a developer
generates code from.

**Do not.** There is no Figma file, none is planned, one person maintains the specs, and the consumer
is an agent reading Markdown. Splitting one-file-per-state would double the file count, put behavior
and appearance in different files, and defeat the property that makes this repo work: _one component,
one file, enough context._

Two sources of truth drift within weeks unless someone owns both. Here, nobody would. So the docs stay
the single source of truth.

What that _does_ imply — because an agent cannot infer what a human designer would have eyeballed from
a frame:

- **Say what is intentionally absent.** An agent reads silence as an invitation. `does_not_own` already
  does this per component; page archetypes need the same for regions they drop.
- **Composition needs to be ordered and explicit.** A frame shows arrangement for free. Prose must state
  it: what sits in what, in what order, at what gap.
- **`Table Row.md` needs a boundary note.** It is demo content inside a preview canvas, not docs chrome —
  otherwise an agent will try to build the product table from it, which review already ruled out of scope.

## Recommended order

1. Content model — unblocks four other things at once.
2. Home page archetype.
3. Routing and current-page state.
4. Search index source; assets and content source.
5. The four carried-forward behavior gaps.

Steps 1–3 are what stand between "five good templates" and "a site you can browse."
