import { computed, effect, signal, type Signal } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Feature, RowOf, TableFeatureSpec } from '../../engine/types';
import { createTableFeature } from '../create-table-feature';
import type { DerivedDict, RowId, TableStore } from '../types';
import {
  createExpansionStore,
  type ExpansionChange,
  type ExpansionWriteOptions,
} from './expansion/state';

export type { ExpansionChange, ExpansionWriteOptions } from './expansion/state';

export interface WithExpansionConfig {
  /** Seeds the open set at construction, and `everExpanded` alongside it. Emits nothing on
   *  `changed`. */
  initial?: readonly RowId[];
  /** Defaults to `true`. `false` keeps at most one row open: each write, `initial` included,
   *  keeps only its last id, and the displaced row closes in the same `changed` emission, even
   *  with `emitEvent: false`. An accessor is read reactively; flipping it to `false` closes all
   *  open rows if more than one. A throwing accessor is reported via `console.error` and
   *  treated as `true`. */
  multi?: boolean | (() => boolean);
}

// Note: a throwing accessor degrades to multi-open, the mode that hides nothing, and is
// reported once per evaluation (ADR-0014).
function resolveMulti(multi: WithExpansionConfig['multi']): Signal<boolean> {
  const isStaticValue = typeof multi !== 'function';
  if (isStaticValue) {
    return signal(multi ?? true);
  }
  return computed((): boolean => {
    try {
      return multi();
    } catch (error) {
      console.error('withExpansion: the `multi` accessor threw; treating it as `true`.', error);
      return true;
    }
  });
}

export interface ExpansionSlice {
  (): ReadonlySet<RowId>;
  /** Ids ever opened, kept so their panels stay mounted. Additive-only and not pruned when rows
   *  leave `data`; `release()` frees them. */
  readonly everExpanded: Signal<ReadonlySet<RowId>>;
  /** One emission per write, carrying the whole symmetric difference. */
  readonly changed: Observable<ExpansionChange>;
  toggle(id: RowId, options?: ExpansionWriteOptions): void;
  /** Adds. Omitted `ids`: every row in `rows()`. */
  expand(ids?: readonly RowId[], options?: ExpansionWriteOptions): void;
  /** Removes. Omitted `ids`: everything currently open. */
  collapse(ids?: readonly RowId[], options?: ExpansionWriteOptions): void;
  /** Atomic replace — the restore path. */
  set(ids: readonly RowId[], options?: ExpansionWriteOptions): void;
  /** Frees the kept panels of closed rows, so `everExpanded` stops holding them. Open ids are
   *  skipped. Omitted `ids`: every closed id in `everExpanded`; `[]` does nothing. Unknown ids are
   *  ignored. Never emits on `changed`. */
  release(ids?: readonly RowId[]): void;
}

export interface ExpansionMembers {
  readonly expansion: ExpansionSlice;
}

// F-bounded so a factory body gets `input.rows(): RowOf<In>[]` with no cast.
type ExpansionInput<In> = Pick<TableStore<RowOf<In>>, 'rows' | 'trackBy'>;

function buildExpansionSpec<TRow>(
  input: Pick<TableStore<TRow>, 'rows' | 'trackBy'>,
  multi: Signal<boolean>,
  config: WithExpansionConfig,
): TableFeatureSpec<TRow, ExpansionMembers> {
  // Note: accumulated via the store's `onExpanded` hook, not the store itself. Additive-only and
  // exempt from `onRowsRemoved` pruning.
  const everExpanded = signal(new Set<RowId>());

  // Single-open: keeps only the last id of the write. Runs inside the store's write funnel, so no
  // verb needs to know the mode.
  function keepLastWhenSingleOpen(ids: readonly RowId[]): readonly RowId[] {
    const exceedsSingleOpen = !multi() && ids.length > 1;
    return exceedsSingleOpen ? ids.slice(-1) : ids;
  }

  const store = createExpansionStore({
    initial: config.initial,
    enforce: keepLastWhenSingleOpen,
    onExpanded: (ids) => {
      everExpanded.update((seen) => {
        const next = new Set(seen);
        ids.forEach((id) => next.add(id));
        return next;
      });
    },
  });

  // The store seeds `expanded` silently at construction (no `onExpanded` call), so `everExpanded`
  // is seeded here too, synchronously, once.
  everExpanded.set(new Set(store.expanded()));

  function toggle(id: RowId, options?: ExpansionWriteOptions): void {
    store.toggle(id, options);
  }

  function expand(ids?: readonly RowId[], options?: ExpansionWriteOptions): void {
    const target = ids ?? input.rows().map(input.trackBy);
    const targeted = new Set(target);
    const kept = [...store.expanded()].filter((id) => !targeted.has(id));
    // Targets go last so "last" is the last id of this write, even for an already-open target.
    store.setExpanded([...kept, ...targeted], options);
  }

  function collapse(ids?: readonly RowId[], options?: ExpansionWriteOptions): void {
    if (ids === undefined) {
      store.setExpanded([], options);
      return;
    }
    const removing = new Set(ids);
    store.setExpanded(
      [...store.expanded()].filter((id) => !removing.has(id)),
      options,
    );
  }

  function set(ids: readonly RowId[], options?: ExpansionWriteOptions): void {
    store.setExpanded(ids, options);
  }

  function release(ids?: readonly RowId[]): void {
    const open = store.expanded();
    const candidates = ids ?? everExpanded();
    const releasable = [...candidates].filter((id) => !open.has(id));
    const seen = everExpanded();
    const removing = releasable.filter((id) => seen.has(id));
    if (removing.length === 0) {
      return;
    }
    everExpanded.update((current) => {
      const next = new Set(current);
      removing.forEach((id) => next.delete(id));
      return next;
    });
  }

  const expansion: ExpansionSlice = Object.assign(
    computed(() => store.expanded()),
    {
      everExpanded: everExpanded.asReadonly(),
      changed: store.changed,
      toggle,
      expand,
      collapse,
      set,
      release,
    },
  );

  // Closes every open row when `multi` flips to `false` with more than one open — no survivor,
  // a mode flip is nobody's request for a specific row. Idempotent once <= 1 is open.
  function onMultiChanged(): void {
    const exceedsSingleOpen = !multi() && store.expanded().size > 1;
    if (exceedsSingleOpen) {
      store.setExpanded([]);
    }
  }

  return {
    members: { expansion },
    setup: () => effect(onMultiChanged),
    onDestroy: () => store.destroy(),
    onRowsRemoved: (ids) => store.onRowsRemoved(ids),
  };
}

/**
 * Adds open/closed id tracking for a detail panel to `createTable()` — no row synthesis, no
 * render stage.
 *
 * @remarks
 * Composes with a tree/group feature without affecting which rows they reveal — opening a
 * panel never changes `renderRows()`. Pass `multi: false` for accordion behavior.
 *
 * @example
 * const table = createTable(data, { trackBy: 'id', columns }, withExpansion({ multi: false }));
 * table.expansion.toggle(1);
 * table.expansion.changed.subscribe(({ added, removed }) => save(added, removed));
 */
export function withExpansion<In extends ExpansionInput<In>, D extends DerivedDict>(
  derive: Feature<NoInfer<In> & ExpansionMembers, D>,
): Feature<In, ExpansionMembers & D>;
export function withExpansion<In extends ExpansionInput<In>>(
  config?: WithExpansionConfig,
): Feature<In, ExpansionMembers>;
export function withExpansion<In extends ExpansionInput<In>, D extends DerivedDict>(
  config: WithExpansionConfig | undefined,
  derive: Feature<NoInfer<In> & ExpansionMembers, D>,
): Feature<In, ExpansionMembers & D>;
export function withExpansion(
  configOrDerive: WithExpansionConfig | Feature<any, any> = {},
  maybeDerive?: Feature<any, any>,
): Feature<any, any> {
  const isDeriveFirst = typeof configOrDerive === 'function';
  const config: WithExpansionConfig = isDeriveFirst ? {} : configOrDerive;
  const derive = isDeriveFirst ? configOrDerive : maybeDerive;
  const multi = resolveMulti(config.multi);
  const factory = <In extends ExpansionInput<In>>(
    input: In,
  ): TableFeatureSpec<RowOf<In>, ExpansionMembers> => buildExpansionSpec(input, multi, config);
  const feature: Feature<any, any> = derive
    ? createTableFeature(factory, derive)
    : createTableFeature(factory);
  return Object.assign(feature, { displayName: 'withExpansion' });
}
