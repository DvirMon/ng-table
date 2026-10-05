---
title: 'Step 2 — with-filtering.ts: withFiltering<In>(config, derive?) contributing Feature<In, {}>'
type: task-step
issue: 72
---

# Step 2 — `with-filtering.ts`: `withFiltering<In>(config, derive?)` contributing `Feature<In, {}>`

**PR scope:** One feature file. Spec follows in Step 5.

**Task type:** code

**Skills used:** typescript-conventions, declarative-naming

**Depends on:** —
**Parallel-safe with:** Step 1, Step 3

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/api/features/with-filtering.ts` (edit)

## Why This Step Exists

Same contract change as Step 1 (spec "The feature contract", stories 2, 7, 21). Filtering is the
one shipped feature with **no members**: architecture "Types to add" — a member-less feature
returns `Feature<In, {}>`, never `Feature<In, object>` (cosmetic `& object` otherwise). Issue #38
acceptance: "A feature contributing no members contributes `{}`, not `object`."

## What To Do

1. **Config is row-typed through `RowOf<In>`.** `WithFilteringConfig<TRow>` stays as declared
   (`filters: Filters<TRow>`, `manual?`); the public signature applies it to `RowOf<In>`.

   > **Superseded 2026-09-14** (after this issue closed). The config now carries a second
   > parameter — `WithFilteringConfig<TRow, TState extends Record<string, unknown> =
Record<string, unknown>>` holding `filters: Filters<TRow, TState>` — and both overloads
   > thread `TState`. Pinning it to the default made a concretely-keyed filter set unassignable
   > (`FilterNode<T>` holds an invariant `WritableSignal<T>`). The `Feature<In, Out>` shape this
   > step delivered is unchanged. Current contract:
   > `docs/1-state/features/filtering.md` §Config.

2. **Input constraint.** Filtering reads nothing off the store — `In extends Shape` is enough.
   Import `Feature`, `RowOf`, `Shape`, `TableFeatureSpec` from `../../engine/types`; drop `TableCore`.

3. **Overloads, this order** (config is required here, so there is no derive-first form —
   `filters` cannot be defaulted):

   ```ts
   export function withFiltering<In extends Shape>(
     config: WithFilteringConfig<RowOf<In>>,
   ): Feature<In, {}>;
   export function withFiltering<In extends Shape, D extends DerivedDict>(
     config: WithFilteringConfig<RowOf<In>>,
     derive: Feature<NoInfer<In>, D>,
   ): Feature<In, D>;
   ```

   The block's input is `In` alone (`In & {}` is `In`).

4. **Implementation:**

   ```ts
   export function withFiltering(
     config: WithFilteringConfig<any>,
     derive?: Feature<any, any>,
   ): Feature<any, any> {
     const manual = config.manual ?? false;
     const factory = <In extends Shape>(_input: In): TableFeatureSpec<RowOf<In>, {}> => ({
       stages: {
         filter: (rows) => {
           if (manual) return rows;
           const evaluator = createFilterEvaluator<RowOf<In>, Record<string, unknown>>(
             config.filters,
           );
           return rows.filter((row) => evaluator.matchesRow(row));
         },
       },
     });
     const feature: Feature<any, any> = derive
       ? createTableFeature(factory, derive)
       : createTableFeature(factory);
     return Object.assign(feature, { displayName: 'withFiltering' });
   }
   ```

   Keep the evaluator construction lazy inside the stage exactly as today.

5. **Doc comment**: drop the "every feature factory takes `core` per CLAUDE.md's plugin pattern"
   paragraph — the parameter is now the store handed in, unused here. One line.

## Implementation Notes

- `TableFeatureSpec<TRow, Members extends object = {}>` — the default is already `{}`; write it
  explicitly in the factory's return type so the contribution is unmistakably `{}`.
- `createFilterEvaluator<TRow, TState>` today is called with `TRow` from the closure; with the
  generic factory it is `RowOf<In>` — same type at every call site.

## Risks / Watchouts

- Returning `Feature<In, object>` (e.g. by omitting the members default) leaks `& object` into
  every composed store type — the acceptance check below catches it.

## Non-Goals

- No spec (Step 5). No change to `create-filters.ts` / the evaluator.

## Acceptance Checks

- [ ] `createTable(data, cfg, withFiltering({ filters }))` has type exactly `TableStore<Row>`
      (`expectTypeOf(...).toEqualTypeOf<TableStore<Row>>()` — no `& {}`, no `& object`).
- [ ] `withFiltering({ filters }, withComputed((s) => ({ visible: computed(() => s.rows().length) })))`
      compiles; `store.visible` is `Signal<number>`.
- [ ] `filters` typed `Filters<Row>` with `Row` inferred from the slot.
- [ ] `npx tsc -p libs/shared/table/tsconfig.lib.json --noEmit` reports no error in
      `with-filtering.ts`.

---

← [Step 1: with-sorting.ts](step-1-with-sorting.plan.md) | [Step 3: with-grouping.ts — lazy guarded expandedRows read](step-3-with-grouping.plan.md) →
