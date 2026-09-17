import { computed, isSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { debounce, form } from '@angular/forms/signals';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildFilterModel } from './create-filters';
import { contains, equals, inRange } from '../../api/features/with-filtering/rules';
import { equalsCriterion } from './state';
import type { AnyRule } from './types';
import type { FiltersPath } from '../../api/features/with-filtering/types';

interface Invoice {
  status: string | null;
  amount: number;
  customer: string;
}

/** `inRange`'s criterion shape is not exported; a consumer no longer types `TState`, but the
 * shape is still unexported and a *test* still restates it to build a source value. */
type RangeCriterion = { min: number | null; max: number | null };

const EMPTY_RANGE: RangeCriterion = { min: null, max: null };

/** `buildFilterModel` needs no injection context — `state.ts` builds only `signal`/`computed`/
 *  `linkedSignal`, none of which require one. */
function build<S extends Record<string, AnyRule>>(schema: (path: FiltersPath<Invoice>) => S) {
  return buildFilterModel<Invoice, S>(schema);
}

function buildInvoiceFilters(source?: () => RangeCriterion) {
  return build((path) => ({
    // `equals`'s generic inference collapses to `unknown` here without the explicit
    // arguments — a TS quirk in reverse-mapped-type inference over an object-literal schema,
    // reproduced with `contains`/`inRange` unaffected (they carry no `const TEmpty` param).
    status: equals<Invoice, 'status', never>(path.status),
    amount: inRange(path.amount, source ? { source } : undefined),
    customer: contains(path.customer),
  }));
}

/**
 * R18's gate. The root criterion model must be a real `WritableSignal` that is a *view* over the
 * child nodes — a read composes them, a write fans back out — because that is the whole reason
 * `form(filters().value, schema)` needs no adapter and no sync effect.
 *
 * A plain `value(): TState` getter shipped once and every existing test still passed, because
 * they only ever read. These write.
 */
describe('filters root — the criterion model is a writable view over the nodes', () => {
  it('is a signal, not a getter', () => {
    const filters = buildInvoiceFilters();
    expect(isSignal(filters().value)).toBe(true);
  });

  it('exposes the writable surface a Signal Form binds to', () => {
    const filters = buildInvoiceFilters();
    const root = filters().value;

    expect(typeof root.set).toBe('function');
    expect(typeof root.update).toBe('function');
    expect(typeof root.asReadonly).toBe('function');
  });

  it('composes every node on read', () => {
    const filters = buildInvoiceFilters();
    filters.status().value.set('open');
    filters.amount().value.set({ min: 100, max: 500 });

    expect(filters().value()).toEqual({
      status: 'open',
      amount: { min: 100, max: 500 },
      customer: '',
    });
  });

  it('fans a set() out to the nodes, which stay the single storage location', () => {
    const filters = buildInvoiceFilters();

    filters().value.set({ status: 'closed', amount: { min: 0, max: 10 }, customer: 'Acme' });

    expect(filters.status().value()).toBe('closed');
    expect(filters.amount().value()).toEqual({ min: 0, max: 10 });
    expect(filters.customer().value()).toBe('Acme');
  });

  it('fans an update() out to the nodes, leaving untouched keys where they were', () => {
    const filters = buildInvoiceFilters();
    filters.status().value.set('open');

    filters().value.update((current) => ({ ...current, customer: 'Globex' }));

    expect(filters.customer().value()).toBe('Globex');
    expect(filters.status().value()).toBe('open');
  });

  it('reacts to a node write, so a form bound to the root sees per-field edits', () => {
    const filters = buildInvoiceFilters();
    const status = computed(() => filters().value().status);

    expect(status()).toBe(null);

    filters.status().value.set('open');

    expect(status()).toBe('open');
  });

  it('asReadonly() tracks the same state without exposing a write', () => {
    const filters = buildInvoiceFilters();
    const readonlyRoot = filters().value.asReadonly();

    filters.customer().value.set('Acme');

    expect(readonlyRoot().customer).toBe('Acme');
    expect('set' in readonlyRoot).toBe(false);
  });

  /**
   * `reset` takes `Partial<TState>` deliberately: a key the object omits goes back to its
   * declared source, which is what makes restoring a partial snapshot a complete state. `set`
   * has no partial form at the type level — it is a model write, not a restore.
   */
  it('reset() returns an omitted key to its source rather than leaving it', () => {
    const filters = buildInvoiceFilters(() => ({ min: 5, max: 50 }));
    filters.status().value.set('open');
    filters.amount().value.set({ min: 100, max: 500 });

    filters().reset({ customer: 'Acme' });

    expect(filters.customer().value()).toBe('Acme');
    expect(filters.status().value()).toBe(null);
    expect(filters.amount().value()).toEqual({ min: 5, max: 50 });
  });

  it('reports dirty when a node differs from its source', () => {
    const filters = buildInvoiceFilters(() => ({ min: 5, max: 50 }));

    expect(filters().dirty()).toBe(false);

    filters.amount().value.set({ min: 100, max: 500 });

    expect(filters().dirty()).toBe(true);
  });
});

/**
 * A declared `source` makes a node a `linkedSignal` whose late-arrival rule is its own business
 * (R19) — the root never arbitrates it. Tested here because node-first storage is what keeps
 * that reconciliation local to the node that owns it.
 */
describe('filters node — source reconciliation stays on the node', () => {
  function buildWithServerDefault() {
    const serverDefault = signal<RangeCriterion>(EMPTY_RANGE);
    const filters = buildInvoiceFilters(() => serverDefault());
    return { filters, serverDefault };
  }

  it('takes a late source arrival when the user has not typed', () => {
    const { filters, serverDefault } = buildWithServerDefault();

    serverDefault.set({ min: 5, max: 50 });

    expect(filters.amount().value()).toEqual({ min: 5, max: 50 });
    expect(filters().value().amount).toEqual({ min: 5, max: 50 });
  });

  it('does not let a late source stomp a value the user already typed', () => {
    const { filters, serverDefault } = buildWithServerDefault();

    filters.amount().value.set({ min: 100, max: 500 });
    serverDefault.set({ min: 5, max: 50 });

    expect(filters.amount().value()).toEqual({ min: 100, max: 500 });
  });
});

/**
 * R18 as an executable claim rather than a sentence: "the form's model **is** the filter model —
 * no adapter, no sync effect, no duplicated state" (`features/filtering.md` §Forms).
 *
 * This is the check the original work never had. R18 was recorded as a property already true,
 * the task plan cited that phrasing to build nothing for it, and the implementation shipped a
 * plain getter that no test could fail on. If the root stops being a valid `form()` model, this
 * block breaks.
 */
describe('filters root — a Signal Form binds to it directly', () => {
  it('accepts the criterion model as a form model', () => {
    const filters = buildInvoiceFilters();

    const filterForm = TestBed.runInInjectionContext(() => form(filters().value));

    expect(filterForm.customer().value()).toBe('');
    expect(filterForm.status().value()).toBe(null);
  });

  it('writes a form field through to the node that owns the criterion', () => {
    const filters = buildInvoiceFilters();
    const filterForm = TestBed.runInInjectionContext(() => form(filters().value));

    filterForm.customer().value.set('Acme');

    expect(filters.customer().value()).toBe('Acme');
    expect(filters().criteria()).toEqual({ customer: 'Acme' });
  });

  it('shows a node write in the form field, with no sync effect between them', () => {
    const filters = buildInvoiceFilters();
    const filterForm = TestBed.runInInjectionContext(() => form(filters().value));

    filters.customer().value.set('Globex');

    expect(filterForm.customer().value()).toBe('Globex');
  });

  it('reaches a nested criterion key, so a range binds field by field', () => {
    const filters = buildInvoiceFilters();
    const filterForm = TestBed.runInInjectionContext(() => form(filters().value));

    filterForm.amount.min().value.set(100);

    expect(filters.amount().value()).toEqual({ min: 100, max: null });
  });

  it('carries a schema, which is where debounce and validation live (R25)', () => {
    const filters = buildInvoiceFilters();

    const filterForm = TestBed.runInInjectionContext(() =>
      form(filters().value, () => {
        // Intentionally empty: the assertion is that the model is schema-compatible at all.
      })
    );

    filterForm.customer().value.set('Acme');

    expect(filters.customer().value()).toBe('Acme');
  });

  it('leaves an untouched sibling alone by reference, not just by value', () => {
    const filters = buildInvoiceFilters();
    const filterForm = TestBed.runInInjectionContext(() => form(filters().value));

    let amountEvaluations = 0;
    const downstreamOfAmount = computed(() => {
      amountEvaluations += 1;
      return filters.amount().value();
    });
    const amountBefore = downstreamOfAmount();

    filterForm.customer().value.set('Acme');

    // `toBe`, not `toEqual`, is the whole assertion: the form spreads the model on every edit, so
    // every sibling key is re-`set` with a structurally equal value. A churning reference
    // invalidates every computed downstream of a criterion nobody touched, and degrades silently
    // — no assertion comparing values can fail on it.
    expect(downstreamOfAmount()).toBe(amountBefore);
    expect(amountEvaluations).toBe(1);
  });
});

/**
 * R25 keeps debouncing in the Signal Form rather than in `buildFilterModel`, so `debounce()` over
 * the criterion model is the only thing standing between a keystroke and a request
 * (`server-filtering-story-host.component.ts:123`). `controlValue` is the buffered half — a write
 * there schedules a sync, and only the elapsed timer writes through to the criterion.
 *
 * Timers advance with the **async** variants throughout: the debouncer resolves a promise, so the
 * write lands in a microtask that the synchronous `advanceTimersByTime` never flushes.
 */
describe('filters root — debounce on the form delays the criterion write (R25)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function buildDebouncedForm() {
    const filters = buildInvoiceFilters();
    const filterForm = TestBed.runInInjectionContext(() =>
      form(filters().value, (path) => {
        debounce(path.customer, 300);
      })
    );

    return { filters, filterForm };
  }

  it('holds a control write for the debounce duration, then writes it through', async () => {
    const { filters, filterForm } = buildDebouncedForm();

    filterForm.customer().controlValue.set('Acme');

    await vi.advanceTimersByTimeAsync(299);
    expect(filters.customer().value()).toBe('');

    await vi.advanceTimersByTimeAsync(1);
    expect(filters.customer().value()).toBe('Acme');
  });

  it('collapses two control writes inside one window into a single criterion write', async () => {
    const { filters, filterForm } = buildDebouncedForm();

    let criterionWrites = 0;
    const observedCriterion = computed(() => {
      criterionWrites += 1;
      return filters.customer().value();
    });
    observedCriterion();

    filterForm.customer().controlValue.set('Ac');
    await vi.advanceTimersByTimeAsync(200);
    filterForm.customer().controlValue.set('Acme');
    await vi.advanceTimersByTimeAsync(300);

    // One write, not one per keystroke — the interim sync is aborted by the second control write.
    expect(observedCriterion()).toBe('Acme');
    expect(criterionWrites).toBe(2);
  });
});

describe('equalsCriterion', () => {
  it('compares the shapes this library ships structurally', () => {
    expect(equalsCriterion({ min: 1, max: 2 }, { min: 1, max: 2 })).toBe(true);
    expect(equalsCriterion(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(equalsCriterion({ min: 1, max: 2 }, { min: 1, max: 3 })).toBe(false);
    expect(equalsCriterion(['a'], ['a', 'b'])).toBe(false);
  });

  it('treats a differing key count as unequal rather than comparing the overlap', () => {
    expect(equalsCriterion({ min: 1 }, { min: 1, max: null })).toBe(false);
  });

  it('falls back to reference equality for a shape it does not model', () => {
    const date = new Date('2026-06-01');

    expect(equalsCriterion(date, date)).toBe(true);
    expect(equalsCriterion(date, new Date('2026-06-01'))).toBe(false);
  });
});
