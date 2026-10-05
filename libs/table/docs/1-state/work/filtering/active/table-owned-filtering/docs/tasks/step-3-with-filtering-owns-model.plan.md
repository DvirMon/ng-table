# Step 3 — `withFiltering(config, schema)` owns the model; the row carrier is deleted

**PR scope:** PR 1 of 1 (`#90`). **Depends on: Step 2.** **Blocks Step 4.**
**Task type:** `code`
**Stack:** angular
**Skills used:** `angular-developer`, `file-organization`
**Scaffolding agent:** `angular-implementer`

## Files

| File                                            | Line       | Action                                                                                   |
| ----------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------- |
| `libs/table/src/api/features/with-filtering.ts` | `:1-75`    | rewrite — two overloads, owns the model, exposes `filters`                               |
| `libs/table/src/filters/create-filters.ts`      | —          | edit — becomes the internal model builder; `createFilters` and its `rows` anchor deleted |
| `libs/table/src/filters/row-of.ts`              | —          | **delete**                                                                               |
| `libs/table/src/filters/types.ts`               | `:105-115` | edit — `FiltersPath` loses its `[TRow] extends [never]` brand                            |
| `libs/table/src/filters/types.ts`               | `:143-151` | edit — `__row`/`RowOfRule` reassessed                                                    |

## Why This Step Exists

The spec numbers this as two steps — "1: the feature owns the model" and "4: delete the carrier" —
but at execution grain they are one edit seen from two sides. `rowOf()` exists _only_ because
`createFilters` had no table to ask for the row type and had to be handed an inference anchor. The
moment `TRow` is `RowOf<In>`, supplied by the table, the anchor has nothing left to anchor.

Splitting them ships an intermediate where the builder sits behind the feature and _still_ takes a
`rows` parameter it no longer reads — a shape no reviewer can evaluate, because it is not the
before state or the after state.

This is also where R10's original blocker is formally closed. `create-table.ts` reads rows through
a thunk inside a `computed()`, so a `resource()` whose `params` read `table.filters().criteria()`
wires with no construction cycle. Nothing in this step needs to _prove_ that — the proof is the
server story in `#91` — but do not reintroduce an anchor "just in case" for server mode.

## What To Do

1. Rename `create-filters.ts` to the internal builder it now is, and drop `createFilters`' public
   signature. The exported entry point becomes something like:

   ```ts
   export function buildFilterModel<TRow, S extends Record<string, AnyRule>>(
     schema: (path: FiltersPath<TRow>) => S,
   ): Filters<TRow, StateOf<S>>;
   ```

   No `rows` parameter, no `RowToken`, no `opts.injector`.

2. **Drop the injection plumbing.** The builder currently does `inject(Injector)` +
   `runInInjectionContext`. `createTable` already composes inside the owner's injection context
   (`api/create-table.ts:53` — `runInInjectionContext(injector, () => composeTable(...))`), and a
   feature factory runs inside that. Calling `inject()` again is redundant; keep the builder a
   plain function and let the feature factory's ambient context supply reactivity.
3. Rewrite `with-filtering.ts` with two overloads:

   ```ts
   export interface WithFilteringConfig {
     manual?: boolean;
   }

   export interface FilteringMembers<TRow, TState extends Record<string, unknown>> {
     readonly filters: Filters<TRow, TState>;
   }

   export function withFiltering<In extends Shape>(config: WithFilteringConfig): Feature<In, {}>;

   export function withFiltering<In extends Shape, S extends Record<string, AnyRule>>(
     config: WithFilteringConfig,
     schema: (path: FiltersPath<RowOf<In>>) => S,
   ): Feature<In, FilteringMembers<RowOf<In>, StateOf<S>>>;
   ```

   The factory builds the model from the schema and returns it as the `filters` member.

4. The `filter` stage now applies the owned model's matcher rather than a consumer predicate list,
   still honouring `manual`. `predicates` is not yet removed from the config — that is Step 4, so
   this step keeps the existing predicate path working alongside the new member. Keep the two
   paths visibly separate; Step 4 deletes one of them whole.
5. Delete `row-of.ts`, `rowOf`, `RowToken`, and the `RowToken<TRow>` arm of the old `rows`
   parameter's union.
6. `FiltersPath<TRow>` stops being a conditional type. The `[TRow] extends [never]` brand and its
   `__rowTypeCouldNotBeInferred_useRowOf` message exist to tell a caller to reach for `rowOf()`,
   which no longer exists. It becomes the plain mapped type:

   ```ts
   export type FiltersPath<TRow> = {
     readonly [K in Extract<keyof TRow, string>]: FilterHandle<TRow, K>;
   };
   ```

   This also removes the reason `buildFiltersPath` widens its proxy through `unknown` — with a
   non-conditional target, a direct assertion is accepted. Simplify that cast and its comment.

7. Reassess `__row`/`RowOfRule`. Their documented reason is that `TRow` was otherwise unrecoverable
   from a `FilterRuleRecord`. `anyOf`'s homogeneity check still reads `RowOfRule<C[0]>` to reject a
   child built from a different row — **that use survives**, so keep both unless the implementer
   finds the check compiles identically without them. Do not delete on the strength of the comment
   alone.

## Implementation Notes

- The config-only overload returns `Feature<In, {}>` — no `filters` member at all. That is the
  manual/server-shaped table that drives its own request and wants no client-side model. Both
  overloads must keep working.
- `withGrouping` (`api/features/with-grouping.ts`) is the reference for a feature that owns state
  and exposes members through `TableFeatureSpec.members`. Follow its shape, including the
  `Object.assign(feature, { displayName: 'withFiltering' })` tail.
- Per `file-organization`: the builder is engine-side, the rules and public types are API-side. The
  actual folder move is spec step 10, a _later_ issue — do not relocate files here. Name the
  builder so the eventual move is a move.

## Risks / Watchouts

- **Do not add a second derive overload yet.** The current `withFiltering` has a
  `derive: Feature<NoInfer<In>, D>` overload. Adding a schema parameter to a signature that already
  has an optional trailing feature makes two 2-arg forms ambiguous. Decide explicitly: either drop
  the derive overload this step, or place `schema` so the two cannot collide. Flag it rather than
  guessing — this is the one genuinely ambiguous point in the issue.
- **Injection context.** If dropping `runInInjectionContext` surfaces an error from
  `linkedSignal`/`computed` in `state.ts`, the cause is a caller constructing a feature outside
  `createTable`, not a missing injector — check the caller before adding the plumbing back.
- Every spec under `src/filters/` that imports `createFilters` or `rowOf` breaks here. Expected;
  Step 6 owns them.

## Non-Goals

- Deleting `predicates` or making `matcher()`/`dirty()` internal — Step 4.
- Barrel changes — Step 5.
- Relocating `src/filters/` into `api/features/with-filtering/` + `engine/filters/` — that is spec
  step 10, in a later issue, and deliberately last so a rename does not inflate every other diff.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` reports no error originating in `src/filters/*.ts` or
      `src/api/features/with-filtering.ts`. Run twice.
- [ ] No `rowOf`, `RowToken` or `row-of.ts` under `src/`.
- [ ] `FiltersPath` is a plain mapped type — no `extends [never]` brand, no
      `__rowTypeCouldNotBeInferred_useRowOf`.
- [ ] `withFiltering({ manual: true }, schema)` on a table of row `Invoice` gives
      `table.filters` typed `Filters<Invoice, StateOf<S>>`, with `path.<key>` completing on
      `Invoice`'s keys only.
- [ ] `withFiltering({ manual: true })` with no schema still compiles and contributes no member.

---

← [Step 2: Object-literal schema](step-2-object-literal-schema.plan.md) | [Step 4: Member audit](step-4-member-audit.plan.md) →
