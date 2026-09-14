import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { createFilterEvaluator, createFilters } from './create-filters';
import {
  anyOf,
  applyWhen,
  contains,
  equals,
  filter,
  hasAny,
  hasNone,
  inDateRange,
  inRange,
} from './filters/rules';
import { hasAnyOf, hasNoneOf } from './filters/matchers';
import type { Filters, FiltersPath } from './filters.types';

interface Invoice {
  status: string;
  isArchived: boolean;
  amount: number;
  dueDate: Date;
  customer: string;
  notes: string;
  tags: string[];
  category: string | null;
  subCategory: string;
}

// A type alias (not an `interface`) so it stays a fresh object-type literal for TypeScript's
// purposes — an `interface` used as an explicit `TState` type argument fails the
// `Record<string, unknown>` constraint check with "index signature is missing", even though an
// equivalent inline literal passes.
type InvoiceFilterState = {
  status: string | null;
  amount: { min: number | null; max: number | null };
  dueDate: { from: Date | null; to: Date | null };
  search: string;
  tags: readonly string[];
  subCategory: string;
};

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    status: 'open',
    isArchived: false,
    amount: 100,
    dueDate: new Date('2026-06-01'),
    customer: 'Acme',
    notes: '',
    tags: [],
    category: null,
    subCategory: '',
    ...overrides,
  };
}

function build<TState extends Record<string, unknown>>(
  schema: (path: FiltersPath<Invoice>) => void
) {
  return TestBed.runInInjectionContext(() => createFilters<Invoice, TState>(schema));
}

describe('createFilters — schema declaration', () => {
  it('produces a correctly-keyed node per declared rule', () => {
    const filters = build<InvoiceFilterState>((path) => {
      equals(path.status);
      inRange(path.amount);
      inDateRange(path.dueDate);
      anyOf<Invoice>('search', (p) => {
        contains(p.customer);
        contains(p.notes);
      });
      hasAny(path.tags);
    });

    expect(filters.status().value()).toBe(null);
    expect(filters.amount().value()).toEqual({ min: null, max: null });
    expect(filters.dueDate().value()).toEqual({ from: null, to: null });
    expect(filters.search().value()).toBe('');
    expect(filters.tags().value()).toEqual([]);
  });
});

describe('createFilters — keys', () => {
  it('borrows the key from a single path', () => {
    const filters = build<InvoiceFilterState>((path) => {
      equals(path.status);
    });
    expect(filters.status().value()).toBe(null);
  });

  it('as overrides the borrowed key', () => {
    const filters = build<{ due: { from: Date | null; to: Date | null } }>((path) => {
      inDateRange(path.dueDate, { as: 'due' });
    });
    expect(filters.due().value()).toEqual({ from: null, to: null });
  });

  it('rejects a widened `string` variable for `as` at compile time (filters.md: "must be a string literal")', () => {
    build<InvoiceFilterState>((path) => {
      const dynamicName = String('status'); // widened to `string`, not a literal
      // @ts-expect-error — `as` must be a string literal, not a `string`-typed variable (R32 fix).
      equals(path.status, { as: dynamicName });
    });
  });

  it('anyOf takes its key positionally, never borrowed from a path', () => {
    const filters = build<{ search: string }>((path) => {
      anyOf<Invoice>('search', (p) => {
        contains(p.customer);
      });
    });
    expect(filters.search().value()).toBe('');
  });
});

describe('createFilters — one filter per path', () => {
  it('throws when two rules target the same path, even with different `as` names', () => {
    expect(() =>
      build((path) => {
        hasAny(path.tags, { as: 'included' });
        hasNone(path.tags, { as: 'excluded' });
      })
    ).toThrow();
  });

  it('does not throw for a compound filter() over one path', () => {
    expect(() =>
      build((path) => {
        filter(
          path.tags,
          (cell: string[], c: { include: string[]; exclude: string[] }) =>
            hasAnyOf(cell, c.include) && hasNoneOf(cell, c.exclude),
          { emptyValue: { include: [], exclude: [] }, isEmpty: (c) => c.include.length === 0 && c.exclude.length === 0 }
        );
      })
    ).not.toThrow();
  });
});

describe('createFilters — duplicate keys', () => {
  it('throws when two `as` values collide', () => {
    expect(() =>
      build((path) => {
        equals(path.status, { as: 'shared' });
        contains(path.customer, { as: 'shared' });
      })
    ).toThrow();
  });

  it('throws when an `as` collides with a borrowed key', () => {
    expect(() =>
      build((path) => {
        equals(path.status);
        contains(path.customer, { as: 'status' });
      })
    ).toThrow();
  });
});

describe('createFilters — anyOf without rules', () => {
  it('throws when anyOf declares no rules', () => {
    expect(() =>
      build((_path) => {
        anyOf('search', () => {
          // intentionally empty
        });
      })
    ).toThrow();
  });
});

describe('createFilters — state semantics', () => {
  it('value() returns the complete shape', () => {
    const filters = build<InvoiceFilterState>((path) => {
      equals(path.status);
      contains(path.customer, { as: 'search' });
    });
    expect(filters().value()).toEqual({ status: null, search: '' });
  });

  it('active() omits empty entries', () => {
    const filters = build<{ status: string | null; search: string }>((path) => {
      equals(path.status);
      contains(path.customer, { as: 'search' });
    });
    filters.status().value.set('open');
    expect(filters().active()).toEqual({ status: 'open' });
  });

  it('reset() with no arg reverts to source, or empty when no source', () => {
    const filters = build<{ status: string | null }>((path) => {
      equals(path.status);
    });
    filters.status().value.set('closed');
    filters.status().reset();
    expect(filters.status().value()).toBe(null);
  });

  it('reset(null) sets the empty value', () => {
    const filters = build<{ status: string | null }>((path) => {
      equals(path.status);
    });
    filters.status().value.set('closed');
    filters.status().reset(null);
    expect(filters.status().value()).toBe(null);
  });

  it('reset(value) sets an arbitrary value', () => {
    const filters = build<{ amount: { min: number | null; max: number | null } }>((path) => {
      inRange(path.amount);
    });
    filters.amount().reset({ min: 0, max: 500 });
    expect(filters.amount().value()).toEqual({ min: 0, max: 500 });
  });

  it('dirty() is false untouched and true once written', () => {
    const filters = build<{ status: string | null }>((path) => {
      equals(path.status);
    });
    expect(filters.status().dirty()).toBe(false);
    filters.status().value.set('open');
    expect(filters.status().dirty()).toBe(true);
  });
});

describe('createFilters — emptyValue override', () => {
  it("seeds the node with the declared empty value instead of the rule's own", () => {
    const filters = build<{ status: string }>((path) => {
      equals(path.status, { emptyValue: '' });
    });
    expect(filters.status().value()).toBe('');
  });

  it("treats the declared empty value as empty — a native <select>'s '' deactivates the filter", () => {
    const filters = build<{ status: string }>((path) => {
      equals(path.status, { emptyValue: '' });
    });
    filters.status().value.set('open');
    expect(filters().active()).toEqual({ status: 'open' });

    filters.status().value.set('');
    expect(filters().active()).toEqual({});
    expect(filters.status().active()).toBeUndefined();
  });

  it("no longer treats the rule's own empty value as empty once overridden", () => {
    const filters = build<{ status: string | null }>((path) => {
      equals(path.status, { emptyValue: '' });
    });
    filters.status().value.set(null);
    expect(filters().active()).toEqual({ status: null });
  });

  it('reset(null) returns to the declared empty value', () => {
    const filters = build<{ status: string }>((path) => {
      equals(path.status, { emptyValue: '' });
    });
    filters.status().value.set('open');
    filters.status().reset(null);
    expect(filters.status().value()).toBe('');
  });

  it('compares structurally, so an object empty value works on any rule', () => {
    const filters = build<{ amount: { min: number | null; max: number | null } }>((path) => {
      inRange(path.amount, { emptyValue: { min: 0, max: null } });
    });
    expect(filters().active()).toEqual({});
    filters.amount().value.set({ min: 100, max: null });
    expect(filters().active()).toEqual({ amount: { min: 100, max: null } });
  });

  it('an explicit isEmpty still wins over emptyValue on filter()', () => {
    const filters = build<{ tags: readonly string[] }>((path) => {
      filter(path.tags, (cell, criterion: readonly string[]) => hasAnyOf(cell, criterion), {
        emptyValue: ['none'],
        isEmpty: (criterion) => criterion.length === 0,
      });
    });
    expect(filters.tags().value()).toEqual(['none']);
    expect(filters().active()).toEqual({ tags: ['none'] });
    filters.tags().value.set([]);
    expect(filters().active()).toEqual({});
  });
});

describe('createFilters — sources', () => {
  it('untouched with no source: not dirty, not in active()', () => {
    const filters = build<{ status: string | null }>((path) => {
      equals(path.status);
    });
    expect(filters.status().dirty()).toBe(false);
    expect(filters().active()).toEqual({});
  });

  it('untouched with a source present: not dirty, is in active()', () => {
    const bounds = signal({ min: 0, max: 10000 });
    const filters = build<{ amount: { min: number | null; max: number | null } }>((path) => {
      inRange(path.amount, { source: () => bounds() });
    });
    expect(filters.amount().dirty()).toBe(false);
    expect(filters().active()).toEqual({ amount: { min: 0, max: 10000 } });
  });

  it('a user write makes it dirty and keeps it in active()', () => {
    const bounds = signal({ min: 0, max: 10000 });
    const filters = build<{ amount: { min: number | null; max: number | null } }>((path) => {
      inRange(path.amount, { source: () => bounds() });
    });
    filters.amount().value.set({ min: 100, max: 500 });
    expect(filters.amount().dirty()).toBe(true);
    expect(filters().active()).toEqual({ amount: { min: 100, max: 500 } });
  });

  it('writing exactly the source value is dirty=false but still active', () => {
    const bounds = signal({ min: 0, max: 10000 });
    const filters = build<{ amount: { min: number | null; max: number | null } }>((path) => {
      inRange(path.amount, { source: () => bounds() });
    });
    filters.amount().value.set({ min: 0, max: 10000 });
    expect(filters.amount().dirty()).toBe(false);
    expect(filters().active()).toEqual({ amount: { min: 0, max: 10000 } });
  });

  it('reset(null) is dirty and removed from active()', () => {
    const bounds = signal({ min: 0, max: 10000 });
    const filters = build<{ amount: { min: number | null; max: number | null } }>((path) => {
      inRange(path.amount, { source: () => bounds() });
    });
    filters.amount().reset(null);
    expect(filters.amount().dirty()).toBe(true);
    expect(filters().active()).toEqual({});
  });

  it('a later source change does not stomp a dirty filter value', () => {
    const bounds = signal({ min: 0, max: 10000 });
    const filters = build<{ amount: { min: number | null; max: number | null } }>((path) => {
      inRange(path.amount, { source: () => bounds() });
    });
    filters.amount().value.set({ min: 100, max: 500 });
    bounds.set({ min: 0, max: 20000 });
    TestBed.flushEffects();
    expect(filters.amount().value()).toEqual({ min: 100, max: 500 });
  });
});

describe('createFilters — combination semantics (via the safe-evaluate guard)', () => {
  it('ORs an anyOf group across its children', () => {
    const filters = build<{ search: string }>((path) => {
      anyOf<Invoice>('search', (p) => {
        contains(p.customer);
        contains(p.notes);
      });
    });
    filters.search().value.set('acme');
    const evaluator = createFilterEvaluator(filters);

    expect(evaluator.matchesRow(invoice({ customer: 'Acme Corp', notes: '' }))).toBe(true);
    expect(evaluator.matchesRow(invoice({ customer: 'Globex', notes: 'contact acme' }))).toBe(true);
    expect(evaluator.matchesRow(invoice({ customer: 'Globex', notes: '' }))).toBe(false);
  });

  it('ANDs separate filters across the root', () => {
    const filters = build<{ status: string | null; search: string }>((path) => {
      equals(path.status);
      contains(path.customer, { as: 'search' });
    });
    filters.status().value.set('open');
    filters.search().value.set('acme');
    const evaluator = createFilterEvaluator(filters);

    expect(evaluator.matchesRow(invoice({ status: 'open', customer: 'Acme Corp' }))).toBe(true);
    expect(evaluator.matchesRow(invoice({ status: 'closed', customer: 'Acme Corp' }))).toBe(false);
    expect(evaluator.matchesRow(invoice({ status: 'open', customer: 'Globex' }))).toBe(false);
  });
});

describe('createFilters — null/undefined cells', () => {
  it('a positive matcher fails a nullable cell', () => {
    const filters = build<{ subCategory: string }>((path) => {
      equals(path.subCategory);
    });
    filters.subCategory().value.set('widgets');
    const evaluator = createFilterEvaluator(filters);
    expect(
      evaluator.matchesRow(invoice({ subCategory: undefined as unknown as string }))
    ).toBe(false);
  });

  it('hasNone passes a nullable/empty array cell', () => {
    const filters = build<{ tags: readonly string[] }>((path) => {
      hasNone(path.tags);
    });
    filters.tags().value.set(['urgent']);
    const evaluator = createFilterEvaluator(filters);
    expect(evaluator.matchesRow(invoice({ tags: undefined as unknown as string[] }))).toBe(true);
  });

  it('a custom filter() predicate receives the cell unguarded and can match nulls', () => {
    const filters = build<{ notes: boolean }>((path) => {
      filter(path.notes, (cell: string, want: boolean) => want === (cell == null || cell === ''), {
        emptyValue: false,
      });
    });
    filters.notes().value.set(true);
    const evaluator = createFilterEvaluator(filters);
    expect(evaluator.matchesRow(invoice({ notes: undefined as unknown as string }))).toBe(true);
    expect(evaluator.matchesRow(invoice({ notes: 'has content' }))).toBe(false);
  });
});

describe('createFilters — errors (ADR-0014)', () => {
  it('a throwing predicate deactivates only its own filter and is reported once per evaluator, not per row', () => {
    const reportSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const filters = build<{ status: string | null; broken: string }>((path) => {
        equals(path.status);
        filter(
          path.customer,
          () => {
            throw new Error('boom');
          },
          { emptyValue: 'x', isEmpty: () => false, as: 'broken' }
        );
      });
      filters.status().value.set('open');
      const evaluator = createFilterEvaluator(filters);

      const row = invoice({ status: 'open' });
      expect(evaluator.matchesRow(row)).toBe(true);
      expect(evaluator.matchesRow(row)).toBe(true);
      expect(evaluator.matchesRow(row)).toBe(true);

      expect(reportSpy).toHaveBeenCalledTimes(1);
    } finally {
      reportSpy.mockRestore();
    }
  });

  it('a failed filter still appears in active()', () => {
    const reportSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const filters = build<{ broken: string }>((path) => {
        filter(
          path.customer,
          () => {
            throw new Error('boom');
          },
          { emptyValue: 'x', isEmpty: () => false, as: 'broken' }
        );
      });
      expect(filters().active()).toEqual({ broken: 'x' });
    } finally {
      reportSpy.mockRestore();
    }
  });

  it('other filters keep narrowing when one throws', () => {
    const reportSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const filters = build<{ status: string | null; broken: string }>((path) => {
        equals(path.status);
        filter(
          path.customer,
          () => {
            throw new Error('boom');
          },
          { emptyValue: 'x', isEmpty: () => false, as: 'broken' }
        );
      });
      filters.status().value.set('closed');
      const evaluator = createFilterEvaluator(filters);
      expect(evaluator.matchesRow(invoice({ status: 'open' }))).toBe(false);
    } finally {
      reportSpy.mockRestore();
    }
  });
});

describe('createFilters — applyWhen', () => {
  it('excludes the gated rule from active() while the condition is false', () => {
    const filters = build<{ category: string | null; subCategory: string }>((path) => {
      equals(path.category);
      applyWhen(
        path,
        ({ valueOf }) => valueOf(path.category) !== null,
        (p) => {
          equals(p.subCategory);
        }
      );
    });
    filters.subCategory().value.set('widgets');
    expect(filters().active()).toEqual({});
  });

  it('includes the gated rule once the condition becomes true, without redeclaring the schema', () => {
    const filters = build<{ category: string | null; subCategory: string }>((path) => {
      equals(path.category);
      applyWhen(
        path,
        ({ valueOf }) => valueOf(path.category) !== null,
        (p) => {
          equals(p.subCategory);
        }
      );
    });
    filters.subCategory().value.set('widgets');
    expect(filters().active()).toEqual({});

    filters.category().value.set('electronics');
    expect(filters().active()).toEqual({ category: 'electronics', subCategory: 'widgets' });
  });
});

describe('createFilters — matcher()', () => {
  type BrokenFilterState = { status: string | null; broken: string };

  function buildBrokenFilters(): Filters<Invoice, BrokenFilterState> {
    return build<BrokenFilterState>((path) => {
      equals(path.status);
      filter(
        path.customer,
        () => {
          throw new Error('boom');
        },
        { emptyValue: 'x', isEmpty: () => false, as: 'broken' }
      );
    });
  }

  function brokenRows(): Invoice[] {
    return [
      invoice({ status: 'open', customer: 'Acme' }),
      invoice({ status: 'closed', customer: 'Globex' }),
      invoice({ status: 'open', customer: 'Initech' }),
    ];
  }

  it('filters a plain array with no table composed at all', () => {
    const filters = build<{ status: string | null }>((path) => {
      equals(path.status);
    });
    filters.status().value.set('open');

    const rows = [
      invoice({ status: 'open', customer: 'Acme' }),
      invoice({ status: 'closed', customer: 'Globex' }),
      invoice({ status: 'open', customer: 'Initech' }),
    ];

    expect(rows.filter(filters().matcher()).map((row) => row.customer)).toEqual([
      'Acme',
      'Initech',
    ]);
  });

  it('reflects the criteria current at the moment it was requested', () => {
    const filters = build<{ status: string | null }>((path) => {
      equals(path.status);
    });

    filters.status().value.set('open');
    const matchesOpen = filters().matcher();
    expect(matchesOpen(invoice({ status: 'open' }))).toBe(true);
    expect(matchesOpen(invoice({ status: 'closed' }))).toBe(false);

    filters.status().value.set('closed');
    const matchesClosed = filters().matcher();
    expect(matchesClosed(invoice({ status: 'closed' }))).toBe(true);
    expect(matchesClosed(invoice({ status: 'open' }))).toBe(false);
  });

  it('skips an empty criterion rather than narrowing to nothing', () => {
    const filters = build<{ status: string | null; search: string }>((path) => {
      equals(path.status);
      contains(path.customer, { as: 'search' });
    });
    filters.status().value.set('open');

    const rows = [invoice({ status: 'open' }), invoice({ status: 'closed' })];

    expect(rows.filter(filters().matcher())).toHaveLength(1);
  });

  it('ORs an anyOf group across its children', () => {
    const filters = build<{ search: string }>(() => {
      anyOf<Invoice>('search', (p) => {
        contains(p.customer);
        contains(p.notes);
      });
    });
    filters.search().value.set('acme');
    const matches = filters().matcher();

    expect(matches(invoice({ customer: 'Acme Corp', notes: '' }))).toBe(true);
    expect(matches(invoice({ customer: 'Globex', notes: 'contact acme' }))).toBe(true);
    expect(matches(invoice({ customer: 'Globex', notes: '' }))).toBe(false);
  });

  it('ANDs separate filters across the root', () => {
    const filters = build<{ status: string | null; search: string }>((path) => {
      equals(path.status);
      contains(path.customer, { as: 'search' });
    });
    filters.status().value.set('open');
    filters.search().value.set('acme');
    const matches = filters().matcher();

    expect(matches(invoice({ status: 'open', customer: 'Acme Corp' }))).toBe(true);
    expect(matches(invoice({ status: 'closed', customer: 'Acme Corp' }))).toBe(false);
    expect(matches(invoice({ status: 'open', customer: 'Globex' }))).toBe(false);
  });

  it('does not narrow through a filter applyWhen has gated off', () => {
    const filters = build<{ category: string | null; subCategory: string }>((path) => {
      equals(path.category);
      applyWhen(
        path,
        ({ valueOf }) => valueOf(path.category) !== null,
        (p) => {
          equals(p.subCategory);
        }
      );
    });
    filters.subCategory().value.set('widgets');

    const gatedOff = filters().matcher();
    expect(gatedOff(invoice({ category: null, subCategory: 'gadgets' }))).toBe(true);

    filters.category().value.set('electronics');
    const gatedOn = filters().matcher();
    expect(gatedOn(invoice({ category: 'electronics', subCategory: 'gadgets' }))).toBe(false);
  });

  it('fails a positive matcher on a null cell', () => {
    const filters = build<{ category: string | null }>((path) => {
      equals(path.category);
    });
    filters.category().value.set('electronics');
    const matches = filters().matcher();

    expect(matches(invoice({ category: null }))).toBe(false);
    expect(matches(invoice({ category: 'electronics' }))).toBe(true);
  });

  describe('errors (ADR-0014)', () => {
    it('reports a throwing predicate once per matcher, under its own key, while siblings keep narrowing', () => {
      const reportSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const filters = buildBrokenFilters();
        filters.status().value.set('open');

        // A propagating throw would take the whole `filter()` pass down.
        const matched = brokenRows().filter(filters().matcher());

        expect(matched.map((row) => row.customer)).toEqual(['Acme', 'Initech']);
        expect(reportSpy).toHaveBeenCalledTimes(1);
        expect(String(reportSpy.mock.calls[0]?.[0])).toContain('filter "broken"');
      } finally {
        reportSpy.mockRestore();
      }
    });

    it('gives each matcher() call its own dedup scope', () => {
      const reportSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const filters = buildBrokenFilters();
        const rows = brokenRows();

        rows.filter(filters().matcher());
        expect(reportSpy).toHaveBeenCalledTimes(1);

        rows.filter(filters().matcher());
        expect(reportSpy).toHaveBeenCalledTimes(2);
      } finally {
        reportSpy.mockRestore();
      }
    });
  });

  // Type-level assertions. Vitest does not typecheck `expectTypeOf`/`@ts-expect-error` at
  // runtime — `tsc -p libs/shared/table/tsconfig.spec.json --noEmit` is what enforces these.
  describe('types', () => {
    /** Separately declared, same shape — the predicate correlates structurally, not nominally. */
    type InvoiceShape = { [K in keyof Invoice]: Invoice[K] };

    interface AuditedInvoice extends Invoice {
      auditedBy: string;
    }

    /** A concrete `TState`, so criteria stay typed instead of widening back to `unknown`. */
    type TypedInvoiceFilterState = { status: string | null; category: string | null };

    function buildTypedFilters(): Filters<Invoice, TypedInvoiceFilterState> {
      return build<TypedInvoiceFilterState>((path) => {
        equals(path.status);
        equals(path.category);
      });
    }

    it('accepts a structurally identical row type and a wider one carrying extra fields', () => {
      const matches = buildTypedFilters()().matcher();
      const identical: InvoiceShape = invoice();
      const wider: AuditedInvoice = { ...invoice(), auditedBy: 'ann' };

      expectTypeOf(matches).toEqualTypeOf<(row: Invoice) => boolean>();
      expect(matches(identical)).toBe(true);
      expect(matches(wider)).toBe(true);
    });

    it('rejects an unrelated row type', () => {
      const matches = buildTypedFilters()().matcher();
      // @ts-expect-error — `matcher()` is `(row: Invoice) => boolean`; TRow is no longer phantom.
      matches({ label: 'nope' });
    });

    it('keeps a concretely-keyed criterion map typed and reachable by property access', () => {
      const filters = buildTypedFilters();

      expectTypeOf(filters.status().value()).toEqualTypeOf<string | null>();
      expectTypeOf(filters().value()).toEqualTypeOf<TypedInvoiceFilterState>();
      expectTypeOf(filters().active()).toEqualTypeOf<Partial<TypedInvoiceFilterState>>();
    });

    it('narrows a plain array via matcher() once a criterion is set through property access', () => {
      const filters = buildTypedFilters();
      filters.status().value.set('open');

      const rows = [
        invoice({ status: 'open', customer: 'Acme' }),
        invoice({ status: 'closed', customer: 'Globex' }),
        invoice({ status: 'open', customer: 'Initech' }),
      ];

      expect(rows.filter(filters().matcher()).map((row) => row.customer)).toEqual([
        'Acme',
        'Initech',
      ]);
    });
  });
});
