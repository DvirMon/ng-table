# Step 2 test plan — `parentLink` slot, single-claim

Step: [step-2-parent-link-slot.plan.md](step-2-parent-link-slot.plan.md)
Spec file: `libs/table/src/engine/compose-table.spec.ts`
(new `describe('parentLink contribution (ADR-0028)')` block,
beside `describe('expandedRows contributions (ADR-0017)')`;
reuses `composeWithRows`, `makeRows`, `stageSchema`/`stage`,
and the existing `getNgDevMode`/`setNgDevMode` helpers)

## Stubs (red phase)
- `TableFeatureSpec<TRow>.parentLink?: (row: TRow) => RowId | null` in `engine/types.ts` — type-only field, no body. The red phase needs it: the tests return `{ parentLink }` from an `AnyTableFeature`, which fails the excess-property check without it.
- No function stubs. The tests import no new symbol and go through `composeTable` only; `SlotRegistry.claimParentLink(feature: string): void` is written in green. Until then the fold ignores `parentLink`, so B–E fail on assertions, not on compile.

## Seams — in red-green order
### A. No feature contributes `parentLink` → a stage's `ctx.parentOf` is `undefined`
- Test: `it('leaves ctx.parentOf undefined when no feature contributes a parent link')`
- Asserts: a `'filter'` pipeline stage renames each row to `ctx.parentOf === undefined ? 'unlinked' : 'linked'`; `rows().map(r => r.name)` equals `['unlinked', 'unlinked']`.
- Why this seam: filtering and grouping switch to tree mode when `parentOf` is present. An engine that always handed stages a default `() => null` would put every table into roots-only grouping and ancestor retention.
- Order reason: base case, independent. **This test passes against the red stubs** (step 1 already passes `{}`); it is a regression guard for green, not a red driver — listed so the red phase does not report it as a plan defect.

### B. Feature 2 contributes `parentLink`; a pipeline stage in feature 1 resolves parents through it
- Test: `it('lets a pipeline stage resolve parents via a link another feature contributes')`
- Asserts: feature 1 claims `'filter'` and maps `name → \`${name}<${ctx.parentOf?.(row) ?? 'root'}\``; feature 2 contributes `parentLink: (row) => (row.id === 'r2' ? 'r1' : null)`; `rows().map(r => r.name)` equals `['Charlie<root', 'Ann<r1']`.
- Why this seam: catches (1) the fold never recording the contribution, (2) core never passing it into the pipeline `ctx`, (3) the link being captured at fold time rather than read at evaluation — the consumer is deliberately folded *before* the contributor, the same trap `expandedSources` laziness guards.
- Order reason: builds on A (A fixes the ctx plumbing B fills).

### C. The same contribution reaches a render stage's `ctx`
- Test: `it('passes the contributed parent link to render stages too')`
- Asserts: feature 1 claims render `'tree'` and sets `aggregates: { parent: ctx.parentOf?.(node.data) ?? 'none' }`; same link as B from feature 2; `renderRows().map(r => r.aggregates?.parent)` equals `['none', 'r1']`.
- Why this seam: core resolving the link for `runPipeline` but still passing `{}` to `runRenderStages` — `withTree`'s nesting stage is a render stage, so this is its only path to the link.
- Order reason: builds on B (link resolved); only adds the second consumer layer.

### D. Two features contribute `parentLink` → construction throws naming both
- Test: `it('throws naming both features when two contribute a parent link')`
- Asserts: `compose([withLinkA, withLinkB])` throws `'[createTable] feature 1 and feature 2 both provide the parent link. Only one feature may provide a parent link.'`
- Why this seam: catches the fold overwriting (last-wins) or accumulating like `expandedRows` instead of single-claiming. Two trees disagreeing on parentage would otherwise silently nest rows by whichever folded last.
- Order reason: independent of B/C; needs only the fold to call `claimParentLink`.

### E. Same as D with `ngDevMode === false` → still throws
- Test: `it('still throws on a duplicate parent link when ngDevMode is false (ungated, like members)')`
- Asserts: inside `setNgDevMode(false)` / `finally` restore, the same `compose([...])` throws the same message as D.
- Why this seam: `claimParentLink` copying `claimStage`'s dev-mode-off silent replace instead of `claimMember`'s always-throw — the outline requires the latter.
- Order reason: builds on D (message and claim path exist; E adds only the gating rule).

## Types phase (after green)
None — no public type surface in this step.

## Not tested
- `SlotRegistry.claimParentLink` directly in `slots.spec.ts` — would fail on the same bug as D/E, and D/E also catch a fold that never calls it. One test per seam.
- Duplicate contribution with `ngDevMode` on/undefined as its own test — that is D (default is on).
- Collision label for an internal feature — `describeInternalFeature` already covered in `slots.spec.ts`; the label is passed through unchanged.
- A consumer `parentLink` callback that throws — runtime degrade (ADR-0014) belongs to `withTree`'s nesting stage (#167); the engine only hands the function over.
- Contextual typing of `parentLink`'s `row` parameter — inherited from `TableFeatureSpec<TRow>` as-is; asserting it tests the compiler.
- `TableFeatureSpec.parentLink` field existence on its own — static shape; B–E's compile already depends on it.

## Resolved
- Collision message: `[createTable] <a> and <b> both provide the parent link. Only one feature may provide a parent link.` Approved 2026-09-27.
- `composeFeatures` / derive-block handling for `parentLink` is Step 3, with its own seams. Approved 2026-09-27.
