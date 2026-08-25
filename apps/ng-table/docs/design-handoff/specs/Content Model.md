---
id: content-model
kind: foundation
atomic: —
spec: specs/Content Model.md
frame: null
owns:
  - "The nav tree: sections, their order, their entries, and each entry's label / slug / archetype"
  - "The rule that sidebar, TOC, pagination, search, and active state all derive from this tree"
  - "Entry field definitions and slug rules"
does_not_own:
  - "How any of those five surfaces look — see their own specs"
  - "The prose inside a page (authored per route)"
  - "Which heading levels a TOC shows — see layout/TOC Column.md"
depends_on:
  - "pages/*.md (archetype names)"
states: []
a11y: []
tokens: []
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

# Content Model

The site's page list, in order, in one place.

Five specced surfaces are all views of this one structure. None of them may be hand-authored per page:

| Surface | What it derives |
| --- | --- |
| `sidebar` | Sections and their entries, in tree order |
| `toc` | Headings of the current entry only |
| `pagination` | Prev/next = the entries either side of the current one, in flattened tree order |
| `search` | Result groups = sections; result items = entries |
| active state | Which `nav-item` is active, which section reads as current |

If two of these ever disagree at runtime, one of them was hand-authored. That is the bug.

## Shape

The tree is an ordered list of sections. Each section is an ordered list of entries. Two levels, no deeper — the sidebar has no expand/collapse affordance, so a third level has nowhere to render.

```
tree:
  - section: "<label>"           # uppercase treatment is presentational, not stored
    entries:
      - label: "<nav + H1 text>"
        slug: "/<path>"
        archetype: "Doc Article" | "Section Landing" | "API Reference" | "Examples Gallery"
```

One entry may sit outside any section (the docs root, "Overview"). It renders above the first section label.

## Slug prefix

Every entry in the tree lives under `/docs`. The docs root is `/docs` itself; everything else is
`/docs/<section>/<entry>`.

The site has two zones — a marketing page at `/` and the docs — and the prefix is what keeps them from
colliding. A future `/pricing` or `/blog` can never shadow a docs slug, and the zone test stays
mechanical: paths under `/docs` get the docs shell, paths outside it do not. No lookup, no exception for
the root.

The cost is longer URLs. Accepted.

## Entry fields

| Field | Required | Rule |
| --- | --- | --- |
| `label` | yes | Single source for three things: the sidebar item, the page H1, and the pagination card. They are never worded differently. |
| `slug` | yes | Absolute, leading slash, no trailing slash, lowercase, hyphenated. **Every docs entry begins `/docs`** — see the prefix rule above. The route, and the anchor-free part of every link to this page. |
| `archetype` | yes | Must name a file in `specs/pages/`. Determines the page's slot composition. |
| `eyebrow` | no | Overrides the `category-badge` text. Defaults to the parent section's label — see `pages/Doc Article.md`. |
| `hidden` | no | Excluded from the sidebar but still routable and still indexed. Use sparingly. |

`Not Found` is an archetype but never an entry — it has no slug and no place in the order.

## Order

Tree order is the only order. Flatten the tree top to bottom to get the reading sequence that `pagination` walks.

- Prev/next cross section boundaries. The last entry of one section is followed by the first entry of the next.
- The first entry has no prev; the last has no next. `pagination` omits the missing side.
- `hidden` entries are skipped when walking prev/next.
- Sections are not themselves navigable targets. A section label is a heading, not a link.
- A section whose entries are all `hidden`, or which has none, renders nothing at all — no label above an
  empty group. `layout/Sidebar Navigation.md` owns that.

## Active state

Exactly one entry is active at a time, resolved by exact `slug` match against the current path.
`Routing and Page State.md` owns that resolution and the full per-surface consequence table; this file
owns only the tree it reads.

- That entry's `nav-item` carries `is-active` and `aria-current="page"`.
- Its parent section reads as current. Whether that means the `--accent` nav-item variant is per-page — `pages/Doc Article.md` sets it.
- On an unmatched path, nothing is active, and the page is `Not Found`.
- A `#hash` in the URL never changes which entry is active; it only moves the TOC's own active item.

## Seed tree

Filled from the source docs at `libs/shared/table/docs/` (2026-08-25). `Architecture` and `PRD` files are
repo-internal (contributor-facing spec docs, not consumer API docs) — **dropped from the tree entirely**,
same call in every section that had one (State Layer, Columns, UI Layer). They stay where they are under
`libs/shared/table/docs/`, never routed on the docs site. State Layer and UI Layer keep separate entries
per feature (e.g. two "Sorting" pages, one per layer) — same label, different section, different slug;
each entry's own label still matches its own sidebar item / H1 / pagination card 1:1, so this does not
violate the label rule above. Section "2. Columns" was inferred from the `2-columns/` doc folder sitting
numerically between state (1) and UI (3) — not requested, flag before relying on it. Section "0. Getting
Started" is new consumer-facing content with no source doc yet — Installation and First Table need
authoring; "Building a Custom Feature" can likely draw on the `with-*()` plugin pattern already documented
across State Layer, but still needs its own walkthrough written. Section 4+ still has no source folder —
leave unknown, do not infer.

```
- label: "Overview"
  slug: "/docs"
  archetype: "Section Landing"

- section: "0. Getting Started"    # new — no source doc yet, needs authoring
  entries:
    - label: "Installation"            slug: "/docs/getting-started/installation"        archetype: "Doc Article"
    - label: "First Table"             slug: "/docs/getting-started/first-table"          archetype: "Doc Article"
    - label: "Building a Custom Feature" slug: "/docs/getting-started/custom-feature"     archetype: "Doc Article"

- section: "1. State Layer"
  entries:
    - label: "Columns"               slug: "/docs/state-layer/columns"           archetype: "Doc Article"
    - label: "Row Mutations"         slug: "/docs/state-layer/row-mutations"     archetype: "Doc Article"
    - label: "Drag & Drop"           slug: "/docs/state-layer/drag-drop"         archetype: "Doc Article"
    - label: "Expansion"             slug: "/docs/state-layer/expansion"         archetype: "Doc Article"
    - label: "Filtering"             slug: "/docs/state-layer/filtering"         archetype: "Doc Article"
    - label: "Grouping"              slug: "/docs/state-layer/grouping"          archetype: "Doc Article"
    - label: "Infinite Scroll"       slug: "/docs/state-layer/infinite-scroll"   archetype: "Doc Article"
    - label: "Pagination"            slug: "/docs/state-layer/pagination"        archetype: "Doc Article"
    - label: "Row Editing"           slug: "/docs/state-layer/row-editing"       archetype: "Doc Article"
    - label: "Selection"             slug: "/docs/state-layer/selection"         archetype: "Doc Article"
    - label: "Sorting"               slug: "/docs/state-layer/sorting"           archetype: "Doc Article"
    - label: "Virtual Scroll"        slug: "/docs/state-layer/virtual-scroll"    archetype: "Doc Article"

- section: "2. Columns"    # inferred from 2-columns/ — confirm before relying on it
  entries:
    - label: "Column Metadata"       slug: "/docs/columns/column-metadata"       archetype: "Doc Article"
    - label: "Data-Derived Columns"  slug: "/docs/columns/data-derived"          archetype: "Doc Article"
    - label: "Ownership Model"       slug: "/docs/columns/ownership-model"       archetype: "Doc Article"
    - label: "Signal Forms Techniques" slug: "/docs/columns/signal-forms-techniques" archetype: "Doc Article"
    - label: "Tier 1 — Intrinsic"    slug: "/docs/columns/tier-1-intrinsic"      archetype: "Doc Article"
    - label: "Tier 2 — Layout"       slug: "/docs/columns/tier-2-layout"         archetype: "Doc Article"
    - label: "Tier 3 — Feature Config" slug: "/docs/columns/tier-3-feature-config" archetype: "Doc Article"

- section: "3. UI Layer"
  entries:
    - label: "Core Directives"       slug: "/docs/ui-layer/core"                 archetype: "Doc Article"
    - label: "Column Identity"       slug: "/docs/ui-layer/columns"              archetype: "Doc Article"
    - label: "Sort"                  slug: "/docs/ui-layer/sort"                 archetype: "Doc Article"
    - label: "Selection"             slug: "/docs/ui-layer/selection"            archetype: "Doc Article"
    - label: "Expansion"             slug: "/docs/ui-layer/expansion"            archetype: "Doc Article"
    - label: "Grouping"              slug: "/docs/ui-layer/grouping"             archetype: "Doc Article"
    - label: "Drag & Drop"           slug: "/docs/ui-layer/drag-drop"            archetype: "Doc Article"
    - label: "Resizing"              slug: "/docs/ui-layer/resizing"             archetype: "Doc Article"
    - label: "Row Reorder Animation" slug: "/docs/ui-layer/row-animation"        archetype: "Doc Article"   hidden: true  # not implemented — draft, not ticketed
    - label: "Accessibility"         slug: "/docs/ui-layer/accessibility"        archetype: "Doc Article"
    - label: "Styling & Tokens"      slug: "/docs/ui-layer/styling-tokens"       archetype: "Doc Article"
    - label: "Virtual Scroll"        slug: "/docs/ui-layer/virtual-scroll"       archetype: "Doc Article"
```

Section 4+ is referenced by the numbering but its entries are still unknown — no source folder exists for it.

The frames show a pagination card reading "State Layer Architecture", which is a *composed* string
(section + label). **Resolved 2026-08-22: the card shows `label` alone.** `label` is the single source for
the sidebar item, the H1 and the card, and they are never worded differently — a composed card title
re-introduces exactly the drift this file exists to prevent. See `Pagination Footer.md` § Build spec.

## Open

- Where the tree physically lives (a JSON/YAML file, front-matter across content files, or a generated manifest) is an implementation choice this spec does not make. It only requires that there be exactly one.
- ~~The seed tree is inconsistent about prefixes~~ **resolved 2026-08-21:** every docs entry lives under
  `/docs` — see the prefix rule above.
- ~~Whether the home page is `/` with the `Section Landing` archetype, or a separate marketing page~~ **resolved 2026-08-21:** `/` is a marketing page with no sidebar — see `pages/Home.md`. It is **not** in the tree, so the first tree entry is the docs root (`/docs`, "Overview"). Home never appears in prev/next and is never the active nav item.
