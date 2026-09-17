import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { buildFilterModel } from './create-filters';
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
import { hasAnyOf, hasNoneOf } from './matchers';
import type { AnyRule, FiltersPath } from './types';

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

/** `buildFilterModel` needs no injection context — `state.ts` builds only `signal`/`computed`/
 *  `linkedSignal`, none of which require one. */
function build<S extends Record<string, AnyRule>>(
  schema: (path: FiltersPath<Invoice>) => S,
) {
  return buildFilterModel<Invoice, S>(schema);
}

describe('buildFilterModel — schema declaration', () => {
  it('produces a correctly-keyed node per declared rule', () => {
    const filters = build((path) => ({
      status: equals(path.status),
      amount: inRange(path.amount),
      dueDate: inDateRange(path.dueDate),
      search: anyOf([contains(path.customer), contains(path.notes)]),
      tags: hasAny(path.tags),
    }));

    expect(filters.status().value()).toBe(null);
    expect(filters.amount().value()).toEqual({ min: null, max: null });
    expect(filters.dueDate().value()).toEqual({ from: null, to: null });
    expect(filters.search().value()).toBe('');
    expect(filters.tags().value()).toEqual([]);
  });
});

describe('buildFilterModel — keys', () => {
  it('the schema object property names the filter, not the path', () => {
    const filters = build((path) => ({ status: equals(path.status) }));
    expect(filters.status().value()).toBe(null);
  });

  it("anyOf's key is the schema object property too — there is no separate positional key", () => {
    const filters = build((path) => ({
      search: anyOf([contains(path.customer)]),
    }));
    expect(filters.search().value()).toBe('');
  });
});

describe('buildFilterModel — one filter per path', () => {
  it('throws when two schema keys target the same path', () => {
    expect(() =>
      build((path) => ({
        included: hasAny(path.tags),
        excluded: hasNone(path.tags),
      })),
    ).toThrow();
  });

  it('does not throw for a compound filter() over one path', () => {
    expect(() =>
      build((path) => ({
        tags: filter(
          path.tags,
          (cell: string[], c: { include: string[]; exclude: string[] }) =>
            hasAnyOf(cell, c.include) && hasNoneOf(cell, c.exclude),
          {
            emptyValue: { include: [], exclude: [] },
            isEmpty: (c) => c.include.length === 0 && c.exclude.length === 0,
          },
        ),
      })),
    ).not.toThrow();
  });
});

describe('buildFilterModel — schema must return an object literal (R40)', () => {
  it('throws, naming the object form, when the schema calls rules as statements and returns nothing', () => {
    expect(() =>
      buildFilterModel<Invoice, Record<string, AnyRule>>(
        // @ts-expect-error — a schema returning `void` fails `S extends Record<string,
        // AnyRule>`; asserting the runtime backstop for an untyped caller, same pattern as
        // the anyOf-without-rules test below.
        (path) => {
          equals(path.status);
        },
      ),
    ).toThrow('return its rules as an object literal');
  });

  it('throws, naming the object form, when the schema returns an array (the pre-#124 shape)', () => {
    expect(() =>
      buildFilterModel<Invoice, Record<string, AnyRule>>(
        // @ts-expect-error — an array schema was rejected as a type once #110 landed; asserting
        // the runtime backstop for an untyped caller reaching this from JS.
        (path) => [equals(path.status)],
      ),
    ).toThrow('return its rules as an object literal');
  });
});

describe('buildFilterModel — anyOf without rules', () => {
  it('throws when anyOf declares no rules', () => {
    expect(() =>
      build((_path) => ({
        // @ts-expect-error — anyOf's non-empty-tuple constraint rejects an empty group at the
        // type level (#110); the runtime throw is the backstop for an untyped caller, asserted
        // here. The type-level rejection itself is asserted in with-filtering.types.spec.ts.
        search: anyOf([]),
      })),
    ).toThrow();
  });
});

describe('buildFilterModel — state semantics', () => {
  it('value() returns the complete shape', () => {
    const filters = build((path) => ({
      status: equals(path.status),
      search: contains(path.customer),
    }));
    expect(filters().value()).toEqual({ status: null, search: '' });
  });

  it('criteria() omits empty entries', () => {
    const filters = build((path) => ({
      status: equals(path.status),
      search: contains(path.customer),
    }));
    filters.status().value.set('open');
    expect(filters().criteria()).toEqual({ status: 'open' });
  });

  it('reset() with no arg reverts to source, or empty when no source', () => {
    const filters = build((path) => ({ status: equals(path.status) }));
    filters.status().value.set('closed');
    filters.status().reset();
    expect(filters.status().value()).toBe(null);
  });

  it('reset(null) sets the empty value', () => {
    const filters = build((path) => ({ status: equals(path.status) }));
    filters.status().value.set('closed');
    filters.status().reset(null);
    expect(filters.status().value()).toBe(null);
  });

  it('reset(value) sets an arbitrary value', () => {
    const filters = build((path) => ({ amount: inRange(path.amount) }));
    filters.amount().reset({ min: 0, max: 500 });
    expect(filters.amount().value()).toEqual({ min: 0, max: 500 });
  });

  it('dirty() is false untouched and true once written', () => {
    const filters = build((path) => ({ status: equals(path.status) }));
    expect(filters.status().dirty()).toBe(false);
    filters.status().value.set('open');
    expect(filters.status().dirty()).toBe(true);
  });
});

describe('buildFilterModel — emptyValue extends, isEmpty replaces', () => {
  it("seeds the node with the declared empty value instead of the rule's own", () => {
    const filters = build((path) => ({
      status: equals(path.status, { emptyValue: '' }),
    }));
    expect(filters.status().value()).toBe('');
  });

  it("treats the declared empty value as empty — a native <select>'s '' deactivates the filter", () => {
    const filters = build((path) => ({
      status: equals(path.status, { emptyValue: '' }),
    }));
    filters.status().value.set('open');
    expect(filters().criteria()).toEqual({ status: 'open' });

    filters.status().value.set('');
    expect(filters().criteria()).toEqual({});
    expect(filters.status().criterion()).toBeUndefined();
  });

  it("still treats the rule's own empty value as empty alongside the override", () => {
    const filters = build((path) => ({
      status: equals(path.status, { emptyValue: '' }),
    }));
    filters.status().value.set(null);
    expect(filters().criteria()).toEqual({});
    expect(filters.status().criterion()).toBeUndefined();
  });

  it('isEmpty subtracts the rule empty — null is a meaningful criterion again', () => {
    const filters = build((path) => ({
      status: equals(path.status, {
        emptyValue: '',
        isEmpty: (criterion) => criterion === '',
      }),
    }));
    filters.status().value.set(null);
    expect(filters().criteria()).toEqual({ status: null });
    filters.status().value.set('');
    expect(filters().criteria()).toEqual({});
  });

  it('reset(null) returns to the declared empty value', () => {
    const filters = build((path) => ({
      status: equals(path.status, { emptyValue: '' }),
    }));
    filters.status().value.set('open');
    filters.status().reset(null);
    expect(filters.status().value()).toBe('');
  });

  it('compares structurally, so an object empty value works on any rule', () => {
    const filters = build((path) => ({
      amount: inRange(path.amount, { emptyValue: { min: 0, max: null } }),
    }));
    expect(filters().criteria()).toEqual({});
    filters.amount().value.set({ min: 100, max: null });
    expect(filters().criteria()).toEqual({ amount: { min: 100, max: null } });
    filters.amount().value.set({ min: null, max: null });
    expect(filters().criteria()).toEqual({});
  });

  it('isEmpty is promoted to the named rules, not just filter()', () => {
    const filters = build((path) => ({
      customer: contains(path.customer, {
        isEmpty: (criterion) => criterion === '—',
      }),
    }));

    // The rule's own `''` empty is replaced outright, so it now narrows.
    filters.customer().value.set('');
    expect(filters().criteria()).toEqual({ customer: '' });

    filters.customer().value.set('—');
    expect(filters().criteria()).toEqual({});
  });

  it('an explicit isEmpty still wins over emptyValue on filter()', () => {
    const filters = build((path) => ({
      tags: filter(
        path.tags,
        (cell, criterion: readonly string[]) => hasAnyOf(cell, criterion),
        {
          emptyValue: ['none'],
          isEmpty: (criterion) => criterion.length === 0,
        },
      ),
    }));
    expect(filters.tags().value()).toEqual(['none']);
    expect(filters().criteria()).toEqual({ tags: ['none'] });
    filters.tags().value.set([]);
    expect(filters().criteria()).toEqual({});
  });
});

describe('buildFilterModel — sources', () => {
  it('untouched with no source: not dirty, not in criteria()', () => {
    const filters = build((path) => ({ status: equals(path.status) }));
    expect(filters.status().dirty()).toBe(false);
    expect(filters().criteria()).toEqual({});
  });

  it('untouched with a source present: not dirty, is in criteria()', () => {
    const bounds = signal({ min: 0, max: 10000 });
    const filters = build((path) => ({
      amount: inRange(path.amount, { source: () => bounds() }),
    }));
    expect(filters.amount().dirty()).toBe(false);
    expect(filters().criteria()).toEqual({ amount: { min: 0, max: 10000 } });
  });

  it('a user write makes it dirty and keeps it in criteria()', () => {
    const bounds = signal({ min: 0, max: 10000 });
    const filters = build((path) => ({
      amount: inRange(path.amount, { source: () => bounds() }),
    }));
    filters.amount().value.set({ min: 100, max: 500 });
    expect(filters.amount().dirty()).toBe(true);
    expect(filters().criteria()).toEqual({ amount: { min: 100, max: 500 } });
  });

  it('writing exactly the source value is dirty=false but still active', () => {
    const bounds = signal({ min: 0, max: 10000 });
    const filters = build((path) => ({
      amount: inRange(path.amount, { source: () => bounds() }),
    }));
    filters.amount().value.set({ min: 0, max: 10000 });
    expect(filters.amount().dirty()).toBe(false);
    expect(filters().criteria()).toEqual({ amount: { min: 0, max: 10000 } });
  });

  it('reset(null) is dirty and removed from criteria()', () => {
    const bounds = signal({ min: 0, max: 10000 });
    const filters = build((path) => ({
      amount: inRange(path.amount, { source: () => bounds() }),
    }));
    filters.amount().reset(null);
    expect(filters.amount().dirty()).toBe(true);
    expect(filters().criteria()).toEqual({});
  });

  it('a later source change does not stomp a dirty filter value', () => {
    const bounds = signal({ min: 0, max: 10000 });
    const filters = build((path) => ({
      amount: inRange(path.amount, { source: () => bounds() }),
    }));
    filters.amount().value.set({ min: 100, max: 500 });
    bounds.set({ min: 0, max: 20000 });
    TestBed.flushEffects();
    expect(filters.amount().value()).toEqual({ min: 100, max: 500 });
  });
});

describe('buildFilterModel — combination semantics (via the safe-evaluate guard)', () => {
  it('ORs an anyOf group across its children', () => {
    const filters = build((path) => ({
      search: anyOf([contains(path.customer), contains(path.notes)]),
    }));
    filters.search().value.set('acme');
    const matches = filters().matcher();

    expect(matches(invoice({ customer: 'Acme Corp', notes: '' }))).toBe(true);
    expect(
      matches(invoice({ customer: 'Globex', notes: 'contact acme' })),
    ).toBe(true);
    expect(matches(invoice({ customer: 'Globex', notes: '' }))).toBe(false);
  });

  it('ANDs separate filters across the root', () => {
    const filters = build((path) => ({
      status: equals(path.status),
      search: contains(path.customer),
    }));
    filters.status().value.set('open');
    filters.search().value.set('acme');
    const matches = filters().matcher();

    expect(matches(invoice({ status: 'open', customer: 'Acme Corp' }))).toBe(
      true,
    );
    expect(matches(invoice({ status: 'closed', customer: 'Acme Corp' }))).toBe(
      false,
    );
    expect(matches(invoice({ status: 'open', customer: 'Globex' }))).toBe(
      false,
    );
  });
});

describe('buildFilterModel — null/undefined cells', () => {
  it('a positive matcher fails a nullable cell', () => {
    const filters = build((path) => ({
      subCategory: equals(path.subCategory),
    }));
    filters.subCategory().value.set('widgets');
    const matches = filters().matcher();
    expect(
      matches(invoice({ subCategory: undefined as unknown as string })),
    ).toBe(false);
  });

  it('hasNone passes a nullable/empty array cell', () => {
    const filters = build((path) => ({ tags: hasNone(path.tags) }));
    filters.tags().value.set(['urgent']);
    const matches = filters().matcher();
    expect(matches(invoice({ tags: undefined as unknown as string[] }))).toBe(
      true,
    );
  });

  it('a custom filter() predicate receives the cell unguarded and can match nulls', () => {
    const filters = build((path) => ({
      notes: filter(
        path.notes,
        (cell: string, want: boolean) => want === (cell == null || cell === ''),
        { emptyValue: false },
      ),
    }));
    filters.notes().value.set(true);
    const matches = filters().matcher();
    expect(matches(invoice({ notes: undefined as unknown as string }))).toBe(
      true,
    );
    expect(matches(invoice({ notes: 'has content' }))).toBe(false);
  });
});

describe('buildFilterModel — errors (ADR-0014)', () => {
  it('a throwing predicate deactivates only its own filter and is reported once per evaluator, not per row', () => {
    const reportSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const filters = build((path) => ({
        status: equals(path.status),
        broken: filter(
          path.customer,
          () => {
            throw new Error('boom');
          },
          { emptyValue: 'x', isEmpty: () => false },
        ),
      }));
      filters.status().value.set('open');
      const matches = filters().matcher();

      const row = invoice({ status: 'open' });
      expect(matches(row)).toBe(true);
      expect(matches(row)).toBe(true);
      expect(matches(row)).toBe(true);

      expect(reportSpy).toHaveBeenCalledTimes(1);
    } finally {
      reportSpy.mockRestore();
    }
  });

  it('a failed filter still appears in criteria()', () => {
    const reportSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const filters = build((path) => ({
        broken: filter(
          path.customer,
          () => {
            throw new Error('boom');
          },
          { emptyValue: 'x', isEmpty: () => false },
        ),
      }));
      expect(filters().criteria()).toEqual({ broken: 'x' });
    } finally {
      reportSpy.mockRestore();
    }
  });

  it('other filters keep narrowing when one throws', () => {
    const reportSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const filters = build((path) => ({
        status: equals(path.status),
        broken: filter(
          path.customer,
          () => {
            throw new Error('boom');
          },
          { emptyValue: 'x', isEmpty: () => false },
        ),
      }));
      filters.status().value.set('closed');
      const matches = filters().matcher();
      expect(matches(invoice({ status: 'open' }))).toBe(false);
    } finally {
      reportSpy.mockRestore();
    }
  });
});

describe('buildFilterModel — when gating', () => {
  it('excludes the gated rule from criteria() while the condition is false', () => {
    const filters = build((path) => ({
      category: equals(path.category),
      subCategory: equals(path.subCategory, {
        when: ({ valueOf }) => valueOf(path.category) !== null,
      }),
    }));
    filters.subCategory().value.set('widgets');
    expect(filters().criteria()).toEqual({});
  });

  it('includes the gated rule once the condition becomes true, without redeclaring the schema', () => {
    const filters = build((path) => ({
      category: equals(path.category),
      subCategory: equals(path.subCategory, {
        when: ({ valueOf }) => valueOf(path.category) !== null,
      }),
    }));
    filters.subCategory().value.set('widgets');
    expect(filters().criteria()).toEqual({});

    filters.category().value.set('electronics');
    expect(filters().criteria()).toEqual({
      category: 'electronics',
      subCategory: 'widgets',
    });
  });

  it('gated off: criterion()/isActive() go dark, value()/reset() are unaffected', () => {
    const filters = build((path) => ({
      category: equals(path.category),
      subCategory: equals(path.subCategory, {
        when: ({ valueOf }) => valueOf(path.category) !== null,
      }),
    }));
    const subCategory = filters.subCategory();
    subCategory.value.set('widgets');

    expect(subCategory.criterion()).toBeUndefined();
    expect(subCategory.isActive()).toBe(false);
    expect(subCategory.value()).toBe('widgets');

    subCategory.reset();
    expect(subCategory.value()).toBe(null);

    subCategory.value.set('gadgets');
    filters.category().value.set('electronics');
    expect(subCategory.criterion()).toBe('gadgets');
    expect(subCategory.isActive()).toBe(true);
  });
});

describe('buildFilterModel — matcher()', () => {
  function buildBrokenFilters() {
    return build((path) => ({
      status: equals(path.status),
      broken: filter(
        path.customer,
        () => {
          throw new Error('boom');
        },
        { emptyValue: 'x', isEmpty: () => false },
      ),
    }));
  }

  function brokenRows(): Invoice[] {
    return [
      invoice({ status: 'open', customer: 'Acme' }),
      invoice({ status: 'closed', customer: 'Globex' }),
      invoice({ status: 'open', customer: 'Initech' }),
    ];
  }

  it('filters a plain array with no table composed at all', () => {
    const filters = build((path) => ({ status: equals(path.status) }));
    filters.status().value.set('open');

    const rows = [
      invoice({ status: 'open', customer: 'Acme' }),
      invoice({ status: 'closed', customer: 'Globex' }),
      invoice({ status: 'open', customer: 'Initech' }),
    ];

    expect(rows.filter(filters().matcher()).map((row) => row.customer)).toEqual(
      ['Acme', 'Initech'],
    );
  });

  it('reflects the criteria current at the moment it was requested', () => {
    const filters = build((path) => ({ status: equals(path.status) }));

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
    const filters = build((path) => ({
      status: equals(path.status),
      search: contains(path.customer),
    }));
    filters.status().value.set('open');

    const rows = [invoice({ status: 'open' }), invoice({ status: 'closed' })];

    expect(rows.filter(filters().matcher())).toHaveLength(1);
  });

  it('ORs an anyOf group across its children', () => {
    const filters = build((path) => ({
      search: anyOf([contains(path.customer), contains(path.notes)]),
    }));
    filters.search().value.set('acme');
    const matches = filters().matcher();

    expect(matches(invoice({ customer: 'Acme Corp', notes: '' }))).toBe(true);
    expect(
      matches(invoice({ customer: 'Globex', notes: 'contact acme' })),
    ).toBe(true);
    expect(matches(invoice({ customer: 'Globex', notes: '' }))).toBe(false);
  });

  it('ANDs separate filters across the root', () => {
    const filters = build((path) => ({
      status: equals(path.status),
      search: contains(path.customer),
    }));
    filters.status().value.set('open');
    filters.search().value.set('acme');
    const matches = filters().matcher();

    expect(matches(invoice({ status: 'open', customer: 'Acme Corp' }))).toBe(
      true,
    );
    expect(matches(invoice({ status: 'closed', customer: 'Acme Corp' }))).toBe(
      false,
    );
    expect(matches(invoice({ status: 'open', customer: 'Globex' }))).toBe(
      false,
    );
  });

  it('does not narrow through a filter gated off by when', () => {
    const filters = build((path) => ({
      category: equals(path.category),
      subCategory: equals(path.subCategory, {
        when: ({ valueOf }) => valueOf(path.category) !== null,
      }),
    }));
    filters.subCategory().value.set('widgets');

    const gatedOff = filters().matcher();
    expect(gatedOff(invoice({ category: null, subCategory: 'gadgets' }))).toBe(
      true,
    );

    filters.category().value.set('electronics');
    const gatedOn = filters().matcher();
    expect(
      gatedOn(invoice({ category: 'electronics', subCategory: 'gadgets' })),
    ).toBe(false);
  });

  it('fails a positive matcher on a null cell', () => {
    const filters = build((path) => ({ category: equals(path.category) }));
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
        expect(String(reportSpy.mock.calls[0]?.[0])).toContain(
          'filter "broken"',
        );
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

  // Type-level assertions that also assert runtime behaviour. Vitest does not typecheck
  // `expectTypeOf` at runtime — `nx run shared-table:typecheck-spec` is what enforces those.
  // Inference facts with no runtime half live in `api/features/with-filtering.types.spec.ts`
  // instead.
  describe('types', () => {
    /** Separately declared, same shape — the predicate correlates structurally, not nominally. */
    type InvoiceShape = { [K in keyof Invoice]: Invoice[K] };

    interface AuditedInvoice extends Invoice {
      auditedBy: string;
    }

    // `equals<TRow, K>` is pinned explicitly here (not left inferred, as a real schema always
    // writes it) — `buildFilterModel` infers `TRow` from this call's own arrow function rather
    // than from a fixed `data` slot the way `withFiltering`+`createTable` does, and that leaves
    // `equals`'s `TEmpty` default undischarged, which makes `expectTypeOf(...).toEqualTypeOf`
    // report a spurious mismatch even though the resolved type is correct (assignability holds).
    // The consumer-representative inference path — schema inferred with no explicit type args,
    // composed through `withFiltering`+`createTable` — is what `with-filtering.types.spec.ts`
    // asserts; this block only re-confirms the same shapes have a runtime-observable half.
    function buildTypedFilters() {
      return build((path) => ({
        status: equals<Invoice, 'status'>(path.status),
        category: equals<Invoice, 'category'>(path.category),
      }));
    }

    it('accepts a structurally identical row type and a wider one carrying extra fields', () => {
      const matches = buildTypedFilters()().matcher();
      const identical: InvoiceShape = invoice();
      const wider: AuditedInvoice = { ...invoice(), auditedBy: 'ann' };

      expectTypeOf(matches).toEqualTypeOf<(row: Invoice) => boolean>();
      expect(matches(identical)).toBe(true);
      expect(matches(wider)).toBe(true);
    });

    it('keeps a concretely-keyed criterion map typed and reachable by property access', () => {
      const filters = buildTypedFilters();

      expectTypeOf(filters.status().value()).toEqualTypeOf<string | null>();
      expectTypeOf(filters().value()).toEqualTypeOf<{
        status: string | null;
        category: string | null;
      }>();
      expectTypeOf(filters().criteria()).toEqualTypeOf<
        Partial<{ status: string | null; category: string | null }>
      >();
    });

    it('narrows a plain array via matcher() once a criterion is set through property access', () => {
      const filters = buildTypedFilters();
      filters.status().value.set('open');

      const rows = [
        invoice({ status: 'open', customer: 'Acme' }),
        invoice({ status: 'closed', customer: 'Globex' }),
        invoice({ status: 'open', customer: 'Initech' }),
      ];

      expect(
        rows.filter(filters().matcher()).map((row) => row.customer),
      ).toEqual(['Acme', 'Initech']);
    });
  });
});
