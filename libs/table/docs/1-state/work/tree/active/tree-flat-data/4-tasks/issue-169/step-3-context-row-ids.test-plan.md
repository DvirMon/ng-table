# Step 3 test plan — `table.tree.contextRowIds()` read

Step: [step-3-context-row-ids.plan.md](step-3-context-row-ids.plan.md)
Trimmed: seams A and C (restate step 2's A and B — `contextRowIds` is a plain computed over `ctx.contextRows()`); B's "equals the `isContextRow` flags" half (owned by `with-filtering/feature.spec.ts:604`).
Spec file: `libs/table/src/api/features/with-tree/feature.spec.ts`
(new `describe('contextRowIds (#169)')`, placed after the existing `describe('tree reads (parentOf / descendantsOf)')`. It reuses the spec's own `inContext()`, `makeFlatColumns()` and `makeFlatRows()` from `table.mock.ts`.)

## Stubs (red phase)

- `TreeSlice.contextRowIds: Signal<ReadonlySet<RowId>>` — declared as `readonly` in `with-tree/types.ts`. In `with-tree/feature.ts` the tree slice gets `contextRowIds: computed((): ReadonlySet<RowId> => { throw new Error('not implemented: contextRowIds'); })`. The slice's `Object.assign` stays the same apart from this one member. Green threads `ctx` into `buildTreeSpec`.

## Seams — in red-green order

### B. Filtered flat tree → `contextRowIds()` holds the context rows

- Test: `it('contextRowIds() holds the context rows of the active filter')`
- Asserts: `withTree({ parentId })` comes first, then `withFiltering({ schema: (path) => ({ name: contains(path.name) }) })`. The test calls `store.tree.expand(['r1', 'c1'])` and filters on `'Grand'`. Then `expect(store.tree.contextRowIds()).toEqual(new Set(['r1', 'c1']))`.
- Why this seam: this is the step's acceptance check. It catches two bugs:
  - `ctx` read once in the factory body. `withFiltering()` is folded after `withTree()`, so a read in the body sees no contributor and the set stays empty. That is the lazy-read rule from `engine/types.ts`.
  - The member wired to the wrong source, for example the open set.
- Order reason: independent. It is the base case.

### D. Context row hidden under a collapsed ancestor → still listed

- Test: `it('contextRowIds() lists a context row that is hidden under a collapsed parent')`
- Asserts: a bare contributor with `new Set(['c1'])` comes after `withTree({ parentId })`, and nothing is expanded. First, `renderRows()` ids do not contain `'c1'`. Then `expect(store.tree.contextRowIds()).toEqual(new Set(['c1']))`.
- Why this seam: story 30 exists so a developer can build a reveal policy. That means the member must report context rows the person cannot see yet. An implementation that derives the set from `renderRows()` `isContextRow` flags passes B but returns an empty set here. Only `c1` is contributed and `r1` is not, so the later reveal step (which opens context rows) still leaves `c1` hidden behind a closed `r1`. The test does not depend on reveal's default.
- Order reason: builds on B, since it uses the same source wiring.

## Types phase (written in red, proven by green's typecheck)

- `expectTypeOf(store.tree.contextRowIds).toEqualTypeOf<Signal<ReadonlySet<RowId>>>()` — pins the new public `TreeSlice` member as a read-only `Signal`, not `WritableSignal` and not a bare method. Add it to the existing `withTree() alone` case in the spec's in-file `describe('types')`.

## Not tested

- No contributor → empty set, and reactivity to a changed contribution — step 2's seams A and B pin both on `ctx.contextRows()`, which this member reads unchanged.
- That `contextRowIds()` equals the rows flagged `isContextRow` — `with-filtering/feature.spec.ts:604` pins the same scenario's flags.
- Union of several `contextRows` contributors — engine/compose (step 2, and `compose-features.spec.ts` case 26).
- Which rows `withFiltering()` retains as context — `with-filtering/feature.spec.ts` `tree retention (#168)`.
- Collapse-only `withTree()` plus filtering giving an empty set — filtering's behaviour.
- `isContextRow` stamping in core — `core.spec.ts` `isContextRow stamp`.
- Identity or referential stability of the returned set — no consumer contract depends on it.

## Open questions

- None. Resolved in review: type checks stay in the in-file `describe('types')`; empty-set identity is left to green.
