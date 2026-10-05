import type { RowId } from '../../types';
import { retainTreeMatches } from './tree-retention';

interface Row {
  readonly id: RowId;
  readonly parent: RowId | null;
}

const trackBy = (row: Row): RowId => row.id;
const parentOf = (row: Row): RowId | null => row.parent;

function r(id: RowId, parent: RowId | null): Row {
  return { id, parent };
}

function retain(
  rows: readonly Row[],
  matchIds: readonly RowId[],
  { includeDescendants = false }: { includeDescendants?: boolean } = {},
) {
  return retainTreeMatches(rows, {
    matches: (row) => matchIds.includes(row.id),
    parentOf,
    trackBy,
    includeDescendants,
  });
}

describe('retainTreeMatches', () => {
  it('keeps a matching row and drops non-matching rows, children included', () => {
    const result = retain([r('a', null), r('a1', 'a'), r('b', null)], ['a']);

    expect(result.rows.map(trackBy)).toEqual(['a']);
    expect(result.contextIds).toEqual(new Set());
  });

  it('keeps every ancestor of a match and reports them as context rows', () => {
    const rows = [r('root', null), r('p', 'root'), r('leaf', 'p'), r('sib', 'p'), r('other', null)];

    const result = retain(rows, ['leaf']);

    expect(result.rows.map(trackBy)).toEqual(['root', 'p', 'leaf']);
    expect(result.contextIds).toEqual(new Set(['root', 'p']));
  });

  it('returns kept rows in input order even when a child precedes its parent', () => {
    const result = retain([r('leaf', 'p'), r('p', null)], ['leaf']);

    expect(result.rows.map(trackBy)).toEqual(['leaf', 'p']);
    expect(result.contextIds).toEqual(new Set(['p']));
  });

  it('does not report an ancestor as a context row when it matches itself', () => {
    const result = retain([r('p', null), r('c', 'p')], ['p', 'c']);

    expect(result.rows.map(trackBy)).toEqual(['p', 'c']);
    expect(result.contextIds).toEqual(new Set());
  });

  it('keeps a shared ancestor once when several descendants match', () => {
    const result = retain([r('p', null), r('c1', 'p'), r('c2', 'p')], ['c1', 'c2']);

    expect(result.rows.map(trackBy)).toEqual(['p', 'c1', 'c2']);
    expect(result.rows).toHaveLength(3);
    expect(result.contextIds).toEqual(new Set(['p']));
  });

  it('treats a falsy parent id such as 0 as an ancestor link', () => {
    const result = retain([r(0, null), r(1, 0)], [1]);

    expect(result.rows.map(trackBy)).toEqual([0, 1]);
    expect(result.contextIds).toEqual(new Set([0]));
  });

  it('keeps every descendant of a match under includeDescendants, not as context rows', () => {
    const rows = [r('a', null), r('a1', 'a'), r('a11', 'a1'), r('b', null)];

    const result = retain(rows, ['a'], { includeDescendants: true });

    expect(result.rows.map(trackBy)).toEqual(['a', 'a1', 'a11']);
    expect(result.contextIds).toEqual(new Set());
  });

  it('does not report a row kept as a descendant of a match as a context row, even when it is also an ancestor of one', () => {
    const rows = [r('a', null), r('a1', 'a'), r('a11', 'a1')];

    const result = retain(rows, ['a', 'a11'], { includeDescendants: true });

    expect(result.rows.map(trackBy)).toEqual(['a', 'a1', 'a11']);
    expect(result.contextIds).toEqual(new Set());
  });

  it('stops the ancestor walk at a parent id absent from the rows', () => {
    const rows = [r('p', 'ghost'), r('c', 'p')];

    const result = retain(rows, ['c']);

    expect(result.rows.map(trackBy)).toEqual(['p', 'c']);
    expect(result.contextIds).toEqual(new Set(['p']));
  });

  it('stops the ancestor walk at a self-parented row', () => {
    const result = retain([r('p', 'p'), r('c', 'p')], ['c']);

    expect(result.rows.map(trackBy)).toEqual(['p', 'c']);
    expect(result.contextIds).toEqual(new Set(['p']));
  });

  it('breaks a parent cycle where resolveTreeLinks does, so context rows match the rendered tree', () => {
    const rows = [r('a', 'b'), r('b', 'a'), r('x', null)];

    const result = retain(rows, ['a']);

    expect(result.rows.map(trackBy)).toEqual(['a']);
    expect(result.contextIds).toEqual(new Set());
  });
});
