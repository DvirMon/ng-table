# Step 2 test plan — Compose context rows through composeFeatures and derive blocks

Step: [step-2-compose-context-rows.plan.md](step-2-compose-context-rows.plan.md)
Spec file: `libs/table/src/api/features/compose-features.spec.ts` (seams A–C), `libs/table/src/api/create-table.spec.ts` (seams D–E)

## Stubs (red phase)
- None. The step adds no new exported symbol. It changes the internal `foldInnerFeatures`, `PIPELINE_BEHAVIOR_KEYS` and `mergeDerivedSpec`. `TableFeatureSpec.contextRows` and the `isContextRow` stamping come from step 1. Red tests compile once step 1 is in, and they fail on assertions.
- New test fixture in `compose-features.spec.ts`, next to `fExpandedRows`: `fContextRows(source: Signal<ReadonlySet<RowId>>, displayName: string): Feature<Store, NoMembers>`. It takes a signal, not an id list, because seam C writes to it.
- Assertions read `store.renderRows().filter((row) => row.isContextRow).map((row) => row.id)`. This does not depend on whether step 1 stamps a row outside the set as `false` or `undefined`.

## Seams — in red-green order
### A. One inner `contextRows` contributor → the outer engine stamps those rows
- Test: `it('case 25 — an inner contextRows contribution reaches the outer engine\'s stamping')`
- Asserts: `makeStore(data, composeFeatures(fContextRows(signal(new Set([2])), 'fContext')))` gives stamped ids `[2]`.
- Why this seam: `foldInnerFeatures` builds its return object key by key. If `contextRows` is left out of the collection or the return, the composite drops it without any error and no row is ever stamped. Case 18 guards the same bug for `expandedRows`.
- Order reason: base case. Independent.

### B. Two inner contributors → the composite signal is their union
- Test: `it('case 26 — two inner contextRows contributions union into one composite set')`
- Asserts: `composeFeatures(fContextRows(signal(new Set([1])), 'fCtxA'), fContextRows(signal(new Set([3])), 'fCtxB'))` gives stamped ids `[1, 3]`.
- Why this seam: the outer fold sees one slot per feature. So N inner contributors must be merged into one signal. A last-wins assignment (`contextRows = spec.contextRows`, copying the `parentLink` pattern) passes A and would give `[3]` here.
- Order reason: builds on A (the slot has to reach the engine first).

### C. An inner source signal changes → the composite follows
- Test: `it('case 27 — the composite contextRows recomputes when an inner source changes')`
- Asserts: with `const ctx = signal<ReadonlySet<RowId>>(new Set([2]))`, the stamped ids are `[2]`. After `ctx.set(new Set([3]))`, they are `[3]`.
- Why this seam: catches a union built once at fold time (reading `source()` outside a `computed`) instead of inside the composite `computed`. A and B pass either way. Only a change after construction shows the difference.
- Order reason: builds on B (the union must exist before its reactivity matters).

### D. A derive block that declares `contextRows` → construction throws, naming it
- Test: `it('rejects a derive block that declares contextRows, naming it')`
- Asserts: `createTableFeature(() => ({ members: { count: 3 } }), () => ({ contextRows: signal(new Set<RowId>()) }))` inside `createTable` throws `/may only contribute members, but it declared contextRows/`.
- Why this seam: catches `'contextRows'` missing from `PIPELINE_BEHAVIOR_KEYS`. Without it, a derive block could add pipeline behaviour, which the contract forbids, and nothing would report it. It is a construction error, so it throws (ADR-0014). Copies the existing `parentLink` rejection test.
- Order reason: independent of A–C (different file, different function).

### E. A feature with its own `contextRows` plus a derive block → its contextRows survives the merge
- Test: `it('keeps the feature\'s own contextRows when it has a derive block')`
- Asserts: `createTableFeature((_input: TableStore<Row>) => ({ contextRows: signal(new Set<RowId>(['r2'])) }), () => ({ members: { extra: signal(1).asReadonly() } }))` over rows `r1`, `r2` gives stamped ids `['r2']`.
- Why this seam: `mergeDerivedSpec` does not spread `spec`. It copies `expandedRows`, `parentLink` and the other keys one by one. Adding the key to `PIPELINE_BEHAVIOR_KEYS` alone still drops the feature's own `contextRows` whenever it has a derive block. Copies the existing `parentLink` keep test.
- Order reason: builds on D (same function; D pins the guard, E pins the pass-through beside it).

## Types phase (written in red, proven by green's typecheck)
None — no public type surface in this step. (`TableFeatureSpec.contextRows?` is step 1's.)

## Not tested
- Key absent when no inner contributor — existing case 14 already covers it. There a composite of `withComputed()` blocks is a trailing derive block. If the fold always emitted `contextRows`, even as an empty `computed`, case 14 would throw once D's key is added. No new test: the same bug would make both fail, so it is one seam.
- Overlapping inner sets (`{1,2}` ∪ `{2,3}`) — a `Set` removes duplicates. That is language behaviour, not our logic ("the framework itself").
- Nested composite (`composeFeatures(composeFeatures(fCtx))`) — it runs the same `foldInnerFeatures` path again, so A already covers it.
- Composite plus an outer contributor unioning — core's accumulation from step 1, not this step's domain (spec-files-assert-own-domain-only).
- `isContextRow` stamping itself — step 1's, covered in core's spec.
- Stages or `renderStages` reading `ctx` — not touched here.

## Resolved
- `mergeDerivedSpec` also passes `contextRows: spec.contextRows` through — part of this step's Do list.
