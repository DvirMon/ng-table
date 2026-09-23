---
title: UI Layer — Row Reorder Animation (ngpTableRowAnimation FLIP)
type: architecture
version: 0.5
date: 2026-09-23
capability: row-animation
spec: drilled
code: shipped
audience: developers
---

# UI Layer — Row Reorder Animation

## Executive Summary

FLIP-based animation for row reordering (any `renderRows()` reshuffle — sorting, drag,
grouping, but not limited to any one of them), owned by its own opt-in directive,
`ngpTableRowAnimation`, placed once on the table host. **Off unless that directive is
present** — without it, `ngpTableRow` measures nothing and writes neither the offset custom
property nor the flipping attribute; a table with `ngpTable`/`ngpTableRow` alone gets no
animation mechanism at all.

Grouping reshuffles (row moves triggered by `withGrouping()`) are covered by this same
mechanism, no new API needed — it's already keyed on `renderRows()`, which animates any row
whose id survives a change regardless of what caused it. See
[the discovery doc](../work/row-animation/discovery-ag-grid-group-animation.md).

The directive/token/attribute contract here follows
[ADR-0026](../../adr/0026-headless-styling-contract.md) (headless styling: state as `data-*`
attributes, values as CSS custom properties, no bound classes, opt-in stylesheets per
capability) — this doc's mechanism section is that ADR's compliance proof for row animation.

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

`ngpTableRowAnimation` (selector `table[ngpTableRowAnimation], div[ngpTableRowAnimation]`,
dual-tag per ADR-0005) is a separate, opt-in directive placed on the same host element as
`ngpTable` — not folded into it, per the "opt-in behaviour gets its own public directive"
rule in `CLAUDE.md`. It injects `NGP_TABLE_STORE` (required) to read `renderRows()`, measures
every registered row element's `offsetTop` on each change, computes each row's before/after
delta keyed by `RowId`, and runs FLIP's invert-then-play sequence:

1. **Invert** — write the delta as the offset, transition off.
2. **Play** — two `requestAnimationFrame`s later, clear the offset to 0 and flip the flipping
   flag on, so the row glides from its old spot to its new (real) one.

It also writes the `data-row-animation` host attribute unconditionally — the selector hook the
preset stylesheet keys off (below) — and provides `NGP_TABLE_ROW_ANIMATION`, an
`InjectionToken<NgpTableRowAnimationDirective<unknown>>` typed to the directive class itself
and `useExisting`-provided, the same pattern as `NGP_TABLE_STORE`/`NGP_TABLE_ROW`.

**Row registry, keyed by id, not DOM position.** `ngpTableRow` registers its own host element
with `ngpTableRowAnimation` on construct and unregisters on destroy — guarded so a leaving
row's cleanup can't clobber a same-id row that re-entered before the leave animation finished.
This is what lets a leaving row — still present in the DOM mid `animate.leave`, but no longer
in `renderRows()` — get skipped during measurement instead of shifting the measured positions
of every row after it.

`ngpTableRow` injects `NGP_TABLE_ROW_ANIMATION` **optionally** and writes two things, both
`null`/absent when the token isn't present (no `ngpTableRowAnimation` on the host) or the
offset is exactly `0` (no jitter threshold — a sub-pixel delta still binds a transform; browsers
no-op an imperceptible one):

```ts
host: {
  '[style.--ngp-table-row-flip-offset]': 'flipOffsetStyle()', // '<n>px' string, or null
  '[attr.data-row-flipping]': 'isFlipping() ? "" : null',      // presence attribute, not a class
}
```

No inline `transform`, no bound class — CSS owns both the transform and the transition,
reading the custom property and selecting on the presence attribute. `ngpTableRow` itself
never has an opinion on timing or easing.

### Rejected: custom-property indirection (resolved)

An earlier revision of this directive wrote `[style.transform]` and a bound
`ngp-table-row--flip` class directly — the custom-property/`data-*` contract above was tried
once already and dropped, for two reasons hit while wiring it up the first time:

- `[style.--custom-prop.px]`'s unit-suffix binding syntax is not reliably applied to custom
  properties (unlike known CSS properties) — the offset value silently never reached the DOM.
- Measuring row DOM elements by querying `[ngpTableRow]` (the directive's own selector
  attribute) finds nothing — a property binding (`[ngpTableRow]="row"`) is never reflected as a
  real DOM attribute.

**The current shape avoids both failure modes.** The offset now binds as a plain string with
`px` already appended (`flipOffsetStyle()` returns `` `${offset}px` `` or `null`, never a
bare number needing a unit suffix), sidestepping the first bug entirely. Measurement reads the
row registry (above), never a DOM query, sidestepping the second. `ngp-table-row-animation.directive.spec.ts`
covers the registry/measurement behavior; it does not yet assert the string-with-`px` binding
reaches a real DOM style property end-to-end (that's a template/host-binding concern, not
covered by the current spec) — treat that specific claim as implemented, not independently
verified.

### Target `tr[ngpTableRow]` directly, no wrapper

**Verified in the demo prototype this was originally built from.** An earlier revision wrapped
each cell's content in an extra `.table-demo__cell-motion` span to hold the transform. That
wrapper was never necessary — it existed only because the transform was first (wrongly)
applied to `.table-demo__cell-content`, which has `overflow: hidden` for text truncation and
clipped the row mid-transition. `<tr>` itself has no `overflow: hidden`.

CDK drag-drop's sibling-shift (`sorting/single-axis-sort-strategy.ts`, verified against
source) sets `transform` directly on the real sibling element with an always-on
`transition: transform` in CSS — no wrapper, no cloning. `ngpTableRow` does the same.

**Caveat that was real, now resolved:** `transform` transitions on `display: table-row`
boxes are flagged as unreliable per an old W3C bug (`table-related elements are not
transformable per spec`), but that citation's own testing showed Firefox/Chrome support
it fine — only legacy IE/Opera don't, irrelevant for this DS table's evergreen-browser
target. Confirmed empirically: no problem transitioning `transform` on `tr` itself.

**Second caveat, still real — `border-collapse: collapse` breaks the row border during the
animation.** Collapsed borders are computed at layout time and stay anchored to the row's
layout position; they ignore `transform`, which is paint-only. Result: the row's bottom border
visually detaches and reappears as the row settles into its new position. Fix: `border-collapse:
separate; border-spacing: 0;` on the `<table>` — separate borders paint with each `<td>`'s own
box, so they move with the `<tr>`'s transform. **This cannot be shipped inside
`row-animation.css`** — that file has no way to know the consumer's table selector — so it
stays a manual step the consumer must take on their own table CSS.

## Enabling the animation

`ngpTableRow` writes nothing at all unless `ngpTableRowAnimation` is present on the host.

**1. Place the directive:**

```html
<table [ngpTable]="table" ngpTableRowAnimation>
  <tr [ngpTableRow]="row">...</tr>
</table>
```

**2. Import the preset stylesheet** (opt-in — a relative import today; there is no published
package yet, see the note at the end of this section):

```css
/* my-table.css */
@import '<path-to>/row-animation.css';

/* Required alongside the import — see caveat above. */
.my-table {
  border-collapse: separate;
  border-spacing: 0;
}

/* Optional: tune the preset through its input tokens. */
.my-table {
  --ngp-table-row-flip-duration: 200ms;
  --ngp-table-row-flip-easing: ease-out;
}
```

```ts
@Component({
  ...
  styleUrls: ['./my-table.css'],
})
```

The preset is wrapped in `@layer ngp-table`, so unlayered consumer CSS always wins over it
without needing `!important` or extra specificity (ADR-0026). It also carries a
`prefers-reduced-motion: reduce` branch that turns off every transition/animation it defines —
this is CSS-only; the directive's own measurement/offset computation runs unconditionally
regardless of the media query, so `matchMedia` never appears in the directive's code.

**3. Or write your own CSS instead of the preset** — both rules below are required, the
directive supplies neither:

```css
[data-row-animation] [data-row-kind] {
  transform: translateY(var(--ngp-table-row-flip-offset, 0));
}
[data-row-flipping] {
  transition: transform 500ms ease-out; /* any timing/easing you want */
}
```

**Neither step 2 nor 3** → rows still reorder, no visible glide (the custom property and
attribute are still written, just nothing reads them).

`row-animation.css` (`libs/table/src/row-animation.css`) also ships the enter/exit preset
classes — see "Enter and exit" below. It is not imported by the directive or `index.ts`.

**No package export yet.** The intended published shape is `@ngp/table/row-animation.css`
(matching the directive's naming), but `libs/table` has no publishable-library build today —
`build` uses `@angular/build:application` (an app-style build), not `@nx/angular:package`
(ng-packagr, the executor that would actually produce a consumable `package.json` with
`exports`). Until that build exists, every consumer inside this repo imports the file by a
relative path, same as `row-flip.css` did before it. This is a deliberate, deferred decision
(see `docs/3-ui/work/row-animation/1-plan-grouping-moves.md`, Decision D8), not an oversight.

## Enter and exit

**Consumer-owned, not a library API (D1).** `ngpTableRow` ships no enter/exit support — no
directive input, no class, no attribute of its own. A row appearing (a first-time category
header) or disappearing (the last row leaving a category) is structure, and structure is the
consumer template's job, the same attribute-only invariant the rest of this library follows.
Angular already ships the primitive for this: `animate.enter`/`animate.leave` directly on the
`@for` row's `<tr>`, no library involvement beyond the preset's optional class names.

```html
<tr [ngpTableRow]="row"
    animate.enter="ngp-table-row--enter"
    animate.leave="ngp-table-row--leave">
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
leaving row from corrupting *other* rows' measured positions while it's still present, but it
does not give the leaving row's old slot a glide of its own; that's the documented tradeoff of
letting the browser finish the leave animation before touching layout.

## What's directly portable from the demo prototype

The measurement/timing logic is pure signal + DOM-read code, no structural DOM dependency:

- Capture row positions by `RowId` lookup through the registry described above (`ngpTableRow`
  registers its own element with `ngpTableRowAnimation` on construct, unregisters on destroy) —
  never a DOM query paired by array index. This is what lets a leaving row — still present in
  the DOM mid `animate.leave`, but no longer in `renderRows()` — get skipped instead of
  shifting the measured positions of every row after it (D2).
- Trigger on `renderRows()` change and read positions after render, in one
  `afterRenderEffect({ read })` (not `queueMicrotask()` — that raced Angular's actual DOM commit
  and corrupted deltas; see prototype history).
- Compute delta = `oldTop - newTop` per row.
- Invert: write the delta as the offset value with no transition.
- Play: next frame(s), clear the offset to 0 and flip the transition-enabling flag on.

The position capture and delta computation live in `ngpTableRowAnimation` (the sibling
directive on the table host, since it needs all rows' positions together, not `ngpTable`
itself); each row reads its own offset/flipping state off it through the
`NGP_TABLE_ROW_ANIMATION` injection token.

## Open Questions

- [ ] Row-hold during editing (OQ-3 in `docs/1-state/features/with-row-edit.md`'s sorting ×
      editing story) is a related but separate concern — this animation plays even when a row
      is mid-edit; it does not itself prevent an open row from moving.
- [ ] Adding, removing, or reordering a group level changes every header's id
      (`buildGroupPath()`, `engine/grouping/clusters.ts:72-78`), so headers can't glide across
      a level change.
- [ ] Interruption: `offsetTop` ignores `transform`; a second change mid-glide may snap the row
      instead of re-animating smoothly from its current visual position. Unverified — not yet
      tested.
