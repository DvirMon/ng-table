# Step 8 test plan — state() takes includeHidden

Step: [step-8-state-include-hidden.plan.md](step-8-state-include-hidden.plan.md)
Trimmed: seams A and B (both reads are contained in C, on one store).
Spec file: `libs/table/src/api/features/with-tree/feature.spec.ts`

## Stubs (red phase)

- `libs/table/src/api/features/with-tree/types.ts`: in `TreeSlice`, replace `readonly state: Signal<'all' | 'some' | 'none'>` with `state(options?: { includeHidden?: boolean }): 'all' | 'some' | 'none';`. Carry the existing JSDoc over, plus a line on the default scan (filtered view) and `includeHidden` (all of `data()`).
- `libs/table/src/api/features/with-tree/feature.ts`: replace the `state` computed with `function state(options?: { includeHidden?: boolean }): 'all' | 'some' | 'none'`. The body throws `not implemented: state`. It is still passed into the tree slice's `Object.assign`.
  - Side effect in red: the existing `state()` tests (the D5/E9 block, seam F, seam O) also fail on `not implemented`. This is expected. Green turns them back on as regression checks. Do not edit them.

## Seams — in red-green order

Shared fixture. Move the `dropsC1` pipeline-stage feature, which today sits inline in "parentOf and descendantsOf read data()…", up to file level so both describes can use it. It is a bare `stage(s.filter)` claimant, not `withFiltering()`, so the spec stays in its own domain. Use it with `makeFlatRows()` and `withTree({ parentId: (row) => row.parentId })`.

- Filtered view: r1 (child c2) is expandable. c1 was dropped, and g1 falls back to a root.
- `data()`: r1 and c1 are expandable.

The tests go in a new nested `describe('includeHidden (D8)')` inside `describe('state() (D5/E9)')`.

### C. Both variants read on one store, hidden variant first → each keeps its own answer

- Test: `it('the two variants do not share a result — reading includeHidden first does not change state()')`
- Asserts: after `toggle('r1')`, `state({ includeHidden: true })` is `'some'`, and then `state()` is `'all'`, on the same store.
- Why this seam: pins both variants at once — the filtered-view default (story 32: a closed parent the pipeline dropped does not count) and the hidden-inclusive scan (story 33). It catches a default that scans `input.value()`, an option ignored or read under the wrong key, and a single shared memo or a computed created lazily from the first call's options — each gives the wrong answer for one of the two reads.
- Order reason: independent. The base case.

### D. Opening a hidden parent → the includeHidden variant moves to 'all', the default does not change

- Test: `it('state({ includeHidden: true }) recomputes when a hidden row opens; state() is unaffected')`
- Asserts: after `toggle('r1')` and a read of both variants (`'some'` and `'all'`), then `toggle('c1')`: `state({ includeHidden: true })` is `'all'` and `state()` is still `'all'`.
- Why this seam: catches a stale hidden variant. Examples: a memo that is not a `computed`, or a computed that never reads `store.expanded()` or `input.value()`. The earlier read forces any memo to fill before the write. The outline requires the method to stay reactive.
- Order reason: builds on C.

## Types phase (written in red, proven by green's typecheck)

Placement: the spec's existing in-file `describe('types')` block (the tree domain keeps its type checks inline; no `*.types.spec.ts`). Build the store as that block does: `makeFlatRows()` + `withTree({ parentId })`.

- `expectTypeOf(store.tree.state).parameter(0).toEqualTypeOf<{ includeHidden?: boolean } | undefined>()` — pins the optional options bag. Catches a required parameter, a string-union `scope` instead of a boolean flag, or a lost optional modifier.
- `expectTypeOf(store.tree.state({ includeHidden: true })).toEqualTypeOf<'all' | 'some' | 'none'>()` — pins the return type through the composed store.
- `// @ts-expect-error` on `store.tree.state({ includeHidden: 'yes' })` — the flag is boolean only.
- The existing inline check (`expectTypeOf(store.tree.state()).toEqualTypeOf<...>()`) stays as it is.

## Not tested

- Memoization itself (two internal computeds). Internal detail; seams C and D cover the observable results of getting it wrong.
- `includeHidden` on a collapse-only instance, broken links, and the empty-denominator `'none'`. Both variants go through the same guard and silent parent link; existing default-variant tests already fail on a bug there.
- Default-variant reactivity to data changes. The existing test "recomputes when data changes…" covers it.
- Composition with a real `withFiltering()`. That is the filtering domain; `dropsC1` stands in for any pipeline drop.
- Reading `state()` inside a template. D proves the method reads signals, which is all a template needs.

## Open questions

- None. Resolved in review: options bag stays inline; type checks go in the in-file `describe('types')`.
