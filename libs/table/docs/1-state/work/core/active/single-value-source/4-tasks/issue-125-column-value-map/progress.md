# Implementation Progress — the declared column-value map reaches a feature's schema

**Issue:** [#125](https://github.com/DvirMon/ng-table/issues/125)
**Status:** 6 / 6 complete

| Step | Title                                                    | Status  | PR  |
| ---- | -------------------------------------------------------- | ------- | --- |
| 1    | `ColumnValues<>` and the `createColumns()` capture point | ✅ done | —   |
| 2    | The capture guard                                        | ✅ done | —   |
| 3    | The store shape carries the map                          | ✅ done | —   |
| 4    | The generator carries the map into every slot            | ✅ done | —   |
| 5    | The end-to-end guard                                     | ✅ done | —   |
| 6    | Record the decision                                      | ✅ done | —   |

Steps 3 and 4 each required fallout fixes beyond their own `Files` lists to
keep `nx run shared-table:typecheck`/`typecheck-spec` clean — neither step's
plan anticipated every non-generated two-argument `TableStore<TRow, TId>` /
`TableConfig<TRow, TId>` reference in the repo. See "Deviations from the
plan" below; Step 6 should fold these into the decisions log.

## Code review (Standards + Spec axes)

Run via `/code-review` against `edfed85` (last commit on `main`) after all six
steps landed. Two findings led to further edits, both since resolved:

- **Spec axis: the `source-docs` skill (run as part of this skill's §4 Verify)
  rewrote comments beyond every step's stated scope, in some cases dropping
  citations** — ADR-0019 (`ColumnIdOf`'s fallback comment), ADR-0011/ADR-0022
  (`RenderRow.cells`), ADR-0012 (`expandedRows`), ADR-0004/R50 (`index.ts`'s
  barrel-history comment), the `@ngrx/signals` migration note
  (`engine/slots.ts`'s `SlotRegistry` comment), and a `Precedent:
FilterRule.__criterion / __row` citation on both new `__columnValues`
  phantom comments (`api/types.ts`, `engine/types.ts`) — the exact citation
  that shows the phantom isn't a novel pattern. It also touched
  `generate-overloads.ts` inside the region Step 4's own Non-Goals named as
  off-limits (`ARITY`, `contributions`, `renderSlotInput`, `renderReturn`,
  `renderSignature`), converting JSDoc to line comments and dropping the
  "D27" reference there too. All of this was reverted to original wording;
  the only surviving diff in every affected file is each step's own,
  intended content change. `nx run shared-table:typecheck`/`typecheck-spec`
  (×2 each), `npm run table:overloads:check`, `npm run llms:check`, and
  `nx test shared-table` (894 passed, 1 todo, 45 files) all re-verified
  clean afterward.
- **Standards axis: `TableStore.__columnValues` / `TableCore.__columnValues`
  are double-underscore-prefixed members on public store interfaces**,
  which `libs/table/CLAUDE.md`'s "No private store members" rule reads as
  banned on its face — "There is no `_`-prefix convention... If a future
  feature genuinely needs a private _store_ member, reintroduce
  `OmitPrivate`." Step 3's plan directed this exact shape, citing
  `FilterRule.__criterion`/`__row` (`engine/filters/types.ts:61-73`) as
  precedent — a type-only inference channel, never assigned at runtime,
  distinct in kind from the runtime engine state (`Subject`s, unread
  signals) the CLAUDE.md rule was written against. That precedent is real
  and predates #125. **Not resolved here** — this is a planning-level
  question (does the "no private members" rule need an explicit phantom-
  inference-channel exception, matching what `FilterRule` already does) that
  a single implementation step shouldn't decide unilaterally. Flagged to the
  user in the `/implement` hand-off; worth a CLAUDE.md clarification or an
  ADR if the maintainer wants it formalized.

## Graph

```
1 ──┬──► 2
    └──► 3 ──► 4 ──► 5 ──► 6
```

Parallel-safe: [2, 3] after 1. Dependency: 1 → 3 → 4 → 5 → 6.

Step 2 asserts `ColumnValues` and `createColumns` directly and never calls
`createTable()`, so it shares no artifact with the plumbing chain — it can
be written and reviewed while Steps 3 and 4 are in flight. Steps 3 → 4 →
5 → 6 are a true chain: the generator emits types Step 3 declares, the
guard cannot assert off a store until Step 4 regenerates the overloads,
and the record is written from what the guard proved.

## Deviations from the plan

Both Step 3 and Step 4 declared "no feature config changes" / a fixed
`Files` list, but neither survives contact with the full repo typecheck in
isolation — each left the tree red until these were also touched:

- **`engine/slots.ts`** — `CORE_MEMBER_KEYS`'s exhaustiveness check
  (`exhaustiveCoreMemberKeys([...])`) collapses to `never` the moment
  `TableStore` gains a new key, and Step 3 added `__columnValues`. Added
  it to the list, same treatment as every other core member.
- **`with-sorting.ts`, `with-grouping/feature.ts`** — both had a
  non-generated, two-argument `TableStore<TRow, TId>` / `Pick<TableStore<...>,
...>` reference (`SortingInput<In>`, `GroupingInput<In>`,
  `buildSortingSpec`, `buildGroupingSpec`) that Step 3's own plan missed —
  it named only `create-table.spec.ts`'s `withReversibleSort` probe as "the
  one" such reference. First attempt wrapped the recovered id union as
  `Record<TId, unknown>` to satisfy the new `ColumnValueMap` constraint;
  that compiled in isolation but **circularly self-referenced** under each
  feature's F-bounded `In extends SortingInput<In>` /
  `In extends GroupingInput<In>`, because the extra `keyof Record<...>`
  indirection couldn't resolve against `In`'s own `columns` field. Fixed by
  using `ColumnValuesOf<In>` (Step 3's own recovery type) directly instead
  — no wrapping, no circularity, and it's arguably the more correct
  reading of "recover the value map off the accumulating store" than the
  `Record` workaround was.
- **`api/create-table.ts`** — `config.columns` is now `TCols` (readonly,
  per the capture point), but `resolveColumnsConfig()` still wants a
  mutable array. Spread at the call site (`[...config.columns]`) rather
  than widen `resolveColumnsConfig`'s signature, which Step 4's Files list
  didn't include.
- **`wire-columns-schema.spec.ts`** — a local `makeStore<TId extends
string>(cfg: TableConfig<Row, TId>): TableStore<Row, TId>` test helper,
  same shape as the `create-table.spec.ts` probe Step 3 already fixed, but
  in a file neither step named. Re-keyed to `TCols` → `ColumnValues<Row,
TCols>`, same pattern.
- **`with-tree.spec.ts`, `with-grouping/feature.spec.ts`** — two local test
  helpers (`setup()`) carried an explicit `TableStore<Row, 'region' |
'category'>` / `TableStore<Row, MockColumnId>` return-type annotation
  naming the id union directly. Dropped the annotation; inferring off the
  `createTable()` call inside carries the same literal ids with no
  re-spelling needed.
- **`with-row-edit.spec.ts`** — one `createTable(signal(makeRows()), ...)`
  call inferred `TRow` as `{ id: any }` instead of `Row` under the new
  stricter `TCols extends readonly ColumnDefInput<TRow, string>[]`
  constraint (an identical sibling call two tests above it, using a
  hoisted `const data = signal(makeRows())` instead of an inline call
  expression, inferred correctly). Hoisted `data` to match the working
  sibling rather than chase the inference-order root cause — narrow,
  local, test-only.

None of these change any feature's public config surface or runtime
behavior; every fix is either type-only plumbing or a test-file
re-spelling. Full verification after all fixes: `nx run
shared-table:typecheck` clean ×2, `nx run shared-table:typecheck-spec`
clean ×2, `npm run table:overloads:check` clean, `nx test shared-table` —
45 files / 890 passed / 1 todo.

## Gate

Step 5 is what [#115](https://github.com/DvirMon/ng-table/issues/115),
[#100](https://github.com/DvirMon/ng-table/issues/100) and the grouping
retrofit wait on — not Step 4. The map reaching a slot is not the same as
the map being proven to resolve, and the failure mode in between is
silent: a map that degraded to an index signature still compiles at every
call site and every downstream schema still typechecks, keyed by
`string`. Same shape as [#113](https://github.com/DvirMon/ng-table/issues/113)'s
own gate, one step further along the same channel.
