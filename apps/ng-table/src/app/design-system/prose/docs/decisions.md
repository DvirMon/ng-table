# Prose — build decisions

## code-chip / inline-link integration: consumers author the component tags directly

The task brief flagged this as the open question to resolve: does `ngpt-prose` restyle plain
projected `<code>`/`<a>` markup, or does it expect consumers to author literal
`<ngpt-code-chip>` / `<ngpt-inline-link>` tags inside the projected content?

**Resolved: consumers author the component tags.** `prose.css` does not contain a `code` or `a`
element selector (other than `.heading-anchor`, which is prose's own concern, not inline code/link
styling). Evidence:

- `spec.md`'s front matter is explicit: `does_not_own: "Inline code and links — see Inline Code
  Chip.md / Inline Link.md"`. Prose's own "owns" list is H1–H4, heading anchors, lists,
  blockquote/hr, strong/em — inline code and links are named exclusions, not omissions.
- Both `code-chip.ts` and `inline-link.ts` are real standalone components with their own
  (default/Emulated) encapsulation — `<ngpt-code-chip>`/`<ngpt-inline-link>` carry their own
  styles regardless of prose's `ViewEncapsulation.None`, so restyling plain tags would be pure
  duplication, not a requirement.
- Both host `display: contents` — a deliberate "act as a pure text run, introduce no box" design,
  which only pays off if they're meant to sit inline inside prose-authored paragraphs as literal
  tags (`<p>Composable via <ngpt-code-chip>withSorting()</ngpt-code-chip></p>`).
- `code-chip.css` has a `:host-context(a) .code-chip { color: inherit; }` rule with the comment
  "inherit the ancestor `<a>`'s (ngpt-inline-link) accent color" — this only fires when a
  `<ngpt-code-chip>` is nested inside an actual `<a>` rendered by `<ngpt-inline-link>`, i.e. when
  both are authored as literal nested component tags in the same projected content.

Given that, `ViewEncapsulation.None` is not load-bearing for code/link styling at all — it's
needed *only* for the elements that have no dedicated component (headings, lists, blockquote, hr,
strong/em), which is exactly what CONVENTIONS.md #8 and this spec's "owns" list describe.

**Loose end, not resolved by this build:** `spec.md`'s own "HTML/CSS mock" section shows plain
`<code>withSorting()</code>` inside a `<li>`, with no `.code-chip` class and no `<ngpt-code-chip>`
tag. Read literally, that contradicts the above. I'm treating that mock as spec-writing shorthand
(the mock's job is to illustrate heading-anchor/list/blockquote structure, and it wasn't updated
when code-chip/inline-link became real components with `display: contents`) rather than as the
literal authoring contract — the front-matter `does_not_own` line and the components' own CSS are
more specific and more recently-shaped signals than a mock snippet. If a docs-page-composition task
later needs plain-`<code>` support after all, that's a spec correction, not a `prose.css` change.

## Marketing measure: scoped to H2 only

`data-measure` only remaps `h2` (`title-large` → `headline-marketing`, sized via
`clamp(26px, 3.4vw, 36px)` per `pages/home/docs/spec.md`'s Section rhythm). H1/H3/H4 are
unaffected in both modes. Reasons:

- CONVENTIONS.md's fixed contract line says measure exists "for Home's headline scale" (singular)
  and the task brief calls out H2 specifically.
- Home's own H1 is not rendered through `ngpt-prose` at all — it's page-local, owned by the
  `hero-band` block ("owns the announcement pill, H1 clamp, lede...").  There is currently no case
  where a marketing-measure prose block would ever contain an H1.
- Home's feature-grid H3s stay at the docs `title-medium` scale in both the frame and the page spec
  (no marketing H3 step is mentioned anywhere); only the H2 eyebrow-adjacent heading gets the
  larger step.

`font: var(--ngpt-sys-typescale-headline-marketing)` is applied first (setting weight/line-height/
family, and its own 36px as the baseline), then `font-size` is overridden with the clamp. This
mirrors how the Home hero's own H1 layers a clamp on top of the fixed `display-large` token
(`foundations/Typography.md`: "moved to 64px... `pages/Home.md` renders it as
`clamp(38px, 6vw, 64px)`") — the token supplies the design ceiling, the page spec supplies the
responsive floor/step, elsewhere in this same system.

## Heading margins: tokens over the mock's literal pixel values

`spec.md`'s Heading levels table gives margins with no Token column (`0 0 14px`, `32px 0 10px`,
`28px 0 8px`, `20px 0 6px`) and its HTML/CSS mock reproduces those as literals. All four values have
exact matches in `src/styles/tokens/spacing.css` (`--ngpt-sys-space-350/800/250/700/500/150` etc.)
that aren't listed in this spec's front-matter `tokens:` array. Per the repo-wide "never hardcode a
value that has a token" rule, I used the tokens instead of the mock's literals — same call
`callout/docs/decisions.md` made for its grid-template-columns value.

## `<p>` is intentionally unstyled here

Plain paragraph margin/rhythm is not in prose's "owns" list, and
`docs/design-handoff/specs/layout/Content Column.md` (a Template-level component not in this
round's fixed-contract table) explicitly owns "Vertical rhythm between content blocks" including
"H1 → intro paragraph gap," "H2 → body paragraph gap," etc. `prose.css` sets no `p` rule; paragraph
font already inherits from the global `body` style (`body-medium`, matching this component's a11y
floor of 14.5px). This is a known gap until Content Column ships — flagged here rather than
silently invented.

## `hr`: inferred, no Build spec table row

`spec.md`'s "owns" list includes `hr` but the Build spec table has no row for it and no token is
called out. Styled as `1px solid var(--ngpt-border-subtle)` with `margin: var(--ngpt-sys-space-600)
0` — `border-subtle` (not `border-strong`, which the spec reserves for blockquote's emphasis
border) matching the plain-divider borders used elsewhere in this app (`code-block`,
`dropdown-menu`, `search-overlay` all use `1px solid var(--ngpt-border-subtle)`), and the same
24px block-rhythm token already used twice in this spec for list/blockquote margins. Flagging this
as inferred, not spec'd, per CONVENTIONS.md #10.

## Scoping under `ViewEncapsulation.None`

Host carries a static `class: 'ngpt-prose'` (not just the `ngpt-prose` element selector) so every
rule in `prose.css` is written as `.ngpt-prose ...`. `:host` was avoided as the scoping mechanism —
its compiled behavior under `ViewEncapsulation.None` isn't guaranteed the way it is under Emulated
encapsulation (no `_nghost` attribute is emitted in None mode), so the explicit host class is the
more reliable and more legible choice for a component whose whole point is styling markup outside
its own template.

## Host `display: block`

Not spec'd explicitly, but necessary: custom elements default to `display: inline`, and a
Template-level component wrapping full article content (headings, lists, block quotes) needs to lay
out as a block. This is a structural default, not a design value, so it doesn't need a token.

## No runtime a11y enforcement

The spec's a11y line ("One H1 per page; never skip a level. Anchor links have
`aria-label="Link to this section"`.") is a content-authoring contract, not something the component
enforces at runtime — `prose.html` is a pure `<ng-content />` passthrough with no heading
introspection, and the anchor `<a>` (including its `aria-label`) is authored directly by whoever
writes the projected content, per the spec's own HTML mock.
