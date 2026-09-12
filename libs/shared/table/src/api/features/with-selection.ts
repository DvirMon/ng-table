import { signal, type Signal } from '@angular/core';
import { Subject, type Observable } from 'rxjs';
import { pruneByIds } from '../../engine/rows';
import type { TableCore, TableFeatureSpec } from '../../engine/types';
import type { RowId } from '../types';

export interface WithSelectionConfig<TRow> {
  /** Whether a row may be selected at all. Default: `true`. */
  enableRowSelection?: boolean | ((row: TRow) => boolean);
  /** Whether a row may be co-selected with others. Default: `true`. */
  enableMultiRowSelection?: boolean | ((row: TRow) => boolean);
  initialSelection?: RowId[];
}

export interface SelectionChange {
  readonly added: readonly RowId[];
  readonly removed: readonly RowId[];
}

/**
 * Suppresses the `selectionChanged` emission a write would otherwise produce. For writes that
 * carry no user intent — restoring persisted state, syncing from a server. Mirrors
 * `ExpansionWriteOptions`/Angular reactive forms' `setValue(v, { emitEvent: false })`.
 */
export interface SelectionWriteOptions {
  emitEvent?: boolean;
}

export interface SelectionMembers {
  readonly selectedRows: Signal<ReadonlySet<RowId>>;
  readonly selectionChanged: Observable<SelectionChange>;
  toggle(id: RowId, opts?: SelectionWriteOptions): void;
  select(ids: RowId[], opts?: SelectionWriteOptions): void;
  deselect(ids: RowId[], opts?: SelectionWriteOptions): void;
  clearSelection(opts?: SelectionWriteOptions): void;
  selectionStateOf(ids: readonly RowId[]): 'none' | 'some' | 'all';
  /** The D58 gate, read-side (D61) — `enableRowSelection` for one id, permissive for an
   *  unresolvable id (D8). Lets a caller pre-filter its own denominator (e.g. before
   *  `selectionStateOf()`) against the same predicate `select()` enforces, instead of
   *  duplicating `enableRowSelection`'s logic at the call site. */
  isSelectable(id: RowId): boolean;
}

/** The slice of the core store this feature reads. */
type SelectionInput<TRow> = Pick<TableCore<TRow>, 'rows' | 'trackBy'>;

const devModeIsActive = (): boolean =>
  typeof ngDevMode === 'undefined' || ngDevMode;

declare const ngDevMode: boolean | undefined;

/**
 * Adds single/multi row selection to a `createTable()`. Standalone — reads only core members,
 * no dependency on any other feature. Never stamps a `RenderRow` field or claims a render
 * stage (D5): selection is read from `selectedRows` only.
 */
/** Normalizes an `enable*` config field into a per-row predicate, permissive by default. */
function toRowPredicate<TRow>(
  config: boolean | ((row: TRow) => boolean) | undefined
): (row: TRow) => boolean {
  return typeof config === 'function' ? config : () => config ?? true;
}

export function withSelection<TRow = unknown>(
  config: WithSelectionConfig<TRow> = {}
): (core: SelectionInput<TRow>) => TableFeatureSpec<TRow, SelectionMembers> {
  const canSelect = toRowPredicate(config.enableRowSelection);
  const canMultiSelect = toRowPredicate(config.enableMultiRowSelection);

  return (core: SelectionInput<TRow>): TableFeatureSpec<TRow, SelectionMembers> => {
    const selectedIds = signal(new Set<RowId>());
    // Plain Subject, never Replay/BehaviorSubject (D16) — current state is read from
    // `selectedRows()`, never carried in the stream, so a replaying variant would wrongly
    // deliver construction/seed state to every late subscriber.
    const selectionChangedSource = new Subject<SelectionChange>();

    function resolveRow(id: RowId): TRow | undefined {
      return core.rows().find((row) => core.trackBy(row) === id);
    }

    // Row-selectability gate (D58) — contract in docs/1-state/features/selection.md.
    function isSelectable(id: RowId): boolean {
      const row = resolveRow(id);
      return row === undefined || canSelect(row);
    }

    function applyRowSelectionGate(ids: readonly RowId[]): readonly RowId[] {
      return ids.filter(isSelectable);
    }

    // Multi-select is a rule on the write verbs, never stored state (D2/D14) — it never holds
    // two ids whose predicate is false. Applies to every id-adding write (toggle/select/the
    // initialSelection seed), checked against the full candidate set (existing + requested),
    // never to deselect/clear, which can't violate single-select. An id with no resolvable row
    // defaults permissive (D8).
    function applyMultiSelectRule(ids: readonly RowId[]): readonly RowId[] {
      const uniqueIds = [...new Set(ids)];
      if (uniqueIds.length <= 1) {
        return uniqueIds;
      }
      const forbidsCoSelection = uniqueIds.some((id) => {
        const row = resolveRow(id);
        return row !== undefined && !canMultiSelect(row);
      });
      if (!forbidsCoSelection) {
        return uniqueIds;
      }
      const kept = [uniqueIds[uniqueIds.length - 1]];
      if (devModeIsActive()) {
        const discarded = uniqueIds.slice(0, -1);
        throw new Error(
          `withSelection(): enableMultiRowSelection forbids co-selecting these rows — discarded ids: ${discarded.join(', ')}`
        );
      }
      return kept;
    }

    function applyNextSelection(next: Set<RowId>, opts?: SelectionWriteOptions): void {
      const previous = selectedIds();
      const added = [...next].filter((id) => !previous.has(id));
      const removed = [...previous].filter((id) => !next.has(id));
      if (added.length === 0 && removed.length === 0) {
        return;
      }
      selectedIds.set(next);
      if (opts?.emitEvent === false) {
        return;
      }
      selectionChangedSource.next({ added, removed });
    }

    function toggle(id: RowId, opts?: SelectionWriteOptions): void {
      const previous = selectedIds();
      if (previous.has(id)) {
        const next = new Set(previous);
        next.delete(id);
        applyNextSelection(next, opts);
        return;
      }
      const kept = applyMultiSelectRule([...previous, ...applyRowSelectionGate([id])]);
      applyNextSelection(new Set(kept), opts);
    }

    function select(ids: RowId[], opts?: SelectionWriteOptions): void {
      const previous = selectedIds();
      const kept = applyMultiSelectRule([...previous, ...applyRowSelectionGate(ids)]);
      applyNextSelection(new Set(kept), opts);
    }

    function deselect(ids: RowId[], opts?: SelectionWriteOptions): void {
      const removeSet = new Set(ids);
      const next = new Set([...selectedIds()].filter((id) => !removeSet.has(id)));
      applyNextSelection(next, opts);
    }

    function clearSelection(opts?: SelectionWriteOptions): void {
      applyNextSelection(new Set(), opts);
    }

    function selectionStateOf(ids: readonly RowId[]): 'none' | 'some' | 'all' {
      const current = selectedIds();
      const selectedCount = ids.filter((id) => current.has(id)).length;
      if (selectedCount === 0) {
        return 'none';
      }
      return selectedCount === ids.length ? 'all' : 'some';
    }

    // D16: written directly into the signal, never routed through `select()` (which emits).
    // Still subject to the row-selection gate and the multi-select truncation rule — a write in
    // every sense but emission.
    const seedIds = applyMultiSelectRule(applyRowSelectionGate(config.initialSelection ?? []));
    selectedIds.set(new Set(seedIds));

    // ADR-0006: reconciliation, not a write verb — prunes silently, no `selectionChanged`.
    function onRowsRemoved(ids: readonly RowId[]): void {
      const next = pruneByIds(selectedIds(), ids);
      if (next !== selectedIds()) {
        selectedIds.set(new Set(next));
      }
    }

    return {
      members: {
        selectedRows: selectedIds.asReadonly(),
        selectionChanged: selectionChangedSource.asObservable(),
        toggle,
        select,
        deselect,
        clearSelection,
        selectionStateOf,
        isSelectable,
      },
      onDestroy: () => selectionChangedSource.complete(),
      onRowsRemoved,
    };
  };
}
