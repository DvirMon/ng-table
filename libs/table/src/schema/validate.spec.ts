import { describe, expect, it } from 'vitest';
import { assertDeclarationsAreKnown } from './validate';

describe('assertDeclarationsAreKnown', () => {
  it('throws and names the declaring surface when an id is unknown', () => {
    expect(() =>
      assertDeclarationsAreKnown(['region'], ['name', 'status'], 'withGrouping')
    ).toThrow(/^\[withGrouping\] Unknown column id "region"/);
  });

  it('keeps the columns caller message unchanged (regression gate)', () => {
    expect(() =>
      assertDeclarationsAreKnown(['region'], ['name', 'status'], 'columnsSchema')
    ).toThrow(
      '[columnsSchema] Unknown column id "region" — no column with ' +
        'this id exists in the `columns` array.'
    );
  });

  it('does not throw when every declared id is known, including a duplicate', () => {
    expect(() =>
      assertDeclarationsAreKnown(['name'], ['name', 'status'], 'withGrouping')
    ).not.toThrow();

    expect(() =>
      assertDeclarationsAreKnown(['name', 'name'], ['name', 'status'], 'withGrouping')
    ).not.toThrow();
  });

  it('is a no-op when declaredIds is empty, even against an empty knownIds', () => {
    expect(() => assertDeclarationsAreKnown([], [], 'withGrouping')).not.toThrow();
    expect(() =>
      assertDeclarationsAreKnown([], new Set(['name']), 'withGrouping')
    ).not.toThrow();
  });
});
