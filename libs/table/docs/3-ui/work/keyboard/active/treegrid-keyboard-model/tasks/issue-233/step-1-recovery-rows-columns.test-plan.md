# Step 1 test plan — Focus recovery: rows and columns

Step: [step-1-recovery-rows-columns.plan.md](step-1-recovery-rows-columns.plan.md)
Spec file: `libs/table/src/api/create-table.spec.ts`

## Behaviour coverage

| Id              | Behaviour                                                                       | Source                                                 | Tested by  |
| --------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------- |
| K9a-del         | Focused row deleted → row now at its old index, same column                     | spec § Recovery rules; issue AC1                       | A          |
| K9a-clamp       | Old index past the end → clamp to the last row                                  | spec § Recovery rules; K9a                             | B          |
| K9a-filter      | Focused row filtered out of `rows()` (data unchanged) → old index, same column  | spec § Recovery rules; issue AC1                       | C          |
| K9c             | Focused row moved by sort → same row id + column                                | spec § Recovery rules; K9c; issue AC1                  | D          |
| K9a-empty       | Table empties → first header cell (`renderColumns()[0]`)                        | spec § Recovery rules; K9a; issue AC1                  | E          |
| K9a-empty-nocol | Table empty and no rendered columns → `null`                                    | spec § Recovery rules; outline                         | Not tested |
| K9e-hide        | Focused column hidden → column now at old index, clamped (body targets)         | spec § Recovery rules; K9e; issue AC1                  | F          |
| K9e-header      | Header targets follow the same column rule                                      | outline Do                                             | G          |
| K9e-reorder     | Focused column reordered → same column id                                       | spec § Recovery rules; K9e; issue AC1                  | Not tested |
| AC5             | Recovery never throws; an invalid result becomes `null`                         | issue AC5; outline                                     | H          |
| K9a-rowfocus    | Row focus (`columnId: null`) stays `null` after a row delete                    | spec § Recovery rules; K23                             | I          |
| DW-silent       | Recovery writes the target directly: no console report, no `focusRequests` bump | outline Do                                             | Not tested |
| DW-null         | A `null` focus stays `null` through any change                                  | spec § Store contract ("`null` = nothing focused yet") | Not tested |

## Stubs (red phase)

None. The logic tests import only `createTable` and the mutation helpers, which already exist.
`recoverFocus` is internal to `engine/focus.ts` and is not imported by any test. Red works without
stubs: with no recovery effect, `focus()` keeps the stale target, so every seam except D fails on
its assertion.

## Seams — in red-green order

Shared setup for the new block `describe('focus recovery (#233)', …)`, placed after `describe('focus.focusRequests (#232)')`:

- Three rows inline, like the sibling focus blocks: `r1`, `r2`, `r3`.
- `makeColumns()` gives two columns: `name` then `status`.
- One `data = signal<Row[]>(…)` per test, so a delete is `data.update(rows => rows.filter(…))`.
- Build with `TestBed.runInInjectionContext(() => createTable(data, { trackBy: 'id', columns }, …features))`.
- Call `moveTo` to set the start target. After each change, call `TestBed.tick()` to flush the recovery effect, then read `table.focus()`.
- Two local synthetic features, built the same way as `withReversibleSort` / `withDroppedRow`:
  - `withHiddenId(id: Signal<string | null>)` claims `s.filter` and drops that id while the signal is set.
  - Reuse `withReversibleSort()` for the sort case.

### A. Delete the focused middle row → the row now at its old index, same column

- Test: `it('moves focus to the row now at the old index when the focused row is deleted')`
- Asserts: start `{ area: 'body', rowId: 'r2', columnId: 'status' }`. Remove `r2` from `data`, then tick. `focus()` toEqual `{ area: 'body', rowId: 'r3', columnId: 'status' }`.
- Covers: K9a-del
- Risk: damage high, likelihood high
- Why this seam: this is the base case, and it forces the effect to exist. It catches four bugs: the previous order is not remembered; the index is looked up in the new order instead of the old one; the "previous row" rule that K9a rejected; the column is dropped on recovery.
- Order reason: independent — the base case.

### B. Delete the focused last row → clamp to the new last row

- Test: `it('clamps to the last row when the focused last row is deleted')`
- Asserts: start `{ body, r3, 'name' }`. Delete `r3`, then tick. `focus()` toEqual `{ area: 'body', rowId: 'r2', columnId: 'name' }`.
- Covers: K9a-clamp
- Risk: damage high, likelihood high
- Why this seam: without the clamp, reading the old index past the end gives `undefined`. That ends as a stale target, a `null`, or a throw inside the effect.
- Order reason: builds on A (same index rule, plus the clamp).

### C. Filter out the focused row (data unchanged) → the row now at its old index

- Test: `it('moves focus to the row now at the old index when the focused row is filtered out')`
- Asserts: compose `withHiddenId(hidden)`. Start `{ body, r2, 'status' }`. Run `hidden.set('r2')`, then tick. `focus()` toEqual `{ body, r3, 'status' }`. `data` is never written in this test.
- Covers: K9a-filter
- Risk: damage high, likelihood high
- Why this seam: catches recovery keyed on `data` / `indexById`, the shape the existing `onRowsRemoved` effect invites someone to copy, instead of on `rows()` / `renderRows()`. A filter changes neither `data` nor `indexById`, so with that bug A passes and C fails.
- Order reason: builds on A (same rule, different source of the change).

### D. Sort moves the focused row → same row id + column

- Test: `it('follows the focused row id and column when sorting moves it')`
- Asserts: compose `withReversibleSort()`. Start `{ body, r1, 'name' }` (index 0). Run `toggleReverse()`, then tick. `r1` is now at index 2. `focus()` toEqual `{ body, r1, 'name' }`.
- Covers: K9c
- Risk: damage high, likelihood high
- Why this seam: catches index-keyed recovery. If every change is treated as K9a, focus silently moves to `r3`, the drift K9c rejected (AG Grid). A and B do not catch this: with no keep-by-id check they still pass.
- Order reason: builds on A (needs the effect from A to be running).
- **Expected to pass at red.** "Keep" is the no-op, so no missing implementation can make this fail. It is a regression guard for the green phase, not a plan defect. The red-phase agent should record it as expected-green.

### E. Table empties → first header cell

- Test: `it('moves focus to the first header cell when the table becomes empty')`
- Asserts: start `{ body, r2, 'status' }`. Run `data.set([])`, then tick. `focus()` toEqual `{ area: 'header', columnId: 'name' }`.
- Covers: K9a-empty
- Risk: damage high, likelihood high (a filter or search with zero results is common)
- Why this seam: B's clamp on an empty order yields index -1 and `undefined`. This seam catches a missing empty branch, and a header fallback that reads `columns()` instead of `renderColumns()`.
- Order reason: builds on B (the clamp with nothing to clamp to).

### F. Hide the focused column (body target) → the column now at its old index, clamped

- Test: `it('moves focus to the column now at the old index, clamped, when the focused column is hidden')`
- Asserts: start `{ body, r1, 'status' }`. `status` is index 1, the last column. Run `table.columns.update(toggleColumnVisibility('status'))`, then tick. `focus()` toEqual `{ body, r1, 'name' }`. The row is unchanged.
- Covers: K9e-hide
- Risk: damage high, likelihood low
- Why this seam: catches four bugs: the effect does not track `renderColumns()`; the old column index is not remembered; no clamp; the column half disturbs the row half. The row must stay `r1`, because the column half runs independently.
- Order reason: builds on A (the column half reuses A's old-order and clamp pattern on a second order).

### G. Hide the focused header column → the header column now at its old index

- Test: `it('applies the column rule to header targets')`
- Asserts: start `{ area: 'header', columnId: 'name' }` (index 0). Hide `name`, then tick. `focus()` toEqual `{ area: 'header', columnId: 'status' }`.
- Covers: K9e-header
- Risk: damage high, likelihood low
- Why this seam: catches recovery that only runs for body/panel targets. The architecture text gates the effect on "if focus() is a body/panel target", so this bug is easy to write. A stale header id leaves no `tabindex="0"` element. It also checks the unclamped half of the rule, which F does not.
- Order reason: builds on F (same column rule, header path).

### H. Every column hidden while a body cell is focused → `null`, no throw

- Test: `it('degrades to null, without throwing, when no valid target remains')`
- Asserts: start `{ body, r1, 'name' }`. Hide `name` and `status` in one `columns.update`. Wrap the update and `TestBed.tick()` in `expect(() => { …; TestBed.tick(); }).not.toThrow()`. Then `focus()` toBeNull().
- Covers: AC5
- Risk: damage high, likelihood low
- Why this seam: the column clamp over an empty `renderColumns()` yields `undefined`. Without the `findUnrenderedId` check, the effect either throws or stores a target naming no column. Rows still exist, so E's empty-table branch does not cover this.
- Order reason: builds on F (the clamp on an empty column order), plus the validation step.

### I. Row focus keeps columnId null after a row delete

- Test: `it('keeps row focus (columnId null) when the focused row is deleted')`
- Asserts: start `{ area: 'body', rowId: 'r2', columnId: null }`. Delete `r2`, then tick. `focus()` toEqual `{ area: 'body', rowId: 'r3', columnId: null }`.
- Covers: K9a-rowfocus
- Risk: damage high (treegrid: row focus silently becomes cell focus), likelihood high
- Why this seam: catches the column half treating `null` as unrendered and picking column 0.
- Order reason: builds on A and F.

## Types phase (after green)

None — no public type surface in this step. `createFocus` returning its writable signal alongside the member is internal to `compose-table.ts`.

## Not tested

- K9e-reorder: focused column reordered keeps its id — `over budget — damage high, likelihood low`. Like D, it would also pass at red, because keep is the no-op.
- K9a-empty-nocol: empty table with no rendered columns → `null` — `over budget — damage high, likelihood low`. It uses the same "no column at index 0" path that H exercises.
- DW-null: a `null` focus stays `null` across changes, including the effect's first run on an empty table — `over budget — damage low, likelihood high`.
- DW-silent (no console report, no `focusRequests` bump) — cannot fail through `createTable`. A recovered target is always rendered, and a `moveTo` without options is already silent, so routing recovery through `moveTo` is invisible here. `null` cannot go through `moveTo` at all.
- A separate `engine/focus.spec.ts` for `recoverFocus` — issue AC3 and seam S1 say recovery is specced through `createTable`. Pure tests would duplicate A–I against the same branches. The architecture table's `(+ .spec.ts)` is overridden by the issue AC.
- Live update of a focused row's values (K9c "update") — same keep-by-id branch as D.

## Resolved questions

1. A row still in `rows()` but not rendered uses the old-index rule in this step, untested. Step 2 replaces it (K23).
2. A panel target whose row is deleted keeps `area: 'panel'` on the new row. Step 3 converts closed panels (K23).
3. Seam H expects `null` when rows remain but no column is rendered (K23).
4. `recoverFocus` takes previous/next `RenderRow[]` plus the `rows()` id set (K22).
