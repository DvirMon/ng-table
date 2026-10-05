---
title: 'Step 3 — applyGrouping / applyGroupingAsync + the schema-fn layer'
type: task-step
issue: 60
---

# Step 3 — `applyGrouping` / `applyGroupingAsync` + the schema-fn layer

**PR scope:** The public authoring functions (top two of D8's three deletable layers: schema fn
and rules array). Still not wired into `withGrouping()` — Step 4 consumes what this step
produces.

**Task type:** code

**Skills used:** typescript-conventions, file-organization, declarative-naming

**Depends on:** Step 1, Step 2

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/schema/grouping-schema.types.ts` (edit — add `GroupingSchemaFn`)
- `libs/shared/table/src/schema/grouping-rules.ts` (new)
- `libs/shared/table/src/schema/grouping-rules.spec.ts` (new)
- `libs/shared/table/src/index.ts` (edit — export `applyGrouping`, `applyGroupingAsync`)

## Why This Step Exists

D8: "Declarative sugar ships as three deletable layers ... Schema fn → rules array → bare lambda,
each removable without breaking the layer below." This step ships the top two — the schema fn
(reusing Step 1's generalized recorder session + `ColumnsPath` proxy) and the rules-array shape
`applyGrouping`/`applyGroupingAsync` produce, which is the same `AnyGroupingRule<TRow>[]` either
layer resolves to. Step 4 treats "schema fn" and "rules array" as two ways of arriving at the
same `AnyGroupingRule<TRow>[]`, per D8's call-order-determines-level-order rule.

Decisions: `../../../3-spec.md` D8, D13, D15.

## What To Do

### 1. `GroupingSchemaFn<TRow>` — `grouping-schema.types.ts`

```ts
import type { ColumnsPath } from './column-schema.types';
import type { AnyGroupingRule } from './grouping-schema.types'; // same file, self-referential import omitted in practice

export type GroupingSchemaFn<TRow> = (path: ColumnsPath<TRow, AnyGroupingRule<TRow>>) => void;
```

(Adjust import so `ColumnsPath` instantiated at `TRule = AnyGroupingRule<TRow>` — this is exactly
what Step 1's generalization exists to make possible.)

### 2. `schema/grouping-rules.ts` — mirrors `column-rules.ts`

```ts
import type { ColumnHandle } from './column-schema.types';
import { assertPathIsCurrent } from './column-schema';
import type { AnyGroupingRule } from './grouping-schema.types';
import type { ResourceRef, Signal } from '@angular/core';

/**
 * Declares one grouping level, gated by `when`. `when` returning `undefined` (pending) makes the
 * *whole* rule set abstain (D13) — not just this level. Call order = level order (D8): the Nth
 * `applyGrouping`/`applyGroupingAsync` call in a schema fn becomes the Nth entry in the resulting
 * grouping array, when active.
 */
export function applyGrouping<TRow, K extends Extract<keyof TRow, string>>(
  path: ColumnHandle<TRow, K, AnyGroupingRule<TRow>>,
  opts: { when: () => boolean | undefined },
): void {
  assertPathIsCurrent(path).record({ kind: 'grouping', columnId: path.id, when: opts.when });
}

/**
 * Resource-backed counterpart — the rule owns fetching/re-querying. `onError` is required (D13,
 * D15): an errored resource must produce an explicit boolean, never silent abstention.
 */
export interface GroupingAsyncOpts<TParams, TResult> {
  params: () => TParams | undefined;
  factory: (params: Signal<TParams | undefined>) => ResourceRef<TResult | undefined>;
  onSuccess: (result: TResult) => boolean;
  onError: (error: unknown) => boolean;
}

export function applyGroupingAsync<TRow, K extends Extract<keyof TRow, string>, TParams, TResult>(
  path: ColumnHandle<TRow, K, AnyGroupingRule<TRow>>,
  opts: GroupingAsyncOpts<TParams, TResult>,
): void {
  assertPathIsCurrent(path).record({
    kind: 'grouping-async',
    columnId: path.id,
    params: opts.params,
    factory: opts.factory,
    onSuccess: opts.onSuccess,
    onError: opts.onError,
  });
}
```

### 3. Public exports

Add `applyGrouping`, `applyGroupingAsync` to `index.ts`'s barrel, alongside `applyVisible`/
`applyVisibleAsync`. Export the config-facing types too: `GroupingAsyncOpts`, `GroupingRule`,
`GroupingAsyncRule`, `AnyGroupingRule`, `GroupingSchemaFn` (consumers need these to type a
standalone `rules: GroupingRule<TRow>[]` array per D8's rules-array layer).

## Implementation Notes

- **`assertPathIsCurrent` is reused as-is** (Step 1 made it generic over `TRule`; no edit needed
  here beyond the call-site type argument flowing through `ColumnHandle<TRow, K,
AnyGroupingRule<TRow>>`).
- **No `runGroupingSchemaFn` wrapper needed as a separate export.** Step 1's generalized
  `runColumnsSchemaFn<TRow, TRule>(fn)` already does exactly this at
  `TRule = AnyGroupingRule<TRow>` — Step 4 calls `runColumnsSchemaFn<TRow, AnyGroupingRule<TRow>>(schemaFn)`
  directly. Adding a grouping-specific wrapper function here would just be an unnecessary
  pass-through (`extract-encapsulated-logic.md` — don't extract a single-expression forward).
- Doc-comment tone matches `column-rules.ts`'s existing `applyVisible`/`applyVisibleAsync` comments
  (terse, cites the decision letter, no narrative) per `terse-jsdoc-for-ai-and-humans.md`.

## Risks / Watchouts

- **Don't give `applyGrouping`/`applyGroupingAsync` a `ColumnRuleContext`-shaped parameter.**
  Confirmed in Step 2 — the public surface is zero-arg `when`/`params`, composing through external
  signals the closure reads, not a passed context.
- **These are NOT metadata rules and must not touch `engine/columns.ts`'s `VISIBLE`/`SORT_NULLS`
  keys or `foldColumnRules`.** They're a structurally separate rule family recorded into a
  structurally separate session (Step 1's `TRule` parameter is what keeps the two from colliding
  at the type level — a `GroupingRule` can never be pushed into a `ColumnRule<TRow>[]` array or
  vice versa).
- If `column-schema.ts`'s `assertPathIsCurrent` return type doesn't narrow cleanly to
  `ColumnSchemaRecorder<TRow, AnyGroupingRule<TRow>>` from a `ColumnHandle<TRow, K,
AnyGroupingRule<TRow>>` input, that's a Step 1 gap — fix the generic propagation there, don't
  work around it with a cast here (`typescript-conventions.md` — no bare `as`).

## Non-Goals

- No wiring of the recorded rules into `withGrouping()`'s config or fold (Step 4).
- No `groupingSchema()` standalone-reuse export (mirroring `columnSchema()`) — not asked for by
  D8's three-layer sketch, which only shows the inline-fn form passed directly to `withGrouping()`.
  Add it only if a real reuse need surfaces later.

## Acceptance Checks

- [ ] A schema fn calling `applyGrouping(path.region, { when: () => true })` then
      `applyGrouping(path.category, { when: () => true })`, run through
      `runColumnsSchemaFn<TRow, AnyGroupingRule<TRow>>`, returns rules in that exact order.
- [ ] `applyGroupingAsync` without `onError` is a **compile** error (TypeScript, not a runtime
      check) — verify with a `// @ts-expect-error` case in the spec.
- [ ] A `ColumnHandle` reused outside its schema fn's synchronous execution throws the existing
      `assertPathIsCurrent` error, unchanged message.
- [ ] `tsc --noEmit` passes; new exports resolve from `index.ts`.

---

← [Step 2: Grouping rule types + engine fold](step-2-grouping-rule-types-and-fold.plan.md) | [Step 4: Wire withGrouping() feature →](step-4-wire-with-grouping-feature.plan.md)
