# Step 1 — Re-key the filter type surface to column id

**PR scope:** standalone, and **breaking** (`FiltersPath` gains a
required parameter). First step — no blockers.

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/engine/filters/types.ts` (edit)
- `libs/table/src/api/features/with-filtering/types.ts` (edit)
- `libs/table/src/api/features/with-filtering/rules.ts` (edit)

## Why This Step Exists

Every rule types its cell as `TRow[K]` with `K extends
Extract<keyof TRow, string>`. Once `path` keys by declared column id,
`TRow[K]` means nothing — `'owner'` over `accessor: r => r.owner.name`
would infer the row's `owner` object, which is exactly the lie ADR-0024
exists to close. The cell type must come from #125's column-value map.

The map is inferred when the schema is inline in
`withFiltering({ schema })`. A schema written as its own variable must
spell it — ruled 2026-09-25 while planning (see Step 8):

- `FiltersPath<TRow, TValues>`, **`TValues` required**. The old
  one-argument `FiltersPath<Row>` must fail to compile, not silently
  degrade to `Record<string, unknown>` (every path an index signature,
  every criterion `unknown`).
- **No `ColumnValuesOfSet<>` alias.** A consumer spells
  `ColumnValues<Row, typeof set.columns>` directly. Deferred until a
  second feature needs the same spelling.

## What To Do

**1. `engine/filters/types.ts` — the handle carries the value type.**

```ts
export interface FilterHandle<TRow, K extends string = string, V = unknown> {
  readonly id: K;
  /** @internal phantom — the column's resolved value type. */
  readonly __value?: V;
}
```

Drop the `Extract<keyof TRow, string>` constraint on `K`. `TRow` stays —
`FilterOptions.when` and `FilterRule.__row` still read it.

`FilterValueOfContext.valueOf`: **keep the name** (renaming it to
`criterionOf` is #117's — AC says this slice must not touch it). Loosen
only its generic to match the new handle:

```ts
valueOf<K extends string = string>(path: FilterHandle<any, K, any>): unknown;
```

Keep its lookup-by-`handle.id` semantics exactly.

**2. `api/features/with-filtering/types.ts` — `FiltersPath` keys by the map.**

```ts
export type FiltersPath<TRow, TValues extends ColumnValueMap> = {
  readonly [K in ColumnIdIn<TValues>]: FilterHandle<TRow, K, TValues[K]>;
};
```

No default on `TValues`. Rewrite the doc comment: keyed by declared
column id; inline schemas infer it; a schema written as its own variable
spells `ColumnValues<Row, typeof set.columns>`.

**3. `rules.ts` — read the cell type off the handle.**

Each single-path rule becomes generic in `<TRow, K extends string, V>`
over `path: FilterHandle<TRow, K, V>`:

| Rule                                 | Was                           | Becomes                            |
| ------------------------------------ | ----------------------------- | ---------------------------------- |
| `equals`                             | `TRow[K] \| null \| TEmpty`   | `V \| null \| TEmpty`              |
| `hasAny` / `hasNone`                 | `ItemOf<TRow[K]>`             | `ItemOf<V>`                        |
| `filter`                             | `predicate(cell: TRow[K], …)` | `predicate(cell: V, …)`            |
| `contains`, `inRange`, `inDateRange` | criterion fixed               | unchanged; only the handle generic |

`anyOf`, `CriterionOf`, `RowOfRule`, `StateOf` are untouched — `StateOf<S>`
still infers off the schema's return (the declaring form, #111/#116).

Runtime bodies are unchanged: `paths: [path.id]` already stores a
string, and it is now a column id.

## Implementation Notes

- `ColumnValueMap` and `ColumnIdIn` come from `api/types.ts` via
  `import type` — keep the api↔engine type-only cycle type-only.
- Mirror `GroupingPath<TRow, TId>`'s mapped-type shape; the difference
  is that filtering needs the value, not just the id.
- `FiltersPath` stays exported from `index.ts` under the same name.

## Risks / Watchouts

- **`src/stories/**` and the filtering specs go red here\*\* and stay red
  until Steps 4–7. Do not fix them in this step.
- **`const TEmpty` on `equals`** — confirm `V` still infers from the
  handle and not from `options.emptyValue`; the handle must be the first
  inference site.
- **`filter`'s two `TCriterion` inference sites** (comment above it in
  `rules.ts`) — the predicate's second parameter must still win.

## Non-Goals

- No runtime change — Step 2.
- No `withFiltering` input change — Step 3.
- No `valueOf` → `criterionOf` rename (#117).
- No `ColumnValuesOfSet<>` alias.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` clean on `src/api/**` and
      `src/engine/**` (`src/stories/**` expected red until Step 7).
- [ ] `rules.ts` contains no `TRow[K]` and no `Extract<keyof TRow`.
- [ ] `FiltersPath` has no default on its second parameter.

---

[Step 2: The engine reads the accessor](step-2-engine-reads-accessor.plan.md) →
