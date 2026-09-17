import { describe, expectTypeOf, it } from 'vitest';
import type { RenderRow, RowId } from './types';

/**
 * Compile-time seam for `RenderRow.parentId` (ADR-0017) — `parentId`'s optionality is a type
 * fact with no runtime expression, since `undefined` at runtime is indistinguishable from a
 * field that was never optional. **`nx run shared-table:typecheck-spec` is what enforces this
 * file** — the runner executes `expectTypeOf`/`@ts-expect-error` without typechecking either.
 * Modeled on `filters/create-filters.types.spec.ts`, this library's existing compile-time
 * assertion file convention.
 */

/** Typechecks its argument and never calls it — one body here throws at construction. */
function typecheckOnly(assertions: () => void): void {
  void assertions;
}

interface Row {
  id: number;
  name: string;
}

describe('RenderRow.parentId', () => {
  it('a RenderRow literal without parentId satisfies the type', () => {
    typecheckOnly(() => {
      const row: RenderRow<Row> = {
        id: 1,
        depth: 0,
        kind: 'row',
        data: { id: 1, name: 'Ada' },
        index: 0,
      };
      expectTypeOf(row).toEqualTypeOf<RenderRow<Row>>();
    });
  });

  it('parentId is RowId | undefined, not RowId', () => {
    typecheckOnly(() => {
      expectTypeOf<RenderRow<Row>['parentId']>().toEqualTypeOf<RowId | undefined>();
    });
  });

  it('assigning a non-RowId to parentId is a compile error', () => {
    typecheckOnly(() => {
      const row: RenderRow<Row> = {
        id: 1,
        depth: 0,
        kind: 'row',
        data: { id: 1, name: 'Ada' },
        index: 0,
        // @ts-expect-error — parentId is RowId | undefined (string | number | undefined); a
        // boolean is none of those.
        parentId: true,
      };
      expectTypeOf(row).toEqualTypeOf<RenderRow<Row>>();
    });
  });
});
