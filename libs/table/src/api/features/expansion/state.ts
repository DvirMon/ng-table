import { signal, type Signal } from '@angular/core';
import { Subject, type Observable } from 'rxjs';
import { pruneByIds } from '../../../engine/rows';
import type { RowId } from '../../types';

// The expansion state model — factory only, no spec of its own. Exercised through
// `with-expansion.spec.ts`, mirroring `api/features/editing/state.ts`.
//
// Not a feature. `withExpansion()` builds one instance today; a future tree feature builds its
// own, passing no `onExpanded` (see the member's own doc).

export interface ExpansionWriteOptions {
  /** `false` suppresses `changed` emissions for this write — restore, server sync. */
  emitEvent?: boolean;
}

export interface ExpansionStoreOptions {
  initialExpanded?: readonly RowId[];
  /** Called with ids newly added to the set by any write. `withExpansion()` uses it to
   *  accumulate `everExpanded`; a future tree feature passes nothing. Mirrors
   *  `EditingStoreOptions.onWrite`. */
  onExpanded?: (ids: readonly RowId[]) => void;
}

export interface ExpansionStore {
  readonly expanded: Signal<ReadonlySet<RowId>>;
  readonly changed: Observable<RowId>;
  /** The only writer of the signal. Emits once per id whose membership changed — added or
   *  removed. */
  setExpanded(ids: readonly RowId[], options?: ExpansionWriteOptions): void;
  toggle(id: RowId, options?: ExpansionWriteOptions): void;
  /** Prunes via `pruneByIds()` (ADR-0006). Never touches `everExpanded` — the feature owns it. */
  onRowsRemoved(ids: readonly RowId[]): void;
  /** Completes `changed`. Wired to the feature's `onDestroy`. */
  destroy(): void;
}

export function createExpansionStore(options: ExpansionStoreOptions = {}): ExpansionStore {
  const expandedSignal = signal<ReadonlySet<RowId>>(new Set(options.initialExpanded ?? []));
  const changedSource = new Subject<RowId>();

  function setExpanded(ids: readonly RowId[], writeOptions?: ExpansionWriteOptions): void {
    const current = expandedSignal();
    const next = new Set(ids);

    const added: RowId[] = [];
    for (const id of next) {
      if (!current.has(id)) {
        added.push(id);
      }
    }
    const removed: RowId[] = [];
    for (const id of current) {
      if (!next.has(id)) {
        removed.push(id);
      }
    }

    expandedSignal.set(next);

    if (added.length > 0) {
      options.onExpanded?.(added);
    }

    if (writeOptions?.emitEvent === false) {
      return;
    }
    added.forEach((id) => changedSource.next(id));
    removed.forEach((id) => changedSource.next(id));
  }

  function toggle(id: RowId, writeOptions?: ExpansionWriteOptions): void {
    const next = new Set(expandedSignal());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpanded([...next], writeOptions);
  }

  function onRowsRemoved(ids: readonly RowId[]): void {
    const current = expandedSignal();
    const next = pruneByIds(current, ids);
    if (next !== current) {
      expandedSignal.set(next);
    }
  }

  return {
    expanded: expandedSignal.asReadonly(),
    changed: changedSource.asObservable(),
    setExpanded,
    toggle,
    onRowsRemoved,
    destroy: () => changedSource.complete(),
  };
}
