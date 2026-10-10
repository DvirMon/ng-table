# Step 1 test plan — release() on the expansion slice

Step: [step-1-release-method.plan.md](step-1-release-method.plan.md)
Spec file: `libs/table/src/api/features/with-expansion.spec.ts`

Layout: add a new `describe('release()', …)` block after
`describe('multi: false (single-open)')` and before
`describe('types')`. Build every table the way the file's
existing tests do: `inContext(() => createTable(signal<Row[]>(makeRows()),
{ trackBy: 'id', columns: makeColumns() }, withExpansion()))`.
A local `makeStore()` / `collect()` pair, like the one in the
`multi: false` block, is fine. Fixture rows: `r1`, `r2`, `r3`.

## Stubs (red phase)

- `ExpansionSlice.release(ids?: readonly RowId[]): void` — a new
  interface member in
  `libs/table/src/api/features/with-expansion.ts`.
- `function release(ids?: readonly RowId[]): void` inside
  `buildExpansionSpec`, added to the `Object.assign(…)` member
  object next to `set`. It throws `not implemented: release`.

## Seams — in red-green order

### A. release([closedId]) → the id leaves everExpanded()

- Test: `it('release([id]) on a closed id removes it from everExpanded')`
- Asserts: after `toggle('r1')` twice (opened, then closed),
  `release(['r1'])` → `everExpanded().has('r1')` is `false`.
- Why this seam: the base removal path. It catches a release()
  that does nothing, or that reads the wrong set.
- Order reason: independent — base case.

### B. release([openId]) → the id stays in everExpanded()

- Test: `it('release([id]) on an open id leaves it in everExpanded')`
- Asserts: after `toggle('r1')` (open), `release(['r1'])` →
  `everExpanded().has('r1')` is `true` and `expansion().has('r1')`
  is `true`.
- Why this seam: the open-id skip that keeps
  `open ⊆ everExpanded` (D1). Without it, a gate on
  `everExpanded().has(id)` unmounts an open panel.
- Order reason: builds on A. The removal must exist before the
  guard that limits it.

### C. release() with no ids → every closed id goes, open ids stay

- Test: `it('release() with no ids removes every closed id and keeps the open ones')`
- Asserts: `expand(['r1','r2','r3'])`, then `collapse(['r1','r3'])`,
  then `release()` → `[...everExpanded()]` equals `['r2']`.
- Why this seam: the default candidates when `ids` is omitted
  (all of everExpanded). It catches an omitted argument that is
  treated as a no-op or as "clear everything".
- Order reason: builds on A (removal) and B (the open skip),
  then adds the omitted-ids branch.

### D. release never writes the open set and never emits on changed

- Test: `it('release() and release([id]) leave expansion() unchanged and emit nothing on changed')`
- Asserts: use the same setup as C (`r2` open; `r1`, `r3` closed
  but already seen). Subscribe to `changed`. Call
  `release(['r1'])`, then `release()`. Then `[...expansion()]`
  equals `['r2']` and the collected emissions equal `[]`.
- Why this seam: catches a release() built on
  `store.setExpanded`/`collapse`. That would close panels or emit
  on `changed`, both of which D1/D2 forbid. The calls really
  remove ids, so the test is not a no-op that passes vacuously.
- Order reason: builds on C (same setup, and the removals must
  already work).

### E. release([]) → no-op, same everExpanded() reference

- Test: `it('release([]) is a no-op and keeps the everExpanded reference')`
- Asserts: `r1` opened then closed, so it is closed and in the
  ledger. Take `before = everExpanded()`. After `release([])`:
  `everExpanded()` is `toBe(before)`, and `before.has('r1')` is
  `true`.
- Why this seam: catches an empty array falling through to the
  omitted-ids branch (for example a `ids?.length ? ids : all`
  check). That would wrongly free `r1`. Only an omitted argument
  means "all" (D2), matching `collapse()`.
- Order reason: builds on C. It sets the empty-array guard
  against the omitted-ids branch.

### F. Unknown or already-released ids → no throw, same reference

- Test: `it('unknown and already-released ids are ignored without throwing and keep the everExpanded reference')`
- Asserts: `r1` opened, closed, then `release(['r1'])`. Take
  `before = everExpanded()`. Then
  `expect(() => release(['r1', 'missing'])).not.toThrow()`, and
  `everExpanded()` is `toBe(before)`.
- Why this seam: catches two bugs. (1) A throw on a stale id,
  which is runtime data, not a wiring error (ADR-0014).
  (2) An unconditional write of a new `Set` when nothing was
  removed, which would make every reader re-run for nothing.
- Order reason: builds on A (needs an already-released id).

### G. A release that removes ids notifies everExpanded() readers

- Test: `it('a release that removes ids notifies computed readers of everExpanded')`
- Asserts: `r1` opened then closed. Create
  `const hasR1 = computed(() => store.expansion.everExpanded().has('r1'))`
  and read it once (`true`). After `release(['r1'])`, `hasR1()` is
  `false`.
- Why this seam: catches removal by mutating the `Set` in place
  and then setting the same reference back. Seam A cannot see
  this bug, because it reads the mutated `Set` directly. The
  signal's `Object.is` check would hold back the notification,
  and a consumer's `computed`/gate would stay stale. This is the
  copy-on-write rule from D2.
- Order reason: builds on A.

### H. A released id that is opened again is back in everExpanded()

- Test: `it('a released id that is opened again is back in everExpanded')`
- Asserts: `r1` opened, closed, then `release(['r1'])`. After
  `toggle('r1')`, `everExpanded().has('r1')` is `true`.
- Why this seam: catches a release built as a separate
  "released" tombstone set, or a write that cuts off the
  `onExpanded` accumulator. Re-adding must go through the
  existing hook (D5) with no special handling.
- Order reason: builds on A.

## Types phase (written in red, proven by green's typecheck)

- `expectTypeOf(store.expansion.release).toEqualTypeOf<(ids?: readonly RowId[]) => void>()`
  — pins that `ids` is optional, that it is a `readonly RowId[]`,
  that there is no options parameter, and that the return type is
  `void`. Reading it off the store from `createTable` also proves
  the member reaches the composed table, not just the interface.
  Add it as a new `it('ExpansionSlice carries release(ids?: readonly RowId[]): void')`
  inside the existing `describe('types')` block (lines ~704-794),
  as the outline says. It does not go in a separate
  `*.types.spec.ts`. Only `nx run shared-table:typecheck-spec`
  checks it; vitest does not.

## Not tested

- everExpanded accumulation, survival across collapse,
  seeding from `initial`, and row removal not pruning it. The
  existing cases already cover these (lines ~304-391, 567-610),
  and a second copy would fail on the same bug.
- `set()` restore re-adding restored-open ids. It uses the same
  `onExpanded` hook as H, so it fails on the same bug as H.
  One seam.
- Calling release() in `multi: false` mode. release() never
  reads `multi` and never writes the open set (D proves the
  second part), so there is no logic branch to test.
- A release during `animate.leave`, or panel unmounting. That is
  consumer markup and directive rendering, not library logic
  (the skip list's "the framework itself"; the spec says no
  directive test).
- The `index.ts` surface. There is no change, so there is no
  logic to test (a simple passthrough).
- No options parameter. The types phase pins the exact
  signature, so a runtime test would add nothing.
- Leaving the shared `createExpansionStore()` unchanged. That is
  structural, not behaviour, and D already shows the open set
  and `changed` are untouched.
