# Step 3 test plan — Dev-only duplicate stage claim

Step: [step-3-dev-only-duplicate-claim.plan.md](step-3-dev-only-duplicate-claim.plan.md)
Spec file: `libs/table/src/engine/compose-table.spec.ts`

## Stubs (red phase)

- None. The step adds no new symbol. `SlotRegistry.claimStage` and `claimRenderStage` keep their signatures. Red comes from the flipped test: today's ungated `claim()` throws, so Seam A fails as written.

## Seams — in red-green order

### A. ngDevMode false, two features claim the same pipeline anchor → no throw, only the later claim's transform runs

- Test: `it('lets the later pipeline claim win without throwing when ngDevMode is false')`
  - Replaces the test at `compose-table.spec.ts:205`, "still throws the full duplicate-claim message when ngDevMode is false (ungated)". Delete that test; do not keep both.
- Asserts:
  - Wrap in `setNgDevMode(false)` / `finally { setNgDevMode(previous) }`.
  - `composeWithRows([{ id: 'r1', name: 'Ann', age: 25 }], [taggingStage('sort', '-a'), taggingStage('sort', '-b')])` does not throw.
  - `rows()[0].name` is `'Ann-b'`. (`'Ann-a-b'` = both ran; `'Ann-a'` = first won; `'Ann'` = neither ran.)
- Why this seam: catches the gate missing from `claimStage`, and a production fold that runs both duplicate claims or drops the slot. A consumer sees wrong rows in each case.
- Order reason: base case.

### B. ngDevMode false, two features claim the same render anchor → no throw, only the later claim's transform runs

- Test: `it('lets the later render claim win without throwing when ngDevMode is false')`
- Asserts: same dev-mode wrapper. Two features each claim `s.group` with a stage that wraps the nodes in a synthesized group node, ids `'group-a'` and `'group-b'` (the `withGroupAndDrop` shape at `compose-table.spec.ts:346`). Composing `[groupA, groupB]` over `makeRows()` does not throw; `renderRows()[0].id` is `'group-b'`.
- Why this seam: `claimRenderStage` has its own check body. A gate added only to `claimStage` passes A and still throws here.
- Order reason: builds on A.

### C. ngDevMode false, two features declare the same member key → still throws the full member-collision message

- Test: `it('still throws on a duplicate member claim when ngDevMode is false (members stay ungated)')`
- Asserts: same wrapper. `compose([() => ({ members: { alpha: 1 } }), () => ({ members: { alpha: 2 } })])` throws `'[createTable] feature 1 and feature 2 both provide the "alpha" store member. Only one feature may provide each member.'`
- Why this seam: all three claim methods share the private `claim()` helper. Gating inside `claim()` silently turns off member collisions in production too. A and B pass under that wrong gate; only this test fails.
- Order reason: builds on A and B.

## Types phase (after green)

None — no public type surface in this step.

## Not tested

- The existing dev-mode throws (`compose-table.spec.ts:187`, `:195`; `slots.spec.ts:47`, `:81`; `compose-features.spec.ts` cases 7, 8, 10b) already cover "gate open → throws naming both". They must pass unchanged.
- `composeFeatures` inner duplicates with ngDevMode false — same `SlotRegistry` methods; A or B fails first.
- Core-member pre-claims with ngDevMode false — go through `claimMember`, covered by C.
- Gate tests on `SlotRegistry` directly in `slots.spec.ts` — would test internal claim maps, not observable rows.
- `ng-dev-mode.testing.ts` header and CLAUDE.md wording — docs, no test.

## Resolved questions

- The later claim wins in production (plan.md Q8); asserted as `'Ann-b'` / `'group-b'`.
- Step 1's resolver keeps the last claim for a duplicated anchor, so step 2's collect/resolve does not change the winner.
