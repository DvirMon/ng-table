# Step 1 test plan — Stage order resolver

Step: [step-1-stage-order-resolver.plan.md](step-1-stage-order-resolver.plan.md)
Spec file: `libs/table/src/engine/stage-order.spec.ts`

Plain vitest, no TestBed. Layout follows `schema/validate.spec.ts`: a top-level `describe('resolveStageOrder')`; dev-gate flips via `getNgDevMode`/`setNgDevMode` (`src/ng-dev-mode.testing.ts`), restored in `try/finally`.

Fixtures are local helpers in the spec file: `claim(label, anchor)` and `declare(label, name, anchor, placement, opts?)`. They are not row data, so they don't go in `table.mock.ts`. Every `run` is a distinct named identity function, so an assertion can check by reference that each `run` stays paired with its own name.

Three `it.each` tables — one row per case below. A new check later is one new row.

## Stubs (red phase)
- `LabelledStageRule<TTransform>` = `{ readonly label: string; readonly rule: StageRule<TTransform> }` — type only.
- `ResolvedStage<TTransform>` = `{ readonly name: string; readonly run: TTransform }` — type only.
- `resolveStageOrder<TTransform>(layer: 'pipeline' | 'render', rules)` — throws `not implemented: resolveStageOrder`.

## Table 1 — `it.each`: resolves the order (dev gate on, no throw, assert output names)
- A. Built-in claims registered in reverse → built-in order, both layers. Pipeline claims `sort, group, filter` → `filter, group, sort`; render `tree, group` → `group, tree`; each `run` paired with its own name by reference. Catches registration order, the wrong layer's list, a mis-paired `run`.
- B. Unclaimed built-in left out. Pipeline claims `filter`, `sort` → `['filter','sort']`, no entry with undefined `run`. Catches emitting every built-in.
- D. Declared `before`. Pipeline claims `filter`, `sort`; `audit` before `filter` → `['audit','filter','sort']`. Catches `placement` ignored.
- F. Unclaimed built-in still anchors. Render claims `group` only; `pin` after `tree` → `['group','pin']`. Catches the anchor lookup built from claimed stages only (would throw "unknown anchor" without `withTree()`), and declared rules dropped.
- G. Declared anchors on declared. Render claims `group`, `tree`; `badge` after `pin` registered before `pin` after `tree` → `['group','tree','pin','badge']`. Catches resolving declared anchors in registration order.
- H. Different gaps are not a tie. Pipeline claims `filter`, `sort` (`group` unclaimed); `a` after `filter`, `b` before `sort` → `['filter','a','b','sort']`. Catches a tie check that ignores the built-in between them (Q9 gap model).
- P. Tie resolved by anchoring one on the other. Render `audit` after `tree`, `badge` after `audit` → `['group','tree','audit','badge']`. The AC; catches a tie check that groups by the eventual built-in anchor and rejects the fix.
- R. `synthesizesRows: true` after render `group` is allowed → `['group','headers']`. Catches a check that fires on any synthesizing stage anchored on `group`.

## Table 2 — `it.each`: throws on wiring errors (dev gate on; assert message fragments, each row lists its own)
All rows match `/^\[createTable\]/`.
- I. Unknown anchor: `withBadge` declares `badge` after `pin`, nobody declares `pin` → `/withBadge/`, `/"pin"/`, `/unknown anchor/i`.
- J. Pipeline `group` anchor: `withGrouping` claims `group`, `withAudit` declares `audit` after `group` → `/withAudit/`, `/"group"/`, `/not anchor-eligible/`, and the message does **not** match `/unknown anchor/i`.
- K. Cycle: `a` after `b`, `b` after `a` → `/cycle/i`, `/withA/`, `/withB/`, `/"a"/`, `/"b"/`. Catches an infinite loop and a one-sided message.
- L. Duplicate declared name: `withPinA`, `withPinB` both declare `pin` after `tree` → `/withPinA/`, `/withPinB/`, `/"pin"/`, `/duplicate/i`. The tie check must not fire first.
- M. Declared name equals a built-in: `withShadow` declares `tree` after `group` → `/withShadow/`, `/"tree"/`, `/duplicate/i`.
- O. Tie in one gap, different anchors (Q6): render claims `group`, `tree`; `a` after `group`, `b` before `tree` → `/"a"/`, `/"b"/`, `/anchor one on the other/`. Also covers the same-anchor tie: a check keyed on `(anchor, placement)` passes that case but fails this one.
- Q. `synthesizesRows: true` before render `group`: `withHeaders` declares `headers` before `group` → `/withHeaders/`, `/"headers"/`, `/"group"/`, `/synthesizesRows/`.

## Table 3 — `it.each`: dev checks off (`setNgDevMode(false)` in `try/finally`; no throw; assert output names)
- S. Tie falls back to name order: `zeta` after `tree` registered before `alpha` after `tree` → `['group','tree','alpha','zeta']`. Catches the gate at a call site and a registration-order fallback.
- T. Offending stages dropped (Q10): unknown anchor and pipeline-`group` anchor dropped; a cycle dropped without hanging; a duplicate declared name keeps the later declaration; valid stages still run in order.

## Types phase (after green)
None — `resolveStageOrder`/`LabelledStageRule` stay engine-internal.

## Not tested
- Duplicate claims of a built-in slot — `SlotRegistry`, step 3 (including last-claim-wins with the gate off).
- Each gated `assert*` helper on its own — reached through `resolveStageOrder`; importing them ties the spec to how checks are split.
- Calling any `run` — the resolver treats `run` as opaque.
- Full message text — only fragments, so rewording doesn't break tests.
- Declared-name typing — step 4.
- `synthesizesRows` on the pipeline layer — no check applies.
- Separate rows for "declared after the last anchor" (covered by F) and "after a middle anchor" (covered by H), and the same-anchor tie (covered by O).

## Resolved questions
- `layer: 'pipeline' | 'render'`; the resolver owns the eligible sets.
- `LabelledStageRule` is `{ label, rule }`.
- Placement is a gap (plan.md Q9).
- `synthesizesRows` checked by final position, fires even when `group` is unclaimed.
- Dev-off fallback: plan.md Q10.
- Message keywords as listed in Table 2.
