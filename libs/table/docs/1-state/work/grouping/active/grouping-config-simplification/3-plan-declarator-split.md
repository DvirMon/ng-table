---
title: Plan — split grouping's declarators (`applyGroupKey`, `label` on `initial`)
type: plan
status: D9 decided 2026-09-19. Executed 2026-09-20 in `4c86322` — `applyGroupKey` is exported from `src/index.ts`.
date: 2026-09-19
audience: developers
---

# D9 — split grouping's declarators: `applyGroupKey`, and `label` onto `initial`

> Implements **D9** in [`2-decisions.md`](2-decisions.md). Read that first —
> it carries the rationale and the counter-arguments; this file carries only
> the execution.

## Context

`withGrouping()`'s `applyGrouping(path.x, { enable, when, extractValue, label })`
carries four unrelated concerns in one options bag. D7 put them there when
grouping's schema path moved from declared column ids to row fields
(ADR-0021); nothing since has separated them.

Three concrete problems follow from that packing:

1. **A rule that only derives a key cannot be declared.**
   `libs/table/src/api/features/with-grouping/feature.ts:91-98` throws on any
   `applyGrouping` rule carrying neither `enable` nor `when`, so
   `applyGrouping(path.closedAt, { extractValue: monthOf })` is rejected.
   Today you must add a dummy `enable: () => true` to declare an extractor.
2. **`label` is a static display fact living in a dynamic-rule surface**, next
   to two predicates re-evaluated on every read.
3. **There is nowhere to put a level's static config** except a rule, because
   `initial` is a bare `string[]`.

### Outcome

One declarator per concern, and static level config on `initial`:

```ts
withGrouping({
  initial: [{ key: 'closedAt', label: 'Closed' }, 'region'],
  schema: (path) => {
    applyGrouping(path.region, { enable, when }); // activation
    applyGroupKey(path.closedAt, (d) => monthOf(d)); // key derivation (NEW)
    applyGroupOrder(path.region, compareGroups); // sibling order
  },
});
```

`extractValue` and `label` come off both `GroupingRule` and
`GroupingAsyncRule`. Label resolution becomes `initial` entry → matching
column's `label` → raw key.

### Two constraints that shape the design

**`table.grouping` state stays `string[]`.** Level objects in the writable
state were rejected: an `extractValue` function is silently dropped by
`JSON.stringify`, so a persisted-then-restored level would key raw
`Date`/object values — one group per row, no throw. Keeping state as keys
also leaves `setGroupLevels`/`addGroupLevel`/`removeGroupLevel`/
`reorderGroupLevels` (`libs/table/src/mutations/update-grouping.ts`)
completely untouched.

**`extractValue` stays keyed by row field, not by `initial` entry.**
`grouping.update(g => [...g, 'owner'])` can add a level never declared in
`initial`. Because `applyGroupKey` records against the field, such a level
still finds its extractor.

### Three findings that shape the steps

- **The string shorthand is load-bearing.** `initial` becomes
  `(ColumnId<TRow> | GroupingLevel<TRow>)[]`. Keeping the bare-string arm
  means all 87 `initial:` sites in `feature.spec.ts` and all 5 story sites
  compile untouched — `ColumnId<TRow>[]` is assignable to the union array by
  array covariance, including through `ColumnId`'s `(string & {})` arm.
- **Adding a 4th rule kind breaks a negative narrowing.**
  `collectGroupPredicates` (`engine/grouping/rules.ts:129`),
  `collectExtractValue` (`:166`) and `collectGroupLabels` (`:183`) all narrow
  with `!isGroupOrderRule(rule)` and then read `.when`/`.extractValue`/
  `.label`. With `GroupKeyRule` in the union that narrowing no longer implies
  those members, and `rules.ts:129` becomes a compile error. Two of the three
  are deleted by this refactor; `collectGroupPredicates` must be rewritten to
  filter positively.
- **Migration load is tiny.** Exactly one site in the repo passes
  `extractValue`/`label` to a grouping rule: `schema.spec.ts:51`. No story
  uses either.

## Not in scope

- Renaming grouping rules' `columnId` property to `field`. A misnomer since
  D7, but ~134 occurrences across `engine/grouping/**` and their specs.
- Wrapping `readGroupFieldValue`'s extractor call under ADR-0014
  (`clusters.ts:119-127` — a throwing extractor propagates today).
  Pre-existing, unchanged here.
- Duplicate-registration guards. All four grouping collectors document
  last-wins as "undocumented edge case, not validated"; `collectGroupKeys`
  matches them (explicitly chosen). Closing that gap is a separate pass.
- The planned `grouping-keys` story
  (`libs/table/docs/3-ui/work/archive/grouping-stories/3-lesson-audit.md` §3.3). This
  refactor changes the API that story demonstrates; the story is its own
  effort.

## Dependency graph

```
                 ┌───────────────────────────┐
                 │ 1. types.ts     (core)    │
                 └────┬──────────────────┬───┘
                      │                  │
        ┌─────────────▼──────┐   ┌───────▼─────────────┐
        │ 2. declarators     │   │ 3. collectors       │
        │    schema.ts       │   │    rules.ts         │
        └──┬──────────────┬──┘   └──┬───────────────┬──┘
           │              │         │               │
   ┌───────▼──────┐       └────┬────┘        ┌──────▼──────────┐
   │ 6. index.ts  │            │             │ 5. report text  │
   │    barrel    │     ┌──────▼──────────┐  │    clusters.ts  │
   └──────────────┘     │ 4. feature.ts   │  └──────┬──────────┘
                        │    wiring       │         │
                        └──────┬──────────┘         │
                               └──────────┬─────────┘
                                          │
                              ┌───────────┴───────────┐
                              │                       │
                      ┌───────▼───────┐      ┌────────▼──────┐
                      │ 7. specs      │      │ 8. docs       │
                      └───────────────┘      └───────┬───────┘
                                                     │
                                             ┌───────▼───────┐
                                             │ 9. llms regen │
                                             └───────────────┘
```

`Dependency: 1 → {2,3} → 4 → {7,8} → 9`
`Parallel-safe: [2,3] after 1; [5,6] alongside 4; [7,8] after 4+5`

Nothing between step 1 and step 7 typechecks in isolation — steps 1-7 are one
atomic unit of compilation, not a sequence of green states.

## Steps

### Step 1 — rule and level types — **core**

`libs/table/src/api/features/with-grouping/types.ts`

- Add `GroupKeyRule<TRow>`, modelled on `GroupOrderRule` (`:55-62`):
  `kind: 'grouping-key'`, `readonly columnId: string`,
  `readonly extractValue: (fieldValue: unknown) => unknown` (required, not
  optional — a rule with no extractor has no reason to exist).
- Add it to the `AnyGroupingRule` union (`:64-67`).
- Delete `extractValue` (`:23`) and `label` (`:26`) from `GroupingRule`;
  delete `extractValue` (`:50`) and `label` (`:52`) from `GroupingAsyncRule`.
- Add the public `initial`-entry type:
  `export interface GroupingLevel<TRow> { readonly key: ColumnId<TRow>; readonly label?: string }`.
  Imports `ColumnId` from `../../types`.

JSDoc stays terse; link `D9`, do not restate its rationale.

---

### Step 2 — declarators — _Depends on: Step 1. Parallel-safe with: Step 3_

`libs/table/src/api/features/with-grouping/schema.ts`

- New `applyGroupKey`, shaped exactly like `applyGroupOrder` (`:119-128`) —
  positional second argument, no options object:

  ```ts
  export function applyGroupKey<TRow, K extends Extract<keyof TRow, string>>(
    path: GroupingHandle<TRow, K>,
    extractValue: (fieldValue: TRow[K]) => unknown,
  ): void {
    assertPathIsCurrent<TRow, AnyGroupingRule<TRow>>(path).record({
      kind: 'grouping-key',
      columnId: path.id,
      extractValue: extractValue as (fieldValue: unknown) => unknown,
    });
  }
  ```

  The constraint is `K extends Extract<keyof TRow, string>` (like
  `applyGrouping`), **not** `applyGroupOrder`'s looser `K extends string` —
  the narrowing is the whole point of the positional signature.

  The single-property `as` is the same one `applyGrouping` already carries at
  `:68`: under `strict` (hence `strictFunctionTypes`,
  `libs/table/tsconfig.json:15`) `(v: TRow[K]) => unknown` is not assignable
  to `(v: unknown) => unknown`. It does **not** need `applyGroupingAsync`'s
  `as unknown as AnyGroupingRule` double-cast — that bridge exists for
  method-shorthand generic positions (`types.ts:39-43`), which `GroupKeyRule`
  has none of.

- Drop `extractValue` (`:59`) and `label` (`:60`) from `applyGrouping`'s opts
  and from its `record()` call (`:68`, `:69`).
- Drop `extractValue` (`:84`) and `label` (`:85`) from `GroupingAsyncOpts` and
  from `applyGroupingAsync`'s rule literal (`:100`, `:101`).

---

### Step 3 — collectors — _Depends on: Step 1. Parallel-safe with: Step 2_

`libs/table/src/engine/grouping/rules.ts`

- Add `isGroupKeyRule` beside `isGroupOrderRule` (`:26-30`).
- Replace `collectExtractValue` (`:161-171`) with `collectGroupKeys`, filtering
  **positively** on the new kind, last-wins on a duplicate field (matching its
  three siblings — deliberate, see "Not in scope"):

  ```ts
  export function collectGroupKeys<TRow>(
    rules: readonly AnyGroupingRule<TRow>[],
  ): Map<string, (fieldValue: unknown) => unknown> {
    const extractors = new Map<string, (fieldValue: unknown) => unknown>();
    for (const rule of rules) {
      if (isGroupKeyRule(rule)) {
        extractors.set(rule.columnId, rule.extractValue);
      }
    }
    return extractors;
  }
  ```

- Delete `collectGroupLabels` (`:178-188`) outright — labels now come from
  `initial`.
- **Repair `collectGroupPredicates` (`:124-134`).** Its
  `!isGroupOrderRule(rule)` guard at `:129` no longer narrows to something
  carrying `.when`. Filter positively instead:
  `if ((isGroupingRule(rule) || isGroupingAsyncRule(rule)) && rule.when)`.
- Update `maskGroupingLevels`'s doc (`:96`, `:102-104`), which names
  `GroupOrderRule` as the precedent for an inert rule kind — `GroupKeyRule` is
  now a second one.

---

### Step 4 — feature wiring — _Depends on: Steps 1, 2, 3_

`libs/table/src/api/features/with-grouping/feature.ts`

- `WithGroupingConfig.initial` (`:43`) becomes
  `(ColumnId<TRow> | GroupingLevel<TRow>)[]`. Rewrite the doc comment
  (`:38-42`) — it currently explains why a level "stays a free string".
- Replace `const initial: string[] = config.initial ?? []` (`:89`) with a
  named normalizer in the same file — it is pure, ~8 lines, owns no state or
  lifecycle, so it stays a named function rather than earning its own file:

  ```ts
  function normalizeGroupingLevels<TRow>(
    levels: readonly (ColumnId<TRow> | GroupingLevel<TRow>)[],
  ): { keys: string[]; labelByKey: Map<string, string> };
  ```

  Keys feed `signal<string[]>` at `:100` exactly as before; `labelByKey` feeds
  `clusterOpts.labelByColumn`.

- Swap `collectExtractValue` → `collectGroupKeys` (`:118`, import at `:12`).
- Delete the `collectGroupLabels` call (`:119`) and its import (`:9`); source
  `labelByColumn` (`:126`) from the normalizer's map instead. Keep the uniform
  `size > 0 ? map : undefined` idiom — the engine's "no opt ⇒ return input by
  reference" no-op depends on it.
- **Leave the `emptyRule` throw (`:91-98`) exactly as written.** It is now
  correct rather than over-strict: with `extractValue`/`label` gone from the
  rule, an `applyGrouping` carrying neither `enable` nor `when` really is
  empty.

`ClusterOpts` (`engine/grouping/clusters.ts:21-33`) keeps both
`extractValueByColumn` and `labelByColumn` unchanged in shape — only their
source changes. `render.ts`, `queries.ts` and `pipeline.ts` need no edits.

---

### Step 5 — non-primitive report wording — _Depends on: Step 3. Parallel-safe with: Steps 4, 6_

- `libs/table/src/engine/grouping/clusters.ts:51-62` —
  `reportNonPrimitiveGroupValue`'s message says "Declare extractValue on that
  field"; it must name `applyGroupKey`. Also the two comments at `:44` and
  `:52` referring to `extractValue`.
- `libs/table/src/stories/grouping/fixtures/schema.ts:30` — the one story-side
  comment saying "through the rule's own `extractValue`".

---

### Step 6 — public barrel — _Depends on: Steps 1, 2. Parallel-safe with: Steps 4, 5_

`libs/table/src/index.ts`

- `:73` — add `applyGroupKey` to the value export.
- `:75-80` — add `GroupingLevel` to the type export block. Do **not** export
  `GroupKeyRule`: `GroupOrderRule` is deliberately absent from that block and
  reaches consumers only through `AnyGroupingRule`; match that precedent.

---

### Step 7 — specs — _Depends on: Steps 4, 5, 6. Parallel-safe with: Step 8_

- `api/features/with-grouping/schema.spec.ts:48` — `it('records extractValue
and label when supplied')` splits: one test that `applyGroupKey` records a
  `kind: 'grouping-key'` rule carrying its extractor, and deletion of the
  `label` assertion (no longer a rule field). The remaining 8 tests in that
  describe are `enable`/`when`-only and stand.
- `engine/grouping/rules.spec.ts` — add a small `collectGroupKeys` describe.
  The file today covers `collectGroupPredicates` but has **zero** coverage of
  `collectGroupOrder`/`collectExtractValue`, so this is new ground rather than
  a port. Also add one case pinning the repaired `collectGroupPredicates`
  guard: a rule set mixing a `'grouping-key'` rule with a `when`-carrying rule
  collects only the latter.
- `engine/grouping/clusters.spec.ts:84` — asserts
  `message.toContain('extractValue')` at `:97`; retarget to `applyGroupKey`.
  Rename `:158`'s `it('stays quiet when a declared extractValue …')`.
- `engine/grouping/render.spec.ts:165` — `describe('extractValue and label
resolution (D7)')`. Both tests drive the engine through hand-built
  `ClusterOpts` maps, so the assertions stand; rename the describe and check
  whether `:180`'s three-tier label test still describes the chain correctly
  (the tiers are unchanged, only the first tier's _source_ moved).
  Preserve the truthiness guard's behavior at `render.ts:64` — `label: ''`
  falls through to the column tier.
- `api/features/with-grouping/feature.spec.ts` — all 87 existing `initial:`
  sites stay as-is. Add coverage inside `describe('initial + schema in one
call (#84)')` (`:1512`) for: the object form of `initial`; a mixed
  string/object array; an `initial` label winning over a matching column's
  label; and a level declared object-form with no label falling through to the
  column tier.
- `engine/core.spec.ts:161,186,213` build `groupKey: { columnId, value, label }`
  literals against `RenderRow.groupKey` (`api/types.ts:51`, `label`
  non-optional). Confirm untouched — the resolved shape does not change.

---

### Step 8 — docs — _Depends on: Steps 4, 5. Parallel-safe with: Step 7_

Permanent docs only. Leave everything under `docs/**/work/**/archive/**`.

- `libs/table/docs/adr/0021-column-concerns-and-data-concerns-are-separate-surfaces.md`
  `:97` and `:107` — both say value extraction moves to the rule via
  `extractValue`; the mechanism is now `applyGroupKey`. The Consequences bullet
  about two copies of the value fact stays true as written.
- `libs/table/docs/0-product/grouping.md` §4.2 (`:557-591`) — names
  `applyGrouping(path.owner, { extractValue })` and "a sibling `label`" as the
  supported path. Rewrite to the two declarators; the 🟡 verdict and the OQ-5
  linkage are unaffected.
- `libs/table/docs/2-columns/reference/tier-1-intrinsic.md:78-80` — "the
  rule's own `extractValue`".
- `libs/table/docs/1-state/features/grouping.md` — the superseded-API banner
  (`:25-27`) lists `applyGrouping`/`applyGroupingAsync`/`applyGroupOrder`; add
  `applyGroupKey`. Frontmatter `spec: drilled` / `code: partial` is unchanged,
  so `docs/status.md` (generated) needs no attention.
- [`2-decisions.md`](2-decisions.md) — flip D9's frontmatter status from
  "decided 2026-09-19, unbuilt" to built.

---

### Step 9 — generated artifacts — _Depends on: Step 8_

`npm run llms` then `npm run llms:check` (root `CLAUDE.md` requires the check
stay clean). `docs/status.md` needs no regeneration — no frontmatter field
changed.

## Verification

Run by the maintainer, not by the implementation:

```
nx run shared-table:typecheck
nx run shared-table:typecheck-spec
```

`ngc` aborts at the first `.ts` error before reaching the template phase, so a
run reporting source errors has checked **no** templates. Fix, re-run, and
treat only the second, source-clean run as meaningful.

Then the grouping suites:

```
nx test shared-table
```

What a green run should prove:

1. `applyGroupKey(path.closedAt, (d) => monthOf(d))` compiles with `d` narrowed
   to `DealRow['closedAt']`, and records a `'grouping-key'` rule.
2. `applyGrouping(path.region, { extractValue })` is now a **compile error** —
   worth a `@ts-expect-error` case, since that is the contract change.
3. `initial: ['region', 'category']` still compiles unchanged (the 87 untouched
   spec sites are themselves the regression test).
4. An `initial` entry's label reaches the rendered group header and beats a
   matching column's label.
5. A level added at runtime via `grouping.update()` that was never in `initial`
   still finds its extractor.
6. The non-primitive report names `applyGroupKey`.

No Storybook check is needed — no story template binding changes, and no story
declares `extractValue` or a rule `label` today.

## Commits

Steps 1-7 are one commit: the type change and its call-site migration are a
single concern, and no intermediate state typechecks. Docs are a second.

```
refactor(table)!: split grouping declarators — applyGroupKey, label on initial
docs(table): record D9's declarator split across ADR-0021 and the grouping docs
```

If `npm run llms` produces a diff, it goes in a third,
`chore(table): regenerate llms.txt`.
