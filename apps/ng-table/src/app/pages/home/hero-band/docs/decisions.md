# Decisions — hero-band

Page-local block (`pages/home/hero-band/`), not a design-system component. Build-time judgment
calls not spelled out verbatim in `pages/home/docs/spec.md` or `docs/CONVENTIONS.md`.

## Final input/output API

```ts
readonly announcement = input<string>();
readonly announcementStatus = input<HeroBandAnnouncementStatus>('success'); // 'success'|'warning'|'error'|'neutral'
readonly h1 = input<string>();
readonly lede = input<string>();
readonly primaryLabel = input<string>();
readonly secondaryLabel = input<string>();

readonly primaryClick = output<void>();
readonly secondaryClick = output<void>();
```

Plus `<ng-content select="[navbar]" />` for the projected navbar.

## Buttons: string + output, not `{ label, href }` objects

The task brief offered two shapes: `primaryAction: input<{label: string; href: string}>()`, or
"simpler string + output if your spec's mock suggests plain anchors." The frame
(`Home Page.dc.html`) does render both hero CTAs as `<a href="#">` — but the fixed contract in
`CONVENTIONS.md` pins pill-button to "renders `<button>`" with no anchor mode, and pill-button's
own `docs/decisions.md` confirms it's button-only by design (`type="button"`, no href input).
Nesting an `<a>` inside pill-button's `<button>` would also be invalid HTML (interactive content
can't nest inside `<button>`'s content model).

Since the fixed contract requires hero-band to *consume* pill-button, and pill-button is
irreducibly a `<button>`, I took the "simpler" branch: plain `primaryLabel`/`secondaryLabel`
strings and `primaryClick`/`secondaryClick` void outputs. Href/routing is the consumer's job in
its own click handler (`(primaryClick)="router.navigateByUrl('/docs')"` or
`window.open(href, '_blank')` for the external one) — hero-band doesn't hold navigation data it
can't act on. This mirrors `page-footer`'s `FooterLink { label, href, external? }`, which *does*
render real `<a>` tags directly (no button in the way) — the two components land on different
shapes because page-footer isn't constrained to route through a button-only atom.

## Hero-only pill-button size step uses `:host ::ng-deep`

Spec's "Hero size override" (14.5px/600 weight, 11px 20px padding) is explicitly out of scope for
pill-button itself — its own `docs/decisions.md` says it's "a page-local CSS override the Home
hero consumer applies." pill-button exposes no CSS custom-property override hook for its internal
font/padding (by design, per the token-fallback ban in `CONVENTIONS.md`), and its files are off
limits for this task, so there is no non-piercing way to reach it.

Used the css-styling skill's sanctioned app-level escape hatch — `:host ::ng-deep`, scoped so it
only touches pill-button instances inside this component's own template (never `::ng-deep` alone,
never global). This rule is explicitly stricter for DS components ("no `::ng-deep` — ever"), but
hero-band is page-local/app-level, not a DS component, so the app-level "last resort" carve-out
applies. Both override values are exact existing-token matches, not new literals:

| Spec value | Token |
|---|---|
| 14.5px / 600 weight | `--ngpt-sys-typescale-title-small` (`600 14.5px/1.4`) |
| 11px padding-block | `--ngpt-sys-space-275` |
| 20px padding-inline | `--ngpt-sys-space-500` |

Border-radius was **not** overridden — the frame's hero buttons render at 22px vs. pill-button's
default 20px (`--ngpt-sys-shape-corner-large`), but the spec's own "Hero size override" bullet
only calls out font-size/weight/padding, not radius. Spec wins over frame, so radius stays at
pill-button's default.

## Decorative shape

Implemented exactly as the task brief and spec formula specify:
`left: calc(max(var(--hero-band-rail), (100vw - var(--ngpt-sys-layout-wide-measure)) / 2) + 700px)`
on `:host { position: relative; overflow: hidden; }`. `--hero-band-rail` is a local (non-`--ngpt-*`)
custom property on `:host` holding `clamp(24px, 4vw, 48px)` — reused by both the shape's formula
and `.hero-band__content`'s `padding-inline` so the one literal isn't duplicated in two places; it
is not a design-system token, just DRY within this file.

`top: -140px` comes from the frame (spec.md only says "bleeding off the top-right" qualitatively);
kept it since spec doesn't contradict a concrete number. `700px` is the spec's own literal, not the
frame's — spec.md states it directly: 40px past the copy column's 660px cap.

## Announcement pill status dot

Spec says only "a colored status dot" with no enumerated variants; the frame shows one green dot
("Now in public beta"). Added `announcementStatus: input<HeroBandAnnouncementStatus>('success')`
mapped via `[attr.data-status]` (CONVENTIONS.md #3: state as `data-*` attributes) to the existing
`--ngpt-status-success/warning/error/neutral` tokens, default `'success'` reproducing the current
copy's meaning. This is a small, already-tokenized axis (the status tokens exist site-wide for
exactly this purpose) rather than a bespoke enumerated flag, and costs nothing when unused.

## `id="hero-h1"` / `tabindex="-1"` on the H1

Not asked for in the task brief, but the frame's skip-link (`href="#hero-h1"`,
`specs/foundations/Focus and Keyboard.md`) targets this exact H1 with this exact id and
`tabindex="-1"`. Home only ever has one hero-band instance, so a static id is safe here (unlike a
reusable DS component, where a static id would collide on multiple instances). Included it since
hero-band is the component that owns the H1 the skip link needs to land on; the skip-link `<a>`
itself is built elsewhere (page shell), not by this component.

## Untokenized literals (no `--ngpt-*` token exists for these — kept as spec-given literals)

| Value | Where | Note |
|---|---|---|
| `clamp(24px, 4vw, 48px)` | rail padding (`--hero-band-rail`) | shared page-wide rail value, not yet promoted to a sizing token anywhere in `src/styles/tokens/` |
| `clamp(28px, 3.5vw, 44px)` / `clamp(32px, 4vw, 52px)` | `.hero-band__content` padding-block | band's own top/bottom padding, single-use |
| `oklch(1 0 0 / 0.07)` | `.hero-band__shape` background | matches pill-button precedent: literal kept when no token matches, not rounded to a near token |
| `oklch(0 0 0 / 0.15)` | `.hero-band__announcement` background | same — spec's own contrast rationale is pinned to this exact value |
| `7px` | announcement dot↔text gap | no exact `--ngpt-sys-space-*` step |
| `11px` | `.hero-band__actions` gap | no exact step |
| `26px` | `.hero-band__actions` margin-top | spec § Height calls this "26px above the buttons" explicitly, but still no exact step |
| `660px` | `.hero-band__copy` max-width | spec-given copy cap, one-off |

Where an exact token *did* match (20px → `--ngpt-sys-space-500`, 18px → `--ngpt-sys-space-450`, the
hero button size step, the 1080px wide measure, all colors, all typescale bases), the token was
used — these are the only true gaps, all pre-existing in `CONVENTIONS.md`'s "never hardcode a value
that has a token" sense: no token exists to reference.

## No icons

Announcement dot is a plain `<span>` circle (CSS `border-radius: 50%`), not an icon — nothing in
`Iconography.md`'s mapping table represents a status dot, so no `provideIcons`/`viewProviders`
registration was added.
