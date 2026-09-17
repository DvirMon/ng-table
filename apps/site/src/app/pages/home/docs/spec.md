---
kind: page
archetype: Home
composes_only: false
rule: >
  This file assigns components to slots and sets page-only decisions.
  Unlike the other page archetypes it introduces page-local blocks that exist nowhere else;
  those are defined here and are not components. Styling values still live in foundations.
---

> Distributed here from the design handoff bundle (`apps/site/docs/design-handoff/`) during Wave 0 spec distribution — spec wins over the reference frame there.

# Page — Home

The marketing page at `/`. Not a docs page: it drops the sidebar and the TOC, and it is the only
page in the system that is not built on the 3-column grid.

Reference for structure and section order: `angularprimitives.com`.

## What it drops

| Region | On docs pages | Here |
| --- | --- | --- |
| `sidebar` | Left column, 270px | **Absent.** No hamburger below `md` either — there is no tree to open. |
| `toc` | Right column, 220px | **Absent.** |
| Page grid | 3 columns, 1440px max | **Absent.** Full-width sections, each with its own inner max-width. |
| Navbar surface | `--ngpt-bg-deep`, bottom border, sticky | **Sticky, but two-state.** Over the band it is the band's own color with no border; past 24px of scroll it becomes `--ngpt-navbar-scrolled` (`#18181C`) with a `--ngpt-border-subtle` bottom edge and a soft shadow. |
| `category-badge` eyebrow | Section name | Used as the section eyebrow (see below), not as a page eyebrow. |
| `pagination` | Prev/next | **Absent.** Home is not in the nav tree order. |

Kept: `navbar` (with search) and `page-footer`.

## Slots

| Order | Slot | Component | Page-only decision |
| --- | --- | --- | --- |
| 1 | shell | — | Full-width vertical stack. Not `page-shell`'s grid. |
| 2 | header | `navbar` | **Sticky, two-state** — band-colored over the hero, `--ngpt-navbar-scrolled` once scrolled. Inner row at the 1080px wide measure so the logo aligns with the hero copy. Contents: search field, **Documentation**, **GitHub** — no Sponsor pill, no status dot, no Discord; those stay on the docs bar. No hamburger. Links are unfilled — a darkening pill on hover only. |
| 3 | hero | page-local | Full-bleed `--ngpt-accent-surface` band — see below |
| 4 | features | page-local | See below |
| 5 | install | `prose` H2 + one paragraph + a command row | Single shell line with a 30×30 copy `icon-button` on its right, inside one bordered surface. No line numbers. |
| 6 | footer | `page-footer` | Gains a link row (Sponsor / Discord / GitHub) above the copyright line |

**Four sections, not seven.** A logo row and a testimonial grid were specified and are now **cut** —
both needed assets that do not exist (monochrome company logos, real avatars and real quotes), and a
marketing page carrying two placeholder blocks reads worse than one that stops after the install command.
If either returns it comes back as a new decision, not as a revived description.

## Section rhythm

Every section from 4 onward follows the same three-part opening, which is the page's main
repeating device:

1. `category-badge` as an eyebrow — About, Get Started
2. `prose` H2 at `--ngpt-sys-typescale-headline-marketing`, rendered `clamp(26px, 3.4vw, 36px)` — not the
   docs `title-large` (19px), which made the page read as documentation rather than marketing
3. optional single paragraph capped at the prose measure, then the section's own content

Sections after the hero alternate between `--ngpt-bg-app` and `--ngpt-bg-deep` so the
boundaries read without rules or borders. The hero band is `--ngpt-accent-surface` and is the only
colored surface on the page — no gradients, no third neutral.

**One left rail.** Every section — the band included — uses the same horizontal padding,
`clamp(24px, 4vw, 48px)`, and the same 1080px centered wide measure inside it. So the announcement pill,
the H1, the lede, the buttons, every section eyebrow and H2, and both grids all begin at one x.

The prose measure is a **cap on the copy, not a container**: headings and paragraphs are capped at 720px
from that rail rather than centered in their own narrower column. An earlier version centered a 720px
block inside the wide measure, which put section headings 65px right of the H1 above them and the grids
13px left of both — three rails in one scroll. A centered inner measure cannot share a left edge with
the thing above it; only a cap can.

| Measure | Value | Applies to |
| --- | --- | --- |
| Wide | 1080px, centered | Every section's content box |
| Prose cap | 720px, from the rail | Headings, paragraphs, the install command |

Section padding is `clamp(64px, 8vw, 96px)` vertical.

**How the responsive steps are achieved.** No media queries. The feature grid uses `auto-fit` with a
minimum track (`minmax(240px, 1fr)`), so 3→2→1 happens by measure rather than by breakpoint. Section padding is `clamp(64px, 8vw, 96px)` and the hero
H1 is `clamp(38px, 6vw, 64px)`. The collapse is therefore continuous rather than stepped, and the page
stays inline-styled.

## Page-local blocks

These exist only here. They are **not** components and must not be added to `specs/index.md`
unless a second page needs them.

### Hero — full-bleed accent band

The hero is a band of `--ngpt-accent-surface` that runs edge to edge and **contains the navbar**. It is
the page's one block of color and the reason no other section is tinted.

- Navbar reads as part of the band: no border, no shadow, its background matching
  `--ngpt-accent-surface` exactly. Logo mark and text go white; the search field becomes a translucent
  white well (`oklch(1 0 0 / 0.12)`, border `/ 0.28`). Its inner row shares the hero's 1080px wide
  measure, so the logo aligns with the announcement pill and H1.
- **Scrolled state.** The navbar is `position: sticky` at `top: 0`. Past 24px of scroll it swaps to
  `--ngpt-navbar-scrolled` (`#18181C`) with a `--ngpt-border-subtle` bottom border and
  `0 4px 16px oklch(0 0 0 / 0.35)`, over 180ms. That value is its own token rather than `--ngpt-bg-deep`:
  the bar has to separate from the dark sections passing underneath it, and matching them would erase
  the edge. The threshold is a boolean, not a gradient, so the bar never flickers mid-scroll. Every
  other element in the bar keeps its white treatment: only the surface changes.
- **Navbar links carry no fill or border.** White label on the band, and on hover a pill that **darkens**
  the band (`oklch(0 0 0 / 0.15)`) rather than lightening it. A solid pill here competes with the hero's
  primary action, which is the one filled thing on the band. The fill darkens for the same reason the
  announcement pill does: a translucent *white* fill raises the local background and drops the white
  label to 3.84:1, below AA. Darkening takes it to 6.17:1.
- A large soft white shape (`oklch(1 0 0 / 0.07)`, ~28% radius) sits to the right of the copy, bleeding
  off the top-right. Its clearance is **structural, not coincidental**: it is anchored by its left edge
  at `calc(max(<band padding>, (100vw - 1080px) / 2) + 700px)`, i.e. 40px past the copy column's own
  right edge wherever that column happens to start. An earlier version anchored it from the right with
  `right: -80px`; that held at wide viewports but broke once `clamp()` hit its floor and the shape
  stopped shrinking while the copy column kept its width. Anchoring from the left removes the failure
  mode entirely — the shape simply runs further off-screen as the viewport narrows, and the band's
  `overflow: hidden` clips it. Decorative: `aria-hidden`, `pointer-events: none`.
- Content is **left-aligned** in the 1080px wide measure, copy capped at 660px — not centered.
- An **announcement pill** above the H1: translucent white, a colored status dot, one short line. This is
  not the `category-badge`; it is page-local and appears once.
- H1 at `--ngpt-sys-typescale-display-large` (64px), rendered `clamp(38px, 6vw, 64px)` — all white; the
  accent second line is dropped, since the band is already the accent. The token is 64px because this is
  the only place it is used and the clamp's ceiling is the real design size.
- Two filled buttons, no outline variant: white primary, near-black secondary. On an accent band an
  outlined pill has nothing to sit against — see the **on-band** variant in `Pill Button.md`. There is
  no accent-filled pill in the system.
- The band closes with its own bottom padding (`clamp(32px, 4vw, 52px)`).
  An earlier version anchored a 16:9 hero visual to the band's bottom edge with
  `border-radius: 12px 12px 0 0` so it read as continuing past the fold; **that visual was removed** and
  the band now ends on the buttons. If artwork returns, restore the zero bottom padding with it.

**Contrast.** The band runs at `--ngpt-accent-surface` = `oklch(0.55 0.25 328)`, which is deliberately
darker than `--ngpt-accent` (`oklch(0.68 0.22 328)`). On the accent white measures 3.21:1 and the 16px
lede would fail AA; 0.55 brings white to 5.60:1, so the H1, the lede and the buttons all pass. The two
tokens are therefore **not** interchangeable: the accent is for type and state on dark, the surface is
for this band.

Body copy on the band is **full white**, never a reduced alpha — `oklch(1 0 0 / 0.85)` measured 3.19:1
and failed. The announcement pill darkens its fill (`oklch(0 0 0 / 0.15)`) rather than lightening it,
for the same reason: a translucent *white* fill raises the local background and drops the label's
contrast below AA.

**Height.** The band is tight — `clamp(28px, 3.5vw, 44px)` top padding and `clamp(32px, 4vw, 52px)`
bottom, with 20px under the pill, 18px above the lede and 26px above the buttons. The actions should
land close under the navbar, not a screen-height away from it.

Superseded by this section: the earlier centered-hero, accent-second-line, and outlined-secondary
descriptions.

### Feature grid

`repeat(auto-fit, minmax(240px, 1fr))` — three tracks at the full wide measure, two and then one as it
narrows, by measure rather than by breakpoint. Six cells, so it reads as 3×2 on a desktop. Each cell is a
`prose` H3 and one paragraph at body-medium, left-aligned on the plain section background. No cards, no borders, no tint, no icons —
the grid gap carries the separation. Six cells; if a seventh is ever needed, cut one instead.

The accent-tinted block treatment trialled here was withdrawn once the hero became a full-bleed accent
band: two accent surfaces on one page compete, and the hero wins.

### Install command row

Not a `code-block` — a flex row inside one bordered `--ngpt-bg-deep` surface: the `$`-prefixed command
on the left (`overflow-x: auto`, `min-width: 0` so it scrolls rather than pushing the button out), a
**Copy** button on the right. Capped at the 720px prose measure.

The button is a 30×30 `icon-button` — glyph only, no text label. It has **three states**, and every one
of them is visible:

| State | Glyph | Color |
| --- | --- | --- |
| idle | copy | `--ngpt-text-secondary` |
| copied | check | `--ngpt-status-success` |
| failed | alert | `--ngpt-status-error` |

The non-idle states hold for `--ngpt-comp-icon-btn-confirm-hold` (1400ms), then revert — the same hold
every copy affordance in the system uses (`foundations/Motion.md` § Per-pattern table). The states and
their colors are `Icon Button.md` § Confirmation variant; this page only says which button carries them. `aria-label` and `title` change with the glyph, so the
state is announced and hoverable rather than conveyed by color and shape alone — and on failure the label
tells the reader to select the command manually.

The glyphs are placeholders per `foundations/Iconography.md` — swap for the real library's copy and
check icons at the 14px size step.

Window chrome (traffic lights, a header bar) was considered and declined: the docs' own `code-block` has
none, and adding it here would make the marketing page's code look like a different system.

## Page-only rules

- **No theme toggle.** The reference site has one; this system is dark-only and that decision stands.
- One H1 on the page, in the hero, at `--ngpt-sys-typescale-display-large` rendered as a clamp. Every other section heading is an H2 at
  `clamp(26px, 3.4vw, 36px)`. Both are marketing steps and never appear on a docs page.
- Buttons only in the hero and the navbar. The feature grid has no actions.
- The install command uses `code-block` with the gutter omitted — one line needs no numbers.
- Home is not in the nav tree, has no prev/next, and is never the active sidebar item.

## Frame notes

`pages/Home Page.dc.html` is annotated per `specs/Frame Annotation.md`; every word of its copy is `MOCK`.
The frame matches this spec section for section — the logo row and testimonials are cut from both.

## Open

- The logo mark is still a 22px rounded square. Real artwork needed — see `Assets and Content Source.md`.
- Whether the navbar's product name links to `/` or to the docs root.

## Decided 2026-08-22

- Logo row and testimonials: **cut.** Both were asset-blocked; see the note under § Slots.
- Band navbar carries Documentation and GitHub only. **No Sponsor pill** — it stays on the docs bar.
- `--ngpt-sys-typescale-display-large` **moves to 64px**, matching the clamp's ceiling.
