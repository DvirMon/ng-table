---
title: Grouping row animation — moves + consumer-owned enter/exit
type: plan
status: approved, not started
date: 2026-09-23
audience: developers
---

# Grouping row animation (moves + consumer-owned enter/exit)

## Decisions (2026-09-23)

- **D1 — enter/exit is consumer-owned.** The consumer puts
  Angular's `animate.enter` / `animate.leave` on their `@for`
  row. The library adds no enter/exit API; it documents the
  pattern. Why: structure belongs to the consumer template
  (attribute-only invariant), and Angular already ships the
  primitive.
- **D2 — FLIP must tolerate a leaving row.** `animate.leave`
  keeps the `<tr>` in the DOM until its animation ends
  (`@angular/core/types/core.d.ts:5276`: "run before DOM node
  removal"). So:
  - **Library fix:** FLIP stops pairing elements with row ids
    by list position; it looks each row up by id instead.
  - **Documented limitation:** the leaving row keeps its space
    until removal, so rows below get no glide and snap up when
    it is removed.
- **D3 — row animation is opt-in and open through CSS.**
  - FLIP moves out of `ngpTable`/`ngpTableRow` into its own
    opt-in public directive placed on the table,
    `ngpTableRowAnimation`. Without it: no measuring, no
    transform, zero cost. Why: the "Directive composition"
    rule in [CLAUDE.md](../../../../CLAUDE.md) gives opt-in
    behaviour its own public directive, never folded into a
    core one; today FLIP runs on every table.
  - The extension point is CSS only: the `data-row-flipping`
    attribute for moves (D7); the consumer's `animate.enter`
    / `animate.leave` classes for enter/exit.
  - The library ships an optional preset stylesheet,
    `row-animation.css` (absorbs `row-flip.css`), with the
    move rules and the `ngp-table-row--enter` /
    `ngp-table-row--leave` classes. Leave preset: the CSS-only
    collapse now in `grouping-editing-flip.css` — shrink
    `padding-block`, `border-block-width` and `font-size` to
    0, plus a fade. (Amended by D12: keyframes, not a
    transition, plus a `max-block-size` clamp.)
  - No JS hook (e.g. `provideRowAnimation`). Rejected for now
    as more API than any concrete need. Revisit if a consumer
    needs non-glide motion (springs, custom paths).
  - Drag-drop settle rides the same directive when a drop
    changes `renderRows()`.
  - The row-id registry (D2) moves with FLIP into the new
    directive.
- **D4 — rows reach the animation through an optional token.**
  - The consumer places `ngpTableRowAnimation` once, on the
    table. It provides the `NGP_TABLE_ROW_ANIMATION` token.
  - `ngpTableRow` does
    `inject(NGP_TABLE_ROW_ANIMATION, { optional: true })`.
    Without the directive it binds nothing: no offset, no
    flipping attribute, no registration. Same pattern as
    today's optional `NGP_TABLE_STORE` inject.
  - Row registration for the D2 registry goes through that
    token, not through `ngpTable`.
  - `ngpTable` loses all FLIP code (offsets, playing flag,
    registry, effect).
  - Rejected: a second row-level directive (two placements
    to remember); the table directive writing styles to row
    elements directly (rows still need a hook to register,
    and it bypasses Angular bindings).
- **D5 — the offset is a CSS custom property; CSS owns the
  transform.** (Amended by D7: the gliding state is an
  attribute, not a class.)
  - `ngpTableRow` writes only `--ngp-table-row-flip-offset`
    (a string with `px`, e.g. `'-42px'`) and the
    `data-row-flipping` attribute. It never writes an inline
    `transform`.
  - Without the animation directive it writes nothing: the
    binding value is `null`, not `'undefinedpx'`. It binds a
    computed that returns `null` when the token is absent or
    the offset is 0.
  - CSS (the preset, or the consumer's own) applies it:
    `transform: translateY(var(--ngp-table-row-flip-offset, 0))`,
    plus the transition on `[data-row-flipping]`. A consumer
    may use another property.
  - Selector hook: the animation directive writes the
    `data-row-animation` host attribute; the preset selects on
    `[data-row-animation] [data-row-kind]`. Not on
    `[ngpTableRowAnimation]`:
    [row-animation.md](../../directives/row-animation.md)
    already records that directive selectors aren't reliable
    DOM hooks.
  - Honours the locked invariant "values as CSS custom
    properties, no inline styles" in
    [CLAUDE.md](../../../../CLAUDE.md).
  - Verify during implementation: the earlier failure was only
    the `[style.--x.px]` unit-suffix form (row-animation.md,
    "Rejected: custom-property indirection"). The
    string-with-`px` form is unverified — see Verification.
  - Consumer cost, stated in the docs: own CSS must include
    the transform rule, not only the transition.
- **D6 — final names.** Each follows an existing library
  pattern (`ngpTableRow` / `NGP_TABLE_ROW`,
  `--ngp-table-cell-bg`, `data-row-kind`). (Amended by D7.)
  - Directive: `ngpTableRowAnimation`, selector
    `table[ngpTableRowAnimation], div[ngpTableRowAnimation]`
    (dual-tag, ADR-0005).
  - Token: `NGP_TABLE_ROW_ANIMATION`.
  - Host attribute: `data-row-animation`.
  - Row attribute: `data-row-flipping` (D7).
  - Custom property: `--ngp-table-row-flip-offset`.
  - Preset classes: `ngp-table-row--enter`,
    `ngp-table-row--leave`.
  - Stylesheet: `@ngp/table/row-animation.css`, at
    `libs/table/src/row-animation.css`. Replaces
    `row-flip.css`, which is deleted.
  - Rejected: a shorter set without "table".
- **D7 — aligned with
  [ADR-0026](../../../adr/0026-headless-styling-contract.md)
  (headless styling contract).**
  - The gliding state is a presence attribute,
    `data-row-flipping` (`''` or absent), not a class. The
    library binds no classes; `ngp-table-row--flip` is gone.
  - The preset `row-animation.css` is wrapped in
    `@layer ngp-table`, selects only on `data-*` hooks
    (`[data-row-animation] [data-row-kind]`,
    `[data-row-flipping]`), and has a
    `prefers-reduced-motion` branch.
  - Input tokens with fallbacks:
    `--ngp-table-row-flip-duration` (`300ms`) and
    `--ngp-table-row-flip-easing`
    (`cubic-bezier(0.4, 0, 0.2, 1)`). A leave duration token,
    if added, follows the same naming
    (`--ngp-table-row-leave-duration`).
  - `ngp-table-row--enter` / `--leave` stay as preset class
    names. Allowed because the consumer passes them to
    `animate.enter` / `animate.leave`; the library never
    binds them.
- **D8 — the package manifest is out of scope for this
  implementation pass.** `libs/table` has no publishable
  library build at all — `build` uses
  `@angular/build:application` (an app-style build to
  `dist/libs/table`), not `@nx/angular:package` (ng-packagr,
  the executor that actually produces a consumable
  `package.json` with `exports`). A bare `package.json` here
  would not be copied into `dist/` or resolve to anything.
  `row-animation.css` ships as a relative import instead,
  same as `row-flip.css` does today
  ([sorting-editing-flip.css](../../../../src/stories/row-edit/sorting-editing/sorting-editing-flip.css),
  [grouping-editing-flip.css](../../../../src/stories/row-edit/grouping-editing/grouping-editing-flip.css)).
  Wiring a real publishable build (`@nx/angular:package`) is
  a separate, larger decision outside this ticket. The
  `@ngp/table/row-animation.css` import shown in Consumer API
  is the eventual shape once that build exists — not
  resolvable today.
- **D9 — the zero-offset check is exact.** `ngpTableRow` binds
  `null` only when the computed offset is exactly `0`, no
  jitter threshold. A sub-pixel delta still binds a transform;
  browsers no-op an imperceptible transform, so a threshold
  would be an unneeded magic number.
- **D10 — reduced motion stays CSS-only.** The directive reads
  no `matchMedia`; it always runs `captureRowTops` and
  computes the offset regardless of
  `prefers-reduced-motion`. Only the CSS (D7) suppresses the
  transition/motion. Keeps the directive's JS unaware of the
  media query.
- **D11 — token shape matches existing precedent.**
  `NGP_TABLE_ROW_ANIMATION` is
  `InjectionToken<NgpTableRowAnimationDirective<unknown>>`,
  provided via `useExisting` on the directive — same pattern
  as `NGP_TABLE_STORE` / `NGP_TABLE_ROW` in
  [table.tokens.ts](../../../../src/directives/table.tokens.ts).
  No narrower `RowAnimationApi` interface.
- **D12 — insert and delete use the same mechanism.** Source:
  [discovery-insert-delete-animation.md](discovery-insert-delete-animation.md).
  - AG Grid sends transactions and `rowData` + `getRowId`
    through the same
    `refreshModel({ keepRenderedRows, animate })` path as
    sort and grouping. Insert and delete therefore use the
    same move + enter/exit mechanism here. No new API.
  - The leave preset in `row-animation.css` switches from
    `transition` to `@keyframes`. Why: a transition inside
    `@layer ngp-table` loses to the consumer's unlayered
    form-control styles; keyframe animations beat every
    normal declaration, layered or not.
  - The collapse uses a `max-block-size` clamp on the row's
    descendants, which works in every browser. A smooth
    `auto → 0` via `interpolate-size` is only a progressive
    enhancement for Chromium 129+.
  - The enter preset is opacity-only, so FLIP measures the
    new row at full height and the rows below glide down.
  - **Trial, not a decision:** a second leave preset using
    `position: absolute`, so the row gives up its space at
    once and FLIP glides the rows below (AG Grid's shape).
    Tried in Storybook before it goes into the plan.
  - Id sharing between a leaving and a re-entering row is not
    a risk. The leaving row unregisters before its DOM node is
    removed, and a fast rollback removes the leaving `<tr>` at
    once.
  - Amends D3's leave-preset description (transition →
    keyframes).

No open questions remain.

## Risks

- **Stale position after a delete (inferred, unverified).**
  FLIP keeps the tops it measured while the leaving row still
  had full height. After that row is removed, the next
  `renderRows()` change may glide the rows below it by one
  row height. The grouping-header exit shares this. Source:
  [discovery-insert-delete-animation.md](discovery-insert-delete-animation.md)
  (Synthesis, Unverified). Checked in Verification below.

## Context

The user wants the same glide the sorting story has, for
grouping reshuffles. The discovery doc
([discovery-ag-grid-group-animation.md](discovery-ag-grid-group-animation.md))
found:

- AG Grid has one move mechanism for sort, group and drag.
  Group moves have no special class.
- ngpTable's FLIP effect
  ([ngp-table.directive.ts:46-81](../../../../src/directives/ngp-table.directive.ts))
  is keyed on `renderRows()`. It already animates any row whose
  id survives a change, whatever caused it.

So grouping moves need no new mechanism. The grouping-editing
story shows no glide only because it doesn't use the
directives: it writes `data-row-kind`/`data-depth` by hand.

Enter and exit (a header appearing on a first-time category
pick, disappearing when its last row leaves) are handled by
the consumer per D1. D2–D7 reshape how the library exposes
the animation.

## Consumer API

Moves need the opt-in directive, placed once on the table;
rows pick it up through the token with no extra markup.
Enter/exit uses Angular's own `animate.*` with the preset
classes:

```html
<table [ngpTable]="table" ngpTableRowAnimation>
  @for (row of table.renderRows(); track row.id) {
    <tr [ngpTableRow]="row"
        animate.enter="ngp-table-row--enter"
        animate.leave="ngp-table-row--leave">...</tr>
  }
</table>
```

```css
@import '@ngp/table/row-animation.css';
.my-table { border-collapse: separate; border-spacing: 0; }

/* optional: tune the preset through its input tokens */
.my-table {
  --ngp-table-row-flip-duration: 200ms;
}
```

A consumer can skip the preset and write their own rules.
Per D5 they must then supply both the transform and the
transition:

```css
[data-row-animation] [data-row-kind] {
  transform: translateY(var(--ngp-table-row-flip-offset, 0));
}
[data-row-flipping] {
  transition: transform 300ms ease-out;
}
```

Plus their own `animate.*` classes for enter/exit.

`animate.enter` also fires on the first render, so every row
fades in on load.

## Changes

1. **Library — `ngpTableRowAnimation` (D3) with the row
   registry (D2).**
   - New public directive, selector
     `table[ngpTableRowAnimation], div[ngpTableRowAnimation]`.
     It takes over the FLIP effect, `captureRowTops` and the
     offset / playing state now in
     [ngp-table.directive.ts](../../../../src/directives/ngp-table.directive.ts)
     (lines 39-106). Provides `NGP_TABLE_ROW_ANIMATION` (D4)
     and writes the `data-row-animation` host attribute (D5).
   - `NGP_TABLE_ROW_ANIMATION` goes in
     [table.tokens.ts](../../../../src/directives/table.tokens.ts)
     beside `NGP_TABLE_STORE` / `NGP_TABLE_ROW`.
   - `ngpTable` loses all FLIP code: offsets, playing flag,
     registry, effect.
   - [ngp-table-row.directive.ts](../../../../src/directives/ngp-table-row.directive.ts):
     `inject(NGP_TABLE_ROW_ANIMATION, { optional: true })`
     replaces the FLIP reads off `NGP_TABLE_STORE`. Bindings
     (D5, D7): `[style.--ngp-table-row-flip-offset]` to a
     computed returning `'<n>px'`, or `null` when the token is
     absent or the offset is 0; `[attr.data-row-flipping]` to
     `''` while gliding, else `null`. The `[style.transform]`
     and `[class.ngp-table-row--flip]` bindings are removed.
     With no token: no custom property, no attribute, no
     registration.
   - Registry: through the token, each row registers
     `(rowId, element)` and unregisters on destroy, only if
     the registered element is still its own (a re-entering
     row with the same id may register before the leaving one
     is destroyed). Measuring iterates `renderRows()` ids and
     reads each element from the registry. Drops
     `querySelectorAll('[data-row-kind]')` + index pairing, so
     leaving rows are ignored.
   - New `libs/table/src/row-animation.css`, published as
     `@ngp/table/row-animation.css`. Contents, all inside
     `@layer ngp-table` (D7):
     - `[data-row-animation] [data-row-kind]` →
       `transform: translateY(var(--ngp-table-row-flip-offset, 0))`.
     - `[data-row-flipping]` → `transition: transform
       var(--ngp-table-row-flip-duration, 300ms)
       var(--ngp-table-row-flip-easing,
       cubic-bezier(0.4, 0, 0.2, 1))`.
     - `.ngp-table-row--enter` → opacity-only fade in (D12).
     - `.ngp-table-row--leave` → `@keyframes`, not a
       transition (D12):
       - On the row itself: `opacity` to 0, so Angular's end
         detection (it watches the `<tr>` only) sees the
         longest animation.
       - On `> *` and `> * *` (not `td`, so the `div` grid
         host is covered): `to { padding-block: 0;
         border-block-width: 0; font-size: 0;
         min-block-size: 0 }`, and `max-block-size` from
         `var(--ngp-table-row-leave-max-block-size, 3rem)` to
         0.
       - `animation-fill-mode: forwards`, so nothing flashes
         back before removal.
       - Duration from
         `var(--ngp-table-row-leave-duration, 200ms)`.
     - `@supports (interpolate-size: allow-keywords)` → the
       leaving row animates `block-size` to 0 instead of the
       clamp (Chromium 129+ only).
     - `@media (prefers-reduced-motion: reduce)` → no
       transition, no enter/leave motion.
     - Trial (Storybook only, not shipped until decided): a
       `position: absolute` leave variant (D12).
   - Delete `src/row-flip.css`.
   - Export `NgpTableRowAnimationDirective` and
     `NGP_TABLE_ROW_ANIMATION` (if consumers need it) from
     [index.ts](../../../../src/index.ts), beside the other
     directives.
   - No package `exports` entry (D8) — out of scope, no
     publishable build exists yet.

2. **Spec — the new directive's own spec file.** Two cases:
   - A DOM element still present for a row no longer in
     `renderRows()` does not shift the measured tops of the
     rows after it.
   - A table without the directive writes no
     `--ngp-table-row-flip-offset` and no `data-row-flipping`.

3. **Sorting-editing story adopts the directive.** Without
   it, it loses its glide, since `ngpTable` no longer
   animates.
   - [sorting-editing-story-host.component.html](../../../../src/stories/row-edit/sorting-editing/sorting-editing-story-host.component.html):
     `ngpTableRowAnimation` on the `<table>`.
   - [sorting-editing-story-host.component.ts](../../../../src/stories/row-edit/sorting-editing/sorting-editing-story-host.component.ts):
     add the directive to `imports`.
   - [sorting-editing-flip.css](../../../../src/stories/row-edit/sorting-editing/sorting-editing-flip.css):
     `@import` of `row-animation.css` in place of
     `row-flip.css`.
   - Any other story importing `row-flip.css` gets the same
     change.

4. **[grouping-editing-story-host.component.html](../../../../src/stories/row-edit/grouping-editing/grouping-editing-story-host.component.html)**
   - `<table ...>` gets `[ngpTable]="table"` and
     `ngpTableRowAnimation`.
   - `<tr [attr.data-row-kind] [attr.data-depth]>` becomes
     `<tr [ngpTableRow]="row"
     animate.enter="ngp-table-row--enter"
     animate.leave="ngp-table-row--leave">`. The directive
     writes both attributes itself
     ([ngp-table-row.directive.ts:12-13](../../../../src/directives/ngp-table-row.directive.ts)),
     so [grouping-story.css](../../../../src/stories/grouping/grouping-story.css)
     selectors keep working.
   - Hint text: one sentence that the row glides into its
     group, and a new header fades in.

5. **[grouping-editing-story-host.component.ts](../../../../src/stories/row-edit/grouping-editing/grouping-editing-story-host.component.ts)**
   - Add `NgpTableDirective`, `NgpTableRowDirective` and
     `NgpTableRowAnimationDirective` to `imports` (paths as in
     [sorting-editing-story-host.component.ts:6-7](../../../../src/stories/row-edit/sorting-editing/sorting-editing-story-host.component.ts)).
   - Append `./grouping-editing-flip.css` to `styleUrls`.
   - JSDoc: mention the glide and the enter/exit fade.

6. **`grouping-editing/grouping-editing-flip.css`** —
   `@import` of `row-animation.css` +
   `border-collapse: separate` on `.story-host__table`. Its
   local leave collapse moves into the preset as
   `.ngp-table-row--leave`; the story uses the preset class
   names.

7. **[row-animation.md](../../directives/row-animation.md) —
   rewritten for the opt-in directive.**
   - Executive summary: off unless `ngpTableRowAnimation` is
     placed; grouping reshuffles use the same mechanism; link
     the discovery doc and ADR-0026.
   - Mechanism: the directive, the token, the registry, the
     custom property + `data-row-flipping` contract (D3–D5,
     D7).
   - "Enabling the animation": directive +
     `@ngp/table/row-animation.css` (layer, input tokens,
     reduced motion), or own CSS with both the transform and
     the transition rule.
   - New "Enter and exit" section: consumer-owned pattern
     (D1), the preset classes, first-render fade, the snap
     limitation (D2).
   - "Rejected: custom-property indirection": note the
     string-with-`px` form now used, and its verification.
   - "What's directly portable": the bullet saying rows are
     "index-zipped against `renderRows()`" becomes a registry
     lookup by id.
   - Open Questions, two new items:
     - Adding/removing/reordering a group level changes every
       header id
       ([clusters.ts:72-78](../../../../src/engine/grouping/clusters.ts)),
       so headers can't glide across a level change.
     - Interruption: `offsetTop` ignores `transform`; a second
       change mid-glide may snap. Unverified.
   - Update frontmatter (`version`, `date`); keep
     `capability: row-animation`.

8. **Grouping-editing `.stories.ts` / mdx** — only if their
   text describes the rows as jumping; otherwise untouched.

9. **Generated files.** The public surface changes, so
   `npm run llms` then `npm run llms:check` must be clean. If
   `row-animation.md` frontmatter changes, `npm run
   table:status`. User runs both.

Library change: `ngpTableRowAnimation` with the registry, the
token, `row-animation.css` and its package export (step 1),
covered by the new spec (step 2).

## Verification (user runs)

Nothing is run by us.

- `nx run shared-table:typecheck` and
  `nx run shared-table:typecheck-spec` clean. Re-run if the
  first run reports `.ts` errors (ngc skips templates then).
- `npm run llms:check` clean.
- Storybook → grouping-editing story:
  - Pick an existing category → the row glides under its
    header; rows between shift smoothly.
  - Clear a category → the row glides back to the flat block.
  - Pick a category for the first time → the new header fades
    in; the moved row still glides.
  - Move the last row out of a category → its header fades
    out; rows below snap up after the fade (expected,
    documented).
  - While a header is fading out, other rows' glides still
    land correctly (the registry fix).
  - Border stays attached during the glide.
  - The `<select>` keeps focus after the move.
  - D5 check — the `[style.--ngp-table-row-flip-offset]`
    string binding reaches the DOM: in devtools, a moving
    row's inline style shows
    `--ngp-table-row-flip-offset: -<n>px` (not `undefinedpx`,
    not missing) during the invert frame, and no inline
    `transform`. If it never appears, the string-with-`px`
    form fails like the `.px` form did.
  - `data-row-flipping` is present while rows glide, absent
    otherwise; no class is added to the row.
  - With OS reduced motion on, rows move without a glide or
    fade.
- Insert/delete (D12, from the discovery doc):
  - Delete a row that holds form controls → it collapses to
    0 with no snap.
  - Delete a row, wait over 200 ms, then sort so the rows
    below stay where they are → no stray glide (the stale
    position risk).
  - Delete a row, then roll back within 200 ms → one row,
    it fades in, no duplicate.
- Storybook → sorting-editing story: rows still glide on sort.
- Any story without `ngpTableRowAnimation`: rows get no
  `--ngp-table-row-flip-offset`, no `data-row-flipping`, no
  transform.
