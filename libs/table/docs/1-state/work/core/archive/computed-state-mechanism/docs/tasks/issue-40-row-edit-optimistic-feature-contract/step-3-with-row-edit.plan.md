---
title: 'Step 3 — with-row-edit.ts: withRowEdit<In>(config?, derive?) on the Feature<In, Out> contract, indexById off the input'
type: task-step
issue: 74
---

# Step 3 — `with-row-edit.ts`: `withRowEdit<In>(config?, derive?)` on the `Feature<In, Out>` contract, `indexById` off the input

**PR scope:** One feature file. Spec in Step 5.

**Task type:** code

**Skills used:** typescript-conventions, declarative-naming, extract-encapsulated-logic

**Depends on:** Step 1
**Parallel-safe with:** Step 2

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/api/features/with-row-edit.ts` (edit)

## Why This Step Exists

Same contract change; issue #40: row-typed mutation contexts receive the consumer's row type;
`indexById` from the input; trailing block; open edits pruned when rows leave `data`
(ADR-0006); `{ multiple }` mode flip unchanged. The doc comment's "composes `withOptimistic()`
internally … so composition never depends on `features` array order" is the rationale the spec
retires (order now matters); the mechanism stays, the sentence goes (rewrite lands in #44).

## What To Do

1. **Input slice, F-bounded:**

   ```ts
   type RowEditInput<In> = EditingStoreInput<RowOf<In>>;
   ```

   (`value`, `trackBy`, `indexById` — exactly what `createEditingStore` and `createDraftRows`
   read.) Imports as Step 2; drop `TableCore`.

2. **Extract the factory body** into
   `buildRowEditSpec<TRow>(input: EditingStoreInput<TRow>, multiple: Signal<boolean>): TableFeatureSpec<TRow, RowEditMembers<TRow>>`
   — `enforceSingleMode`, `createEditingStore<TRow>(input, { onWrite: enforceSingleMode })`,
   `createDraftRows(input.value, store.editing, input.trackBy, input.indexById)`,
   `onMultipleChanged`, members, `onRowsRemoved`, `setup: () => effect(onMultipleChanged)`.
   `closeAllButLast` stays module-level.

3. **Overloads, this exact order** (derive-first before config-only, `NoInfer` on derive):

   ```ts
   export function withRowEdit<In extends RowEditInput<In>, D extends DerivedDict>(
     derive: Feature<NoInfer<In> & RowEditMembers<RowOf<In>>, D>,
   ): Feature<In, RowEditMembers<RowOf<In>> & D>;
   export function withRowEdit<In extends RowEditInput<In>>(
     config?: WithRowEditConfig,
   ): Feature<In, RowEditMembers<RowOf<In>>>;
   export function withRowEdit<In extends RowEditInput<In>, D extends DerivedDict>(
     config: WithRowEditConfig | undefined,
     derive: Feature<NoInfer<In> & RowEditMembers<RowOf<In>>, D>,
   ): Feature<In, RowEditMembers<RowOf<In>> & D>;
   ```

4. **Implementation:** `isDeriveFirst = typeof a === 'function'`; `multiple` resolved once from
   config (`computed(config.multiple)` / `signal(config.multiple ?? false)`, as today); generic
   `factory` over `In extends RowEditInput<In>` delegating to `buildRowEditSpec(input, multiple)`;
   `const feature: Feature<any, any> = derive ? createTableFeature(factory, derive) : createTableFeature(factory)`;
   `Object.assign(feature, { displayName: 'withRowEdit' })`.

5. **Doc comment**: keep mode-gate, `form(table.draft, schema)`, `{ multiple: true }` paragraphs.
   Replace the "Composes `withOptimistic()` internally — … never depends on `features` array
   order" paragraph with: "Builds the same editing store `withOptimistic()` builds and adds the
   open set on top; composing both throws at construction (ADR-0007)."

## Implementation Notes

- `RowEditMembers<TRow> = OptimisticMembers<TRow> & { draft: WritableSignal<TRow[]> }` unchanged.
- `WithRowEditConfig` is weak (all-optional; `multiple?: boolean | (() => boolean)`): a
  `Feature` passed to the config-only overload is rejected by weak-type detection — but a
  **function-valued `multiple`** is a property, not the argument itself, so `typeof a === 'function'`
  still discriminates correctly.
- `setup` creates an `effect` — must keep running inside the owner's injection context; the
  fold's hook ordering is unchanged.

## Risks / Watchouts

- Reading `input.indexById` at factory time and storing the _value_ would freeze it; pass the
  **signal** to `createDraftRows` as today.

## Non-Goals

- No ordering change between the two features (Step 6 records the finding, does not act).
- No spec (Step 5).

## Acceptance Checks

- [ ] `withRowEdit()` / `withRowEdit({ multiple: true })` in a slot: `store.draft` is
      `WritableSignal<Row[]>`, `store.editing.update(beginEdit(...))` typed against `Row`.
- [ ] `withRowEdit({}, withComputed((s) => ({ hasOpen: computed(() => s.editing().size > 0) })))`
      and `withRowEdit(withComputed(...))` compile; `store.hasOpen` is `Signal<boolean>`.
- [ ] `npx tsc -p libs/shared/table/tsconfig.lib.json --noEmit` clean for `with-row-edit.ts`.

---

← [Step 2: with-optimistic.ts](step-2-with-optimistic.plan.md) | [Step 4: with-optimistic.spec.ts](step-4-with-optimistic-spec.plan.md) →
