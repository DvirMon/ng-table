import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
  signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { composeTable } from './compose-table';
import type { TableEngineConfig, TableFeature } from './types';
import type { AnyTableFeature, ColumnDefInput, RowId } from '../api/types';

interface Row {
  id: string;
  name: string;
  age: number;
}

const columns: ColumnDefInput<Row>[] = [{ id: 'name' }, { id: 'age' }];

function makeRows(): Row[] {
  return [
    { id: 'r1', name: 'Charlie', age: 40 },
    { id: 'r2', name: 'Ann', age: 25 },
  ];
}

// Composes inside an injection context, as `createTable()` does. Returns the untyped store
// because the engine's runtime fold is deliberately independent of the static member type
// `ComposedFeatureMembers` reconstructs. Each call gets its own `data` signal so tests seed
// rows at construction time — there is no post-construction write path anymore.
function composeWithRows(
  rows: Row[],
  features: readonly AnyTableFeature[]
): Record<string, unknown> {
  const data = signal(rows);
  const config: TableEngineConfig<Row> = { columns, trackBy: 'id', data };
  return TestBed.runInInjectionContext(
    () => composeTable(config, features) as unknown as Record<string, unknown>
  );
}

function compose(
  features: readonly AnyTableFeature[]
): Record<string, unknown> {
  return composeWithRows([], features);
}

/** Records a stage transform that tags each row's name, so fold order is observable. */
function taggingStage(
  stage: 'filter' | 'group' | 'sort' | 'expand',
  tag: string
): TableFeature<Row> {
  return () => ({
    stages: {
      [stage]: (rows: Row[]) =>
        rows.map((row) => ({ ...row, name: `${row.name}${tag}` })),
    },
  });
}

describe('composeTable', () => {
  it('resolves sparse column defs into full ColumnDefs', () => {
    const store = compose([]);
    const resolved = (store['columns'] as () => Record<string, unknown>[])();

    expect(resolved).toHaveLength(2);
    expect(resolved[0]).toMatchObject({
      id: 'name',
      visible: true,
      order: 0,
      label: 'name',
    });
  });

  it('passes rows through untouched when no feature registers a stage', () => {
    const store = composeWithRows(makeRows(), []);

    expect((store['rows'] as () => Row[])()).toEqual(makeRows());
  });

  it('merges every feature’s members onto the store', () => {
    const withA: TableFeature<Row> = () => ({ members: { alpha: 1 } });
    const withB: TableFeature<Row> = () => ({ members: { beta: 2 } });

    const store = compose([withA, withB]);

    expect(store['alpha']).toBe(1);
    expect(store['beta']).toBe(2);
  });

  it('folds stages in fixed pipeline order regardless of features array order', () => {
    const store = composeWithRows(
      [{ id: 'r1', name: 'Ann', age: 25 }],
      [
        taggingStage('expand', '-expand'),
        taggingStage('sort', '-sort'),
        taggingStage('filter', '-filter'),
        taggingStage('group', '-group'),
      ]
    );

    const [row] = (store['rows'] as () => Row[])();

    expect(row.name).toBe('Ann-filter-group-sort-expand');
  });

  it('1:1-wraps rows into render rows when no feature provides renderRows', () => {
    const store = composeWithRows(makeRows(), []);

    expect((store['renderRows'] as () => unknown[])()).toEqual([
      { id: 'r1', depth: 0, kind: 'row', data: { id: 'r1', name: 'Charlie', age: 40 }, index: 0, sourceIndex: 0 },
      { id: 'r2', depth: 0, kind: 'row', data: { id: 'r2', name: 'Ann', age: 25 }, index: 1, sourceIndex: 1 },
    ]);
  });

  it('lets a feature replace the render-row builder', () => {
    const withFlatRenderRows: TableFeature<Row> = () => ({
      renderRows: (rows) =>
        rows.map((row) => ({ id: row.id, depth: 1, kind: 'row' as const, data: row })),
    });

    const store = composeWithRows(makeRows(), [withFlatRenderRows]);

    const [first] = (store['renderRows'] as () => { depth: number }[])();
    expect(first.depth).toBe(1);
  });

  it('throws when two features claim the same pipeline stage', () => {
    expect(() =>
      compose([taggingStage('sort', '-a'), taggingStage('sort', '-b')])
    ).toThrow(/features\[0\] and features\[1\] both provide the "sort" pipeline stage/);
  });

  it('throws when two features claim renderRows', () => {
    const withRenderRows: TableFeature<Row> = () => ({ renderRows: (rows) => rows.map((row) => ({ id: row.id, depth: 0, kind: 'row' as const, data: row })) });

    expect(() => compose([withRenderRows, withRenderRows])).toThrow(
      /features\[0\] and features\[1\] both provide `renderRows`/
    );
  });

  it('runs onInit only after every feature is composed', () => {
    let seenAtInit: unknown;
    const withLateReader: TableFeature<Row> = (_core, composed) => ({
      onInit: () => {
        seenAtInit = composed['contributedLater'];
      },
    });
    const withLateMember: TableFeature<Row> = () => ({
      members: { contributedLater: 'present' },
    });

    compose([withLateReader, withLateMember]);

    expect(seenAtInit).toBe('present');
  });

  it('shows a feature only earlier features’ members at factory time', () => {
    let seenAtFactory: unknown = 'unset';
    const withEarly: TableFeature<Row> = () => ({ members: { early: 'yes' } });
    const withReader: TableFeature<Row> = (_core, composed) => {
      seenAtFactory = { early: composed['early'], late: composed['late'] };
      return {};
    };
    const withLate: TableFeature<Row> = () => ({ members: { late: 'yes' } });

    compose([withEarly, withReader, withLate]);

    expect(seenAtFactory).toEqual({ early: 'yes', late: undefined });
  });

  it('runs onDestroy hooks when the owning injector is destroyed', () => {
    const destroyed: string[] = [];
    const withTeardown: TableFeature<Row> = () => ({
      onDestroy: () => destroyed.push('torn-down'),
    });

    const injector = createEnvironmentInjector(
      [],
      TestBed.inject(EnvironmentInjector)
    );
    const config: TableEngineConfig<Row> = { columns, trackBy: 'id', data: signal([]) };
    runInInjectionContext(injector, () => composeTable(config, [withTeardown]));

    expect(destroyed).toEqual([]);

    injector.destroy();

    expect(destroyed).toEqual(['torn-down']);
  });

  it('gives each composition independent state', () => {
    const first = composeWithRows(makeRows(), []);
    const second = composeWithRows([], []);

    expect((first['rows'] as () => Row[])()).toHaveLength(2);
    expect((second['rows'] as () => Row[])()).toHaveLength(0);
  });

  describe('onRowsRemoved (ADR-0006)', () => {
    function composeWithData(
      data: ReturnType<typeof signal<Row[]>>,
      onRowsRemoved: (ids: readonly RowId[]) => void
    ): void {
      const withReconciler: TableFeature<Row> = () => ({ onRowsRemoved });
      const config: TableEngineConfig<Row> = { columns, trackBy: 'id', data };
      TestBed.runInInjectionContext(() => composeTable(config, [withReconciler]));
    }

    it('fires with the diffed ids when data.update(...) drops a row', () => {
      const data = signal(makeRows());
      const removed: RowId[][] = [];
      composeWithData(data, (ids) => removed.push([...ids]));

      data.update((rows) => rows.filter((row) => row.id !== 'r1'));
      TestBed.tick();

      expect(removed).toEqual([['r1']]);
    });

    it('fires on a direct data.set(...) full replacement', () => {
      const data = signal(makeRows());
      const removed: RowId[][] = [];
      composeWithData(data, (ids) => removed.push([...ids]));

      data.set([{ id: 'r3', name: 'New', age: 1 }]);
      TestBed.tick();

      expect(removed).toEqual([['r1', 'r2']]);
    });

    it('does not fire when no composed feature declares onRowsRemoved', () => {
      const data = signal(makeRows());
      const config: TableEngineConfig<Row> = { columns, trackBy: 'id', data };
      // No onRowsRemoved hook composed — the effect should never be created, so mutating
      // `data` afterward must not throw or do anything observable here.
      TestBed.runInInjectionContext(() => composeTable(config, []));

      expect(() => {
        data.set([]);
        TestBed.tick();
      }).not.toThrow();
    });

    it('does not fire when a data change only adds rows', () => {
      const data = signal(makeRows());
      const removed: RowId[][] = [];
      composeWithData(data, (ids) => removed.push([...ids]));

      data.update((rows) => [...rows, { id: 'r3', name: 'New', age: 1 }]);
      TestBed.tick();

      expect(removed).toEqual([]);
    });
  });
});
