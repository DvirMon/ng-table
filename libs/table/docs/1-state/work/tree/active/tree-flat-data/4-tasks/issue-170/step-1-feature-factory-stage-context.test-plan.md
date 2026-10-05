# Step 1 test plan — Feature factories receive the stage context

Step: [step-1-feature-factory-stage-context.plan.md](step-1-feature-factory-stage-context.plan.md)
Spec file: `libs/table/src/engine/compose-table.spec.ts` (seam A),
`libs/table/src/api/features/compose-features.spec.ts` (seam B),
`libs/table/src/api/create-table.spec.ts` (seams C, D —
the existing home of the `createTableFeature` derive tests)

## Stubs (red phase)

The tests import no new runtime symbol. `StageContext<TRow>`
already exists (`engine/types.ts:32`). What red must land is
the type-only signature change. Without it, a two-argument
fixture does not compile:

- `engine/types.ts` — `Feature<In, Out>` call signature becomes
  `(input: In, ctx: StageContext<RowOf<In>>): TableFeatureSpec<RowOf<In>, Out>`.
  `ctx` is required.
- `api/create-table-feature.ts` — both overloads:
  `factory: (input: In, ctx: StageContext<RowOf<In>>) => TableFeatureSpec<RowOf<In>, Out>`.
  `derive` stays `Feature<In & Out, D>`, so it picks up `ctx`
  from the type change above. The implementation signature
  gains `ctx?: any`. The bodies do not change in red.
- A required `ctx` breaks the arity check at two call sites
  typed `AnyTableFeature`:
  - `engine/compose-table.ts:184` (`feature(store)`)
  - `api/features/compose-features.ts:84` (`feature(innerStore)`)

  Red passes `{}` at both, marked
  `// not implemented: stage context`. Green's
  `not implemented:` grep then catches both placeholders.
  `{}` is a valid `StageContext` whose `parentOf` is
  `undefined`, so every seam below still fails in red. Seams A
  and B fail on an assertion. Seams C and D fail with a
  TypeError, because the `createTableFeature` wrapper drops
  `ctx`.

## Seams — in red-green order

### A. Reader feature listed before the link feature → its factory's `ctx.parentOf` resolves the later link when read after composition

- Test: `it('resolves ctx.parentOf lazily, so a factory sees a link a later feature contributes')`
  inside the existing `describe('parentLink contribution (ADR-0028)')`
- Asserts: feature 1 is
  `(_store, ctx) => ({ members: { parentOfRow: (row: Row) => ctx.parentOf?.(row) ?? 'root' } })`.
  Feature 2 is
  `{ parentLink: asParentLink((row) => (row.id === 'r2' ? 'r1' : null)) }`.
  After `composeWithRows(makeRows(), [reader, link])`,
  `makeRows().map(store['parentOfRow'])` equals `['root', 'r1']`.
- Why this seam: catches a context built as
  `{ parentOf: handle.parentLink.value }`. That copies the value
  when feature 1's factory runs, before feature 2 has folded, so
  the link would stay `undefined` for good. This is the exact
  risk the outline names (`withTree({ parentId })` folding after
  its reader). It also catches the engine not passing `ctx` at
  all.
- Order reason: independent — the base case. Every later seam
  forwards the context this seam makes the engine supply.

### B. Inner feature of `composeFeatures`, link in a later outer slot → the inner `ctx.parentOf` resolves it

- Test: `it('case 25 — an inner feature receives the outer ctx, resolving a later outer slot’s link')`
  inside `describe('parentLink (ADR-0028, #166 step 3)')`
- Asserts: a new fixture, `fReadsParentOf('fReader')`, is
  `createTableFeature((input: Store, ctx) => ({ members: { parentIds: computed(() => input.rows().map((row) => ctx.parentOf?.(row) ?? null)) } }))`.
  `makeStore(signal([...mockRows]), composeFeatures(fReadsParentOf('fReader')), fParentLink('fOuterLink'))`.
  Then `store.parentIds()` equals `[null, 1, null]`.
- Why this seam: catches `foldInnerFeatures` calling
  `feature(innerStore)` without `ctx`. It also catches a context
  private to the composite, built only from the inner features'
  links: that one never sees an outer slot's link and would give
  `[null, null, null]`. The outline requires inner features to
  get the same `ctx` as everything else.
- Order reason: builds on A. The composite can only pass on the
  context the engine gives it.

### C. `createTableFeature(factory, derive)` → `factory` still receives `ctx`

- Test: `it('forwards ctx to a factory that has a derive block')`
- Asserts: the factory is
  `(input: TableStore<Row>, ctx) => ({ members: { parentIds: computed(() => input.rows().map((row) => ctx.parentOf?.(row) ?? null)) } })`.
  The derive block is
  `() => ({ members: { extra: signal(1).asReadonly() } })`.
  A later feature contributes
  `parentLink: (row) => (row.id === 'r2' ? 'r1' : null)`.
  Rows are `r1`, `r2`. `store.parentIds()` equals
  `[null, 'r1']`.
- Why this seam: the no-derive form returns `factory` unchanged,
  so it forwards `ctx` for free. The derive form wraps `factory`
  in `(input) => factory(input)` (`create-table-feature.ts:47-48`),
  which silently drops the second argument.
- Order reason: builds on A. Independent of B and D.

### D. `createTableFeature(factory, derive)` → `derive` receives `ctx`

- Test: `it('passes ctx to the derive block')`
- Asserts: the factory is `() => ({})`. The derive block is
  `(input, ctx) => ({ members: { parentIds: computed(() => input.rows().map((row) => ctx.parentOf?.(row) ?? null)) } })`
  (a signal, as `DerivedDict` requires). Same later link feature
  and rows as C. `store.parentIds()` equals `[null, 'r1']`.
- Why this seam: `derive(blockInput)` (line 56) is a separate
  call site from `factory(input)`. Forwarding to one and
  forgetting the other is a distinct bug that C cannot catch.
  The outline says "derive receives it too".
- Order reason: builds on A. Independent of C: a different call
  site in the same wrapper.

## Types phase (written in red, proven by green's typecheck)

In `engine/types.types.spec.ts` (new; `Feature` lives in
`engine/types.ts`):

- `expectTypeOf<Parameters<Feature<TableStore<Row>, {}>>[1]>().toEqualTypeOf<StageContext<Row>>()`
  — pins that `ctx` is typed by the row recovered through
  `RowOf<In>`, not `unknown`/`any`.
- `expectTypeOf<(input: TableStore<Row>) => TableFeatureSpec<Row, {}>>().toMatchTypeOf<Feature<TableStore<Row>, {}>>()`
  — pins the additive promise: a one-argument factory is still a
  `Feature`.

In `api/create-table-feature.types.spec.ts` (new; owner of
`createTableFeature`):

- `createTableFeature((input: TableStore<Row>, ctx) => { expectTypeOf(ctx).toEqualTypeOf<StageContext<Row>>(); return {}; })`
  — pins that the overload types an unannotated `ctx` from the
  factory's `In`.
- `createTableFeature((input: TableStore<Row>) => ({ members: { n: signal(1) } }), (input, ctx) => { expectTypeOf(ctx).toEqualTypeOf<StageContext<Row>>(); return {}; })`
  — pins that `RowOf<In & Out>` still recovers `Row` through the
  intersection the derive block is typed against.

## Not tested

- **No link contributed → the factory's `ctx.parentOf` is
  `undefined`.**
  - It passes against the red `{}` placeholder, so it cannot
    fail (test-first rule 5).
  - The `undefined` contract for the same `handle.parentLink`
    box is already pinned by the stage-side test ("leaves
    ctx.parentOf undefined when no feature contributes a parent
    link").
- **A link from an _earlier_ feature.** Any bug it would catch,
  seam A also catches: a lazy getter passes both, a value copied
  at factory time fails A. One seam.
- **`createTableFeature(factory)` without derive.** It returns
  `factory` unchanged, so there is no new logic. Seam A's engine
  forwarding covers it.
- **"`ctx` is not a store member / nothing on the table
  changes."** A structural check with no logic behind it
  (unit-test skip list: static structure). Rejected option B1 is
  a design choice, not a runtime branch.
- **Reading `ctx.parentOf` inside the factory body sees
  `undefined` for a later link.** This is an order limitation,
  not a behaviour to promise. A test would lock in something the
  step does not choose.
- **Stage-side `ctx` (`core.ts:68,111`).** Unchanged by this
  step. The existing ADR-0028 stage tests keep it covered.
- **Internal features (`InternalFeature`).** Not in the
  outline's files. They receive `TableCore`, not `ctx`.
- **`withComputed()` forwarding `ctx` to its block.** Not in the
  outline. Its block takes a read-only store, not a feature
  factory, so it has no `ctx` slot to test.
- **A throwing `parentLink` read through `ctx`.** The engine
  passes the link on unwrapped. Degrading is the contributing
  stage's job (ADR-0014/0028, `core.ts:35-36`).

## Resolved in planning

- `ctx` is required on the `Feature` call signature (P2), so a forgotten forward fails to compile.
- The lazy context object is built in `compose-table.ts` only. `core.ts` is unchanged.
