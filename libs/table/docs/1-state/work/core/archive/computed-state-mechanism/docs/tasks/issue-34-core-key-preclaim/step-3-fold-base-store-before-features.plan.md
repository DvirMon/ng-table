---
title: "Step 3 — compose-table.ts + create-table.ts: base store before the fold, positions unshifted"
type: task-step
issue: 68
---

# Step 3 — compose-table.ts + create-table.ts: base store before the fold, positions unshifted

**PR scope:** Engine fold rewrite plus the one call site that must change with it. Public
`createTable()` signature, `TableFeature` type, and every shipped feature are untouched. The
two files land together because `composeTable()`'s parameter list changes and `create-table.ts`
is its only caller.

**Task type:** code

**Skills used:** typescript-conventions, declarative-naming, extract-encapsulated-logic

**Depends on:** Step 1
**Parallel-safe with:** Step 2

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/engine/compose-table.ts` (edit)
- `libs/shared/table/src/api/create-table.ts` (edit)
- `libs/shared/table/src/engine/compose-table.spec.ts` (edit — label regexes only, to stay green)

## Why This Step Exists

Architecture "Runtime — the fold", steps 1–3: claim core keys, build the base store object
**once** so `renderRows` and `totalRowCount` exist before any feature runs, then fold features
onto that same object. Today `totalRowCount` is built *after* `foldFeatures` and `composed` is
spread last over the core members — the shadowing hole D4 closes. A derive block's parameter
type (#36) includes `renderRows`/`totalRowCount`, so they must be concrete first; this is the
ordering fix D8 identified.

The second half fixes the off-by-one: `create-table.ts` splices `wireColumnsSchemaAsync()` as
array entry 0, so the fold labels a consumer's first feature as entry 1. The splice stays
internal (ADR-0010); it moves off the consumer's numbering.

## What To Do

### `compose-table.ts`

1. **Separate internal features from consumer features.** New signature:

   ```ts
   export function composeTable<TRow>(
     config: TableEngineConfig<TRow>,
     features: readonly AnyTableFeature[],
     internalFeatures: readonly AnyTableFeature[] = []
   ): TableStore<TRow>
   ```

   `internalFeatures` fold first (they must — the column-schema wiring's `columnRules` are read
   synchronously and its `setup` runs before consumer setups today), labeled
   `describeInternalFeature(i + 1)`. Consumer features fold next, labeled
   `describeFeature(i + 1)`.

2. **Build the base store before the fold.** Move `totalRowCount` up and assemble the object
   first; extract the construction into a named helper so the ordering reads as intent:

   ```ts
   function createBaseStore<TRow>(handle: TableCoreHandle<TRow>): TableStore<TRow> {
     // ADR-0005: row count before any virtualization/pagination trims what is rendered —
     // equals `renderRows().length` until a feature overrides it.
     const totalRowCount = computed(() => handle.core.rows().length);
     return {
       columns: handle.core.columns,
       rows: handle.core.rows,
       trackBy: handle.core.trackBy,
       value: handle.core.value,
       renderRows: handle.renderRows,
       totalRowCount,
     };
   }
   ```

3. **Pre-claim, then fold onto the store.** Create the `SlotRegistry` in `composeTable()`,
   call `registry.claimCoreMembers()`, pass the registry and the store into `foldFeatures`.
   Inside the fold, `Object.assign(store, spec.members)` replaces the `composed` accumulator,
   and the store itself is what a factory receives as its second argument:

   ```ts
   const spec: TableFeatureSpec<TRow> = feature(core, store);
   ```

   `foldFeatures` takes a `readonly LabeledFeature[]` (`{ feature, label }`) so one loop body
   serves both internal and consumer lists — build the labeled list in `composeTable()` with a
   small `labelFeatures(features, describe)` helper rather than duplicating the loop.

4. Drop the trailing `Object.assign({...}, composed)`; `store` is returned directly (the
   ADR-0003 comment about the static/dynamic boundary stays — it still applies to the cast in
   `create-table.ts`).

### `create-table.ts`

Replace the splice with the third parameter:

```ts
composeTable<TRow>(
  { columns, trackBy: config.trackBy, data },
  config.features ?? [],
  [wireColumnsSchemaAsync<TRow>(rules)]
)
```

### `compose-table.spec.ts` (green-keeping only)

The existing collision regexes (`features\[0\] and features\[1\]` for the sort stage, tree
render stage, and editing member) become `feature 1 and feature 2`. No new cases here — Step 4.

## Implementation Notes

- `store` needs a runtime type that accepts `Object.assign` of unknown members: declare it as
  `TableStore<TRow> & Record<string, unknown>` locally, or keep `TableStore<TRow>` and assign
  through a typed helper — pick one; do not scatter `as` casts through the loop
  (`typescript-conventions.md`).
- Passing the whole store as `composed` is a superset of today's contract: the second argument
  now also exposes core members. The existing "shows a feature only earlier features' members
  at factory time" case still holds because later *feature* members are still absent.
- The `SlotRegistry` moving out of `foldFeatures` is deliberate: pre-claiming is a
  `composeTable()` concern (it happens before any feature exists), not a fold concern.
- `handle.core.rows` is a lazy computed; building `totalRowCount` before stages are registered
  is safe for the same reason `rows` is (`TableCore` doc comment).

## Risks / Watchouts

- **Fold order between internal and consumer features must not change.** Internal first, as
  today's `[wiring, ...features]` array order. A consumer `setup` that reads a column rule's
  effect depends on it.
- **Reconciliation effect, `setup`, `onDestroy`** — untouched; do not reorder them relative to
  the fold.
- **No shipped feature declares a core key today** (issue AC) — if the feature specs or stories
  start throwing after this step, a shipped feature *does*, and that is a finding to report, not
  something to special-case in the fold.
- Watch `wire-columns-schema.spec.ts`: it calls the wiring directly, not through
  `composeTable`, so it should be unaffected — verify rather than assume.

## Non-Goals

- No change to `TableFeature`'s `(core, composed)` calling convention or `AnyTableFeature` —
  #35 retypes it.
- No `withComputed`, no derive-block label — #36.
- No overloads, no positional `createTable(data, config, ...features)` — #35.

## Acceptance Checks

- [ ] `tsc --noEmit` passes for `libs/shared/table`.
- [ ] `composeTable(config, features, internalFeatures)` — `create-table.ts` is the only caller
      and passes the wiring through the third parameter; `config.features` is passed unspliced.
- [ ] Reading `composed.renderRows` / `composed.totalRowCount` inside a feature factory returns
      signals (not `undefined`).
- [ ] A feature returning `members: { rows: ... }` throws
      `core and feature 1 both provide the "rows" store member`.
- [ ] A feature returning `members: { totalRowCount: ... }` composes, and the store's
      `totalRowCount` is that feature's signal.
- [ ] Existing `compose-table.spec.ts` cases pass with only the label regexes edited.
- [ ] Every shipped feature spec (`with-*.spec.ts`) and the story hosts still pass — no
      changes to them.

---
← [Step 2: Registry spec — core-key pre-claim](step-2-slots-spec-core-key-preclaim.plan.md) | [Step 4: Compose spec — base-store ordering →](step-4-compose-spec-base-store-ordering.plan.md)
