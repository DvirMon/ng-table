import { signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import type { ColumnMetaKey } from '../columns-schema/types';
import { getNgDevMode, setNgDevMode } from '../ng-dev-mode.testing';
import {
  applyColumnOrder,
  foldColumnRules,
  resolveColumnDefs,
  setColumnVisible,
  toggleColumnVisible,
  VISIBLE,
  type ColumnRuleEntry,
} from './columns';

interface Person {
  id: number;
  name: string;
}

describe('resolveColumnDefs', () => {
  it('fills every optional field from the id and index', () => {
    const [column] = resolveColumnDefs<Person>([{ id: 'name' }], 'createTable');

    expect(column.visible).toBe(true);
    expect(column.order).toBe(0);
    expect(column.label).toBe('name');
    expect(column.accessor({ id: 1, name: 'Ann' })).toBe('Ann');
  });

  it('defaults order to the array index', () => {
    const columns = resolveColumnDefs<Person>([{ id: 'id' }, { id: 'name' }], 'createTable');

    expect(columns.map((column) => column.order)).toEqual([0, 1]);
  });

  it('keeps explicitly provided values', () => {
    const [column] = resolveColumnDefs<Person>(
      [{ id: 'name', visible: false, order: 7, label: 'Full name' }],
      'createTable'
    );

    expect(column).toMatchObject({ visible: false, order: 7, label: 'Full name' });
  });

  it('throws with the exact D10 message when two columns share an id', () => {
    expect(() =>
      resolveColumnDefs<Person>([{ id: 'name' }, { id: 'name' }], 'createTable')
    ).toThrow(
      '[createTable] Duplicate column id provided: "name" — ensure all column ids are unique.'
    );
  });

  it('still throws from the runtime write path when called with the setColumns label', () => {
    // `setColumns` (`mutations/update-columns.ts`) calls `resolveColumnDefs(defs, 'setColumns')`
    // directly — this is that same call, proving the duplicate-id check still guards the
    // runtime write path, not just `createColumns()`'s construction-time check.
    expect(() =>
      resolveColumnDefs<Person>([{ id: 'name' }, { id: 'name' }], 'setColumns')
    ).toThrow(
      '[setColumns] Duplicate column id provided: "name" — ensure all column ids are unique.'
    );
  });

  it('does not throw for two distinct ids sharing the same accessor function reference', () => {
    const sharedAccessor = (row: Person): unknown => row.name;

    expect(() =>
      resolveColumnDefs<Person>(
        [
          { id: 'name', accessor: sharedAccessor },
          { id: 'fullName', accessor: sharedAccessor },
        ],
        'createTable'
      )
    ).not.toThrow();
  });

  it('does not throw for a list with no duplicates', () => {
    expect(() =>
      resolveColumnDefs<Person>([{ id: 'id' }, { id: 'name' }], 'createTable')
    ).not.toThrow();
  });

  it('ngDevMode = false resolves duplicates last-wins without throwing, then restores', () => {
    const previous = getNgDevMode();
    try {
      setNgDevMode(false);

      let columns: ReturnType<typeof resolveColumnDefs<Person>> = [];
      expect(() => {
        columns = resolveColumnDefs<Person>(
          [
            { id: 'name', label: 'First label' },
            { id: 'name', label: 'Second label' },
          ],
          'createTable'
        );
      }).not.toThrow();

      expect(columns).toHaveLength(2);
      expect(columns[1].label).toBe('Second label');
      // Downstream consumers (e.g. `buildDataCells`) key by `column.id` into a plain object, so
      // the production path this case exercises resolves the collision last-wins.
      const byId = Object.fromEntries(columns.map((column) => [column.id, column]));
      expect(byId['name'].label).toBe('Second label');
    } finally {
      setNgDevMode(previous);
    }
  });
});

describe('applyColumnOrder', () => {
  const columns = resolveColumnDefs<Person>([{ id: 'id' }, { id: 'name' }], 'createTable');

  it('rewrites order from the id list', () => {
    const reordered = applyColumnOrder(columns, ['name', 'id']);

    expect(reordered.map((column) => [column.id, column.order])).toEqual([
      ['id', 1],
      ['name', 0],
    ]);
  });

  it('leaves columns absent from the id list at their current order', () => {
    const reordered = applyColumnOrder(columns, ['name']);

    expect(reordered.find((column) => column.id === 'id')?.order).toBe(0);
    expect(reordered.find((column) => column.id === 'name')?.order).toBe(0);
  });

  it('ignores unknown ids', () => {
    expect(applyColumnOrder(columns, ['nope'])).toEqual(columns);
  });
});

describe('column visibility', () => {
  const columns = resolveColumnDefs<Person>([{ id: 'id' }, { id: 'name' }], 'createTable');

  it('toggles only the named column', () => {
    const next = toggleColumnVisible(columns, 'name');

    expect(next.find((column) => column.id === 'name')?.visible).toBe(false);
    expect(next.find((column) => column.id === 'id')?.visible).toBe(true);
  });

  it('sets an explicit value', () => {
    const next = setColumnVisible(columns, 'name', false);

    expect(next.find((column) => column.id === 'name')?.visible).toBe(false);
  });

  it('is a no-op for an unknown id', () => {
    expect(toggleColumnVisible(columns, 'nope')).toEqual(columns);
  });
});

describe('foldColumnRules', () => {
  const columns = resolveColumnDefs<Person>([{ id: 'id' }, { id: 'name' }], 'createTable');

  function visibleRule(columnId: string, value: boolean | undefined): ColumnRuleEntry<Person> {
    return { columnId, key: VISIBLE, result: signal(value).asReadonly() };
  }

  it('ANDs multiple resolved rules on the same column', () => {
    const registry = [visibleRule('name', true), visibleRule('name', false)];

    const [, name] = foldColumnRules(columns, registry);

    expect(name.visible).toBe(false);
  });

  it('ignores a rule targeting a column id absent from the current columns', () => {
    const registry = [visibleRule('missing', false)];

    expect(foldColumnRules(columns, registry)).toEqual(columns);
  });

  it('passes a column with no registered rules through untouched', () => {
    const registry = [visibleRule('name', false)];

    const [id] = foldColumnRules(columns, registry);

    expect(id).toBe(columns[0]);
  });

  it('overrides the base visibility with a resolved rule result', () => {
    const registry = [visibleRule('name', false)];

    const [, name] = foldColumnRules(columns, registry);

    expect(name.visible).toBe(false);
  });

  it('leaves the base visibility when every rule in a group is unresolved', () => {
    const registry = [visibleRule('name', undefined)];

    const [, name] = foldColumnRules(columns, registry);

    expect(name.visible).toBe(columns[1].visible);
    expect(name).toBe(columns[1]);
  });

  function metaRule(
    columnId: string,
    key: ColumnMetaKey<unknown>,
    value: unknown
  ): ColumnRuleEntry<Person> {
    return { columnId, key, result: signal(value).asReadonly() };
  }

  it('attaches a resolved metadata entry onto the matching column', () => {
    const KEY = { kind: 'column-meta-key' as const };
    const registry = [metaRule('name', KEY, 'label-a')];

    const [, name] = foldColumnRules(columns, registry);

    expect(name.meta?.get(KEY)).toBe('label-a');
  });

  it('updates when the underlying signal changes', () => {
    const KEY = { kind: 'column-meta-key' as const };
    const value = signal('first');
    const registry: ColumnRuleEntry<Person>[] = [
      { columnId: 'name', key: KEY, result: value.asReadonly() },
    ];

    const [, before] = foldColumnRules(columns, registry);
    expect(before.meta?.get(KEY)).toBe('first');

    value.set('second');
    const [, after] = foldColumnRules(columns, registry);
    expect(after.meta?.get(KEY)).toBe('second');
  });

  it('leaves meta unset when the result is undefined', () => {
    const KEY = { kind: 'column-meta-key' as const };
    const registry = [metaRule('name', KEY, undefined)];

    const [, name] = foldColumnRules(columns, registry);

    expect(name.meta).toBeUndefined();
  });

  it('does not attach meta to an unrelated column', () => {
    const KEY = { kind: 'column-meta-key' as const };
    const registry = [metaRule('name', KEY, 'label-a')];

    const [id] = foldColumnRules(columns, registry);

    expect(id.meta).toBeUndefined();
  });

  it('folds visible and meta entries for the same column together', () => {
    const KEY = { kind: 'column-meta-key' as const };
    const registry = [visibleRule('name', false), metaRule('name', KEY, 'label-a')];

    const [, name] = foldColumnRules(columns, registry);

    expect(name.visible).toBe(false);
    expect(name.meta?.get(KEY)).toBe('label-a');
  });
});
