import { signal, type Resource, type ResourceStatus } from '@angular/core';
import { describe, expect, it } from 'vitest';
import {
  buildAsyncGroupingRuleEntry,
  buildGroupingRuleEntries,
  collectGroupPredicates,
  isGroupingAsyncRule,
  isGroupingRule,
  maskGroupingLevels,
  type GroupingRuleEntry,
} from './rules';
import type { GroupWhen } from '../../api/types';
import type {
  AnyGroupingRule,
  GroupingAsyncRule,
  GroupingRule,
} from '../../api/features/with-grouping/types';

/**
 * Minimal controllable `Resource` test double — only the subset
 * `buildAsyncGroupingRuleEntry` actually reads (`status`, `value`, `error`). No injection context
 * needed: unlike `resource()`, neither this stub nor `linkedSignal` requires one.
 */
function makeControllableResource<TResult>(): {
  resource: Resource<TResult | undefined>;
  resolve(value: TResult): void;
  reject(error: unknown): void;
  setStatus(status: ResourceStatus): void;
} {
  const value = signal<TResult | undefined>(undefined);
  const status = signal<ResourceStatus>('idle');
  const error = signal<unknown>(undefined);

  const resource = { value, status, error } as unknown as Resource<TResult | undefined>;

  return {
    resource,
    resolve(next: TResult): void {
      value.set(next);
      status.set('resolved');
    },
    reject(nextError: unknown): void {
      error.set(nextError);
      status.set('error');
    },
    setStatus(next: ResourceStatus): void {
      status.set(next);
    },
  };
}

/**
 * Builds a `GroupingAsyncRule` backed by `control`'s resource. Left at the type's default
 * `unknown` params/result (matching `buildAsyncGroupingRuleEntry<TRow>`'s own default
 * instantiation) — `onSuccess` narrows with `Boolean()` rather than an `as` assertion since the
 * actual resolved values in these tests are always booleans.
 */
function makeAsyncRule(
  control: { resource: Resource<unknown> },
  columnId = 'region',
  when?: GroupWhen<unknown>
): GroupingAsyncRule {
  return {
    kind: 'grouping-async',
    columnId,
    params: () => 'p',
    factory: () => control.resource,
    onSuccess: (result) => Boolean(result),
    onError: () => false,
    when,
  };
}

function makeEntry(columnId: string, value: boolean | undefined): GroupingRuleEntry {
  return { columnId, result: signal(value) };
}

describe('isGroupingRule / isGroupingAsyncRule', () => {
  it('discriminates by kind', () => {
    const rule: GroupingRule = { kind: 'grouping', columnId: 'a', enable: () => true };
    const control = makeControllableResource<boolean>();
    const asyncRule = makeAsyncRule(control, 'b');

    expect(isGroupingRule(rule)).toBe(true);
    expect(isGroupingRule(asyncRule)).toBe(false);
    expect(isGroupingAsyncRule(asyncRule)).toBe(true);
    expect(isGroupingAsyncRule(rule)).toBe(false);
  });
});

describe('buildGroupingRuleEntries', () => {
  it('preserves call order and wraps each `enable` in a live signal', () => {
    const flag = signal(false);
    const rules: GroupingRule[] = [
      { kind: 'grouping', columnId: 'a', enable: () => false },
      { kind: 'grouping', columnId: 'b', enable: () => flag() },
    ];

    const entries = buildGroupingRuleEntries(rules);

    expect(entries.map((entry) => entry.columnId)).toEqual(['a', 'b']);
    expect(entries[1].result()).toBe(false);

    flag.set(true);
    expect(entries[1].result()).toBe(true);
  });
});

describe('maskGroupingLevels', () => {
  it('returns the declared levels unchanged when there are no rules', () => {
    expect(maskGroupingLevels(['a', 'b'], [])).toEqual(['a', 'b']);
  });

  it('abstains when one entry among several is pending — declared levels pass through', () => {
    const entries = [makeEntry('a', true), makeEntry('b', undefined), makeEntry('c', true)];

    expect(maskGroupingLevels(['a', 'b', 'c'], entries)).toEqual(['a', 'b', 'c']);
  });

  it('drops only the levels whose entry resolved false, keeping declared order', () => {
    const entries = [makeEntry('a', false), makeEntry('b', true), makeEntry('c', true)];

    expect(maskGroupingLevels(['a', 'b', 'c'], entries)).toEqual(['b', 'c']);
  });

  it('is inert for a rule naming a column the declared levels do not contain', () => {
    const entries = [makeEntry('z', true), makeEntry('y', false)];

    expect(maskGroupingLevels(['a', 'b'], entries)).toEqual(['a', 'b']);
  });

  it('keeps declared order regardless of entry order', () => {
    const entries = [makeEntry('c', true), makeEntry('a', true), makeEntry('b', false)];

    expect(maskGroupingLevels(['a', 'b', 'c'], entries)).toEqual(['a', 'c']);
  });

  it('returns [] when every declared level resolved false', () => {
    const entries = [makeEntry('a', false), makeEntry('b', false)];

    expect(maskGroupingLevels(['a', 'b'], entries)).toEqual([]);
  });
});

describe('buildAsyncGroupingRuleEntry', () => {
  it('is undefined before first resolution', () => {
    const control = makeControllableResource<boolean>();
    const entry = buildAsyncGroupingRuleEntry(makeAsyncRule(control));

    expect(entry.result()).toBeUndefined();
  });

  it('applies onSuccess once the resource resolves', () => {
    const control = makeControllableResource<boolean>();
    const entry = buildAsyncGroupingRuleEntry(makeAsyncRule(control));

    control.resolve(true);
    expect(entry.result()).toBe(true);
  });

  it('applies onError on failure', () => {
    const control = makeControllableResource<boolean>();
    const entry = buildAsyncGroupingRuleEntry(makeAsyncRule(control));

    control.reject(new Error('boom'));
    expect(entry.result()).toBe(false);
  });

  it('holds the last-resolved value while a subsequent reload is in flight', () => {
    const control = makeControllableResource<boolean>();
    const entry = buildAsyncGroupingRuleEntry(makeAsyncRule(control));

    control.resolve(true);
    expect(entry.result()).toBe(true);

    control.setStatus('reloading');
    expect(entry.result()).toBe(true);
  });
});

describe('collectGroupPredicates', () => {
  it('collects when from a mix of GroupingRule and GroupingAsyncRule entries', () => {
    const regionWhen: GroupWhen<unknown> = () => true;
    const repWhen: GroupWhen<unknown> = () => false;
    const control = makeControllableResource<boolean>();
    const rules: AnyGroupingRule[] = [
      { kind: 'grouping', columnId: 'region', enable: () => true, when: regionWhen },
      makeAsyncRule(control, 'rep', repWhen),
    ];

    const predicates = collectGroupPredicates(rules);

    expect(predicates.size).toBe(2);
    expect(predicates.get('region')).toBe(regionWhen);
    expect(predicates.get('rep')).toBe(repWhen);
  });

  it('excludes a rule with no when from the map', () => {
    const rules: AnyGroupingRule[] = [
      { kind: 'grouping', columnId: 'region', enable: () => true },
    ];

    const predicates = collectGroupPredicates(rules);

    expect(predicates.size).toBe(0);
    expect(predicates.has('region')).toBe(false);
  });

  it('last write wins for a duplicate columnId', () => {
    const first: GroupWhen<unknown> = () => true;
    const second: GroupWhen<unknown> = () => false;
    const rules: AnyGroupingRule[] = [
      { kind: 'grouping', columnId: 'region', enable: () => true, when: first },
      { kind: 'grouping', columnId: 'region', enable: () => true, when: second },
    ];

    const predicates = collectGroupPredicates(rules);

    expect(predicates.get('region')).toBe(second);
  });
});
