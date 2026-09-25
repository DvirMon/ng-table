# Step 8 — Cross-domain types-spec

**PR scope:** standalone. **Depends on:** Step 1, Step 4, Step 5.
**Parallel-safe with:** Step 7.

**Task type:** test

**Skills used:** unit-test

**Scaffolding agent:** test-implementer

## Files

- `libs/table/src/engine/resolvers.types.spec.ts` (new)

## Why This Step Exists

Two acceptance criteria are inherently cross-domain, not owned by any
one feature's spec file: (1) the two-tier arity rule itself —
`criterionOf`/`stateOf` reject a second argument, `valueOf` requires
one; (2) `criterionOf(path.total)` and `valueOf(path.total, row)` must
have *different* return types for a non-`equals` rule (`inRange`), per
ADR-0027's own worked example (`{ min, max }` vs `number`). Neither fact
belongs to filtering, sorting, or grouping alone — each is a statement
about the relationship between two registers — so it gets its own file
rather than being duplicated into (or borrowed by) any one domain's own
types-spec ([[spec-files-assert-own-domain-only]]: this file's ownership
is the *resolver mechanism itself*, not any one feature).

## What To Do

Using `expectTypeOf`/`@ts-expect-error` (this repo's existing
`*.types.spec.ts` convention — copy the setup from
`with-sorting/feature.types.spec.ts` or
`with-filtering/feature.types.spec.ts`):

1. **Arity rejection:** construct a minimal `FilterValueOfContext<Row>`
   and `ColumnRuleContext<Row>` (or reuse fixtures from `table.mock.ts`)
   and assert `// @ts-expect-error` on `ctx.criterionOf(path.total,
   row)` (a second argument) and `ctx.stateOf(path.total, row)` (a
   second argument) — both must fail to compile.
2. **Arity requirement:** assert `// @ts-expect-error` on
   `ctx.valueOf(path.total)` (a bound, 0-subject call) from Step 1's
   `ValueOfContext<Row>` — it must fail to compile without a `row`.
3. **Distinct return types:** using an `inRange` filter rule on
   `path.total` and a grouping/sorting `valueOf` resolver on the same
   `path.total`, assert
   `expectTypeOf(ctx.criterionOf(path.total)).toEqualTypeOf<{ min:
   number; max: number } | undefined>()` (or whatever `inRange`'s actual
   criterion shape is — check `with-filtering/matchers.ts`'s `inRange`
   for its exact type) against
   `expectTypeOf(ctx.valueOf(path.total, row)).toEqualTypeOf<number>()`
   — the two must not be the same type.

## Implementation Notes

- `*.types.spec.ts` files hold compile-time assertions only — the
  runner executes them without checking types; only
  `nx run shared-table:typecheck-spec` enforces the assertions
  (`libs/table/CLAUDE.md`'s Typechecking section). Don't add a
  `describe`/`it` expecting runtime failure — these are
  `expectTypeOf`/`@ts-expect-error` only.
- Check `with-filtering/matchers.ts` for `inRange`'s exact declared
  criterion shape before writing the `expectTypeOf` assertion — don't
  guess `{ min, max }`'s exact optionality.

## Risks / Watchouts

- This file directly proves the two-tier rule ADR-0027 documents — if
  any assertion here needs a `@ts-expect-error` *removed* to compile,
  that's a sign a Step 1–5 signature is wrong, not that this spec should
  be loosened.

## Non-Goals

- No runtime behavior test here — Step 7 owns those.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck-spec` clean.
- [ ] Every `@ts-expect-error` in this file is load-bearing (removing
      the widened signature it guards makes the file fail to compile).

---
← [Step 7: Runtime specs](step-7-runtime-specs.plan.md) | [Step 9: Docs and migration](step-9-docs-and-migration.plan.md) →
