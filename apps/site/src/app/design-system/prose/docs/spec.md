---
id: prose
kind: component
atomic: Template
spec: specs/Content Prose.md
frame: components/Content Prose.dc.html
owns:
  - 'H1–H4 sizes + margins inside content'
  - 'Heading anchor links and scroll offset'
  - 'Lists, blockquote, hr, strong/em'
does_not_own:
  - 'Inline code and links — see Inline Code Chip.md / Inline Link.md'
  - 'Column width — see layout/Content Column.md'
depends_on:
  - 'foundations/Typography.md (typography)'
  - 'Inline Code Chip.md (code-chip)'
  - 'Inline Link.md (inline-link)'
  - 'foundations/Motion.md (motion)'
  - 'foundations/Spacing.md (spacing)'
states:
  - 'heading default'
  - 'heading hover (anchor visible)'
  - 'anchor focus-visible'
a11y:
  - 'One H1 per page; never skip a level. Anchor links have aria-label="Link to this section".'
tokens:
  [
    --ngpt-sys-typescale-title-medium,
    --ngpt-sys-typescale-title-small,
    --ngpt-sys-space-200,
    --ngpt-accent,
    --ngpt-sys-layout-scroll-offset,
    --ngpt-comp-list-indent,
    --ngpt-sys-typescale-body-medium,
    --ngpt-text-tertiary,
    --ngpt-sys-space-150,
    --ngpt-text-muted,
    --ngpt-sys-space-500,
    --ngpt-sys-space-600,
    --ngpt-border-strong,
    --ngpt-sys-space-400,
    --ngpt-text-secondary,
    --ngpt-text-primary,
    --ngpt-sys-motion-duration-fast,
    --ngpt-sys-motion-easing-standard,
  ]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

> Distributed here from the design handoff bundle (`apps/site/docs/design-handoff/`) during Wave 0 spec distribution — spec wins over the reference frame there.

# Content Prose

Typographic elements that appear inside the Content Column but aren't components: deeper headings, lists, blockquotes, and heading anchor links. `foundations/Typography.md` defines H1/H2 and the body roles; this file covers everything below them.

## API

Attribute-hosted (ADR-0005) — prose applies typography to markup that already has semantics, so it
hosts on the consumer's own element rather than shipping a wrapper tag.

|               |                                                              |
| ------------- | ------------------------------------------------------------ |
| Selector      | `article[ngptProse], div[ngptProse]`                         |
| Class         | `Prose` (`prose.ts`)                                         |
| Template      | `<ng-content />` — pure passthrough, no structure of its own |
| Encapsulation | `ViewEncapsulation.None` — **required**, see below           |
| Host class    | `ngpt-prose` — **required**, see below                       |

| Input     | Type                                                           | Default     | Effect                                                                                                                                    |
| --------- | -------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `measure` | `ProseMeasure` = `'default' \| 'marketing'` (`prose.types.ts`) | `'default'` | Mirrored to `[attr.data-measure]` on the host. `'marketing'` remaps H2 only, to the marketing headline scale for Home's section headings. |

No outputs. No native capability is re-declared as an input.

**Which host element.** Both are legitimate and each has a spec-grounded caller:

- `<article ngptProse>` — a standalone doc page's body, inside the Content Column's
  `<main role="main">`. This is the Doc Article / API Reference / Section Landing archetype.
- `<div ngptProse>` — a prose _run_ inside a larger block, where `<article>` would be a lie:
  Home's section rhythm (`pages/home/docs/spec.md` § Section rhythm, § Slots row 5) puts a
  `category-badge` eyebrow, a prose H2, and one paragraph inside a `<section>`. That fragment is
  not independently distributable, so it is not an `<article>`; and a nested `<article>` inside a
  doc page's own `<article>` would be wrong for the same reason.

```html
<main role="main" class="content">
  <article ngptProse>
    <h1>Architecture</h1>
    <h2 id="sec-signals">
      Signals as the contract<a
        class="heading-anchor"
        href="#sec-signals"
        aria-label="Link to this section"
        >#</a
      >
    </h2>
    <ul>
      <li>Composable via <ngpt-code-chip>withSorting()</ngpt-code-chip></li>
    </ul>
  </article>
</main>

<section>
  <ngpt-category-badge>Get Started</ngpt-category-badge>
  <div ngptProse measure="marketing">
    <h2>Install it</h2>
    <p>…</p>
  </div>
</section>
```

The `.content …` scoping in the HTML/CSS mock below is realized as `.ngpt-prose …` — see
"Encapsulation" in `decisions.md` for why that class is not optional.

## Heading levels

| Level | Font                 | Color                | Margin      |
| ----- | -------------------- | -------------------- | ----------- |
| H1    | 32px / 700 / -0.01em | white                | 0 0 14px    |
| H2    | 19px / 600           | white                | 32px 0 10px |
| H3    | 16px / 600           | white                | 28px 0 8px  |
| H4    | 14.5px / 600         | oklch(0.85 0.01 260) | 20px 0 6px  |

H4 is the floor. A docs page needing H5 has a structure problem, not a typography problem — split the page.

H3 and H4 use `--ngpt-sys-typescale-title-medium` (16px/600) and `--ngpt-sys-typescale-title-small`
(14.5px/600), both defined in `foundations/Typography.md`.

## Anchor links

Every H2, H3, and H4 gets a copyable anchor.

| Property      | Value                                                        | Token                             |
| ------------- | ------------------------------------------------------------ | --------------------------------- |
| Glyph         | `#`                                                          | `—`                               |
| Position      | trailing, 8px after the heading text                         | `--ngpt-sys-space-200`            |
| Color         | oklch(0.68 0.22 328)                                         | `--ngpt-accent`                   |
| Opacity       | 0 default → 1 on heading hover or anchor focus               | `—`                               |
| Transition    | opacity, fast / standard                                     | see `foundations/Motion.md`       |
| Scroll offset | target sits at the scroll offset, clear of the sticky navbar | `--ngpt-sys-layout-scroll-offset` |

Trailing, not leading in the gutter: the content column is only 760px wide inside a 3-column grid, and a hanging gutter glyph collides with the sidebar border at narrow widths. The anchor is a real focusable link, revealed by `:focus-visible` as well as hover, so it's reachable without a pointer.

Uses `scroll-margin-top` rather than a JS offset — the same offset then applies to `#hash` loads, TOC clicks, and browser find-in-page alike.

## Lists

| Property       | Value                    | Token                              |
| -------------- | ------------------------ | ---------------------------------- |
| Padding-left   | 22px                     | `--ngpt-comp-list-indent`          |
| Item font      | 14.5px / 1.65            | `--ngpt-sys-typescale-body-medium` |
| Item color     | oklch(0.62 0.01 260)     | `--ngpt-text-tertiary`             |
| Item spacing   | 6px                      | `--ngpt-sys-space-150`             |
| Marker color   | oklch(0.55 0.01 260)     | `--ngpt-text-muted`                |
| Nested indent  | +20px, one level only    | `--ngpt-sys-space-500`             |
| List margin    | 0 0 24px                 | `--ngpt-sys-space-600`             |
| Ordered marker | decimal, tabular figures | `--ngpt-sys-typescale-body-medium` |

Markers are muted, never accent — a list of ten items shouldn't produce ten accent marks competing with the real links in the text.

## Blockquote

| Property     | Value                           | Token                              |
| ------------ | ------------------------------- | ---------------------------------- |
| Border-left  | 2px solid oklch(0.34 0.005 260) | `--ngpt-border-strong`             |
| Padding-left | 16px                            | `--ngpt-sys-space-400`             |
| Font         | 14.5px / 1.65, not italic       | `--ngpt-sys-typescale-body-medium` |
| Color        | oklch(0.62 0.01 260)            | `--ngpt-text-tertiary`             |
| Margin       | 24px 0                          | `--ngpt-sys-space-600`             |

No italic and no quotation marks: quoted material here is usually spec text or error output, where italics hurt legibility.

## Inline elements

Links follow `specs/Inline Link.md`; inline code follows `specs/Inline Code Chip.md`. `<strong>` lifts to `--ngpt-text-secondary` at 600; `<em>` is italic with no color change.

## HTML/CSS mock

```html
<h3 id="sec-sorting">
  Sorting<a class="heading-anchor" href="#sec-sorting" aria-label="Link to this section">#</a>
</h3>
<ul>
  <li>Composable via <code>withSorting()</code></li>
</ul>
<blockquote>Sorting state is owned by the store, not the directive.</blockquote>
```

```css
.content h3 {
  font: var(--ngpt-sys-typescale-title-medium);
  color: var(--ngpt-text-primary);
  margin: 28px 0 8px;
}
.content h4 {
  font: var(--ngpt-sys-typescale-title-small);
  color: var(--ngpt-text-secondary);
  margin: 20px 0 6px;
}

.content :is(h2, h3, h4) {
  scroll-margin-top: var(--ngpt-sys-layout-scroll-offset);
}
.heading-anchor {
  margin-left: 8px;
  color: var(--ngpt-accent);
  text-decoration: none;
  opacity: 0;
  transition: opacity var(--ngpt-sys-motion-duration-fast) var(--ngpt-sys-motion-easing-standard);
}
:is(h2, h3, h4):hover .heading-anchor,
.heading-anchor:focus-visible {
  opacity: 1;
}

.content :is(ul, ol) {
  padding-left: var(--ngpt-comp-list-indent);
  margin: 0 0 24px;
  font-size: 14.5px;
  line-height: 1.65;
  color: var(--ngpt-text-tertiary);
}
.content li + li {
  margin-top: 6px;
}
.content li::marker {
  color: var(--ngpt-text-muted);
}
.content ol {
  font-variant-numeric: tabular-nums;
}
.content :is(ul, ol) :is(ul, ol) {
  margin: 6px 0 0;
  padding-left: 20px;
}

.content blockquote {
  border-left: 2px solid var(--ngpt-border-strong);
  padding-left: 16px;
  margin: 24px 0;
  font-size: 14.5px;
  line-height: 1.65;
  color: var(--ngpt-text-tertiary);
}
.content strong {
  color: var(--ngpt-text-secondary);
  font-weight: 600;
}
```
