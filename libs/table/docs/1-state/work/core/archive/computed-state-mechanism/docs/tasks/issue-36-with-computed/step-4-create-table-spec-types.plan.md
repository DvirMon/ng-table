---
title: "Step 4 — create-table.spec.ts: withComputed type assertions, both placements, not-any, trap 3"
type: task-step
issue: 70
---

# Step 4 — `create-table.spec.ts`: `withComputed` type assertions, both placements, not-`any`, trap 3

**PR scope:** The public factory's type seam (spec "Testing Decisions", second seam) — the
same file #35 Step 6 wrote; this step adds the `withComputed` cases and resolves the trap-3
`it.todo` left there.

**Task type:** test

**Skills used:** unit-test, typescript-conventions

**Depends on:** Step 2
**Parallel-safe with:** Step 3

**Scaffolding agent:** test-implementer

## Files

- `libs/shared/table/src/api/create-table.spec.ts` (edit — type `describe` block)

## Why This Step Exists

Issue AC: "Runtime + `expectTypeOf` specs in the factory spec cover both placements and the
composed store not being `any`". The payload of `withComputed` is type-level — a wrong
`ReadonlyStore`, an intersection return, or a wildcard in a constraint slot all degrade
silently to `any` at the call site (research §"Three silent-failure traps"). These are the
regression assertions.

## What To Do

Reuse #35 Step 6's fixtures (`Invoice`, synthetic `fA`/`fB` via `createTableFeature`). Add,
inside the existing type `describe` (comment at its top already states that only
`tsc -p libs/shared/table/tsconfig.spec.json --noEmit` enforces these):

1. **Own slot, typed.** `createTable(data, cfg, fA(), withComputed((s) => ({ n: computed(() => s.a()) })))`
   — `expectTypeOf(table.n).toEqualTypeOf<Signal<number>>()`.
2. **Not `any`.** Same table: `expectTypeOf(table).not.toBeAny()`;
   `expectTypeOf<keyof typeof table>().toEqualTypeOf<'a' | 'n' | keyof TableStore<Invoice>>()`.
3. **Block parameter is `ReadonlyStore`.** Inside the block:
   `expectTypeOf(s.value).toEqualTypeOf<Signal<Invoice[]>>()` and
   `// @ts-expect-error` on `s.value.update(...)`; `expectTypeOf(s.rows).toEqualTypeOf<Signal<Invoice[]>>()`.
4. **Uncomposed member absent.** Block placed *before* `fB()`: `// @ts-expect-error` on
   `s.b` inside the block.
5. **Following slot sees the contribution.** A synthetic feature after the block declared as
   `createTableFeature((input) => ...)` reads `input.n` — `expectTypeOf(input.n).toEqualTypeOf<Signal<number>>()`.
6. **Trailing placement.** `createTableFeature(fAFactory, withComputed((s) => ({ twice: computed(() => s.a() * 2) })))`
   — inside the block `expectTypeOf(s.a).toEqualTypeOf<Signal<number>>()`; composed
   `table.twice` is `Signal<number>`; the feature's return type is
   `Feature<TableStore<Invoice>, { a: Signal<number> } & { twice: Signal<number> }>` (assert with
   `toMatchTypeOf` if intersection ordering flakes `toEqualTypeOf`).
7. **Trap 3 regression** — replace #35 Step 6's `it.todo`:
   `expectTypeOf(withComputed<TableStore<Invoice>, { n: Signal<number> }>(fn)).toEqualTypeOf<Feature<TableStore<Invoice>, { n: Signal<number> }>>()`
   plus case 2's `not.toBeAny()` as the umbrella.
8. **Two blocks, slot order.** Slot-2 block reads slot-1 block's member typed; a slot-1 block
   reading a slot-2 member is `// @ts-expect-error`.
9. **Block sees `renderRows` and `totalRowCount`** on its parameter (architecture "Runtime —
   the fold", step 2 ordering fix): `expectTypeOf(s.renderRows)` / `expectTypeOf(s.totalRowCount)`
   are signals.

## Implementation Notes

- `@ts-expect-error` must sit on the line immediately above the offending expression;
  multi-line calls put it above the argument line that errs.
- Type cases run in a real `it()` body so vitest counts them, but the assertions are
  compile-time; state the `tsc` command in the PR as the verification step (same note as #35
  Step 6).
- Do not import shipped `with-*` features — still unconverted; #43 covers real features.

## Risks / Watchouts

- If case 2's `keyof` equality fails with an index signature present, trap #3 has leaked from
  `createTableFeature` (#35 Step 5's `NormalizeDerived`) — fix there, not here.
- If case 1 reports `Signal<any>`, the wildcard trap (#2) has entered a constraint slot — check
  `Feature<In, Out>`'s use in the generated overloads before touching `withComputed`.

## Non-Goals

- No runtime cases (Step 3). No `composeFeatures` cases (#37).

## Acceptance Checks

- [ ] `tsc -p libs/shared/table/tsconfig.spec.json --noEmit` passes for `create-table.spec.ts`
      (other red files acknowledged in the PR).
- [ ] #35 Step 6's trap-3 `it.todo` is gone, replaced by case 7.
- [ ] Deleting `ReadonlyStore`'s mapped-type body (making it identity) fails case 3;
      restoring it passes.

---
← [Step 3: with-computed.spec.ts — runtime](step-3-with-computed-spec-runtime.plan.md)
