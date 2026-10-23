---
title: UI Layer — Row Reorder Animation (ngpTableRowMove FLIP)
type: architecture
version: 0.9
date: 2026-10-10
capability: row-animation
spec: drilled
code: shipped
audience: developers
---

# UI Layer — Row Reorder Animation

## Executive Summary

FLIP-based animation for row reordering (any `renderRows()` reshuffle — sorting, drag,
grouping, but not limited to any one of them), owned by its own opt-in directive,
`ngpTableRowMove`, placed once on the table host. **Off unless that directive is
present** — without it, `ngpTableRow` registers nothing; a table with
`ngpTable`/`ngpTableRow` alone gets no animation mechanism at all. The directive plays the
move itself through the Web Animations API (`element.animate()`); consumers set its timing
through the directive's `flipTiming` input, not a stylesheet. Renamed from
`ngpTableRowAnimation` on 2026-10-10 (#223), because it animates row moves only.

Grouping reshuffles (row moves triggered by `withGrouping()`) are covered by this same
mechanism, no new API needed — it's already keyed on `renderRows()`, which animates any row
whose id survives a change regardless of what caused it. See
[the discovery doc](../work/row-animation/discovery-ag-grid-group-animation.md).

The directive/token/attribute contract here follows
[ADR-0026](../../adr/0026-headless-styling-contract.md) (headless styling: state as `data-*`
attributes, values as CSS custom properties, no bound classes, opt-in stylesheets per
capability), as amended 2026-09-23 for this directive: the move is animated in JS, not by a
consumer CSS transition — see the ADR's amendment section.

This extends the `ngpTableRow` contract specced in [`core.md`](core.md); read that file first for
the directive's base inputs and DI wiring.

## Why FLIP, not AG Grid's technique

AG Grid animates row reorder by absolutely-positioning row DOM nodes and setting
`transform: translateY(rowTopPx)` — the browser interpolates because it's the same reused
node just getting a new transform value, no measurement needed (verified against AG Grid's
actual source, `rendering/row/rowCtrl.ts`, not assumed from memory).

That technique needs absolute positioning, which is disallowed here (`CLAUDE.md` — "Native
`<table>` only. No custom wrapper elements... Attribute-only directives — never insert/
remove/reorder DOM"). With native `<table>` layout, row order comes from source-DOM order;
there's no `rowTop` to just assign. FLIP is the substitute: measure position before, let the
DOM reorder, measure again, animate the delta.

## Mechanism

`ngpTableRowMove` (selector `table[ngpTableRowMove], div[ngpTableRowMove]`,
dual-tag per ADR-0005) is a separate, opt-in directive placed on the same host element as
`ngpTable` — not folded into it, per the "opt-in behaviour gets its own public directive"
rule in `CLAUDE.md`. It injects `NGP_TABLE_STORE` (required) to read `renderRows()` and runs
one `afterRenderEffect`, re-run only when `renderRows()` changes, after the DOM reflects it:

1. **`earlyRead`** — `measureMoves()`: measure every registered row element's `offsetTop` and
   plan each moved row's glide with `planGlide()` → `{ fromOffset, toOffset }`, clamping an
   off-screen end to the nearest screen edge and dropping rows off screen at both ends (see
   **Off-screen rows** below). DOM reads only.
2. **`write`** — skip entirely under `matchMedia('(prefers-reduced-motion: reduce)')`; otherwise
   call `element.animate()` on each moved row with inline keyframes `translateY(<delta>px)` →
   `none` and the `flipTiming` options. FLIP's invert is the first keyframe and its play is the
   animation itself, so the inverted position never has to render on its own.

No `requestAnimationFrame`, no nested `afterNextRender`, no forced style read, no signal of
its own.

**Off-screen rows.** `planGlide()` checks each moved row's `getBoundingClientRect()` against
the window viewport at both ends of the move:

- **On screen at both ends** — the exact glide, from `oldTop - newTop` to `none`.
- **Arriving** (off before, on after) — starts just outside the edge it came from (from below:
  `innerHeight − top`; from above: `−bottom`) and slides in at the normal duration.
- **Leaving** (on before, off after) — glides from its old position to just past the edge it
  leaves through, then snaps to its real slot (`fill: none`, off screen, so invisible).
- **Off screen at both ends** — including one that would only pass across the screen — jumps.

Decided 2026-09-24 (skip), refined 2026-09-25 (clamp): a large sort or reverse moved visible
rows ~24,000px in 300ms, which read as a jump with no visible glide; clamping keeps every
visible glide screen-sized, and skipping caps `animate()` calls at about two screenfuls (the
benchmark measured ~42ms per 1,000). Caveats: the check uses the window, not a scroll
container, so a row the container clips still animates (one wasted animation, never a missed
glide); and `getBoundingClientRect()` includes an in-flight transform, so a reorder mid-glide
checks where the row is drawn, not its layout slot.

**Timing.** `flipTiming = input<KeyframeAnimationOptions>({ duration: 300, easing:
'cubic-bezier(0.4, 0, 0.2, 1)' })`, passed straight to `animate()`. Read untracked in the
`write` phase, so changing it never re-runs the effect — it applies from the next move.
Reduced motion: rows still reorder, they just don't glide.

It also writes the `data-row-move` host attribute unconditionally and provides
`NGP_TABLE_ROW_MOVE`, an `InjectionToken<NgpTableRowMoveDirective<unknown>>` typed to
the directive class itself and `useExisting`-provided, the same pattern as
`NGP_TABLE_STORE`/`NGP_TABLE_ROW`.

**Row registry, keyed by id, not DOM position.** `ngpTableRow` registers its own host element
with `ngpTableRowMove` on construct and unregisters on destroy — guarded so a leaving
row's cleanup can't clobber a same-id row that re-entered before the leave animation finished.
This is what lets a leaving row — still present in the DOM mid `animate.leave`, but no longer
in `renderRows()` — get skipped during measurement instead of shifting the measured positions
of every row after it.

`ngpTableRow` injects `NGP_TABLE_ROW_MOVE` **optionally** and only registers/unregisters
its element; it binds nothing for animation. No state attribute marks a row while it moves —
dropped as unused, can return when a consumer needs it (ADR-0026 amendment).

A reorder mid-glide needs no cancel: a later `animate()` on the same element overrides the
earlier one.

### Why Web Animations, not a CSS transition (decided 2026-09-23)

The previous shape bound the offset to `--ngp-table-row-flip-offset` and let consumer CSS
transition it. CSS starts a transition only between two computed values the browser actually
resolved (CSS Transitions §3), so the invert had to render before the play:

- **Double `requestAnimationFrame`** — dropped: it only _guessed_ that Angular had rendered the
  invert by two frames later.
- **Deferred `afterNextRender` + forced `getComputedStyle(row).transform`** (tried as "option
  B") — dropped: correct, but needed a second render per reorder plus a forced style read.
- **Web Animations** — the start value is the first keyframe, so one render and one hook
  suffice. Cost: the consumer can no longer replace the move with their own CSS transition;
  timing moves from CSS custom properties to the `flipTiming` input; `--ngp-table-row-flip-offset`,
  `flipOffsetFor()` and `data-row-flipping` are gone (ADR-0026 amendment).

### Rejected: custom-property indirection (history)

An earlier revision wrote `[style.transform]` and a bound `ngp-table-row--flip` class directly.
The later custom-property/`data-*` offset contract hit two bugs on its first attempt:
`[style.--custom-prop.px]`'s unit-suffix syntax silently never reached the DOM, and measuring
by querying `[ngpTableRow]` found nothing (a property binding is never reflected as a DOM
attribute). The offset property is now gone entirely; measurement still reads the row
registry, never a DOM query. `ngp-table-row-move.directive.spec.ts` covers registry,
measurement, the `animate()` keyframes and reduced motion against a stubbed
`animate`/`matchMedia` (jsdom implements neither).

### Target `tr[ngpTableRow]` directly, no wrapper

**Verified in the demo prototype this was originally built from.** An earlier revision wrapped
each cell's content in an extra `.table-demo__cell-motion` span to hold the transform. That
wrapper was never necessary — it existed only because the transform was first (wrongly)
applied to `.table-demo__cell-content`, which has `overflow: hidden` for text truncation and
clipped the row mid-transition. `<tr>` itself has no `overflow: hidden`.

CDK drag-drop's sibling-shift (`sorting/single-axis-sort-strategy.ts`, verified against
source) sets `transform` directly on the real sibling element with an always-on
`transition: transform` in CSS — no wrapper, no cloning. `ngpTableRowMove` likewise
animates `transform` on the `<tr>` itself (via `animate()`).

**Caveat that was real, now resolved:** `transform` transitions on `display: table-row`
boxes are flagged as unreliable per an old W3C bug (`table-related elements are not
transformable per spec`), but that citation's own testing showed Firefox/Chrome support
it fine — only legacy IE/Opera don't, irrelevant for this DS table's evergreen-browser
target. Confirmed empirically (with the earlier CSS-transition shape): no problem animating
`transform` on `tr` itself.

**Second caveat, still real — `border-collapse: collapse` breaks the row border during the
animation.** Collapsed borders are computed at layout time and stay anchored to the row's
layout position; they ignore `transform`, which is paint-only. Result: the row's bottom border
visually detaches and reappears as the row settles into its new position. Fix: `border-collapse:
separate; border-spacing: 0;` on the `<table>` — separate borders paint with each `<td>`'s own
box, so they move with the `<tr>`'s transform. **This cannot be shipped inside
`row-animation.css`** — that file has no way to know the consumer's table selector — so it
stays a manual step the consumer must take on their own table CSS.

## Enabling the animation

`ngpTableRow` writes nothing at all unless `ngpTableRowMove` is present on the host.

**1. Place the directive** — this alone enables the glide; no stylesheet is required for it:

```html
<table [ngpTable]="table" ngpTableRowMove>
  <tr [ngpTableRow]="row">
    ...
  </tr>
</table>
```

**2. Set separate borders on your table** (see caveat above — the library can't know your
table's selector):

```css
.my-table {
  border-collapse: separate;
  border-spacing: 0;
}
```

**3. Optional: tune the timing** through the `flipTiming` input (any
`KeyframeAnimationOptions`):

```html
<table
  [ngpTable]="table"
  ngpTableRowMove
  [flipTiming]="{ duration: 200, easing: 'ease-out' }"
></table>
```

`row-animation.css` (`libs/table/src/row-animation.css`) ships **no FLIP rules** — only the
enter/exit preset classes, see "Enter and exit" below. It is wrapped in `@layer ngp-table`, so
unlayered consumer CSS always wins over it (ADR-0026), and carries a `prefers-reduced-motion:
reduce` branch for those classes. Reduced motion for the FLIP move is handled in the directive
(`matchMedia`), not in CSS. The file is not imported by the directive or `index.ts`.

**No package export yet.** The intended published shape is `@ngp/table/row-animation.css`
(matching the capability name), but `libs/table` has no publishable-library build today —
`build` uses `@angular/build:application` (an app-style build), not `@nx/angular:package`
(ng-packagr, the executor that would actually produce a consumable `package.json` with
`exports`). Until that build exists, every consumer inside this repo imports the file by a
relative path, same as `row-flip.css` did before it (needed only for the enter/exit classes). This is a deliberate, deferred decision
(see `docs/3-ui/work/row-animation/1-plan-grouping-moves.md`, Decision D8), not an oversight.

## Enter and exit

**Consumer-owned, not a library API (D1).** `ngpTableRow` ships no enter/exit support — no
directive input, no class, no attribute of its own. A row appearing (a first-time category
header) or disappearing (the last row leaving a category) is structure, and structure is the
consumer template's job, the same attribute-only invariant the rest of this library follows.
Angular already ships the primitive for this: `animate.enter`/`animate.leave` directly on the
`@for` row's `<tr>`, no library involvement beyond the preset's optional class names.

```html
<tr
  [ngpTableRow]="row"
  animate.enter="ngp-table-row--enter"
  animate.leave="ngp-table-row--leave"
></tr>
```

`row-animation.css` ships these two classes: `.ngp-table-row--enter` (200ms fade-in) and
`.ngp-table-row--leave` (200ms fade plus a padding/border/font-size collapse to zero, so the
rows below close the gap through layout at the same time the leaving row visually shrinks). A
consumer may pass any class names of their own instead — the library never binds these, they
are only ever consumer-supplied `animate.*` values.

`animate.enter` also fires on first render, so every row fades in on initial load, not just on
a later insert.

**Snap limitation (D2), documented not fixed:** `animate.leave` keeps the leaving `<tr>` in the
DOM until its own animation finishes. Rows below it get no glide for that interval — they only
snap up once the element is actually removed. The row registry (above) stops a lingering
leaving row from corrupting _other_ rows' measured positions while it's still present, but it
does not give the leaving row's old slot a glide of its own; that's the documented tradeoff of
letting the browser finish the leave animation before touching layout.

## What's directly portable from the demo prototype

The measurement/timing logic is pure signal + DOM-read code, no structural DOM dependency:

- Capture row positions by `RowId` lookup through the registry described above (`ngpTableRow`
  registers its own element with `ngpTableRowMove` on construct, unregisters on destroy) —
  never a DOM query paired by array index. This is what lets a leaving row — still present in
  the DOM mid `animate.leave`, but no longer in `renderRows()` — get skipped instead of
  shifting the measured positions of every row after it (D2).
- Trigger on `renderRows()` change and read positions after render, in one
  `afterRenderEffect` (`earlyRead` measures, `write` animates) — not `queueMicrotask()`, which
  raced Angular's actual DOM commit and corrupted deltas; see prototype history.
- Compute delta = `oldTop - newTop` per row.
- Invert and play as one `element.animate()` call: first keyframe `translateY(<delta>px)`,
  last keyframe `none`. No separate invert render, no `requestAnimationFrame` — see "Why Web
  Animations" above.

The position capture, delta computation and animation live in `ngpTableRowMove` (the
sibling directive on the table host, since it needs all rows' positions together, not
`ngpTable` itself); each row only registers its element with it through the
`NGP_TABLE_ROW_MOVE` injection token.

## Animation kinds and composition (decided 2026-10-10, not built)

**D-a. Only moves need positions.** Three kinds of row animation, by the data they need:

- **Move** (sort/filter/drag glide) — needs each row's old and new position. This
  directive's job.
- **Enter/leave** (fade on delete, staggered slide-in on load) — needs only "this row
  arrived/left". Angular's `animate.enter`/`animate.leave` already provide it (D1).
- **State/interaction** (hover pop, refresh ripple) — CSS on `:hover` or a `data-*`
  attribute, staggered by `@for`'s `$index`.
- So no generic "animation enabler" directive. If stagger effects become common, the
  smallest addition is a per-row `--ngp-table-row-index` custom property on `ngpTableRow`
  (ADR-0026: values as CSS custom properties), not a new directive.
- A height change from CSS (e.g. hover pop) does not trigger a glide — the directive reacts
  only to `renderRows()` changes.

**D-b. Drag-and-drop composes this directive through `hostDirectives`.**

- The future drag directive declares `hostDirectives: [NgpTableRowMoveDirective]`, so the
  consumer places only the drag directive.
- Allowed by the `CLAUDE.md` `hostDirectives` rule: drag is itself opt-in, not a core
  directive.
- Open: placing `ngpTableRowMove` by hand on the same host as well (duplicate directive
  match) — verify Angular's behavior when built.
- On drop, the dragged row is measured where it is drawn (`getBoundingClientRect` includes a
  transform), so it should glide from the pointer position — to verify.

**D-c. Consumer animators: a registration hook, called in the `write` phase.**

- A consumer's own directive injects `NGP_TABLE_ROW_MOVE` and registers a function that
  receives the moves (row id, element, old and new top) — e.g. `addMoveAnimator(fn)`.
- It must run inside this directive's `afterRenderEffect` `write` phase. A signal read in
  the consumer's own `effect` may run after paint, so the row would show at its new slot and
  then jump.
- Plus a boolean to turn off the built-in glide when replacing rather than adding — named
  for the deviation, e.g. `disableGlide`.
- Not built. Needs a spec for each new public symbol (the move type, the hook, the flag)
  when drag-and-drop or a real consumer needs it.

## Open Questions

- [ ] Row-hold during editing (OQ-3 in `docs/1-state/features/with-row-edit.md`'s sorting ×
      editing story) is a related but separate concern — this animation plays even when a row
      is mid-edit; it does not itself prevent an open row from moving.
- [ ] Adding, removing, or reordering a group level changes every header's id
      (`buildGroupPath()`, `engine/grouping/clusters.ts:72-78`), so headers can't glide across
      a level change.
- [ ] Interruption (known limitation, unchanged by the Web Animations switch): `offsetTop`
      ignores an in-flight `transform`, so a reorder mid-glide starts the new animation from the
      row's layout position, not its current visual one — a visible jump. Unverified in a
      browser.
