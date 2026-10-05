import { Injector, inject, runInInjectionContext } from '@angular/core';
import { composeTable } from '../engine/compose-table';
import { wireColumnsSchemaAsync } from '../engine/columns-schema';
import type { CreateTableOverloads } from './create-table.overloads';
import type { AnyTableFeature, TableConfig, TableDataInput, TableStore } from './types';

/**
 * Creates the table's state layer and returns a live store instance.
 *
 * @remarks
 * Must run in an Angular injection context, or pass `config.injector` (services, tests).
 * `config` is read once at construction; only `data` is reactive. Writes go through
 * `table.value.update(...)`. See docs/adr/0002-table-store-instance-factory.md.
 *
 * @example
 * ```ts
 * protected readonly data    = signal(people);
 * protected readonly columns = createColumns(this.data, (col) => [col('id'), col('name')]);
 * protected readonly table   = createTable(this.data, { trackBy: 'id', columns }, withSorting());
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

  const { columns, rules } = config.columns;

  // The composition runs under the owner's injection context so feature `setup` hooks
  // can create `effect()` / `resource()`, and `onDestroy` hooks reach its `DestroyRef`.
  const store = runInInjectionContext(injector, () =>
    composeTable<TRow>(
      { columns, trackBy: config.trackBy, data },
      features,
      // The column-schema wiring is an internal composition step, not a consumer feature —
      // passing it separately keeps it off the consumer's own numbering.
      [wireColumnsSchemaAsync<TRow>(rules)],
    ),
  );

  return store;
  // The trailing assertion is the static/dynamic boundary: the engine folds a runtime-length
  // feature array, while `CreateTableOverloads`'s per-arity signatures reconstruct the
  // composed member type statically.
}) as CreateTableOverloads;
