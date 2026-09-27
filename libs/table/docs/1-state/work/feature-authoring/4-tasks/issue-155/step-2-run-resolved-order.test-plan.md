# Step 2 test plan — Run the resolved stage order

Step: [step-2-run-resolved-order.plan.md](step-2-run-resolved-order.plan.md)
Spec file: `libs/table/src/engine/compose-table.spec.ts` (seams A–D, F) and `libs/table/src/api/features/compose-features.spec.ts` (seam E)

## Stubs (red phase)
- None. Every seam enters through `composeTable` / `composeFeatures`, which already exist. Red is a real assertion failure: today the fold skips declare-form rules (`if ('name' in rule) continue`), so declared stages never run and a duplicate declared name never throws.

## Seams — in red-green order

Fixture notes:
- In `compose-table.spec.ts`, add `pinningStage(placement)` next to `taggingStage`. It declares `stage(s.tree, { name: 'pin', placement, run })` on the render layer.
- To make order visible, each render fixture appends to `aggregates.trail` (`'tree>'`, `'pin>'`), the same way `taggingStage` appends to `name`.

### A. A declared render stage `pin` after `'tree'`, with no `'tree'` claimant → `renderRows` changes
- Test: `it('runs a declared render stage placed after an unclaimed anchor')`
- Asserts: `pin` moves `'r2'` to the front, so the `renderRows()` ids equal `['r2', 'r1']` (`makeRows()` gives `['r1', 'r2']`).
- Why this seam: the base case. It catches the old `'name' in rule` skip still being there; the core still reducing over `RENDER_ANCHORS` and dropping non-anchor entries; the fold resolving against claimed anchors only, so an unclaimed `'tree'` looks like an unknown anchor. This is the realistic case: `withRowPinning` without `withTree`.
- Order reason: independent. The base case.

### B. `pin` after `'tree'`, with a `'tree'` claimant → `pin` sees the output of `'tree'`
- Test: `it('runs a declared stage after the anchor it is placed after')`
- Asserts: every row's `aggregates.trail` equals `'tree>pin>'`.
- Why this seam: catches a core that runs declared entries before claimed ones, or concatenates the lists in the wrong order instead of following the resolved order.
- Order reason: builds on A.

### C. `pin` before `'tree'`, with a `'tree'` claimant → `pin` runs first
- Test: `it('runs a declared stage before the anchor it is placed before')`
- Asserts: every row's `aggregates.trail` equals `'pin>tree>'`.
- Why this seam: B passes if the wiring appends every declared stage at the end of the layer. C fails that shortcut, which proves `placement` reaches the resolver.
- Order reason: builds on B.

### D. A declared pipeline stage after `'sort'` → `rows()` changes, after sort
- Test: `it('runs a declared pipeline stage after the anchor it is placed after')`
- Asserts: `taggingStage('sort', '-sort')` plus a stage `audit` declared `after` `s.sort` that tags `'-audit'`. `rows()[0].name === 'Ann-sort-audit'`.
- Why this seam: the pipeline layer has its own fold loop and its own runner (`runPipeline`). The render seams cannot catch a skip, or a reduce over the anchors, left behind on the pipeline side.
- Order reason: independent of A–C (separate code path); after them so the render wiring settles the shared shape first.

### E. `pin` after `'tree'` declared inside `composeFeatures()`, with an outer `'tree'` claimant → `pin` runs after tree, nothing throws
- Test: `it('case 20 — a declared stage inside a composite runs in resolved order')`
- Asserts: `makeStore(data, fTreeTrail('fOuterTree'), composeFeatures(fPinAfterTree('fPin')))` does not throw; every `renderRows()` entry has `aggregates.trail === 'tree>pin>'`.
- Why this seam: catches the inner fold dropping declare rules (today's `toStageRules` rebuilds claim-form rules only); rebuilding a rule without `name`/`placement`, so it reaches the outer fold as a second claim on `'tree'` and throws; resolving early, so the outer claimant is ordered wrongly.
- Order reason: builds on B.

### F. Two features both declare `pin` → throws, naming both positions
- Test: `it('throws naming both features when two declare the same stage name')`
- Asserts: `compose([pinningStage('after'), pinningStage('after')])` throws. The message contains `feature 1`, `feature 2` and `"pin"`, each asserted separately.
- Why this seam: step 1 tests duplicate detection with labels passed in by hand. Only the fold attaches the real label. A fold that attaches the wrong label (e.g. the last feature's, from a variable captured outside the loop) names the wrong party.
- Order reason: builds on A.

## Types phase (after green)
None — no public type surface. `runPipeline`/`runRenderStages` change signature but are not exported. Declared-name typing is step 4.

## Existing specs — behaviour guard
Must pass **unchanged**:
- `engine/compose-table.spec.ts`, every existing test. `'folds claimed stages in fixed anchor order…'` and `'composes render stages in RENDER_ANCHORS order…'` now guard the no-declared-stages path through the resolver. The duplicate-claim tests, the internal-feature ones, and `'still throws the full duplicate-claim message when ngDevMode is false (ungated)'` stay — step 3 flips the last one. Do not move built-in claim collisions into the resolver.
- `api/features/compose-features.spec.ts`, cases 1–19. Cases 7, 8, 10, 10b guard claims; case 12 guards anchor order across the composite; case 14: `stages`/`renderStages` stay **absent** when empty, never `[]`.
- Every `with-*` spec (sorting, filtering, grouping, tree).

Need **signature updates** (keyed object → ordered `ResolvedStage[]`), in green with the signature change:
- `engine/pipeline.spec.ts`: `'threads each stage output into the next'` passes a list; `'is a pass-through with no stages registered'` passes `[]` and still expects `toBe(rows)`; `'runs stages in PIPELINE_ANCHORS regardless of registration order'` becomes `'folds stages in list order'` (ordering now belongs to `resolveStageOrder`); `'skips unregistered stages'` is deleted.
- `engine/render-stages.spec.ts`: the same four decisions, plus the `mapNodes reach` test becomes a two-entry list.
- `engine/render-stages.types.spec.ts`: it imports `RenderStages`, which this step removes. Retarget it to `// @ts-expect-error` on `const bad: RenderStage = 'pinned'`. Keep `'pinned'` (not `'pin'`).

## Not tested
- The resolver's throw and order matrix — step 1.
- Runtime id checks — #156.
- The shape of collected/labelled rules and the core handle's list — internal.
- The value of `PIPELINE_ANCHOR_ELIGIBLE` — tautological.
- "Resolve once per layer" — internal, not observable.
- `synthesizesRows` surviving the composite forward — rules are forwarded as the same objects; seam E catches a field-dropping rebuild.
- Declared-name typing — step 4.

## Resolved questions
- Unclaimed built-ins are left out of the resolved list; `'skips unregistered stages'` is deleted.
- The resolver owns the anchor-eligible list; no composeTable seam for pipeline `s.group`.
- Fixture name `audit` (pipeline) and `pin` (render) get registry merges in step 4's types spec.
- Duplicate declared names are thrown by the resolver.
- Runners take step 1's `ResolvedStage<T>[]`.
