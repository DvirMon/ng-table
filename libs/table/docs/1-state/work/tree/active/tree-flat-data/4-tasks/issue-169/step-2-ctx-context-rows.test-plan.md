# Step 2 test plan — ctx.contextRows: engine read of the context-rows slot

Step: [step-2-ctx-context-rows.plan.md](step-2-ctx-context-rows.plan.md)
Trimmed: seam C (reactivity) merged into B; B retitled to the lazy read — union alone is already pinned at `engine/compose-table.spec.ts:402`, `engine/core.spec.ts:290`, `api/features/compose-features.spec.ts:662`.
Spec file: `libs/table/src/engine/compose-table.spec.ts`
(new `describe('ctx.contextRows')` after the existing `describe('contextRows contributions')` block, line ~401)

## Stubs (red phase)

- `libs/table/src/engine/types.ts`, on `StageContext<TRow>`: `contextRows?(): ReadonlySet<RowId>;` — a type member, so no body to stub. Method syntax, like `parentOf`.
- `libs/table/src/engine/compose-table.ts`, on `stageContext`: `contextRows(): ReadonlySet<RowId>` — throws `not implemented: contextRows`

The tests import no new symbol. They reach the member through a test feature's `ctx`, following the ADR-0028 `parentOf` tests at line ~800 (`composeWithRows` plus a `members` reader).

## Seams — in red-green order

### A. No feature contributes `contextRows` → `ctx.contextRows()` returns an empty set

- Test: `it('returns an empty set when no feature contributes contextRows')`
- Asserts: a reader feature exposes `readContext: () => ctx.contextRows?.()`. With no contributor, `store.readContext()` gives `new Set()`, not `undefined`.
- Why this seam: core's `context` computed returns `undefined` when there are zero sources, because that is how the stamp marks "not composed". The new read must map that to an empty set. Two bugs this catches:
  - returning `undefined` means `withTree()` has to branch on it;
  - `contextIds.has` against `undefined` throws.
- Order reason: independent. It is the base case.

### B. Reader folded before its contributors → it reads them lazily, and follows a later change

- Test: `it('reads contextRows lazily — a reader folded before the contributors sees their union and its later changes')`
- Asserts: features in this order:
  - the reader;
  - a contributor whose `contextRows` is a `signal` holding `{'r1'}`;
  - a contributor with `{'r2'}`.
    After compose, `store.readContext()` equals `new Set(['r1', 'r2'])`. Then the first contributor's signal is `.set(new Set(['r3']))`, and `store.readContext()` equals `new Set(['r3', 'r2'])`.
- Why this seam: catches wiring bugs that all fail the same assertion:
  - taking a copy of `handle.contextSources` when `stageContext` is built, before the fold fills it;
  - copying the value instead of reading it lazily. The outline names this one ("a feature folded later may contribute"). Same hazard the `parentOf` getter comment covers;
  - saving the first result (a closure variable, or `untracked`) instead of reading through the signal. Reveal in `withTree()` depends on it: context rows change on every filter edit.
- Order reason: builds on A (the wiring exists and returns a set). Adds contributors, fold order and a later write.

## Types phase (written in red, proven by green's typecheck)

- File: `libs/table/src/engine/types.types.spec.ts`. `expectTypeOf<NonNullable<StageContext<Row>['contextRows']>>().returns.toEqualTypeOf<ReadonlySet<RowId>>()` pins the return as a plain set, with no `| undefined`. This is the type half of seam A. `StageContext` is public (re-exported from `src/index.ts`), so feature authors rely on it.

## Not tested

- The union of several contributors on its own — already pinned by `engine/compose-table.spec.ts:402`, `engine/core.spec.ts:290` and `api/features/compose-features.spec.ts:662`. B uses it only as the vehicle for the lazy read.
- The `isContextRow` stamp after core exposes `context` on `TableCoreHandle`. The existing test `'collects a contextRows contribution from every feature in the fold'` (`compose-table.spec.ts:402`) already covers it and stays as the regression guard.
- The new `TableCoreHandle` field on its own. Plumbing between core and compose-table with no logic of its own. Seams A–B reach it through `ctx`, which is the contract.
- Existing literal `StageContext` values (`pipeline.spec.ts:37`, `render-stages.spec.ts:50`) still compiling. The member is optional, so `typecheck-spec` proves this without a new test.
- Any `withTree()` or `withFiltering()` behaviour. Step 2 checks only the engine's own read.

## Open questions

- None. Resolved in review: the core handle field is `contextRows`; the `StageContext` member stays optional, like `parentOf`; its JSDoc repeats the "never read in a factory body" rule; testing through a test feature's `ctx` follows the ADR-0028 `parentOf` precedent.
