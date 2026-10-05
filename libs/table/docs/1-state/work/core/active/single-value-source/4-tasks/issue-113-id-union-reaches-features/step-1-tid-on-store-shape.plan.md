# Step 1 — `TId` survives on the store shape

**PR scope:** standalone. **Depends on:** nothing.
**Parallel-safe with:** nothing in this issue — Step 2 reads what this
step declares.

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/api/types.ts` (edit)
- `libs/table/src/engine/types.ts` (edit)

## Why This Step Exists

ADR-0024 makes a feature's schema fn key by declared column id, so a
feature's config must see the union declared in `TableConfig.columns`.
Today that union dies on arrival: `TableConfig<TRow, TId>` infers it, and
`TableStore<TRow>` — the type every feature slot is typed against — has no
slot to put it in. `create-table.overloads.ts` already binds a `TId`
generic and then drops it (`:11-16`), which is the erasure in its most
literal form.

This step reopens the channel and nothing else. No feature reads it yet,
no call site changes, and every reference to `TableStore<TRow>` /
`TableCore<TRow>` keeps compiling because the new parameter is defaulted.
The union still does not reach a slot until Step 2 regenerates the
overloads — that is deliberate, so this step's diff is reviewable as a
pure type-parameter addition.

## What To Do

**1. `api/types.ts` — `TableStore` gains `TId`.**

```ts
export interface TableStore<TRow, TId extends string = string> {
  readonly columns: WritableView<ColumnDef<TRow, TId>[], ColumnsUpdater<TRow, TId>>;
  // …every other member unchanged
}
```

`ColumnDef<TRow, TId>` and `ColumnsUpdater<TRow, TId>` already take the
parameter — this is threading, not new machinery. No other member of
`TableStore` mentions a column id, so nothing else in the interface moves.

**2. `engine/types.ts` — `TableCore` gains `TId`, the same way.**

```ts
export interface TableCore<TRow, TId extends string = string> {
  readonly columns: WritableView<ColumnDef<TRow, TId>[], ColumnsUpdater<TRow, TId>>;
  readonly baseColumns: Signal<ColumnDef<TRow, TId>[]>;
  // …every other member unchanged
}
```

**3. `engine/types.ts` — add `ColumnIdOf<S>` beside `RowOf<S>.`**

```ts
/** Recovers the declared column-id union from a store shape, the way `RowOf` recovers the
 * row type. Falls back to `string` for a shape with no `columns` member — a partial store
 * used as a test double, or a feature input narrowed to `Shape`. ADR-0019. */
export type ColumnIdOf<S> = S extends {
  columns: WritableView<ColumnDef<any, infer I>[], any>;
}
  ? I
  : string;
```

**4. `Shape` stays `{ rows: Signal<readonly unknown[]> }`.** Settled
2026-09-20 — see Implementation Notes.

## Implementation Notes

- **Why `Shape` does not gain a `columns` carrier.** Requiring it would
  make every `Feature<In, …>` statically guarantee a recoverable union and
  let `ColumnIdOf` drop its fallback arm. It would also force every
  partial store shape in the existing specs and test doubles to supply a
  `columns` member. Recovery does not need it: at a real call site `In` is
  bound to the concrete `TableStore<TRow, TId> & O1 & …`, which carries
  `columns` structurally. The fallback arm exists for the narrowed-to-
  `Shape` case only.
- **`any` in `ColumnIdOf`'s pattern is an `infer` slot, not a constraint
  slot** — the same shape and the same reason as `ReadonlyStore<S>`'s
  `WritableView<infer T, any>` in `api/types.ts`. It does not widen the
  result.
- **Defaulted, so the diff is additive.** Every `TableStore<TRow>` and
  `TableCore<TRow>` reference in the lib, the directives and the stories
  resolves to `TId = string`, which is what they get today. If any of them
  fails to compile, the parameter was threaded into a member that should
  not have it.
- **Do not touch `create-table.overloads.ts` or
  `compose-features.overloads.ts`.** Both are generated; Step 2 owns them.

## Risks / Watchouts

- **`with-expansion.ts:27`** narrows through `Pick<TableStore<RowOf<In>>,
'rows' | 'trackBy'>`. Neither picked member mentions a column id, so it
  is unaffected — but it is the one place a `TableStore<…>` is destructured
  by key, so check it explicitly rather than assuming.
- **`ColumnsSchemaStore<TRow>` (`columns-schema/types.ts`)** declares
  `baseColumns: Signal<ColumnDef<TRow>[]>` and is satisfied structurally by
  `TableCore`. With `TId` defaulted, `ColumnDef<TRow, TId>[]` stays
  assignable to `ColumnDef<TRow, string>[]`. Leave that interface alone —
  widening it here would pull the wiring into this step's scope for no
  gain.
- **`ngc` aborts at the first `.ts` error and never reaches the template
  phase.** Fix any source error and run the typecheck again; only a
  source-clean second run says anything about the story templates
  (`.claude/rules/typecheck-angular-templates.md`).

## Non-Goals

- **No feature config changes.** `withGrouping`, `withFiltering` and
  `withSorting` keep their current signatures —
  [#114](https://github.com/DvirMon/ng-table/issues/114),
  [#115](https://github.com/DvirMon/ng-table/issues/115) and
  [#100](https://github.com/DvirMon/ng-table/issues/100) own those.
- **No runtime change.** Nothing in this step emits code.
- **No `ColumnId<TRow>` tightening.** Dropping its `| (string & {})` arm
  is deferred by ADR-0019's Alternatives table and stays deferred.
- **No spec.** The guard is Step 3's, and it cannot assert anything until
  Step 2 puts `TId` in a feature slot.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` clean, **run twice** — the second
      run is the one that covers the story templates.
- [ ] `nx run shared-table:typecheck-spec` clean.
- [ ] `git diff --stat` shows exactly two files changed.
- [ ] `npm run table:overloads:check` still clean — this step must not
      have made the generated files drift.

---

[Step 2: The generator carries `TId` into every slot](step-2-generator-carries-tid.plan.md) →
