# Spec Sufficiency Audit — NGP Table docs design system

> **Status 2026-08-22 — resolved.** Everything below that did not need a human decision has been fixed in
> the specs and the frames; each item is marked. What remains open is listed in
> [Still needs a decision](#still-needs-a-decision) at the end. The findings are kept in full, as written,
> because the point of the audit is the record of where a reader had to invent — not the diff.

## Still needs a decision

Two things, both authored content:

1. **The page list.** Sections 2 and 4+ of the nav tree (`Content Model.md` § Seed tree). Nothing can
   validate prev/next, search groups or the sidebar until it exists.
2. **Article prose.** One Markdown file per entry, per `Assets and Content Source.md` § Content source.
   Every page stays `MOCK` by choice — the docs get written by hand.

Plus assets that cannot be generated: logo, favicon, apple-touch icon, OG image. Each is a reserved box at
final dimensions until supplied (`Assets and Content Source.md` § Placeholder policy).

## Decided 2026-08-22

- **Fonts: Google Fonts**, both families, `display=swap` with both preconnects. Self-hosting was specified
  first and reversed — the woff2 subsets were never produced, and the frames already load Google.
- **Home cuts the logo row and the testimonials.** Both were asset-blocked; carrying two placeholder
  blocks read worse than a page that ends on the install command. Home is now four sections.
- **No Sponsor pill on the marketing navbar** — search, Documentation, GitHub. Sponsor stays on the docs
  bar and in Home's footer link row.
- **`--ngpt-sys-typescale-display-large` moves to 64px** (from 52px), matching the hero clamp's ceiling.
- **`hidden` entries are excluded from the sitemap**, while staying routable and searchable.

## What changed

- **New `specs/foundations/Layout and Sizing.md`** — every layout dimension, fixed component size, the
  72px scroll offset and the base font stack. `specs/index.md` lists it.
- **`foundations/Color.md` rewritten** to own every `--ngpt-comp-*` color, grouped by role, with measured
  contrast per text token. **`Typography.md` rewritten** with the four missing roles and valid `font`
  shorthand (the old values were unparseable). **`Spacing.md`** gained the three real gaps (24 / 28 /
  36px) and a note that the `-alt` / `-b` / `-ish` names never existed.
- **Every `:root` restatement deleted** from the thirteen component specs that carried one, and their CSS
  mocks switched to `var()`.
- **Six AA failures fixed** by token change: `--ngpt-text-muted` 0.55 → 0.60, `--ngpt-accent-bg` 0.24 →
  0.20, `--ngpt-comp-code-gutter-text` 0.42 → 0.58, `--ngpt-comp-toc-nested-text` 0.5 → 0.60, tab
  inactive 0.60 → 0.64, footer text → `--ngpt-text-tertiary`; keyboard chips moved to
  `--ngpt-text-secondary`; Home's navbar hover pill now darkens instead of lightening (3.84 → 6.17);
  prose links are underlined at rest.
- **The frames were reconciled** with the specs that own them: the Home frame is now annotated per
  `Frame Annotation.md` with a mock banner, a role overlay and a skip link, and both frames pick up the
  corrected tokens, the 72px sticky offset and the z-index scale.
- **Ten contradictions resolved** in favour of the owning spec, and the states nobody had drawn
  (pagination one-side, copy failure, empty sections, low-heading TOCs, label overflow, the line-number
  toggle) are now written down.

---

Method: attempted the build from `specs/` alone, page by page, and logged every point where I could not
proceed without choosing something no spec chose. Contrast was computed (oklch → sRGB → WCAG), not
eyeballed. Frames were read for computed values, not appearance.

Date: 2026-08-22. Read: `CLAUDE.md`, `specs/index.md`, all 4 site-level contracts, all 8 foundations,
all 6 layout specs, all 17 component specs, all 6 page archetypes, both frames in `pages/`.

---

## Verdict

**Buildable with gaps.** The site-level layer added on 2026-08-21 works: given a URL I can resolve an
archetype, an active nav item, a title, prev/next and a TOC without hand-authoring any of them, and
`Frame Annotation.md` successfully stopped me from mistaking a frame for a data source. The gaps are
concentrated in one place and it is not the interesting one — **the token layer does not close**. Fifty-five
token names are cited across component and layout specs; forty-three are defined nowhere, and twelve are
defined in the component spec that uses them, in files whose own front matter says values resolve only in
`specs/foundations/`. Every one is recoverable, because each citing table also prints the literal value —
which means the system currently ships as hardcoded px with decorative token names, exactly what
`CLAUDE.md` forbids. Beyond that: the page list is knowingly incomplete, so I could build four pages of an
unknown number; one deferred decision is deferred to a file that does not make it (pagination card
titles); and five text-on-surface pairs fail WCAG AA, including the sidebar's active nested item and the
Home navbar's own hover state.

I had to invent **15 times**, plus 43 individual token-value lookups from prose. Three of the fifteen
change what ships.

---

## Inventions I had to make

Ranked by consequence.

### 1. Forty-three undefined tokens — I read the value out of the prose table and inlined it
- **Needed:** a definition for every `var(--ngpt-*)` a component spec cites.
- **Chose:** treated the "Value" column as authoritative and the token name as decorative. High confidence
  in the values (every citation prints one), zero confidence in the names.
- **Should own it:** `foundations/Spacing.md` (the 24 / 28 / 36px steps — by its own px×25 convention:
  `space-600`, `space-700`, `space-900`), `foundations/Typography.md` (the 13px, 12.5px and 16px roles),
  `foundations/Color.md` (the whole `--ngpt-comp-*` grey ramp), and a new `foundations/Layout.md` for
  fixed dimensions (navbar height, sidebar / TOC / drawer widths, content max-width, scroll offset).
- **Breaks if wrong:** nothing renders from a variable, so every fallback-less `var()` resolves to nothing;
  and the rule that makes this repo maintainable ("never hardcode a value that has a token",
  `specs/index.md` step 4) cannot be followed by anyone building from it.

Undefined anywhere (43):

| Group | Tokens |
| --- | --- |
| Spacing (9) | `--ngpt-sys-space-600`, `-700`, `-700-alt`, `-700-b`, `-700-ish`, `-900`, `-1000-alt`, `-350-alt`, `-250-alt` |
| Type (4) | `--ngpt-sys-typescale-label-large-sm`, `-label-large-medium`, `-label-small-2`, `-label-small-nested` |
| Color (21) | `--ngpt-text-base`, `--ngpt-comp-row-divider`, `-footer-text`, `-toc-nested-text`, `-code-gutter-text`, `-nav-text-default`, `-pagination-title-default`, `-pagination-border`, `-link-hover`, `-menu-text-disabled`, `-dropdown-text`, `-tab-track-bg`, `-tab-text-inactive`, `-select-placeholder`, `-callout-note-bg`, `-note-border`, `-note-accent`, `-warning-bg`, `-warning-border`, `-tip-bg`, `-tip-border` |
| Layout / size (9) | `--ngpt-sys-font-family-base`, `--ngpt-sys-layout-grid-columns`, `-content-max-width`, `-sidebar-width`, `-toc-width`, `-drawer-width`, `--ngpt-comp-navbar-height`, `-navbar-logo-size`, `-navbar-dot-size` |

Plus, same category, smaller: `--ngpt-comp-navbar-dot-border`, `-nav-border-width`, `-icon-btn-size`,
`-tab-item-px`, `-select-px`, `-code-gutter-width`, `-toc-nested-indent`, `-pagination-arrow-shift`,
`--ngpt-sys-comp-nav-section-gap`, `--ngpt-sys-comp-eyebrow-gap`.

Defined, but outside `foundations/` (12) — a real value in the wrong file, which is why nobody noticed
they were missing: `--ngpt-sys-layout-scroll-offset`, `--ngpt-sys-typescale-title-medium`,
`--ngpt-sys-typescale-title-small`, `--ngpt-comp-list-indent` (all in `Content Prose.md` § HTML/CSS mock);
`--ngpt-comp-search-*` ×5 (`Search.md`); `--ngpt-comp-menu-min-width`, `-max-height`
(`Dropdown Menu.md`); `--ngpt-comp-icon-btn-confirm-hold` (`Icon Button.md`).

Two tokens are defined in `foundations/Typography.md`'s table but omitted from that file's own
front-matter `tokens:` list (`-display-large`, `-headline-marketing`); four the same in `Color.md`
(`-accent-surface`, `-onband-fill`, `-onband-fill-inverse`, `-navbar-scrolled`). Front matter is what the
manifest promises is "enough context for one component", so it needs to be complete.

### 2. The page list — I built four pages and stopped
- **Needed:** the tree. `Content Model.md` § Seed tree gives one root entry and two sections (1 and 3),
  and says plainly it is incomplete: "Sections 2 and 4+ are referenced by the numbering but their entries
  are unknown."
- **Chose:** built exactly the four seeded entries. Medium confidence that they are right; none that they
  are all.
- **Should own it:** `Content Model.md` § Seed tree.
- **Breaks if wrong:** prev/next chains, search groups and the sidebar are all derived from tree order, so
  every one of them is wrong in the same way — which is the failure mode the file exists to prevent.
  Also, section numbering with a hole (1, 3) reads as a bug to a visitor.

### 3. Pagination card titles — the deferral has no destination
- **Needed:** whether a card shows `entry.label` or a composed `section + label` string.
  `Content Model.md` § Seed tree explicitly defers: "see `Pagination Footer.md` for whether it composes or
  uses `label` alone. **Unresolved.**" `Pagination Footer.md` does not mention it. The frame
  (`pages/Doc Article.dc.html`, pagination block) renders "State Layer Architecture", i.e. composed.
- **Chose:** `entry.label` alone, because `Content Model.md` § Entry fields says `label` is the single
  source for "the sidebar item, the page H1, **and the pagination card**. They are never worded differently."
- **Should own it:** `Pagination Footer.md` § Build spec.
- **Breaks if wrong:** the card and the sidebar item disagree by wording — the exact drift the content
  model was written to stop.

### 4. The eyebrow on the docs root
- **Needed:** `category-badge` text for `/docs` ("Overview"), whose `section` is `null`.
  `Routing and Page State.md` § Page state defines `eyebrow` as `entry.eyebrow ?? section.label`;
  `pages/Doc Article.md` slot 4.1 makes the eyebrow unconditional ("Text = the sidebar section name,
  uppercased"). For the root entry both produce nothing.
- **Chose:** omit the badge on `/docs`. Medium confidence.
- **Should own it:** `Routing and Page State.md` § Page state, or `pages/Section Landing.md`.
- **Breaks if wrong:** the docs landing page loses or gains a line above its H1 — visible, cheap to fix,
  but nobody can tell today whether the omission is intended.

### 5. Content column width between 1024 and 1439px
- **Needed:** what gives when the 3-column grid is narrower than its parts.
  `foundations/Responsive and Breakpoints.md` § Layout collapse keeps 270 / 1fr / 220 down to 1024px;
  `layout/Content Column.md` § Container sets max-width 760px with 40px side padding. At 1024px the
  centre track is 534px, so prose runs at 454px — 40% narrower than the specced measure, with no note
  that it does.
- **Chose:** let the content column shrink. High confidence it is what the CSS does, low that it is what
  was intended.
- **Should own it:** `foundations/Responsive and Breakpoints.md`.
- **Breaks if wrong:** code blocks and tables at that width are the worst-looking thing on the site, and
  the fix (drop the TOC earlier, or narrow the sidebar) is a design decision, not a tweak.

### 6. Home's navbar contents
- **Needed:** which links the marketing navbar holds. `pages/Home.md` § Slots specifies treatment
  ("Links are unfilled — translucent white pill on hover only") but never the set;
  `layout/Top Navbar.md` § Right group specifies search + Sponsor pill + status dot + Discord + GitHub.
- **Chose:** the frame's set (Search, Documentation, GitHub — no Sponsor, no dot, no Discord).
  Low confidence; the frame is not source.
- **Should own it:** `pages/Home.md` § Slots.
- **Breaks if wrong:** Sponsor is the page's only monetisation affordance and it is currently absent from
  the marketing page and present on every docs page.

### 7–11. States the specs enumerate but do not draw

Each of these is a state named somewhere and specified nowhere. I guessed and noted it.

| # | State | Where it is named | What I chose | Should own it |
| --- | --- | --- | --- | --- |
| 7 | `prev-only` / `next-only` pagination | `Pagination Footer.md` front-matter `states:` | Single card at full width, kept on its own side | `Pagination Footer.md` § Build spec |
| 8 | Icon Button copy **failure** | Invented by `pages/Home.md` § Install command row (three states, incl. `failed`); `Icon Button.md` § Confirmation variant has two | Home's amber/red glyph treatment, applied only on Home | `Icon Button.md` |
| 9 | A page with 0–1 H2s on an archetype whose TOC "always renders" | `pages/API Reference.md`, `pages/Examples Gallery.md` § Differences vs `pages/Doc Article.md` § Page-only rules | Doc Article's rule wins; TOC drops | the two archetype files |
| 10 | An empty section, or a section whose entries are all `hidden` | `Content Model.md` § Shape allows it; nothing renders it | Omit the section label entirely | `layout/Sidebar Navigation.md` |
| 11 | Long-label overflow in sidebar / TOC / pagination card | nowhere | Wrap, never truncate | `Sidebar Nav Item.md`, `layout/TOC Column.md` |

### 12. Line-number toggle
- **Needed:** the mechanism. `pages/Doc Article.md` § Page-only rules: line numbers at 5+ lines, "otherwise
  gutter is omitted". `Code Block.md` § Line numbers is a CSS counter on `.line` with no off switch.
- **Chose:** a class on the block. Low confidence — this may be intended as a fence-meta flag, which is a
  Shiki-pipeline decision.
- **Should own it:** `Code Block.md`.

### 13. Copy affordance for a standalone code block
- **Needed:** whether a code block outside a Preview Window can be copied. `Code Block.md` § Ownership
  boundary says the copy affordance is "**Not here** — lives in the Preview Window toolbar", but the same
  file's front matter lists states `hover (copy button appears)` and `copied`, and its `a11y` line
  requires a "copy button labelled 'Copy code'". `pages/Doc Article.md` slot 4.3 allows bare code blocks.
- **Chose:** no copy button on bare blocks, per the ownership boundary.
- **Breaks if wrong:** the single most-used affordance on a docs page is missing from most code on the site.

### 14. Home's responsive mechanism
- **Needed:** reconciliation. `pages/Home.md` § Section rhythm: "**No media queries.** … The collapse is
  therefore continuous rather than stepped." Three blocks in the same file then specify stepped behavior:
  Feature grid "3 columns × 2 rows at `lg`, 2 columns at `md`, 1 below", Logo row "Wraps to two rows below
  `md`", Testimonial "2-column grid at `lg`, single column below".
- **Chose:** `auto-fit` minmax as § Section rhythm prescribes, and read the per-block breakpoints as
  descriptions of where auto-fit happens to land. Medium confidence.
- **Should own it:** `pages/Home.md` — delete the breakpoint language or the no-media-query claim.

### 15. Framework
- **Needed:** what this is built in. `foundations/Iconography.md` § Setup prescribes ng-icons with an
  Angular `app.config.ts`; nothing else names a stack, and `Routing and Page State.md` § does_not_own
  disclaims "server, framework, or router implementation".
- **Chose:** treated icons as swappable and built framework-agnostic markup.
- **Non-blocking**, but the one foundation that does name a stack names an Angular-only one.

---

## Contradictions

Ordered by how badly each would mislead a generator.

**1. The navbar is 56px and the scroll offset is 72px.**
`layout/Top Navbar.md` § Container: `height 56px`. `layout/TOC Column.md` § Sticky behavior and
§ Scroll-spy: `--ngpt-sys-layout-scroll-offset` is "the same 72px the navbar occupies";
`Routing and Page State.md` § Hash behavior repeats 72px. `layout/Sidebar Navigation.md` § Sticky pins the
sidebar at 72px too. **The offset should win** (72 = 56 + 16px breathing room is a sane anchor offset), but
it must stop describing itself as the navbar's height, and it needs a home in `foundations/` — it is
currently defined in `Content Prose.md`.

**2. `--ngpt-text-tertiary` has two values.**
`foundations/Color.md`: `oklch(0.62 0.01 260)`. `Pill Button.md` § Build spec, `Icon Button.md` § Build
spec and `layout/Top Navbar.md` § Right group all print `oklch(0.65 0.01 260)` against the same token
name. **Color.md wins** — it owns "every color value in the system". The three restatements should be
deleted, not corrected.

**3. `--ngpt-sys-typescale-label-large` has two sizes.**
`foundations/Typography.md`: 13.5px. `Dropdown Menu.md`, `Dropdown Pill.md`, `Tab Switcher.md` all cite
that token for "Inter 13px", and their CSS blocks hardcode 13px. **Typography wins**; those three want the
undefined `label-large-sm` (13px) instead.

**4. `--ngpt-sys-typescale-label-large-medium` has two weights.**
13px/500 in `Pill Button.md` § Build spec, 13px/600 in `Table Row.md` § Build spec. Undefined in
`foundations/Typography.md`, so neither wins yet — this is what makes the split invisible.

**5. Copy confirmation: 1400ms vs 1.8s, accent vs green/red.**
`foundations/Motion.md` § Per-pattern table, `Icon Button.md` § Confirmation variant and
`Preview Window.md` § Toolbar interactive states all say 1400ms with a `--ngpt-accent` check.
`pages/Home.md` § Install command row says the non-idle states "hold for 1.8s" and colors them
`oklch(0.78 0.16 145)` / `oklch(0.7 0.19 25)`. **Motion wins on duration.** The success/failure hues are a
real gap, not a contradiction: they exist nowhere else and are not `--ngpt-status-success` (0.75 0.13 150).

**6. The accent hue is 52, described as 60.**
`foundations/Color.md` header prose: "one accent hue (orange, 60°)". The token: `oklch(0.62 0.19 52)`.
`Callout.md` § Variants repeats "hue 60" as the reason Note is neutral. `Select Trigger.md` § Build spec
goes further and specifies an active border of `oklch(0.6 0.18 60)` and a ring of
`oklch(0.55 0.15 60 / 0.35)` — two off-palette colors at the stale hue. **The token wins**; the prose and
Select Trigger's active state need updating.

**7. Pagination arrow motion is hardcoded.**
`Pagination Footer.md` § Build spec: "translateX(±3px), 0.15s ease" and the CSS `transition: transform
0.15s ease`. `foundations/Motion.md` § Per-pattern table: fast (120ms) / standard. **Motion wins.**

**8. Atomic levels disagree with themselves in four files.**
Front matter and `specs/index.md` say Organism / Organism / Molecule / Molecule for `Code Block.md`,
`Dropdown Menu.md`, `Dropdown Pill.md`, `Select Trigger.md`; each file's own body line says Molecule /
Molecule / Atom / Atom. `Preview Window.md` § Composition also calls Dropdown Pill an atom. **Front
matter wins** (the manifest reads it). Harmless to render, corrosive to trust.

**9. The wordmark has three sizes.**
`Assets and Content Source.md` § Brand assets: "'NGP Table' set in Inter 600 at 14px".
`layout/Top Navbar.md` § Left group: 15px/600, via `--ngpt-sys-typescale-title-small`. That token is
separately defined as 14.5px in `Content Prose.md` § Heading levels. **Top Navbar should win for the
navbar**, and Assets should stop specifying type at all — it disclaims type in its own `does_not_own`.

**10. Every component spec restates foundation values it does not own.**
`Pagination Footer.md`, `Sidebar Nav Item.md`, `Pill Button.md`, `Icon Button.md`, `Table Row.md`,
`Code Block.md`, `Search.md`, `Category Badge.md`, `Inline Link.md`, `Tab Switcher.md`,
`Select Trigger.md`, `Dropdown Pill.md`, `Inline Code Chip.md` all open their CSS mock with a `:root`
block redeclaring `--ngpt-accent`, `--ngpt-bg-hover`, `--ngpt-text-*` and friends. Every file's own front
matter says `token_values_resolve_in: specs/foundations/ (single source of truth — never restate values
here)`. **The front matter wins.** This is not cosmetic: contradiction 2 is a restatement that drifted.

**11. TOC presence.**
`pages/API Reference.md` and `pages/Examples Gallery.md` § Differences: TOC "Always renders".
`pages/Doc Article.md` § Page-only rules: no TOC below 2 H2s — and both files are `composes_only: true`
declaring only *differences* from Doc Article. **Doc Article's rule wins** unless the two archetypes say
they override it, which is what they need to say.

**12. Content Model vs. Doc Article on the eyebrow.**
`Content Model.md` § Entry fields defines an optional `eyebrow` override and
`Routing and Page State.md` § Page state resolves `entry.eyebrow ?? section.label`.
`pages/Doc Article.md` slot 4.1 says flatly "Text = the sidebar section name, uppercased".
**Routing wins**; Doc Article should point at it rather than restate it.

---

## Frames vs. the specs that own them

Per `CLAUDE.md` the spec wins; flagging drift rather than reconciling.

**`pages/Home Page.dc.html` — not annotated at all.**
`Frame Annotation.md` § Attributes requires `data-role` / `data-spec` / `data-purpose` / `data-content` on
every semantically meaningful block, and § Mock banner requires the amber banner on any frame containing
`MOCK` content. The Home frame has zero `data-*` annotation, no banner, and no role-overlay toggle, while
every word in it — hero H1, lede, six feature cells, the `ng add ngp-table` command — is invented. As it
stands the frame reads as production copy. `pages/Doc Article.dc.html` does this correctly and is the
model to follow.

Also in the Home frame, against `pages/Home.md`:

- **Logo row (slot 4) and testimonials (slot 7) are absent.** § Open acknowledges the testimonials
  removal and asks for a decision; the logo row's absence is acknowledged nowhere. This is the
  "silence where absence should have been explicit" case.
- **Section eyebrows use `oklch(0.57 0.19 52)`** (`--ngpt-accent-surface`) where `Category Badge.md`
  § Build spec says `--ngpt-accent` (0.62). The frame's `a { color: … }` reset does the same. Both fail
  AA at 12px where the correct token passes — see below.
- **`z-index: 20`** on the sticky header, against `--ngpt-sys-z-navbar: 10` in
  `foundations/Radius and Elevation.md` § Layering ("One scale, no ad-hoc values").
- **Product name at 14px**, search field at 180×30px against `Search.md` § Surface 1 (220×32px), copy
  button border at `0.26` against `Icon Button.md`'s `0.3`, and a hover border of `oklch(0.38 0.005 260)`
  that exists in no spec.
- **No skip link**, against `foundations/Focus and Keyboard.md` § Skip link ("the first focusable element
  in the document"). The Doc Article frame has one.
- **Fonts load from `fonts.googleapis.com`**, against `Assets and Content Source.md` § Fonts
  ("**Self-host both**", explicitly to remove the third-party request). Both frames do this.
- Footer background `oklch(0.11 0.004 260)`; `layout/Page Footer.md` § Container specifies no background
  at all, so this is invention, not drift.

**`pages/Doc Article.dc.html` — annotated correctly, three small drifts.** Inline code renders at 12.5px
against `Inline Code Chip.md`'s 13px; the note callout uses `ℹ` where
`foundations/Iconography.md` § Placeholder → icon mapping lists `ⓘ` and forbids glyphs outside the table;
the code gutter is a separate 14px-padded column rather than the 40px counter gutter in
`Code Block.md` § Line numbers. Its `md` collapse is real — `matchMedia('(max-width: 1023px)')` driving
inline styles, threshold matching `foundations/Responsive and Breakpoints.md`, and `pages/Doc Article.md`
§ Frame notes declares it as a frame implementation detail. That is the right way to do it.

**Four archetypes have no frame:** Section Landing, API Reference, Examples Gallery, Not Found.
`specs/index.md` § Pages has no Frame column, so this is unstated rather than contradicted — but
`Examples Gallery` (repeating Preview Windows) and `API Reference` (table-dense, horizontally scrolling
below `md`) are the two archetypes where a reference render would earn its keep.

---

## Contrast — computed

sRGB conversion from oklch, WCAG 2.1 ratios. AA = 4.5:1 for text below 18.66px bold / 24px regular.

**Failures that need a decision:**

| Pair | Ratio | Where |
| --- | --- | --- |
| `--ngpt-accent` on `--ngpt-accent-bg` | **4.28** | `Sidebar Nav Item.md` § Build spec — active accent item, 13.5px. The most important state in the sidebar. |
| `--ngpt-comp-footer-text` (0.5) on `--ngpt-bg-app` | **3.24** | `layout/Page Footer.md` § Container, 13px |
| `--ngpt-comp-toc-nested-text` (0.5) on `--ngpt-bg-app` | **3.24** | `layout/TOC Column.md` § Nested items — 12.5px interactive links |
| white on `oklch(1 0 0 / 0.14)` over the accent band | **3.84** | `pages/Home.md` § Hero, navbar link hover pill. The same file argues this exact failure two paragraphs later for the announcement pill and fixes it by darkening; the nav pill still lightens. |
| `--ngpt-comp-code-gutter-text` (0.42) on `--ngpt-bg-deep` | **2.42** | `Code Block.md` § Line numbers. Defensible as decorative — unless prose ever says "line 12". |

**`--ngpt-text-muted` (0.55) is below AA everywhere it is used:** 4.00 on `bg-app`, 3.94 on `bg-raised`
(the search field's placeholder), 3.73 on `bg-elevated` (search group labels and every result's second
line), 3.39 on `bg-code-chip` (the `⌘K` and `esc` chips). `foundations/Color.md` § a11y licenses this
("for 12px+ non-essential labels only") but WCAG has no non-essential exemption for text, and the search
result's second line is the line that tells you which page you are about to open. Logged as a decision to
confirm, not silently accepted.

**Frame-specific failures:** the Home frame's search well runs white-at-80% on `oklch(1 0 0 / 0.12)` over
the band — **2.96**; its section eyebrows at 0.57 measure **4.08** on `bg-app` and **4.30** on `bg-deep`,
where the specced `--ngpt-accent` measures 5.01 / 5.28. Using the right token fixes it.

**Links are distinguished from body text by color alone at rest.** `Inline Link.md` § Build spec: default
is `--ngpt-accent`, no underline; `Content Prose.md` § Lists / § Blockquote set body copy to
`--ngpt-text-tertiary`. Their ratio to each other is **1.06:1** — WCAG 1.4.1 wants 3:1 plus a non-color
cue, or a cue at rest. The file's own a11y line already says "Never color-only: underline on hover and
focus"; the resting state is the one that needs it.

**Verified as claimed:** white on `--ngpt-accent-surface` = **4.75** (`pages/Home.md` § Contrast claims
~4.7 — correct, and the 0.62/0.57 distinction is load-bearing: white on 0.62 measures 3.86). Body copy at
`--ngpt-text-tertiary` on `--ngpt-bg-app` = **5.33**. Callout title/icon on their tints: 9.44 (warning),
8.32 (tip), 6.91 (note). Disabled menu text at 2.14 is exempt under 1.4.3.

---

## Unbuildable without a human

- **The page list.** Sections 2 and 4+ (`Content Model.md` § Seed tree). Authored content, not design.
- **All article prose.** `Assets and Content Source.md` § Content source names the mechanism (one
  Markdown file per entry, keyed by slug) but there is no NGP Table source in the project. Every word in
  both frames is `MOCK` per `pages/Doc Article.md` § Frame notes.
- **Brand assets.** `Assets and Content Source.md` § Brand assets inventories them honestly: logo mark,
  favicon, apple-touch icon, OG image, hero visual, company logos, testimonial avatars — none exist. I
  cannot generate artwork or photography.
- **Font files.** Self-hosted Latin-subset woff2 for Inter 400/500/600/700 and JetBrains Mono 400, with
  two preloads. Not in the project; both frames fall back to Google Fonts.
- **Five product decisions**, each already flagged as open in its own file: pagination title composition
  (§ 3 above); whether testimonials and the logo row stay on Home (`pages/Home.md` § Open); whether
  `--ngpt-sys-typescale-display-large` moves to 64px or Home keeps its clamp (same); whether the product
  name links to `/` or the docs root (same); whether `hidden` entries stay in the sitemap
  (`Routing and Page State.md` § Open).

---

## Non-blocking gaps

1. **Search index failure has no state.** `Search.md` § Empty states rules out a loading state ("results
   are local and synchronous") and `Search Index.md` § Open leaves build-time vs. browser-assembled open.
   If it is ever assembled in the browser, there is no specified appearance for "index unavailable".
2. **`Sidebar Nav Item.md` doubles as the TOC item.** Its opening line covers "the left nav or 'On this
   page' TOC", but `layout/TOC Column.md` owns TOC item styling and specifies different values (2px left
   border, muted default, 22px nested indent). No contradiction in practice; the sentence should go.
3. **The drawer covers the navbar that opens it.** Drawer z 30 over navbar z 10
   (`foundations/Radius and Elevation.md` § Layering). Intended, presumably — but the hamburger then
   disappears behind the surface it opened, and nothing says whether the drawer header's own logo row is
   meant to replace it. `layout/Sidebar Navigation.md` § Mobile variant implies yes.
4. **Reduced motion is specified twice, compatibly.** `foundations/Motion.md` § Reduced motion (drop
   transforms, collapse to fast) and `foundations/Focus and Keyboard.md` § Reduced motion (smooth scroll
   becomes a jump). Consistent; worth a cross-reference so a future edit to one does not orphan the other.
5. **`Frame Annotation.md` § Production output requires stripping all annotation.** No spec says what
   performs the strip. Implementation, but currently nobody's job.
6. **Not Found requires "a real HTTP 404"** (`pages/Not Found.md` § Page-only rules) — a deployment
   requirement in a design spec, with no deployment spec to receive it.

---

## Deliberately out of scope — do not re-open

From `CLAUDE.md` and `specs/index.md` § Out of scope: the NGP Table product component itself; Shiki
syntax colors; light theme and theme toggle; breadcrumbs; version selector.
From `Coverage Review.md` § Decided in review: interactive data-table UI; edit-this-page meta.
From `Site Readiness Review.md` § The Figma question: Figma parity, and one-file-per-state splitting.
Left open as implementation, correctly: where the tree physically lives (`Content Model.md` § Open);
whether the search index is built or bundled (`Search Index.md` § Open); trailing-slash canonicalisation
(`Routing and Page State.md` § Open); MDX vs. fenced blocks and per-page OG images
(`Assets and Content Source.md` § Open); synonym lists (`Search Index.md` § Open).

---

## Recommended order

1. **`foundations/Layout.md` + additions to `Spacing.md` / `Typography.md` / `Color.md`.** Define all 43
   undefined tokens, move the 12 misplaced ones out of component specs, and delete every component-level
   `:root` restatement. Closes invention 1 and contradictions 1, 2, 3, 4, 9, 10 — six of the twelve
   contradictions are symptoms of this one hole.
2. **Complete `Content Model.md` § Seed tree, and add the pagination-title rule to
   `Pagination Footer.md`.** Closes inventions 2, 3, 4 and contradiction 12. Nothing else can be
   validated until the tree is real: prev/next, search groups and the sidebar are all derived from it.
3. **A contrast pass on the five failing pairs plus `--ngpt-text-muted`.** Closes the WCAG section.
   Cheapest fix for four of the six is a single lightness step; the accent-on-accent-bg case needs a
   choice between a lighter accent for that state and a darker tint.
4. **Annotate or delete `pages/Home Page.dc.html`, and state Home's absent regions explicitly.** Closes
   the Home frame drift and invention 6, and stops the frame being readable as production copy.
5. **A states addendum across five files** — pagination single-side, Icon Button failure, TOC on
   low-heading pages, empty sections, label overflow. Closes inventions 7–11 and contradictions 5, 11.
6. **Resolve code-block copy ownership and the line-number toggle** in `Code Block.md`. Closes inventions
   12, 13 and contradiction 8.
7. **Fix `pages/Home.md` § Section rhythm's no-media-query claim**, and specify the content column
   between 1024 and 1439px in `foundations/Responsive and Breakpoints.md`. Closes inventions 5 and 14.
8. **Housekeeping:** atomic-level lines, front-matter token lists, the hue-60 references, the
   `Sidebar Nav Item.md` TOC sentence.

Steps 1 and 2 are the difference between a system that is followable and one that is merely readable.
Everything after step 3 is polish on a system that already works.
