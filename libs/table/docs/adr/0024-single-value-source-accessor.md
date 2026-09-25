# ADR-0024 — Column accessor as the single value source

**Status:** accepted
**Date:** 2026-09-20
**Related:** [ADR-0021](0021-column-concerns-and-data-concerns-are-separate-surfaces.md) (its
path-vocabulary rule is superseded here; its capability test stands),
[ADR-0019](0019-columns-path-keyed-by-declared-column-ids.md) (data concerns now key by declared
column id, the keying this ADR describes),
[ADR-0014](0014-runtime-error-policy.md) (every read goes through the wrapped `readAccessor`),
[ADR-0022](0022-render-row-cell-values.md) (`cells` already ignores visibility, so a carrier
column costs no extra per-row work), [ADR-0027](0027-schema-declaration-surface.md) (formalizes
the keying rule this ADR establishes into a general cross-cutting rule, and adds the authoring-form
and resolver-naming rules)

**Source:** design session 2026-09-20. Prior art:
[`../2-columns/work/column-id-identity/`](../2-columns/work/column-id-identity/) — two discovery
docs on column-id identity and model-derived ids.

Four consumers (cell rendering, sorting, grouping, filtering) currently read from three different paths: cells and sorting use `column.accessor`, while grouping and filtering read raw row fields. This silent divergence means a column with a derived accessor (e.g., `{ id: 'total', accessor: r => r.price * r.qty }`) renders and sorts correctly but collapses grouping and filtering. We adopt the column accessor as the single value source: all features read through `readAccessor(column, row)`, and any value used by grouping or filtering must be declared as a column. A value the table reads but never renders is declared as a **carrier column** — `{ id, accessor, visible: false }`, an ordinary column in every other respect.

## Consequences

- ADR-0021's path-vocabulary rule — "a feature's schema fn never names a column" — is superseded. ADR-0021's capability test ("belongs to the column surface if it needs nothing from the row data, to a feature if it reads rows") survives unchanged.
- The rejection of data-carrier columns recorded as D7 in `docs/1-state/work/grouping/active/grouping-config-simplification/2-decisions.md` is reversed.
- `resolveGroupLabel`'s raw-field-name fallback (`engine/grouping/render.ts:68`) becomes unreachable and should be deleted: every grouped level now has a column.
- `groupingLevels()` (`with-grouping/feature.ts:167-173`) stops silently dropping levels whose id matches no column — the case can no longer arise.
- Issue #100's aggregate ruling reopens. `aggregateFn` was moved onto a row-field-keyed `GroupingPath` on the premise that a value produced only inside an accessor can never be aggregated. Under this decision it can, and the aggregate path should key by column id.
- **No non-data gate is needed, and no display-column kind.** This library is headless: a checkbox, action cell or expand toggle is markup the consumer writes, never a column (`stories/selection/fixtures/schema.ts:6` declares only `name` and `dept`; the checkbox cell lives in the story host's template, per ADR-0022 — "the consumer's own visible-column loop still decides what renders"). TanStack's `DisplayColumnDef` and MUI's `GridActionsColDef` exist because those libraries own rendering and need a column object per rendered thing. That requirement does not transfer.
- The protection is instead a **construction throw** when a grouping, sorting or filtering declaration names a column id that was never declared — deterministic, fires before data flows, and already implemented for `columnsSchema` as `assertRuleColumnIdsAreKnown` (`engine/columns-schema/resolve.ts:18-31`). Extending it to the three features is part of this change.
- The residual runtime case — a *declared* column whose accessor returns `undefined` for every row — **degrades and is already visible**: `toGroupKey(undefined)` yields `'undefined'`, so it renders as a single labelled group rather than failing silently. It is not reported, because distinguishing it from legitimately-null data would require sampling a row at construction, which is non-deterministic (an empty array at construction is normal) and therefore fails the construction-error class.
- Grouping and filtering must read through the ADR-0014-wrapped `readAccessor`, never `column.accessor` directly. Sorting's existing unwrapped calls (`with-sorting.ts:117,124`) become a correctness bug once three consumers share one path.
- Grouping and filtering go from a property read to a function call per row per level.

## Alternatives considered

- **The row model is the single value source** — the accessor extracts only, and any derived value is materialized onto the row before it reaches the table. Rejected: a table's subject is the collection, not a single writeable object like a form's, so it cannot carry derived values and selection, expansion, actions, running index simultaneously. The running index in particular depends on pipeline output that does not exist at mapping time.
- **Narrow column ids to `Extract<keyof TRow, string>`** — constrain which columns can exist. Rejected as orthogonal: two derivations can both key on model fields and still disagree. It would additionally remove selection, actions, expand toggle, drag handle, running index, aggregate-only and spacer columns.
- **Leave the three paths and document the divergence.** Rejected: the divergence is silent and guaranteed, not conditional on misuse.
- **A separate `values:` declaration list for non-rendered data.** Rejected: it creates a second place to look for what the table can read, when `visible: false` already expresses it.
