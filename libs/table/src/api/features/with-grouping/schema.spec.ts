import {
  aggregate,
  groupKey,
  grouping,
  groupingAsync,
  runGroupingSchemaFn,
} from './schema';
import type { GroupingPath } from './types';
import type { GroupingMockRow } from '../../../table.mock';

// `runGroupingSchemaFn`'s second parameter is `TValues extends ColumnValueMap` (#117's
// `GroupingHandle` value-typing, mirroring `with-sorting`'s `SortingPath<TRow, TValues>`) — a
// value map, not a bare id union, so every call below supplies the declared columns' value
// types explicitly and `path.<id>` is a real property, not an index-signature fallback.
type MockColumnId = {
  region: string;
  category: string;
  amount: number;
};

describe('grouping / groupingAsync', () => {
  it('records rules in call order across multiple grouping calls', () => {
    const rules = runGroupingSchemaFn<GroupingMockRow, MockColumnId>((path) => {
      grouping(path.region, { enable: () => true });
      grouping(path.category, { enable: () => true });
    });

    expect(rules.map((rule) => rule.columnId)).toEqual(['region', 'category']);
    expect(rules[0]).toMatchObject({ kind: 'grouping', columnId: 'region' });
    expect(rules[1]).toMatchObject({ kind: 'grouping', columnId: 'category' });
  });

  it('records a when passed via opts onto the resulting grouping rule', () => {
    const when = (): boolean => true;
    const rules = runGroupingSchemaFn<GroupingMockRow, MockColumnId>((path) => {
      grouping(path.region, { enable: () => true, when });
    });

    expect(rules[0]).toMatchObject({ kind: 'grouping', columnId: 'region', when });
  });

  it('leaves when undefined when opts does not supply one', () => {
    const rules = runGroupingSchemaFn<GroupingMockRow, MockColumnId>((path) => {
      grouping(path.region, { enable: () => true });
    });

    expect(rules[0]).toMatchObject({ when: undefined });
  });

  it('omitting enable compiles and records it as undefined — a when-only rule', () => {
    const when = (): boolean => true;
    const rules = runGroupingSchemaFn<GroupingMockRow, MockColumnId>((path) => {
      grouping(path.region, { when });
    });

    expect(rules[0]).toMatchObject({
      kind: 'grouping',
      columnId: 'region',
      enable: undefined,
      when,
    });
  });

  it('records a grouping-key rule carrying its extractor', () => {
    // The extractor's parameter is `unknown` (Step 3) — it receives the column's own accessor
    // output, not a typed row field, so it must narrow/coerce itself.
    const extractValue = (value: unknown): string => String(value).toUpperCase();
    const rules = runGroupingSchemaFn<GroupingMockRow, MockColumnId>((path) => {
      groupKey(path.region, extractValue);
    });

    expect(rules[0]).toMatchObject({
      kind: 'grouping-key',
      columnId: 'region',
      extractValue,
    });
  });

  it('records a grouping-aggregate rule carrying its aggregateFn', () => {
    const aggregateFn = (rows: GroupingMockRow[]): number => rows.length;
    const rules = runGroupingSchemaFn<GroupingMockRow, MockColumnId>((path) => {
      aggregate(path.amount, aggregateFn);
    });

    expect(rules[0]).toMatchObject({
      kind: 'grouping-aggregate',
      columnId: 'amount',
      aggregateFn,
    });
  });

  it('groupingAsync without onError is a compile error', () => {
    runGroupingSchemaFn<GroupingMockRow, MockColumnId>((path) => {
      // @ts-expect-error — `onError` is required (D13/D15): an errored resource must produce an
      // explicit boolean, never silent abstention.
      groupingAsync(path.region, {
        params: () => 'US',
        factory: () =>
          ({
            value: () => undefined,
            status: () => 'idle',
            error: () => undefined,
          }) as never,
        onSuccess: () => true,
      });
    });
  });

  it('records a groupingAsync rule with all required options', () => {
    const rules = runGroupingSchemaFn<GroupingMockRow, MockColumnId>((path) => {
      groupingAsync(path.region, {
        params: () => 'US',
        factory: () =>
          ({
            value: () => undefined,
            status: () => 'idle',
            error: () => undefined,
          }) as never,
        onSuccess: () => true,
        onError: () => false,
      });
    });

    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ kind: 'grouping-async', columnId: 'region' });
  });

  it('records a when passed via groupingAsync opts onto the resulting rule', () => {
    const when = (): boolean => true;
    const rules = runGroupingSchemaFn<GroupingMockRow, MockColumnId>((path) => {
      groupingAsync(path.region, {
        params: () => 'US',
        factory: () =>
          ({
            value: () => undefined,
            status: () => 'idle',
            error: () => undefined,
          }) as never,
        onSuccess: () => true,
        onError: () => false,
        when,
      });
    });

    expect(rules[0]).toMatchObject({ kind: 'grouping-async', columnId: 'region', when });
  });

  it('rejects a GroupingHandle stashed and reused after the schema fn returns', () => {
    let stashedPath: GroupingPath<GroupingMockRow, MockColumnId> | undefined;
    runGroupingSchemaFn<GroupingMockRow, MockColumnId>((path) => {
      stashedPath = path;
    });

    expect(stashedPath).toBeDefined();
    expect(() => {
      grouping((stashedPath as GroupingPath<GroupingMockRow, MockColumnId>).region, {
        enable: () => true,
      });
    }).toThrow(/outside its schema function/);
  });
});
