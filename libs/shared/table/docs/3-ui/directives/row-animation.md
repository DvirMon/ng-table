---
title: UI Layer — Row Reorder Animation (ngpTableRow FLIP)
type: architecture
version: 0.2
date: 2026-09-01
capability: row-animation
spec: drilled
code: shipped
audience: developers
---

# UI Layer — Row Reorder Animation

## Executive Summary

FLIP-based animation for row reordering (any `renderRows()` reshuffle — sorting, but not
limited to it), built into `ngpTable`/`ngpTableRow`. Off by default: the directives always
track position and write the mechanism, but nothing is visible until the consumer imports (or
writes) a transition rule. Originally prototyped in `apps/demo/src/app/table-demo/` outside the
DS engine; that prototype's mechanism is what shipped here — an earlier draft of this doc
proposed a different (CSS custom-property + `data-*` attribute) contract that was never
implemented and turned out not to work when tried, see "Rejected: custom-property indirection"
below.

This extends the `ngpTableRow` contract specced in [`core.md`](core.md); read that file first for the
directive's base inputs and DI wiring.

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

`ngpTable` (the parent directive) measures every `[data-row-kind]` element's `offsetTop`
whenever `ngpTable().renderRows()` changes, computes each row's before/after delta keyed by
`RowId`, and runs FLIP's invert-then-play sequence:

1. **Invert** — write the delta as `flipOffset`, transition off.
2. **Play** — two `requestAnimationFrame`s later, clear the offset to 0 and flip `isRowFlipping`
   on, so the row glides from its old spot to its new (real) one.

`ngpTableRow` reads its own offset/flag from the parent (via the existing `NGP_TABLE_STORE`
token — no new DI surface) and writes them directly:

```ts
host: {
  '[style.transform]': 'flipTransform()',        // translateY(${offset}px) or '' when 0
  '[class.ngp-table-row--flip]': 'isFlipping()',
}
```

**`transform` is always live, with no opt-in required** — a row with a nonzero offset always
gets a real inline `transform`. What's opt-in is the *transition*: without a rule for
`.ngp-table-row--flip`, the invert-and-clear happens within a single paint (FLIP technique), so
the eye never sees the inverted state — the row just lands in its new spot with no visible
glide. Importing the transition rule (below) is what makes it animate.

### Rejected: custom-property indirection

An earlier revision of this doc proposed the directive writing only a CSS custom property
(`--ngp-table-row-flip-offset`) and a `data-row-flip` attribute, with the actual
`transform`/`transition` rules living entirely in the opt-in stylesheet — matching the
`data-*`/custom-property convention other directives use (`ngpTableSort`'s
`data-sort-direction`, `ngpTableCell`'s `--ngp-table-cell-bg`).

**Dropped after it didn't work in practice**, for two independent reasons hit while wiring it
up:

- `[style.--custom-prop.px]`'s unit-suffix syntax is not reliably applied to custom properties
  (unlike known CSS properties) — the offset value silently never reached the DOM.
- Measuring row DOM elements by querying `[ngpTableRow]` (the directive's own selector
  attribute) finds nothing — a property binding (`[ngpTableRow]="row"`) is never reflected as a
  real DOM attribute, so `querySelectorAll('[ngpTableRow]')` always returns empty. (Fixed by
  querying `[data-row-kind]` instead, which *is* written via `[attr.*]` — but this alone would
  not have been enough without also dropping the custom-property indirection.)

Verified-working `table-demo` prototype used direct `[style.transform]` + a plain CSS class the
whole time — reverting to that mechanism (rather than debugging the custom-property path
further) is what actually shipped.

### Target `tr[ngpTableRow]` directly, no wrapper

**Verified in the demo prototype.** An earlier revision wrapped each cell's content in an
extra `.table-demo__cell-motion` span to hold the transform. That wrapper was never
necessary — it existed only because the transform was first (wrongly) applied to
`.table-demo__cell-content`, which has `overflow: hidden` for text truncation and clipped
the row mid-transition. `<tr>` itself has no `overflow: hidden`.

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
box, so they move with the `<tr>`'s transform. **This cannot be shipped inside `row-flip.css`**
— that file has no way to know the consumer's table selector — so it stays a manual step the
consumer must take on their own table CSS.

## Enabling the animation

`ngpTableRow` tracks position and writes the mechanism unconditionally — the steps below are
what makes it *visible*, not what makes it *work*.

**1. Use the directives** (required regardless of animation):

```html
<table [ngpTable]="table">
  <tr [ngpTableRow]="row">...</tr>
</table>
```

**2. Import the default animation** (opt-in):

```css
/* my-table.css */
@import '@acme/table/row-flip.css';

/* Required alongside the import — see caveat above. */
.my-table {
  border-collapse: separate;
  border-spacing: 0;
}
```

```ts
@Component({
  ...
  styleUrls: ['./my-table.css'],
})
```

**3. Or write a different animation instead** — same contract, no import needed:

```css
.ngp-table-row--flip {
  transition: transform 500ms ease-out; /* any timing/easing you want */
}
```

**Neither step 2 nor 3** → rows still reorder, no visible glide.

`row-flip.css` (`libs/shared/table/src/row-flip.css`) ships only:

```css
.ngp-table-row--flip {
  transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

Not imported by the directive or `index.ts` — a consumer opts in with a normal import, or
ignores it and writes their own rule against the same `.ngp-table-row--flip` class.

## What's directly portable from the demo prototype

The measurement/timing logic is pure signal + DOM-read code, no structural DOM dependency —
this is what `ngpTable` now runs:

- Capture row positions by querying `[data-row-kind]` elements under the table host, keyed by
  `RenderRow.id` (index-zipped against `renderRows()`, since DOM order matches array order for
  an attribute-only, non-reordering directive).
- Trigger on `ngpTable().renderRows()` change via `effect()`, read positions inside
  `afterNextRender()` (not `queueMicrotask()` — that raced Angular's actual DOM commit and
  corrupted deltas; see prototype history).
- Compute delta = `oldTop - newTop` per row.
- Invert: write the delta as the offset value with no transition.
- Play: next frame(s), clear the offset to 0 and flip the transition-enabling flag on.

The position capture and delta computation live in `ngpTable` (parent, since it needs all
rows' positions together); each row reads its own `flipOffset`/`isRowFlipping` off the parent
through the existing `NGP_TABLE_STORE` injection token.

## Open Questions

- [ ] Row-hold during editing (OQ-3 in `docs/1-state/features/with-row-edit.md`'s sorting ×
      editing story) is a related but separate concern — this animation plays even when a row
      is mid-edit; it does not itself prevent an open row from moving.
