import type { Signal } from '@angular/core';
import type { Feature, RowOf, Shape, TableFeatureSpec } from '../../engine/types';
import type { WritableView } from '../../engine/writable-view';
import { createTableFeature } from '../create-table-feature';
import type { DerivedDict, RowId } from '../types';
import { createEditingStore, type EditingStoreInput, type EditingUpdater, type PendingOp } from './editing/state';

export interface OptimisticMembers<TRow> {
  /** Read: which rows are open for editing — **always empty** unless `withRowEdit()` is composed,
   * since nothing else opens a row. Write: `.update(updater)`, e.g.
   * `table.editing.update(captureEdit(id))`. Every updater, including the ones that only touch
   * restore points, is applied through this one view. */
  readonly editing: WritableView<ReadonlySet<RowId>, EditingUpdater<TRow>>;
  /** Rows holding a restore point that is not open — an optimistic save in flight. Derived from
   * the state, so a row can never be open and pending at once. On a live table this is every
   * held restore point, which is exactly the in-flight set. */
  readonly pending: Signal<ReadonlySet<RowId>>;
  /** `pending`, paired with which operation armed each row — the fact a consumer cannot derive
   * from `pending` alone. */
  readonly pendingOps: Signal<ReadonlyMap<RowId, PendingOp>>;
  /** Client ids the server never acknowledged — outlives a restore point, since a failed
   * create's `revertEdit` spends the snapshot but the row must still POST on retry. */
  readonly unconfirmed: Signal<ReadonlySet<RowId>>;
}

/** The slice of the accumulating store this feature reads, row-typed via `RowOf<In>`.
 * `& Shape` is the bootstrap `RowOf<In>` needs, not a read: this feature touches only
 * `value`/`trackBy`/`indexById`, which is what `createEditingStore` reads. */
type OptimisticInput<In> = EditingStoreInput<RowOf<In>> & Shape;

/**
 * Restore points around writes that can fail: capture before the write, release when the server
 * confirms, revert when it rejects.
 *
 * Composed on its own by an **always-editable** table, whose edit session is delimited by focus
 * rather than by a button — there is nothing to open, so it needs no edit session at all:
 *
 * ```ts
 * onFocus: table.editing.update(captureEdit(id));
 * onBlur:  table.value.update(patchRow(id, partial));
 * server:  ok ? releaseEdit(id) : revertEdit(id);
 * ```
 *
 * `withRowEdit()` composes the same state for gated tables and adds the open set on top;
 * composing both throws at construction.
 *
 * **Scope — update, create, and delete; never move.** A restore point carries a position as well
 * as a value, so `revertEdit` can re-insert a row `removeEdit` took out of `data`. A moved row's
 * position is still not part of a snapshot — covering move needs an inverse-operation
 * representation this library does not have.
 */
export function withOptimistic<In extends OptimisticInput<In>>(): Feature<
  In,
  OptimisticMembers<RowOf<In>>
>;
export function withOptimistic<In extends OptimisticInput<In>, D extends DerivedDict>(
  derive: Feature<NoInfer<In> & OptimisticMembers<RowOf<In>>, D>
): Feature<In, OptimisticMembers<RowOf<In>> & D>;
export function withOptimistic(derive?: Feature<any, any>): Feature<any, any> {
  const factory = <In extends OptimisticInput<In>>(
    input: In
  ): TableFeatureSpec<RowOf<In>, OptimisticMembers<RowOf<In>>> => {
    const store = createEditingStore<RowOf<In>>(input);
    return {
      members: {
        editing: store.editing,
        pending: store.pending,
        pendingOps: store.pendingOps,
        unconfirmed: store.unconfirmed,
      },
      onRowsRemoved: store.onRowsRemoved,
    };
  };
  const feature: Feature<any, any> = derive
    ? createTableFeature(factory, derive)
    : createTableFeature(factory);
  return Object.assign(feature, { displayName: 'withOptimistic' });
}
