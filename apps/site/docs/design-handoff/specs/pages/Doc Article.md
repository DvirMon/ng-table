---
kind: page
archetype: Doc Article
frame: pages/Doc Article.dc.html
composes_only: true
rule: >
  This file assigns components to slots and sets page-only decisions.
  It never restates styling. If a value is missing here, it lives in the component spec.
---

# Page — Doc Article

The default page. Every docs route is this unless named otherwise.

## Slots

| Order | Slot           | Component                                                       | Page-only decision                                                                                                                                                                          |
| ----- | -------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | shell          | `page-shell`                                                    | —                                                                                                                                                                                           |
| 2     | header         | `navbar`                                                        | Search slot present                                                                                                                                                                         |
| 3     | left           | `sidebar`                                                       | Exactly one `nav-item` carries `is-active` + `aria-current="page"`; its parent section uses the `--accent` variant                                                                          |
| 4     | main           | `content-column`                                                | —                                                                                                                                                                                           |
| 4.1   | main › eyebrow | `category-badge`                                                | Text = the resolved `eyebrow` from `Routing and Page State.md` (`entry.eyebrow ?? section.label`), uppercased. Omitted entirely when that resolves to `null` — the docs root has no section |
| 4.2   | main › title   | `prose` H1                                                      | Exactly one H1, matching the nav item label                                                                                                                                                 |
| 4.3   | main › body    | `prose`, `callout`, `code-block`, `preview-window`, `table-row` | Free order, authored per route                                                                                                                                                              |
| 4.4   | main › end     | `pagination`                                                    | Prev/next follow sidebar order; omit the missing side at the ends                                                                                                                           |
| 5     | right          | `toc`                                                           | Built from H2/H3 in slot 4.3. Hidden if fewer than 2 H2s.                                                                                                                                   |
| 6     | below grid     | `page-footer`                                                   | —                                                                                                                                                                                           |

## Page-only rules

- TOC renders only when the page has 2+ H2 headings. One H2 = no TOC column, content column keeps its max-width and the grid drops to 2 columns.
- Code blocks show line numbers when 5+ lines, otherwise the gutter is omitted — the opt-in class in
  `Code Block.md` § Line numbers. A bare code block has no copy button; that affordance belongs to the
  Preview Window toolbar.
- A page may contain at most one `preview-window` above the first H2.

## Frame notes

`pages/Doc Article.dc.html` is annotated per `specs/Frame Annotation.md`. All body prose, code and
callout copy in it is `MOCK` — there is no NGP Table source in this project, so the words are invented
and must not be carried into production. Everything marked `derived` (sidebar, eyebrow, H1, TOC,
prev/next) is showing a computed result, not a literal to copy.

The frame implements the `md` collapse in JS rather than a media query: a `matchMedia('(max-width: 1023px)')`
listener drives inline styles, because a DC template has no stylesheet to put a breakpoint in. The
threshold, the single-column grid, the dropped TOC and the hamburger-plus-drawer all match
`foundations/Responsive and Breakpoints.md`. A production build should use the media query from that
spec; the JS is a frame implementation detail, not a design decision.

## Content order contract

Eyebrow → H1 → lede paragraph → first H2. Never an H2 immediately after the H1.
