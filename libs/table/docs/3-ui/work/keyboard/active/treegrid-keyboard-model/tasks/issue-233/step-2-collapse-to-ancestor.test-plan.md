# Step 2 test plan — Collapse recovers to the nearest visible ancestor

Step: [step-2-collapse-to-ancestor.plan.md](step-2-collapse-to-ancestor.plan.md)
Spec file: `libs/table/src/api/create-table.spec.ts` (new `describe('focus recovery — collapse (#233)')`, beside step 1's recovery describe)

Why this file: the assertion is on `table.focus()`, which the engine owns (`compose-table.ts` + `engine/focus.ts`). `withTree()` and `withGrouping()` are only inputs that cause the collapse. Putting the tests in `with-tree/feature.spec.ts` would make the tree spec assert something the engine owns. Spec seam S1 names `create-table.spec.ts` as prior art.

Fixtures, all from existing code:

- `makeFlatRows()` from `table.mock.ts`, with `withTree({ parentId: (r) => r.parentId, initial: ['r1', 'c1'] })`. Render order: r1(0), c1(1), g1(2), c2(1), r2(0).
- `mockGroupingRows` / `mockGroupingTrackBy`, with `withGrouping({ initial: ['region'] })` and `withTree()`. The header id is `'group:>region:string:US'` (same literal as `with-tree/feature.spec.ts`).
- A local nested-tree `columns` set with one `name` column, over `FlatRow` (same shape as `makeFlatColumns()` in the tree spec).
- Flow in each test: build the table, `moveTo` a rendered target, collapse, `TestBed.tick()`, read `focus()`.

Each fixture is chosen so that K9a's rule ("row now at the old index, clamped") gives a different row than the ancestor. Step 1's code applies K9a, so every seam fails against it.

## Behaviour coverage

| Id   | Behaviour                                                                                                        | Source                                             | Tested by                                           |
| ---- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------- |
| F47  | A collapse that hides the focused row moves focus to the nearest visible ancestor row                            | spec story 47; K9b; recovery table row 2           | A, B                                                |
| AC1c | The "collapse" row of the recovery table (only the collapse part of AC1; the other rows belong to steps 1 and 3) | issue AC1                                          | A, B, C                                             |
| ROW  | The result is a row target: `columnId: null`                                                                     | outline Result; K12b                               | A                                                   |
| CA   | Collapse-all: an ancestor that is itself hidden is skipped, and the walk continues upward                        | outline Do; arch rule 2                            | B                                                   |
| AC4  | Group headers count as ancestors                                                                                 | issue AC4; arch rule 2                             | C                                                   |
| HDR  | A group header hidden by an outer collapse counts as hidden, not regrouped                                       | K24                                                | E                                                   |
| CLS  | Hidden vs filtered: a row gone from `rows()` uses the old-index rule, not the ancestor walk                      | spec § Recovery rules, "Filtered out vs collapsed" | D                                                   |
| AC3  | Pure, through `createTable`, no DOM                                                                              | issue AC3                                          | How-to-test constraint, not a behaviour. Met by A–E |
| AC5  | Never throws; an invalid result becomes `null`                                                                   | issue AC5                                          | Not tested here. Step 1 owns the general guard.     |

## Stubs (red phase)

- None new. This step extends step 1's `recoverFocus` in `libs/table/src/engine/focus.ts`, which exists by red time. Red comes from assertions: step 1's code applies the old-index rule. Seam D is the exception.

## Seams — in red-green order

### A. Collapse a parent while a child is focused → focus is the parent row

- Test: `it('moves focus to the parent row when collapsing it hides the focused child')`
- Asserts: tree fixture with r1 and c1 open. `moveTo({ area: 'body', rowId: 'c2', columnId: 'name' })`, then `tree.collapse(['r1'])`, then `TestBed.tick()`. Then `focus()` equals `{ area: 'body', rowId: 'r1', columnId: null }`
- Covers: F47, AC1c, ROW
- Risk: damage high, likelihood high
- Why this seam: catches a hidden row treated like a deleted one. K9a would land on `r2` (old index 3, clamped), an unrelated sibling: the case K9b rejected. Also catches the old `columnId` being kept instead of becoming row focus. c1/g1 sit between r1 and c2 in the old order, so a "nearest earlier row" or "depth <= instead of <" walk lands on c1 or g1
- Order reason: independent. This is the base case: the hidden-row branch and a one-level walk

### B. Collapse-all with a grandchild focused → focus is the top-level ancestor, not the hidden parent

- Test: `it('skips a hidden ancestor and continues to the nearest rendered one on collapse-all')`
- Asserts: same fixture. `moveTo({ area: 'body', rowId: 'g1', columnId: 'name' })`, then `tree.collapse()`, then tick. Then `focus()` equals `{ area: 'body', rowId: 'r1', columnId: null }`
- Covers: F47, CA, AC1c
- Risk: damage high, likelihood high (collapse-all is a common toolbar action)
- Why this seam: catches a walk that stops at the first row with a smaller depth (c1) without checking it is still rendered. That would point `focus()` at an unrendered id. It also catches a walk that keeps the original depth as its bound instead of tightening it to c1's depth
- Order reason: builds on A (adds the keep-walking loop over the one-level walk)

### C. Group collapse with a leaf focused → focus is the group header row

- Test: `it('treats a group header as an ancestor when its collapse hides the focused row')`
- Asserts: grouping fixture. Call `tree.toggle(US_HEADER_ID)`, then tick, then `moveTo({ area: 'body', rowId: 3, columnId: 'region' })`. Render is US(0), 1, 2, 3, EU(0). Then `tree.collapse([US_HEADER_ID])`, then tick. Then `focus()` equals `{ area: 'body', rowId: US_HEADER_ID, columnId: null }`
- Covers: AC4, AC1c
- Risk: damage high, likelihood high (grouped tables collapse by default)
- Why this seam: headers are built in the render stage (`withGrouping`'s `buildGroupRenderRows`), so they are never in `rows()`. They have `data === null`. A walk that looks up depth or candidates in `rows()`/`indexById`, or skips `kind: 'group'`, misses the header and falls back to `EU` (old index 3, clamped)
- Order reason: builds on A (same walk, other ancestor kind)

### D. Delete a child under an expanded parent → old-index rule, not the parent

- Test: `it('uses the old-index rule, not the ancestor walk, for a row deleted from data under a tree')`
- Asserts: tree fixture. `moveTo({ area: 'body', rowId: 'c2', columnId: 'name' })`, then remove c2 from the data signal, then tick. Then `focus()` equals `{ area: 'body', rowId: 'r2', columnId: 'name' }`
- Covers: CLS
- Risk: damage low (lands on a visible row), likelihood high (deletes in trees are common)
- Why this seam: catches classification by "not in `renderRows()`" alone, without checking `rows()`. That sends every deleted or filtered tree row to its parent. Step 1's delete/filter seams use flat data (every depth 0), where the walk finds nothing, so they cannot catch this
- Order reason: builds on A (tests the guard in front of A's branch). Expected to pass at red — kept as a regression guard.

### E. Outer group collapse with an inner group header focused → the outer header

- Test: `it('moves focus to the outer header when its collapse hides a focused inner header')`
- Asserts: two-level grouping fixture: `mockGroupingRows` with `withGrouping({ initial: ['region', 'category'] })` and `withTree()`. Expand the outer US header, then tick. Focus the inner header `{ area: 'body', rowId: 'group:>region:string:US>category:string:Electronics', columnId: null }`. Collapse the outer US header with `tree.collapse([US_HEADER_ID])`, then tick. Then `focus()` toEqual `{ area: 'body', rowId: US_HEADER_ID, columnId: null }`
- Covers: HDR
- Risk: damage high, likelihood high (collapse-all on a two-level grouped table)
- Why this seam: headers are never in `rows()`, so the `rows()` check alone sends a hidden header to the old-index rule — an unrelated header, the case K9b rejected
- Order reason: builds on C

## Types phase (after green)

None — no public type surface in this step.

## Not tested

- Two-level grouping, outer collapse with a leaf under the inner header focused: seam E covers the hidden-header case; the leaf variant fails on the same bug as B (hidden-ancestor loop) plus C (header as ancestor)
- `tree.toggle` vs `tree.collapse(ids)` vs `tree.set`: all write the open set → `renderRows()`. Recovery reads only `renderRows()`, so the write path cannot change the result
- A collapse that does not hide the focused row (sibling branch): covered by step 1's "still rendered → keep" (K9c) seam
- `grid` vs `treegrid` result shape: collapse needs `withTree()`, which always makes the role `treegrid`. `columnId: null` is the same value in both roles, so there is no branch to test
- DOM focus following the recovery (K9d): directive behaviour, seam S2, not this step
- Direct unit tests of `recoverFocus` in `focus.ts`: spec seam S1 tests recovery through `createTable`, and A–E reach every branch this step adds

## Resolved questions

1. Seam D passes at red, kept as a regression guard.
2. A hidden row with no rendered ancestor falls back to the old-index rule, untested (K24).
3. A synthetic row gone from render is hidden when its nearest earlier still-rendered ancestor now has `isExpanded === false`, else regrouped → old-index (K24, seam E).
4. Step 1's `recoverFocus` takes previous/next `RenderRow[]` (K22).
