---
title: "Step 2 — multi-selection/: the selection baseline"
type: task-step
plan: ../../1-gap-analysis.md
node: C
---

# Step 2 — `multi-selection/`: the selection baseline

**PR scope:** One story folder, complete — host, template, `.stories.ts`, `.mdx`.

**Task type:** code

**Skills used:** angular-developer, css-styling, typescript-conventions, extract-encapsulated-logic

**Depends on:** Step 1
**Parallel-safe with:** Step 3

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/stories/selection/multi-selection/multi-selection-story-host.component.ts` (create)
- `libs/shared/table/src/stories/selection/multi-selection/multi-selection-story-host.component.html` (create)
- `libs/shared/table/src/stories/selection/multi-selection/multi-selection.stories.ts` (create)
- `libs/shared/table/src/stories/selection/multi-selection/multi-selection.mdx` (create)

## Why This Step Exists

Node C. Nothing exists to extend — this is the whole read/write surface in one screen. The
bulk-action bar, the locked-row demo, the tri-state header and the silent-prune demo all live
**inside** this story as controls rather than earning folders of their own.

Covers §1.1, §1.2, §1.4, §1.6, §1.7, §2.1, §2.2, §2.3, §3.2 (three ways), §4.1 (Space), §1.1's
stale-id failure (D8) and §5.1's silent prune.

## What To Do

1. `createTable(data, multiSelectionConfig, withSelection({ enableRowSelection: (row) =>
   !row.locked }))`, data from `SELECTION_ROWS_MOCK`.
2. **Per-row native `<input type="checkbox">`** in a leading column — the convergent default.
   `[checked]="table.selectedRows().has(row.id)"`, `(change)` → `table.toggle(row.id)`. Native, so
   §4.1's Space gesture comes free; the doc-comment scopes it to Space only (roving focus, arrow
   nav and Tab containment stay on the undrilled selection directive, node H).
3. **Header tri-state checkbox, both directions, one control** — tick → `table.select(selectAllIds(
   table))`; untick → `clearSelection()`. No peer ships a separate Clear button; clearing is
   universally the header checkbox's second state. `checked`/`indeterminate` come from a host
   `computed(() => table.selectionStateOf(selectAllIds(table)))`, and the doc-comment names the
   honest gap: the library ships no derived "all visible selected" signal (S1/OQ-1) — this host
   computes it, and that computation is what OQ-1 would replace.
4. **Row-selected styling via the binding recipe, never a `RenderRow` field** (D5):
   `[class.is-selected]` + `[attr.aria-selected]` off `selectedRows()`. D5 is also why this library
   sidesteps the re-render storm three of five peers shipped.
5. **Count banner above the table**, "N selected", off `selectedRows().size` — MRT's
   `positionToolbarAlertBanner` shape, the only shape anyone ships.
   `selection-story.css`'s `.selection-story__banner` already exists.
6. **Locked rows, disabled but not hidden** — checkbox rendered with
   `[attr.aria-disabled]="!table.isSelectable(row.id)"` (not the native `disabled`, which removes it
   from the tab order) plus the shipped visible locked-row style. "Select all" visibly skips them.
7. **Lock this row** — patches `locked: true` on an already-selected row; the mark **stays**
   (D58/D60), unlike AG Grid, the only peer that auto-deselects.
8. **…but an explicit clear still removes it** — clearing while a locked row is selected *does* drop
   its mark, because `deselect`/`clearSelection` are ungated by design (D58). Both halves on one
   screen is the point (PrimeNG needed a second multi-year issue for exactly this asymmetry).
9. **Restore a saved selection** → `select(SAVED_SELECTION_IDS, { emitEvent: false })`, where `s99`
   is absent from the data. The write succeeds, the unknown id renders nothing, the rest is
   untouched (D8), and `emitEvent: false` keeps it out of the event log — a restore is not user
   intent (D18).
10. **Someone else deleted this row** — removes a selected row from `data` (the `external-write/`
    `simulateServerPush` precedent: a local `data` write behind a button). The count drops and the
    event log stays **empty** — D11's silent prune made visible by its absence.
11. **`selectionChanged` event log panel** — the only surface on which the delta stream and D11's
    silence are observable. `clearSelection()` must show **one** delta carrying every previously
    selected id (D9), not N.

**`.stories.ts` + `.mdx`.** Title `Table / Selection / Multi`. Single `Default` — every verb is
synchronous and local, so no `ForcedFailure` is earned (`gated-single-pessimistic/`'s precedent).
No MSW handlers. Code tabs: `HTML`, `TS`, `CSS`, `selection/fixtures/schema.ts`.

## Implementation Notes

- Read `docs/3-ui/stories.md` first.
- No checkbox directive exists — hand-wiring the native input *is* the missing D5 binding recipe
  rendered rather than described, and it is the conventional affordance, not an invented one.
- The event log is feature surface here, not app chrome: it is the only way D9's single delta and
  D11's silence are observable.

## Risks / Watchouts

- Do not add a standalone "Clear selection" button — it was deliberately dropped in favour of the
  header checkbox's untick. (Step 3 keeps one, because a radio group has no untick gesture.)
- Do not use `[disabled]` on the locked checkbox; `aria-disabled` + focusable is the a11y baseline.

## Non-Goals

- No shift-click range select or Shift+Arrow (blocked on node H, the undrilled selection directive).
- No click-anywhere-on-row selection (2 of 5 peers, and it drags in CDK #23789's double-fire trap).
- No bulk delete/edit (D12). No MSW. No unit tests on the host.

## Acceptance Checks

- [ ] Row checkboxes select, unselect and accumulate; Space toggles the focused one.
- [ ] The header checkbox selects all visible and clears, with a correct indeterminate state.
- [ ] Locked rows are visibly locked, focusable, skipped by select-all, keep a pre-existing mark on
      lock, and lose it on an explicit clear.
- [ ] Restoring a saved selection with an unknown id writes the rest and logs nothing.
- [ ] Deleting a selected row externally drops the count with an empty event log.
- [ ] `clearSelection()` emits exactly one delta.
- [ ] `npx tsc -p libs/shared/table/tsconfig.lib.json --noEmit` clean.

---
← [Step 1: selection fixtures — schema.ts](step-1-selection-fixtures-schema.plan.md) | [Step 3: single-selection/](step-3-single-selection-story.plan.md) →
