import { signal, type Signal } from '@angular/core';
import { Subject, type Observable } from 'rxjs';
import { pruneByIds } from '../../../engine/rows';
import type { RowId } from '../../types';

// The expansion state model: not a feature, and no spec of its own — exercised through
// `with-expansion.spec.ts`. Each owning feature builds its own instance.

export interface ExpansionWriteOptions {
  /** `false` suppresses `changed` emissions for this write — restore, server sync. */
  emitEvent?: boolean;
}

export interface ExpansionStoreOptions {
  initial?: readonly RowId[];
  /** Normalizes the ids of every write and of `initial` before the diff is computed, so one write
   *  is one `changed` emission carrying only kept ids. Omitted, writes are stored as given. */
  enforce?: (ids: readonly RowId[]) => readonly RowId[];
  /** Called with the ids newly added to the set by any write. */
  onExpanded?: (ids: readonly RowId[]) => void;
}

/** The full symmetric diff of one `changed` write — every id added or removed together. */
export interface ExpansionChange {
  readonly added: readonly RowId[];
  readonly removed: readonly RowId[];
}

export interface ExpansionStore {
  readonly expanded: Signal<ReadonlySet<RowId>>;
  readonly changed: Observable<ExpansionChange>;
  /** The only writer of the signal. Emits once per write. */
  setExpanded(ids: readonly RowId[], options?: ExpansionWriteOptions): void;
  toggle(id: RowId, options?: ExpansionWriteOptions): void;
  /** Prunes via `pruneByIds()` (ADR-0006). Never touches `everExpanded` — the feature owns it. */
  onRowsRemoved(ids: readonly RowId[]): void;
  /** Completes `changed`. Wired to the feature's `onDestroy`. */
  destroy(): void;
}

/** Creates the open-id set with one `changed` emission per write. */
export function createExpansionStore(options: ExpansionStoreOptions = {}): ExpansionStore {
  const enforce = options.enforce ?? ((ids: readonly RowId[]): readonly RowId[] => ids);
  const expandedSignal = signal<ReadonlySet<RowId>>(
    new Set(enforce([...new Set(options.initial ?? [])])),
  );
  const changedSource = new Subject<ExpansionChange>();

  function setExpanded(ids: readonly RowId[], writeOptions?: ExpansionWriteOptions): void {
    const current = expandedSignal();
    const next = new Set(enforce([...new Set(ids)]));

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
    if (added.length > 0 || removed.length > 0) {
      changedSource.next({ added, removed });
    }
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
