# Step 6 — `create-filters.spec.ts`

**PR scope:** PR 2 of 2 (`#111`). **Parallel-safe with: Steps 1, 2, 3, 4, 5, 7, 8.** **Blocks Step 9.**
**Task type:** `test`
**Stack:** angular
**Skills used:** `unit-test`, `typescript-conventions`
**Scaffolding agent:** `test-implementer`

## Files

| File | Action |
|---|---|
| `libs/shared/table/src/filters/create-filters.spec.ts` | edit — one helper, ~40 schemas, three spec-local types delete |

655 lines, roughly 40 `build<…>(…)` calls. The largest diff in the issue and the one reviewed by
inspection rather than by reading the patch.

## Why This Step Exists

This is the runtime seam for the whole filters domain. It does not compile against `#110`'s
signature, so **the library's test suite cannot run at all** until this file is rewritten — not
just these tests, the suite.

The rewrite is mechanical by design. **Every schema changes shape; no assertion changes.** A case
that needs its *assertion* edited is a semantic regression in `#110`, not an accommodation to make
here — stop and check it against
[`design-options-hybrid-api.md`](../../../with-filtering/design-options-hybrid-api.md).

## What To Do

1. **Rewrite the `build` helper first** — every other change follows from it:

   ```ts
   function build<S extends readonly unknown[]>(schema: (path: FiltersPath<Invoice>) => S) {
     return TestBed.runInInjectionContext(() => createFilters(rowOf<Invoice>(), schema));
   }
   ```

   `rowOf<Invoice>()`, not `[]` — the spec declares filters over a row type with no data, which is
   the token's case. An untyped `[]` is what `#110`'s guard rejects.

2. **Drop every explicit type argument at the ~40 call sites.** `build<InvoiceFilterState>(…)`,
   `build<{ status: string | null }>(…)` and the rest become bare `build((path) => [ … ])`. The
   inline object literals were the previous `TState`; the array now states the same thing.

3. **Every schema body returns an array.** Statement bodies become returned elements:

   ```ts
   const filters = build((path) => [
     equals(path.status),
     inRange(path.amount),
     inDateRange(path.dueDate),
     anyOf('search', [contains(path.customer), contains(path.notes)]),
     hasAny(path.tags),
   ]);
   ```

4. **`anyOf` loses its type argument and its callback** at every site (lines ~71, ~111, ~352, ~589).
   Children come from the outer `path`.

5. **`applyWhen` takes an array and is placed directly in the schema array** — never spread
   (`...applyWhen(…)` is a `TS2488`; a node is not iterable):

   ```ts
   const filters = build((path) => [
     equals(path.category),
     applyWhen(path, ({ valueOf }) => valueOf(path.category) !== null, [equals(path.subCategory)]),
   ]);
   ```

   Three sites: ~486, ~501, ~619.

6. **"anyOf without rules" (~163) becomes a compile error plus a runtime backstop.** `anyOf('k', [])`
   no longer typechecks, which is `#110`'s intent. Keep the runtime assertion — it covers the
   untyped caller the backstop exists for — behind `@ts-expect-error`, with a comment saying the
   type-level rejection is asserted in `#112`'s types spec.

7. **Delete the three spec-local criterion maps**: `InvoiceFilterState` (~35, with its
   `type`-not-`interface` comment — the constraint it explains is gone), `BrokenFilterState` (~518)
   and `TypedInvoiceFilterState` (~694). `buildBrokenFilters()` drops its
   `Filters<Invoice, BrokenFilterState>` return annotation and lets it infer.

8. **Leave `describe('types')` (~685) where it is**, schemas rewritten like every other block.
   `architecture.md` assigns the move to `create-filters.types.spec.ts` — that is `#112`, and
   keeping the block here means `#111` lands green and `#112` is a pure move rather than a move
   plus a rewrite. `expectTypeOf(filters().value()).toEqualTypeOf<TypedInvoiceFilterState>()`
   becomes an assertion against an inline literal, since the alias is deleted.

## Implementation Notes

- The seven emptiness/source/null-cell blocks (~229–413) change only their schema shape. Their
  expected values (`null`, `''`, `{ min: null, max: null }`, `[]`) come from the rules' own
  defaults, which `#110` did not touch.
- `filter(path.tags, (cell, criterion: readonly string[]) => …)` at ~277 relies on the predicate
  annotation to type the criterion. That is now the *only* channel; do not add a type argument.
- The duplicate-path (~120) and duplicate-key (~144) throws are unchanged behaviour — only their
  schema bodies change to returned arrays.
- `Filters` is still imported for `buildBrokenFilters`' old annotation; if that annotation goes and
  nothing else uses the import, drop it.

## Risks / Watchouts

- **A schema that returns nothing still compiles.** `(path) => { equals(path.status); }` is a valid
  `() => void`, and the array constraint is `readonly unknown[]` — `#110` catches it with a runtime
  throw, not a type error. A block left half-converted therefore fails as a thrown error at test
  time, not as a red squiggle. Convert whole `describe` blocks, not individual lines.
- **`StateOf<S>` folding to `{}` compiles.** Annotating the schema callback's return type is what
  causes it. Never annotate; let `S` infer.
- **`anyOf` homogeneity.** `#110` checks children against `CriterionOf<C[0]>`. The groups here pair
  `contains` with `contains`, so they are homogeneous — but if a conversion accidentally mixes a
  range child in, the error points at the group, not at the child.
- Vitest reports a compile failure in this file as a suite-level error. A partial conversion looks
  like "everything is broken", which is not diagnostic. Convert, then run.

## Non-Goals

- Creating `create-filters.types.spec.ts` — `#112`.
- Moving `describe('types')` out of this file — `#112`.
- `state.spec.ts` (Step 7), `with-filtering.spec.ts` (Step 8).
- Adding a filters case to any cross-feature spec. `selection.utils.spec.ts` and
  `with-grouping.spec.ts` stopped building filter schemas when the decoupling landed; a filters
  fact asserted there is coupling, not coverage.

## Acceptance Checks

- [ ] `build` passes `rowOf<Invoice>()` and takes `S extends readonly unknown[]`
- [ ] No call site names a type argument on `build` or on `createFilters`
- [ ] No schema body calls a rule as a statement — grep for `);\n` inside a schema and confirm each
      is an array element
- [ ] No `anyOf` takes a callback; no `applyWhen` is spread
- [ ] `InvoiceFilterState`, `BrokenFilterState`, `TypedInvoiceFilterState` are all gone
- [ ] `describe('types')` is still in this file
- [ ] **Every assertion is byte-identical to `HEAD`.** A changed expectation is a regression to
      raise, not a fix to make
- [ ] `npx tsc -p libs/shared/table/tsconfig.spec.json --noEmit` reports no error in this file
- [ ] `nx test shared-table -- create-filters` passes

---
← [Step 5: The grouping fixtures](step-5-grouping-fixtures.plan.md) | [Step 7: `state.spec.ts`](step-7-state-spec.plan.md) →
