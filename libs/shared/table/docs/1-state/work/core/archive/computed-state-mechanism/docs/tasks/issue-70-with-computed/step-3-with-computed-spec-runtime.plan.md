---
title: "Step 3 — with-computed.spec.ts: runtime behaviour in both placements, construction errors, evaluation reporting"
type: task-step
issue: 70
---

# Step 3 — `with-computed.spec.ts`: runtime behaviour in both placements, construction errors, evaluation reporting

**PR scope:** The feature-level spec, colocated with `with-computed.ts` (spec "Testing
Decisions": feature-level specs stay one per feature). Runtime only — type assertions are
Step 4.

**Task type:** test

**Skills used:** unit-test, typescript-conventions

**Depends on:** Step 2
**Parallel-safe with:** Step 4

**Scaffolding agent:** test-implementer

## Files

- `libs/shared/table/src/api/features/with-computed.spec.ts` (new)

## Why This Step Exists

Issue ACs 2–4 and 6–9 are observable only through a composed store. The spec asserts what a
consumer observes — members exposed, values as data changes, errors thrown at construction,
the report on evaluation — never how many times a factory ran or what the registry holds.

## What To Do

Fixtures, in the spec file (test-only shapes, not `*.mock.ts`): `MockRow`/`mockRows` from
`table.mock.ts`; `makeStore(...features)` wrapping `TestBed.runInInjectionContext(() =>
createTable(dataSignal, { trackBy: mockTrackBy, columns }, ...features))`; two synthetic
features via `createTableFeature()` — `fA()` contributing `a: Signal<number>` (e.g.
`computed(() => input.rows().length * 10)`) and `fB()` contributing `b: Signal<string>`.
Shipped `with-*` features are **not** used (unconverted until #72–#74).

### Placement — own slot

1. `createTable(data, cfg, withComputed((s) => ({ n: computed(() => s.rows().length) })))` —
   `table.n()` equals the row count.
2. After `fA()`: block reads `s.a()`; `table.n()` reflects it.
3. A following synthetic feature reads `input.n` from the store it is handed at factory time —
   defined (a later slot sees the block's contribution).
4. Recompute only on input change: `data.set([...])` → `table.n()` updates; reading twice
   without a change returns the same value (assert via a counter inside the consumer's
   `computed` — the consumer's own node, not the wrapper — incremented once per data change).

### Placement — trailing argument

5. `createTableFeature(fAFactory, withComputed((s) => ({ twice: computed(() => s.a() * 2) })))`
   composed — `table.a()` and `table.twice()` both present, `twice` = `a * 2`; the block
   observed `a` at construction (record `s.a()` inside the block into a spy).

### Construction errors

6. Core key: block returns `{ rows: signal([]) }` → throws; message contains
   `feature 1 (withComputed)` and `"rows"`.
7. Earlier feature: `fA()` then `withComputed(() => ({ a: signal(0) }))` → throws naming
   `feature 1` and `feature 2 (withComputed)`.
8. Two blocks: same key in slot 1 and slot 2 → throws naming both positions with
   `(withComputed)`.
9. Non-signal: `withComputed(() => ({ n: 42 }))` (cast the block through `unknown` in the
   test only, to defeat the type) → throws naming `"n"`.
10. Block throws: `withComputed(() => { throw new Error('boom') })` → throws an `Error`
    whose message names `withComputed` and whose `cause.message` is `'boom'`.

### Evaluation errors (ADR-0014 / D9)

11. Block returns `bad: computed(() => { if (data().length > 1) throw new Error('eval'); return 1; })`
    plus `ok: computed(() => 1)`. With one row, `table.bad()` is `1`. Set two rows:
    - `vi.spyOn(console, 'error')`; `expect(() => table.bad()).toThrow('eval')`; spy called
      once with a first argument containing `derived member "bad"`.
    - Read `table.bad()` again with no change: still throws, spy **still once** (cached).
    - `table.ok()` and `table.rows()` still read fine.
    - Set three rows (dependency changed): throws again, spy now called twice.

### Persistence

12. `it.todo('derived members are excluded from a persistence snapshot — assert once state-persistence.md owns a slice (#78)')`.

## Implementation Notes

- `console.error` spy: restore in `afterEach` (`vi.restoreAllMocks()`); the message argument
  is asserted with `expect.stringContaining`.
- Case 4's counter lives in the consumer's `computed`, so it proves the wrapper adds no
  extra evaluations of the consumer's body.
- Follow `with-selection.spec.ts` for `TestBed.runInInjectionContext` usage; `makeStore`
  takes rest features positionally — no `AnyTableFeature[]` array.
- Cases 6–8 assert on `toThrow(expect.stringContaining(...))` for each label fragment
  rather than the full sentence, so a later wording tweak in `SlotRegistry` does not break
  them.

## Risks / Watchouts

- `create-table.spec.ts` and every `with-*.spec.ts` may still be red inside #69/#70's
  integration window; run this file alone under the lib's `test` target.
- If Angular's `computed` error caching changes semantics in a future major, case 11's
  "still once" assertion is the canary — that is intended.

## Non-Goals

- No `expectTypeOf` here (Step 4). No real-feature composition (#77).

## Acceptance Checks

- [ ] Cases 1–11 pass under the lib `test` target for this file.
- [ ] Case 12 is a visible `it.todo`.
- [ ] No test asserts on `SlotRegistry` internals or fold call counts.

---
← [Step 2: with-computed.ts — withComputed()](step-2-with-computed.plan.md) | [Step 4: create-table.spec.ts — type assertions](step-4-create-table-spec-types.plan.md) →
