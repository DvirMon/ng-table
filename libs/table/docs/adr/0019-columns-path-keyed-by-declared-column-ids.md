# ADR-0019 — `ColumnsPath` is keyed by declared column ids, not row keys

**Status:** proposed 2026-09-17 — decision settled, landing blocked on one inference spike (see [Open](#open)).
**Related:** [ADR-0004](0004-table-source-layout.md) (layout by contract boundary), [ADR-0018](0018-when-vs-enable-predicate-naming.md) (`when`/`enable`). Affected surface: [`../1-state/features/grouping.md`](../1-state/features/grouping.md), `schema/column-schema.types.ts`.

`ColumnsPath<TRow, TRule>` is a mapped type over `Extract<keyof TRow, string>`. A column whose id
is not a row key — a derived column declared `{ id: 'fullName', accessor: r => r.first + ' ' +
r.last }`, which `ColumnId<TRow>` explicitly keeps expressible — cannot be named from any schema
fn. That gap is **type-level only**: `buildColumnsPath`'s `get` trap already fabricates a handle
for any string property, and `withGrouping()` already validates every recorded `columnId` against
`input.columns()` at construction.

`withGrouping()` papered over it with a second config field, `rules: AnyGroupingRule<TRow>[]`,
whose free-form `columnId: string` reaches what `schema` cannot. Two fields, one concept — the
rules-array layer records exactly the rule objects the schema fn records, differing only in how
the column is named.

**Decision:** key `ColumnsPath` by the literal ids declared in `TableConfig.columns`, recovered
structurally as `ColumnIdOf<S>` the way `RowOf<S>` already recovers the row type from the store
shape. `rules` is removed from `WithGroupingConfig`; `schema` becomes the single declarative
entry.

This is strictly more correct than widening to `string`: it also rejects `path.someRowField`
where that field was never declared as a column — a bug class invisible today in both `rules`
and `schema`.

**A schema fn is closed over the statically-declared column set.** A column added later via
`setColumns()` is not nameable from `schema`, by design. Dynamic columns still group through
`initial` and `table.grouping.update()`, both of which take free strings and are unchanged.
(A third escape, the bare-lambda `groupingRule` config field, existed when this ADR was drafted;
it was removed in the interim — see Open question 2.)

## Alternatives considered

- **An escape-hatch call on the path — `applyGrouping(path.$('fullName'), …)`.** Rejected — it is
  `rules` again, one level down: the same unchecked string and the same second door, relocated
  from the config object to the path proxy. Removing a field by re-exposing its semantics
  elsewhere is not removing it.
- **An index signature on `ColumnsPath`.** Rejected — admits derived ids, but makes `path.typoo`
  compile, destroying the entire justification for the schema fn ("`path.category` is
  compile-checked where a string id is not").
- **Keep `rules`, document it as the derived-column path.** Rejected — an enumerated case per
  access shape, and it leaves the identical blind spot in `applyVisible`/`metadata`, where nobody
  has yet added a second field to work around it.
- **Tighten `ColumnId<TRow>` to `TId` as well, dropping its `| (string & {})` arm.** Deferred, not
  rejected — it would make every surface agree on one vocabulary, but breaks any consumer relying
  on `setColumns()`-added columns and is separable from this change.

## Consequences

- **Source-breaking for `rules`.** Any `withGrouping({ rules: [...] })` call stops compiling.
  In-repo: ~10 spec sites and one story (`grouping-async-rule-story-host.component.ts`, whose
  `rep` is a `DealRow` key and migrates unchanged).
- **Literal inference is required, and its absence is silent.** Without a `const` type parameter
  or consumer-side `as const`, `{ id: 'category' }` widens to `string` and the path degrades to
  today's behavior with no error. Whatever lands must make a widened config loud.
- **`ColumnDef`/`ColumnDefInput`/`TableConfig`/`TableStore`/`TableCore` gain a defaulted
  `TId extends string = string`.** Defaulted, so every existing reference compiles untouched.
- **`create-table.overloads.ts` is regenerated, never hand-edited** — 16 arities, ~136
  `TableStore<TRow>` positions; fix `tools/generate-overloads.ts`, run `npm run table:overloads`.
- **Per-column `applyGroupOrder` rules are unaffected** — they already travel through the schema
  fn, and after the issue-87 landing the cluster engine reads ordering only from the recorded
  rules array.

## Open

1. **Inference-order spike (blocking).** `TId` must infer from argument 2 of `createTable()` and
   flow into argument 3's contextual type. `RowOf` proves the mechanism works in this position,
   but it infers from `data` (a plain signal in argument 1), whereas `TId` infers from a `const`
   array literal at a deeper site. The existing `NoInfer<In>` in `withGrouping()`'s second
   overload is evidence of prior inference trouble here.
2. ~~**Does `groupingRule` survive?**~~ **Resolved: no.** Removed ahead of this ADR landing —
   it had zero call sites outside its own definition, and making `enable` optional closed the one
   real gap it was patching (attaching a `when`-only rule without abstaining the whole set).
   Dynamic columns added via `setColumns()` reach only `initial` and `table.grouping.update()`
   now (see the escapes paragraph above).
3. **Standalone reuse.** `rules` allowed a pre-built array shared across tables. The precedent for
   keeping that inside one entry is `TableConfig.columnsSchema?: ColumnsSchemaFn<TRow> |
   ColumnSchema<TRow>` — mirrored here as `schema?: GroupingSchemaFn<TRow> |
   GroupingSchema<TRow>`.
