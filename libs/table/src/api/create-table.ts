import { Injector, inject, runInInjectionContext } from '@angular/core';
import { composeTable } from '../engine/compose-table';
import {
  resolveColumnsConfig,
  wireColumnsSchemaAsync,
} from '../engine/columns-schema';
import type { CreateTableOverloads } from './create-table.overloads';
import type { AnyTableFeature, TableConfig, TableDataInput, TableStore } from './types';

/**
 * Creates the design system's table state layer and returns a live store **instance** —
 * call it at the component field level with the row data in hand:
 *
 * ```ts
 * protected readonly data  = signal(people);
 * protected readonly table = createTable(this.data, { trackBy: 'id', columns }, withSorting());
 * ```
 *
 * Must run inside an Angular injection context (a component/directive field initializer or
 * `constructor`), unless `config.injector` is passed as an escape hatch for use outside a
 * context (services, tests). The instance is owned by that context: a component field ⇒
 * component-scoped, torn down with the component. There is no DI token to provide or inject;
 * consumers hold the returned instance directly.
 *
 * `config` is structural — evaluated once, exactly like `form()`'s single `rootCompile`. Only
 * `data` is reactive: the consumer's `WritableSignal<TRow[]>` is the single source of truth,
 * and the pipeline's `rows` `computed()` reads it directly — no internal copy. Row writes go
 * through the returned store's `value` member (`table.value.update(insertRow(...))`) rather
 * than a setter on `data` itself.
 */
export const createTable = (<TRow>(
  data: TableDataInput<TRow>,
  config: TableConfig<TRow>,
  ...features: readonly AnyTableFeature[]
): TableStore<TRow> => {
  // Resolve the context now: `inject(Injector)` requires an injection context, so this
  // asserts we're in one (or the caller supplied their own — the outside-context path).
  const injector = config.injector ?? inject(Injector);

  // Resolves `columns` + optional `columnsSchema` (inline fn or a standalone
  // `columnSchema()` value) into the initial column list plus the flat reactive/async
  // rule set `wireColumnsSchemaAsync` wires up.
  const { columns, rules } = resolveColumnsConfig(
    config.columns,
    config.columnsSchema
  );

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
