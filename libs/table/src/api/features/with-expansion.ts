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
  /** Default `true`. `false` keeps at most one row open: every write (`toggle`, `expand`,
   *  `set`, `initial`) keeps only the last id of the write, and the displaced row closes in the
   *  same `changed` emission. `emitEvent: false` still trims. Accepts an accessor
   *  (`() => boolean`) that is read reactively; flipping it to `false` with more than one row
   *  open closes all of them in one emission, and with one or none open changes nothing.
   *  A throwing accessor is reported with `console.error` and treated as `true`. */
  multi?: boolean | (() => boolean);
}

/** Resolves `multi` to a signal. A throwing accessor degrades to multi-open — the mode that
 *  hides nothing — and is reported once per evaluation (ADR-0014). */
function resolveMulti(multi: WithExpansionConfig['multi']): Signal<boolean> {
  if (typeof multi !== 'function') {
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
  readonly everExpanded: Signal<ReadonlySet<RowId>>;
  /** One emission per write, carrying the whole symmetric difference. */
  readonly changed: Observable<ExpansionChange>;
  toggle(id: RowId, options?: ExpansionWriteOptions): void;
  /** Adds. Omitted `ids`: every row in `rows()` — the panel has no
   *  discovery walk, unlike the tree's `expand()`. */
  expand(ids?: readonly RowId[], options?: ExpansionWriteOptions): void;
  /** Removes. Omitted `ids`: everything currently open. */
  collapse(ids?: readonly RowId[], options?: ExpansionWriteOptions): void;
  /** Atomic replace — the restore path. */
  set(ids: readonly RowId[], options?: ExpansionWriteOptions): void;
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
  // Accumulated via the store's `onExpanded` hook, not the store itself — additive-only, exempt
  // from `onRowsRemoved` pruning (see `ExpansionSlice.everExpanded`).
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

  const expansion: ExpansionSlice = Object.assign(
    computed(() => store.expanded()),
    {
      everExpanded: everExpanded.asReadonly(),
      changed: store.changed,
      toggle,
      expand,
      collapse,
      set,
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
 * panel never changes `renderRows()`.
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
