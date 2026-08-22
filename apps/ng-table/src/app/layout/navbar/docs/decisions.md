# navbar — decisions

## Final public API

```ts
@Component({ selector: 'ngpt-navbar', ... })
export class Navbar {
  readonly variant = input<NavbarVariant>('docs'); // 'docs' | 'band'
  readonly openSearch = output<void>();
}
```

No other inputs/outputs — matches `docs/CONVENTIONS.md`'s fixed contract exactly. `NavbarVariant`
lives in `navbar.types.ts` per contract rule 2.

## Scroll-listener implementation

```ts
protected readonly scrolled = signal(false);

constructor() {
  afterNextRender(() => {
    if (this.variant() !== 'band') {
      return;
    }
    const onScroll = (): void => {
      this.scrolled.set(window.scrollY > SCROLL_THRESHOLD_PX); // 24
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    this.destroyRef.onDestroy(() => window.removeEventListener('scroll', onScroll));
  });
}
```

`scrolled.set(...)` is a boolean threshold (`> 24`), never a gradient, so `[attr.data-scrolled]`
only ever flips once each direction — no flicker. `onScroll()` runs once synchronously before the
listener attaches, so a page that loads already scrolled (e.g. a deep link with a scroll-restore)
renders the correct surface on the first paint instead of waiting for the next scroll event.

**The listener is registered only for `variant: 'band'`.** Home's spec draws an explicit line:
"On docs pages: `--ngpt-bg-deep`, bottom border, sticky" (static) vs. "Here: Sticky, but
two-state" (Home's hero only). The docs variant's own Container table in `spec.md` has no
scroll-conditioned property — it's sticky, but its background/border never change. Registering a
`window` scroll listener that never does anything for the docs variant would be dead work on every
scroll frame across the whole docs site, so the `variant() !== 'band'` guard skips attaching it
entirely rather than attaching-then-no-op'ing in CSS. `scrolled` stays permanently `false` for
`docs`, and no docs-variant CSS selector reads `[data-scrolled]` — the attribute is inert there.

**No reduced-motion override.** The task brief asked me to double-check this: the band transition
is `background-color` / `border-block-end-color` / `box-shadow` — color and shadow, never a
`transform`. `src/styles/global.css`'s `prefers-reduced-motion: reduce` block already collapses
*all* `transition-duration` (not just transform-driven ones) to
`--ngpt-sys-motion-duration-fast` via a universal selector, so the swap still happens, just faster
— no navbar-local media query needed. Contract rule 9 only requires a component to suppress its
*own* transform under reduced motion; there is no transform here to suppress.

## `docs` vs `band` — what actually differs

| | `docs` | `band` |
| --- | --- | --- |
| Surface | Static `--ngpt-bg-deep`, `--ngpt-border-subtle` bottom edge, always | Transparent until scrolled, then `--ngpt-navbar-scrolled` + border + shadow, 180ms |
| Inner width | Full bar width, `24px` fixed side padding | Capped at `--ngpt-sys-layout-wide-measure` (1080px), centered, `clamp(24px,4vw,48px)` side padding (Home's section rail) |
| Logo fill | `--ngpt-accent` | `--ngpt-text-primary` (white) — spec: "Logo mark and text go white" |
| Hamburger | `<md` (1023px and below), opens the sidebar drawer | Never — Home has no sidebar to open |
| Right group | Search, Sponsor pill, status dot, Discord, GitHub | Search (`on-band` variant), Documentation, GitHub |
| Link fill/border | None specified — plain text-tertiary, color shift on hover | None ever; hover **darkens** the band (`oklch(0 0 0 / 0.15)`), never lightens (spec's own AA contrast note) |
| `<640px` | Title hides, Sponsor pill drops (spec's own breakpoint table) | No breakpoint behavior specified in `pages/home/docs/spec.md` — left as-is |

Both variants render the same DOM shape (`.navbar__inner > .navbar__left, .navbar__right`) so
responsive rules are pure CSS, matching how `search-field.css` already owns its own icon-only
collapse — navbar doesn't duplicate that.

## Glyph mapping

Only one glyph this component owns directly: the hamburger, `lucideMenu`, per
`src/styles/docs/Iconography.md`'s own mapping row ("≡ (mobile menu trigger) → lucideMenu") and
`spec.md`'s Mobile section ("a hamburger (lucideMenu, 20px)"). Rendered through `ngpt-icon-button`,
which already registers `lucideMenu` in its own `viewProviders` — no new icon registration needed
in `navbar.ts`.

## Deviations from the fixed contract / spec (reported per rule 10)

1. **`--ngpt-sys-space-250-alt` doesn't exist.** `spec.md`'s front-matter and its Left-group table
   both cite it for the 10px logo-to-title gap. `src/styles/docs/Spacing.md` (the token
   foundations doc, single source of truth) explicitly calls this out as stale: *"There are no
   `-alt`... variants... `-250-alt` for values this ramp already carries (... 10px). Those names
   never existed."* Used `--ngpt-sys-space-250` (10px, the real token) instead — not a deviation
   from the design intent, just from a spec citation that the design system's own docs say is
   wrong.

2. **Hamburger is `size="24"`, not 20px.** `spec.md`'s Mobile section says the hamburger glyph
   renders at 20px (`--ngpt-sys-icon-size-lg`). `ngpt-icon-button`'s fixed contract
   (`docs/CONVENTIONS.md`) only allows `size: 24 | 30 | 32`, and its glyph size is hardcoded
   internally to `--ngpt-sys-icon-size-sm` (13px) regardless of the `size` input — the outer box
   never reaches 20px either way, and I was told not to touch `icon-button`'s files. Used `24`
   (the smallest allowed box) as the closest match; the 20px figure in the spec isn't reachable
   through the current `icon-button` contract.

3. **Discord/GitHub don't collapse to icon-only below 640px.** `spec.md`'s breakpoint table calls
   for this ("< 640px: ... Discord icon, GitHub icon"), but neither `Iconography.md`'s mapping
   table nor the Lucide icon set this app uses ships a Discord or GitHub brand mark — I checked
   `@ng-icons/lucide`'s type declarations directly (`grep -i "github\|discord"` — zero matches).
   Rather than inventing an icon outside the approved set, both links stay as short text labels at
   every width. Same category of gap as `code-block`'s "no Shiki this round" note.

4. **Link `href`s are `#` placeholders.** Discord, GitHub, Documentation, and the product
   name/logo (whether it links to `/` or the docs root is explicitly still open in `spec.md`'s own
   `## Open` section) have no real destination decided anywhere in the design-handoff bundle.
   Rendered Discord/GitHub/Documentation as real `<a>` elements (contract rule 4) with `href="#"`
   rather than a `<span>`, and left the logo/title as plain non-interactive text rather than
   guessing at the open question. Whoever resolves the open question should also fill in the real
   hrefs — nothing here should be treated as load-bearing.

5. **Sponsor pill and hamburger have no wired behavior.** `ngpt-pill-button` has no `href` or
   navigation contract, and wiring the hamburger's `pressed` output to an actual sidebar drawer is
   out of scope — there is no drawer component yet. Both render correctly and are keyboard/SR
   accessible; a future docs-shell task connects them (mirrors `nav-item`'s "no router wiring this
   round" precedent already accepted elsewhere in this build).

6. **`clamp(24px, 4vw, 48px)` band padding is a hardcoded literal.** `pages/home/docs/spec.md`
   gives this exact value for every section's rail padding ("One left rail... the same horizontal
   padding, `clamp(24px, 4vw, 48px)`") but no `--ngpt-*` token in `src/styles/tokens/` covers it —
   `sizing.css` has no section-padding token. Matches the precedent search-field.css and
   pill-button.css already set for their own `on-band` literals (documented inline, not
   introducing a new token unilaterally).

7. **Physical → logical CSS.** `border-bottom` → `border-block-end` throughout, matching the same
   call `page-footer/docs/decisions.md` and `category-badge/docs/decisions.md` already made
   (`border-top` → `border-block-start`, `margin-bottom` → `margin-block-end`). No visual
   difference in this LTR-only, dark-only app — kept for consistency with the rest of the DS.

## No `.mock.ts`

Considered a `navbar.mock.ts` for the Discord/GitHub/Documentation link data (file-organization
rule: "sample/fixture data goes in `<name>.mock.ts`"), but these aren't fixture/demo data — they're
permanent structural chrome text, same category as `page-footer.html`'s hardcoded
`Copyright © 2026 NGP Table` or `search-field.html`'s hardcoded `Search docs` placeholder. Kept
inline in `navbar.html` per variant case rather than introducing an array + `@for` + a types export
for three static strings.

## Root element — host is the landmark, no wrapper

Same call as `page-footer`: `ngpt-navbar` is a custom element, so it can never literally be a
`<header>`. `role="banner"` goes directly on the host (`host: { role: 'banner' }`), and the host
itself carries the sticky/background/border/padding styles — `navbar.html`'s only markup is the
two flex groups, no wrapping `<header>`/`<nav>` inside. Deliberately **not** `<nav>`: that would
create a second `navigation` landmark competing with the sidebar's, which
`src/styles/docs/Focus and Keyboard.md`'s landmark order reserves for the sidebar tree alone
(`banner` → `navigation` → `main` → ...).
