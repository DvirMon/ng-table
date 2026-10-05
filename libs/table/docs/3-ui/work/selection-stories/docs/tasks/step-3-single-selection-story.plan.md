---
title: 'Step 3 — single-selection/: the single-select path'
type: task-step
plan: ../../1-gap-analysis.md
node: D
---

# Step 3 — `single-selection/`: the single-select path

**PR scope:** One story folder, complete — host, template, `.stories.ts`, `.mdx`.

**Task type:** code

**Skills used:** angular-developer, css-styling, typescript-conventions

**Depends on:** Step 1
**Parallel-safe with:** Step 2

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/stories/selection/single-selection/single-selection-story-host.component.ts` (create)
- `libs/table/src/stories/selection/single-selection/single-selection-story-host.component.html` (create)
- `libs/table/src/stories/selection/single-selection/single-selection.stories.ts` (create)
- `libs/table/src/stories/selection/single-selection/single-selection.mdx` (create)

## Why This Step Exists

Node D. `enableMultiRowSelection: false` is a **construction-time config path**, not an input to one
path — an on-canvas toggle would leave a dead branch in the host (`stories.md`, the same rule that
split `gated-single-*` from `gated-multiple-*`). Smallest host in the set, deliberately.

Covers §1.1, §1.7, §2.1, §3.3 (twice), §4.1.

## What To Do

1. `createTable(data, singleSelectionConfig, withSelection({ enableMultiRowSelection: false }))`.
2. **`<input type="radio" name="row-selection">` per row, not a checkbox** — MRT swaps the control
   automatically under single-select, PrimeNG ships `p-table-radio-button` as its variant. The radio
   group _is_ the replace semantics: ticking a second row visibly unticks the first, with no code
   saying so. D14's rule and the control agree.
3. **Conflicting bulk write (D14)** — "Restore a 2-id saved selection" →
   `select(SAVED_CONFLICTING_SELECTION_IDS)` (both ids exist in the fixture). Under `ngDevMode` this
   throws naming the discarded ids; the host catches and renders it on canvas, so the
   truncate-in-production / throw-in-dev split is visible instead of described.
4. **Clear selection button — kept here only.** A radio group cannot be unticked by clicking it, and
   there is no header checkbox in a single-select table to carry the gesture. The one place the
   non-conventional control is forced by the affordance; say so in the doc-comment (Step 2 dropped
   its equivalent for the opposite reason).
5. **No header checkbox** — select-all has no meaning under single-select, and every peer hides the
   header control in that mode.
6. Same row-binding recipe as Step 2 (`[class.is-selected]` + `[attr.aria-selected]` off
   `selectedRows()`; never a `RenderRow` field — D5).
7. §4.1 comes free: a radio group gives Space _and_ arrow-key roving focus natively — the browser's
   own model, and the closest thing to PrimeNG's arrow navigation reachable without a directive.

**`.stories.ts` + `.mdx`.** Title `Table / Selection / Single`. Single `Default`. No MSW. Code tabs:
`HTML`, `TS`, `CSS`, `selection/fixtures/schema.ts`.

## Implementation Notes

- Read `docs/3-ui/stories.md` first.
- `selection-story.css` already carries the control column and the radio's affordance styling — use
  it rather than adding a local stylesheet.
- Locked rows: same `aria-disabled` treatment as Step 2 if the config's predicate applies here.

## Risks / Watchouts

- Do not reuse a checkbox "because the wiring is the same" — the control swap is the single clearest
  invented-vs-conventional correction in the plan's revision.

## Non-Goals

- No select-all, no tri-state, no event log panel (Step 2 owns those), no MSW, no unit tests.

## Acceptance Checks

- [ ] Radios enforce one selection with no host-side replace logic.
- [ ] A 2-id restore throws under `ngDevMode`, is caught, and the discarded id is named on canvas.
- [ ] Clear selection empties the selection; there is no header control.
- [ ] Arrow keys move within the radio group; Space selects.
- [ ] `npx tsc -p libs/table/tsconfig.lib.json --noEmit` clean.

---

← [Step 2: multi-selection/](step-2-multi-selection-story.plan.md) | [Step 4: coverage marks + doc drift](step-4-selection-docs.plan.md) →
