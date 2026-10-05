---
title: 'Step 1 — reshape WithGroupingConfig and sweep every call site'
type: task-step
issue: 118
---

# Step 1 — reshape `WithGroupingConfig` and sweep every call site

**PR scope:** The breaking rename and the overload deletion, plus every call site that the change
invalidates. One PR by necessity — see _Why this step is coarse_ below.

**Task type:** code

**Skills used:** angular-developer, typescript-conventions, declarative-naming

**Parallel-safe with:** none — this is the epic's frontier, and #85/#120/#121 all build on the
type it produces.

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/api/features/with-grouping.ts` (edit)
- `libs/shared/table/src/schema/grouping-schema.types.ts` (edit — doc comment only)
- `libs/shared/table/src/engine/grouping.ts` (edit — stale comment reference only)
- `libs/shared/table/src/stories/grouping/grouping-static/grouping-static-story-host.component.ts` (edit)
- `libs/shared/table/src/stories/grouping/grouping-collapsible/grouping-collapsible-story-host.component.ts` (edit)
- `libs/shared/table/src/stories/grouping/grouping-crud/grouping-crud-story-host.component.ts` (edit)
- `libs/shared/table/src/stories/grouping/grouping-selection/grouping-selection-story-host.component.ts` (edit)
- `libs/shared/table/src/stories/grouping/grouping-regressions/grouping-regressions-story-host.component.ts` (edit)
- `libs/shared/table/src/stories/grouping/grouping-async-rule/grouping-async-rule-story-host.component.ts` (edit)
- `libs/shared/table/src/api/features/with-grouping.spec.ts` (edit — mechanical migration only; new
  assertions are Step 2)

## Why This Step Exists

Today `withGrouping()`'s first positional argument is **either** a config object **or** a schema
fn, never both (`with-grouping.ts:138-145`). So `initialGrouping` and `applyGrouping()` rules are
mutually exclusive: a consumer who wants seed levels _and_ a declarative rule cannot express it.

This is also the epic's prefactor. #85 adds `groupWhen` to `WithGroupingConfig`, #86 adds a
`groupWhen` member to `applyGrouping`'s opts, #87 removes `groupOrder` from the config. All three
edit the same type. Landing the shape first keeps them from colliding on it.

Design: `../../../design-group-admission.md` § The surface, § Why the schema fn stays store-free
and returns `void`. Decisions: `../../../3-spec.md` D8 (schema-fn layer), D14 (unknown id throws at
construction).

### Why this step is coarse

A rename with no back-compat window cannot be split and still leave each step compiling. The
design settled this deliberately — pre-1.0, every call site is in this repo, no deprecation window
(`design-group-admission.md` § Migration states the same trade for `groupOrder`). The alternative
— accept both names, sweep, then delete — is three PRs spent avoiding a broken intermediate state
that nobody outside this repo can observe.

## What To Do

### 1. Reshape the config type

```ts
import type { AnyGroupingRule, GroupingSchemaFn } from '../../schema/grouping-schema.types';

export interface WithGroupingConfig<TRow> {
  /** Seeds `grouping` at construction. An id naming no known column throws — a wiring error,
   * parallel to `engine/rows.ts`'s `trackBy` throw site. */
  initial?: ColumnId<TRow>[];
  /** Orders clusters by their contents, siblings only, at every depth. Omitted: stable
   * first-occurrence order. Throws: falls back to stable order for the affected level and
   * reports once per evaluation. Decoupled from `sorting`. */
  groupOrder?: (a: GroupSummary<TRow>, b: GroupSummary<TRow>) => number;
  /** Base+overlay fold. Returning `string[]` overrides `initial`; `undefined` abstains and holds
   * it; `[]` is actively grouped by nothing — distinct from abstain. */
  groupingRule?: () => string[] | undefined;
  /** Declarative per-column rules. Records by side effect; returns nothing. Call order is level
   * order. Composes with `rules` — both land in the same array. */
  schema?: GroupingSchemaFn<TRow>;
  /** Rules-array layer: compiles to `groupingRule` via `foldGroupingRules`. The pre-recorded form
   * of what `schema` records. */
  rules?: AnyGroupingRule<TRow>[];
}
```

`groupOrder` stays here for now — it moves to `applyGroupOrder()` in #87, deliberately not in this
step.

### 2. Delete the either/or overload

```ts
export function withGrouping<In extends GroupingInput<In>>(
  config?: WithGroupingConfig<RowOf<In>>,
): Feature<In, GroupingMembers<RowOf<In>>>;
export function withGrouping<In extends GroupingInput<In>, D extends DerivedDict>(
  config: WithGroupingConfig<RowOf<In>> | undefined,
  computed: Feature<NoInfer<In> & GroupingMembers<RowOf<In>>, D>,
): Feature<In, GroupingMembers<RowOf<In>> & D>;
export function withGrouping(
  config: WithGroupingConfig<any> = {},
  computed?: Feature<any, any>,
): Feature<any, any> {
  const factory = <In extends GroupingInput<In>>(
    input: In,
  ): TableFeatureSpec<RowOf<In>, GroupingMembers<RowOf<In>>> => buildGroupingSpec(input, config);
  const feature: Feature<any, any> = computed
    ? createTableFeature(factory, computed)
    : createTableFeature(factory);
  return Object.assign(feature, { displayName: 'withGrouping' });
}
```

The `typeof configOrSchemaFn === 'function'` normalization at the top of the implementation
signature goes away entirely — there is no longer a function-shaped first argument to discriminate.

### 3. Run the schema fn inside the factory body

`runColumnsSchemaFn` moves from the overload normalization into `buildGroupingSpec`, concatenated
ahead of `config.rules`:

```ts
const schemaRules = config.schema
  ? [...runColumnsSchemaFn<TRow, AnyGroupingRule<TRow>>(config.schema)]
  : [];
const rules = [...schemaRules, ...(config.rules ?? [])];
```

Everything downstream — the `unknownRuleIds` validation, `buildGroupingRuleEntries`,
`buildAsyncGroupingRuleEntry`, `foldGroupingRules` — already reads a single `rules` array and is
unchanged.

### 4. Rename `initialGrouping` to `initial` in the factory and its throw

```ts
const initial: string[] = config.initial ?? [];
// ...
throw new Error(`[withGrouping] initial names unknown column id(s): ${unknownIds.join(', ')}.`);
```

Also fix the two stale references: `engine/grouping.ts:31` names `initialGrouping` in a comment,
and `schema/grouping-schema.types.ts:38` describes `GroupingSchemaFn` as "passed to
`withGrouping()`'s rules-array normalization" — it is now `config.schema`'s type.

### 5. Sweep the six story hosts

Five are a one-word rename (`initialGrouping:` → `initial:`). `grouping-async-rule` already passes
an object carrying both `initialGrouping` and `rules`; check whether its rules are hand-built
objects or would read better through `schema`. If they are pre-built rule objects, leave them on
`rules` and rename `initialGrouping` only. Do not restructure a story beyond what the rename
requires.

### 6. Migrate the spec file mechanically

`with-grouping.spec.ts` has ~50 `initialGrouping:` sites (rename) and two schema-fn-form call sites
— around lines 1175 and 1220 — that become:

```ts
withGrouping({
  schema: (path) => {
    applyGrouping(path.region, { when: () => regionActive() });
    applyGrouping(path.category, { when: () => categoryActive() });
  },
});
```

Mechanical only in this step. New assertions for the combined shape are Step 2 — do not add them
here, and do not delete a test because its old call shape is gone.

## Implementation Notes

- **`schema` rules come first, then `rules`.** Call order is level order (D8), so a config passing
  both gets schema-recorded levels before hand-written ones. In practice a consumer uses one or the
  other; the order only has to be stated, not clever.
- **`runColumnsSchemaFn` still runs eagerly, and that is the point.** It now runs at factory time
  rather than at call time — but still before any store exists, which is exactly why the schema fn
  takes only `path` and returns `void` (`design-group-admission.md` § Why the schema fn stays
  store-free). Do not pass the store, do not accept a return value.
- **Slot 2 is unchanged.** `withComputed()` in the second positional stays exactly as it is in
  every other feature (`with-sorting.ts:193-201`). Renaming the implementation parameter `derive` →
  `computed` is a local rename for vocabulary consistency, not a contract change.
- **`ColumnId<TRow>` on `initial` is unchanged** — `Extract<keyof TRow, string> | (string & {})`,
  per D14. The rename does not touch what the slot accepts.

## Risks / Watchouts

- **Do not add a back-compat `initialGrouping` alias.** The acceptance criteria say it no longer
  exists; an alias left in "just in case" is the deprecation window the design rejected.
- **`grouping-regressions` passes `groupOrder: this.compareGroups`** — leave it. It is the only
  comparator consumer and it is #87's migration, not this step's.
- **The spec file's two `@ts-expect-error` blocks around argument-order typing (~lines 986, 1007)
  read off slot 2, not slot 1.** They must keep compiling and keep expecting an error. If deleting
  the overload changes which overload those resolve against, that is a real regression, not a test
  to relax.
- **`ngc` stops at the first `.ts` error and never reaches the template phase.** After fixing any
  source error, run the typecheck again — only a source-clean run says anything about the
  story-host templates (`.claude/rules/typecheck-angular-templates.md`).

## Non-Goals

- No `groupWhen`, at either scope — #85 and #86.
- No `applyGroupOrder`, and `config.groupOrder` is not removed — #87.
- No behaviour change of any kind. `renderRows()` output for every existing story and spec must be
  byte-identical before and after.
- No doc updates — Step 3.

## Acceptance Checks

- [ ] `withGrouping({ initial, schema })` seeds levels and records rules in one call.
- [ ] `initialGrouping` appears nowhere in `libs/shared/table/src` (grep clean, comments included).
- [ ] The `WithGroupingConfig<TRow> | GroupingSchemaFn<TRow>` union is gone from both overloads and
      the implementation signature.
- [ ] `withGrouping(config, withComputed(fn))` composes exactly as before.
- [ ] An unknown column id in `initial` still throws at construction (D14).
- [ ] `nx run shared-table:typecheck` clean, on a source-clean run.
- [ ] `shared-table` suite green in CI on the PR, with no assertion changed — only call
      shapes. Not run locally; the byte-identical claim above is unverified until it passes.

---

[Step 2: Tests for the combined shape](step-2-tests.plan.md) →
