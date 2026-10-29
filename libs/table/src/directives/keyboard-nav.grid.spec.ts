import { describe, expect, it } from 'vitest';

import { nextGridTarget } from './keyboard-nav';
import type { GridCell, GridNavOptions, NavKey, NavOrder } from './keyboard-nav.types';

const order: NavOrder = { rowIds: [1, 2, 3, 4, 5], columnIds: ['name', 'age', 'city'] };
const emptyOrder: NavOrder = { rowIds: [], columnIds: ['name', 'age', 'city'] };
const ltr: GridNavOptions = { isRtl: false, pageSize: 2 };
const rtl: GridNavOptions = { isRtl: true, pageSize: 2 };

function press(key: string, modifiers: Partial<NavKey> = {}): NavKey {
  return { key, ctrlKey: false, ...modifiers };
}

function header(columnId: string): GridCell {
  return { area: 'header', columnId };
}

function body(rowId: number, columnId: string): GridCell {
  return { area: 'body', rowId, columnId };
}

describe('nextGridTarget', () => {
  it.each([
    ['row 1', body(1, 'age'), header('age')],
    ['row 2', body(2, 'age'), body(1, 'age')],
  ])('moves up on ArrowUp from %s', (_label, current, expected) => {
    expect(nextGridTarget(order, current, press('ArrowUp'), ltr)).toEqual(expected);
  });

  it('moves from the header to the first body row in the same column on ArrowDown', () => {
    expect(nextGridTarget(order, header('age'), press('ArrowDown'), ltr)).toEqual(body(1, 'age'));
  });

  it.each([
    ['ArrowRight', header('age'), header('city')],
    ['ArrowLeft', header('age'), header('name')],
    ['ArrowRight', header('city'), header('city')],
    ['ArrowLeft', header('name'), header('name')],
    ['ArrowUp', header('age'), header('age')],
  ])('moves across the header row on %s and stops at the edge', (key, current, expected) => {
    expect(nextGridTarget(order, current, press(key), ltr)).toEqual(expected);
  });

  it('stays on the header on ArrowDown when there are no body rows', () => {
    expect(nextGridTarget(emptyOrder, header('age'), press('ArrowDown'), ltr)).toEqual(
      header('age'),
    );
  });

  it.each([
    ['Home', order, header('age'), press('Home'), header('name')],
    ['End', order, header('age'), press('End'), header('city')],
    ['Ctrl+Home', order, header('age'), press('Home', { ctrlKey: true }), header('name')],
    ['Ctrl+End', order, header('age'), press('End', { ctrlKey: true }), body(5, 'city')],
    [
      'Ctrl+End with no rows',
      emptyOrder,
      header('age'),
      press('End', { ctrlKey: true }),
      header('city'),
    ],
    [
      'Ctrl+Home from a body cell',
      order,
      body(3, 'age'),
      press('Home', { ctrlKey: true }),
      header('name'),
    ],
  ])('jumps along the header row on %s', (_label, navOrder, current, event, expected) => {
    expect(nextGridTarget(navOrder, current, event, ltr)).toEqual(expected);
  });

  it.each([
    ['PageDown', body(2, 'age'), body(4, 'age')],
    ['PageUp', body(4, 'age'), body(2, 'age')],
    ['PageDown', body(4, 'age'), body(5, 'age')],
    ['PageUp', body(2, 'age'), body(1, 'age')],
    ['PageDown', body(5, 'age'), body(5, 'age')],
    ['PageDown', header('age'), header('age')],
    ['PageUp', header('age'), header('age')],
  ])('pages %s in the same column, clamped to the body', (key, current, expected) => {
    expect(nextGridTarget(order, current, press(key), ltr)).toEqual(expected);
  });

  it.each([
    ['ArrowLeft', 'body', body(2, 'age'), body(2, 'city')],
    ['ArrowRight', 'body', body(2, 'age'), body(2, 'name')],
    ['ArrowLeft', 'header', header('age'), header('city')],
    ['ArrowRight', 'header', header('age'), header('name')],
  ])('swaps %s under RTL on a %s cell', (key, _area, current, expected) => {
    expect(nextGridTarget(order, current, press(key), rtl)).toEqual(expected);
  });

  it.each([
    ['Tab', header('age'), press('Tab')],
    ['Enter', header('age'), press('Enter')],
    ['Escape', header('age'), press('Escape')],
    ['Space', header('age'), press(' ')],
    ['Ctrl+ArrowRight', header('age'), press('ArrowRight', { ctrlKey: true })],
    ['Alt+ArrowLeft', header('age'), press('ArrowLeft', { altKey: true })],
    ['Shift+ArrowDown', header('age'), press('ArrowDown', { shiftKey: true })],
    ['Shift+End', header('age'), press('End', { shiftKey: true })],
    ['ArrowRight on an unknown header', header('missing'), press('ArrowRight')],
    ['PageDown on an unknown row', body(99, 'age'), press('PageDown')],
    ['Shift+PageDown', body(2, 'age'), press('PageDown', { shiftKey: true })],
  ])('returns null for %s', (_label, current, event) => {
    expect(nextGridTarget(order, current, event, ltr)).toBeNull();
  });
});
