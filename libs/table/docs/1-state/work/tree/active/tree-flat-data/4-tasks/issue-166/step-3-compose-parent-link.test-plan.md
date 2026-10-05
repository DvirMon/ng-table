# Step 3 test plan — composeFeatures() + derive-block handling for parentLink

Step: [step-3-compose-parent-link.plan.md](step-3-compose-parent-link.plan.md)
Spec file: `libs/table/src/api/features/compose-features.spec.ts` (seams A–D), `libs/table/src/api/create-table.spec.ts` (seams E–F)

Seams E–F go in `create-table.spec.ts` because the existing derive-block tests live there (e.g. "rejects a derive block that declares pipeline behaviour…") and `create-table-feature.ts` has no spec of its own — `compose-features.spec.ts` asserts only the composite's domain.

## Stubs (red phase)

- None. No new symbols: the step edits private `foldInnerFeatures` / `mergeDerivedSpec` and the module constant `PIPELINE_BEHAVIOR_KEYS`. Tests import only existing symbols (`composeFeatures`, `createTableFeature`, `createTable`, `stageSchema`, `stage`) plus step 2's `TableFeatureSpec.parentLink` / `ctx.parentOf`. Red fails on assertions, not on `not implemented`.

Fixtures to add in `compose-features.spec.ts` beside the existing `named(...)` fixtures:

- `fParentLink(displayName)`: `createTableFeature(() => ({ parentLink: (row: MockRow) => row.id === 2 ? 1 : null }))` — links row 2 (Bea) under row 1.
- `fKeepsLinkedRows(displayName)`: claims `s.filter` with `run: (rows, ctx) => rows.filter(...)`, keeping a row only when `ctx.parentOf?.(row)` returns a non-null id. With the link present it yields `['Bea']`; with no link it yields `[]`, so a dropped link shows as an empty array instead of passing silently.

## Seams — in red-green order

### A. A link declared inside `composeFeatures()` → an outer-slot stage sees it through `ctx.parentOf`

- Test: `it('case 21 — an inner parentLink reaches an outer stage through ctx.parentOf')`
- Asserts: `makeStore(data, composeFeatures(fParentLink('fLink')), fKeepsLinkedRows('fOuterFilter'))` → `store.rows().map(r => r.name)` equals `['Bea']`.
- Why this seam: `foldInnerFeatures` builds its return object key by key, so a new key it doesn't list is dropped silently — the same regression case 18 guards for `expandedRows`. A dropped link makes `ctx.parentOf` `undefined` everywhere and silently degrades the tree, filter and group stages to flat behavior.
- Order reason: independent; the base case C and D build on.

### B. Two inner features both declaring `parentLink` → construction error naming both inner positions

- Test: `it('case 22 — two inner parentLink contributions throw, naming both inner positions')`
- Asserts: `makeStore(signal([...mockRows]), composeFeatures(fParentLink('fLinkA'), fParentLink('fLinkB')))` throws matching `/composeFeatures inner feature 1 \(fLinkA\) and composeFeatures inner feature 2 \(fLinkB\) both provide the parent link/`.
- Why this seam: the composite forwards only one link. Without claiming against the private registry, the second link either overwrites the first or is dropped silently, and the outer fold can never see the clash. Mirrors case 7 for stages.
- Order reason: independent of A in code (it tests the private-registry claim, not forwarding); after A so the fixture already exists.

### C. A link inside the composite and a link in an outer slot → the outer registry throws, naming the outer feature and the composite

- Test: `it('case 23 — an inner parentLink clashing with an outer one is named by the outer registry')`
- Asserts: `makeStore(signal([...mockRows]), fParentLink('fOuterLink'), composeFeatures(fParentLink('fInnerLink')))` throws matching `/feature 1 \(fOuterLink\) and feature 2 \(composeFeatures\) both provide the parent link/`.
- Why this seam: catches a composite that claims privately but never forwards — the outer fold would then see one link and silently pick it, though two features declared one. Mirrors case 10/10b for members/stages.
- Order reason: builds on A — only the forwarded `parentLink` lets the outer fold claim it.

### D. A composite with no link, beside an outer link → no false clash, and the outer link still reaches a stage inside the composite

- Test: `it('case 24 — a composite without a parentLink leaves the key absent, so an outer link is not a clash')`
- Asserts: `makeStore(data, fParentLink('fOuterLink'), composeFeatures(fKeepsLinkedRows('fInnerFilter')))` does not throw, and `store.rows().map(r => r.name)` equals `['Bea']`.
- Why this seam: the file's own comment requires an empty key to be absent. If forwarding writes `parentLink: undefined` unconditionally and step 2's outer fold claims on key presence, every composite beside a `withTree({ parentId })` throws a false collision.
- Order reason: builds on A (the conditional spread `...(hasParentLink ? { parentLink } : {})`). This test passes at red — kept on purpose as a guard.

### E. A derive block declaring `parentLink` → construction error listing `parentLink`

- Test: `it('rejects a derive block that declares a parentLink, naming it')`
- Asserts: `createTableFeature(() => ({ members: { count: 3 } }), () => ({ parentLink: () => null }))`, composed through `createTable(signal<Row[]>([]), { trackBy: 'id', columns: makeColumns() }, …)` in `TestBed.runInInjectionContext`, throws `/may only contribute members, but it declared parentLink/`.
- Why this seam: `'parentLink'` missing from `PIPELINE_BEHAVIOR_KEYS` makes a block's link vanish silently (`mergeDerivedSpec` builds its result explicitly), so the consumer gets a tree that never nests and no message.
- Order reason: independent.

### F. A feature with a derive block → keeps its own `parentLink`

- Test: `it('keeps the feature’s own parentLink when it has a derive block')`
- Asserts: data `[{ id: 'r1', name: 'Ann', status: 'active' }, { id: 'r2', name: 'Bo', status: 'active' }]`; a feature `createTableFeature(() => ({ parentLink: (row: Row) => row.id === 'r2' ? 'r1' : null }), () => ({ members: { extra: 1 } }))` followed by a feature with a `s.filter` stage keeping rows whose `ctx.parentOf?.(row)` is non-null; `store.rows().map(r => r.id)` equals `['r2']`.
- Why this seam: `mergeDerivedSpec` returns an object literal listing every forwarded key; `parentLink` isn't in it today, so adding any derive block (including `withComputed()`) to `withTree({ parentId })` would silently strip the hierarchy.
- Order reason: independent of E in code (different lines); after E because E fixes the key list this function reads first.

## Types phase (after green)

None — no public type surface in this step. `TableFeatureSpec.parentLink` and `StageContext` are step 2's / step 1's surface; the derive-block ban is runtime, not in `createTableFeature`'s overloads.

## Not tested

- Composite nested in a composite carrying a link — same `foldInnerFeatures` path as A/B; would fail on the same bug.
- A link declared in an inner feature whose stage is also inside the same composite — every stage gets `ctx` from the engine (step 2), so this is the same seam as A/D.
- `claimParentLink` behavior with `ngDevMode` off — step 2's registry; asserting it here tests another domain.
- The exact full error sentence beyond both claimant labels and the slot phrase — wording belongs to step 2's `SlotRegistry`.
- `PIPELINE_BEHAVIOR_KEYS` contents directly — tautological; seam E covers the behavior.
- A derive block declaring `parentLink` plus another banned key — the existing test covers the join logic; unchanged here.

## Resolved

- Collision wording from step 2: `… both provide the parent link. Only one feature may provide a parent link.` — B and C match on `both provide the parent link`. Approved 2026-09-27.
- Seam D is kept although it passes at red, as a guard that the key stays absent. Approved 2026-09-27.
- `ctx.parentOf` is optional (`parentOf?`), per step 1; fixtures use `?.`.
