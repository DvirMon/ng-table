---
id: assets
kind: foundation
atomic: —
spec: specs/Assets and Content Source.md
frame: null
owns:
  - 'The brand asset inventory: what files exist, at what sizes, in what format'
  - 'Font delivery'
  - 'Where article content lives and how it maps to tree entries'
  - 'Placeholder policy for assets that do not exist yet'
does_not_own:
  - 'Type scale or family choice — see foundations/Typography.md'
  - 'Icon library choice — see foundations/Iconography.md'
  - 'The tree — see Content Model.md'
  - 'Hosting, CDN, or build pipeline'
depends_on:
  - 'Content Model.md (entries and slugs)'
  - 'foundations/Typography.md (families and weights)'
states: []
a11y:
  - 'Every content image needs authored alt text; decorative marks are aria-hidden'
tokens: []
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

# Assets and Content Source

Six small unknowns, each of which blocks a first build. None are design decisions in the interesting
sense; they block because nobody wrote them down.

## Brand assets

| Asset               | Spec                                                                                                | Status                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Logo mark           | SVG, square, single-color, `currentColor` so the band and the docs navbar share one file            | **Does not exist.** A 22px rounded square stands in.            |
| Wordmark            | Text, not artwork — "NGP Table", set in `--ngpt-sys-typescale-title-nav` per `layout/Top Navbar.md` | Exists by definition                                            |
| Favicon             | The mark as `.ico` (16/32) plus a 180px `apple-touch-icon.png`                                      | **Does not exist**                                              |
| OG image            | 1200×630 PNG: wordmark and the hero's one-line positioning on `--ngpt-accent-surface`               | **Does not exist**                                              |
| Hero visual         | 16:9, product screenshot or diagram                                                                 | **Does not exist.** Removed from the band; see `pages/Home.md`. |
| Company logos       | Monochrome, single-color, ~132×34 optical                                                           | **Do not exist.** Placeholder slots on Home.                    |
| Testimonial avatars | 40px square, round-cropped by CSS not by file                                                       | **Do not exist**                                                |

The mark should be a single `currentColor` SVG rather than a light and a dark file. The system is
dark-only, but the band inverts it to white, and one file that inherits color handles both.

I cannot generate any of these. Diagrams and wireframes yes; brand artwork and photography no.

## Placeholder policy

An asset that does not exist is a **reserved box at final dimensions**, never a stretched stand-in and
never a stock substitute. It keeps layout honest: the page's proportions are the real ones, so dropping
the artwork in later changes nothing but the pixels inside the box.

Every placeholder states what belongs there. Every one is inventoried above, so shipping with a hole is
a choice rather than an oversight.

## Fonts

Inter (400/500/600/700) and JetBrains Mono (400) — `foundations/Typography.md` owns which is used where.

**Google Fonts, both families** (decided 2026-08-22 — self-hosting was specified first and reversed: the
woff2 subsets were never produced, and a spec nobody can satisfy is worse than a third-party request).

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400&display=swap"
/>
```

`display=swap` is what keeps first paint readable — a docs site is read, and unstyled text beats no text.
Both `preconnect` hints are required; without them the font request waits on a fresh connection to
`fonts.gstatic.com`. Weights are pinned to the five faces the type scale actually uses, so the request
never grows by accident.

No variable font: five static faces across two families is smaller than two variable files here.

The cost is a third-party request on every page and the privacy question that comes with it. Accepted for
now; self-hosting the same five faces is a swap of these three tags for a `@font-face` block and changes
nothing else in the system. The frames already load exactly this.

## Content source

Article prose lives in **Markdown files, one per tree entry**, keyed by slug: an entry with slug
`/docs/state-layer/architecture` reads `content/state-layer/architecture.md`. The `/docs` prefix is a
routing concern and does not appear in the content path.

The rule that matters: **the tree is the index, the file is the body.** A content file never declares
its own label, order, or place in the nav — those live in `Content Model.md`. Front matter is for
page-local overrides only (`eyebrow`, `hidden`). A file with no tree entry is not reachable and is not
indexed; a tree entry with no file is a build error, not a blank page.

That split is what keeps five surfaces agreeing. Let files declare their own order and the sidebar
becomes a directory listing, which is exactly the drift `Content Model.md` exists to prevent.

Headings in content are H2 and H3 only. The H1 is composed from `entry.label` by the page archetype —
authoring an H1 in the file would let it disagree with the nav item and the browser tab.

`API Reference` and `Examples Gallery` pages read the same Markdown; their archetypes differ in slot
composition, not in content source.

## Open

- Whether MDX (Markdown plus components) is needed for `Preview Window` embeds, or whether a fenced
  block with a language tag is enough. Depends on how many live examples the docs actually carry.
- Whether the OG image is authored once or generated per page. Once is fine until the page list is
  complete.
