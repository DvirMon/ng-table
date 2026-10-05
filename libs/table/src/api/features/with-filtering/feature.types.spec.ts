import { describe, expectTypeOf, it } from 'vitest';
import { createColumns } from '../../create-columns';
import { createTable } from '../../create-table';
import { composeFeatures } from '../compose-features';
import { withGrouping } from '../with-grouping/feature';
import { withSorting } from '../with-sorting';
import { withFiltering } from './feature';
import { anyOf, contains, equals, filter, hasAny, hasNone, inDateRange, inRange } from './rules';
import type { DateRangeCriterion, RangeCriterion } from './rules';
import type { Filters, FiltersPath } from './types';
import type { ColumnValues, TableDataInput } from '../../types';

/**
 * Compile-time seam for `withFiltering()`'s `schema` config, composed into a real
 * `createTable()` — `RowOf<In>` is what supplies `TRow` to the schema fn, so a probe against
 * the feature builder alone would not exercise the inference path a consumer actually takes.
 * Sibling of the runtime seam in `../../../engine/filters/build.spec.ts`.
 * **`nx run shared-table:typecheck-spec` is what enforces this file** — the runner executes
 * `expectTypeOf` and `@ts-expect-error` without typechecking either.
 *
 * Each case calls `createTable(...)` inline rather than through a shared generic helper —
 * routing the schema fn's `S` through an extra generic wrapper function left `equals()`'s
 * `TEmpty` default undischarged for `expectTypeOf(...).toEqualTypeOf(...)`, which reported a
 * spurious mismatch (`Actual: unknown`) even though assignability held. Calling `createTable`
 * directly, the same way a consumer does, does not hit this.
 *
 * `FiltersPath<TRow, TValues>` (Step 1) takes `TValues` explicitly — no default. Every schema
 * below spells it out via `ColumnValues<TRow, typeof set.columns>` (`types.ts`'s `FiltersPath`
 * doc comment) rather than leaving `path` unannotated: an unannotated `path` inside
 * `withFiltering({ schema })` does still compile (`withFiltering` has four overloads, and TS
 * resolves the object literal against one before the surrounding `createTable()` call supplies
 * `In`), but it resolves `TValues` to the fallback `ColumnValueMap`, not the real map — every
 * criterion silently reads back as `unknown` instead of its column's type. `InvoiceValues`/
 * `AccessorValues` below are that explicit spelling, shared by every case built off `columns`/
 * `accessorColumns` respectively — including the "inline" schemas, which stay inline (written
 * directly in the `withFiltering({ schema })` call) while still carrying the explicit type; only
 * the schema-as-its-own-variable case (below) differs by being hoisted to a named `const` first.
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

declare const data: TableDataInput<Invoice>;

// A real function, not `declare const` — `createColumns()` never reads it at runtime
// (`void data`, create-columns.ts), only its type binds `TRow`.
const invoiceData = (): readonly Invoice[] | undefined => undefined;

// Only the fields exercised below — this file's `columns` is a `createTable()` config slot, not
// a subject under test in its own right; derivation is `create-columns.types.spec.ts`'s.
const columns = createColumns(invoiceData, (col) => [
  col('status'),
  col('amount'),
  col('dueDate'),
  col('customer'),
  col('notes'),
  col('tags'),
]);

/** `FiltersPath<Invoice, ...>`'s explicit `TValues` — every `Invoice`-based case below. */
type InvoiceValues = ColumnValues<Invoice, typeof columns.columns>;

// Ticket's own column set, so `ticketPath` spells `TValues` the same explicit way, rather than
// a hand-written object-literal map.
const ticketData = (): readonly Ticket[] | undefined => undefined;
const ticketColumns = createColumns(ticketData, (col) => [col('subject')]);
declare const ticketPath: FiltersPath<Ticket, ColumnValues<Ticket, typeof ticketColumns.columns>>;

describe('withFiltering — each rule infers exactly through StateOf', () => {
  it('equals infers TRow[K] | null', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'customer', columns },
        withFiltering({
          schema: (path: FiltersPath<Invoice, InvoiceValues>) => ({
            status: equals(path.status),
          }),
        }),
      );
      expectTypeOf(table.filters.status().value()).toEqualTypeOf<string | null>();
    });
  });

  it('contains infers string', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'customer', columns },
        withFiltering({
          schema: (path: FiltersPath<Invoice, InvoiceValues>) => ({
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
          schema: (path: FiltersPath<Invoice, InvoiceValues>) => ({
            amount: inRange(path.amount),
          }),
        }),
      );
      expectTypeOf(table.filters.amount().value()).toEqualTypeOf<RangeCriterion>();
    });
  });

  it('inDateRange infers DateRangeCriterion', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'customer', columns },
        withFiltering({
          schema: (path: FiltersPath<Invoice, InvoiceValues>) => ({
            dueDate: inDateRange(path.dueDate),
          }),
        }),
      );
      expectTypeOf(table.filters.dueDate().value()).toEqualTypeOf<DateRangeCriterion>();
    });
  });

  it('hasAny infers readonly TItem[] from the cell element type', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'customer', columns },
        withFiltering({
          schema: (path: FiltersPath<Invoice, InvoiceValues>) => ({
            tags: hasAny(path.tags),
          }),
        }),
      );
      expectTypeOf(table.filters.tags().value()).toEqualTypeOf<readonly string[]>();
    });
  });

  it('hasNone infers readonly TItem[] from the cell element type', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'customer', columns },
        withFiltering({
          schema: (path: FiltersPath<Invoice, InvoiceValues>) => ({
            tags: hasNone(path.tags),
          }),
        }),
      );
      expectTypeOf(table.filters.tags().value()).toEqualTypeOf<readonly string[]>();
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
          schema: (path: FiltersPath<Invoice, InvoiceValues>) => ({
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
          schema: (path: FiltersPath<Invoice, InvoiceValues>) => ({
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
          schema: (path: FiltersPath<Invoice, InvoiceValues>) => ({
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

describe('withFiltering — a misspelled path id is rejected', () => {
  it('rejects it inline', () => {
    typecheckOnly(() => {
      createTable(
        data,
        { trackBy: 'customer', columns },
        withFiltering({
          schema: (path: FiltersPath<Invoice, InvoiceValues>) => ({
            // @ts-expect-error — 'custmer' is not a declared column id (typo for 'customer').
            search: contains(path.custmer),
          }),
        }),
      );
    });
  });

  it('rejects it in a schema written as its own variable', () => {
    typecheckOnly(() => {
      // Hoisted to its own `const`, unlike every inline case above — still spells `TValues`
      // explicitly the same way (`types.ts`'s `FiltersPath` doc comment).
      const schema = (path: FiltersPath<Invoice, InvoiceValues>) => ({
        // @ts-expect-error — 'custmer' is not a declared column id (typo for 'customer').
        search: contains(path.custmer),
      });

      createTable(data, { trackBy: 'customer', columns }, withFiltering({ schema }));
    });
  });
});

describe("withFiltering — FiltersPath's TValues is required (Step 1)", () => {
  it('rejects the one-argument form', () => {
    typecheckOnly(() => {
      function acceptsOneArgPath(
        // @ts-expect-error — FiltersPath takes two type arguments; TValues has no default.
        // Giving TValues a default would make this line stop erroring — exactly what
        // Acceptance Check 3 pins against.
        _path: FiltersPath<Invoice>,
      ): void {}
      void acceptsOneArgPath;
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
          schema: (path: FiltersPath<Invoice, InvoiceValues>) => ({
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
          schema: (path: FiltersPath<Invoice, InvoiceValues>) => ({
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
          schema: (path: FiltersPath<Invoice, InvoiceValues>) => ({
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
      const table = createTable(data, { trackBy: 'customer', columns }, withFiltering());
      // @ts-expect-error — no `schema` means the feature contributes no `filters` member.
      table.filters;
    });
  });
});

// --- Step 6 additions: StateOf<S> off an accessor-typed column ------------------------------
//
// `AccessorRow` mirrors `create-table.types.spec.ts`'s `CarriageRow` shape: an accessor column
// whose resolved type differs from its own row field, so a case can tell "derived through
// StateOf off the accessor" apart from "flattened to the row field type". `owner` and `roles`
// each declare an accessor; `status` declares none, so it defaults to `AccessorRow['status']`.

interface Owner {
  name: string;
  email: string;
}

interface Role {
  id: string;
  label: string;
}

type Status = 'draft' | 'paid' | 'overdue';

interface AccessorRow {
  id: string;
  owner: Owner;
  status: Status;
  roles: Role[];
}

declare const accessorTableData: TableDataInput<AccessorRow>;

// A real function, not `declare const` — same reasoning as `invoiceData` above.
const accessorRowData = (): readonly AccessorRow[] | undefined => undefined;

const accessorColumns = createColumns(accessorRowData, (col) => [
  col('owner', { accessor: (row) => row.owner.name }),
  col('status'),
  col('roles', { accessor: (row) => row.roles.map((role) => role.id) }),
]);

/** `FiltersPath<AccessorRow, ...>`'s explicit `TValues` — every accessor case below. */
type AccessorValues = ColumnValues<AccessorRow, typeof accessorColumns.columns>;

describe('withFiltering — StateOf<S> reads the accessor, not the row field', () => {
  it('an accessor-typed criterion narrows to the accessor return type', () => {
    typecheckOnly(() => {
      const table = createTable(
        accessorTableData,
        { trackBy: 'id', columns: accessorColumns },
        withFiltering({
          schema: (path: FiltersPath<AccessorRow, AccessorValues>) => ({
            owner: equals(path.owner),
          }),
        }),
      );
      // `string | null` — the accessor's own return type, not `Owner | null` (the row's `owner`
      // field). Fails if Step 1's `V` phantom on `FilterHandle` is reverted to `unknown`
      // (Acceptance Check 2).
      expectTypeOf(table.filters.owner().value()).toEqualTypeOf<string | null>();
    });
  });

  it('a defaulted column keeps its field type', () => {
    typecheckOnly(() => {
      const table = createTable(
        accessorTableData,
        { trackBy: 'id', columns: accessorColumns },
        withFiltering({
          schema: (path: FiltersPath<AccessorRow, AccessorValues>) => ({
            status: equals(path.status),
          }),
        }),
      );
      expectTypeOf(table.filters.status().value()).toEqualTypeOf<Status | null>();
    });
  });

  it('hasAny over an array-valued accessor infers the accessor element type', () => {
    typecheckOnly(() => {
      const table = createTable(
        accessorTableData,
        { trackBy: 'id', columns: accessorColumns },
        withFiltering({
          schema: (path: FiltersPath<AccessorRow, AccessorValues>) => ({
            roles: hasAny(path.roles),
          }),
        }),
      );
      // The accessor maps to `string[]` (role ids) — not the row's own `Role[]` field. `ItemOf`
      // reads off the accessor's resolved element type.
      expectTypeOf(table.filters.roles().value()).toEqualTypeOf<readonly string[]>();
    });
  });
});

// --- Step 6 additions: composition with withGrouping / withSorting --------------------------

describe('withFiltering — composes with withGrouping and withSorting, in either order', () => {
  it('withFiltering before withGrouping: both members are typed', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'customer', columns },
        withFiltering({
          schema: (path: FiltersPath<Invoice, InvoiceValues>) => ({
            status: equals(path.status),
          }),
        }),
        withGrouping(),
      );
      expectTypeOf(table.filters.status().value()).toEqualTypeOf<string | null>();
      expectTypeOf(table.grouping()).toEqualTypeOf<string[]>();
    });
  });

  it('withGrouping before withFiltering: both members are typed', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'customer', columns },
        withGrouping(),
        withFiltering({
          schema: (path: FiltersPath<Invoice, InvoiceValues>) => ({
            status: equals(path.status),
          }),
        }),
      );
      expectTypeOf(table.filters.status().value()).toEqualTypeOf<string | null>();
      expectTypeOf(table.grouping()).toEqualTypeOf<string[]>();
    });
  });

  it('withFiltering before withSorting: both members are typed', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'customer', columns },
        withFiltering({
          schema: (path: FiltersPath<Invoice, InvoiceValues>) => ({
            status: equals(path.status),
          }),
        }),
        withSorting(),
      );
      expectTypeOf(table.filters.status().value()).toEqualTypeOf<string | null>();
      table.toggleSort('status');
    });
  });

  it('withSorting before withFiltering: both members are typed', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'customer', columns },
        withSorting(),
        withFiltering({
          schema: (path: FiltersPath<Invoice, InvoiceValues>) => ({
            status: equals(path.status),
          }),
        }),
      );
      expectTypeOf(table.filters.status().value()).toEqualTypeOf<string | null>();
      table.toggleSort('status');
    });
  });

  it('composeFeatures(withFiltering, withGrouping): both members are typed', () => {
    typecheckOnly(() => {
      const table = createTable(
        data,
        { trackBy: 'customer', columns },
        composeFeatures(
          withFiltering({
            schema: (path: FiltersPath<Invoice, InvoiceValues>) => ({
              status: equals(path.status),
            }),
          }),
          withGrouping(),
        ),
      );
      expectTypeOf(table.filters.status().value()).toEqualTypeOf<string | null>();
      expectTypeOf(table.grouping()).toEqualTypeOf<string[]>();
    });
  });
});
