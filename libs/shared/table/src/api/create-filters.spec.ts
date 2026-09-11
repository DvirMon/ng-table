import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
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
import type { FiltersPath } from './filters.types';

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
