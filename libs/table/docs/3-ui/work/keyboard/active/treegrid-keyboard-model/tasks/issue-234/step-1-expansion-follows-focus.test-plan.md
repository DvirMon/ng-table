# Step 1 test plan — Expansion follows focus

Step: [step-1-expansion-follows-focus.plan.md](step-1-expansion-follows-focus.plan.md)
Spec file: `libs/table/src/api/features/with-expansion.spec.ts` (new nested `describe('follows focus')` inside `describe('multi: false (single-open)')`)

## Behaviour coverage

| Id  | Behaviour                                                                             | Source                        | Tested by  |
| --- | ------------------------------------------------------------------------------------- | ----------------------------- | ---------- |
| S42 | Single-open, panel open: focus to another data row switches the panel to it           | spec story 42; K11; issue AC1 | A          |
| S43 | No panel open: moving focus opens nothing                                             | spec story 43; K11; issue AC2 | B          |
| AC3 | Focus on a group header leaves the panel on its row                                   | issue AC3; K11 (K8a)          | C          |
| AC4 | Multi-open mode is unaffected                                                         | issue AC4                     | D          |
| W1  | Only `focus()` is tracked: `toggle(B)` while focus rests on A does not snap back to A | outline Do / Watch out        | E          |
| W2  | `header` and `panel` focus areas never switch                                         | outline Do                    | F          |
| W3  | `multi()` read untracked: flipping the mode does not trigger a follow                 | outline Do                    | G          |
| W4  | Follow write emits on `changed` like any write                                        | outline Do                    | A          |
| AC5 | Store spec added; expansion spec updated                                              | issue AC5                     | Not tested |

## Stubs (red phase)

None. The step adds no exported symbol: the follow reaction is a
second internal `setup` effect, and `ExpansionInput` only widens to
`Pick<TableStore, 'rows' | 'trackBy' | 'focus' | 'indexById'>`.
So red comes from assertions against today's `withExpansion`, not
from `not implemented`.

Red-phase note: B–G pin _negative_ cases, so on their own they
would pass against today's code, which never follows focus. That
would break test-first's "must fail" rule. Each one therefore ends
with a **positive-control** move that must switch the panel. That
makes it fail before green and proves the effect is live. The
controls are listed in each seam's Asserts.

## Seams — in red-green order

Shared setup: `createTable(signal(makeRows()), { trackBy: 'id',
columns: makeColumns() }, withExpansion({ multi: false }))`.
Focus is written with `store.focus.moveTo({ area: 'body', rowId,
columnId: 'name' })`. Run `TestBed.tick()` after every `moveTo`
and every flip of `multi`. Reuse the block's `makeStore` /
`collect` helpers.

### A. Panel open on r1, focus moves to body r2 → panel switches to r2, one emission

- Test: `it('switches the open panel to the newly focused data row')`
- Asserts: toggle `r1`, focus `r1`, tick, start `collect`. Focus `r2`, tick → `[...expansion()]` equals `['r2']`; emitted equals `[{ added: ['r2'], removed: ['r1'] }]`.
- Covers: S42, W4
- Risk: damage high, likelihood high
- Why this seam: the base case. It catches a missing or unwired effect, a write to the wrong id, and a write sent with `emitEvent: false` (a consumer persisting via `changed` would lose the switch).
- Order reason: independent. It builds the effect every later seam relies on.

### B. No panel open, focus moves → nothing opens

- Test: `it('opens nothing when focus moves with no panel open')`
- Asserts: start `collect`, focus `r2`, tick → `expansion().size` is `0`, emitted is `[]`. Control: toggle `r2`, focus `r3`, tick → `['r3']`.
- Covers: S43
- Risk: damage low, likelihood high
- Why this seam: catches a missing "exactly one open" guard, i.e. always-follow. K11 rejects that because every ↓ would reflow inline panels.
- Order reason: builds on A (the guard sits inside A's effect).

### C. Panel open on r1, focus moves to a group header → panel stays on r1

- Test: `it('leaves the open panel on its row when focus moves to a group header')`
- Asserts: compose `withGrouping` on a key that puts more than one fixture row in one group (see `with-grouping/feature.spec.ts` for the config shape) alongside `withExpansion({ multi: false })`. Read the header id from `renderRows().find((row) => row.kind === 'group')`; don't hard-code the synthetic id format. Toggle `r1`, focus body on the header id, tick → `['r1']`, no emission. Control: focus `r2`, tick → `['r2']`.
- Covers: AC3
- Risk: damage high, likelihood high
- Why this seam: catches a missing `indexById().has(rowId)` check. Without it the panel moves to a synthetic id with no data row, and the real panel closes. That happens on every arrow past a header in a grouped table.
- Order reason: builds on A (adds the data-row guard).

### D. Multi-open, one panel open, focus moves → nothing changes

- Test: `it('does not follow focus in multi-open mode')`
- Asserts: `multi: () => multi()` with `multi = signal(true)`. Tick, toggle `r1`, focus `r2`, tick → `['r1']`, no emission. Control: `multi.set(false)`, tick, focus `r3`, tick → `['r3']`.
- Covers: AC4
- Risk: damage high, likelihood high
- Why this seam: catches a missing `multi()` check. Exactly one open row is used on purpose, so the "exactly one open" guard alone would let the bug through. Multi-open users would lose their panel on every arrow.
- Order reason: builds on A (adds the mode guard).

### E. Focus rests on r1 (open), `toggle('r2')` → panel stays on r2

- Test: `it('does not snap back to the focused row after a programmatic toggle')`
- Asserts: toggle `r1`, focus `r1`, tick. Toggle `r2`, tick → `['r2']`. Control: focus `r3`, tick → `['r3']`.
- Covers: W1
- Risk: damage high, likelihood high
- Why this seam: catches `store.expanded()` read tracked. The effect would re-run on the toggle and reopen `r1`, silently reverting an explicit API or toolbar open.
- Order reason: builds on A (pins the effect's tracked set).

### F. Panel open on r1, focus moves to a header cell or to a panel target → no switch

- Test: `it.each` over `{ area: 'header', columnId: 'name' }` and `{ area: 'panel', rowId: 'r2' }`, named `it('does not follow focus to a %s target')`
- Asserts: toggle `r1`, focus the target, tick → `['r1']`, no emission. Control: focus body `r3`, tick → `['r3']`.
- Covers: W2
- Risk: damage high, likelihood high
- Why this seam: catches a missing `area === 'body'` check. A header target has no `rowId`, so the write would become `setExpanded([undefined])` and close the panel on every move into the header row. One seam, because one missing guard fails both rows.
- Order reason: builds on A (adds the area guard).

### G. Focus on r2 while multi-open keeps r1 open; flip to single-open → no follow until focus moves

- Test: `it('does not follow when only the mode flips')`
- Asserts: `multi = signal(true)`, tick, toggle `r1`, focus `r2`, tick, start `collect`. `multi.set(false)`, tick → `['r1']`, emitted `[]`. Control: focus `r3`, tick → `['r3']`.
- Covers: W3
- Risk: damage low, likelihood low
- Why this seam: catches `multi()` read tracked. A mode flip would move the panel to wherever focus last rested, which nobody asked for.
- Order reason: builds on D (same accessor setup; D proves the guard, G proves it is untracked).

## Types phase (after green)

None. `ExpansionInput` widens to members (`focus`, `indexById`)
that every `TableStore` already carries. The existing
`describe('types')` cases in `with-expansion.spec.ts` already
compile `withExpansion()` alone, with a derive block, and after
`withGrouping`. A regression there fails `typecheck-spec` with no
new check.

## Not tested

- Focus moves to another column of the already-open row: the effect's write would be `setExpanded([r1])` on `[r1]`. Covered by `with-expansion.spec.ts` — 'a repeat write that changes nothing emits nothing on changed'.
- `focus()` is `null` (no position yet) while a panel is open: an unguarded `.area` read throws in the effect. Covered by `with-expansion.spec.ts` — 'row removal still prunes the open row from expansion()' and the 'live accessor' tests. They tick with a panel open and focus still `null`.
- Tree child rows as targets: they are in `indexById`, so they take A's branch. No separate logic.
- Focus target that is removed or unrendered: `focus.moveTo` rejects it before the effect sees it. Covered by `create-table.spec.ts` — `describe('focus.moveTo — unrendered target (#232)')`.
- Side-panel / inline-panel DOM reflow and DOM focus: no DOM in this step (K18). Store-seam only.
- JSDoc line on `WithExpansionConfig.multi`: documentation, not logic.
- AC5 ("store spec added; expansion spec updated"): a deliverable, satisfied by A–G existing. Not a behaviour.
