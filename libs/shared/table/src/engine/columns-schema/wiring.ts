import { computed, linkedSignal, type ResourceStatus } from '@angular/core';
import type { ColumnRuleEntry } from '../columns';
import type {
  ColumnRule,
  ColumnRuleContext,
  MetadataAsyncRule,
  MetadataRule,
} from '../../schema/column-schema.types';

/**
 * Run phase: turns compiled `ColumnRule`s into `ColumnRuleEntry` values the engine folds onto
 * `baseColumns` (`foldColumnRules`) — one path for both consumer `metadata()` and
 * `applyVisible`/`applyVisibleAsync` (convenience wrappers over the same primitive, see
 * `schema/column-rules.ts`). Async entries construct a `resource()`, which requires an injection
 * context — every function here must be called from inside one (the engine guarantees that by
 * running `composeTable()` under the owner's).
 */

export function isMetadataRule<TRow>(
  rule: ColumnRule<TRow>
): rule is MetadataRule<TRow> {
  return rule.kind === 'metadata';
}

export function isMetadataAsyncRule<TRow>(
  rule: ColumnRule<TRow>
): rule is MetadataAsyncRule<TRow> {
  return rule.kind === 'metadata-async';
}

/**
 * One `ColumnRuleEntry` per `metadata()`/`applyVisible()` call. `logic` resolves as a reactive
 * closure or a plain value — both wrapped in the same `computed()` so the fold in
 * `engine/columns.ts` doesn't need to know which. Grouping/combining by `(columnId, key)`
 * happens in `foldColumnRules`, not here.
 */
export function buildMetadataEntries<TRow>(
  ctx: ColumnRuleContext<TRow>,
  rules: readonly MetadataRule<TRow>[]
): ColumnRuleEntry<TRow>[] {
  return rules.map((rule) => ({
    columnId: rule.columnId,
    key: rule.key,
    result: computed(() =>
      typeof rule.logic === 'function'
        ? (rule.logic as (ctx: ColumnRuleContext<TRow>) => unknown)(ctx)
        : rule.logic
    ),
  }));
}

/**
 * Builds the async rule's resource and its D5 retention cell: holds the last-resolved value
 * while a refetch is in flight (`loading`/`reloading`), applies `onSuccess`/`onError` on
 * settle, and defers to the column's declared visibility before first resolution (`result`
 * stays `undefined`, which `foldColumnRules` treats as "no opinion yet").
 */
export function buildAsyncMetadataEntry<TRow>(
  ctx: ColumnRuleContext<TRow>,
  rule: MetadataAsyncRule<TRow>
): ColumnRuleEntry<TRow> {
  const params = computed(() => rule.params(ctx));
  const resourceRef = rule.factory(params);

  const result = linkedSignal<ResourceStatus, unknown>({
    source: () => resourceRef.status(),
    computation: (status, previous) => {
      if (status === 'resolved' || status === 'local') {
        const value = resourceRef.value();
        return value === undefined ? previous?.value : rule.onSuccess(value);
      }
      if (status === 'error') return rule.onError(resourceRef.error());
      return previous?.value; // loading / reloading / idle → hold
    },
  });

  return { columnId: rule.columnId, key: rule.key, result };
}
