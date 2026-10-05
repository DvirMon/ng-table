import type { RowId } from '../api/types';
import { resolveTreeLinks } from './tree-links';

interface Row {
  readonly id: RowId;
  readonly parent: RowId | null;
}

const trackBy = (row: Row): RowId => row.id;
const parentOf = (row: Row): RowId | null => row.parent;

function r(id: RowId, parent: RowId | null): Row {
  return { id, parent };
}

describe('resolveTreeLinks', () => {
  it('maps every row to its declared parent and roots to null', () => {
    const rows = [r('r', null), r('c1', 'r'), r('g1', 'c1')];

    const links = resolveTreeLinks(rows, { parentOf, trackBy });

    expect(links.parentById).toEqual(
      new Map([
        ['r', null],
        ['c1', 'r'],
        ['g1', 'c1'],
      ]),
    );
    expect(links.broken).toEqual({ self: [], absent: [], cycle: [] });
  });

  it('resolves a parent that appears later in input order', () => {
    const rows = [r('c1', 'r'), r('r', null)];

    const links = resolveTreeLinks(rows, { parentOf, trackBy });

    expect(links.parentById.get('c1')).toBe('r');
    expect(links.broken.absent).toEqual([]);
  });

  it('treats a falsy parent id such as 0 as a link', () => {
    const rows = [r(0, null), r(1, 0)];

    const links = resolveTreeLinks(rows, { parentOf, trackBy });

    expect(links.parentById.get(1)).toBe(0);
    expect(links.broken).toEqual({ self: [], absent: [], cycle: [] });
  });

  it('degrades a self-parented row to root and keeps its children', () => {
    const rows = [r('a', 'a'), r('a1', 'a')];

    const links = resolveTreeLinks(rows, { parentOf, trackBy });

    expect(links.parentById.get('a')).toBeNull();
    expect(links.parentById.get('a1')).toBe('a');
    expect(links.broken.self).toEqual(['a']);
    expect(links.broken.absent).toEqual([]);
    expect(links.broken.cycle).toEqual([]);
  });

  it('degrades a row whose parent is absent to root and keeps its subtree', () => {
    const rows = [r('o', 'ghost'), r('o1', 'o')];

    const links = resolveTreeLinks(rows, { parentOf, trackBy });

    expect(links.parentById.get('o')).toBeNull();
    expect(links.parentById.get('o1')).toBe('o');
    expect(links.broken.absent).toEqual(['o']);
  });

  it('breaks a cycle at its first row in input order', () => {
    const rows = [r('b', 'a'), r('a', 'b')];

    const links = resolveTreeLinks(rows, { parentOf, trackBy });

    expect(links.parentById.get('b')).toBeNull();
    expect(links.parentById.get('a')).toBe('b');
    expect(links.broken.cycle).toEqual(['b']);
  });

  it('keeps links of rows hanging off a cycle', () => {
    const rows = [r('a', 'b'), r('b', 'a'), r('d', 'a')];

    const links = resolveTreeLinks(rows, { parentOf, trackBy });

    expect(links.parentById.get('a')).toBeNull();
    expect(links.parentById.get('b')).toBe('a');
    expect(links.parentById.get('d')).toBe('a');
    expect(links.broken.cycle).toEqual(['a']);
  });

  it('groups broken links by kind in input order', () => {
    const rows = [r('s2', 's2'), r('x', 'ghost'), r('s1', 's1'), r('p', 'q'), r('q', 'p')];

    const links = resolveTreeLinks(rows, { parentOf, trackBy });

    expect(links.broken).toEqual({
      self: ['s2', 's1'],
      absent: ['x'],
      cycle: ['p'],
    });
  });
});
