# ADR-0019 — `ColumnsPath` is keyed by declared column ids, not row keys

**Status:** accepted 2026-09-18, **amended 2026-09-18** — decision core stands, mechanism and
motivation narrowed (see [Amendment](#amendment-2026-09-18--scope-narrowed-to-the-column-schema-fn)).
**Related:** [ADR-0004](0004-table-source-layout.md) (layout by contract boundary), [ADR-0010](0010-no-angular-lifecycle-names-on-engine-concepts.md) (columns-schema is an internal step). Affected surface: `schema/column-schema.types.ts`, every `apply*` rule that takes a `ColumnHandle`.

**Scope note:** this ADR owns one decision — how `ColumnsPath` is keyed. The `WithGroupingConfig`
reshape that motivated it is one feature's config and lives in
[`../1-state/work/grouping/active/grouping-config-simplification/`](../1-state/work/grouping/active/grouping-config-simplification/1-plan-config-simplification.md),
not here.

## Amendment 2026-09-18 — scope narrowed to the column schema fn

**Read this before acting on anything below it.** Grouping — the consumer that motivated this
ADR — no longer uses `ColumnsPath` at all. Per D7 in
[`../1-state/work/grouping/active/grouping-config-simplification/2-decisions.md`](../1-state/work/grouping/active/grouping-config-simplification/2-decisions.md),
a schema fn declared on a **feature's** config is keyed by the row model (`keyof TRow`), not by
declared column ids. Only a schema fn declared on `TableConfig` names columns.

**What still stands.** Key `ColumnsPath` by the literal ids declared in `TableConfig.columns`.
`columnsSchema` and `columns` sit on the same `TableConfig` object, so `TId` flows within one
argument. This keeps `applyVisible`, `applySortNulls` and `metadata()` able to name a derived
column and rejects a path segment that was never declared — the blind spot this ADR exists to
close.

**What is retracted.**

- **`ColumnIdOf<S>` and cross-argument recovery.** Recovering `TId` structurally from the store
  shape, the way `RowOf<S>` does, existed solely so a *feature's* schema fn — declared on a
  different argument than `columns` — could see the id union. No feature schema names columns any
  more, so the recovery has no consumer. `ColumnIdOf<S>` and `TId` on `TableStore`/`TableCore`
  revert, and `create-table.overloads.ts` reverts with them.
- **The inference-order spike under [Open](#open).** It tested exactly that cross-argument path.
  Moot, not failed — it is recorded as resolved and needs no re-running.
- **"Unblocks removing a feature's free-string rules array."** That unblock was grouping's, and
  grouping took a different route. Nothing in this ADR now speaks to feature-level rule arrays.
- **Grouping as evidence in [Alternatives](#alternatives-considered).** The case rests on
  `applyVisible` and `metadata()` alone, which is a thinner case than when written — knowingly
  accepted rather than re-litigated.

**The general rule this became** — a schema fn on `TableConfig` names columns; a schema fn on a
feature's config names row fields — is cross-cutting and belongs in its own ADR, not here.

`ColumnsPath<TRow, TRule>` is a mapped type over `Extract<keyof TRow, string>`. A column whose id
is not a row key — a derived column declared `{ id: 'fullName', accessor: r => r.first + ' ' +
r.last }`, which `ColumnId<TRow>` explicitly keeps expressible — cannot be named from any schema
fn. Not from `applyVisible`, not from `applySortNulls`, not from `metadata()`. (As written this
also named `applyGrouping`; grouping has since left this path — see the Amendment.)

The gap is **type-level only**. `buildColumnsPath`'s `get` trap already fabricates a handle for
any string property (`schema/column-schema.ts`), and the consuming feature already validates
every recorded `columnId` against its resolved `columns` at construction.

**Decision:** key `ColumnsPath` by the literal ids declared in `TableConfig.columns`.

> **Amended.** As written this continued: "recovered structurally as `ColumnIdOf<S>` the way
> `RowOf<S>` already recovers the row type from the store shape (`engine/types.ts`)." Retracted —
> `TId` flows from `TableConfig.columns` to `TableConfig.columnsSchema` within one argument. No
> store recovery.

This is strictly more correct than widening to `string`: it also rejects `path.someRowField`
where that field was never declared as a column — a bug class invisible today.

**A schema fn is closed over the statically-declared column set.** A column added later via
`setColumns()` is not nameable from `columnsSchema`, by design.

> **Amended.** A trailing sentence here routed grouping's dynamic-column case through `initial`
> and `table.grouping.update()`. Moot — grouping no longer names columns at all.

## Alternatives considered

- **An escape-hatch call on the path — `applyGrouping(path.$('fullName'), …)`.** Rejected — it
  reintroduces the unchecked string this removes, one level down. Relocating a second door is not
  closing it.
- **An index signature on `ColumnsPath`.** Rejected — admits derived ids, but makes `path.typoo`
  compile, destroying the justification for the schema fn at all: `path.category` is
  compile-checked where a string id is not.
- **Leave it, and keep a free-string rules array.** Rejected — `applyVisible`, `applySortNulls`
  and `metadata()` share the blind spot and have no workaround, which is the evidence that the gap
  belongs to `ColumnsPath`. (As written this also cited grouping's free-string array as the
  motivating instance. Withdrawn — grouping's array is answered by a data-keyed path, not by this
  ADR. The remaining case is thinner and is accepted as such.)
- **Tighten `ColumnId<TRow>` to `TId` as well, dropping its `| (string & {})` arm.** Deferred —
  it would make every surface agree on one vocabulary, but breaks consumers relying on
  `setColumns()`-added columns, and is separable from this change.

## Consequences

- **Literal inference is required, and its absence is silent.** Without a `const` type parameter
  or consumer-side `as const`, `{ id: 'category' }` widens to `string` and the path degrades to
  today's behavior **with no error**. Whatever lands must make a widened config loud.
- **`ColumnDef`/`ColumnDefInput`/`TableConfig` gain a defaulted `TId extends string = string`** —
  defaulted, so existing references compile untouched. `TId` flows from `TableConfig.columns` to
  `TableConfig.columnsSchema` within one argument.
- **`TableStore`/`TableCore` do not.** As written this consequence included them, along with
  regenerating `create-table.overloads.ts`. Both are retracted — see the Amendment. The store
  erases the literal union to `ColumnDef<TRow, string>[]`, which is assignable from the config's
  literal-typed array and is all any downstream reader needs.
- **No unblock for feature-level rule arrays.** As written this claimed one, citing grouping's
  Phase B. Withdrawn; this ADR no longer speaks to a feature's rules array.

## Open

1. ~~**Inference-order spike (blocking).**~~ **Resolved: it works.** A minimal repro mirroring
   `RowOf`'s structural-inference pattern — `TId` inferred from `config.columns` (argument 2) via
   a generic `ColumnDefInput<TRow, TId>[]`, recovered afterward as `ColumnIdOf<S>` — typechecked
   clean under `strict`, with no `as const` needed on the consumer's `columns` array. A rule
   naming a column not declared in `columns` (e.g. a typo) is rejected at the call site, and a
   `ColumnIdOf<S>` read is a literal union, not `string`. The mechanism generalizes the same way
   `RowOf` already does across multiple composed features — nothing else in this ADR is blocked.

   **Moot as of the Amendment, not failed.** The spike tested cross-argument recovery, which only a
   feature's schema fn needed. `columnsSchema` sits on the same argument as `columns`, so the
   surviving decision never exercises this path. Kept as the record that it does work, should a
   future surface need it.
