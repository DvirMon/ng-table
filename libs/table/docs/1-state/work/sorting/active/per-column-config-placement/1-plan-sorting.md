---
title: Plan — sorting per-column config moves to withSorting({ sortable, schema })
type: plan
status: approved shape, 2026-09-17 — not implemented. Settles the sorting half of #100; aggregateFn follows under the same rule.
date: 2026-09-17
audience: developers
issue: https://github.com/DvirMon/ng-table/issues/100
---

> **Superseded 2026-09-25.** #100 shipped from the `single-value-source` epic workspace instead
> of this plan — see
> [`docs/1-state/work/core/active/single-value-source/`](../../../core/active/single-value-source/)
> and `docs/decisions/sorting.md` SO19/21/22/25–29 for the ruling actually taken (three bare-named
> declarators — `sortNulls`/`sortFn`/`sortable` — plus a `sortingSchema<Row>(fn)` reuse helper).
> Kept here for its own analysis, not rewritten.

# #100 — sorting: move per-column config to `withSorting({ sortable, schema })`

## Context

Issue #100 asks where a feature's per-column config lives. Sorting is split three ways today:
`sortFn` / `enableSorting` on `ColumnDef` (`api/types.ts:80-81`), null placement via
`applySortNulls` in `TableConfig.columnsSchema` routed through the `SORT_NULLS` metadata key
(`schema/column-rules.ts:60`, `engine/columns.ts:87`). Blast radius measured in the issue: 0
production authors for `sortFn`/`enableSorting`, 3 spec authors for `applySortNulls`, 1 story
comment. One change, no expand–contract.

### Decisions made in this session (2026-09-17)

Each `ColumnDef` sorting fact was classified on two axes — *where* (ColumnDef vs feature) and
*how* (static value vs reactive rule):

| Fact | Still needed? | Reactive / async / order-bearing? | Lands as |
|---|---|---|---|
| `enableSorting` | yes — `toggleSort` guard lets a generic `@for` header template stay inert on some columns | no real reactive case (server/permission cases hide the column, not un-sort it) | **table-level set** `sortable?: boolean \| ColumnId<TRow>[]` on the config — not a per-column rule. Same shape as `withGrouping({ initial })` |
| `sortFn` | yes — auto-detect covers string/number/Date only | no | **schema rule** `applySorting(p.x, { compare })` |
| `applySortNulls` | yes (shipped, spec'd) | no — static opts on a reactive channel was the inverse mismatch the issue names | **schema rule** `applySorting(p.x, { nulls })`; `applySortNulls` + `SORT_NULLS` deleted |
| `accessor` | core, not feature | — | stays on `ColumnDef` |

Rationale recorded for the ADR (step 8):

- **Sortability is a set, not a rule.** Prior art verified from source: TanStack/AG Grid/MUI
  default every column sortable (opt-out via colDef); Angular Material/PrimeNG opt in per header
  in the template. Neither makes it reactive. Putting it in the schema fn would make
  `{ when: () => false }` the only reason to write a rule — ceremony — and adding a
  comparator rule would silently change which columns sort. A dedicated config field removes
  both: `sortable` answers *which*, `schema` answers *how*.
- **Default: omitted ⇒ all sortable** (engine convention, zero repo churn). `false` ⇒ none;
  `ColumnId[]` ⇒ only those. Unknown id in the array **throws at construction** (wiring error,
  same as `withGrouping.initial`). `setSorting()` stays unguarded — programmatic writes are
  explicit (MUI precedent). A rule on a column outside the set is inert for clicks, still
  applies under `setSorting()`.
- **General rule for #100** (settles the sorting half; `aggregateFn` follows later under the
  same rule): a per-column fact goes in the feature's schema fn only when it is reactive,
  async, or call-order-bearing (`applyGrouping.enable`, `applyVisible`). A static per-column
  behavior override still uses the schema fn for placement consistency and single-writer
  enforcement. A table-wide set of columns is a config field.

### Target DX

```ts
withSorting();                                   // every column sortable, auto comparator, nulls last
withSorting({ sortable: ['name', 'dueDate'] });  // only these
withSorting({ sortable: false, manual: true });  // programmatic only
withSorting({
  sortable: ['name', 'age', 'dueDate'],
  schema: (p) => {
    applySorting(p.age,     { compare: (a, b) => a.age - b.age });
    applySorting(p.dueDate, { nulls: { order: 'first', emptyString: 'is-empty' } });
  },
});
```

## Steps

Dependency graph: 1 → 2 → 3 → {4, 5, 6} → 7 → 8. Steps 4/5/6 are parallel-safe after 3.

### 1. Sorting rule types — new `src/schema/sorting-schema.types.ts`

```ts
export interface SortNullsOpts { order?: 'first' | 'last'; emptyString?: 'is-empty' }  // moved from column-rules.ts, unchanged
export interface SortingRuleOpts<TRow> { compare?: (a: TRow, b: TRow) => number; nulls?: SortNullsOpts }
export interface SortingRule<TRow = unknown> extends SortingRuleOpts<TRow> { readonly kind: 'sorting'; readonly columnId: string }
export type SortingSchemaFn<TRow> = (path: ColumnsPath<TRow, SortingRule<TRow>>) => void;
```

Mirror of `grouping-schema.types.ts`. No async variant, no `enable`.

### 2. `applySorting()` — new `src/schema/sorting-rules.ts`

Mirror of `schema/grouping-rules.ts:12`:

```ts
export function applySorting<TRow, K extends Extract<keyof TRow, string>>(
  path: ColumnHandle<TRow, K, SortingRule<TRow>>, opts: SortingRuleOpts<TRow>
): void { assertPathIsCurrent(path).record({ kind: 'sorting', columnId: path.id, ...opts }); }
```

Records only; duplicate detection happens in step 3 (the recorder has no per-family
single-writer check — `resolve.ts` does that for metadata keys, so sorting does its own).

### 3. `with-sorting.ts` — config, fold, guards

- `WithSortingConfig<TRow>`: add `sortable?: boolean | ColumnId<TRow>[]`, `schema?: SortingSchemaFn<TRow>`. Becomes generic; overloads take `WithSortingConfig<RowOf<In>>` like `with-grouping.ts:136-142`. Keep the derive-first overload.
- `buildSortingSpec`:
  - `runColumnsSchemaFn<TRow, SortingRule<TRow>>(config.schema)` → rules (reuse `schema/column-schema.ts:112`).
  - Construction throws (ADR-0014 wiring class), messages prefixed `[withSorting]`:
    unknown id in `sortable` array; rule naming unknown column; two rules for one column.
  - `ruleByColumnId: Map<string, SortingRule<TRow>>`; `sortableIds: Set<string> | 'all'`.
  - `toggleSort`: guard on the set (replaces `column.enableSorting !== false`, line 157).
  - `sortRows`: `compare = rule?.compare ?? detectComparator(...)` (replaces `column.sortFn`, line 112); `isEmpty`/`nullsOrderFor` read `rule?.nulls` instead of `readColumnMeta(column, SORT_NULLS)` (lines 82-96). Drop the `readColumnMeta`/`SORT_NULLS` imports.
  - Add member `isSortable(columnId: string): boolean` to `SortingMembers` — the store-owned answer a header directive/template needs for `aria-sort`/`data-sortable`; one line, mirrors TanStack `getCanSort()`.
- **ADR-0014 retrofit (optional, strike if unwanted):** wrap `compare` per callback — on throw, that column's comparator returns 0 for the rest of the evaluation and reports once (`console.error`, same floor as `engine/grouping-rules.ts:30`). ADR table already names this fallback for `sortFn`; the code is unguarded today.
- Update the JSDoc on `withSorting` (line 184-192).

### 4. Delete the old surface

- `api/types.ts:79-82`: remove `sortFn`, `enableSorting`; keep `aggregateFn` + comment (still feature-contributed until its own migration).
- `schema/column-rules.ts:47-65`: delete `SortNullsOpts`, `applySortNulls`.
- `engine/columns.ts:80-90`: delete `SORT_NULLS`.
- `index.ts:47-48`: drop `applySortNulls`, `SortNullsOpts` from column-rules; add
  `export { applySorting } from './schema/sorting-rules'` and
  `export type { SortNullsOpts, SortingRule, SortingRuleOpts, SortingSchemaFn } from './schema/sorting-schema.types'`.

### 5. Spec — `with-sorting.spec.ts`

- `makeColumns` overrides typed `Partial<ColumnDef<Row>>` lose `sortFn`/`enableSorting` — rewrite:
  - L140 `enableSorting: false` → `withSorting({ sortable: ['name', 'age', 'joined'] })`.
  - L192 custom `sortFn` → `withSorting({ schema: (p) => applySorting(p.name, { compare }) })`.
  - L436, L466, L486: `applySortNulls`/`sortFn` → `applySorting(p.x, { nulls })` / `{ compare }`; the L479 duplicate test now expects the `[withSorting]` message.
- Add: `sortable: false` no-ops every toggle; array narrows; unknown id throws; rule on unknown column throws; rule on non-sortable column still applies via `setSorting()`; `isSortable()`.
- Type assertion: `applySorting(p.unknownKey, …)` is a compile error (`expectTypeOf`/`@ts-expect-error`, enforced by `typecheck-spec`).

### 6. Story comment

`stories/row-edit/sorting-editing/sorting-editing-story-host.component.ts:79` — "shipped
`applySortNulls()` default" → "shipped `nulls: 'last'` default". No code change (no story
authors `sortFn`/`enableSorting`; all four sorting hosts use `withSorting()` bare, which keeps
every column sortable).

### 7. Permanent docs (work/ folders are episodic — leave)

- `docs/1-state/features/sorting.md`: "Comparator Logic", "Null / Empty Value Ordering" (per-column override paragraph, "Requires `withColumnsSchema()`" line), "Compile-Time Dependencies", `toggleSort` row, Open Questions (table-wide `nulls` default stays open). Bump version.
- `docs/adr/0014-runtime-error-policy.md`: table row `sortFn` → `compare` (and the retrofit note if step 3's optional part ships).
- `CLAUDE.md`: file table — `schema/column-rules.ts` row, add `schema/sorting-rules.ts` + `schema/sorting-schema.types.ts` rows; the ADR-0014 paragraph naming `sortFn`.
- `docs/2-columns/reference/tier-3-feature-config.md`, `docs/1-state/columns.md`, `docs/3-ui/directives/sort.md`, `docs/3-ui/directives/columns.md`, `docs/1-state/prd.md`, `docs/overview.md` — grep hits for the deleted names; update the sentences that describe them.
- `docs/1-state/work/with-grouping/2-decisions.md` D2: amend the parenthetical "(`sortFn`, `aggregateFn`, `filterFn`)" — `sortFn` gone, `filterFn` never existed.

### 8. Record the decision

- New `docs/adr/0018-per-column-feature-config-placement.md` (via `adr-writer`): the general rule above, the sortability-is-a-set argument, prior-art table, what it supersedes (D2 wording; D4 unchanged), and that `aggregateFn` is the remaining field to migrate.
- Comment on #100 with the rule + link; keep the issue open for `aggregateFn` (or close and open a scoped follow-up — user's call at implementation time).

## Verification

- `nx run shared-table:typecheck` and `nx run shared-table:typecheck-spec` (template-aware; run twice if the first run reports `.ts` errors). Run by the user.
- `nx test shared-table` — `with-sorting.spec.ts` covers the new guards; user runs.
- Storybook: `row-edit/sorting-editing`, `row-edit/live-table`, `selection/filtering-selection`, `grouping/grouping-collapsible` — header clicks still sort (bare `withSorting()` ⇒ all sortable); blank-due-date row still lands last.
- `npm run table:status` unaffected (frontmatter unchanged).

## Out of scope

- `aggregateFn` migration (same rule, `withGrouping`) — follow-up.
- #81 `groupIndex` — its placement now has a rule to follow.
- Table-wide `nulls` default on the config — still open in `sorting.md`; not added.
- Header-cell directive binding `aria-sort`/`data-sortable` — `isSortable()` gives it what it needs; the directive change is `docs/3-ui/directives/sort.md`'s own work.
