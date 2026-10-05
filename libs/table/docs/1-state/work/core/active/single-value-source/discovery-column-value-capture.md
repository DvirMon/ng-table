# How can a column declaration keep its literal ids without forcing a spelling on the consumer?

**Date:** 2026-09-22 · **Depth:** standard · **Status:** exploration only — no design chosen,
nothing committed to

Companion to [`discovery-column-value-typing.md`](discovery-column-value-typing.md), which asked
how other libraries carry a per-column value type. This one asks the narrower follow-on: given
`ColumnValues<TRow, TCols>` exists, what does the consumer have to write for it to resolve — and
can that requirement be removed rather than documented?

## Answer

**One mechanism explains every result here.** A string literal keeps its literal type only when
the contextual type carries the `StringLiteral` flag (`typescript.js:85341-85353`, and note the
repo is on **TypeScript 6.0.3**, not 5.x).

- `TrackByConfig<TRow> = keyof TRow` → a union of literals → `trackBy: 'id'` **survives**.
- `ColumnDefInput<TRow, string>['id']` → plain `string` → `id: 'region'` **widens**.

Same object literal, opposite outcomes. That asymmetry is why
`stories/grouping/fixtures/schema.ts` carries `satisfies TableConfig<DealRow>` **and** six per-id
`as const` today, and it is the whole of the problem.

Three ways to change the outcome, and no fourth was found: move the id into a position whose
contextual type is not `string` (object keys, or a `keyof TRow` literal union), or capture the
literal before it widens (`const` type parameter). Two of the three survived scrutiny.

**Nobody solved partial type-argument inference.** microsoft/TypeScript#26242 is open with no
milestone after eight years and names currying as the workaround. TanStack curries
(`createColumnHelper<Person>()`) and _widened_ it at the v9 rewrite; tRPC curries via a builder
class and its docs give no rationale.

## Why any of this matters

ADR-0024 makes the column accessor the single value source and requires grouping and filtering to
key by **declared column id**. Filtering today keys by row field, so
`equals(path.status)` yields `FilterRule<TRow['status'] | null, TRow>` — the criterion type comes
free from `TRow[K]`.

Re-key filtering to declared ids and `TRow[K]` evaporates, because `ColumnDef.accessor` is
`(row: TRow) => unknown`. Every criterion collapses to `unknown`.
`ColumnValues<TRow, TCols>` restores it as `TValues[K]`, and improves on it — `owner` maps to the
accessor's `string`, not the row's `{ name; email }`.

#125 is the enabler; the payoff lands in #115, #100 and the grouping retrofit.

## Ruled out, with the reason

Recorded so none of these is re-proposed.

| Option                                                                            | Why it died                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createColumns<TRow>()([...])` — curried                                          | Maintainer rejected the `()()` ergonomics outright                                                                                                                                                                                                                                                                                                                                                                               |
| `as const satisfies readonly ColumnDefInput<TRow>[]` as the **required** spelling | Works mechanically (const assertions are transparent to contextual typing, `78139-78141`/`78176`, so `(row)` needs no annotation). Rejected on DX: "I cannot expect the user to always remember to put `as const satisfies`." Failure is silent                                                                                                                                                                                  |
| `const TCols` on `createTable` with columns hoisted                               | `isValidConstAssertionArgument` has no `Identifier` in its whitelist (`82512-82541`) — `const` is inert on a variable reference. Inline-only                                                                                                                                                                                                                                                                                     |
| One-call helper constrained `ColumnDefInput<any, string>[]`                       | Contextual `any` bypasses the TS7006 emitter (`83061-83075`) — an unannotated accessor silently becomes `row: any`                                                                                                                                                                                                                                                                                                               |
| Same with `unknown`                                                               | Dead both ways: an annotated accessor fails the constraint under `strictFunctionTypes`, because `accessor` is property-position, not a method (`69157`, `69187`)                                                                                                                                                                                                                                                                 |
| `TRow` present only in `TCols`' constraint                                        | No inference site → `TRow = unknown` (`73929`, `73949-73951`) → the constraint then rejects the **valid** call                                                                                                                                                                                                                                                                                                                   |
| Ids as `readonly (keyof TRow & string)[]`                                         | Survives more than expected — `satisfies` alone preserves the literals (no `as const`), and `(keyof TRow & string) \| (string & {})` even admits carrier ids, since the check is a _kind_ check, not a membership check. Dies on presentation config: a bare id array has no room for `label`/`visible`/`order`, and the only non-duplicating sibling is a record keyed by that same list — at which point the list is redundant |
| Brand / required phantom on the return                                            | Works. Costs ~426 `createTable(` sites across 57 files for what the outcome guard gives free                                                                                                                                                                                                                                                                                                                                     |
| Full Drizzle inversion (`{ amount: number() }`)                                   | Makes the consumer restate `amount: number` when `DealRow['amount']` already says it. Drizzle needs it because it has no row model; a table has one                                                                                                                                                                                                                                                                              |

## What survived

### Option A — record columns + returning schema

```ts
const dealColumns = {
  region: { label: 'Region' },
  amount: { label: 'Amount' },
  owner: { label: 'Owner' },
};

createTable(deals, {
  trackBy: 'id',
  columns: dealColumns,
  columnsSchema: (path) => ({
    owner: value(path.owner, (row) => row.owner.name),
  }),
});
```

Property names are not types. There is no widening path over them anywhere in the checker
(`78821`), and index signatures are stamped on only by a _computed_ key (`78915-78920`), never by
a contextual `Record<string, X>`. The capture cannot be forgotten because there is nothing to call.

- `(path) => S` is **already** assignable to `(path) => void` — a `void` target return type
  short-circuits the check (`69210-69213`). So `runRecordedSchema`, `columnSchema()`,
  `withGrouping()` and `withSorting()` need zero change, and one `columnsSchema` body can both
  return the value map and record `metadata()`/`applyVisible()` rules through the same proxy.
- Engine cost is **one adapter** in `engine/columns-schema/resolve.ts`. `mutations/`,
  `directives/` and `engine/cells.ts` are untouched.
- `assertUniqueColumnIds` becomes dead code — a record cannot have duplicate keys.
- **Cost:** breaking. `id` stops being a field. ~20 `makeColumns()` spec factories, 5 story
  fixtures, ~25 story hosts. `TableConfig` gains a third type parameter through all 16 generated
  overloads.
- **Cost:** ordering becomes key insertion order, needing a construction throw for array-index ids
  (`'1'`, `'2024'` jump to the front per ECMAScript own-key ordering).
- Three residual ways to lose the capture, all _explicit acts_ rather than omissions: a
  `Record<string, …>` variable annotation, a return-type annotation, a computed key.

### Option B — one-call `createColumns` + an outcome guard

```ts
export function createColumns<TRow, const TCols extends readonly ColumnDefInput<TRow, string>[]>(
  columns: TCols & readonly ColumnDefInput<TRow, string>[],
): TCols {
  return columns;
}
```

`TRow` in the **parameter type** is the fix. Inference into an intersection target walks into
`ColumnDefInput<TRow, …>` for `TRow` contravariantly _and_ infers the whole tuple into `TCols`
(`73590-73605`), with `const` still firing because `isConstTypeVariable` sees through the
intersection (`63429-63432`) and `primitiveConstraint` suppresses literal widening
(`73898-73902`).

One call, zero type arguments, hoistable, no curry.

Paired with a guard in `tools/generate-overloads.ts`:

```ts
export type RequireDeclaredColumnIds<TCols extends readonly ColumnDefInput<any, string>[]> =
  string extends ColumnIdIn<ColumnValues<unknown, TCols>>
    ? { 'ng-table: column ids widened to string — declare columns with createColumns()': never }
    : unknown;

// config: TableConfig<TRow, TCols> & NoInfer<RequireDeclaredColumnIds<TCols>>
```

It checks the **outcome, not the spelling** — `createColumns()`, `as const satisfies` and per-id
`as const` all pass; only the silently-widened form errors, with a message naming the fix.
Inference is unharmed, since neither intersection constituent is a bare type variable. This is a
construction error by `.claude/rules/classify-errors-construction-vs-runtime.md`: deterministic,
fires on first compile, no correct degraded reading.

- **Purely additive.** Nothing in the lib is forced to change; the array contract and array-index
  ordering both stay.
- Migration is small: only **5 inline `columns: [`** across 3 spec files. The other ~20 factories
  return resolved `ColumnDef<Row>[]` and are unaffected.
- **Cost:** you must remember to call it. The compiler catches you one call later, at
  `createTable`, not at the declaration.
- **Cost:** `create-table.types.spec.ts` case 3 flips to `@ts-expect-error` — it currently pins the
  widened degradation through a real `createTable` call.
- An unannotated accessor is **loud** (`row: unknown`, TS18046), not silent. No accessor at all
  leaves `TRow = unknown`, which is harmless: `ColumnValues` takes its real `TRow` from `data`.

## The limit neither option clears

R2 — "a missed capture must not be silent" — cannot be enforced at `createColumns` itself. Nothing
in TypeScript lets a function observe that it was _not_ called, so the diagnostic necessarily
surfaces one call later. A required brand would move the message to the exact `columns:` property;
that is the only thing it buys, at ~426 call sites.

## Unverified — no compiler was ever run

Every mechanical claim here is a trace of the installed `typescript@6.0.3` checker. Bash was
disabled in both discovery agents and plan mode blocked writes, so nothing was compiled and every
quoted error message is **predicted, not observed**.

Two probes to run before acting on any of this:

1. **Option B's intersection-parameter inference** — the highest-risk claim. Intersection-target
   inference combined with a `const` modifier and a contravariant sibling is an unusual
   combination, and no TS test case or doc was found covering it.

   ```ts
   const c = createColumns([
     { id: 'region' },
     { id: 'owner', accessor: (r: DealRow) => r.owner.name },
   ]);
   expectTypeOf<(typeof c)[number]['id']>().toEqualTypeOf<'region' | 'owner'>();
   ```

   ```bash
   nx run shared-table:typecheck-spec
   ```

   If it fails, Option B is gone.

2. **Option A's sibling-property inference** — `columnsSchema`'s `path` typed
   `ColumnsPath<TRow, keyof TCols & string>` depends on a sibling property of the same object
   literal. `withFiltering`'s precedent is weaker than it looks: its `path` depends only on `In`,
   never on a sibling. If it fails, `columnsSchema` must move out of `TableConfig` into its own
   `createTable` argument.

## Tree state at the time of writing

Uncommitted work for #125 steps 1, 3 and 4 is already in the tree: the curried
`api/create-columns.ts` (now rejected), its types spec, the three new types in `api/types.ts`, and
717 changed lines in `create-table.overloads.ts` + `tools/generate-overloads.ts` already carrying
`TCols` and `ColumnValues` through all 16 signatures.

`4-tasks/issue-125-column-value-map/progress.md` says "Step 4 pending". **It is stale** — step 4 is
done in the working tree. Trust `git diff`.
