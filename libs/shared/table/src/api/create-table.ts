import { Injector, inject, runInInjectionContext } from '@angular/core';
import { composeTable } from '../engine/compose-table';
import {
  resolveColumnsConfig,
  wireColumnsSchemaAsync,
} from '../engine/columns-schema';
import type {
  AnyTableFeature,
  ComposedFeatureMembers,
  TableDataInput,
  TableStore,
  TableStoreConfig,
} from './types';

/**
 * Creates the design system's table state layer and returns a live store **instance** —
 * call it at the component field level with the row data in hand. Modeled on Angular's
 * Signal Forms `form(model, schemaFn)` and TanStack's `injectTable(() => options)`:
 *
 * ```ts
 * protected readonly data  = signal(people);
 * protected readonly table = createTable(this.data, () => ({
 *   trackBy: 'id',
 *   columns,
 *   features: [withSorting<Person>()],
 * }));
 * ```
 *
 * Must run inside an Angular injection context (a component/directive field initializer or
 * `constructor`), unless an `injector` is passed in `options` — mirroring `form()`'s own
 * escape hatch for use outside a context (services, tests). The instance is owned by that
 * context: a component field ⇒ component-scoped, torn down with the component. There is no
 * DI token to provide or inject; consumers hold the returned instance directly.
 *
 * `optsFn()` runs **once** at construction — `trackBy` / `columns` / `features` are
 * structural. Only `data` is reactive: the consumer's `WritableSignal<TRow[]>` is the single
 * source of truth, and the pipeline's `rows` `computed()` reads it directly — no internal
 * copy. Row writes go through the returned store's `value` member
 * (`table.value.update(insertRow(...))`) rather than a setter on `data` itself.
 */
export function createTable<
  TRow,
  const Features extends readonly AnyTableFeature[] = []
>(
  data: TableDataInput<TRow>,
  optsFn: () => TableStoreConfig<TRow, Features>,
  options?: { injector?: Injector }
): TableStore<TRow> & ComposedFeatureMembers<Features> {
  // Resolve the context now: `inject(Injector)` requires an injection context, so this
  // asserts we're in one (or the caller supplied their own — the outside-context path).
  const injector = options?.injector ?? inject(Injector);

  // Config is structural — evaluated once, exactly like `form()`'s single `rootCompile`.
  const config = optsFn();

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
    composeTable<TRow>({ columns, trackBy: config.trackBy, data }, [
      wireColumnsSchemaAsync<TRow>(rules),
      ...(config.features ?? []),
    ])
  );

  // The composed member type is reconstructed statically by `ComposedFeatureMembers`,
  // because the engine folds a runtime-length feature array. This assertion is the
  // boundary between the two — see ADR-0003.
  return store as TableStore<TRow> & ComposedFeatureMembers<Features>;
}
