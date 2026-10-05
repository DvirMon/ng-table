---
title: 'Step 2 — grouping rule types + engine-side fold'
type: task-step
issue: 60
---

# Step 2 — grouping rule types + engine-side fold

**PR scope:** New types and pure engine functions only. Nothing wired into `withGrouping()` yet
(Step 4) and no public `apply*` authoring functions yet (Step 3) — this step is the shared
foundation both build on.

**Task type:** code

**Skills used:** typescript-conventions, file-organization

**Depends on:** Step 1

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/schema/grouping-schema.types.ts` (new)
- `libs/shared/table/src/engine/grouping-rules.ts` (new)
- `libs/shared/table/src/engine/grouping-rules.spec.ts` (new, pure-function tests colocated per
  this step — see Acceptance Checks; full feature-level coverage is Step 5)

## Why This Step Exists

D13 specs two rule variants that "split on who owns the value at runtime" (sync `applyGrouping`
vs. resource-backed `applyGroupingAsync`), with uniform abstain semantics: a pending rule
contributes `undefined` and the **whole rule set** abstains (not just that level) — different
from `VISIBLE`'s per-column AND-fold in `engine/columns.ts`'s `foldColumnRules`, because grouping
rules don't merge per-column, they resolve into one ordered `string[]`.

Decisions: `../../../3-spec.md` D6, D7, D8, D13.

## What To Do

### 1. `schema/grouping-schema.types.ts` — the rule shapes

```ts
import type { ResourceRef, Signal } from '@angular/core';

/** One schema-fn/rules-array level: `when` contributes whether this column is an active
 * grouping level. `undefined` (pending) makes the whole rule set abstain (D13) — never
 * "this level doesn't apply", that's `false`, and never "the value hasn't loaded", that's also
 * `undefined` but resolved to abstain at the fold, not at this rule. */
export interface GroupingRule<TRow = unknown> {
  readonly kind: 'grouping';
  readonly columnId: string;
  readonly when: () => boolean | undefined;
}

/** Resource-backed counterpart — the rule owns fetching (`params`/`factory`) and both outcomes
 * (`onSuccess`/`onError`, both required per D13/D15, mirroring `MetadataAsyncRule`'s
 * `onError`-required contract). */
export interface GroupingAsyncRule<TRow = unknown, TParams = unknown, TResult = unknown> {
  readonly kind: 'grouping-async';
  readonly columnId: string;
  readonly params: () => TParams | undefined;
  readonly factory: (params: Signal<TParams | undefined>) => ResourceRef<TResult | undefined>;
  readonly onSuccess: (result: TResult) => boolean;
  readonly onError: (error: unknown) => boolean;
}

export type AnyGroupingRule<TRow = unknown> = GroupingRule<TRow> | GroupingAsyncRule<TRow>;
```

> Use `Resource<TResult | undefined>` (not `ResourceRef`) for `factory`'s return type per D9 of
> `effect-free-column-reactivity` — the same "only reads `.status()`/`.value()`/`.error()`, never
> mutates" reasoning applies here verbatim. Confirm which of `Resource`/`ResourceRef` is exported
> from the installed `@angular/core` before committing to the import.

### 2. `engine/grouping-rules.ts` — entries + the abstain-as-a-set fold

```ts
import { computed, linkedSignal, type ResourceStatus, type Signal } from '@angular/core';
import type {
  AnyGroupingRule,
  GroupingAsyncRule,
  GroupingRule,
} from '../schema/grouping-schema.types';

export function isGroupingRule<TRow>(rule: AnyGroupingRule<TRow>): rule is GroupingRule<TRow> {
  return rule.kind === 'grouping';
}
export function isGroupingAsyncRule<TRow>(
  rule: AnyGroupingRule<TRow>,
): rule is GroupingAsyncRule<TRow> {
  return rule.kind === 'grouping-async';
}

/** One rule's live contribution: which column it targets, in call order, and a signal of its
 * current `boolean | undefined` result. */
export interface GroupingRuleEntry {
  readonly columnId: string;
  readonly result: Signal<boolean | undefined>;
}

export function buildGroupingRuleEntries<TRow>(
  rules: readonly GroupingRule<TRow>[],
): GroupingRuleEntry[] {
  return rules.map((rule) => ({ columnId: rule.columnId, result: computed(() => rule.when()) }));
}

/** Same retention-while-loading shape as `buildAsyncMetadataEntry`
 * (`engine/columns-schema/wiring.ts`) — holds the last-resolved boolean while a refetch is in
 * flight, applies `onSuccess`/`onError` on settle, and is `undefined` (abstain) before first
 * resolution. */
export function buildAsyncGroupingRuleEntry<TRow>(
  rule: GroupingAsyncRule<TRow>,
): GroupingRuleEntry {
  const params = computed(() => rule.params());
  const resourceRef = rule.factory(params);

  const result = linkedSignal<ResourceStatus, boolean | undefined>({
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

  return { columnId: rule.columnId, result };
}

/** The D13 fold: a pending entry (result() === undefined) makes the whole set abstain — the
 * caller's `groupingRule()` returns `undefined` and the outer base/overlay fold (Step 4) falls
 * back to `baseGrouping`. Otherwise, collects `columnId`s whose entry resolved `true`, preserving
 * entry order (= call order in the schema fn / rules-array order, D8). */
export function foldGroupingRules(entries: readonly GroupingRuleEntry[]): string[] | undefined {
  const levels: string[] = [];
  for (const entry of entries) {
    const value = entry.result();
    if (value === undefined) return undefined;
    if (value) levels.push(entry.columnId);
  }
  return levels;
}
```

## Implementation Notes

- **`foldGroupingRules` is a plain function over already-live signals, not itself a `computed()`.**
  The caller (Step 4) wraps it: `const rulesGroupingRule = () => foldGroupingRules(entries)`. Keep
  it this way — it's what makes the function trivially unit-testable with plain `signal()` stubs,
  matching this file's "pure engine code, plain `vitest`, no `TestBed`" rule.
- **No `ColumnRuleContext`-equivalent parameter.** Unlike `applyVisible`'s `when(ctx)`, D13/D8's
  public surface sketch shows `when: () => boolean | undefined` — zero-arg. Grouping rules compose
  through external signals the closure reads directly (same reasoning as
  `effect-free-column-reactivity` D10) — don't add a context object nobody asked for.
- Every `columnId` here is a plain `string` (post-`ColumnId<TRow>` — the branded type is a
  call-site/authoring-time convenience in `schema/grouping-rules.ts`, Step 3; by the time a rule
  reaches this fold it's already a resolved string, same as `GroupingRule.columnId` above).

## Risks / Watchouts

- **Don't special-case `VISIBLE`-style AND-combining here.** `foldColumnRules` ANDs multiple
  rules targeting the _same_ column; this fold does something structurally different — it
  abstains-as-a-set and otherwise unions _distinct_ columns into one ordered array. Copy-pasting
  `foldColumnRules`'s shape would silently reproduce the wrong semantics.
- **`linkedSignal`'s `previous` is `undefined` before first resolution** — `buildAsyncGroupingRuleEntry`
  must return `undefined` in that case (falls through to `foldGroupingRules`'s abstain branch), not
  a false default. Verify with a resource stub whose status starts at `'idle'`/`'loading'`.

## Non-Goals

- No `applyGrouping`/`applyGroupingAsync` public functions yet (Step 3).
- No wiring into `withGrouping()`'s config/fold yet (Step 4).
- No construction-time unknown-column-id validation here — that happens where `columns` is known
  (Step 4, inline in `withGrouping()`'s factory, same place `initialGrouping` is already
  validated).

## Acceptance Checks

- [ ] `foldGroupingRules([])` returns `[]` (no rules ⇒ grouped by nothing, not abstain).
- [ ] One pending entry among several resolved ones makes `foldGroupingRules` return `undefined`.
- [ ] Resolved entries in call order `[false, true, true]` for columns `[a, b, c]` fold to
      `['b', 'c']`.
- [ ] `buildAsyncGroupingRuleEntry`: before first resolution → `undefined`; after `onSuccess` →
      its boolean; on error → `onError`'s boolean; a subsequent reload holds the last value while
      `status()` is `'reloading'`.
- [ ] `tsc --noEmit` passes.

---

← [Step 1: Generalize recorder session](step-1-generalize-recorder-session.plan.md) | [Step 3: Declarative sugar functions →](step-3-declarative-sugar-functions.plan.md)
