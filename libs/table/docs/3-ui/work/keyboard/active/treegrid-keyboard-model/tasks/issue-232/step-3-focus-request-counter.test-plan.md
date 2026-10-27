# Step 3 test plan — Focus request counter

Step: [step-3-focus-request-counter.plan.md](step-3-focus-request-counter.plan.md)
Spec file: `libs/table/src/api/create-table.spec.ts` — inside the `describe('focus')` block from steps 1–2.

## Stubs (red phase)

- `readonly focusRequests: Signal<number>` on `TableFocus` in `api/types.ts`.
- In `createBaseStore`, attach `focusRequests` to the `Object.assign(computed(read), { moveTo, focusRequests })` object as `() => { throw new Error('not implemented: focusRequests') }` — callable so the type checks. `moveTo` keeps its step-2 body.

Fixtures: `makeStore(makeColumns(), [row])`.

- Accepted target: `{ area: 'header', columnId: 'name' }` — always rendered.
- Rejected target: `{ area: 'body', rowId: 'missing', columnId: 'name' }`; spy `console.error` stubbed to a no-op.

## Seams — in red-green order

### A. Accepted write with `{ focusElement: true }` → 0 → 1

- Test: `it('increments focusRequests on an accepted moveTo with focusElement: true')`
- Asserts: `focusRequests()` is `0` before, `1` after `moveTo(header, { focusElement: true })`.
- Why this seam: base path; catches a counter never written and a missing `0` seed.
- Order reason: independent.

### B. Two identical requests → two increments

- Test: `it('counts repeated identical focusElement requests separately')`
- Asserts: two `moveTo(header, { focusElement: true })` → `2`.
- Why this seam: catches a one-shot flag, `set(1)`/`set(true)`, and a write gated on "the position changed".
- Order reason: builds on A.

### C. Write without `focusElement: true` → no increment (it.each)

- Test: `it.each(...)('does not increment focusRequests on %s')` over: no options; `{ focusElement: false }`.
- Asserts: `focusRequests()` stays `0`; `focus()` still updates (write accepted).
- Why this seam: catches incrementing on every accepted write, a default-true reading (`!== false`), and a guard on options presence instead of `=== true`.
- Order reason: builds on A.

### D. Rejected write with `{ focusElement: true }` → no increment

- Test: `it('does not increment focusRequests when moveTo rejects the target')`
- Asserts: `moveTo(rejected, { focusElement: true })` → `focusRequests()` stays `0`, `focus()` stays `null`.
- Why this seam: catches incrementing before step 2's `findUnrenderedId` check or on the reject branch; the directive (#235) would try to focus an element that doesn't exist.
- Order reason: builds on A and step 2's reject path.

### E. A `computed` over `focusRequests` recomputes after a request

- Test: `it('exposes focusRequests as a reactive signal')`
- Asserts: `const seen = computed(() => table.focus.focusRequests())`; `0`, then `1` after a request.
- Why this seam: catches a plain closure counter returned by a function — untracked, so the #235 effect would never re-run.
- Order reason: builds on A.

### F. Two tables keep separate counters

- Test: `it('keeps a separate focusRequests counter per table')`
- Asserts: request on the first → first `1`, second `0`.
- Why this seam: catches `signal(0)` at module level instead of inside `createBaseStore`.
- Order reason: builds on A.

## Types phase (after green)

In `libs/table/src/api/create-table.types.spec.ts`:

- `expectTypeOf(table.focus.focusRequests).toEqualTypeOf<Signal<number>>()` — strict, so a `WritableSignal` declaration fails. Pins the declaration only; the runtime still exposes it read-only.

## Not tested

- Starting `0` on its own: asserted as A's "before" read.
- "Never reset": nothing to call; a test can't fail.
- Runtime absence of `.set`: reachable only via a cast; the types phase pins the declaration.
- `console.error` on a rejected write: step 2 owns it.
- DOM focus after render: #235.
- JSDoc text.
