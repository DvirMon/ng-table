---
title: "Step 4 — create-table.ts: positional createTable(data, config, ...features), config.injector, delete table-schema.ts"
type: task-step
issue: 69
---

# Step 4 — `create-table.ts`: positional `createTable(data, config, ...features)`, `config.injector`, delete `table-schema.ts`

**PR scope:** The public factory's new signature, typed by the generated overload interface;
the config-builder helper deleted; the barrel updated. No feature files, no spec changes
(Step 6).

**Task type:** code

**Skills used:** typescript-conventions, terse-jsdoc-for-ai-and-humans

**Depends on:** Step 2 (generated `create-table.overloads.ts` must be committed), Step 3
**Parallel-safe with:** Step 5

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/api/create-table.ts` (edit)
- `libs/shared/table/src/api/table-schema.ts` (**delete** — D25)
- `libs/shared/table/src/index.ts` (edit — drop the `table-schema` export line)

## Why This Step Exists

D21/D24: `createTable(data, config, ...features)`, per-arity overloads, argument order governs
member visibility. The thunk goes (nothing in config was reactive); the trailing options
argument goes (`injector` moves into config — a trailing option cannot coexist with a variadic
list). `createTableSchema()`'s only output was the thunk, so it goes with it (D25); every call
site states `trackBy` explicitly (story 3).

## What To Do

### `create-table.ts`

1. Type the export by the generated interface; keep the implementation hand-written:

   ```ts
   import type { CreateTableOverloads } from './create-table.overloads';

   export const createTable: CreateTableOverloads = <TRow>(
     data: TableDataInput<TRow>,
     config: TableConfig<TRow>,
     ...features: readonly AnyTableFeature[]
   ): TableStore<TRow> => { ... };
   ```

   If assigning a single generic arrow to the overload interface does not type-check cleanly
   (overload-implementation compatibility is checked per signature), fall back to a
   `function createTableImpl(...)` plus `export const createTable = createTableImpl as
   CreateTableOverloads` — one cast, at the boundary, with the ADR-0003 justification moved
   onto it. Do not scatter casts.

2. Body, in order:
   - `const injector = config.injector ?? inject(Injector);`
   - `resolveColumnsConfig(config.columns, config.columnsSchema)` — unchanged.
   - `runInInjectionContext(injector, () => composeTable<TRow>({ columns, trackBy: config.trackBy, data }, features, [wireColumnsSchemaAsync<TRow>(rules)]))` — the splice stays internal
     (ADR-0010).
   - Return the store. The existing cast comment ("static/dynamic boundary, ADR-0003") stays
     on whichever cast survives from step 1.

3. **Rewrite the doc comment** (terse-jsdoc): new example with the positional form and no type
   argument on the feature —

   ```ts
   protected readonly table = createTable(this.data, { trackBy: 'id', columns }, withSorting());
   ```

   Keep: injection-context requirement with `config.injector` as the escape hatch; `data` is
   the single source of truth; config is structural, evaluated once. Drop every mention of
   `optsFn`, `features: [...]`, and `options`.

### `table-schema.ts`

Delete the file.

### `index.ts`

Remove `export * from './api/table-schema';`. `create-table.overloads.ts` is **not** exported
from the barrel — `CreateTableOverloads` is an implementation detail; consumers see
`createTable`'s call signatures through the const.

## Implementation Notes

- `AnyTableFeature` (`Feature<any, any>`) is the rest-parameter element type inside the
  implementation only. The overload interface is what consumers resolve against; the
  implementation's loose typing never leaks.
- `TableConfig` is imported from `./types` (Step 1). `Injector` stays imported from
  `@angular/core` for `inject(Injector)`.
- Runtime accepts any number of features (spec "Further Notes"); only the types cap at 15. Do
  not add a runtime length check.

## Risks / Watchouts

- **Callers of `createTableSchema()`** exist in `src/stories/**` (two schema files) and
  `apps/demo/**`, `apps/ng-table/**`. They break here and migrate in #75/#76. Do not touch
  them; do not leave a shim.
- `create-table.spec.ts` uses the thunk form throughout — it goes red at this step and is
  rewritten in Step 6. Expected.
- The `--check` drift script (Step 2) is the guard that `create-table.overloads.ts` was not
  hand-edited while wiring this up. Do not edit the generated file; if a signature is wrong,
  fix the generator and let the user regenerate.

## Non-Goals

- No `composeFeatures()` (#71). No `withComputed()` (#70).
- No migration of stories/apps (#75, #76). No docs (#78).

## Acceptance Checks

- [ ] `createTable(signal<Row[]>([]), { trackBy: 'id', columns })` compiles with zero type
      arguments and returns `TableStore<Row>`.
- [ ] `createTable(data, { ...config, injector })` composes outside an injection context.
- [ ] `columnsSchema` accepts both an inline function and a `columnSchema()` value.
- [ ] `api/table-schema.ts` is gone; `index.ts` no longer references it; `createTableSchema`
      is not in the public barrel.
- [ ] `create-table.ts` has at most one `as` cast, at the overload boundary, with the ADR-0003
      note.
- [ ] `api/create-table.ts`, `api/types.ts`, `engine/**` compile together (`tsc --noEmit`);
      remaining red is confined to `api/features/**`, `src/stories/**`, and spec files.

---
← [Step 3: compose-table.ts — fold hands each feature the store](step-3-fold-store-only-input.plan.md) | [Step 5: create-table-feature.ts — re-typed, trailing derive-block plumbing](step-5-create-table-feature-derive-plumbing.plan.md) →
