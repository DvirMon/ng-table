import type { Signal } from '@angular/core';
import type { Observable } from 'rxjs';
import type { RowId } from '../../types';
import type { ExpansionChange, ExpansionWriteOptions } from '../expansion/state';

export type { ExpansionChange, ExpansionWriteOptions } from '../expansion/state';

export interface WithTreeConfig<TRow> {
  /** Renders the toggle independently of whether children are loaded — lazy children.
   *  Default: some other row's `parentId` resolves to this row. */
  isExpandable?: (row: TRow) => boolean;
  /** Seeds the open set at construction. Emits nothing on `changed`. */
  initial?: readonly RowId[];
  /**
   * Reads a flat row's declared parent id (`null`/`undefined` mean root); nests flat rows by
   * parent id and claims the `'tree'` render stage and the parent link. Omitted: collapse-only,
   * no row tree, stage left unclaimed. A throw, an `undefined` return, a self-parent, an absent
   * parent, or a cycle all degrade that row to a root (reported once per kind per evaluation).
   */
  parentId?: (row: TRow) => RowId | null | undefined;
}

export interface TreeSlice {
  (): ReadonlySet<RowId>;
  /** One emission per write, carrying the whole symmetric difference. */
  readonly changed: Observable<ExpansionChange>;
  /** `'all'` when every expandable row is open, `'none'` when none is — including
   *  "nothing is expandable", which is what a collapse-only instance always reads. */
  readonly state: Signal<'all' | 'some' | 'none'>;
  toggle(id: RowId, options?: ExpansionWriteOptions): void;
  /** Adds. Omitted `ids`: every expandable row found by the discovery walk. */
  expand(ids?: readonly RowId[], options?: ExpansionWriteOptions): void;
  /** Removes. Omitted `ids`: everything currently open. */
  collapse(ids?: readonly RowId[], options?: ExpansionWriteOptions): void;
  /** Atomic replace — the restore path. */
  set(ids: readonly RowId[], options?: ExpansionWriteOptions): void;
  /** The id's declared parent, resolved through `engine/tree-links.ts` over all of `data()` —
   * not the pipeline's `rows()` view. `null` for a root or an id not present in `data()`. Never
   * reports (#167). */
  parentOf(id: RowId): RowId | null;
  /** Every descendant of `id` at any depth, depth-first in `data()` order, parent before child,
   * never including `id` itself. `[]` for a leaf or an id not present in `data()`. Never
   * reports (#167). */
  descendantsOf(id: RowId): RowId[];
  /** Every row a contributor (such as an active filter) retains as context, including rows
   * hidden under a collapsed parent. Empty when nothing contributes (#169). */
  readonly contextRowIds: Signal<ReadonlySet<RowId>>;
}

export interface TreeMembers {
  readonly tree: TreeSlice;
}
