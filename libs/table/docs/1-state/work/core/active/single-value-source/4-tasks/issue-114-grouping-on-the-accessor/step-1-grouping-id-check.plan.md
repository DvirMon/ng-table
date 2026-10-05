# Step 1 — Grouping ids validate at construction and on the writer

**PR scope:** standalone. **Parallel-safe with:** Step 3 (this step
touches only `feature.ts`'s body; Step 3 changes type parameters and
declarator signatures — no shared line).

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/api/features/with-grouping/feature.ts` (edit)

## Why This Step Exists

This is the guard the rest of the slice stands on. Step 2 replaces
grouping's raw `row[key]` read with `readAccessor(column, row)`. A level
naming no declared column has no column to read, so the value silently
becomes `undefined` for every row — one visibly-empty cluster where a raw
field read used to work. Landing Step 2 without this check opens a
regression window inside the epic.

G57 fixes the shape: a declaration naming an undeclared column id throws
at construction, naming both parties. `#111` already shipped the shared
body — `assertDeclarationsAreKnown(declaredIds, knownIds, label)` in
`schema/validate.ts` — so this step is a call site, not a mechanism.

**The writer is in scope, and that is a ruling made while planning.**
`table.grouping` is writable, and the barrel ships four updaters
(`mutations/update-grouping.ts`). `addGroupLevel('territory')` is a
runtime write the constructor never sees, so a construction-only check
leaves an id with no column reachable in `appliedGrouping()` — which is
exactly the case AC #5 says "cannot arise" when it deletes
`groupingLevels`' filter (Step 5). The user's ruling, 2026-09-21: **one
rule for both paths, the writer throws.** Record it in the workspace
decisions log in Step 9.

This does not contradict `reorderGroupLevels`' JSDoc ("never throws").
That sentence is about _index bounds_, and index bounds keep degrading —
only an unknown column id throws.

## What To Do

**1. Validate the declarations in `buildGroupingSpec`.**

The two declaration sources are already computed side by side at the top
of the function: `normalizeGroupingLevels(config.initial)` yields
`keys: string[]`, and `runGroupingSchemaFn(config.schema)` yields
`rules`, each carrying a `columnId`. Check their union against
`input.columns()` before anything else runs, so the throw fires ahead of
the existing `emptyRule` check.

```ts
const knownIds = input.columns().map((column) => column.id);
assertDeclarationsAreKnown(
  [...initial, ...rules.map((rule) => rule.columnId)],
  knownIds,
  'withGrouping',
);
```

`assertDeclarationsAreKnown` builds its own `Set` from `knownIds` and
reports the first miss — no dedupe needed on the caller's side.

**2. Validate in `groupingView`'s writer.**

`createWritableView(read, write)` currently forwards straight to
`baseGrouping.update(updater)`. Run the updater, check its result, then
commit:

```ts
const groupingView = createWritableView<string[], GroupingUpdater<TRow>>(
  () => appliedGrouping(),
  (updater) => {
    const next = updater(baseGrouping());
    assertDeclarationsAreKnown(
      next,
      input.columns().map((column) => column.id),
      'withGrouping',
    );
    baseGrouping.set(next);
  },
);
```

Reading `input.columns()` at write time, not at construction, is
deliberate: `setColumns()` can add a column after construction, and a
level naming it must be writable.

## Implementation Notes

- **Import from `../../../schema/validate`**, the shared body #111
  extracted. Do not reach for `columns-schema/resolve.ts`'s
  `assertRuleColumnIdsAreKnown` — that wrapper is bound to
  `ColumnRule[]` and the `'columnsSchema'` label.
- **`'withGrouping'` is the label.** `validate.spec.ts` already asserts
  that exact string in its message, and the shared body's doc comment
  names `withGrouping` as an intended caller.
- **Read `input.columns()` once per call** in the constructor path and
  once per write in the writer path — not inside a loop.
- The check runs _before_ the `emptyRule` throw. An `applyGrouping` on an
  undeclared column that also declares neither `enable` nor `when` should
  report the unknown id, which is the actionable half.

## Risks / Watchouts

- **Existing specs will start throwing.** `feature.spec.ts` builds
  fixtures whose `initial` names fields with no matching column — and
  `stories/grouping/fixtures/schema.ts` exports `MISSING_GROUPING_LEVEL`
  (`'territory'`) for exactly that case. Do **not** migrate them here;
  Step 7 owns the specs and Step 8 owns the stories. Expect
  `nx test shared-table` to be red between this step and those, and say
  so in the PR body rather than softening the check.
- **`createWritableView`'s writer signature.** Confirm it hands the
  updater through rather than a pre-applied value — read
  `engine/writable-view.ts` before editing; the snippet above assumes the
  updater arrives uncalled, as `baseGrouping.update(updater)` implies.
- **Do not validate inside the `computed`.** `grouping`/`appliedGrouping`
  are read on every pipeline evaluation; a throw there would fire during
  rendering rather than at the write that caused it.

## Non-Goals

- **No accessor reads.** Step 2 owns that.
- **No deletion of the label fallback or `groupingLevels`' filter.**
  Step 5 owns those, and it depends on this step.
- **No type changes.** `initial` stays `(ColumnId<TRow> | GroupingLevel<TRow>)[]`
  here; Step 3 re-keys it.
- **No new rule kinds.** `applyAggregate` is Step 4; its rules flow
  through this same check for free once they exist, because the check
  reads `rule.columnId` off `AnyGroupingRule`.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` clean.
- [ ] A declaration naming an undeclared column id throws, and the
      message names both the declaring surface (`[withGrouping]`) and the
      offending id.
- [ ] `table.grouping.update(addGroupLevel('nope'))` throws; an
      out-of-range `reorderGroupLevels` still does not.
- [ ] A level naming a column added later via `setColumns()` is writable.

---

[Step 2: Both cluster walks read the accessor](step-2-walks-read-accessor.plan.md) →
