---
title: "Step 4 — create-table.spec.ts: type assertions for composite slots, nesting, arity escape, not-any"
type: task-step
issue: 71
---

# Step 4 — `create-table.spec.ts`: type assertions for composite slots, nesting, arity escape, not-any

**PR scope:** New cases inside the existing `describe('types')` block of the public
factory's spec (spec "Testing Decisions": the type seam lives alongside the runtime one).
Enforced only by `tsc -p tsconfig.spec.json`; vitest does not typecheck `expectTypeOf`.

**Task type:** test

**Skills used:** unit-test, typescript-conventions

**Depends on:** Step 2
**Parallel-safe with:** Step 3

**Scaffolding agent:** test-implementer

## Files

- `libs/shared/table/src/api/create-table.spec.ts` (edit — cases 35–41 in `describe('types')`)

## Why This Step Exists

Issue AC 2, 4, 5 and the spec's "composed store is not `any`" regression are type-level
payload: a following slot typed against the composite's full contribution, nested
composites, and the arity escape hatch compiling. The three silent-`any` traps
(`2-research.md`) can regress through a new public generic just as easily as through the
existing ones.

## What To Do

Reuse the block's existing fixtures (`Invoice`, `withA`, `withB`, `withMatchFlag`,
`invoiceColumns`, the case 22 inert-feature factory). Continue numbering after case 34.
Import `composeFeatures` from `./features/compose-features`.

35. **A following slot sees the composite's full contribution** —
    `createTable(data, cfg, composeFeatures(withA(), withB()), createTableFeature((input) => { … }))`;
    inside the last factory `expectTypeOf(input.a).toEqualTypeOf<Signal<number>>()` and
    `expectTypeOf(input.b).toEqualTypeOf<() => void>()`; on the table
    `expectTypeOf<keyof typeof table>().toEqualTypeOf<'a' | 'b' | keyof TableStore<Invoice>>()`.
36. **Inner sees earlier inner and the slot before the composite** —
    `createTable(data, cfg, withA(), composeFeatures(withB(), createTableFeature((input) => …)))`;
    the inner factory sees `input.a` and `input.b` typed. `withB` already reads `a` — its
    declared `In` must be satisfied by the composite's accumulated input, which is the
    compile check itself.
37. **Nested composite** — `composeFeatures(withA(), composeFeatures(withB(), withC()))`
    where `withC` is a new fixture contributing `c: Signal<boolean>` and typed against
    `TableStore<Invoice> & { a … } & { b … }`; a following slot and the table see `a`, `b`,
    `c`.
38. **Arity escape hatch** — (a) `composeFeatures(inert × 15)` in slot 1 compiles;
    (b) `composeFeatures(composeFeatures(inert × 15), withA())` in one slot compiles and the
    table has `a` — 16 features in one slot; (c) a 16th direct inner argument is
    `// @ts-expect-error` (mirrors case 22).
39. **Not `any`** — for the case 35 table: `expectTypeOf(table).not.toBeAny()`;
    `expectTypeOf(table.a).not.toBeAny()`.
40. **Standalone composite passed as a slot** —
    `const withStandard = composeFeatures(withA(), withB());` declared outside the call,
    then `createTable(data, cfg, withStandard, createTableFeature((input) => …))`; the
    following slot sees `a` and `b`. Add a second assertion pinning the known limitation:
    `composeFeatures(withMatchFlag((row) => …))` declared standalone gives
    `expectTypeOf(row).toEqualTypeOf<unknown>()` (no contextual `In`, so `RowOf<Shape>`),
    whereas the same call inline in a slot gives `Invoice`. If `tsc` reports the standalone
    row as something other than `unknown`, keep whichever assertion is true and record the
    result in `progress.md` for #44.
41. **Trap 3 regression: one `Feature`, not an intersection** —
    `expectTypeOf(composeFeatures(withA(), withB())).toEqualTypeOf<Feature<TableStore<Invoice>, { a: Signal<number> } & { b(): void }>>()`.

## Implementation Notes

- Every `createTable(...)` in these cases runs inside `TestBed.runInInjectionContext` like
  `composeInvoiceTable()` does — the runtime executes them even though only the types matter.
- Case 38(b) needs no runtime assertion; the inert factory contributes nothing.
- Keep each case to one `it` and one idea; the case comments in this block already explain
  the traps — link to them rather than restating.

## Risks / Watchouts

- Case 22's inert factory returns `createTableFeature(() => ({}))` typed `Feature<…, {}>`;
  15 of them intersect to `{}` — fine, but do not switch to `object` (case 23 guards this).
- If `expectTypeOf(...).toEqualTypeOf<Feature<…>>()` fails on `displayName` optionality,
  compare with `toMatchTypeOf` and assert the return is not an intersection via `keyof`.

## Non-Goals

- No runtime assertions (Step 3). No shipped-feature type cases (#43).

## Acceptance Checks

- [ ] Cases 35–41 present under `describe('types')`.
- [ ] `npx tsc -p libs/shared/table/tsconfig.spec.json --noEmit` passes, and removing the
      `@ts-expect-error` in 38(c) makes it fail.
- [ ] Case 40's standalone-row result recorded in `progress.md`.

---
← [Step 3: compose-features.spec.ts — runtime](step-3-compose-features-spec-runtime.plan.md)
