import { describe, expectTypeOf, it } from 'vitest';
import { createTable } from '../../create-table';
import { withFiltering } from './feature';
import {
  anyOf,
  contains,
  equals,
  filter,
  hasAny,
  hasNone,
  inDateRange,
  inRange,
} from './rules';
import type { DateRangeCriterion, RangeCriterion } from './rules';
import type { Filters, FiltersPath } from './types';
import type { ColumnDef, TableDataInput } from '../../types';

/**
 * Compile-time seam for `withFiltering()`'s `schema` config, composed into a real
 * `createTable()` — `RowOf<In>` is what supplies `TRow` to the schema fn, so a probe against
 * the feature builder alone would not exercise the inference path a consumer actually takes.
 * Sibling of the runtime seam in `../../../engine/filters/create-filters.spec.ts`.
 * **`nx run shared-table:typecheck-spec` is what enforces this file** — the runner executes
 * `expectTypeOf` and `@ts-expect-error` without typechecking either.
 *
 * Each case calls `createTable(...)` inline rather than through a shared generic helper —
 * routing the schema fn's `S` through an extra generic wrapper function left `equals()`'s
 * `TEmpty` default undischarged for `expectTypeOf(...).toEqualTypeOf(...)`, which reported a
 * spurious mismatch (`Actual: unknown`) even though assignability held. Calling `createTable`
 * directly, the same way a consumer does, does not hit this.
 */

/** Typechecks its argument and never calls it — several bodies here throw at construction. */
function typecheckOnly(assertions: () => void): void {
  void assertions;
}

interface Invoice {
  status: string;
  amount: number;
  dueDate: Date;
  customer: string;
  notes: string;
  tags: string[];
  category: string | null;
  subCategory: string;
}

/** An unrelated row, for the group case that must not accept a child built from one. */
interface Ticket {
  subject: string;
}

declare const ticketPath: FiltersPath<Ticket>;
declare const data: TableDataInput<Invoice>;
declare const columns: ColumnDef<Invoice>[];

describe('withFiltering — each rule infers exactly through StateOf', () => {
  it('equals infers TRow[K] | null', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'customer', columns },
        withFiltering({
          schema: (path: FiltersPath<Invoice>) => ({
            status: equals(path.status),
          }),
        }),
      );
      expectTypeOf(table.filters.status().value()).toEqualTypeOf<
        string | null
      >();
    });
  });

  it('contains infers string', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'customer', columns },
        withFiltering({
          schema: (path: FiltersPath<Invoice>) => ({
            search: contains(path.customer),
          }),
        }),
      );
      expectTypeOf(table.filters.search().value()).toEqualTypeOf<string>();
    });
  });

  it('inRange infers RangeCriterion', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'customer', columns },
        withFiltering({
          schema: (path: FiltersPath<Invoice>) => ({
            amount: inRange(path.amount),
          }),
        }),
      );
      expectTypeOf(
        table.filters.amount().value(),
      ).toEqualTypeOf<RangeCriterion>();
    });
  });

  it('inDateRange infers DateRangeCriterion', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'customer', columns },
        withFiltering({
          schema: (path: FiltersPath<Invoice>) => ({
            dueDate: inDateRange(path.dueDate),
          }),
        }),
      );
      expectTypeOf(
        table.filters.dueDate().value(),
      ).toEqualTypeOf<DateRangeCriterion>();
    });
  });

  it('hasAny infers readonly TItem[] from the cell element type', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'customer', columns },
        withFiltering({
          schema: (path: FiltersPath<Invoice>) => ({ tags: hasAny(path.tags) }),
        }),
      );
      expectTypeOf(table.filters.tags().value()).toEqualTypeOf<
        readonly string[]
      >();
    });
  });

  it('hasNone infers readonly TItem[] from the cell element type', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'customer', columns },
        withFiltering({
          schema: (path: FiltersPath<Invoice>) => ({
            tags: hasNone(path.tags),
          }),
        }),
      );
      expectTypeOf(table.filters.tags().value()).toEqualTypeOf<
        readonly string[]
      >();
    });
  });

  it("filter keeps a custom predicate's criterion type through the fold", () => {
    typecheckOnly(() => {
      interface TagQuery {
        readonly include: readonly string[];
        readonly mode: 'any' | 'all';
      }

      const table = createTable(
        data,
        { trackBy: 'customer', columns },
        withFiltering({
          schema: (path: FiltersPath<Invoice>) => ({
            tags: filter(path.tags, (cell: string[], criterion: TagQuery) =>
              criterion.mode === 'all'
                ? criterion.include.every((tag) => cell.includes(tag))
                : criterion.include.some((tag) => cell.includes(tag)),
            ),
          }),
        }),
      );

      expectTypeOf(table.filters.tags().value()).toEqualTypeOf<TagQuery>();
    });
  });

  it("anyOf infers its first child's criterion", () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'customer', columns },
        withFiltering({
          schema: (path: FiltersPath<Invoice>) => ({
            search: anyOf([contains(path.customer), contains(path.notes)]),
          }),
        }),
      );
      expectTypeOf(table.filters.search().value()).toEqualTypeOf<string>();
    });
  });
});

describe('withFiltering — the schema object keys are the state keys, verbatim', () => {
  it('does not derive or widen the key from the path', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'customer', columns },
        withFiltering({
          schema: (path: FiltersPath<Invoice>) => ({
            customerSearch: contains(path.customer),
          }),
        }),
      );
      expectTypeOf(table.filters().value()).toEqualTypeOf<{
        customerSearch: string;
      }>();
    });
  });
});

describe('withFiltering — path completes on the table row keys only', () => {
  it('rejects a key not on the row', () => {
    typecheckOnly(() => {
      createTable(
        data,
        { trackBy: 'customer', columns },
        withFiltering({
          schema: (path: FiltersPath<Invoice>) => ({
            // @ts-expect-error — `bogus` is not a key of Invoice, so `path.bogus` does not exist.
            bogus: equals(path.bogus),
          }),
        }),
      );
    });
  });
});

describe('withFiltering — anyOf preserves its homogeneity checks', () => {
  it('rejects a child built from an unrelated row', () => {
    typecheckOnly(() => {
      createTable(
        data,
        { trackBy: 'customer', columns },
        withFiltering({
          schema: (path: FiltersPath<Invoice>) => ({
            search: anyOf([
              contains(path.customer),
              // @ts-expect-error — the group borrows its row type from the first child as well
              // as its criterion, so a `Ticket` child is rejected even though `contains` types
              // both `string`.
              contains(ticketPath.subject),
            ]),
          }),
        }),
      );
    });
  });

  it('rejects children with mismatched criterion types', () => {
    typecheckOnly(() => {
      createTable(
        data,
        { trackBy: 'customer', columns },
        withFiltering({
          schema: (path: FiltersPath<Invoice>) => ({
            // @ts-expect-error — the group owns one criterion signal, borrowed from its first
            // child; a range child would silently receive the `contains` string and match every
            // row.
            mixed: anyOf([contains(path.customer), inRange(path.amount)]),
          }),
        }),
      );
    });
  });
});

describe('withFiltering — table.filters is typed Filters<Invoice, StateOf<S>>', () => {
  it('exposes exactly Filters<Invoice, StateOf<S>> for a schema config', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'customer', columns },
        withFiltering({
          schema: (path: FiltersPath<Invoice>) => ({
            status: equals(path.status),
            search: contains(path.customer),
          }),
        }),
      );

      expectTypeOf(table.filters).toEqualTypeOf<
        Filters<Invoice, { status: string | null; search: string }>
      >();
    });
  });

  it('the no-schema config contributes no filters member at all', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'customer', columns },
        withFiltering(),
      );
      // @ts-expect-error — no `schema` means the feature contributes no `filters` member.
      table.filters;
    });
  });
});
