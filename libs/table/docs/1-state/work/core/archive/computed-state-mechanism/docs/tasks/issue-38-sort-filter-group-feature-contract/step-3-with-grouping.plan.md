---
title: 'Step 3 — with-grouping.ts: withGrouping<In>(configOrSchemaFn?, derive?), composed seam replaced by a lazy guarded store read'
type: task-step
issue: 72
---

# Step 3 — `with-grouping.ts`: `withGrouping<In>(configOrSchemaFn?, derive?)`, `composed` seam replaced by a lazy guarded store read

**PR scope:** One feature file. Spec follows in Step 6. Today `withGrouping()` is the only
shipped feature the #35 fold cannot even call (two required parameters), so this step also
closes the runtime gap "`composed` is `undefined`" recorded in #35 Step 3's watchouts.

**Task type:** code

**Skills used:** typescript-conventions, declarative-naming, extract-encapsulated-logic

**Depends on:** —
**Parallel-safe with:** Step 1, Step 2

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/api/features/with-grouping.ts` (edit)

## Why This Step Exists

Architecture, settled point 10 and D25: grouping's read of `expandedRows` survives as a **lazy
guarded read of the store handed in** — typed only when expansion precedes grouping, works at
runtime in either order, because the accumulating store is one shared reference. Spec "The
feature contract": the `composed` parameter is retired. Issue #38: "the read happens lazily
inside the group render stage on the shared store object, guarded by the existing signal
check, not at factory time"; column ids autocomplete from the row type (story 6).

## What To Do

1. **Input slice, F-bounded**, replacing `GroupingInput<TRow> = Pick<TableCore<TRow>, 'columns' | 'rows'>`:

   ```ts
   type GroupingInput<In> = Pick<TableStore<RowOf<In>>, 'columns' | 'rows'>;
   ```

2. **The late read, cast-free.** Replace the `composed['expandedRows']` read with a named helper
   next to `isExpandedRowsSignal`:

   ```ts
   /** Reads `withExpansion()`'s `expandedRows` off the shared store at render time — present in
    * either argument order, typed on `In` only when expansion is declared first. */
   function readExpandedRows(store: object): ReadonlySet<RowId> | undefined {
     const hasExpansion = 'expandedRows' in store;
     if (!hasExpansion) {
       return undefined;
     }
     const member: unknown = store.expandedRows;
     return isExpandedRowsSignal(member) ? member() : undefined;
   }
   ```

   `'expandedRows' in store` narrows `object` to `object & Record<'expandedRows', unknown>`
   (TS ≥ 4.9) — no assertion. Call it **inside** the `group` render stage body
   (`renderStages.group: (rows) => { const expandedRows = readExpandedRows(input); ... }`),
   never at factory time. Update `isExpandedRowsSignal`'s doc: the registry guarantee it cites
   still holds (`expandedRows` is claimed by `withExpansion()` alone), the seam is now the store.

3. **Extract the factory body** into `buildGroupingSpec<TRow>(input: Pick<TableStore<TRow>, 'columns' | 'rows'>, config: WithGroupingConfig<TRow>): TableFeatureSpec<TRow, GroupingMembers<TRow>>`
   — today's inner arrow (validation throws, base/overlay fold, `rowsOf`, stages), `core` → `input`.

4. **Overloads, this order.** Grouping's first argument may already be a function
   (`GroupingSchemaFn`), so a derive-first form cannot be discriminated at runtime — the block
   is **trailing only** here (decided at `/to-tasks` 2026-09-13): `withGrouping({}, withComputed(...))`.

   ```ts
   export function withGrouping<In extends GroupingInput<In>>(
     configOrSchemaFn?: WithGroupingConfig<RowOf<In>> | GroupingSchemaFn<RowOf<In>>,
   ): Feature<In, GroupingMembers<RowOf<In>>>;
   export function withGrouping<In extends GroupingInput<In>, D extends DerivedDict>(
     configOrSchemaFn: WithGroupingConfig<RowOf<In>> | GroupingSchemaFn<RowOf<In>> | undefined,
     derive: Feature<NoInfer<In> & GroupingMembers<RowOf<In>>, D>,
   ): Feature<In, GroupingMembers<RowOf<In>> & D>;
   ```

5. **Implementation:**

   ```ts
   export function withGrouping(
     configOrSchemaFn: WithGroupingConfig<any> | GroupingSchemaFn<any> = {},
     derive?: Feature<any, any>,
   ): Feature<any, any> {
     const config: WithGroupingConfig<any> =
       typeof configOrSchemaFn === 'function'
         ? { rules: [...runColumnsSchemaFn<any, AnyGroupingRule<any>>(configOrSchemaFn)] }
         : configOrSchemaFn;
     const factory = <In extends GroupingInput<In>>(
       input: In,
     ): TableFeatureSpec<RowOf<In>, GroupingMembers<RowOf<In>>> => buildGroupingSpec(input, config);
     const feature: Feature<any, any> = derive
       ? createTableFeature(factory, derive)
       : createTableFeature(factory);
     return Object.assign(feature, { displayName: 'withGrouping' });
   }
   ```

6. **Config types** keep their `TRow` parameters (`initialGrouping?: ColumnId<TRow>[]`,
   `groupOrder`, `rules?: AnyGroupingRule<TRow>[]`); only the public signature changes to
   `RowOf<In>`. `GroupingMembers<TRow>` unchanged.

7. **Doc comment**: replace "Standalone — reads only `core.columns`" with one line: reads
   `columns`/`rows` off the store handed in; picks up `expandedRows` lazily when
   `withExpansion()` is composed, in either order.

## Implementation Notes

- `runColumnsSchemaFn` is called once at `withGrouping()` call time today (before the factory
  runs) — keep that: it is config compilation, not store-dependent.
- The `group` **pipeline** stage and `rowsOf` read `input.columns()`/`input.rows()` — both
  exist on `GroupingInput<In>`; nothing else off the store is needed.
- `readExpandedRows` receives `input` (type `In`); passing it as `object` is a widening, no cast.

## Risks / Watchouts

- Reading `expandedRows` at factory time would reintroduce order dependence — the whole point
  of D25 is the deferred read. Keep the call inside the stage closure.
- Do not add a derive-first overload "for consistency" — a `Feature` and a `GroupingSchemaFn`
  are both functions; `displayName` cannot discriminate a third-party derive feature.

## Non-Goals

- No spec (Step 6). No `withExpansion()` change (#39). No render-stage/pipeline model change.

## Acceptance Checks

- [ ] `withGrouping({ initialGrouping: ['region'] })` in a slot: `'region'` autocompletes from
      the row type; `['nope']` is a compile error (`@ts-expect-error` in Step 6).
- [ ] `withGrouping((path) => [applyGrouping(path.region, ...)])` schema-fn overload still compiles
      with `path` typed from the row.
- [ ] `withGrouping({}, withComputed((s) => ({ levels: computed(() => s.grouping().length) })))`
      compiles; `store.levels` is `Signal<number>`.
- [ ] Factory takes exactly one parameter; no `composed` anywhere in the file.
- [ ] `npx tsc -p libs/shared/table/tsconfig.lib.json --noEmit` reports no error in
      `with-grouping.ts`.

---

← [Step 2: with-filtering.ts](step-2-with-filtering.plan.md) | [Step 4: with-sorting.spec.ts — positional form, type assertions](step-4-with-sorting-spec.plan.md) →
