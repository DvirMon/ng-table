# Step 1 — Add the rule types and the `StateOf` fold

**PR scope:** PR 1 of 2 (`#110`). **Parallel-safe with: Step 2.** **Blocks Step 3, Step 4.**
**Task type:** `code`
**Stack:** angular
**Skills used:** `typescript-conventions`, `file-organization`
**Scaffolding agent:** `angular-implementer`

## Files

| File | Action |
|---|---|
| `libs/shared/table/src/filters/types.ts` | edit |

Nothing else. `rules.ts` and `create-filters.ts` still compile against the recorder at the end of
this step — they are Steps 3 and 4.

## Why This Step Exists

This is the type-level mechanism the whole issue rests on. Every other step in `#110` is a rewrite
of a runtime file to produce or consume the shapes declared here, so nothing else can start until
the shapes exist and compile.

It is additive on purpose. The recorder symbols stay until Step 5, so this step does not break a
single file in the library — the new surface lands beside the old one and the old one is deleted
once nothing references it.

## What To Do

1. **`FilterRule` — the inference channel.** A rule's static type must name both its key and its
   criterion, without the runtime record growing a field:

   ```ts
   export interface FilterRule<TKey extends string, TCriterion, TRow = unknown>
     extends FilterRuleRecord<TRow> {
     readonly __key?: TKey;
     readonly __criterion?: TCriterion;
   }
   ```

   The exact member names are an implementation choice; what is fixed is that both are carried
   statically and neither exists at runtime.

2. **`GroupRule` and `ConditionalRule`.** A group is a `FilterRule` whose `kind` is `'group'` and
   whose key is positional. A conditional is the nestable node Step 3's `applyWhen` returns — it
   carries its children in its own type so both the fold and Step 4's runtime flattener can recurse
   into it. It is not an array, and it must not be one.

3. **`AnyRule`.** The union the fold extracts against — whatever `Flatten` is allowed to resolve to
   a keyed entry.

4. **`CriterionOf`, `Flatten`, `StateOf`.**

   ```ts
   export type CriterionOf<R> = R extends FilterRule<string, infer C> ? C : never;

   export type StateOf<T extends readonly unknown[]> =
     { [R in Extract<Flatten<T>, AnyRule> as NonNullable<R['__key']>]: CriterionOf<R> };
   ```

   `Flatten` must see through **both** a nested array and a `ConditionalRule`'s children — that
   recursion is what makes `applyWhen(…)` and `...applyWhen(…)` fold to the same keys in Step 3.

5. **Brand `FiltersPath<never>`.**

   ```ts
   export type FiltersPath<TRow> = [TRow] extends [never]
     ? { readonly __rowTypeCouldNotBeInferred_useRowOf:
           'createFilters: the first argument is empty, so the row type is unknown. Pass rowOf<Row>() instead.' }
     : { readonly [K in Extract<keyof TRow, string>]: FilterHandle<TRow, K> };
   ```

   Guard the path, not the schema parameter. Guarding the parameter fires earlier but blames the
   schema rather than the empty carrier that caused it.

6. **Drop the criterion-map defaults.** `Filters<TRow, TState>` and `FiltersRoot<TRow, TState>` lose
   `= Record<string, unknown>`. The constraint `TState extends Record<string, unknown>` stays; only
   the default goes.

7. **Correct the doc comments that the change falsifies.** `FiltersRoot`'s "see the Typing the root
   note for why `TState` is a caller-supplied type parameter", `Filters`' "`TState` is
   caller-supplied rather than inferred from `schema`", and `EnforceLiteralKey`'s claim that no
   schema-wide derivation is needed all describe a contract that no longer exists. Rewrite them to
   say what is true now, and do not carry the decision-number citations across — rationale lives in
   the decisions doc, not in source.

## Implementation Notes

- **Never name the key type in a schema constraint.** This is the non-negotiable constraint from
  the inference probes and it governs Steps 3 and 4 as well as this one. `S extends readonly
  FilterRule<string, unknown>[]` contextually types the array elements and pushes `string` down
  onto every rule's key parameter, widening all of them. The tuple survives, so it reads like tuple
  widening and sends you after the wrong cause. Constrain to `readonly unknown[]` and `Extract`
  inside the fold. `as const`, the `const` type-parameter modifier and a variadic `[...T[]]`
  constraint all fail to fix it — none addresses contextual typing.
- The phantom members are optional, so `NonNullable<R['__key']>` is what the remapped key clause
  reads. Keep them optional: a required phantom would have to be produced at runtime.
- `FilterRuleRecord`, `FilterGroupChild`, `FilterOptions`, `FilterNode` and `FilterValueOfContext`
  keep their current shapes. `state.ts`, `evaluator.ts`, `validate.ts` and `matchers.ts` consume
  `FilterRuleRecord` and must keep compiling untouched.
- Declaration order inside the file: the new rule types belong next to `FilterRuleRecord`, which
  they extend, not at the top.

## Risks / Watchouts

- **`FiltersPath<TRow>` stops being a plain mapped type.** In a generic position the conditional
  defers, so `buildFiltersPath`'s `new Proxy({} as FiltersPath<TRow>, …)` may need an assertion it
  did not need before. Do not "fix" that by weakening the brand — Step 4 owns the proxy, and the
  assertion is the acceptable cost. Note the shape you left it in so Step 4 does not rediscover it.
- **`Flatten` is recursive.** A conditional holding an array of rules, one of which is another
  conditional, is legal. Write the recursion so it terminates on a non-array, non-conditional and
  check it does not hit the instantiation-depth limit at two levels of nesting.
- **Do not add a phantom row brand.** `matcher()` already puts `TRow` in the type body. The brand
  that an earlier decision proposed is obsolete and must not be built.

## Non-Goals

- Any change to `rules.ts`, `create-filters.ts`, `recorder.ts` or `index.ts` — Steps 3–6.
- Deleting `FILTER_RECORDER`, `FilterSchemaRecorder` or `FilterHandle`'s recorder field. They still
  have live callers until Step 4 lands; Step 5 removes them.
- `rowOf` / `RowToken` — Step 2, in its own file.
- Asserting any of this in a spec — that is `#112`.

## Acceptance Checks

- [ ] `FilterRule` carries a key and a criterion statically and adds no runtime field
- [ ] `StateOf` is written against a bare `readonly unknown[]`; no schema-facing constraint anywhere
      in the file names the key type
- [ ] `Flatten` resolves through a nested array and through a `ConditionalRule`'s children
- [ ] `FiltersPath<never>` resolves to the branded error property; `FiltersPath<Row>` is unchanged
- [ ] Neither `Filters` nor `FiltersRoot` defaults its criterion map
- [ ] No doc comment in the file still describes the criterion map as caller-supplied
- [ ] `nx run shared-table:typecheck` is clean

---
[Step 2: Add the row-type token](step-2-row-of-token.plan.md) →
