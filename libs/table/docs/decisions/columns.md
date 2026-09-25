---
title: Columns — decision history
type: decisions-log
capability: columns
date: 2026-09-25
audience: developers
---

# Columns — decision history

**Read this before changing anything about columns.** It is the complete list
of decisions taken about this capability, one line each, oldest first. The
contract itself — what columns do today — is
[`3-ui/directives/columns.md`](../3-ui/directives/columns.md).

This log **restates nothing**. Every row links to the record that holds the
rationale, the counter-arguments and the rejected alternatives. If a row needs
a second line, that second line belongs in the linked record.

**Numbering is this log's own (`COL1…COLn`) and is never reused from a source
folder.** Prefix `COL`, not `C` — `C` is left free for a possible future
`core.md` log covering the `ngpTable`/`ngpTableRow` store-connection layer,
which this log does not cover.

## Source keys

| Key | Record |
|---|---|
| **WS** | [`single-value-source/decisions.md`](../1-state/work/core/active/single-value-source/decisions.md) — the workspace log: the `createColumns()` grill, the conflict-audit rulings, `/to-tasks #130`, `/implement #131`, `/implement #139`, and the `/grill-with-docs` issue-141 ruling that created this file |
| **CA** | [`conflicts-vs-unshipped.md`](../1-state/work/core/active/single-value-source/conflicts-vs-unshipped.md) — the conflict audit the R1–R8 rulings were grilled against |
| **ADR25** | [ADR-0025](../adr/0025-schema-rule-functions-are-bare-named.md) — schema rule functions are bare-named |
| **ADR14** | [ADR-0014](../adr/0014-runtime-error-policy.md) — runtime error policy |
| **RC** | [`render-columns/1-decisions.md`](../1-state/work/columns/active/render-columns/1-decisions.md) — the `/grill-with-docs` #142 log |

## Decisions

| | Decision | Date | Status | Record |
|---|---|---|---|---|
| COL1 | `col(id, opts)` accepts `label`, `visible`, `accessor` only — `meta` is redundant with `metadata()`, `order` drops to the builder array's own position | 09-22 | shipped `9033e6e` (#130) | WS "N4" |
| COL2 | `ColumnSet` is a plain `{ columns, rules }` — no `data` reference, no `kind` discriminant; sharing one `ColumnSet` across two live tables is safe | 09-22 | shipped `9033e6e`/`918551f` (#130, #131) | WS "N1" |
| COL3 | The declared column-value map mechanism (`ColumnValues<TRow, TCols>`, `TableStore`'s phantom `__columnValues`) that `createColumns()` derives into — registered before this log existed, so it stays in grouping's log rather than being duplicated here | 09-21 | shipped `#125` | [grouping.md G73](grouping.md) |
| COL4 | `order` stays dropped from `col()`; runtime order becomes its own ordered `string[]` slice with referentially-stable definitions, not a per-column field — confirmed by an eight-library survey, none of which stores order as a writable per-column property | 09-22 | accepted, unbuilt — the ordered-id slice belongs to #128 | WS "N4 addendum", `discovery-column-order.md` |
| COL5 | Runtime-dynamic column ids (a config fetched from an API) are out of scope — declare the superset once and drive visibility with `visible()`/`visibleAsync()`; a reactive `columns` config is not possible today because `createTable`'s config is evaluated once, structurally, like `form()`'s single `rootCompile` | 09-22 | standing | WS "Runtime-dynamic column ids" |
| COL6 | Columns' own share of the library-wide `apply*` → bare-named rename: `visible`, `visibleAsync`. Grouping's and sorting's shares are ADR-0025's own capability rows, not duplicated here | 09-22 | shipped `ce13765` (#136) | ADR25, [grouping.md G74](grouping.md), [sorting.md SO25](sorting.md) |
| COL7 | `createTable` drops the array column intake outright, no compatibility window — `TableConfig.columns` becomes `ColumnSet<TRow, TCols>` only; no in-repo caller outside `libs/table/src` names it, so a deprecation window has no beneficiary | 09-22 | shipped `1704cfd` (#139) | WS "N3" |
| COL8 | `accessor` stays on `col()`; it does not move into the columns schema — the schema's recording form is typed `(path) => void`, a side effect with no type representation, so a registered accessor would make `ColumnValues` fall back to `TRow[id]`, exactly the case ADR-0024 exists to close | 09-22 | shipped `9033e6e` (#130) | WS "accessor stays on col()", `discovery-accessor-placement.md` |
| COL9 | `assertRuleColumnIdsAreKnown` and `assertMetadataKeysAreUnique` move into `createColumns`; `assertUniqueColumnIds` is added there too while staying on the write path; all three gate `ngDevMode` inside their own body, never at a call site | 09-22 | shipped `398d2c4` (#132) | WS "N2" |
| COL10 | Correction to G65/G66's Signal Forms comparison: its schema path also names a type-level slot (`keyof TModel`), the same cross-section shape as `ColumnsPath` — only its field tree names instances. The two-tier resolver rule itself stands, on G66's own inventory evidence, not the contrast | 09-22 | finding — recorded in grouping's log, not duplicated here | [grouping.md G75](grouping.md), `discovery-dynamic-field-schema.md` |
| COL11 | `setColumns()` takes a narrowed `{ id } & Partial<{ accessor, visible, label }>` — the same four fields `col()` takes; it cannot add a column and cannot write `order`/`meta` — structural, matching Angular Signal Forms having no add/remove-field API either | 09-22 | shipped `74e29a2` (#140) | WS "N6" |
| COL12 | `createColumns`'s row witness is typed `() => readonly TRow[] \| undefined`, not `TableDataInput<TRow>` — one inline union member covers a `WritableSignal`, a plain `Signal`, a resource's pre-load value, and a bare store method, with no conditional type | 09-22 | shipped `9033e6e` (#130) | WS "row witness" |
| COL13 | The `ColumnDecl` brand is a type-only, **required** `unique symbol` member, never assigned at runtime — settled against a nine-library survey; `createColumns` never needs to ask "is this mine?" of an `unknown` value | 09-22 | shipped `9033e6e` (#130) | WS "brand", `discovery-nominal-branding.md` |
| COL14 | `col()` does not bake the default accessor — `resolveColumnDefs` keeps resolving `def.accessor ?? ((row) => row[def.id])`, so a re-declared id still resolves against its new field | 09-22 | shipped | WS "default accessor" |
| COL15 | An empty column list (`createColumns(data, () => [])`) needs no guard — `ColumnIdIn<{}>` is already `never` and `resolveColumnDefs([])` returns `[]` | 09-22 | standing — nothing to build | WS "empty list" |
| COL16 | A declaration variant is re-minted through the builder, never spread — `col.from(decl, opts)` is the sanctioned way to vary one field of an existing declaration; `{ ...col('x'), id: 'y' }` widens `id` to `string` and no branding mechanism can catch it (verified: no shipped answer across nine surveyed libraries except Zod's reconstruct-not-brand pattern) | 09-22 | shipped `9033e6e` (#130); the widening is guarded by `create-columns.types.spec.ts`, not the type system | WS "col.from", `discovery-nominal-branding.md` |
| COL17 | The column-order slice is its own issue, #128 — this line of work drops only `col()`'s `order` option; `ColumnDef.order` keeps deriving from array index until #128 lands | 09-22 | open — tracked as #128 | WS "order slice" |
| COL18 | #129 ships before #100/S1 — one release without a per-column `sortFn` or `enableSorting` is accepted; no compile error catches it, both fields survive as permanently-`undefined` | 09-24 | accepted risk, standing until #100 ships | WS "R1", CA E1 |
| COL19 | `stateOf` ships without an order reader — whether the ordered-id slice (#128) gets a reader, and what it is called, is #128's to decide, not #117's | 09-24 | open — deferred to #128 | WS "R2", CA E4 |
| COL20 | The `*Of` reader-naming rule (`valueOf`/`criterionOf`/`stateOf`) is one added sentence in ADR-0025, not a separate ADR — the edit is #116's to make | 09-24 | owed to #116, not done here | WS "R3", CA E6 |
| COL21 | The N6 (COL11) column-order window ships with #129 and is accepted, documented — a `setColumns()` re-declare resets to declaration order until #128 lands; an app recovers by re-applying `reorderColumns(ids)` immediately after the write, which is the interim spelling #141 documents | 09-24 | shipped (ruling); verified by #141 Step 5 | WS "R4", CA E7 |
| COL22 | ADR-0020's opening citation is amended to point at ADR-0019's Amendment 2026-09-20 rather than the superseded path-vocabulary rule | 09-24 | shipped (docs edit) | WS "R5", CA E10 |
| COL23 | #100 joins #117's `blocked-by` list — #117's `stateOf` example already deferred one reader's spelling to #100, and COL18 (R1) pushes #100 later than #117's edge list implied | 09-24 | owed — the edit to #117's `blocked-by` field, made with the user's confirmation | WS "R6", CA |
| COL24 | Construction checks are dev-only, library-wide — ADR-0014 gains the amendment stating so, and the shared wrap moves into `schema/validate.ts`'s body | 09-24 | shipped `398d2c4` (#132) · ADR-0014's amendment lands with #141, uncommitted | ADR14 Amendment (2026-09-24), WS "R7" |
| COL25 | The G71 revisit this ruling obliged — grouping's construction-path throw becomes dev-only, its writer-path throw on `table.grouping` stays live in production — is grouping's own state, registered there, not duplicated here | 09-24 | shipped | [grouping.md G76](grouping.md) |
| COL26 | `createColumns` is data-first only (`createColumns(data, build, schema?)`); the builder-first form is dropped. The old curried `createColumns<TRow>()` form coexists only until #138 rewrites its fixture callers | 09-24 | shipped `918551f` (#131); superseded in spirit by COL34 (K0, the curried form itself) | WS "R9" |
| COL27 | `col.from(decl, { id: 'total' })` with an explicit `id` captures the literal; an omitted `id` widens the *type* to `string` while the runtime value still carries `decl`'s original id | 09-24 | shipped — probed in `create-columns.types.spec.ts` case 13 | WS "R10" |
| COL28 | Spreading a `ColumnDecl` and overriding `id` (`{ ...col('amount'), id: 'total' }`) widens `id` to `string` — ordinary TypeScript widening, confirming COL16's severity claim | 09-24 | shipped — probed in `create-columns.types.spec.ts` case 14 | WS "R11" |
| COL29 | `ColumnSet` needs no row-carrier phantom — `TRow` recovers cleanly off its own generic parameter, `ColumnSet<TRow, TCols>` | 09-24 | shipped — probed in `create-columns.types.spec.ts` case 11 | WS "R12" |
| COL30 | The `ColumnDecl` brand never leaks into `ColumnValues`'s keys — `keyof` of the value map is exactly the declared id union | 09-24 | shipped — probed in `create-columns.types.spec.ts` case 12 | WS "R13" |
| COL31 | `columnsSchema` is removed from `createTable` in #131, not #139 — the array column intake stays, rule-free, until #139; `TableConfig.columns` shipped as `TCols \| ColumnSet<...>` (shape 1, no generated-overload change needed) | 09-24 | shipped `918551f` (#131); narrowed further by COL34 (R17) | WS "R14" |
| COL32 | The 16 `createColumns()`-grill decisions (COL1–COL17) plus the rulings in this file go into this new `docs/decisions/columns.md`, not `core.md` and not distributed — `core.md` would ship empty, since none of them touch the `ngpTable`/`ngpTableRow` store-connection layer | 09-25 | shipped (this file) | WS "R15" |
| COL33 | #141's "column-order window documented" acceptance item becomes a verification that #140's own doc landed, not a fresh write by #141, since #140 blocks #141 | 09-25 | shipped (ruling); verification is #141 Step 5's own job | WS "R16" |
| COL34 | The columns compile step folds into the intake — `engine/columns-schema/resolve.ts` is deleted outright, not slimmed to a pass-through; `createTable` unpacks `config.columns` (a `ColumnSet`) directly; `isColumnSchema`/`resolveColumnsIntake` delete alongside it; `ColumnDefInput` survives as the engine's resolved-input shape | 09-24 | shipped `1704cfd` (#139) | WS "R17" |
| COL35 | The curried capture form, `createColumns<TRow>()([...])` — kept only so the `const` modifier applies to a hoisted literal, and named `createColumns` to match the barrel's `create*` prefix | ~09-21 | superseded by COL26 (R9) — data-first is the sanctioned call; the curried overload is explicitly marked "do not add new callers" (`api/create-columns.ts`) | WS "Questions settled while sequencing", K0 |
| COL36 | `TCols` lives on `TableConfig`, `TValues` lives on `TableStore` — the config takes the column declaration because that is what a call site can infer; the store carries the derived value map because that is what downstream code reads. Deriving at the config boundary keeps #113's id-union inference working for a plain array; a `TValues`-on-the-config shape has nothing to infer from, since TypeScript cannot infer `T` from a `keyof T` position | 09-21 | shipped | WS "Questions settled while sequencing", K0 |
| COL37 | `renderColumns` (#142) ships before #128 — its contract is "visible columns in render order" and never names `order`; the order read stays one internal engine line #128 retargets, and the story-host visible-column migration moves from #128 into #142 | 09-25 | accepted, unbuilt — #142 | RC "Q1" |
| COL38 | `renderColumns` returns `ColumnDef<TRow, ColumnIdIn<TValues>>[]`, not a new `RenderColumn` projection — revisit only when a cell directive needs `aria-colindex` | 09-25 | accepted, unbuilt — #142 | RC "Q2" |
| COL39 | `renderColumns` is an engine-claimed core member built in `createTableCore()` (pure selector in `engine/columns.ts`) — a feature declaring it throws (ADR-0007); column pinning/virtualization later gets a render-stage seam, not a member override | 09-25 | accepted, unbuilt — #142 | RC "Q3" |
| COL40 | Grouped-column disposition (hide / move-to-front) stays consumer-side, layered on `renderColumns()` — the library does not reshape the list for grouping | 09-25 | standing — nothing to build | RC "Q5" |
| COL41 | `FiltersPath<TRow, TValues>` re-keys filtering's path proxy from row field to declared column id, mirroring grouping's `GroupingPath` under ADR-0024 — `TValues` is **required**, no default; the one-argument form fails to compile rather than degrading every criterion to `unknown` | 09-25 | shipped (#115) | WS "V3", "K3" |
| COL42 | No `ColumnValuesOfSet<>` alias for the schema-as-its-own-variable spelling (`FiltersPath<Row, ColumnValues<Row, typeof set.columns>>`) — deferred until a second feature's standalone-schema form needs the same spelling | 09-25 | deferred | #115 Step 1 |
| COL43 | A filter whose column is removed by `setColumns()` after construction degrades at evaluation — same runtime, data-dependent classification as grouping's G72: that filter stops narrowing for the rest of the evaluation, reports once per key per evaluation, other filters unaffected | 09-25 | shipped (#115) | [grouping.md G72](grouping.md) |
| COL44 | `WithFilteringConfig<TRow, TValues, S>` gains a required `TValues` — public break; `withFiltering`'s own input widens to `Pick<TableStore<RowOf<In>, ColumnValuesOf<In>>, 'columns' \| 'rows'>` (`FilteringInput<In>`), mirroring `GroupingInput`, so the feature can resolve accessors and check declared ids at construction | 09-25 | shipped (#115) | WS "V3" |
| COL45 | `NgpTableDirective<TRow, TValues>` gains a second, defaulted generic (`TValues extends ColumnValueMap = ColumnValueMap`) — surfaced by #115: a story host composing a genuinely narrow `TableStore<TRow, TValues>` could not structurally bind into `[ngpTable]` typed only `TableStore<TRow>`, since `ColumnsUpdater`'s function-type parameter is invariant enough to fail both directions. Backward-compatible — every existing wide host is unaffected by the default | 09-25 | shipped (#115) | `directives/ngp-table.directive.ts` |

All dates are 2026.

## Still open

- **COL24** — the code half shipped in `398d2c4` (#132); the ADR-0014 amendment
  documenting it is written but uncommitted (#141's own Step 3); flip to a plain
  `shipped` once #141 lands.
- **COL17 / COL19** — the ordered-id slice, #128, including whether it gets a `stateOf` reader.
- **COL20 / COL23** — owed edits to #116 and #117 respectively.
- **COL4's caveat** — the order-slice O(rows × columns) cost is arithmetic over a verified
  code path, not a benchmark; #128 should settle it with a `vitest` bench.

## ADRs that constrain columns

[ADR-0024](../adr/0024-single-value-source-accessor.md) — the accessor is columns' single value
source · [ADR-0019](../adr/0019-columns-path-keyed-by-declared-column-ids.md) — `ColumnsPath` is
keyed from the declaring call · [ADR-0025](../adr/0025-schema-rule-functions-are-bare-named.md) —
schema rule functions are bare-named · [ADR-0014](../adr/0014-runtime-error-policy.md) —
construction throws, consumer callbacks degrade · [ADR-0021](../adr/0021-column-concerns-and-data-concerns-are-separate-surfaces.md)
— its capability test stands, its path-vocabulary rule superseded by ADR-0019/ADR-0024.

## Maintaining this log

Format contract: `~/.claude/conventions/doc-contracts/decisions-log.md`.

- A decision is registered here **before** its work folder moves to `archive/`.
  That rule is in [`libs/table/CLAUDE.md`](../../CLAUDE.md) and is what keeps
  this file true.
- Append with the next free `COL`-number. Never renumber, never reuse.
- Superseding a row means editing the old row's `Status` to point forward, not
  deleting it. The history is the point.
