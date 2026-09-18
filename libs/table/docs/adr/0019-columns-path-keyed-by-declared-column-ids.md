# ADR-0019 — `ColumnsPath` is keyed by declared column ids, not row keys

**Status:** accepted 2026-09-18 — decision settled, inference spike resolved (see [Open](#open)).
**Related:** [ADR-0004](0004-table-source-layout.md) (layout by contract boundary), [ADR-0010](0010-no-angular-lifecycle-names-on-engine-concepts.md) (columns-schema is an internal step). Affected surface: `schema/column-schema.types.ts`, every `apply*` rule that takes a `ColumnHandle`.

**Scope note:** this ADR owns one decision — how `ColumnsPath` is keyed. The `WithGroupingConfig`
reshape that motivated it is one feature's config and lives in
[`../1-state/work/grouping/active/grouping-config-simplification/`](../1-state/work/grouping/active/grouping-config-simplification/1-plan-config-simplification.md),
not here.

`ColumnsPath<TRow, TRule>` is a mapped type over `Extract<keyof TRow, string>`. A column whose id
is not a row key — a derived column declared `{ id: 'fullName', accessor: r => r.first + ' ' +
r.last }`, which `ColumnId<TRow>` explicitly keeps expressible — cannot be named from any schema
fn. Not from `applyGrouping`, not from `applyVisible`, not from `metadata()`.

The gap is **type-level only**. `buildColumnsPath`'s `get` trap already fabricates a handle for
any string property (`schema/column-schema.ts`), and the consuming feature already validates
every recorded `columnId` against its resolved `columns` at construction.

**Decision:** key `ColumnsPath` by the literal ids declared in `TableConfig.columns`, recovered
structurally as `ColumnIdOf<S>` the way `RowOf<S>` already recovers the row type from the store
shape (`engine/types.ts`).

This is strictly more correct than widening to `string`: it also rejects `path.someRowField`
where that field was never declared as a column — a bug class invisible today.

**A schema fn is closed over the statically-declared column set.** A column added later via
`setColumns()` is not nameable from a schema fn, by design. For grouping specifically, dynamic
columns remain reachable through `initial` and `table.grouping.update()`, both of which take
free strings.

## Alternatives considered

- **An escape-hatch call on the path — `applyGrouping(path.$('fullName'), …)`.** Rejected — it
  reintroduces the unchecked string this removes, one level down. Relocating a second door is not
  closing it.
- **An index signature on `ColumnsPath`.** Rejected — admits derived ids, but makes `path.typoo`
  compile, destroying the justification for the schema fn at all: `path.category` is
  compile-checked where a string id is not.
- **Leave it, and keep a free-string rules array per feature.** Rejected — an enumerated case per
  feature. Grouping grew one; `applyVisible` and `metadata()` have the same blind spot and no
  workaround, which is the evidence that the gap belongs to `ColumnsPath`.
- **Tighten `ColumnId<TRow>` to `TId` as well, dropping its `| (string & {})` arm.** Deferred —
  it would make every surface agree on one vocabulary, but breaks consumers relying on
  `setColumns()`-added columns, and is separable from this change.

## Consequences

- **Literal inference is required, and its absence is silent.** Without a `const` type parameter
  or consumer-side `as const`, `{ id: 'category' }` widens to `string` and the path degrades to
  today's behavior **with no error**. Whatever lands must make a widened config loud.
- **`ColumnDef`/`ColumnDefInput`/`TableConfig`/`TableStore`/`TableCore` gain a defaulted
  `TId extends string = string`** — defaulted, so existing references compile untouched.
- **`create-table.overloads.ts` is regenerated, never hand-edited** — 16 arities; fix
  `tools/generate-overloads.ts` and run `npm run table:overloads`.
- **Unblocks removing a feature's free-string rules array.** For grouping that is Phase B of the
  config-simplification plan; the same unblock applies to any future feature that would otherwise
  grow one.

## Open

1. ~~**Inference-order spike (blocking).**~~ **Resolved: it works.** A minimal repro mirroring
   `RowOf`'s structural-inference pattern — `TId` inferred from `config.columns` (argument 2) via
   a generic `ColumnDefInput<TRow, TId>[]`, recovered afterward as `ColumnIdOf<S>` — typechecked
   clean under `strict`, with no `as const` needed on the consumer's `columns` array. A rule
   naming a column not declared in `columns` (e.g. a typo) is rejected at the call site, and a
   `ColumnIdOf<S>` read is a literal union, not `string`. The mechanism generalizes the same way
   `RowOf` already does across multiple composed features — nothing else in this ADR is blocked.
