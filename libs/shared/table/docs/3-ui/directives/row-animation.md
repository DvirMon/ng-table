---
title: UI Layer — Row Reorder Animation (future ngpTableRow extension)
type: architecture
version: 0.1
date: 2026-08-17
status: draft — not implemented; verified in apps/demo/table-demo prototype, not yet ticketed
audience: developers
---

# UI Layer — Row Reorder Animation

## Executive Summary

FLIP-based animation for row reordering (e.g. on sort), prototyped in
`apps/demo/src/app/table-demo/` outside the DS engine. This doc records what was learned
building that prototype and how it maps onto `ngpTableRow` so it can be pulled into the
directive layer later — see `core.md` for the current `ngpTableRow` contract this extends.

**Not implemented here.** No code in `libs/shared/design-system` changes as part of this doc.

---

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

## Design: target `tr[ngpTableRow]` directly, no wrapper

**Verified in the demo prototype.** An earlier revision wrapped each cell's content in an
extra `.table-demo__cell-motion` span to hold the transform. That wrapper was never
necessary — it existed only because the transform was first (wrongly) applied to
`.table-demo__cell-content`, which has `overflow: hidden` for text truncation and clipped
the row mid-transition. `<tr>` itself has no `overflow: hidden`.

CDK drag-drop's sibling-shift (`sorting/single-axis-sort-strategy.ts`, verified against
source) sets `transform` directly on the real sibling element with an always-on
`transition: transform` in CSS — no wrapper, no cloning. The demo now does the same
directly on the `<tr>` (`table-demo.html`) — wrapper removed, transform + transition class
both live on the row element, animates cleanly. This avoids the wrapper entirely and stays
inside the locked invariants.

**Caveat that was real, now resolved:** `transform` transitions on `display: table-row`
boxes are flagged as unreliable per an old W3C bug (`table-related elements are not
transformable per spec`), but that citation's own testing showed Firefox/Chrome support
it fine — only legacy IE/Opera don't, irrelevant for this DS table's evergreen-browser
target. Confirmed empirically: no problem transitioning `transform` on `tr` itself.

**Second caveat found only once transform moved to `<tr>` — `border-collapse: collapse`
breaks the row border during the animation.** Collapsed borders are computed at layout
time and stay anchored to the row's layout position; they ignore `transform`, which is
paint-only. Result: the row's bottom border visually detaches and reappears as the row
settles into its new position. Fix: `border-collapse: separate; border-spacing: 0;` on the
`<table>` — separate borders paint with each `<td>`'s own box, so they move with the
`<tr>`'s transform. This is a genuine constraint for any consumer table wanting to opt into
row-flip animation with `border-collapse: collapse` — belongs as a prerequisite note
alongside the `row-flip.css` import (see Opt-in Delivery below), since it's specifically
consumers of that file who'd hit it.

## Proposed shape

Follows the `data-*` (state) / CSS custom property (value) convention from
`../cross-cutting/styling-tokens.md`, same pattern `ngpTableSort` uses for
`data-sort-direction`:

```ts
// Extends NgpTableRowDirective (core.md) — or a new opt-in directive stacked on it,
// same granularity question as sort.md's "own directive vs core" precedent.
host: {
  '[style.--ngp-table-row-flip-offset.px]': 'flipOffset()',
  '[attr.data-row-flip]': 'isFlipping() ? "" : null',
}
```

No inline `transform`/`transition` written by the directive itself — only the custom
property value and the state attribute change, matching every other directive's styling
contract (`ngpTableCell`'s `--ngp-table-cell-bg`, `ngpTableSort`'s `data-sort-direction`).
Same "no default animation shipped" stance as `sort.md`'s Styling Hook section — the
directive never writes `transform`/`transition` as a CSS rule, only the two host bindings
above. Whether any animation actually plays is entirely determined by whether the consumer
has the CSS below loaded — see Opt-in Delivery.

## Opt-in Delivery — decided 2026-08-17

**Decision:** the directive ships zero CSS. The actual animation (the two rules below)
lives in a separate, standalone stylesheet file the consumer imports only if they want the
built-in animation:

```css
/* table/row-flip.css — optional, not imported by the directive or index.ts */
tr[ngpTableRow] {
  transform: translateY(var(--ngp-table-row-flip-offset, 0px));
}
tr[ngpTableRow][data-row-flip] {
  transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

Consumer opts in with a normal import (`@import '@acme/shared-design-system/ui/table/
row-flip.css';` or via Angular `styleUrls`) — no import means the host bindings still fire
(harmless custom-property/attribute writes) but nothing visibly moves, since no CSS rule
consumes them. A consumer who wants a *different* animation just writes their own rule
against the same `--ngp-table-row-flip-offset`/`data-row-flip` contract instead of
importing this file — the directive's public contract is the custom property and the
attribute, not the CSS file.

**Rejected: runtime dynamic CSS loading** (directive input flag triggers a JS
`fetch`+`<style>`-injection at runtime). Considered and dropped as unnecessary complexity —
whether a consumer wants the animation is a build-time decision, not something that varies
per session, so a plain static import gets the same opt-in behavior with none of the
SSR/CSP/FOUC complications a runtime loader would introduce. Also inconsistent with how
Angular Material ships optional theme/animation CSS (separate importable files, not
runtime-injected).

## What's directly portable from the demo prototype

The measurement/timing logic is pure signal + DOM-read code, no structural DOM dependency —
portable as-is:

- Capture row positions via `viewChildren<ElementRef<HTMLTableRowElement>>('rowElement')` +
  `.nativeElement.offsetTop`, keyed by `trackBy`.
- Trigger on `table.sorting()` change via `effect()`, read positions inside
  `afterNextRender()` (not `queueMicrotask()` — that raced Angular's actual DOM commit and
  corrupted deltas; see prototype history).
- Compute delta = `oldTop - newTop` per row.
- Invert: write the delta as the offset value with no transition.
- Play: next frame(s), clear the offset to 0 and flip the transition-enabling flag on.

In the directive form, `ngpTableRow` already has `rowId`/`renderRow` per-instance — the
position capture and delta computation would live in `ngpTable` (parent, since it needs all
rows' positions together) and hand each row directive its own `flipOffset` via the row's
identity, rather than a component-level `Map` keyed by `trackBy` as in the demo.

## Open Questions

- [ ] Directive granularity: extend `ngpTableRow` itself (host bindings), or a new opt-in
      `ngpTableRowFlip`/`ngpTableSort`-adjacent directive — same question `sort.md` raised
      for its own feature, not decided here either.
- [ ] Where per-row `flipOffset` computation lives (parent `ngpTable` vs. a feature plugin
      contributing to `renderRows()`) — not decided; needs a work-folder session before
      ticketing.
- [ ] Not yet ticketed — this doc is a forward-looking capture only, per user request, so a
      future session can wire it up without re-deriving the demo's findings from scratch.
