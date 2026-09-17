# Step 1 — `when` moves into `FilterOptions`; `applyWhen` is deleted

**PR scope:** PR 1 of 1 (`#124`). **Blocks Step 2.**
**Task type:** `code`
**Stack:** angular
**Skills used:** `angular-developer`, `classify-errors-construction-vs-runtime`
**Scaffolding agent:** `angular-implementer`

## Files

| File | Line | Action |
|---|---|---|
| `libs/shared/table/src/filters/types.ts` | `:12-27` | edit — `FilterOptions` gains `when` |
| `libs/shared/table/src/filters/types.ts` | `:170-179` | delete — `ConditionalRule` |
| `libs/shared/table/src/filters/types.ts` | `:196-211` | edit — `FlattenItem` loses its `ConditionalRule` branch |
| `libs/shared/table/src/filters/rules.ts` | `:305-346` | delete — `applyWhen` and its comment block |
| `libs/shared/table/src/filters/create-filters.ts` | `:15-40` | delete — `ConditionalNode`, `isConditionalNode` |
| `libs/shared/table/src/filters/create-filters.ts` | `:42-68` | edit — `flattenRules` loses its conditional branch |
| `libs/shared/table/src/filters/create-filters.ts` | `:130-152` | edit — the gate pass reads `record.options.when` |
| `libs/shared/table/src/filters/index.ts` | `:7` | edit — drop `applyWhen` from the rule re-export |

## Why This Step Exists

This is first, not third as the spec's breakdown numbers it, because of an ordering the spec's
discussion-level graph does not show. `applyWhen` returns a `ConditionalRule` node that is neither
a rule nor keyed — it exists only because rules were collected in an **array**, where a node could
sit between the schema and its leaves. Step 2 replaces that array with an object literal, and an
object literal has nowhere to put a node that is not itself a filter.

So doing this after the object schema means inventing a transitional home for `applyWhen` that then
gets deleted. Doing it first is a contained swap against the array schema that still exists: the
gate moves from a wrapper node onto each rule's own options, and nothing about how the schema is
shaped has to change yet.

`gateByCondition` in `state.ts` is **not** touched. The gate mechanism is already correct; only
where the condition is declared moves.

## What To Do

1. Add `when` to `FilterOptions`:

   ```ts
   /** Gated off: `criterion()` and `isActive()` go dark. `value` and `reset` do not. */
   readonly when?: (ctx: FilterValueOfContext<TRow>) => boolean;
   ```

   This forces a second type parameter — `FilterOptions<TSource = unknown, TRow = unknown>`. The
   existing `TAs extends string` parameter stays for now; Step 2 deletes it. Keep the parameter
   order so every rule's `FilterOptions<X, TAs>` call site still compiles this step.
2. Delete `ConditionalRule` from `types.ts`, and the `Item extends ConditionalRule<infer C>` branch
   from `FlattenItem`. `Flatten` now only recurses through nested arrays.
3. Delete `applyWhen` from `rules.ts`, including the long comment block above it explaining the
   runtime-only `condition` field and the non-spreadable return.
4. In `create-filters.ts`: delete `ConditionalNode` and `isConditionalNode`, and the branch in
   `flattenRules` that calls it. `flattenRules` keeps only its array-recursion branch and its
   leaf push.
5. Change the gate collection pass. It currently reads `record.condition`; it now reads
   `record.options?.when`. `FilterRuleRecord.condition` and `kind: 'conditional'` are deleted —
   `kind` narrows to `'single' | 'group'`.
6. `evaluator.ts`'s `narrowingRecords()` also reads `record.condition` (`:118`). Change it to
   `record.options?.when`. The dedup and degradation behaviour around it is unchanged.
7. Drop `applyWhen` from `filters/index.ts`'s rule list.

## Implementation Notes

- `when` returns `boolean`, not grouping's `boolean | undefined`. Filtering has no async rule that
  could produce a pending state (R53). Do not add tri-state "for symmetry".
- The two-pass build in `create-filters.ts` stays two-pass, and for the same reason: a `when`
  condition may read a filter declared after it, so gating can only run once every node exists.
- `FilterValueOfContext<TRow>` is unchanged — `valueOf` still reads criterion values by path, never
  row data.

## Risks / Watchouts

- **`FilterOptions` gaining `TRow` widens every rule signature.** Each rule currently writes
  `FilterOptions<TCriterion, TAs>`; with a third slot defaulted to `unknown`, the `when` callback a
  consumer passes will infer `ctx` as `FilterValueOfContext<unknown>` unless the rule threads its
  own `TRow` through. Thread it: `FilterOptions<TCriterion, TAs, TRow>` at each rule's options
  parameter. A `when` whose `ctx.valueOf` does not accept a `FiltersPath<Row>` handle is the symptom.
- `filters/create-filters.spec.ts` and `create-filters.types.spec.ts` both exercise `applyWhen` and
  will fail to compile after this step. That is expected and in scope for Step 6 — do not patch
  them here beyond what is needed to keep the *source* tree coherent.

## Non-Goals

- Changing how gating behaves. Gated-off still means `criterion()`/`isActive()` dark, `value`/
  `reset` unaffected.
- The object-literal schema. Rules are still collected in an array after this step.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` reports no error originating in `src/filters/*.ts` or
      `src/api/features/with-filtering.ts`. Run it twice — `ngc` aborts before the template phase
      on a `.ts` error, so the first run's silence about templates means nothing.
- [ ] No `applyWhen`, `ConditionalRule`, `ConditionalNode`, `isConditionalNode` or
      `kind: 'conditional'` anywhere under `src/`.
- [ ] A rule declared with `{ when: () => false }` produces `criterion() === undefined` and
      `isActive() === false`, while `value()` still reads back what was written.

---
[Step 2: Object-literal schema](step-2-object-literal-schema.plan.md) →
