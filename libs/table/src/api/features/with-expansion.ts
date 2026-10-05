import { computed, signal, type Signal } from '@angular/core';
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
  config: WithExpansionConfig,
): TableFeatureSpec<TRow, ExpansionMembers> {
  // Accumulated via the store's `onExpanded` hook, not the store itself — additive-only, exempt
  // from `onRowsRemoved` pruning (see `ExpansionSlice.everExpanded`).
  const everExpanded = signal(new Set<RowId>());

  const store = createExpansionStore({
    initial: config.initial,
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
    store.setExpanded([...new Set([...store.expanded(), ...target])], options);
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

  return {
    members: { expansion },
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
  const factory = <In extends ExpansionInput<In>>(
    input: In,
  ): TableFeatureSpec<RowOf<In>, ExpansionMembers> => buildExpansionSpec(input, config);
  const feature: Feature<any, any> = derive
    ? createTableFeature(factory, derive)
    : createTableFeature(factory);
  return Object.assign(feature, { displayName: 'withExpansion' });
}
