import { describe, expect, it } from 'vitest';

import { nextTreegridTarget } from './keyboard-nav';
import type {
  GridNavOptions,
  NavKey,
  TreegridNavOrder,
  TreegridTarget,
} from './keyboard-nav.types';

const order: TreegridNavOrder = {
  rowIds: ['a', 'a1', 'a1x', 'a2', 'b'],
  rowDepths: [0, 1, 2, 1, 0],
  columnIds: ['name', 'age', 'city'],
};
const ltr: GridNavOptions = { isRtl: false, pageSize: 2 };
const rtl: GridNavOptions = { isRtl: true, pageSize: 2 };

function press(key: string, modifiers: Partial<NavKey> = {}): NavKey {
  return { key, ctrlKey: false, ...modifiers };
}

function header(columnId: string): TreegridTarget {
  return { area: 'header', columnId };
}

function body(rowId: string, columnId: string): TreegridTarget {
  return { area: 'body', rowId, columnId };
}

function row(rowId: string): TreegridTarget {
  return { area: 'body', rowId, columnId: null };
}

describe('nextTreegridTarget', () => {
  it.each([
    ['ArrowDown', row('a'), row('a1')],
    ['ArrowUp', row('a1'), row('a')],
    ['ArrowDown', row('b'), row('b')],
  ])(
    'moves between rows on %s from a focused row and stops at the last row',
    (key, current, expected) => {
      expect(nextTreegridTarget(order, current, press(key), ltr)).toEqual(expected);
    },
  );

  it('moves from the first focused row to the first header cell on ArrowUp', () => {
    expect(nextTreegridTarget(order, row('a'), press('ArrowUp'), ltr)).toEqual(header('name'));
  });

  it('moves from a header cell to the first row on ArrowDown', () => {
    expect(nextTreegridTarget(order, header('age'), press('ArrowDown'), ltr)).toEqual(row('a'));
  });

  it.each([
    ['ArrowRight on a row', 'ArrowRight', row('a1'), body('a1', 'name')],
    ['ArrowLeft on the first cell', 'ArrowLeft', body('a1', 'name'), row('a1')],
    ['ArrowLeft on a later cell', 'ArrowLeft', body('a1', 'age'), body('a1', 'name')],
  ])('moves between a row and its cells on %s', (_label, key, current, expected) => {
    expect(nextTreegridTarget(order, current, press(key), ltr)).toEqual(expected);
  });

  it.each([
    ['a1x', row('a1x'), row('a1')],
    ['a2', row('a2'), row('a')],
    ['a top-level row', row('b'), row('b')],
  ])('moves to the parent row on ArrowLeft from %s', (_label, current, expected) => {
    expect(nextTreegridTarget(order, current, press('ArrowLeft'), ltr)).toEqual(expected);
  });

  it.each([
    ['ArrowDown', body('a', 'age'), body('a1', 'age')],
    ['ArrowUp', body('a', 'age'), header('age')],
    ['ArrowRight', body('a', 'name'), body('a', 'age')],
  ])('keeps grid behaviour for %s on a cell', (key, current, expected) => {
    expect(nextTreegridTarget(order, current, press(key), ltr)).toEqual(expected);
  });

  it.each([
    ['Enter', row('a1'), press('Enter')],
    ['Tab', row('a1'), press('Tab')],
    ['Space', row('a1'), press(' ')],
    ['Shift+ArrowDown', row('a1'), press('ArrowDown', { shiftKey: true })],
    ['Alt+ArrowLeft', row('a1'), press('ArrowLeft', { altKey: true })],
    ['Ctrl+ArrowDown', row('a1'), press('ArrowDown', { ctrlKey: true })],
    ['ArrowDown on an unknown row', row('zz'), press('ArrowDown')],
  ])('returns null for %s on a focused row', (_label, current, event) => {
    expect(nextTreegridTarget(order, current, event, ltr)).toBeNull();
  });

  it.each([
    ['Home', 'first', row('a2'), press('Home'), row('a')],
    ['Ctrl+Home', 'first', row('a2'), press('Home', { ctrlKey: true }), row('a')],
    ['End', 'last', row('a1'), press('End'), row('b')],
    ['Ctrl+End', 'last', row('a1'), press('End', { ctrlKey: true }), row('b')],
    ['PageDown from row 2', 'fourth', row('a1'), press('PageDown'), row('a2')],
    ['PageUp from row 1', 'first', row('a'), press('PageUp'), row('a')],
    ['PageDown from row 4', 'last', row('a2'), press('PageDown'), row('b')],
  ])('%s on a row moves to the %s row', (_label, _where, current, event, expected) => {
    expect(nextTreegridTarget(order, current, event, ltr)).toEqual(expected);
  });

  it('swaps ←/→ under RTL: → on a row goes to its parent, ← on a row goes to its first cell, → on the first cell goes to the row', () => {
    expect(nextTreegridTarget(order, row('a1'), press('ArrowRight'), rtl)).toEqual(row('a'));
    expect(nextTreegridTarget(order, row('a1'), press('ArrowLeft'), rtl)).toEqual(
      body('a1', 'name'),
    );
    expect(nextTreegridTarget(order, body('a1', 'name'), press('ArrowRight'), rtl)).toEqual(
      row('a1'),
    );
  });
});
