import { applyGrouping, applyGroupingAsync, runGroupingSchemaFn } from './schema';
import type { GroupingPath } from './types';
import type { GroupingMockRow } from '../../../table.mock';

describe('applyGrouping / applyGroupingAsync', () => {
  it('records rules in call order across multiple applyGrouping calls', () => {
    const rules = runGroupingSchemaFn<GroupingMockRow>((path) => {
      applyGrouping(path.region, { enable: () => true });
      applyGrouping(path.category, { enable: () => true });
    });

    expect(rules.map((rule) => rule.columnId)).toEqual(['region', 'category']);
    expect(rules[0]).toMatchObject({ kind: 'grouping', columnId: 'region' });
    expect(rules[1]).toMatchObject({ kind: 'grouping', columnId: 'category' });
  });

  it('records a when passed via opts onto the resulting grouping rule', () => {
    const when = (): boolean => true;
    const rules = runGroupingSchemaFn<GroupingMockRow>((path) => {
      applyGrouping(path.region, { enable: () => true, when });
    });

    expect(rules[0]).toMatchObject({ kind: 'grouping', columnId: 'region', when });
  });

  it('leaves when undefined when opts does not supply one', () => {
    const rules = runGroupingSchemaFn<GroupingMockRow>((path) => {
      applyGrouping(path.region, { enable: () => true });
    });

    expect(rules[0]).toMatchObject({ when: undefined });
  });

  it('omitting enable compiles and records it as undefined — a when-only rule', () => {
    const when = (): boolean => true;
    const rules = runGroupingSchemaFn<GroupingMockRow>((path) => {
      applyGrouping(path.region, { when });
    });

    expect(rules[0]).toMatchObject({
      kind: 'grouping',
      columnId: 'region',
      enable: undefined,
      when,
    });
  });

  it('records extractValue and label when supplied', () => {
    const extractValue = (region: string): string => region.toUpperCase();
    const rules = runGroupingSchemaFn<GroupingMockRow>((path) => {
      applyGrouping(path.region, { enable: () => true, extractValue, label: 'Region' });
    });

    expect(rules[0]).toMatchObject({
      kind: 'grouping',
      columnId: 'region',
      extractValue,
      label: 'Region',
    });
  });

  it('applyGroupingAsync without onError is a compile error', () => {
    runGroupingSchemaFn<GroupingMockRow>((path) => {
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
    const rules = runGroupingSchemaFn<GroupingMockRow>((path) => {
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
    });

    expect(rules).toHaveLength(1);
    expect(rules[0]).toMatchObject({ kind: 'grouping-async', columnId: 'region' });
  });

  it('records a when passed via applyGroupingAsync opts onto the resulting rule', () => {
    const when = (): boolean => true;
    const rules = runGroupingSchemaFn<GroupingMockRow>((path) => {
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
        when,
      });
    });

    expect(rules[0]).toMatchObject({ kind: 'grouping-async', columnId: 'region', when });
  });

  it('rejects a GroupingHandle stashed and reused after the schema fn returns', () => {
    let stashedPath: GroupingPath<GroupingMockRow> | undefined;
    runGroupingSchemaFn<GroupingMockRow>((path) => {
      stashedPath = path;
    });

    expect(stashedPath).toBeDefined();
    expect(() => {
      applyGrouping((stashedPath as GroupingPath<GroupingMockRow>).region, {
        enable: () => true,
      });
    }).toThrow(/outside its schema function/);
  });
});
