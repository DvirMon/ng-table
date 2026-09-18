import { computed, linkedSignal, type ResourceStatus, type Signal } from '@angular/core';
import type { GroupOrder, GroupWhen } from '../api/types';
import type {
  AnyGroupingRule,
  GroupingAsyncRule,
  GroupingRule,
  GroupOrderRule,
} from '../schema/grouping-schema.types';

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
 * Masks the declared level order by each level's rule result. `levels` owns which columns group
 * and in what nesting order; a rule only switches one of them off. A rule naming a column
 * `levels` does not contain is inert — it can never introduce a level, matching how a `when`
 * predicate or a `GroupOrderRule` on an inactive column is a no-op.
 *
 * A pending entry (`result() === undefined`) makes the whole set abstain: `levels` passes
 * through unmasked, so a table holds its declared grouping rather than flashing ungrouped while
 * a rule resolves. A `when`-only rule declares no `enable` and never reaches here.
 *
 * Deliberately does NOT AND-combine same-column entries the way `engine/columns.ts`'s
 * `foldColumnRules` does for `VISIBLE`. Last write wins for a duplicate `columnId`, matching
 * `collectGroupPredicates`/`collectGroupOrder` (undocumented edge case, not validated).
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
    if (!isGroupOrderRule(rule) && rule.when) {
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
