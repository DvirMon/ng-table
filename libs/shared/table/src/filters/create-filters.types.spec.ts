import type { Signal, WritableSignal } from '@angular/core';
import { describe, expectTypeOf, it } from 'vitest';
import { createFilters } from './create-filters';
import type { RangeCriterion } from './rules';
import { anyOf, applyWhen, contains, equals, filter, inRange } from './rules';
import { rowOf } from './row-of';
import type { Filters, FiltersPath } from './types';

/**
 * Compile-time seam for `createFilters()`, sibling to the runtime seam in
 * `create-filters.spec.ts`. **`nx run shared-table:typecheck-spec` is what enforces this file** —
 * the runner executes `expectTypeOf` and `@ts-expect-error` without typechecking either.
 */

/** Typechecks its argument and never calls it — several bodies here throw at construction. */
function typecheckOnly(assertions: () => void): void {
  void assertions;
}

interface Invoice {
  status: string;
  amount: number;
  customer: string;
  notes: string;
  tags: string[];
  category: string | null;
  subCategory: string;
}

/** One-rule schema shared by the carrier cases — the carrier is what each of them asserts. */
const statusOnly = (path: FiltersPath<Invoice>) => [equals(path.status)];

/** An unrelated row, for the group case that must not accept a child built from one. */
interface Ticket {
  subject: string;
}

declare const ticketPath: FiltersPath<Ticket>;

declare const rowsArray: Invoice[];
declare const rowsReadonlyArray: readonly Invoice[];
declare const rowsSignal: Signal<Invoice[]>;
declare const rowsWritableSignal: WritableSignal<Invoice[]>;
declare const rowsMaybeSignal: Signal<Invoice[] | undefined>;
declare const rowsAccessor: () => Invoice[];

describe('createFilters — the criterion map folds from the returned array', () => {
  it('takes a borrowed key, an `as` rename and a group key, each with its own criterion', () => {
    typecheckOnly(() => {
      const filters = createFilters(rowOf<Invoice>(), (path) => [
        equals(path.status),
        inRange(path.amount, { as: 'amountRange' }),
        anyOf('search', [contains(path.customer), contains(path.notes)]),
      ]);

      expectTypeOf(filters().value()).toEqualTypeOf<{
        status: string | null;
        amountRange: RangeCriterion;
        search: string;
      }>();
    });
  });

  it('reaches each criterion by property access under the same key', () => {
    typecheckOnly(() => {
      const filters = createFilters(rowOf<Invoice>(), (path) => [
        equals(path.status),
        inRange(path.amount, { as: 'amountRange' }),
        anyOf('search', [contains(path.customer), contains(path.notes)]),
      ]);

      expectTypeOf(filters.status().value()).toEqualTypeOf<string | null>();
      expectTypeOf(filters.amountRange().value()).toEqualTypeOf<RangeCriterion>();
      expectTypeOf(filters.search().value()).toEqualTypeOf<string>();
    });
  });

  it('keeps a custom predicate criterion type through the fold', () => {
    typecheckOnly(() => {
      interface TagQuery {
        readonly include: readonly string[];
        readonly mode: 'any' | 'all';
      }

      const filters = createFilters(rowOf<Invoice>(), (path) => [
        filter(path.tags, (cell: string[], criterion: TagQuery) =>
          criterion.mode === 'all'
            ? criterion.include.every((tag) => cell.includes(tag))
            : criterion.include.some((tag) => cell.includes(tag))
        ),
      ]);

      expectTypeOf(filters().value()).toEqualTypeOf<{ tags: TagQuery }>();
    });
  });
});

describe('createFilters — the row carrier', () => {
  it('infers the row type from all seven accepted carriers', () => {
    typecheckOnly(() => {
      type InvoicePredicate = (row: Invoice) => boolean;

      expectTypeOf(
        createFilters(rowsArray, statusOnly)().matcher()
      ).toEqualTypeOf<InvoicePredicate>();
      expectTypeOf(
        createFilters(rowsReadonlyArray, statusOnly)().matcher()
      ).toEqualTypeOf<InvoicePredicate>();
      expectTypeOf(
        createFilters(rowsSignal, statusOnly)().matcher()
      ).toEqualTypeOf<InvoicePredicate>();
      expectTypeOf(
        createFilters(rowsWritableSignal, statusOnly)().matcher()
      ).toEqualTypeOf<InvoicePredicate>();
      expectTypeOf(
        createFilters(rowsMaybeSignal, statusOnly)().matcher()
      ).toEqualTypeOf<InvoicePredicate>();
      expectTypeOf(
        createFilters(rowsAccessor, statusOnly)().matcher()
      ).toEqualTypeOf<InvoicePredicate>();
      expectTypeOf(
        createFilters(rowOf<Invoice>(), statusOnly)().matcher()
      ).toEqualTypeOf<InvoicePredicate>();
    });
  });

  it('rejects a value that is neither row data, a rows accessor, nor the token', () => {
    typecheckOnly(() => {
      // @ts-expect-error — a number is not row data, a rows accessor, or `rowOf<Row>()`.
      createFilters(42, () => []);
      // @ts-expect-error — a bare object is not row data, a rows accessor, or `rowOf<Row>()`.
      createFilters({ foo: 1 }, () => []);
    });
  });

  it('brands the path when the carrier is empty, naming `rowOf()` in the message', () => {
    typecheckOnly(() => {
      createFilters([], (path) => {
        expectTypeOf(path).toEqualTypeOf<{
          readonly __rowTypeCouldNotBeInferred_useRowOf: 'createFilters: the first argument is empty, so the row type is unknown. Pass rowOf<Row>() instead.';
        }>();

        // @ts-expect-error — the empty carrier makes `TRow` `never`, so the first path property
        // access is the error, and the brand it lands on names the token to pass instead.
        return [equals(path.status)];
      });
    });
  });
});

describe('createFilters — `as` must be a literal', () => {
  it('rejects a widened key and accepts a literal one', () => {
    typecheckOnly(() => {
      const widenedKey = String('status');

      createFilters(rowOf<Invoice>(), (path) => [
        // @ts-expect-error — a `string`-typed variable would fold to an untyped map entry.
        equals(path.status, { as: widenedKey }),
      ]);

      const filters = createFilters(rowOf<Invoice>(), (path) => [
        equals(path.status, { as: 'state' }),
      ]);
      expectTypeOf(filters().value()).toEqualTypeOf<{ state: string | null }>();
    });
  });
});

describe('createFilters — anyOf', () => {
  it('rejects an empty group', () => {
    typecheckOnly(() => {
      createFilters(rowOf<Invoice>(), () => [
        // @ts-expect-error — `anyOf`'s non-empty tuple constraint: a group with no children has
        // no first child to borrow its criterion, `isEmpty` and `emptyValue` from.
        anyOf('search', []),
      ]);
    });
  });

  it('rejects a group whose children carry different criterion types', () => {
    typecheckOnly(() => {
      createFilters(rowOf<Invoice>(), (path) => [
        // @ts-expect-error — the group owns one criterion signal, borrowed from its first child;
        // a range child would silently receive the `contains` string and match every row.
        anyOf('mixed', [contains(path.customer), inRange(path.amount)]),
      ]);
    });
  });

  it('rejects a child built from an unrelated row, matching criterion or not', () => {
    typecheckOnly(() => {
      createFilters(rowOf<Invoice>(), (path) => [
        // @ts-expect-error — the group borrows its row type from the first child as well as its
        // criterion, so a `Ticket` child is rejected even though `contains` types both `string`.
        anyOf('search', [contains(path.customer), contains(ticketPath.subject)]),
      ]);
    });
  });
});

describe('createFilters — applyWhen', () => {
  it('lands a gated rule set as top-level keys when the node is placed directly', () => {
    typecheckOnly(() => {
      const filters = createFilters(rowOf<Invoice>(), (path) => [
        equals(path.category),
        applyWhen(path, ({ valueOf }) => valueOf(path.category) !== null, [
          equals(path.subCategory),
        ]),
      ]);

      expectTypeOf(filters().value()).toEqualTypeOf<{
        category: string | null;
        subCategory: string | null;
      }>();
    });
  });

  it('rejects a spread of the node', () => {
    typecheckOnly(() => {
      createFilters(rowOf<Invoice>(), (path) => [
        // @ts-expect-error — TS2488: `applyWhen` returns one node, not an array, and a node has
        // no `[Symbol.iterator]`. Place it directly; the spread is loud rather than silent.
        ...applyWhen(path, () => true, [equals(path.subCategory)]),
      ]);
    });
  });
});

describe('Filters — the criterion map is a required type argument', () => {
  it('rejects the one-argument form', () => {
    typecheckOnly(() => {
      // @ts-expect-error — TS2314: `Filters` takes two type arguments. `TState` has no default,
      // so a hand-written `Filters<Row>` cannot stand in for the inferred criterion map.
      type OneArgument = Filters<Invoice>;
      expectTypeOf<OneArgument>().not.toBeNever();
    });
  });
});

describe('createFilters — matcher() enforces the row type', () => {
  it('rejects an unrelated row type', () => {
    typecheckOnly(() => {
      const matches = createFilters(rowOf<Invoice>(), (path) => [
        equals(path.status),
        equals(path.category),
      ])().matcher();

      // @ts-expect-error — `matcher()` is `(row: Invoice) => boolean`, not a row-agnostic
      // predicate: `{ label: string }` shares no field with `Invoice`.
      matches({ label: 'nope' });
    });
  });
});
