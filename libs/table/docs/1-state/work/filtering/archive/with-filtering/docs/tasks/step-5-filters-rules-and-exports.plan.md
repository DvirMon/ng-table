---
title: "Step 5 — Rules + public exports"
type: task-step
issue: 61
---

# Step 5 — Rules + public exports

**PR scope:** Depends on Steps 1, 2, 4 (imports `assertFilterPathIsCurrent` from Step 4, default
matchers from Step 2, types from Step 1). Nothing depends on this step for compilation, but
Step 6's spec needs it to declare any real filter.

**Task type:** code

**Skills used:** file-organization, declarative-naming (bare-verb rules vs. boolean-guard-prefixed matchers, R30)

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/api/filters/rules.ts` (new)
- `libs/shared/table/src/index.ts` (edit — export everything from Steps 1, 2, 4, 5)

## Why This Step Exists

The declaration rules a consumer actually calls inside a `createFilters()` schema body. Mirrors
`schema/column-rules.ts` importing `assertPathIsCurrent`/`metadata()` from the column-schema
module — here, `rules.ts` imports `assertFilterPathIsCurrent` from `create-filters.ts` (Step 4).

## What To Do

1. Each single-path rule calls `assertFilterPathIsCurrent(path)` to get the recorder, then
   `recorder.record(...)` with a `FilterRuleRecord` (Step 1's shape) whose `predicate` defaults to
   the matching matcher from Step 2, and whose `isEmpty` is the rule's own emptiness test (R14 —
   per-predicate, not centralized):

   ```ts
   export function equals<TRow, K extends Extract<keyof TRow, string>>(
     path: FilterHandle<TRow, K>,
     options?: FilterOptions<TRow[K]>
   ): void {
     const recorder = assertFilterPathIsCurrent(path);
     recorder.record({
       kind: 'single',
       paths: [path.id],
       key: options?.as ?? path.id,
       predicate: isEqual,
       isEmpty: (v) => v == null,
       emptyValue: null,
       options,
     });
   }
   ```

   Repeat for `contains` (empty = `''`), `inRange` (empty = `{min:null,max:null}`), `inDateRange`
   (empty = `{from:null,to:null}`), `hasAny`/`hasNone` (empty = `[]`).

2. `filter(path, predicate, options?)` — the general rule (R7, peer of the named ones, not a
   layer beneath them). Takes a caller-supplied predicate directly; the caller-supplied
   `isEmpty`/`emptyValue` come from `options` since there's no way to infer emptiness for an
   arbitrary criterion shape — decide here whether `filter()` requires an explicit
   `emptyValue`/`isEmpty` in its options or defaults to "never empty" (always evaluated). Document
   the choice; `filters.md` doesn't spell this out explicitly.

3. `anyOf(key, schema)` — takes its key **positionally** (not via `options.as`, R9), runs a
   nested schema fn whose rules all resolve to sub-predicates OR'd together under one criterion
   and one key (R8):

   ```ts
   export function anyOf<TRow>(
     key: string,
     schema: (path: FiltersPath<TRow>) => void
   ): void { ... }
   ```

   The nested schema fn's calls to `contains`/`filter`/etc. need to land in a **group** record
   rather than independent top-level records — decide the recording mechanism (a nested recorder
   session scoped to the group, whose closed-out records get merged into one `kind: 'group'`
   record under `key`) and implement it here. This is the trickiest rule in the file.

4. `applyWhen(path, condition, schema)` — conditional activation (R15, taken directly from Signal
   Forms). `condition` receives a `{ valueOf }`-shaped context reading other filters' current
   values (per the `filters.md` example: `condition: ({ valueOf }) => valueOf(path.category) !==
   null`). The inner `schema`'s rules only apply (are included in `active()`/evaluated) when
   `condition` is true. Wire this as a `kind: 'conditional'` record wrapping the inner rule(s) plus
   the condition callback — `create-filters.ts` (Step 4) needs to check the condition before
   including a conditional filter's criterion in `active()` or evaluating it.

5. **One filter per path enforcement is Step 4's job** (validated after all records are
   collected) — don't duplicate that check here; this file only records what it's told.

## Implementation Notes

- Rules keep the bare verb (`equals`, `contains`) because they *do* something (register a filter);
  matchers keep the boolean-guard prefix (`isEqual`, `isContaining`) because they *return*
  something (R30) — this is a real repo convention
  (`~/.claude/rules/declarative-naming.md`'s boolean-prefix rule extended to this predicate/action
  split), not incidental naming.
- `index.ts` export block, matching the existing style for other feature exports:

  ```ts
  export { createFilters } from './api/create-filters';
  export type { Filters, FilterNode, FilterOptions } from './api/filters.types';
  export {
    equals, contains, inRange, inDateRange, hasAny, hasNone, filter, anyOf, applyWhen,
  } from './api/filters/rules';
  export {
    isEqual, isContaining, isInRange, isInDateRange, hasAnyOf, hasNoneOf,
  } from './api/filters/matchers';
  ```

## Risks / Watchouts

- **`anyOf`'s nested recording is the highest-risk piece of this whole issue.** If the nested
  schema fn's rule calls can't cleanly route into a group-scoped sub-recorder without duplicating
  most of `create-filters.ts`'s session logic, stop and reconsider the record shape from Step 1
  rather than forcing it — a wrong shape here is expensive to unwind once Step 6's spec is
  written against it.
- Don't let `filter()`'s caller-supplied predicate accidentally get wrapped in the R27 null-guard
  that the named matchers use — `filters.md` is explicit that a custom predicate receives the
  cell unguarded.

## Non-Goals

- No runtime evaluation loop — rules only *declare*, they never run a predicate against real row
  data (that happens in Step 4's safe-evaluate guard, called later by issue #62).

## Acceptance Checks

- [ ] All nine rules exported and produce correctly-shaped `FilterRuleRecord`s
- [ ] `as` overrides a borrowed key on every single-path rule; string-literal enforced at compile time
- [ ] `anyOf` groups sub-predicates as OR, under one key, positionally supplied
- [ ] `applyWhen` gates inclusion in `active()`/evaluation on its condition, reading other filters via `valueOf`
- [ ] `filter()` accepts an arbitrary predicate with no R27 null-guard applied automatically
- [ ] `index.ts` exports everything per `filters.md`'s Public API table (createFilters, Filters/FilterNode/FilterOptions, all rules, all matchers)
- [ ] `tsc --noEmit` passes with no new errors

---
← [Step 4: createFilters() core](step-4-create-filters-core.plan.md) | [Step 6: createFilters() spec](step-6-create-filters-spec.plan.md) →
