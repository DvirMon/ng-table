---
label: Sorting
slug: /state-layer/sorting
archetype: Doc Article
---

`withSorting()` adds sorting to a table. The sort state is an ordered array of rules; an earlier
rule takes priority over a later one.

```ts
const table = createTable(data, { trackBy: 'id', columns }, withSorting());
```

## Sort state

Each rule names a column and a direction, `'asc'` or `'desc'`:

```ts
interface SortRule {
  columnId: string;
  direction: 'asc' | 'desc';
}
```

## Methods

| Method              | What it does                                                |
| ------------------- | ----------------------------------------------------------- |
| `toggleSort(id)`    | Moves the column through ascending → descending → unsorted. |
| `setSorting(rules)` | Replaces the whole sort state.                              |
| `clearSorting()`    | Removes every rule.                                         |

### Multi-column sort

By default, `toggleSort()` on another column replaces the sort with that column alone. Pass
`multi: true` to add each clicked column to the rules instead, in click order:

```ts
withSorting({ multi: true });
```

`setSorting()` accepts any list of rules either way.

## Server-side sorting

With `manual: true`, the table updates its sort state but does not sort rows itself. React to
`sortChanged` with your own `effect()`, fetch sorted data, and write it to your `data` signal.

## Per-column rules

Column-specific behavior goes in the `schema` option:

```ts
withSorting({
  schema: (path) => {
    sortNulls(path.deletedAt, { order: 'last' });
    sortFn(path.amount, (a, b) => a - b);
    sortable(path.id, { enable: () => false });
  },
});
```

- `sortFn` sets the column's comparator. Without one, strings, numbers and dates compare
  automatically.
- `sortable` decides whether `toggleSort()` affects the column. Columns are sortable by default.
- `sortNulls` places null and empty values first or last.
