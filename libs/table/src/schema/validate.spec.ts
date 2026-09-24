import { describe, expect, it } from 'vitest';
import { getNgDevMode, setNgDevMode } from '../ng-dev-mode.testing';
import { assertDeclarationsAreKnown, assertWrittenIdsAreKnown } from './validate';

describe('assertDeclarationsAreKnown', () => {
  it('throws and names the declaring surface when an id is unknown', () => {
    expect(() =>
      assertDeclarationsAreKnown(['region'], ['name', 'status'], 'withGrouping')
    ).toThrow(/^\[withGrouping\] Unknown column id "region"/);
  });

  it('matches on label and id, and no longer mentions a `columns` array (regression gate)', () => {
    let message = '';
    try {
      assertDeclarationsAreKnown(['region'], ['name', 'status'], 'columnsSchema');
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/^\[columnsSchema\] Unknown column id "region"/);
    expect(message).not.toMatch(/columns` array/);
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

describe('G76: construction check is dev-only, writer check is not', () => {
  it('assertDeclarationsAreKnown does not throw on an unknown id when ngDevMode is false', () => {
    const previous = getNgDevMode();
    setNgDevMode(false);
    try {
      expect(() =>
        assertDeclarationsAreKnown(['nope'], ['name', 'status'], 'withGrouping')
      ).not.toThrow();
    } finally {
      setNgDevMode(previous);
    }
  });

  it('assertWrittenIdsAreKnown still throws on an unknown id when ngDevMode is false', () => {
    const previous = getNgDevMode();
    setNgDevMode(false);
    try {
      expect(() =>
        assertWrittenIdsAreKnown(['nope'], ['name', 'status'], 'withGrouping')
      ).toThrow(/^\[withGrouping\] Unknown column id "nope"/);
    } finally {
      setNgDevMode(previous);
    }
  });
});
