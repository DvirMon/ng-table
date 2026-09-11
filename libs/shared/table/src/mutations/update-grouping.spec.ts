import { describe, expect, it } from 'vitest';
import type { MockRow } from '../table.mock';
import {
  addGroupLevel,
  removeGroupLevel,
  reorderGroupLevels,
  setGroupLevels,
} from './update-grouping';

describe('setGroupLevels', () => {
  it('replaces the full level list, ignoring the previous one', () => {
    const result = setGroupLevels<MockRow>(['name'])(['id']);

    expect(result).toEqual(['name']);
  });
});

describe('addGroupLevel', () => {
  it('appends by default', () => {
    const result = addGroupLevel<MockRow>('name')(['id']);

    expect(result).toEqual(['id', 'name']);
  });

  it('inserts at the given index', () => {
    const result = addGroupLevel<MockRow>('name', 0)(['id']);

    expect(result).toEqual(['name', 'id']);
  });

  it('is a no-op when the id is already present', () => {
    const grouping = ['id', 'name'];

    const result = addGroupLevel<MockRow>('name')(grouping);

    expect(result).toEqual(grouping);
  });
});

describe('removeGroupLevel', () => {
  it('removes a present id', () => {
    const result = removeGroupLevel<MockRow>('id')(['id', 'name']);

    expect(result).toEqual(['name']);
  });

  it('is a no-op for an absent id', () => {
    const grouping = ['id', 'name'];

    const result = removeGroupLevel<MockRow>('nope')(grouping);

    expect(result).toEqual(grouping);
  });
});

describe('reorderGroupLevels', () => {
  it('moves an element from one index to another', () => {
    const result = reorderGroupLevels<MockRow>(0, 2)(['a', 'b', 'c']);

    expect(result).toEqual(['b', 'c', 'a']);
  });

  it('is a no-op on an out-of-range from', () => {
    const grouping = ['a', 'b', 'c'];

    const result = reorderGroupLevels<MockRow>(5, 1)(grouping);

    expect(result).toEqual(grouping);
  });

  it('is a no-op on an out-of-range to', () => {
    const grouping = ['a', 'b', 'c'];

    const result = reorderGroupLevels<MockRow>(0, 5)(grouping);

    expect(result).toEqual(grouping);
  });

  it('is a no-op on a negative index', () => {
    const grouping = ['a', 'b', 'c'];

    const result = reorderGroupLevels<MockRow>(-1, 1)(grouping);

    expect(result).toEqual(grouping);
  });
});
