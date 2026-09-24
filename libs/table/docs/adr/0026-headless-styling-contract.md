# ADR-0026 — Headless styling contract: state as data attributes, values as custom properties, opt-in stylesheets per capability

**Status:** accepted — decided 2026-09-23.
**Related:** [ADR-0005](0005-generic-table-host.md) (dual-tag
host directives), `docs/3-ui/cross-cutting/styling-tokens.md`
(earlier draft, premise superseded), `docs/3-ui/work/styling-contract/`
(evidence: library survey), `docs/3-ui/work/row-animation/1-plan-grouping-moves.md`
(compliance proof).

## Context

The table library was extracted from an in-house design system
into this standalone repository. The earlier draft convention,
`docs/3-ui/cross-cutting/styling-tokens.md`, rejected
ng-primitives' fully headless model **only** because the table
was then expected to ship a default look (Atera tokens). That
premise is gone: the library is now standalone.

What ships already leans headless: sort indicators ship no
visual, and `src/row-flip.css` is an opt-in import that
`index.ts` never loads. Yet an existing locked invariant —
"state as `data-*` attributes, values as CSS custom
properties, no inline styles on directives" — is broken today
by the row directive's `[style.transform]` binding and bound
class `ngp-table-row--flip`.

The design borrowed from ng-primitives 0.130.3, Angular
Material 22.1.7, and Angular CDK 22.1.7 (read from installed
or published source in
`docs/3-ui/work/styling-contract/`).

## Decision

The library is headless-first, modelled on ng-primitives, with
Material-style optional stylesheets.

1. **State goes out only as `data-*` attributes** on the
   directive host. A true/false state is signalled by
   **presence** (`""` or absent), never `="true"`/`="false"`;
   an enumerated state carries its value (`data-row-kind="group"`).

2. **Measured values** the library computes go out as
   **output** custom properties, `--ngp-table-<part>-<measure>`
   (e.g. `--ngp-table-row-flip-offset`). The library writes
   them; consumers read them only.

3. **No inline styles and no library-bound classes.** An
   animation phase the library applies is a `data-*` presence
   attribute (e.g. `data-row-flipping`). Classes appear only as
   names the consumer passes to Angular's `animate.enter`/
   `animate.leave`; a shipped sheet may define preset classes
   for that purpose (e.g. `ngp-table-row--enter`/`--leave`).

4. **Shipped CSS:** one opt-in stylesheet per capability
   (e.g. `row-animation.css`). No theme bundle. Never imported
   by `index.ts`, never auto-loaded (no CDK `_CdkPrivateStyleLoader`-
   style loading). Every sheet is wrapped in `@layer
   ngp-table` so unlayered consumer rules win without
   specificity fights; selects only on public `data-*` hooks,
   never on directive selectors; has a `prefers-reduced-motion`
   branch for any motion. Published through a package `exports`
   entry with the `style` condition.

5. **Tokens:** *input* custom properties named
   `--ngp-table-<part>-<property>` (e.g.
   `--ngp-table-row-flip-duration`,
   `--ngp-table-row-flip-easing`). An input token exists only
   in the shipped sheet that reads it; each sheet lists its
   tokens; every read carries a literal fallback
   (`var(--ngp-table-row-flip-duration, 300ms)`,
   Material-style). No shipped system/semantic layer:
   consumers map tokens onto their own design system. Unlike
   Material, overriding tokens in plain CSS is officially
   supported. Docs mark each variable as output or input.

6. A consumer can style anything without the shipped sheets,
   using only the `data-*` hooks and output variables.

## Alternatives considered

- **Keep the draft's rejection of full headlessness (ship a
  default look).** Rejected: its premise (in-house DS
  component) no longer holds.

- **Classes for state** (e.g. keep `ngp-table-row--flip`).
  Rejected: mixes two state channels; ng-primitives binds no
  classes; data attributes compose with Tailwind
  data-variants.

- **A shipped theme bundle / system token layer like
  Material's `--mat-sys-*`.** Rejected for now: nothing to
  theme globally yet; revisit if several capability sheets
  need shared tokens. If a bundle ever ships, it holds only
  custom properties on a root selector, never component rules
  (Material's prebuilt-theme shape).

- **Material's Sass `overrides()` mixins.** Rejected: plain
  CSS custom properties are the supported override path.

- **CDK-style auto-loaded structural CSS.** Rejected:
  attribute-only directives need no structural CSS, and
  auto-loading defeats opt-in.

## Consequences

- `styling-tokens.md`'s "ng-primitives' fully headless model"
  rejection is superseded by this ADR; that doc should point
  here.

- Row animation (plan
  `docs/3-ui/work/row-animation/1-plan-grouping-moves.md`,
  D3-D6) complies: offset as `--ngp-table-row-flip-offset`,
  gliding as `data-row-flipping` (replacing the class
  `ngp-table-row--flip`), preset `row-animation.css` in
  `@layer ngp-table` with duration/easing input tokens.

- The library needs a package `exports` entry for its
  stylesheets; `@ngp/table/row-flip.css`, as documented
  today, does not resolve.

- Existing shipped violations (`[style.transform]`, the bound
  flip class) are fixed by the row-animation work, not by
  this ADR.

- To verify during implementation: `row-animation.md` records
  that `[style.--x.px]` failed, but the Angular source
  suggests it works; untested.

- Future capability styling (sort indicator, selection,
  resizing) follows this contract: new state = new
  `data-*`, new sheet = new opt-in file.

- This contract strengthens the locked invariant in
  `CLAUDE.md`: "State as `data-*` attributes, values as CSS
  custom properties, no inline styles on directives" now has
  an ADR recording its form and exceptions (output properties
  are an exception to "no library values in CSS"; none exist
  yet, but row animation will ship them).

## Amendment 2026-09-23 — row FLIP animates in the directive

The row reorder (FLIP) move is now played by
`ngpTableRowAnimation` through the Web Animations API
(`element.animate()`), not by a consumer CSS transition over
an offset custom property. A CSS transition needs the
inverted position to render before the play; the two ways to
guarantee that (a double `requestAnimationFrame`, or a
deferred `afterNextRender` plus a forced style read) were a
guess and an extra render respectively. `animate()` takes the
start position as its first keyframe. Rationale:
`docs/3-ui/directives/row-animation.md`, "Why Web
Animations".

What changes for this capability only:

- **Removed:** the output property
  `--ngp-table-row-flip-offset` (and the directive's
  `flipOffsetFor()`). The Consequences bullet naming it as the
  offset carrier, and the note that row animation "will ship"
  output properties, no longer hold — no output property ships.
- **Removed:** the input tokens
  `--ngp-table-row-flip-duration` /
  `--ngp-table-row-flip-easing`. Timing is the directive input
  `flipTiming: KeyframeAnimationOptions` (default
  `{ duration: 300, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' }`),
  passed straight to `animate()`. **An explicit exception to
  "values as CSS custom properties"**, for this directive only:
  Web Animations takes timing in JS, so CSS variables would
  only be read back with `getComputedStyle` and parsed.
- **Removed:** the state attribute `data-row-flipping`. No
  state attribute is exposed while rows move — dropped as
  unused; it can return, under this ADR's `data-*` rule, when a
  consumer needs it.
- **Lost for consumers:** replacing the move with their own
  CSS transition, reading the per-row offset, and styling a
  row while it moves.
- **Reduced motion** for the move is honoured in the directive
  (`matchMedia`); the preset's media query covers only the
  enter/leave classes. `row-animation.css` ships no FLIP rules.

Unchanged: the Decision's principle — state as `data-*`
attributes, values as CSS custom properties, no bound classes,
opt-in stylesheets per capability — still governs every other
capability, and would govern any state this directive exposes
later. `animate()` is not
treated as an inline style (it does not write the `style`
attribute); that reading is the premise of this amendment and
is not verified against the Web Animations spec text.
