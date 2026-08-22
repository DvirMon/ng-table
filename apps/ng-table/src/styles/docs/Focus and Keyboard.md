---
id: focus
kind: foundation
atomic: —
spec: specs/foundations/Focus and Keyboard.md
frame: null
owns:
  - "Document tab order and the landmark structure it follows"
  - "The skip link"
  - "Focus-visible policy and where the ring is suppressed"
  - "Focus handling across route changes, overlays, and the mobile drawer"
does_not_own:
  - "The focus ring's color or width — see foundations/Color.md"
  - "Any component's internal key handling — each component spec owns its own"
  - "Scroll-spy — see layout/TOC Column.md"
depends_on:
  - "layout/Page Structure Overview.md (region order)"
  - "Routing and Page State.md (route-change focus)"
  - "Search.md (overlay focus trap)"
  - "layout/Sidebar Navigation.md (drawer)"
states:
  - "keyboard focus visible"
  - "pointer focus (ring suppressed)"
  - "focus trapped (overlay open)"
a11y:
  - "Single skip link, first in tab order, visible on focus"
  - "One focus ring token everywhere; never removed without a replacement"
tokens: [--ngpt-focus-ring, --ngpt-sys-layout-scroll-offset]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

> Distributed here from the design handoff bundle (`apps/ng-table/docs/design-handoff/`) during Wave 0 spec distribution — this is the single source of truth for its token `:root` block; `src/styles/tokens/` mirrors it verbatim.

# Focus and Keyboard

The last accessibility gap. A focus ring token existed; nothing said what order things receive it in.

## Landmark order

Tab order follows DOM order, and DOM order is the landmark order in
`layout/Page Structure Overview.md`. No `tabindex` above 0 anywhere — a positive tabindex jumps the
document out of source order and every later insertion has to be renumbered.

1. Skip link
2. `banner` — the navbar: logo, search field, right-group links
3. `navigation` — the sidebar tree, in tree order
4. `main` — the content column, including the pagination footer
5. `complementary` — the TOC
6. `contentinfo` — the page footer

The TOC sits after `main` in the DOM even though it renders to the right of it. A reader tabbing through
an article should reach the article's own links and its prev/next before a duplicate list of its
headings. Grid placement puts it visually right; source order keeps it out of the way.

## Skip link

One link, the first focusable element in the document, targeting `main`. Visually hidden until focused,
then it appears pinned top-left over the navbar — not reflowing the page, which would make the first Tab
look like a layout break.

On activation, move focus to the content column's H1 (`tabindex="-1"` on the H1, focus it directly).
Setting the hash alone scrolls without moving focus, so the next Tab would continue from the skip link
and the reader would land back in the navbar.

One link only. Skip-to-search and skip-to-nav are three decisions at the top of every page in exchange
for saving a handful of Tab presses.

## Focus visibility

`:focus-visible`, never `:focus` — a pointer click should not leave a ring behind.

Every focusable element shows `--ngpt-focus-ring`. The ring is never removed without a replacement
indicator; `outline: none` alone is a defect. Where a component's own border already changes on focus,
the ring still renders — the border shift is too subtle to be the only signal on a dark surface.

Focused elements must be scrolled clear of the sticky navbar by
`--ngpt-sys-layout-scroll-offset`, the same offset heading anchors use. `scroll-margin-top` on
focusable elements handles this declaratively.

## Overlays

The search overlay and the mobile drawer both trap focus, and both follow the same contract:

1. On open, focus moves into the surface — the search input, or the drawer's first nav item.
2. Tab cycles within the surface only.
3. Escape closes and **restores focus to the element that opened it**, along with the prior scroll
   position.
4. The page behind is scroll-locked and its content is `aria-hidden` while the surface is open.

`Search.md` owns the search overlay's key table; `layout/Sidebar Navigation.md` owns the drawer's. This
file owns only the four rules they share.

## Route changes

Per `Routing and Page State.md`: on a client-side route change, focus moves to the content column's H1
and the title updates before focus moves. Without that, focus stays on the clicked sidebar item and a
screen-reader user gets no signal that the page changed.

A hash-only change does **not** move focus — it is in-page navigation, and stealing focus mid-article is
disorienting. `layout/TOC Column.md`'s scroll-spy is a visual affordance and never moves focus.

## Reduced motion

Under `prefers-reduced-motion: reduce`, the smooth scroll on TOC and skip-link activation becomes an
instant jump. The destination and the focus target are identical either way; only the transit changes.
