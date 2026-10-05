---
id: content-column
kind: layout
atomic: Template
spec: specs/layout/Content Column.md
frame: null
owns:
  - 'Content container padding + max-width'
  - 'Vertical rhythm between content blocks (eyebrow→H1, H1→body, block gaps)'
does_not_own:
  - 'Typography of the blocks themselves — see Content Prose.md'
depends_on:
  - 'foundations/Typography.md (typography)'
  - 'foundations/Spacing.md (spacing)'
  - 'Content Prose.md (prose)'
states: []
a11y:
  - 'role="main"'
tokens:
  [
    --ngpt-sys-space-900,
    --ngpt-sys-space-1000,
    --ngpt-sys-layout-content-max-width,
    --ngpt-sys-comp-eyebrow-gap,
    --ngpt-sys-space-350,
    --ngpt-sys-space-700,
    --ngpt-sys-space-800,
    --ngpt-sys-space-250,
    --ngpt-sys-space-300,
    --ngpt-sys-space-600,
  ]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

# Layout — Content Column

The center column of the page grid — the actual docs content (H1, body copy, live examples, tables, code, footer pagination).

## Container

| Property  | Value     | Token                                      |
| --------- | --------- | ------------------------------------------ |
| padding   | 36px 40px | --ngpt-sys-space-900 --ngpt-sys-space-1000 |
| max-width | 760px     | --ngpt-sys-layout-content-max-width        |

## Vertical rhythm

| Property                                             | Value                     | Token                       |
| ---------------------------------------------------- | ------------------------- | --------------------------- |
| Eyebrow → H1 gap                                     | 6px                       | --ngpt-sys-comp-eyebrow-gap |
| H1 → intro paragraph gap                             | 14px                      | --ngpt-sys-space-350        |
| Intro paragraph → first example/section gap          | 28px                      | --ngpt-sys-space-700        |
| H2 top margin (section start)                        | 32px                      | --ngpt-sys-space-800        |
| H2 → body paragraph gap                              | 10–12px                   | --ngpt-sys-space-250/300    |
| Section body → next H2 gap (via block margin-bottom) | 24–32px                   | --ngpt-sys-space-600/800    |
| Last section → pagination footer gap                 | 24px, plus 1px top border | --ngpt-sys-space-600        |

```html
<main class="content">
  <div class="eyebrow">Primitives</div>
  <h1>Table Primitive</h1>
  <p class="intro">…</p>

  <!-- live example window(s) -->

  <h2 id="sec-x">Section title</h2>
  <p>…</p>
  <pre>…</pre>

  <!-- repeat H2 sections -->

  <!-- Pagination Footer component -->
</main>
```

```css
.content {
  padding: 36px 40px;
  max-width: 760px;
}
.content h2 {
  margin: 32px 0 10px;
}
.content .intro {
  margin: 0 0 28px;
}
```

## Width between 1024 and 1439px

760px is a **cap, not a width.** The grid keeps 270px + 220px of side columns down to the `md`
breakpoint (`foundations/Responsive and Breakpoints.md`), so the centre track only reaches 760px once the
grid is about 1330px wide. Between 1024px and there, the column takes what the grid gives it and the
prose measure narrows — down to roughly 450px of text at 1024px, its worst case. Nothing overrides the
cap or the side columns to protect it: below `md` the TOC drops and the column gets the full width back.

Individual typographic roles (H1/H2/body sizes) are defined in `specs/foundations/Typography.md`; this file only records the spacing _between_ those elements.
