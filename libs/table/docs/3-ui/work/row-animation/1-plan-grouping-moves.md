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

So grouping moves need **no new API**. The grouping-editing
story shows no glide only because it doesn't use the
directives: it writes `data-row-kind`/`data-depth` by hand.

Enter and exit (a header appearing on a first-time category
pick, disappearing when its last row leaves) are handled by
the consumer per D1. D2 is the one library change that
pattern forces.

## Consumer API

Moves — same opt-in as sorting:

```html
<table [ngpTable]="table">
  @for (row of table.renderRows(); track row.id) {
    <tr [ngpTableRow]="row">...</tr>
  }
</table>
```

```css
@import '<lib>/row-flip.css';
.my-table { border-collapse: separate; border-spacing: 0; }
```

Shipped stylesheet: [row-flip.css](../../../../src/row-flip.css).

Enter/exit — consumer's own template and CSS (illustrative):

```html
<tr [ngpTableRow]="row"
    animate.enter="row-enter"
    animate.leave="row-leave">
```

```css
.row-enter {
  animation: row-fade-in 200ms ease-out;
}
@keyframes row-fade-in {
  from { opacity: 0; }
}
.row-leave {
  opacity: 0;
  transition: opacity 200ms ease-in;
}
```

`animate.enter` also fires on the first render, so every row
fades in on load.

## Changes

1. **Library — row registry (D2).**
   - [ngp-table-row.directive.ts](../../../../src/directives/ngp-table-row.directive.ts):
     inject the host `ElementRef`; register
     `(rowId, element)` with the parent through the existing
     `NGP_TABLE_STORE` token; unregister on destroy, only if
     the registered element is still its own (a re-entering
     row with the same id may register before the leaving one
     is destroyed).
   - [ngp-table.directive.ts](../../../../src/directives/ngp-table.directive.ts):
     `captureRowTops` (lines 94-106) iterates `renderRows()`
     ids and reads each element from the registry. Drops the
     `querySelectorAll('[data-row-kind]')` + index pairing.
     Leaving rows are ignored. No DOM query, no new attribute.

2. **Spec — new `src/directives/ngp-table.directive.spec.ts`.**
   One case: a DOM element still present for a row no longer
   in `renderRows()` does not shift the measured tops of the
   rows after it.

3. **[grouping-editing-story-host.component.html](../../../../src/stories/row-edit/grouping-editing/grouping-editing-story-host.component.html)**
   - `<table ...>` gets `[ngpTable]="table"`.
   - `<tr [attr.data-row-kind] [attr.data-depth]>` becomes
     `<tr [ngpTableRow]="row" animate.enter="row-enter"
     animate.leave="row-leave">`. The directive writes both
     attributes itself
     ([ngp-table-row.directive.ts:12-13](../../../../src/directives/ngp-table-row.directive.ts)),
     so [grouping-story.css](../../../../src/stories/grouping/grouping-story.css)
     selectors keep working.
   - Hint text: one sentence that the row glides into its
     group, and a new header fades in.

4. **[grouping-editing-story-host.component.ts](../../../../src/stories/row-edit/grouping-editing/grouping-editing-story-host.component.ts)**
   - Add `NgpTableDirective`, `NgpTableRowDirective` to
     `imports` (paths as in
     [sorting-editing-story-host.component.ts:6-7](../../../../src/stories/row-edit/sorting-editing/sorting-editing-story-host.component.ts)).
   - Append `./grouping-editing-flip.css` to `styleUrls`.
   - JSDoc: mention the glide and the enter/exit fade.

5. **New `grouping-editing/grouping-editing-flip.css`** — copy
   of [sorting-editing-flip.css](../../../../src/stories/row-edit/sorting-editing/sorting-editing-flip.css)
   (`@import` of `row-flip.css` + `border-collapse: separate`
   on `.story-host__table`), plus the `.row-enter` /
   `.row-leave` fade classes from the Consumer API section.

6. **[row-animation.md](../../directives/row-animation.md)**
   - Executive summary: grouping reshuffles are covered by the
     same mechanism; link the discovery doc.
   - New "Enter and exit" section under "Enabling the
     animation": consumer-owned pattern (D1), the example,
     first-render fade, the snap limitation (D2).
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

7. **Grouping-editing `.stories.ts` / mdx** — only if their
   text describes the rows as jumping; otherwise untouched.

Library change: the row registry (step 1), covered by one new
spec (step 2).

## Verification (user runs)

Nothing is run by us.

- `nx run shared-table:typecheck` and
  `nx run shared-table:typecheck-spec` clean. Re-run if the
  first run reports `.ts` errors (ngc skips templates then).
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
