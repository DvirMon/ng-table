import { readAccessor } from './cells';
import type { ColumnDef } from '../api/types';
import { assertDeclarationsAreKnown } from '../schema/validate';

/** Pure `resolvers` builders. No signals, no Angular. */

/** Handle a `valueOf(handle, row)` call resolves — fabricated per declared column id by a
 * feature's own path proxy (`GroupingHandle`, `SortingHandle`). */
export interface ValueOfHandle<K extends string = string, V = unknown> {
  readonly id: K;
  /** @internal phantom — the column's resolved value type. */
  readonly __value?: V;
}

// docs/adr/0027-schema-declaration-surface.md Rule 3: unbound-tier, since resolving reads data.
/**
 * Resolves a declared column's accessor value for one row — takes the row too, since
 * resolving requires row data.
 */
export interface ValueOfContext<TRow> {
  valueOf<K extends string, V>(handle: ValueOfHandle<K, V>, row: TRow): V;
}

/**
 * Builds a `valueOf` context that reads `columns()` live, so it always sees the current list
 * even if `setColumns()` writes after the context is built.
 *
 * @remarks
 * An id outside `knownIds` throws; one that was declared but later removed reads
 * `undefined` instead.
 *
 * @param knownIds The calling feature's fixed, construction-time declared-id set.
 * @param label Names the calling feature in the thrown message (e.g. `'withGrouping'`).
 */
// Throw-vs-degrade split: docs/adr/0014-runtime-error-policy.md.
export function buildValueOfContext<TRow>(
  columns: () => readonly ColumnDef<TRow>[],
  knownIds: ReadonlySet<string>,
  label: string
): ValueOfContext<TRow> {
  const reportedColumns = new Set<string>();
  return {
    valueOf<K extends string, V>(handle: ValueOfHandle<K, V>, row: TRow): V {
      assertDeclarationsAreKnown([handle.id], knownIds, label);
      // Rebuilt per call — valueOf runs inside consumer callbacks at arbitrary points, so
      // there's no single "evaluation" object to cache this lookup on (mirrors clusters.ts's
      // readGroupValue, which rebuilds columnById the same way).
      const columnById = new Map(columns().map((column) => [column.id, column]));
      const column = columnById.get(handle.id);
      // `V` is a phantom generic (no runtime representation), so there is no structural guard
      // to narrow `unknown` into it — `readAccessor` reads the value at `column.id`, which
      // `handle.id` fixes to the same declared column `V` was typed against, so the cast is a
      // sound erasure, not an unchecked one. Same pattern as `ValueOfHandle.__value`'s own
      // phantom-carrier comment.
      if (!column) {
        return undefined as V;
      }
      return readAccessor(column, row, reportedColumns) as V;
    },
  };
}
