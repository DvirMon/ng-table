import { runColumnsSchemaFn } from './column-schema';
import { applyGrouping, applyGroupingAsync } from './grouping-rules';
import type { ColumnsPath } from './column-schema.types';
import type { AnyGroupingRule } from './grouping-schema.types';
import type { GroupingMockRow } from '../table.mock';

describe('applyGrouping / applyGroupingAsync', () => {
  it('records rules in call order across multiple applyGrouping calls', () => {
    const rules = runColumnsSchemaFn<GroupingMockRow, AnyGroupingRule<GroupingMockRow>>(
      (path) => {
        applyGrouping(path.region, { when: () => true });
        applyGrouping(path.category, { when: () => true });
      }
    );

    expect(rules.map((rule) => rule.columnId)).toEqual(['region', 'category']);
    expect(rules[0]).toMatchObject({ kind: 'grouping', columnId: 'region' });
    expect(rules[1]).toMatchObject({ kind: 'grouping', columnId: 'category' });
  });

  it('applyGroupingAsync without onError is a compile error', () => {
    runColumnsSchemaFn<GroupingMockRow, AnyGroupingRule<GroupingMockRow>>((path) => {
      // @ts-expect-error — `onError` is required (D13/D15): an errored resource must produce an
      // explicit boolean, never silent abstention.
      applyGroupingAsync(path.region, {
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

  it('records an applyGroupingAsync rule with all required options', () => {
    const rules = runColumnsSchemaFn<GroupingMockRow, AnyGroupingRule<GroupingMockRow>>(
      (path) => {
        applyGroupingAsync(path.region, {
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
      }
    );

    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ kind: 'grouping-async', columnId: 'region' });
  });

  it('rejects a ColumnHandle stashed and reused after the schema fn returns', () => {
    let stashedPath: ColumnsPath<GroupingMockRow, AnyGroupingRule<GroupingMockRow>> | undefined;
    runColumnsSchemaFn<GroupingMockRow, AnyGroupingRule<GroupingMockRow>>((path) => {
      stashedPath = path;
    });

    expect(stashedPath).toBeDefined();
    expect(() => {
      applyGrouping(
        (stashedPath as ColumnsPath<GroupingMockRow, AnyGroupingRule<GroupingMockRow>>).region,
        { when: () => true }
      );
    }).toThrow(/outside its schema function/);
  });
});
