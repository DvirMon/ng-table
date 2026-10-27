import { describe, expect, it } from 'vitest';

import { nextBodyTarget } from './keyboard-nav';
import type { BodyCell, NavKey, NavOrder } from './keyboard-nav.types';

const order: NavOrder = { rowIds: [1, 2, 3], columnIds: ['name', 'age', 'city'] };
const middle: BodyCell = { rowId: 2, columnId: 'age' };

function press(key: string, modifiers: Partial<NavKey> = {}): NavKey {
  return { key, ctrlKey: false, ...modifiers };
}

describe('nextBodyTarget', () => {
  it.each([
    ['ArrowRight', { rowId: 2, columnId: 'city' }],
    ['ArrowLeft', { rowId: 2, columnId: 'name' }],
  ])('moves one cell along the row on %s', (key, expected) => {
    expect(nextBodyTarget(order, middle, press(key))).toEqual(expected);
  });

  it.each([
    ['ArrowDown', { rowId: 3, columnId: 'age' }],
    ['ArrowUp', { rowId: 1, columnId: 'age' }],
  ])('moves one row in the same column on %s', (key, expected) => {
    expect(nextBodyTarget(order, middle, press(key))).toEqual(expected);
  });

  it.each([
    ['ArrowRight', { rowId: 2, columnId: 'city' }],
    ['ArrowLeft', { rowId: 2, columnId: 'name' }],
    ['ArrowUp', { rowId: 1, columnId: 'age' }],
    ['ArrowDown', { rowId: 3, columnId: 'age' }],
  ])('stays put at the edge on %s', (key, position) => {
    expect(nextBodyTarget(order, position, press(key))).toEqual(position);
  });

  it.each([
    ['Home', { rowId: 2, columnId: 'name' }],
    ['End', { rowId: 2, columnId: 'city' }],
  ])('jumps to the row edge on %s', (key, expected) => {
    expect(nextBodyTarget(order, middle, press(key))).toEqual(expected);
  });

  it.each([
    ['Ctrl+Home', press('Home', { ctrlKey: true }), { rowId: 1, columnId: 'name' }],
    ['Ctrl+End', press('End', { ctrlKey: true }), { rowId: 3, columnId: 'city' }],
    ['Cmd+End', press('End', { metaKey: true }), { rowId: 3, columnId: 'city' }],
  ])('jumps to the table corner on %s', (_label, event, expected) => {
    expect(nextBodyTarget(order, middle, event)).toEqual(expected);
  });

  it.each([
    ['Tab', press('Tab')],
    ['Enter', press('Enter')],
    ['a', press('a')],
    ['Space', press(' ')],
    ['PageDown', press('PageDown')],
    ['Escape', press('Escape')],
    ['Ctrl+ArrowRight', press('ArrowRight', { ctrlKey: true })],
  ])('returns null for unhandled key %s', (_label, event) => {
    expect(nextBodyTarget(order, middle, event)).toBeNull();
  });

  it.each([
    ['row', { rowId: 99, columnId: 'age' }],
    ['column', { rowId: 2, columnId: 'missing' }],
  ])('returns null when the current %s is not in the order', (_label, position) => {
    expect(nextBodyTarget(order, position, press('ArrowRight'))).toBeNull();
  });
});
