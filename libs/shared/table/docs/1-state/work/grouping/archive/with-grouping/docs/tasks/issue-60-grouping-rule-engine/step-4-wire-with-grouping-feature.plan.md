---
title: "Step 4 — wire the base/overlay fold into withGrouping()"
type: task-step
issue: 60
---

# Step 4 — wire the base/overlay fold into `withGrouping()`

**PR scope:** The feature itself — config surface, construction-time validation, and switching
`stages`/`renderStages`/`rowsOf` from `baseGrouping()` to the folded value.

**Task type:** code

**Skills used:** typescript-conventions, file-organization, declarative-naming

**Depends on:** Step 1, Step 2, Step 3

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/api/features/with-grouping.ts` (edit)

## Why This Step Exists

This is D6/D7 landing: today `table.grouping` is a `WritableView` that reads `baseGrouping`
directly (issue #6 shipped only the base, deliberately deferring the overlay — see this file's own
`WithGroupingConfig` doc comment: *"the D6 base+overlay fold (`groupingRule`) is issue #60, out of
scope here"*). This step removes that scope note by actually building the fold, and switches every
internal reader (`stages.group`, `renderStages.group`, `rowsOf`) from `baseGrouping()` to the
folded `grouping()` value — otherwise a `groupingRule` config would compute correctly but never
reach the pipeline.

Decisions: `../../../3-spec.md` D6, D7, D8, D13, D14, D15.

## What To Do

### 1. Widen `WithGroupingConfig`

```ts
import type { AnyGroupingRule, GroupingSchemaFn } from '../../schema/grouping-schema.types';
import { runColumnsSchemaFn } from '../../schema/column-schema';

export interface WithGroupingConfig<TRow> {
  initialGrouping?: ColumnId<TRow>[];
  groupOrder?: (a: GroupSummary<TRow>, b: GroupSummary<TRow>) => number;
  /** Base+overlay fold (D6/D7). Returning `string[]` overrides `baseGrouping`; `undefined`
   * abstains and holds it; `[]` is actively grouped by nothing — distinct from abstain. Mutually
   * exclusive with `rules` in practice (both compile to this same slot) — the rules-array layer
   * (below) is sugar that produces exactly this shape. */
  groupingRule?: () => string[] | undefined;
  /** Rules-array layer (D8): compiles to `groupingRule` via `foldGroupingRules`. Call order (array
   * order here, schema-fn call order when using the function-argument overload) determines level
   * order. */
  rules?: AnyGroupingRule<TRow>[];
}
```

### 2. Accept a schema fn directly (top D8 layer)

```ts
export function withGrouping<TRow = unknown>(
  configOrSchemaFn: WithGroupingConfig<TRow> | GroupingSchemaFn<TRow> = {}
): (core: GroupingInput<TRow>, composed: Record<string, unknown>) => TableFeatureSpec<TRow, GroupingMembers<TRow>> {
  const config: WithGroupingConfig<TRow> =
    typeof configOrSchemaFn === 'function'
      ? { rules: [...runColumnsSchemaFn<TRow, AnyGroupingRule<TRow>>(configOrSchemaFn)] }
      : configOrSchemaFn;

  return (core, composed) => {
    // ...
  };
}
```

### 3. Validate rule column ids at construction (D14)

Extend the existing `initialGrouping` unknown-id check (already in the factory) to also cover
`config.rules`' `columnId`s — same throw, same construction-time timing, one combined error
message or two separate throws is an implementation choice; keep the existing `initialGrouping`
message format and add an equivalent for rules.

### 4. Build the rule entries and the fold

```ts
import {
  buildAsyncGroupingRuleEntry,
  buildGroupingRuleEntries,
  foldGroupingRules,
  isGroupingAsyncRule,
  isGroupingRule,
} from '../../engine/grouping-rules';

// inside the factory, after knownIds validation:
const rules = config.rules ?? [];
const ruleEntries = [
  ...buildGroupingRuleEntries(rules.filter(isGroupingRule)),
  ...rules.filter(isGroupingAsyncRule).map(buildAsyncGroupingRuleEntry),
];
const rulesGroupingRule = ruleEntries.length > 0 ? () => foldGroupingRules(ruleEntries) : undefined;
const effectiveGroupingRule = config.groupingRule ?? rulesGroupingRule;

const baseGrouping = signal<string[]>(initial);
const groupingRuleResult = computed(() => effectiveGroupingRule?.());
const grouping = computed(() => groupingRuleResult() ?? baseGrouping());

const groupingView = createWritableView<string[], GroupingUpdater<TRow>>(
  () => grouping(),
  (updater) => baseGrouping.update(updater)
);
```

### 5. Switch every internal reader from `baseGrouping()` to `grouping()`

```ts
const rowsOf = (group: RenderRow<TRow>): readonly TRow[] =>
  rowsBeneathGroup(core.rows(), grouping(), core.columns(), group.id);

return {
  members: { grouping: groupingView, rowsOf },
  stages: {
    group: (rows) => clusterRows(rows, grouping(), core.columns(), config.groupOrder),
  },
  renderStages: {
    group: (rows) => {
      /* unchanged expandedRows read */
      return buildGroupRenderRows(rows, grouping(), core.columns(), config.groupOrder, expandedRows);
    },
  },
};
```

### 6. Update doc comments

Remove the `withGrouping()` function doc's "D6 base+overlay fold ... is issue #60, out of scope
here" sentence — replace with a short note that the fold is now live, pointing at D6/D7 in the
decisions doc (per `terse-jsdoc-for-ai-and-humans.md`, don't narrate the issue history — state
current behavior).

## Implementation Notes

- **Precedence is layered, not merged (D8):** schema-fn compiles to `rules`, `rules` compiles to
  `groupingRule`, and an explicit `config.groupingRule` (if the caller supplies one directly) wins
  over the rules-derived one. This mirrors "each layer removable without breaking the layer
  below" — a caller is expected to use exactly one layer per table, not combine them.
- **`groupingRule()` returning `undefined` must fall back to `baseGrouping()`, `[]` must not
  (D7).** `??` handles this correctly since `[]` is not nullish — don't replace it with `||` or an
  explicit truthiness check, which would incorrectly treat `[]` as falsy-fallback in some
  refactors (it isn't here, but a future edit reaching for `||` would silently break D7).
- **`table.grouping.update(updater)` still writes to `baseGrouping` only, never to the fold
  output** — this is the accepted D7 consequence ("base writes are shadowed while the rule returns
  a value"). No change needed to `groupingView`'s write side, only its read side moved from
  `baseGrouping` to `grouping`.

## Risks / Watchouts

- **Don't validate `config.rules`' column ids against `core.columns()` before `knownIds` is
  built** — reuse the existing `Set` already constructed for `initialGrouping`'s check, don't
  rebuild it.
- **Don't read `config.groupingRule`/`rulesGroupingRule` outside a `computed()`.** Every read that
  feeds `stages`/`renderStages` must stay reactive — a plain function call captured once at
  factory time would freeze grouping at whatever the rule returned during construction.
- **Existing tests exercising `baseGrouping()` behavior with no `groupingRule`/`rules` configured
  must produce byte-identical `renderRows()` output to before this step** — the fold's `?? baseGrouping()`
  fallback is exactly what guarantees this (D9 in the parent spec's user-story #9: "composing
  `withGrouping()` with no extra config changes nothing about today's clustering behavior").

## Non-Goals

- No change to `mutations/update-grouping.ts`'s updater factories — D1 shipped in #6, untouched.
- No change to `engine/grouping.ts`'s clustering/render-stage logic — it already takes a
  `grouping: string[]` parameter; this step only changes what value is passed in.

## Acceptance Checks

- [ ] All existing `with-grouping.spec.ts` tests pass unchanged (regression gate before adding new
      ones in Step 5).
- [ ] A `groupingRule` returning a value overrides `baseGrouping`; returning `undefined` falls back
      to it; returning `[]` groups by nothing, distinct from abstain.
- [ ] The schema-fn, rules-array, and bare-lambda config layers produce the same resulting fold for
      an equivalent rule.
- [ ] An unknown column id in `initialGrouping` or `rules` throws at construction; an unknown id
      from a rule result, an updater write, or a restored snapshot drops that level (existing
      `engine/grouping.ts` behavior, unchanged, now exercised through the fold too).
- [ ] `tsc --noEmit` passes.

---
← [Step 3: Declarative sugar functions](step-3-declarative-sugar-functions.plan.md) | [Step 5: Tests →](step-5-tests.plan.md)
