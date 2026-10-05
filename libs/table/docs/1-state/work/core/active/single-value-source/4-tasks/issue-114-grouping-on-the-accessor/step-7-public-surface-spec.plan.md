# Step 7 — The public-surface spec

**PR scope:** standalone. **Depends on:** Step 1 (both throws), Step 3
(the re-keyed config), Step 4 (`applyAggregate`) and Step 5 (the total
level read). **Parallel-safe with:** Step 6.

**Task type:** test

**Skills used:** unit-test

**Scaffolding agent:** test-implementer

## Files

- `libs/table/src/api/features/with-grouping/feature.spec.ts` (edit)
- `libs/table/src/api/features/with-grouping/schema.spec.ts` (edit)
- `libs/table/src/api/features/with-grouping/feature.types.spec.ts` (create)

## Why This Step Exists

Steps 1, 3, 4 and 5 each change what a consumer writes or what they get
back. `feature.spec.ts` is the readable statement of what
`withGrouping()` promises, and right now it promises several things this
slice retires: `aggregateFn` on a column, a raw-field-name group label,
a `groupingLevels()` that quietly drops levels.

Three of the issue's acceptance criteria have no runtime expression at
all — `initial`'s string shorthand still compiling, `GroupingLevel.key`
being gone, `path.<id>` rejecting a typo. Those need a
`*.types.spec.ts`, which is why this step creates one rather than
stretching the runtime spec.

## What To Do

**1. Migrate what Steps 1/4/5 invalidated, in `feature.spec.ts`.**

- Every fixture declaring `aggregateFn` on a `ColumnDefInput` (~6 sites,
  including the depth-correctness, pipeline-order and dissolved-cluster
  cases) moves to `schema: (path) => applyAggregate(path.amount, sumFn)`.
  The assertions themselves — `aggregates?.['amount']` — do not change;
  only where the function is declared does.
- Cases asserting a raw-field-name label are **deleted**, not rewritten.
  The path no longer exists.
- Cases whose `initial` names a field with no column now throw at
  construction. Where the level was incidental scenery, give it a column.
  Where the missing column _was_ the point, the case is deleted and
  replaced by case 2 below.

**2. Both throws name both parties (AC #4).**

- `withGrouping({ initial: ['nope'] })` throws at construction; the
  message contains `[withGrouping]` and `nope`.
- `withGrouping({ schema: (path) => applyGrouping(path.nope, …) })` —
  same, declared through the schema rather than `initial`.
- `applyAggregate` on an undeclared id — same, proving G59 rides Step 1's
  check rather than a second one.
- `table.grouping.update(addGroupLevel('nope'))` throws. This is the
  writer half, and it is the ruling made while planning (2026-09-21) —
  it has no issue-body AC of its own, so the spec is where it becomes
  binding.
- `table.grouping.update(reorderGroupLevels(9, 12))` still does **not**
  throw. Index bounds keep degrading; only unknown ids throw. Keep these
  two adjacent so the distinction is readable.

**3. A level naming a column added by `setColumns()` is writable.**
Proves the writer reads `columns()` at write time, not at construction.

**4. `groupingLevels()` is total (AC #5).** Every applied level yields a
`ColumnDef`. A level gated off by `when` is still absent — that is D5,
and it must stay covered so Step 5's deletion is not read as also
removing the applied/declared distinction.

**5. Aggregates on a derived-accessor column (AC #6).**
`applyAggregate` over a column whose value comes from an accessor rather
than a row field — the case G43's premise said was impossible. This is
the public-API counterpart to Step 6's engine case.

**6. `feature.types.spec.ts` — the compile-time half.**

Follow `api/create-table.types.spec.ts` (#113 Step 3) exactly: a
`typecheckOnly(assertions: () => void)` wrapper, `expectTypeOf`, and a
file-level comment stating that **`nx run shared-table:typecheck-spec`**
is what enforces the file — vitest runs `expectTypeOf` and
`@ts-expect-error` without typechecking either.

Four cases:

- **`initial`'s string shorthand still compiles** (AC #7):
  `withGrouping({ initial: ['region', 'category'] })` inside a
  `createTable()` whose columns declare those ids.
- **`initial`'s object form uses `columnId`**:
  `{ columnId: 'region', label: 'Sales Region' }` compiles, and
  `{ key: 'region' }` is a `@ts-expect-error`. That is the rename, stated
  as a test rather than as a changelog line.
- **A typo in `initial` is rejected**: `initial: ['regionn']` under
  `@ts-expect-error`.
- **`path.<declaredId>` autocompletes and rejects a typo** inside
  `schema`, and `applyGroupKey`'s extractor parameter is `unknown` —
  `expectTypeOf` on the callback's argument, pinning G68 at the type
  level as well as the runtime level Step 6 covers.

## Implementation Notes

- **Build `columns` the way `create-table.spec.ts:20-36` does** in the
  types spec — a helper with **no** return annotation, `id: '…' as const`,
  closed with `satisfies ColumnDef<Row>[]`. An annotated array widens
  `TId` to `string` and every case silently asserts the index-signature
  fallback instead.
- **Call `createTable(...)` inline in every types case.** Routing through
  a shared generic helper is what produced a spurious `Actual: unknown`
  in `with-filtering/feature.types.spec.ts`; that file's header records
  it, do not re-derive it.
- **Do not duplicate #113's widening guard.** `create-table.types.spec.ts`
  already pins that failure mode generically. This file asserts
  grouping's own surface.
- **`schema.spec.ts`** covers the declarators in isolation — add
  `applyAggregate`'s recording case beside the existing
  `applyGroupKey`/`applyGroupOrder` ones, and widen the generic-parameter
  expectations where Step 3 changed `K extends Extract<keyof TRow, string>`
  to `K extends string`.
- Load the `unit-test` skill for selection policy before adding runtime
  cases.

## Risks / Watchouts

- **`@ts-expect-error` is satisfied by _any_ error on the next line.** In
  the typo cases, assert the surrounding `createTable(...)` still returns
  the expected store type, so an unrelated error shows up as a second
  failure rather than passing quietly.
- **Do not soften a case to make it pass.** If the `columnId` rename case
  fails, Step 3 is wrong, not the spec.
- **This step is the last gate before stories.** If `feature.spec.ts` is
  left partly migrated, Step 8 will be debugging library bugs through
  story hosts, which is the slowest possible place to find them.
- **`applyAggregate` fixtures need a real throwing case retained** — the
  existing "never calls aggregateFn for a dissolved cluster" test proves
  a throw that never fires, and that guarantee must survive the move.

## Non-Goals

- **No engine-internal assertions.** `clusters.ts`/`render.ts` behaviour
  is Step 6's; this file asserts only what `withGrouping()` exposes.
- **No story fixtures.** Step 8.
- **No `#117` resolver cases.** `ClusterSummary` is unchanged
  (`{ columnId, key, rows }`, G67) and a `when` reading a carrier column
  has no spelling in this slice — proving that is #117's gate, not this
  one's.
- **No filtering or sorting cases.** #115 and #100.

## Acceptance Checks

- [ ] `nx test shared-table` passes; no `aggregateFn` on a column fixture
      anywhere in the file.
- [ ] `nx run shared-table:typecheck-spec` clean, all four types cases
      present.
- [ ] Both throws are covered — declaration and writer — and the
      index-bounds no-op is covered beside the writer throw.
- [ ] The `{ key: … }` → `{ columnId: … }` rename is pinned by a
      `@ts-expect-error`, not only by the passing form.

---

← [Step 6: The two-walks gate spec](step-6-engine-gate-spec.plan.md) | [Step 8: Stories and fixtures migrate](step-8-stories-and-fixtures.plan.md) →
