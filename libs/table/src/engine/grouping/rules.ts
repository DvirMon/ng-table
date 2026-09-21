import { computed, linkedSignal, type ResourceStatus, type Signal } from '@angular/core';
import type { GroupOrder, GroupWhen } from '../../api/types';
import type {
  AnyGroupingRule,
  GroupAggregateRule,
  GroupingAsyncRule,
  GroupingRule,
  GroupKeyRule,
  GroupOrderRule,
} from '../../api/features/with-grouping/types';

/**
 * Pure grouping-rule resolution: turns `GroupingRule`/`GroupingAsyncRule` values into live
 * `GroupingRuleEntry` signals, and masks a declared level order by those entries. No
 * signals-store wiring here — `withGrouping()` is the only caller that touches a table store.
 */

export function isGroupingRule<TRow>(rule: AnyGroupingRule<TRow>): rule is GroupingRule<TRow> {
  return rule.kind === 'grouping';
}

export function isGroupingAsyncRule<TRow>(
  rule: AnyGroupingRule<TRow>
): rule is GroupingAsyncRule<TRow> {
  return rule.kind === 'grouping-async';
}

export function isGroupOrderRule<TRow>(
  rule: AnyGroupingRule<TRow>
): rule is GroupOrderRule<TRow> {
  return rule.kind === 'group-order';
}

export function isGroupKeyRule<TRow>(
  rule: AnyGroupingRule<TRow>
): rule is GroupKeyRule<TRow> {
  return rule.kind === 'grouping-key';
}

export function isGroupAggregateRule<TRow>(
  rule: AnyGroupingRule<TRow>
): rule is GroupAggregateRule<TRow> {
  return rule.kind === 'grouping-aggregate';
}

/**
 * One rule's live contribution: which column it targets, in call order, and a signal of its
 * current `boolean | undefined` result.
 */
export interface GroupingRuleEntry {
  readonly columnId: string;
  readonly result: Signal<boolean | undefined>;
}

function reportGroupingRuleError(columnId: string): void {
  // eslint-disable-next-line no-console -- ADR-0014: floor reporting mechanism, no existing
  // runtime-degradation logging abstraction to reuse in this codebase yet.
  console.error(
    `[withGrouping] a grouping rule's 'enable' predicate threw for column "${columnId}". Excluding ` +
      'that level from this evaluation instead of grouping by it.'
  );
}

export function buildGroupingRuleEntries<TRow>(
  rules: readonly GroupingRule<TRow>[]
): GroupingRuleEntry[] {
  return rules.map((rule) => ({
    columnId: rule.columnId,
    result: computed(() => {
      try {
        return rule.enable?.();
      } catch {
        reportGroupingRuleError(rule.columnId);
        return false;
      }
    }),
  }));
}

/**
 * Same retention-while-loading shape as `buildAsyncMetadataEntry` (`engine/columns-schema/wiring.ts`)
 * — holds the last-resolved boolean while a refetch is in flight, applies `onSuccess`/`onError` on
 * settle, and is `undefined` (abstain) before first resolution.
 */
export function buildAsyncGroupingRuleEntry<TRow>(
  rule: GroupingAsyncRule<TRow>
): GroupingRuleEntry {
  const params = computed(() => rule.params());
  const resource = rule.factory(params);

  const result = linkedSignal<ResourceStatus, boolean | undefined>({
    source: () => resource.status(),
    computation: (status, previous) => {
      if (status === 'resolved' || status === 'local') {
        const value = resource.value();
        return value === undefined ? previous?.value : rule.onSuccess(value);
      }
      if (status === 'error') return rule.onError(resource.error());
      return previous?.value; // loading / reloading / idle → hold
    },
  });

  return { columnId: rule.columnId, result };
}

/**
 * Masks the declared level order by each level's rule result.
 *
 * @remarks
 * A rule only switches a level off — it can never introduce one; naming a column not present in
 * `levels` is inert. A pending entry (`result() === undefined`) makes the whole set abstain, so
 * `levels` passes through unmasked rather than flashing ungrouped. Last write wins for a
 * duplicate `columnId`, not AND-combined.
 */
export function maskGroupingLevels(
  levels: readonly string[],
  entries: readonly GroupingRuleEntry[]
): string[] {
  const results = new Map<string, boolean>();
  for (const entry of entries) {
    const value = entry.result();
    if (value === undefined) return [...levels];
    results.set(entry.columnId, value);
  }
  return levels.filter((id) => results.get(id) !== false);
}

/**
 * Static per-column admission predicates, collected off the same `rules` array `withGrouping()`
 * builds — independent of `maskGroupingLevels`, which gates declared levels, not admission. Last
 * write wins for a duplicate `columnId` (undocumented edge case, not validated).
 */
export function collectGroupPredicates<TRow>(
  rules: readonly AnyGroupingRule<TRow>[]
): Map<string, GroupWhen<TRow>> {
  const predicates = new Map<string, GroupWhen<TRow>>();
  for (const rule of rules) {
    if ((isGroupingRule(rule) || isGroupingAsyncRule(rule)) && rule.when) {
      predicates.set(rule.columnId, rule.when);
    }
  }
  return predicates;
}

/**
 * Static per-column ordering comparators, collected off the same `rules` array `withGrouping()`
 * builds — independent of `maskGroupingLevels` (level gating) and `collectGroupPredicates`
 * (admission), exactly the way those two are independent of each other. Last write wins for a
 * duplicate `columnId` (undocumented edge case, not validated).
 */
export function collectGroupOrder<TRow>(
  rules: readonly AnyGroupingRule<TRow>[]
): Map<string, GroupOrder<TRow>> {
  const comparators = new Map<string, GroupOrder<TRow>>();
  for (const rule of rules) {
    if (isGroupOrderRule(rule)) {
      comparators.set(rule.columnId, rule.comparator);
    }
  }
  return comparators;
}

/**
 * Static per-field value extractors, collected off the same `rules` array from
 * `applyGroupKey`'s `GroupKeyRule` declarations. `engine/grouping/clusters.ts`'s
 * `readGroupValue` reads a column's accessor output and passes it through the matching
 * extractor, if any — the fold never runs a rule callback itself. Last write wins for a
 * duplicate `columnId` (same undocumented edge case as the two collectors above).
 */
export function collectGroupKeys<TRow>(
  rules: readonly AnyGroupingRule<TRow>[]
): Map<string, (fieldValue: unknown) => unknown> {
  const extractors = new Map<string, (fieldValue: unknown) => unknown>();
  for (const rule of rules) {
    if (isGroupKeyRule(rule)) {
      extractors.set(rule.columnId, rule.extractValue);
    }
  }
  return extractors;
}

/**
 * Static per-column aggregate fns, collected off the same `rules` array from
 * `applyAggregate`'s `GroupAggregateRule` declarations. Last write wins for a duplicate
 * `columnId` (same undocumented edge case as the collectors above).
 */
export function collectAggregates<TRow>(
  rules: readonly AnyGroupingRule<TRow>[]
): Map<string, (rows: TRow[]) => unknown> {
  const aggregates = new Map<string, (rows: TRow[]) => unknown>();
  for (const rule of rules) {
    if (isGroupAggregateRule(rule)) {
      aggregates.set(rule.columnId, rule.aggregateFn);
    }
  }
  return aggregates;
}
