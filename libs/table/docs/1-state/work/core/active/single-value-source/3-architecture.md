---
title: createColumns() — architecture
type: architecture
date: 2026-09-24
status: ready-for-slicing
ticket: https://github.com/DvirMon/ng-table/issues/129
---

# `createColumns()` — architecture

Companion to [`2-spec.md`](2-spec.md). The spec states the
contract in consumer terms and carries no paths; this file
grounds it against the source at HEAD and is consumed
immediately by `/to-tasks`.

Every path below is relative to `libs/table/`. Line numbers
were read at HEAD on 2026-09-24 and will drift — treat them
as pointers, and re-grep the symbol rather than trusting the
number.

---

## Settled — not open for relitigation

These come from `decisions.md`'s `### Settled` blocks. An
implementing session does not re-open them; a probe that
contradicts one is a finding to report, not a licence to
re-decide.

| | Decision | Record |
|---|---|---|
| 1 | `col(id, opts)` takes `label`, `visible`, `accessor`; `meta` and `order` drop | N4 |
| 2 | `ColumnSet` is `{ columns, rules }` — no `data`, no `kind` | N1 |
| 3 | Runtime order is its own slice (#128), not a column field | N4 addendum |
| 4 | Runtime-born column ids are out of scope (#127) | grill |
| 5 | `apply` prefix stripped from ten schema rules, library-wide | ADR-0025 |
| 6 | `createTable` drops the array intake outright, no window | N3 |
| 7 | `accessor` stays on `col()`, not in the schema | grill |
| 8 | Rule-id + metadata-key checks move into `createColumns`; duplicate-id is added there and stays on the write path; all three dev-gated | N2 |
| 9 | The Signal-Forms contrast behind the two-tier resolver rule is corrected; the rule stands | G75 |
| 10 | `setColumns` takes `{ id } & Partial<{ accessor, visible, label }>` | N6 |
| 11 | Row witness is `() => readonly TRow[] \| undefined` | grill |
| 12 | `ColumnDecl` brand is a type-only `unique symbol`, **required** member | grill |
| 13 | `col()` does not bake the default accessor | grill |
| 14 | An empty column list needs no guard | grill |
| 15 | A variant is re-minted via `col.from`, never spread | grill |
| 16 | `col()`'s `order` option drops; `ColumnDef.order` waits for #128 | grill |
| R1 | #129 ships before #100/S1; one release without per-column `sortFn`/`enableSorting` | 2026-09-24 |
| R4 | N6 ships with #129; the column-order window is documented | 2026-09-24 |
| R7 | The `ngDevMode` wrap goes in the shared body, not per call site | 2026-09-24 |
| R8 | Grouping's **writer**-path throw stays live in production | 2026-09-24 |
| E12 | `assertDeclarationsAreKnown`'s message stops naming the `columns` array | 2026-09-24 |

---

## Current source — what exists today

### The declaration surface

**`src/api/create-columns.ts`** — 24 lines, one export. The
curried capture shipped by #125:

```ts
export function createColumns<TRow>() {
  return <const TCols extends readonly ColumnDefInput<TRow, string>[]>(
    columns: TCols,
  ): TCols => columns;          // :20-23
}
```

It is an identity function whose only job is the `const`
capture. **This whole file is replaced.** Three in-repo
callers reference it: `api/create-columns.types.spec.ts:42`
and `api/create-table.types.spec.ts:74` (plus prose mentions
in both files' comments).

**`src/api/types.ts`** — the types this ticket retypes:

| Symbol | Line | Change |
|---|---|---|
| `TableDataInput<TRow> = WritableSignal<TRow[]>` | `:13` | unchanged; `createColumns` does **not** reuse it (decision 11) |
| `ColumnDef<TRow, TId>` | `:83-98` | unchanged by this ticket. Keeps `order` (`:87`) until #128, and keeps `sortFn`/`enableSorting` (`:91-92`) until #100 |
| `ColumnDefInput<TRow, TId>` | `:106-110` | stays as the **resolved-input** shape the engine folds; no longer the consumer declaration surface |
| `ColumnValueMap` | `:113` | unchanged |
| `ColumnIdIn<TValues>` | `:117` | unchanged |
| `ColumnValues<TRow, TCols>` | `:122-131` | retargeted from `ColumnDefInput` elements to `ColumnDecl` elements; the two derivation arms are unchanged |
| `TableConfig<TRow, TCols>` | `:173-184` | `columns` becomes `ColumnSet`; `columnsSchema` (`:179-181`) is **deleted** |
| `ColumnsUpdater<TRow, TId>` | `:190-192` | unchanged |
| `TableStore<TRow, TValues>` | `:210-239` | unchanged; `__columnValues` phantom at `:238` |

`ColumnValues`'s two arms today (`:126-131`) — the accessor
arm and the `TRow[C['id']]` fallback — are exactly what
decision 13 keeps working: the builder supplies `V` in the
type parameter, so the runtime default accessor staying in
`resolveColumnDefs` costs nothing.

**`src/api/create-table.ts:45-48`** — the intake:

```ts
const { columns, rules } = resolveColumnsConfig(
  [...config.columns],
  config.columnsSchema,
);
```

The spread at `:46` exists because `config.columns` is
readonly and `resolveColumnsConfig` wants a mutable array.
After this ticket the two arguments come off one `ColumnSet`.
The comment block at `:40-44` describes the deleted shape and
goes with it. `config` evaluated once (`:25`, and the
`resolveColumnsConfig` call itself) is the reason #127 is
blocked on `createTable`, not on `createColumns`.

### Compile phase

**`src/engine/columns-schema/resolve.ts`** — 78 lines:

- `isColumnSchema` (`:13-17`) — narrows
  `ColumnsSchemaFn | ColumnSchema` on `value.kind ===
  'column-schema'`. Decision 2's precedent: one non-test
  reader, and a `typeof value === 'object'` test already
  separates a function from an object.
- `assertRuleColumnIdsAreKnown` (`:19-28`) — **moves into
  `createColumns`** (decision 8). It is a thin adapter over
  the shared body, passing the literal label `'columnsSchema'`
  (`:26`) — a label this ticket makes wrong.
- `assertMetadataKeysAreUnique` (`:37-52`) — **moves into
  `createColumns`**. Exempts `VISIBLE` (`:41`), the one
  deliberate multi-writer key. Its message hardcodes
  `[columnsSchema]` (`:45`).
- `resolveColumnsConfig` (`:65-78`) — **consumes a
  `ColumnSet`.** Plain, synchronous, no signal (which is what
  #127's option B would have to change). Once both asserts
  move out, what is left is the `isColumnSchema` narrowing
  and a pass-through — the function may collapse to almost
  nothing, or absorb the set-unpacking instead. That is a
  shaping call for the implementing session, not a decision.

**`src/schema/validate.ts`** — 22 lines, one export,
`assertDeclarationsAreKnown(declaredIds, knownIds, label)`
(`:8-22`). Two edits, both from the 2026-09-24 rulings:

1. **R7 — the `ngDevMode` gate wraps this body**, here, once,
   not at each call site. `ngDevMode` is not ambient under
   `tsconfig.lib.json`'s `"types": []`; the established
   spelling is the module-scoped `declare const ngDevMode:
   boolean | undefined;` at `engine/columns.ts:18` with the
   `typeof ngDevMode === 'undefined' || ngDevMode` test at
   `:50`. Copy that spelling; do not add an ambient type.
2. **E12 — the message.** `:17-18` currently reads
   `` `no column with this id exists in the \`columns\`
   array.` `` There is no `columns` array after this ticket.
   The `label` parameter names the declaring surface, so no
   call site fixes it.

Callers of the shared body today: `resolve.ts:23` only (the
grouping/filtering/sorting callers named in its doc comment
at `:5-6` are prospective — re-grep before assuming).
**R8 consequence, as shipped (#132):** grouping's construction
and writer throws shared this one body, so "the writer throw
lives elsewhere" was false at HEAD — the split had to be made
structural first. `schema/validate.ts` now exports two
functions: a dev-gated `assertDeclarationsAreKnown`
(construction) and an ungated `assertWrittenIdsAreKnown`
(writer), and grouping's writer calls the latter directly.

### Runtime write path

**`src/mutations/update-columns.ts`** — three updater
factories:

- `setColumns<TRow, TId>(defs: ColumnDefInput<TRow, TId>[])`
  (`:14-18`) — **narrows to `{ id } & Partial<{ accessor,
  visible, label }>`** (decision 10). Keeps calling
  `resolveColumnDefs` (`:17`), which keeps the duplicate-id
  check on this path (decision 8).
- `reorderColumns` (`:21-25`) — untouched. **This is R4's
  documented interim re-apply**: after a `setColumns` write,
  the caller re-applies `reorderColumns(ids)`.
- `toggleColumnVisibility` (`:28-32`) — untouched.

The file header comment (`:8-11`) explains the `TId`
re-assertion; it stays true under the narrowed input.

**`src/engine/columns.ts`:**

- `assertUniqueColumnIds` (`:27-37`) — already dev-gated at
  `:50`, message prefixed `[createTable]` (`:32`). Decision 8
  gives it a `label` parameter, because it now fires from
  `createColumns` too.
- `resolveColumnDefs` (`:48-62`) — keeps
  `def.accessor ?? ((row) => …row[def.id])` (`:56-57`),
  which is decision 13. `order: def.order ?? index` (`:59`)
  **loses its left operand only when #128 lands**; this
  ticket leaves the expression alone, since `ColumnDef.order`
  survives.
- `applyColumnOrder` (`:65-74`), `setColumnVisible`
  (`:77-…`), `toggleColumnVisible` (`:88-…`) — untouched.
- `VISIBLE` (`:104`) and `SORT_NULLS` (`:113`) — the two
  engine-owned meta keys. `VISIBLE`'s multi-writer exemption
  is asserted in `foldColumnRules` (`:163-170`).
- `foldColumnRules` (`:143-…`) — rebuilds `meta` from the
  rule registry and spreads it over the column, replacing a
  declared map wholesale. That is decision 1's "redundant,
  and live" argument. **After `meta` drops from the
  declaration, the silent-replace path is closed by
  construction** — the fold itself needs no change.

### Schema and rules (the ADR-0025 rename)

| Current export | New name | File |
|---|---|---|
| `applyVisible` | `visible` | `columns-schema/rules.ts:15` |
| `applyVisibleAsync` | `visibleAsync` | `columns-schema/rules.ts:38` |
| `applySortNulls` | `sortNulls` | `columns-schema/rules.ts:58` |
| `applyGrouping` | `grouping` | `api/features/with-grouping/schema.ts` |
| `applyGroupingAsync` | `groupingAsync` | same |
| `applyGroupKey` | `groupKey` | same |
| `applyGroupOrder` | `groupOrder` | same |
| `applyAggregate` | `aggregate` | same |
| `applySortFn` | `sortFn` | unshipped (#100) |
| `applySortable` | `sortable` | unshipped (#100) |

Barrel sites: `src/index.ts:71` (the three columns rules),
`:73` (metadata), and the grouping block re-exporting the
five grouping rules. `applyColumnOrder`
(`engine/columns.ts:65`) **keeps its name** — it is an
internal pure transform, not a schema rule, and ADR-0025
says so explicitly so the next reader does not file it as an
oversight.

### Types the new surface must fit

- `ColumnsSchemaFn<TRow, TId>` —
  `columns-schema/types.ts:29-32`. The **recording** form,
  returning `void`. That return type is decision 7's whole
  argument: a side effect has no type representation, so an
  accessor registered there cannot reach `ColumnValues`.
- `ColumnsPath<TRow, TId, TRule>` — `:19-21`.
- `ColumnSchema<TRow>` — `:34-…`, carrying `kind:
  'column-schema'`. Stays; decision 2 only declines to add a
  *second* discriminant on `ColumnSet`.
- `ColumnRule<TRow> = MetadataRule | MetadataAsyncRule` —
  `:84`. This is what `ColumnSet.rules` holds.
- `ColumnRuleContext<TRow>` — `:9-11`, the untyped
  `columns: () => ColumnDef<TRow>[]` lookup. Not this
  ticket's to replace (#117's `stateOf` does), noted so it is
  not mistaken for dead surface.
- `ColumnValuesOf<S>` — `engine/types.ts:120-127`, recovering
  the map off `__columnValues`. `ColumnIdOf<S>` — `:114-…`.
  Both unchanged; neither is exported from `index.ts`, by a
  decision already recorded.

### Generated overloads

`src/api/create-table.overloads.ts` — generated by
`tools/generate-overloads.ts`, checked by
`npm run table:overloads:check`. Sixteen signatures, arity
0-15. Each one carries:

```ts
<TRow, TCols extends readonly ColumnDefInput<TRow, string>[]>(
  data: TableDataInput<TRow>,
  config: TableConfig<TRow, TCols>,
  …
): TableStore<TRow, ColumnValues<TRow, TCols>> & …
```

**Only the `TCols` constraint changes** — from
`readonly ColumnDefInput<TRow, string>[]` to the declaration
element type. `TableDataInput` on `data` stays (decision 11
is about `createColumns`'s witness, not `createTable`'s
data argument). Never hand-edit the generated file: change
`tools/generate-overloads.ts` and run
`npm run table:overloads`.

`compose-features.overloads.ts` needs no change — settled
earlier in `decisions.md`; it carries the union structurally.

---

## New types to author

Home: `src/api/create-columns.ts` for the builder and the
call; `src/api/types.ts` for anything `TableConfig` or the
overload generator must name. Splitting the declaration types
into their own file is a shaping call, but the existing
convention is that `api/types.ts` holds the public type
surface and `api/create-columns.ts` holds the factory.

```ts
// The brand: type-only, unique symbol, REQUIRED member
// (decision 12). Never assigned at runtime.
declare const COLUMN_DECL: unique symbol;

interface ColumnDecl<TRow, K extends string, V> {
  readonly [COLUMN_DECL]: true;     // required, not optional
  readonly id: K;
  readonly label?: string;
  readonly visible?: boolean;
  readonly accessor?: (row: TRow) => V;
}

interface Presentation {
  readonly label?: string;
  readonly visible?: boolean;
}

interface ColumnBuilder<TRow> {
  <K extends string, V>(
    id: K,
    opts: Presentation & { accessor: (row: TRow) => V },
  ): ColumnDecl<TRow, K, V>;
  <K extends string>(
    id: K,
    opts?: Presentation,
  ): ColumnDecl<
    TRow, K, K extends keyof TRow ? TRow[K] : unknown
  >;
  from<K extends string, V>(
    decl: ColumnDecl<TRow, string, unknown>,
    opts: Presentation & {
      id?: K;
      accessor?: (row: TRow) => V;
    },
  ): ColumnDecl<TRow, K, V>;
}

interface ColumnSet<
  TRow,
  TCols extends readonly ColumnDecl<TRow, string, unknown>[],
> {
  readonly columns: TCols;
  readonly rules: readonly ColumnRule<TRow>[];
  readonly __row?: TRow;   // only if TRow is otherwise
                           // unrecoverable — check first
}
```

Two shaping questions the session settles by probe, not by
decision: whether `col.from`'s signature above captures the
new `id` literal (it must — that is the whole point of
decision 15, and it is the case the types spec settles), and
whether `ColumnSet` needs a row carrier at all or recovers
`TRow` off `TCols`. Prefer the simplest form that passes the
probes.

The design brief's `AnyDecl<TRow>` and `ValuesOf<TCols>` are
placeholder names from the probe; align them with the shipped
vocabulary (`ColumnValues`, `ColumnIdIn`) rather than
introducing a parallel set.

---

## File layout for the implementing session

| File | Change |
|---|---|
| `src/api/create-columns.ts` | **Rewrite.** Two overloads, `ColumnBuilder`, `col.from`, the brand, `ColumnSet`; the three construction checks called from here |
| `src/api/types.ts` | `TableConfig.columns` → `ColumnSet`; delete `columnsSchema` (`:179-181`); retarget `ColumnValues`'s element constraint (`:122-131`); keep `ColumnDefInput` as the resolved-input shape |
| `src/api/create-table.ts` | Intake at `:45-48` — unpack a `ColumnSet`; drop the readonly spread and the stale comment at `:40-44` |
| `src/api/create-table.overloads.ts` | **Regenerate only.** `npm run table:overloads` |
| `tools/generate-overloads.ts` | The `TCols` constraint string, one place |
| `src/engine/columns-schema/resolve.ts` | Move `assertRuleColumnIdsAreKnown` (`:19-28`) and `assertMetadataKeysAreUnique` (`:37-52`) out; `resolveColumnsConfig` (`:65-78`) consumes a `ColumnSet` |
| `src/schema/validate.ts` | R7's `ngDevMode` wrap around the body; E12's message edit (`:17-18`) |
| `src/engine/columns.ts` | `assertUniqueColumnIds` (`:27-37`) gains a `label` parameter. `resolveColumnDefs`'s accessor default (`:56-57`) and `order` default (`:59`) stay |
| `src/mutations/update-columns.ts` | `setColumns` (`:14-18`) narrows its input |
| `src/columns-schema/rules.ts` | Rename three exports (`:15`, `:38`, `:58`) |
| `src/api/features/with-grouping/schema.ts` | Rename five exports |
| `src/index.ts` | Barrel: renamed rules at `:71` and in the grouping block; new `ColumnDecl`/`ColumnSet`/`ColumnBuilder` type exports; `create-columns` re-export at `:5` already wildcards |
| `src/api/create-columns.spec.ts` | **New.** Runtime seam — set shape, three checks, `col.from`, empty list, both call forms |
| `src/api/create-columns.types.spec.ts` | **Rewrite** against the new call; add the brand-rejection and spread-widening cases |
| `src/api/create-table.types.spec.ts` | Rewrite the carriage cases against the new call |
| `src/api/create-table.spec.ts` | Column fixtures and every construction |
| `src/mutations/update-columns.spec.ts` | Narrowed-input cases |
| `libs/table/CLAUDE.md` | Record the "`Feature<In, Out>` stays callable" invariant the design rests on; update the `api/create-columns.ts` and `columns-schema/` rows |
| `libs/table/docs/adr/0019-*.md` | Amendment: `ColumnsPath` is keyed from `createColumns`, not `TableConfig`; consequence 1 becomes a structural guarantee |
| `libs/table/docs/decisions/*.md` | Rows for the sixteen decisions + R1/R4/R7/E12 — **see "Where the rows go" below** |
| `libs/table/docs/1-state/features/*.md`, `docs/2-columns/reference/*` | Snippets naming the renamed rules; R4's `reorderColumns` re-apply documented |
| `llms.txt` | Regenerate — `npm run llms`; `npm run llms:check` must stay clean |

---

## Migration inventory — verified at HEAD

#129's "Still open, for the spec" gives five counts. Measured
against the working tree on 2026-09-24; **three are corrected.**

| Claim on #129 | Measured | Verdict |
|---|---|---|
| 5 inline `columns: [` | **5 occurrences in 3 files** — `api/features/with-sorting.spec.ts`, `engine/core.spec.ts`, `mutations/optimistic-mutations.spec.ts` | ✅ accurate |
| ~20 spec factories returning `ColumnDef<Row>[]` | **34** sites annotated `: ColumnDef<X>[]` across `*.spec.ts` + `*.mock.ts`; **18** spec files call `createTable()` | ⚠️ **corrected — the annotation count is ~34, not ~20**. The "~20" is closer to the file count than the site count |
| 5 story fixtures | **5** — `src/stories/{composition,filtering,grouping,row-edit,selection}/fixtures/schema.ts` | ✅ accurate |
| every story host | **25** `*-story-host.component.ts`, **all 25** call `createTable()` | ✅ accurate; the number is 25 |
| both `*.types.spec.ts` | **5** `*.types.spec.ts` exist; **4** call `createTable()`: `api/create-columns.types.spec.ts`, `api/create-table.types.spec.ts`, `api/features/with-filtering/feature.types.spec.ts`, `api/features/with-grouping/feature.types.spec.ts`. `api/types.types.spec.ts` does not | ⚠️ **corrected — four type specs are in the blast radius, not two.** The two feature ones were not counted on the issue |
| generated overloads change only in the `TCols` constraint | Confirmed — `create-table.overloads.ts:20`, `:25`, and the same line in each of the sixteen signatures | ✅ accurate |

**Total `createTable()` call sites: 57 files.** That is the
real migration surface: 18 spec files + 25 story hosts + the
remainder (fixtures, mocks, composition specs).

**Separate blast radius, same ticket: the ADR-0025 rename.**
**37 files** in `src/` name at least one of the eight shipped
`apply*` rules. That is larger than the column-declaration
migration and lands in the same PR, per ADR-0025's
"one pass" scope. Docs and `apps/site` prose are additional
and were not counted here.

**`apps/site` calls `createTable()` zero times** — it names
it only in prose. That is the evidence behind decision 6 (no
compatibility window), re-checked.

---

## Open questions

1. **Does `col.from` capture the overridden `id` literal?**
   Decision 15 assumes it does, because the builder's `K` is
   a primitive-constrained type parameter at that call. Not
   probed. The types spec settles it. If it does not, the
   sanctioned-variant API still stands on the stated-rule
   argument, but the severity claim needs correcting.
   **Answered — see decisions.md R10.** An explicit `id`
   override captures the literal; an omitted one widens to
   `string`. No correction to decision 15.
2. **Does `{ ...col('x'), id: 'y' }` actually widen?**
   Reasoned from TypeScript's rules, not probed. Same spec
   case settles it. Called out on #129's own acceptance list.
   **Answered — see decisions.md R11.** Yes, it widens to
   `string`. No correction to decision 15.
3. **Does `ColumnSet` need a row carrier?** If `TRow` is
   recoverable off `TCols`, drop the phantom. Prefer the
   simplest signature that passes the probes.
   **Answered — see decisions.md R12.** No — `TRow` recovers
   directly off `ColumnSet<TRow, TCols>`'s own generic
   parameter. No phantom added.
4. **What does `resolveColumnsConfig` become** once both
   asserts move out? It may collapse into the `createTable`
   intake, or absorb set-unpacking. Shaping, not a decision.
5. **Where do the decision rows go?** See below — this is
   the one that blocks archiving, not implementation.
6. **Does the brand survive `Readonly`/`Pick` in the value
   map derivation?** `ColumnValues` maps over `TCols[number]`
   with an `as` key remap; the brand member rides along. Verify
   it does not leak into any public read.
   **Answered — see decisions.md R13.** No leak — `keyof` of
   the value map is the declared id union only.
7. **Deferred, recorded, not this ticket:** a rule applied to
   every column — the "one schema standing for every key"
   shape the comparable framework has and this library does
   not. Noted while settling decision 10.

---

## Where the rows go

`state.json`'s `capabilityLogPath` is
`libs/table/docs/decisions/grouping.md`. **That is the
grouping log, and this is core/columns work.** There is no
`docs/decisions/core.md` or `columns.md`. Three of these
decisions already have grouping rows because they touch
grouping (`G73`–`G76`), and the rename has rows owed in both
`grouping.md` and `sorting.md` per ADR-0025 — but the
column-declaration decisions themselves have no home.

`libs/table/CLAUDE.md`'s rule is explicit: **a work folder
may not move to `archive/` until every decision in it is
registered in its capability's log.** So either a
core/columns log is created (and `capabilityLogPath` points
at it), or the rows are distributed across the existing logs
by capability. That is a call for the user, not for this
document — **no rows were added to `grouping.md` by this
spec or this architecture doc.**

---

## Acceptance gates

- `nx run shared-table:typecheck` clean, **run twice** —
  `ngc` aborts at the first `.ts` error before reaching the
  template phase, so only a source-clean second run says
  anything about the 25 story hosts.
- `nx run shared-table:typecheck-spec` clean. **This is the
  only thing that enforces a `*.types.spec.ts`** — the vitest
  runner executes `expectTypeOf` and `@ts-expect-error`
  without checking either, so a green `nx test` proves
  nothing about one.
- `npm run table:overloads:check` clean (regenerated, not
  hand-edited).
- `npm run llms:check` clean.
- The four compile-time proofs on #129's acceptance list:
  brand rejects a hand-written literal; the spread case;
  the value map's two arms; a typo'd id rejected through
  `createTable` and a composed feature slot.
