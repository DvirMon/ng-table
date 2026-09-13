import { signal, type Resource, type ResourceStatus } from '@angular/core';
import { describe, expect, it } from 'vitest';
import {
  buildAsyncGroupingRuleEntry,
  buildGroupingRuleEntries,
  foldGroupingRules,
  isGroupingAsyncRule,
  isGroupingRule,
  type GroupingRuleEntry,
} from './grouping-rules';
import type { GroupingAsyncRule, GroupingRule } from '../schema/grouping-schema.types';

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
function makeAsyncRule(control: { resource: Resource<unknown> }, columnId = 'region'): GroupingAsyncRule {
  return {
    kind: 'grouping-async',
    columnId,
    params: () => 'p',
    factory: () => control.resource,
    onSuccess: (result) => Boolean(result),
    onError: () => false,
  };
}

function makeEntry(columnId: string, value: boolean | undefined): GroupingRuleEntry {
  return { columnId, result: signal(value) };
}

describe('isGroupingRule / isGroupingAsyncRule', () => {
  it('discriminates by kind', () => {
    const rule: GroupingRule = { kind: 'grouping', columnId: 'a', when: () => true };
    const control = makeControllableResource<boolean>();
    const asyncRule = makeAsyncRule(control, 'b');

    expect(isGroupingRule(rule)).toBe(true);
    expect(isGroupingRule(asyncRule)).toBe(false);
    expect(isGroupingAsyncRule(asyncRule)).toBe(true);
    expect(isGroupingAsyncRule(rule)).toBe(false);
  });
});

describe('buildGroupingRuleEntries', () => {
  it('preserves call order and wraps each `when` in a live signal', () => {
    const flag = signal(false);
    const rules: GroupingRule[] = [
      { kind: 'grouping', columnId: 'a', when: () => false },
      { kind: 'grouping', columnId: 'b', when: () => flag() },
    ];

    const entries = buildGroupingRuleEntries(rules);

    expect(entries.map((entry) => entry.columnId)).toEqual(['a', 'b']);
    expect(entries[1].result()).toBe(false);

    flag.set(true);
    expect(entries[1].result()).toBe(true);
  });
});

describe('foldGroupingRules', () => {
  it('returns [] for no rules (grouped by nothing, not abstain)', () => {
    expect(foldGroupingRules([])).toEqual([]);
  });

  it('abstains (returns undefined) when one entry among several is pending', () => {
    const entries = [makeEntry('a', true), makeEntry('b', undefined), makeEntry('c', true)];

    expect(foldGroupingRules(entries)).toBeUndefined();
  });

  it('folds resolved entries in call order to the columns that resolved true', () => {
    const entries = [makeEntry('a', false), makeEntry('b', true), makeEntry('c', true)];

    expect(foldGroupingRules(entries)).toEqual(['b', 'c']);
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
