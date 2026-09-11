import { describe, expect, it } from 'vitest';
import { hasAnyOf, hasNoneOf, isContaining, isEqual, isInDateRange, isInRange } from './matchers';

describe('isEqual', () => {
  it('matches an equal criterion', () => {
    expect(isEqual('open', 'open')).toBe(true);
  });

  it('rejects a different criterion', () => {
    expect(isEqual('open', 'closed')).toBe(false);
  });

  it('fails on a null cell', () => {
    expect(isEqual(null, 'open')).toBe(false);
  });

  it('fails on an undefined cell', () => {
    expect(isEqual(undefined, 'open')).toBe(false);
  });
});

describe('isContaining', () => {
  it('matches a substring', () => {
    expect(isContaining('Acme Corp', 'me c')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isContaining('Acme Corp', 'ACME')).toBe(true);
  });

  it('rejects a non-substring', () => {
    expect(isContaining('Acme Corp', 'globex')).toBe(false);
  });

  it('does not require full equality', () => {
    expect(isContaining('Acme', 'Acme Corp')).toBe(false);
  });

  it('fails on a null cell', () => {
    expect(isContaining(null as never, 'acme')).toBe(false);
  });

  it('fails on an undefined cell', () => {
    expect(isContaining(undefined as never, 'acme')).toBe(false);
  });
});

describe('isInRange', () => {
  it('matches a cell within both bounds', () => {
    expect(isInRange(50, { min: 0, max: 100 })).toBe(true);
  });

  it('rejects a cell below the min bound', () => {
    expect(isInRange(-1, { min: 0, max: 100 })).toBe(false);
  });

  it('rejects a cell above the max bound', () => {
    expect(isInRange(101, { min: 0, max: 100 })).toBe(false);
  });

  it('matches with only a min bound set', () => {
    expect(isInRange(1000, { min: 0, max: null })).toBe(true);
  });

  it('rejects below a min-only bound', () => {
    expect(isInRange(-1, { min: 0, max: null })).toBe(false);
  });

  it('matches with only a max bound set', () => {
    expect(isInRange(-1000, { min: null, max: 100 })).toBe(true);
  });

  it('rejects above a max-only bound', () => {
    expect(isInRange(101, { min: null, max: 100 })).toBe(false);
  });

  it('matches everything when both bounds are null', () => {
    expect(isInRange(Number.MIN_SAFE_INTEGER, { min: null, max: null })).toBe(true);
    expect(isInRange(Number.MAX_SAFE_INTEGER, { min: null, max: null })).toBe(true);
  });

  it('fails on a null cell', () => {
    expect(isInRange(null as never, { min: 0, max: 100 })).toBe(false);
  });

  it('fails on an undefined cell', () => {
    expect(isInRange(undefined as never, { min: 0, max: 100 })).toBe(false);
  });
});

describe('isInDateRange', () => {
  const from = new Date('2026-01-01');
  const to = new Date('2026-12-31');

  it('matches a cell within both bounds', () => {
    expect(isInDateRange(new Date('2026-06-01'), { from, to })).toBe(true);
  });

  it('rejects a cell before the from bound', () => {
    expect(isInDateRange(new Date('2025-12-31'), { from, to })).toBe(false);
  });

  it('rejects a cell after the to bound', () => {
    expect(isInDateRange(new Date('2027-01-01'), { from, to })).toBe(false);
  });

  it('matches with only a from bound set', () => {
    expect(isInDateRange(new Date('2099-01-01'), { from, to: null })).toBe(true);
  });

  it('rejects before a from-only bound', () => {
    expect(isInDateRange(new Date('2025-01-01'), { from, to: null })).toBe(false);
  });

  it('matches with only a to bound set', () => {
    expect(isInDateRange(new Date('1900-01-01'), { from: null, to })).toBe(true);
  });

  it('rejects after a to-only bound', () => {
    expect(isInDateRange(new Date('2027-01-01'), { from: null, to })).toBe(false);
  });

  it('matches everything when both bounds are null', () => {
    expect(isInDateRange(new Date('1900-01-01'), { from: null, to: null })).toBe(true);
    expect(isInDateRange(new Date('2999-01-01'), { from: null, to: null })).toBe(true);
  });

  it('fails on a null cell', () => {
    expect(isInDateRange(null as never, { from, to })).toBe(false);
  });

  it('fails on an undefined cell', () => {
    expect(isInDateRange(undefined as never, { from, to })).toBe(false);
  });
});

describe('hasAnyOf', () => {
  it('matches when the cell intersects the criterion', () => {
    expect(hasAnyOf(['a', 'b'], ['b', 'c'])).toBe(true);
  });

  it('rejects a disjoint cell and criterion', () => {
    expect(hasAnyOf(['a', 'b'], ['c', 'd'])).toBe(false);
  });

  it('rejects when the criterion is empty', () => {
    expect(hasAnyOf(['a', 'b'], [])).toBe(false);
  });

  it('rejects when the cell is empty', () => {
    expect(hasAnyOf([], ['a', 'b'])).toBe(false);
  });

  it('fails on a null cell', () => {
    expect(hasAnyOf(null as never, ['a'])).toBe(false);
  });

  it('fails on an undefined cell', () => {
    expect(hasAnyOf(undefined as never, ['a'])).toBe(false);
  });
});

describe('hasNoneOf', () => {
  it('matches when the cell is disjoint from the criterion', () => {
    expect(hasNoneOf(['a', 'b'], ['c', 'd'])).toBe(true);
  });

  it('rejects when the cell intersects the criterion', () => {
    expect(hasNoneOf(['a', 'b'], ['b', 'c'])).toBe(false);
  });

  it('matches when the criterion is empty', () => {
    expect(hasNoneOf(['a', 'b'], [])).toBe(true);
  });

  it('matches when the cell is empty', () => {
    expect(hasNoneOf([], ['a', 'b'])).toBe(true);
  });

  it('matches on a null cell', () => {
    expect(hasNoneOf(null as never, ['a'])).toBe(true);
  });

  it('matches on an undefined cell', () => {
    expect(hasNoneOf(undefined as never, ['a'])).toBe(true);
  });
});
