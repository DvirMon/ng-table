import { Injector, inject, runInInjectionContext } from '@angular/core';
import { composeTable } from '../engine/compose-table';
import {
  resolveColumnsIntake,
  wireColumnsSchemaAsync,
} from '../engine/columns-schema';
import type { CreateTableOverloads } from './create-table.overloads';
import type { AnyTableFeature, TableConfig, TableDataInput, TableStore } from './types';

/**
 * Creates the table's state layer and returns a live store instance.
 *
 * @remarks
 * Must run in an Angular injection context (a field initializer or constructor), or pass
 * `config.injector` for use outside one (services, tests). The instance is owned by that
 * context — a component field is torn down with the component. There is no DI token to
 * provide or inject; consumers hold the returned instance directly.
 *
 * `config` is structural, evaluated once — like `form()`'s single `rootCompile`. Only
 * `data` — the consumer's own signal — is reactive; the pipeline reads it directly, with no
 * internal copy. Row writes go through `table.value.update(...)`.
 *
 * @example
 * ```ts
 * protected readonly data  = signal(people);
 * protected readonly table = createTable(this.data, { trackBy: 'id', columns }, withSorting());
 * ```
 */
export const createTable = (<TRow>(
  data: TableDataInput<TRow>,
  config: TableConfig<TRow>,
  ...features: readonly AnyTableFeature[]
): TableStore<TRow> => {
  // Resolve the context now: `inject(Injector)` requires an injection context, so this
  // asserts we're in one (or the caller supplied their own — the outside-context path).
  const injector = config.injector ?? inject(Injector);

  // `config.columns` is either a plain array or a `ColumnSet` from `createColumns()`.
  // A `ColumnSet` carries its own rules, already resolved via `columnSchema()`; a plain
  // array carries none — schema rules are `createColumns()`'s to declare, not a separate
  // config property, so the array branch yields an empty rule set.
  const { columns, rules } = resolveColumnsIntake(config.columns);

  // The composition runs under the owner's injection context so feature `setup` hooks
  // can create `effect()` / `resource()`, and `onDestroy` hooks reach its `DestroyRef`.
  const store = runInInjectionContext(injector, () =>
    composeTable<TRow>(
      { columns, trackBy: config.trackBy, data },
      features,
      // The column-schema wiring is an internal composition step, not a consumer feature —
      // passing it separately keeps it off the consumer's own numbering.
      [wireColumnsSchemaAsync<TRow>(rules)]
    )
  );

  return store;
  // The trailing assertion is the static/dynamic boundary: the engine folds a runtime-length
  // feature array, while `CreateTableOverloads`'s per-arity signatures reconstruct the
  // composed member type statically.
}) as CreateTableOverloads;
