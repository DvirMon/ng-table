---
title: Columns Schema — Data-Derived Columns (`createColumns(data, schemaFn)`)
type: architecture
version: 0.1
date: 2026-07-24
status: REJECTED 2026-07-31 — createColumns(data, schemaFn) API rejected; focus stays on columnsSchema function. Column-order open question below is moot.
audience: developers
parent: ../2-columns/architecture.md
---

# Data-Derived Columns — `createColumns(data, schemaFn)`

A second overload lets a consumer skip the `baseColumns` array and derive the column set from the
row data — the table analog of Signal Forms' `form(model, schemaFn)` deriving fields from a model.

```ts
createColumns<TRow>(data: Signal<TRow[]>, schemaFn?: (path: ColumnsPath<TRow>) => void): ColumnsSchema<TRow>;
```

```ts
// no baseColumns — columns materialize from row keys at runtime
const columns = createColumns<Product>(productsSignal, (path) => {
  applyVisible(path.status, { when: () => role() === 'admin' });  // typed now, even if productsSignal() is []
});
```

## Why the "keys drift from the type / empty array" worry dissolves

The naive fear — runtime `Object.keys` diverging from compile-time `keyof TRow`, or an empty data
array yielding no columns — is exactly the problem Signal Forms already solved, by keeping **two
decoupled trees** (confirmed in fetched `angular/angular` source):

1. **Schema surface (structural, compile-time typed).** The `path` proxy is *not* derived from data.
   `FIELD_PATH_PROXY_HANDLER` fabricates a child node for *any* property accessed
   (`packages/forms/signals/src/schema/path_node.ts:102-110`, `getChild` at `:73-78`) and reads zero
   model data. Typing comes 100% from the `<TRow>` generic (mirrors `SchemaPath<T>`). `path.status`
   is valid and typed whether or not `data()` currently has rows. Rules attach to structural paths,
   waiting for their column to materialize — same as a form validator bound to a path whose value
   isn't present yet.
2. **Column set (data-derived, reactive).** The actual columns materialize from
   `Object.keys(data()[0])` inside a computed, reconciled as data arrives/changes — mirrors the field
   tree's `Object.keys(value)` reconciliation (`packages/forms/signals/src/field/structure.ts:346`,
   with stale-key pruning). Empty array → no columns yet, no error; typing is unaffected because it
   never depended on the runtime keys.

Typing never flows from runtime keys, so drift can't break type safety. A key present in the data
but absent from `TRow` is ignored (or dev-warned); a `TRow` key absent from the data yields no column
until a row supplies it.

## The mapping (why the fit is exact)

Signal Forms' model is one object whose keys are the fields; table data is an array of rows whose
element keys are the columns. Align "array item = row, field = column" and the correspondence is 1:1:

| Signal Forms | NGP Table |
|---|---|
| model = one object | one **row** |
| object keys → fields | row keys → **columns** |
| array items, identity-tracked by synthetic symbol (`structure.ts:365`) | **rows**, identity-tracked by `trackBy` |
| `SchemaPath<T>` structural proxy (`path_node.ts`) | `ColumnsPath<TRow>` structural proxy |
| data-bound field tree via `Object.keys` (`structure.ts:346`) | column set via `Object.keys(row)` |

> **`trackBy` is this table's `identitySymbol`** — the row-identity mechanism Signal Forms
> auto-generates for array items, made explicit here. That is why row identity lives on the store
> (`trackBy`, core config) while column identity lives on the schema (`path` / column `id`): rows are
> the array dimension, columns are the object-key dimension.

## Caveats — keep the array overload

The data overload can express *only* what row keys carry. It cannot express: custom `accessor`
(e.g. `(r) => r.price / 100`), explicit `order`, or derived/computed columns with no backing key
(`fullName`, an actions column). For those, use the explicit `baseColumns` array overload. The two
overloads coexist — same as Signal Forms tolerating both a known-shape model and a dynamic one.

## Open question — column order

- [ ] `Object.keys(row)` insertion order is the only available default, and it is not a meaningful UX
  order (nor guaranteed stable across JS engines for non-integer keys, though V8 preserves it).
  Options: require `applyOrder` per column under this overload; accept insertion order as documented
  default; or take an optional explicit `order: (keyof TRow)[]` alongside the data signal. Decide
  before building the data overload — otherwise first-render column order is arbitrary.
