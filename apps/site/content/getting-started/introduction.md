---
label: Introduction
slug: /getting-started/introduction
archetype: Doc Article
---

NGP Table separates what a table _knows_ from what it _shows_.

## Three layers

1. **State layer.** `createTable()` returns a table instance that owns rows, columns and every
   feature's state as signals.
2. **Columns layer.** `columnSchema()` declares per-column rules such as visibility.
3. **UI layer.** Attribute directives like `ngpTable` and `ngpTableCell` connect your own
   markup to the state. They never insert, remove or reorder DOM.

## Features compose as arguments

Each behavior is an opt-in feature passed to `createTable()` after the options object:

```ts
const table = createTable(data, { trackBy: 'id', columns }, withSorting(), withExpansion());
```

A feature you do not pass is not in your bundle.
