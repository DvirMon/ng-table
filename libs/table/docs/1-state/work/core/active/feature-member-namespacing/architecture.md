---
title: Architecture — one callable slice per feature
type: architecture
status: settled, ready for /to-tasks
date: 2026-09-13
audience: developers
---

# Architecture

Consumed by `/to-tasks`, not left to age. Paths are real and current as of `feat/table` at
`7fa9c03`. Contract in [`spec.md`](spec.md); decision record in
[ADR-0015](../../../../../adr/0015-feature-member-namespacing.md); evidence in
[`research-callable-slice-shape.md`](research-callable-slice-shape.md).

## Settled — not open for relitigation

1. **One member per feature, a callable slice keyed by state concern.** Nothing grandfathered.
   (ADR-0015, decision.)
2. **The primary-signal rule** decides what the call returns; secondary signals stay their own
   nodes; a slice call never returns a composite. (ADR-0015, settled 2026-09-11.)
3. **Slices are named after the concern, not the feature** — `editing`, never `optimistic` /
   `rowEdit`. (ADR-0015 corollary; D37.)
4. **Derive-block placement follows declaration site** — nested ⇒ the host's slice; top-level ⇒
   flat. `withComputed()` is unchanged; the host decides the merge target. (ADR-0015, settled
   2026-09-12; type-probed 2026-09-13.)
5. **Migration is expand–contract**, gated on #43 green. (spec §Migration strategy.)
6. **`withFiltering()` stays memberless.** ADR-0015's filtering row cites members R12 deleted.
   (spec correction.)
7. **`rowsOf`, not `rowIdsOf`** — the shipped D16 name moves under the slice unchanged.
8. **Verb signatures unchanged.** Every moved verb keeps parameters, write options, return type.
9. **`draft` lands on `editing`.** (spec corollary.)
10. **Member names inside a slice drop the concern word.** Full table below.
11. **The derive-block read-only projection strips `update`/`set` only and recurses one level
    into slices.** Today's projection would collapse `grouping` and `editing` to bare signals.
12. **A feature declares its derive-merge target on its spec**; undeclared ⇒ flat merge (third-party
    features unaffected).

## Rename table — every flat member and where it lands

| Concern   | Today (flat, `src/api/features/…`)                                                | After                           | Kind                                      |
| --------- | --------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------- |
| sorting   | `sorting()`                                                                       | `sorting()`                     | primary — key stays, becomes a slice      |
|           | `sortDirections()`                                                                | `sorting.directions()`          | signal                                    |
|           | `sortChanged`                                                                     | `sorting.changed`               | Observable                                |
|           | `toggleSort(id)`                                                                  | `sorting.toggle(id)`            | verb                                      |
|           | `setSorting(rules)`                                                               | `sorting.set(rules)`            | verb                                      |
|           | `clearSorting()`                                                                  | `sorting.clear()`               | verb                                      |
| selection | `selectedRows()`                                                                  | `selection()`                   | primary — new key                         |
|           | `selectionChanged`                                                                | `selection.changed`             | Observable                                |
|           | `toggle(id, opts)`                                                                | `selection.toggle(id, opts)`    | verb                                      |
|           | `select(ids, opts)`                                                               | `selection.select(ids, opts)`   | verb                                      |
|           | `deselect(ids, opts)`                                                             | `selection.deselect(ids, opts)` | verb                                      |
|           | `clearSelection(opts)`                                                            | `selection.clear(opts)`         | verb                                      |
|           | `selectionStateOf(ids)`                                                           | `selection.stateOf(ids)`        | verb                                      |
|           | `isSelectable(id)`                                                                | `selection.isSelectable(id)`    | verb                                      |
| expansion | `expandedRows()`                                                                  | `expansion()`                   | primary — new key                         |
|           | `everExpanded()`                                                                  | `expansion.everExpanded()`      | signal                                    |
|           | `rowExpanded`                                                                     | `expansion.changed`             | Observable (emits on expand and collapse) |
|           | `toggleExpanded(id, opts)`                                                        | `expansion.toggle(id, opts)`    | verb                                      |
|           | `expandAll(opts)`                                                                 | `expansion.expandAll(opts)`     | verb                                      |
|           | `collapseAll(opts)`                                                               | `expansion.collapseAll(opts)`   | verb                                      |
| grouping  | `grouping()` / `grouping.update(u)`                                               | unchanged                       | already a slice                           |
|           | `rowsOf(group)`                                                                   | `grouping.rowsOf(group)`        | verb                                      |
| editing   | `editing()` / `editing.update(u)`                                                 | unchanged                       | already a slice                           |
|           | `pending()`                                                                       | `editing.pending()`             | signal                                    |
|           | `pendingOps()`                                                                    | `editing.pendingOps()`          | signal                                    |
|           | `unconfirmed()`                                                                   | `editing.unconfirmed()`         | signal                                    |
|           | `draft` (`withRowEdit()` only)                                                    | `editing.draft`                 | `WritableSignal<TRow[]>`                  |
| filtering | _(none)_                                                                          | _(none)_                        | —                                         |
| core      | `value`, `columns`, `rows`, `renderRows`, `trackBy`, `indexById`, `totalRowCount` | unchanged                       | —                                         |

## Current source — what each change lands against

| File                                                         | Today                                                                                                                                                                                                      | Change                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/engine/writable-view.ts`                                | `createWritableView(read, applyUpdater)` = `Object.assign(computed(read), { update })`; `WritableView<T, Updater>`                                                                                         | generalise: `createSlice<T, M>(read, members): Slice<T, M>`; `WritableView` becomes `Slice<T, { update(u: Updater): void }>` and `createWritableView` a one-line wrapper. Consider renaming the file `slice.ts` (concern-named per `file-organization.md`); keep the `WritableView` export name                                                                                                                                              |
| `src/engine/types.ts` `TableFeatureSpec`                     | `members`, `stages`, `renderStages`, `columnRules`, `setup`, `onDestroy`, `onRowsRemoved`                                                                                                                  | gains `deriveTarget?: keyof Members & string` — the member a trailing derive block merges onto                                                                                                                                                                                                                                                                                                                                               |
| `src/api/create-table-feature.ts`                            | `blockInput = Object.assign(Object.create(input), spec.members)`; `mergeDerivedSpec` → `mergeMembers(spec.members, derivedSpec.members)` flat, throwing on duplicate                                       | when `spec.deriveTarget` is set: merge `derivedSpec.members` onto `spec.members[deriveTarget]` (a new `Object.assign` onto the slice — the slice is a function object, so assignment works), throwing on a key already on the slice with the same wording and naming the slice. Undeclared target ⇒ today's flat path. The return type becomes `Feature<In, { [K in Target]: Out[K] & D }>`-shaped; ADR-0015's probe signature is the target |
| `src/api/types.ts` `ReadonlyStore<S>` (L118)                 | `S[K] extends WritableView<infer T, any> ? Signal<T> : S[K]`                                                                                                                                               | strip only the write path and recurse one level: a callable member keeps its call signature and every non-`update`/`set` property; its own properties get the same treatment. `Omit<>` on a callable drops the call signature — build as `(() => T) & Omit<S[K], 'update' \| 'set'>`, mapped over the slice's keys                                                                                                                           |
| `src/api/features/with-sorting.ts`                           | `SortingMembers` = 6 flat keys; `sorting: sorting.asReadonly()`                                                                                                                                            | `SortingSlice = Slice<SortRule[], { directions, changed, toggle, set, clear }>`; `SortingMembers = { readonly sorting: SortingSlice }`; `deriveTarget: 'sorting'`                                                                                                                                                                                                                                                                            |
| `src/api/features/with-selection.ts`                         | `SelectionMembers` = 8 flat keys; `selectedRows: selectedIds.asReadonly()`                                                                                                                                 | `SelectionSlice = Slice<ReadonlySet<RowId>, { changed, toggle, select, deselect, clear, stateOf, isSelectable }>`; `SelectionMembers = { readonly selection: SelectionSlice }`; `deriveTarget: 'selection'`                                                                                                                                                                                                                                  |
| `src/api/features/with-expansion.ts`                         | `ExpansionMembers` = 6 flat keys; `expandedRows: expandedRows.asReadonly()`                                                                                                                                | `ExpansionSlice = Slice<Set<RowId>, { everExpanded, changed, toggle, expandAll, collapseAll }>`; `ExpansionMembers = { readonly expansion: ExpansionSlice }`; `deriveTarget: 'expansion'`. `buildTreeStage` keeps taking the raw `expandedRows` signal — internal, unchanged                                                                                                                                                                 |
| `src/api/features/with-grouping.ts`                          | `GroupingMembers<TRow> = { grouping: WritableView<…>; rowsOf }`; `readExpandedRows(store)` checks `'expandedRows' in store` then `typeof === 'function'`                                                   | `GroupingSlice<TRow> = Slice<string[], { update, rowsOf }>`; `GroupingMembers = { readonly grouping: GroupingSlice<TRow> }`; `deriveTarget: 'grouping'`; `readExpandedRows` reads `store.expansion` — the duck-type check already holds for a slice                                                                                                                                                                                          |
| `src/api/features/editing-state.ts`                          | `EditingStore` returns `editing` (writable view), `pending`, `pendingOps`, `unconfirmed` as siblings                                                                                                       | `editing` becomes `EditingSlice<TRow> = Slice<ReadonlySet<RowId>, { update, pending, pendingOps, unconfirmed }>` built in `createEditingStore`; the store keeps returning the siblings for its own callers, but the public member is the slice                                                                                                                                                                                               |
| `src/api/features/with-optimistic.ts`                        | `OptimisticMembers` = 4 flat keys                                                                                                                                                                          | `OptimisticMembers<TRow> = { readonly editing: EditingSlice<TRow> }`; `deriveTarget: 'editing'`                                                                                                                                                                                                                                                                                                                                              |
| `src/api/features/with-row-edit.ts`                          | `RowEditMembers = OptimisticMembers & { draft }`                                                                                                                                                           | `RowEditMembers<TRow> = { readonly editing: EditingSlice<TRow> & { readonly draft: WritableSignal<TRow[]> } }`; `draft` assigned onto the slice; `deriveTarget: 'editing'`                                                                                                                                                                                                                                                                   |
| `src/api/features/with-filtering.ts`                         | `Feature<In, {}>`                                                                                                                                                                                          | unchanged                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `src/api/features/with-computed.ts`                          | returns `{ members }`                                                                                                                                                                                      | unchanged — placement is the host's decision                                                                                                                                                                                                                                                                                                                                                                                                 |
| `src/api/features/compose-features.ts`                       | collapses N features into one slot                                                                                                                                                                         | unchanged; verify a following slot still sees a sliced feature's contribution                                                                                                                                                                                                                                                                                                                                                                |
| `src/engine/compose-table.ts` `foldFeatures` (L114)          | claims each key in `spec.members`, then `Object.assign(store, spec.members)`                                                                                                                               | unchanged — one key per feature is exactly what it already handles                                                                                                                                                                                                                                                                                                                                                                           |
| `src/engine/slots.ts`                                        | `claimMember`                                                                                                                                                                                              | unchanged                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `src/index.ts`                                               | exports `*Members` types                                                                                                                                                                                   | add `SortingSlice`, `SelectionSlice`, `ExpansionSlice`, `GroupingSlice`, `EditingSlice`, `Slice`; keep `*Members`                                                                                                                                                                                                                                                                                                                            |
| `src/stories/**/*-story-host.component.{ts,html}` (13 hosts) | ~100 flat reads (histogram: `editing` 98 — mostly `editing.update`, untouched; `draft` 15; `grouping` 14; `pending` 8; `toggleSort` 6; `toggleExpanded` 6; `selectedRows` 5; `sortDirections` 4; rest ≤ 3) | rename per table; fixtures such as `createSelectionEventLog(table.selectionChanged)` take `table.selection.changed`                                                                                                                                                                                                                                                                                                                          |
| `apps/demo/src/app/table-*-demo/*.{ts,html}` (5 demos)       | ~30 flat reads                                                                                                                                                                                             | rename per table                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `src/directives/`                                            | zero feature-member reads                                                                                                                                                                                  | nothing                                                                                                                                                                                                                                                                                                                                                                                                                                      |

## Types to add

```ts
// engine/writable-view.ts (or slice.ts)
export type Slice<T, Members extends object> = (() => T) & Members;

export function createSlice<T, Members extends object>(
  read: () => T,
  members: Members
): Slice<T, Members> {
  return Object.assign(computed(read), members);
}

export interface WritableView<T, Updater> extends Slice<T, { update(updater: Updater): void }> {}
export const createWritableView = <T, U>(read: () => T, apply: (u: U) => void): WritableView<T, U> =>
  createSlice(read, { update: apply });

// engine/types.ts — on TableFeatureSpec
/** The member a trailing derive block merges onto. Absent ⇒ derived members merge flat. */
deriveTarget?: keyof Members & string;

// api/types.ts — read-only projection, one level of recursion into slices
type StripWrites<M> = M extends (...args: infer A) => infer R
  ? ((...args: A) => R) & { readonly [K in Exclude<keyof M, 'update' | 'set'>]: StripWrites<M[K]> }
  : M;
export type ReadonlyStore<S> = { readonly [K in keyof S]: StripWrites<S[K]> };
```

The exact `StripWrites` shape must be re-probed: the ADR's 2026-09-13 probe covered
`Feature<In, { selection: SelectionSlice & D }>` inference, not the projection. Re-run the
four checks plus one for `store.grouping.rowsOf` resolving inside a nested block and one for
`store.editing.draft.set` being absent.

## Host signature, as probed (ADR-0015)

```ts
declare function withSelection<In extends Shape, D extends DerivedDict>(
  config: WithSelectionConfig<RowOf<In>> | undefined,
  derive: Feature<NoInfer<In> & { selection: SelectionSlice }, D>,
): Feature<In, { selection: SelectionSlice & D }>;
```

Every feature's three overloads (derive-first, config-only, config-plus-derive) keep their shape;
only `Out` changes. `createTableFeature`'s second overload has to produce this return type from
`deriveTarget`, or each feature declares its overloads against the slice type explicitly and
`createTableFeature` stays loosely typed inside — the latter is what the features do today.

## Expand–contract, mapped to files

| Phase     | Lands                                                                                                                            | Green because                                      |
| --------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Prefactor | `createSlice`, `deriveTarget`, projection, `create-table-feature.ts` merge-onto-slice, type assertions in `create-table.spec.ts` | no consumer surface changes                        |
| Expand    | each `with-*.ts` gains its slice key beside its flat keys; each `with-*.spec.ts` covers both forms                               | flat keys still exist; ADR-0007 sees disjoint keys |
| Migrate   | story hosts, `apps/demo`, docs                                                                                                   | expand still ships the flat form                   |
| Contract  | flat keys deleted from `with-*.ts`, flat cases deleted from specs, `index.ts` exports, ADR-0015 status → implemented             | no caller remains                                  |

## Test seams

- `src/api/features/with-{sorting,selection,expansion,grouping,optimistic,row-edit}.spec.ts` —
  per-feature runtime through `createTable()`; prior art is every existing case in those files.
- `src/api/create-table.spec.ts` — nested vs top-level derive placement, slice-level collision,
  projection, and the `expectTypeOf` block (L301 onward) for the type checks.
- `src/api/features/compose-features.spec.ts` — a slot after `composeFeatures(...)` still sees a
  sliced contribution.

## Open questions

None blocking. Two the implementer should confirm against the type checker rather than decide by
hand:

1. Whether `createTableFeature`'s second overload can express the merge-onto-slice return type
   generically from `deriveTarget`, or whether each feature keeps declaring its overloads explicitly
   (today's pattern). Either is acceptable; the latter is the fallback.
2. The exact `StripWrites` recursion depth — one level is the requirement (`editing.draft`); if the
   recursive form degrades inference, a non-recursive form that special-cases `WritableSignal` at
   depth one is acceptable.

## Owed docs (tracked as the migration's docs issue)

- ADR-0015: filtering row (members no longer exist), `rowIdsOf` → `rowsOf`, add research
  Finding 5's invariant as a consequence, status → implemented.
- `docs/1-state/features/selection.md` (8 flat reads), `expansion.md` (2),
  `docs/3-ui/directives/expansion.md` (4), `selection.md` (1), `docs/0-product/grouping.md`
  (close S12), `selection.md` (2), `row-editing.md` (1), `docs/1-state/architecture.md` (1),
  ADR-0007 and ADR-0013 examples (1 each).
- Library `CLAUDE.md`: the rename table, beside the positional-migration table #44 owes.
