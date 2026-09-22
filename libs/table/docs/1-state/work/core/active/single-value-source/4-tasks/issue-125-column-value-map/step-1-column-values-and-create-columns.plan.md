# Step 1 — `ColumnValues<>` and the `createColumns()` capture point

**PR scope:** standalone. **Depends on:** nothing.
**Parallel-safe with:** nothing in this issue — Steps 2 and 3 both read
what this step declares.

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/api/types.ts` (edit)
- `libs/table/src/api/create-columns.ts` (create)
- `libs/table/src/index.ts` (edit)

## Why This Step Exists

#113 carried the declared column-id *union* into every feature slot. The
value *behind* each id does not travel with it: `ColumnDef.accessor` is
typed `(row: TRow) => unknown`, and `ColumnDef<TRow, TId>[]` erases each
element's accessor return type. Every schema keyed by column id therefore
lands on `unknown`, and ADR-0024's single value source has no type-level
counterpart.

Two pieces are missing and this step adds both, wired to nothing:

- the **derivation** — a mapped type that turns a column list into an
  id → value map;
- the **capture point** — a call the consumer writes the array literal
  *inside*, because TS 5.0's `const` modifier only affects expressions
  written within the call, so a hoisted `const cols = [...]` is already
  widened before `createTable()` ever sees it.

Nothing reads either one here. Step 3 puts the map on the store; Step 2
proves the derivation standalone. Keeping this step additive is what makes
its diff reviewable as "two type declarations plus an identity function"
rather than as part of a generics migration.

## What To Do

**1. `api/types.ts` — three new exported types.** Place them beside
`ColumnDefInput`, which they build on.

```ts
/** The declared column-id → value map a table's columns derive. */
export type ColumnValueMap = Record<string, unknown>;

/** The declared column-id union carried by a value map. `Record<string, unknown>` — the
 * default — yields `string`, which is exactly the pre-#125 behaviour. */
export type ColumnIdIn<TValues extends ColumnValueMap> = keyof TValues & string;

/** Maps each declared column id to the value behind it: a declared `accessor`'s return
 * type, else `TRow[id]` — exact, not a guess, because the engine's documented default
 * accessor *is* `(row) => row[id]`. */
export type ColumnValues<
  TRow,
  TCols extends readonly ColumnDefInput<any, string>[],
> = {
  [C in TCols[number] as C['id']]: C extends { accessor: (row: any) => infer V }
    ? V
    : C['id'] extends keyof TRow
      ? TRow[C['id']]
      : unknown;
};
```

**2. `api/create-columns.ts` — the capture point, curried.**

```ts
export function createColumns<TRow>() {
  return <const TCols extends readonly ColumnDefInput<TRow, string>[]>(
    columns: TCols,
  ): TCols => columns;
}
```

Give it a consumer-facing JSDoc block: what it is for (capturing the
declared ids and accessor return types that a plain array widens away),
the call shape `createColumns<DealRow>()([...])`, and a one-line note that
the result is safe to hoist because the un-widened element types are
already in the variable's type.

**3. `src/index.ts` — export `createColumns`, `ColumnValueMap`,
`ColumnIdIn` and `ColumnValues`.** `index.ts` is the table's only barrel;
anything not listed there is internal. All four are consumer-facing —
`createColumns` is what a consumer calls, and the three types are what a
third-party feature author needs in order to type a config against the
map.

## Implementation Notes

- **Why curried.** TypeScript has no partial type-argument inference, so a
  single `createColumns<TRow, const TCols>(columns)` call cannot take
  `TRow` explicitly *and* still infer `TCols` — supplying one type argument
  makes the second fall back to its default rather than inferring. The
  extra `()` is the price, and it buys contextual typing of every accessor
  param for free: `accessor: (row) => row.owner.name` needs no annotation,
  because `TRow` is already bound by the time the array is checked.
- **Why the capture point is here and not a `const` modifier on
  `createTable()`.** TS 5.0 states the limit verbatim — the modifier "only
  affects inference of object, array and primitive expressions that were
  written within the call", with a hoisted `const arr = [...]` as its
  explicit counter-example. That is exactly this repo's declaration style
  (`const dealColumns = [...] satisfies ColumnDefInput<DealRow>[]`), so a
  `const` on `createTable`'s `columns` would do nothing for any existing
  fixture. Inside `createColumns([...])` the literal *is* written within
  the call, so hoisting its result is safe.
- **Why `readonly` on the constraint.** TS 5.0's other documented limit: a
  mutable constraint makes the `readonly [...]` inference candidate
  unassignable, and inference silently falls back to the constraint —
  defeating the modifier entirely. `readonly ColumnDefInput<TRow, string>[]`
  is not stylistic.
- **A tuple is not required.** `TCols[number]` resolves over an
  array-of-union just as well as over a tuple, and declaration order is
  irrelevant to a value map. The only requirement is that element types
  stay un-widened. (K0, workspace `decisions.md`.)
- **`any` in `ColumnValues`' second parameter and in the `accessor` infer
  pattern are `infer`/wildcard slots, not constraint slots** — the same
  shape and the same reason as `ColumnIdOf`'s in `engine/types.ts`, whose
  comment already spells this out. They do not widen the result.
- **Runtime is the identity function.** `createColumns` deliberately
  resolves nothing: `ColumnDefInput` → `ColumnDef` defaulting, `order`
  assignment from the array index, and duplicate-id rejection all stay in
  `resolveColumnsConfig()`. The name was chosen (over `defineColumns`)
  because `create*` is the barrel's established prefix — `createTable`,
  `createTableFeature`, `createColumnMetaKey`, `createRow` — and because
  it leaves room to move those resolutions here later with no rename.
  That move is not this slice.

## Risks / Watchouts

- **The `accessor` arm must match a *present* `accessor`, not an optional
  one.** `ColumnDefInput` makes `accessor` optional, so the conditional
  `C extends { accessor: (row: any) => infer V }` is doing the work of
  distinguishing "declared" from "defaulted". Verify with a probe that a
  column literal *without* `accessor` takes the `TRow[id]` arm rather than
  inferring `V = unknown` from an optional member — Step 2 asserts exactly
  this, but a five-line scratch check here is cheaper than finding out two
  steps later.
- **Do not annotate `createColumns`' return as
  `ColumnDefInput<TRow, string>[]`.** That would erase everything the
  `const` modifier just captured, which is the whole failure mode this
  helper exists to prevent. The return type is `TCols`.
- **`api/types.ts` ↔ `engine/types.ts` is a deliberate type-only import
  cycle.** Nothing added here imports from `engine/`, so the cycle is
  untouched — but do not reach for an engine type to express any of the
  three new declarations.
- **`ngc` aborts at the first `.ts` error and never reaches the template
  phase.** Fix any source error and run the typecheck again; only a
  source-clean second run says anything about the story templates
  (`.claude/rules/typecheck-angular-templates.md`).

## Non-Goals

- **Nothing reads `ColumnValues` yet.** `TableStore`, `TableCore` and
  `TableConfig` keep their current type parameters — Step 3 owns that.
- **`createTable()` is untouched.** No signature change, no generated
  overload change.
- **No story fixture migrates.** `src/stories/**/fixtures/schema.ts` keeps
  its `as const` + `satisfies` declarations; the issue's "Not in this
  slice" excludes consumers, and a migration would make this step's diff
  about ergonomics instead of mechanism.
- **No resolution moved into `createColumns`.** Defaulting, ordering and
  duplicate-id rejection stay where they are.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` clean, **run twice** — the second
      run is the one that covers the story templates.
- [ ] `nx run shared-table:typecheck-spec` clean.
- [ ] `npm run table:overloads:check` still clean — this step must not
      have made the generated files drift.
- [ ] `createColumns`, `ColumnValueMap`, `ColumnIdIn` and `ColumnValues`
      are all reachable from `src/index.ts`.
- [ ] `git diff --stat` shows exactly three files changed.

---
[Step 2: The capture guard](step-2-capture-guard.plan.md) →
