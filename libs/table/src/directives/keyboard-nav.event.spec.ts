import { describe, expect, it } from 'vitest';

import { nextGridTarget } from './keyboard-nav';
import type { GridNavOptions, NavKey, NavOrder } from './keyboard-nav.types';

const order: NavOrder = { rowIds: [1, 2, 3, 4, 5], columnIds: ['name', 'age', 'city'] };
const ltr: GridNavOptions = { isRtl: false, pageSize: 2 };

// A real browser KeyboardEvent exposes ctrlKey/metaKey as prototype getters, which an object
// spread drops. The test DOM may install them as own properties and hide that, so the event
// is modelled with prototype getters as well.
class PrototypeGetterKey implements NavKey {
  constructor(
    readonly key: string,
    private readonly modifiers: { ctrlKey?: boolean; metaKey?: boolean },
  ) {}

  get ctrlKey(): boolean {
    return this.modifiers.ctrlKey === true;
  }

  get metaKey(): boolean {
    return this.modifiers.metaKey === true;
  }
}

describe('nextGridTarget with a real KeyboardEvent', () => {
  it.each([
    ['Ctrl', { ctrlKey: true }],
    ['Cmd', { metaKey: true }],
  ])('jumps to the last body cell on %s+End from a body cell', (_label, modifier) => {
    const event = new KeyboardEvent('keydown', { key: 'End', ...modifier });
    const getterEvent = new PrototypeGetterKey('End', modifier);

    const current = { area: 'body', rowId: 2, columnId: 'age' } as const;
    const last = { area: 'body', rowId: 5, columnId: 'city' };

    expect(nextGridTarget(order, current, event, ltr)).toEqual(last);
    expect(nextGridTarget(order, current, getterEvent, ltr)).toEqual(last);
  });

  it.each([
    ['Ctrl', { ctrlKey: true }],
    ['Cmd', { metaKey: true }],
  ])('jumps to the header start on %s+Home from a body cell', (_label, modifier) => {
    const event = new KeyboardEvent('keydown', { key: 'Home', ...modifier });
    const getterEvent = new PrototypeGetterKey('Home', modifier);
    const current = { area: 'body', rowId: 3, columnId: 'age' } as const;
    const first = { area: 'header', columnId: 'name' };

    expect(nextGridTarget(order, current, event, ltr)).toEqual(first);
    expect(nextGridTarget(order, current, getterEvent, ltr)).toEqual(first);
  });
});
