# Step 3 test plan — Closed panel recovers to its row

Step: [step-3-closed-panel-to-row.plan.md](step-3-closed-panel-to-row.plan.md)
Spec file: `libs/table/src/api/create-table.spec.ts` (seams A–G, new `describe('focus recovery — closed panel (#233)')`); `libs/table/src/api/features/with-expansion.spec.ts` (seam H, inside `multi: false (single-open)` › `follows focus`)

Why two files: the panel→body rule lives in the engine (`engine/focus.ts` plus the recovery effect in `compose-table.ts`). Changing either one breaks A–G, so those tests go in the core store spec, next to step 1/2's recovery tests. Seam H checks `expansion()`, the state that `withExpansion`'s `followFocus` owns. It sits beside its sibling `does not snap back to the focused row after a programmatic toggle`.

## Behaviour coverage

| Id   | Behaviour                                                                                          | Source                                                    | Tested by                         |
| ---- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------- |
| AC2  | Panel target whose panel closed → body target for its row: first cell in grid, the row in treegrid | issue #233 AC2; spec § Recovery rules, row "Panel closed" | A, B, C, D                        |
| O1   | The effect reads `expansion()` only when `withExpansion()` is composed                             | step outline                                              | E                                 |
| O2   | Row rules (steps 1/2) run first; a panel target whose row was deleted or hidden follows them       | step outline; arch § Engine: recovery                     | F, G                              |
| AC5  | Recovery never throws; an invalid result degrades to `null` (this step's branch only)              | issue #233 AC5                                            | E; zero-columns case "Not tested" |
| K11x | A recovery write must not cause single-open follow-focus to undo a consumer's panel write          | spec story 42 + existing K11 test `does not snap back…`   | H                                 |

## Stubs (red phase)

None. The tests import only `createTable`, `withExpansion`, `withTree`, `toggleColumnVisibility` and `makeFlatRows`, and all of them exist. The change is internal: a new branch in step 1's `recoverFocus` plus the effect wiring. Red tests fail on an assertion, not on `not implemented`.

## Seams — in red-green order

### A. Grid: focused panel's row collapsed from `expansion()` → body target, first render column

- Test: `it('moves a panel target to its row's first cell when the panel closes (grid)')`
- Setup: `createTable(signal(rows), { trackBy: 'id', columns: makeColumns() }, withExpansion())`. `expansion.toggle('r1')`, `focus.moveTo({ area: 'panel', rowId: 'r1' })`, `TestBed.tick()`. Then `expansion.collapse(['r1'])`, `TestBed.tick()`.
- Asserts: `table.focus()` `toEqual({ area: 'body', rowId: 'r1', columnId: 'name' })`
- Covers: AC2
- Risk: damage high, likelihood high
- Why this seam: catches an effect that does not track `expansion()`, or has no panel branch. Focus would stay on an unmounted panel, and the table would lose its only `tabindex="0"` stop.
- Order reason: independent (base case).

### B. Open panel → panel target kept

- Test: `it('keeps a panel target while its panel stays open')`
- Setup: as in A, but no collapse. Instead write something unrelated that re-runs the effect (`expansion.toggle('r2')` in multi mode), then `TestBed.tick()`.
- Asserts: `table.focus()` `toEqual({ area: 'panel', rowId: 'r1' })`
- Covers: AC2 (the guard half)
- Risk: damage high, likelihood high
- Why this seam: catches a branch that turns every panel target into a body target, or checks the wrong set (e.g. `everExpanded`, or "any panel open"). Focus would leave an open panel whenever any signal the effect reads changes.
- Order reason: builds on A. Once A is green, an implementation that always converts fails here.

### C. Treegrid: panel closed → row focus (`columnId: null`)

- Test: `it('moves a panel target to row focus when the panel closes (treegrid)')`
- Setup: `makeFlatRows()` from `table.mock.ts`, columns `[col('name')]`, `withTree({ parentId: (r) => r.parentId })`, `withExpansion()`. Open the panel on root `r1`, focus panel `r1`, tick, collapse `r1`'s panel, tick.
- Asserts: `table.focus()` `toEqual({ area: 'body', rowId: 'r1', columnId: null })`
- Covers: AC2
- Risk: damage low, likelihood high
- Why this seam: catches a missing treegrid check (testing for the wrong member, e.g. `grouping`, or none at all). Focus would land on a cell instead of the row, which is the wrong focus unit for the treegrid key map.
- Order reason: builds on A (adds the `tree`-member branch).

### D. Grid with the first declared column hidden → first _render_ column

- Test: `it('targets the first rendered column, not the first declared one')`
- Setup: as in A, but with `makeRenderColumns()` (`status` hidden and declared first, then `name`, `id`).
- Asserts: `table.focus()` `toEqual({ area: 'body', rowId: 'r1', columnId: 'name' })`
- Covers: AC2
- Risk: damage high, likelihood low
- Why this seam: catches reading `columns()[0]` instead of `renderColumns()[0]`. The stored target would name a hidden column, no cell would render `tabindex="0"`, and the Tab stop would be lost.
- Order reason: builds on A.

### E. Without `withExpansion()` → panel target kept, nothing throws

- Test: `it('leaves a panel target alone when withExpansion() is not composed')`
- Setup: `makeStore(makeColumns(), rows)` with no features. `focus.moveTo({ area: 'panel', rowId: 'r1' })`.
- Asserts: `expect(() => TestBed.tick()).not.toThrow()`, then `table.focus()` `toEqual({ area: 'panel', rowId: 'r1' })`
- Covers: O1, AC5
- Risk: damage high, likelihood low
- Why this seam: catches an unguarded `store.expansion()` read. Without the guard, the effect throws on every run for any table that lacks the feature.
- Order reason: builds on A (A introduces the `expansion()` read this guards).

### F. Panel row deleted → step 1's row rule wins over the panel rule

- Test: `it('applies the row rule, not the panel rule, when the panel's row is deleted')`
- Setup: grid with `withExpansion()`, rows `r1, r2`, data in a local `signal`. Open `r1`, focus panel `r1`, tick. Then `data.update(rows => rows.filter(r => r.id !== 'r1'))`, tick. `onRowsRemoved` also prunes `r1` from `expansion()`, so both rules apply.
- Asserts: `table.focus()` `toEqual({ area: 'body', rowId: 'r2', columnId: 'name' })`. The row rule gives `panel r2`, then the panel rule converts it (K23).
- Covers: O2
- Risk: damage high, likelihood high (deleting a row from a button inside its own panel is the common path)
- Why this seam: catches the panel rule running before the row rules. That would produce `{ body, rowId: 'r1' }`, a deleted id, so focus would point at no element.
- Order reason: builds on A, and on step 1's row rule.

### G. Treegrid: parent collapsed while child's panel still open → nearest visible ancestor

- Test: `it('applies the collapse rule to a panel target whose row is hidden, even with the panel open')`
- Setup: as in C, but `tree.toggle('r1')` first to show `c1`. Open the panel on `c1`, focus panel `c1`, tick. Then `tree.toggle('r1')` (collapse), tick. `expansion()` still has `c1`.
- Asserts: `table.focus()` `toEqual({ area: 'body', rowId: 'r1', columnId: null })`
- Covers: O2
- Risk: damage high, likelihood low
- Why this seam: catches a "panel still open → keep" short-circuit placed before the row rules. Focus would stay on a panel whose row is not rendered. F cannot catch this: in F the panel also closed.
- Order reason: builds on C (treegrid) and F (precedence), and on step 2's collapse rule.

### H. Single-open: consumer opens another row while focus sits in a panel → no snap-back

- Test: `it('does not reopen the previous row when recovery moves focus off its closed panel')`
- Setup: `makeStore({ multi: false })` (local helper in `with-expansion.spec.ts`). `expansion.toggle('r1')`, `focus.moveTo({ area: 'panel', rowId: 'r1' })`, tick. Then `expansion.toggle('r2')`, which displaces `r1`. Tick.
- Asserts: `[...store.expansion()]` `toEqual(['r2'])`, and `store.focus()` `toEqual({ area: 'body', rowId: 'r1', columnId: 'name' })`. Positive control as in the siblings: `focusBody(store, 'r3')` → `['r3']`.
- Covers: K11x, AC2
- Risk: damage high, likelihood low
- Why this seam: catches the K11 `followFocus` effect reacting to the recovery write. Today it would see `body r1`, one other row open and `r1` a data row, so it would call `setExpanded(['r1'])` and silently undo the consumer's `toggle('r2')`.
- Order reason: builds on A (needs the recovery write to exist).

## Types phase (after green)

None — no public type surface in this step.

## Not tested

- Grid with zero render columns (every column hidden) while a panel target recovers → `null` (AC5). Over budget: damage high, likelihood low.
- A panel target on a row that was never opened (written directly via `moveTo`). Same code path as A (row not in `expansion()`), so it would fail on the same bug.
- A panel closed by its own Esc returning DOM focus to its toggle (spec § Recovery rules, note). This is DOM `focusin` behaviour, owned by `ngpTablePanel` / seam S2, not by this store step.
- Multi-open vs single-open for A–G. The panel rule does not read `multi`. Only H is mode-specific.
- Feature argument order (`withTree` before or after `withExpansion`). Member lookup happens at effect run time, after the fold. Order-independence of member presence is already pinned by `opening a panel never reveals children … in either argument order`.
- DOM focus following the recovered target (K9d). Directive concern, S2.

## Resolved questions

1. The existing `with-expansion.spec.ts` test `does not follow focus to a %s target` (panel row) changes its fixture to the open row `r1` in the red phase, with a one-line comment.
2. H's fix lives in `with-expansion.ts`: `followFocus` ignores a body target on the same row as the previous panel target. No engine flag (K25).
3. Seam F asserts the full target (K23).
