---
id: frame-annotation
kind: convention
atomic: —
spec: specs/Frame Annotation.md
frame: null
owns:
  - "The data-role / data-spec / data-purpose / data-content attribute vocabulary on reference frames"
  - "The mock-content banner and the role-overlay toggle"
  - "The rule that all annotation is stripped from production output"
does_not_own:
  - "Any component's styling or behavior — each component spec owns its own"
  - "Which components a page composes — see specs/pages/"
depends_on:
  - "specs/index.md (the id vocabulary data-role draws from)"
states: []
a11y:
  - "Annotation chrome is inert: aria-hidden where decorative, never in the tab order ahead of the skip link"
tokens: [--ngpt-accent, --ngpt-status-warning]
token_values_resolve_in: specs/foundations/ (single source of truth — never restate values here)
---

# Frame Annotation

`components/*.dc.html` and `pages/*.dc.html` are **reference frames, not source** (see `CLAUDE.md`). A
frame shows the intended render; the spec is the contract. This file defines how a frame says so in its
own markup, so an agent reading a frame can tell structure from placeholder without being told.

Without this convention, every frame invents its own scheme and a generator has no way to know that
`data-*` on a frame is annotation rather than production markup to reproduce.

## Attributes

Every semantically meaningful block in a frame carries these four:

| Attribute | Required | Value |
| --- | --- | --- |
| `data-role` | yes | The block's role, from the vocabulary below. Dotted for variants: `callout.warning`. |
| `data-spec` | yes | Path to the spec that owns it, e.g. `specs/Callout.md`. The agent's next read. |
| `data-purpose` | yes | One or two sentences on **when to use this block**, not what it looks like. Appearance is the spec's job; intent is what a frame cannot otherwise convey. |
| `data-content` | yes | `derived` or `MOCK`. See below. |

### `data-role` vocabulary

Values match the `id` column of `specs/index.md` for components and layout regions
(`navbar`, `sidebar`, `toc`, `pagination`, `content-column`, `code-block`, `category-badge`,
`skip-link`), with two extensions:

- **Variants are dotted:** `callout.note`, `callout.warning`, `callout.tip`.
- **Prose levels are dotted:** `prose.h1`, `prose.h2`, `prose.h3`, `prose.lede`.

A block whose role is not in the vocabulary is not annotated. Inventing a role name is a signal the
component is missing a spec.

### `data-purpose` — write the decision, not the description

The useful content is the choice a reader has to make. Compare:

- Weak: *"Amber callout with a warning icon."* The spec already says that.
- Strong: *"WARNING variant. Use ONLY where ignoring the note costs the reader something: a performance
  cliff, a footgun, a breaking constraint. Overuse is what makes readers stop seeing amber at all."*

### `data-content` — mock or derived

The distinction that keeps a frame from being mistaken for a data source.

| Value | Meaning |
| --- | --- |
| `derived` | This content comes from a real source — the nav tree, `entry.label`, the page's own headings. A generator should wire it up, not copy the literal text. |
| `MOCK` | Invented placeholder. Structure is spec-accurate; the words are not real. Never carry them into production. |

Body prose, code samples and callout copy are `MOCK` unless the project holds actual documentation.
Sidebar items, eyebrows, H1s, TOC entries and prev/next are `derived` — they are computed from the tree
per `Content Model.md`, so a frame showing them literally is showing the *result*, not the input.

## Mock banner

Any frame containing `MOCK` content opens with a banner above all other content:

- Amber surface, using the `warning` callout tint from `Callout.md` — the same signal, at page scale.
- States plainly that layout is spec-accurate and the copy is invented, and why (here: no library source
  in the project).
- Names the annotation attributes, so a reader who has not read this file still learns they exist.
- Carries the role-overlay toggle.

A frame with no `MOCK` content omits the banner entirely rather than showing an empty reassurance.

## Role overlay

The banner's toggle reveals, for every `[data-role]` on the page: a dashed 1px `--ngpt-accent` outline
and a small accent tag showing the role name, with `data-purpose` as its `title`.

Requirements:

- **Scope the query to the document, not to a subtree.** Scoping to the grid wrapper silently skips the
  navbar and the skip link, which sit outside it — an overlay that claims to cover every block and
  quietly misses two is worse than no overlay.
- Off by default. The frame's first impression should be the design, not the scaffolding.
- Fully reversible: remove the tags, clear the outlines, and clear any inline `position` the overlay
  itself set.
- Tags are `cursor: help` and inert — never focusable, never ahead of the skip link in tab order.

## Production output

**All of it is stripped, by whatever renders production pages** — the generator that reads these specs,
not the frame and not a manual pass. The `data-*` attributes, the banner, the toggle, and the overlay are
frame scaffolding. Shipping them would put invented documentation copy and internal spec paths into the
production DOM.

The frame is the reference. The spec is the contract. This annotation exists so the first cannot be
mistaken for the second.
