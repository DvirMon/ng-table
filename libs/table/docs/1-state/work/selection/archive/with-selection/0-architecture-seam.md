---
title: State ↔ UI seam — what "hybrid" actually means here
type: architecture
status: working note (grill support, with-selection) — item 3 superseded by D5, corrected 2026-09-14
date: 2026-09-06
audience: developers
---

# The seam: who owns state, who reads it, who writes it

Written during the `withSelection()` grill to settle a prior question — the library feels
"hybrid" (TanStack-like state layer + PrimeNG-like directives), so what is the API contract?

**Finding: it is not hybrid. It is headless core + directives that are pure consumers of the
store.** The pattern is already implemented and drilled for expansion; selection inherits it
rather than inventing one.

## The three roles

| Role                               | Owns                                                      | Never does             |
| ---------------------------------- | --------------------------------------------------------- | ---------------------- |
| Feature (`api/features/with-*.ts`) | the signals, the verbs, the render stage, `onRowsRemoved` | know that a DOM exists |
| Store (`createTable()` result)     | composition of features into one object                   | render                 |
| Directive (`directives/*.ts`)      | ARIA, `data-*`, activation, motion                        | **store state**        |

Verified against the shipped code:

- `withExpansion()` (`src/api/features/with-expansion.ts`) holds `expandedRows`, `everExpanded`,
  and exposes `toggleExpanded` / `expandAll` / `collapseAll`. No DOM reference anywhere.
- `NgpTableRowDirective` takes the `RenderRow` as an input and only _reflects_ it —
  `[attr.aria-expanded]="ngpTableRow().isExpanded ?? null"`. It stores nothing.
- `ngpTableExpandToggle` (`docs/3-ui/directives/expansion.md`) is the write path:
  `this.table.store().toggleExpanded(this.row.rowId())`. The directive injects the store via
  `NGP_TABLE_STORE` and _calls_ it. It has no state of its own.

**The invariant, stated once:** a directive may inject the store and call a verb, and may read
signals to reflect them. A directive may never be the place a fact is stored. If a directive
needs to remember something, that something belongs on a feature.

That is the whole difference from PrimeNG/AG Grid, where the component _is_ the owner and the
"state" is a side effect of the component being mounted. Here, unmounting every directive
changes nothing about the table's state.

## Where TanStack sits

TanStack is the same split; it just stops before shipping the DOM half, so consumers write it
themselves each time. Our directive layer is the part TanStack leaves to userland, standardized
— it is not a second source of truth bolted onto a headless core.

Verified from published source
(`@tanstack/table-core@8.21.3/src/features/RowSelection.ts`): state is `rowSelection` only;
`enableRowSelection` / `enableMultiRowSelection` / `enableSubRowSelection` are
`boolean | ((row) => boolean)` **options**, not state; single-select is enforced inside
`mutateRowIsSelected` by clearing the set before selecting, gated per row on
`row.getCanMultiSelect()`.

## Tiering — already the contract, not a new idea

`docs/3-ui/directives/expansion.md` defines four tiers, and tier 0 is "store only, zero DOM
opinion — not a degraded path, it is the contract." Selection gets the same ladder:

| Tier | Consumer writes               | Gets                                                                     |
| ---- | ----------------------------- | ------------------------------------------------------------------------ |
| 0    | store only                    | selection signals + verbs; consumer owns checkbox, ARIA, keyboard        |
| 1    | `+ ngpTableSelectionCheckbox` | activation, `aria-selected`, `data-selected`, indeterminate header state |

## Declarative config, imperative verbs — both, at different moments

The Signal Forms-shaped API governs **declaration**: `createTableSchema()` /`createTable()` take a
config function, features are declared in an array, column rules are declarative
(`applyVisibleAsync`). Nothing about that is violated by a verb being a plain function call —
Signal Forms itself declares with `field()` and writes with an imperative `.set()` at the event
boundary.

Rule for proposing selection's API: **anything known before a user interacts is declarative
config; anything caused by a user interacting is a verb.** A `scope` enum would have been
config (and D1 removed it). A checkbox click is a verb.

## What this settles for `withSelection()`

1. Selection state lives on the feature. `ngpTableSelectionCheckbox` stores nothing.
2. The directive's write path is `store().<verb>(rowId)`, mirroring `ngpTableExpandToggle`.
3. ~~The directive's read path is a `RenderRow` field (`isSelected?`) plus store signals.~~
   **Superseded by D5 (2026-09-06), same day this note was written.** There is no `isSelected?`
   field and no render-stage claim: the read path is `table.selectedRows().has(row.id)`, in the
   template at tier 0 and via DI in the directive at tier 1. Stamping would rebuild the whole
   `RenderRow[]` on every checkbox click; a signal read costs one `Set.has()` per row against
   attribute bindings only. The divergence from `withExpansion()`'s `isExpanded` stamp is
   deliberate — expansion changes which rows exist, selection does not. The general rule this
   item cited still holds for features that _do_ contribute a `RenderRow` field; selection is not
   one of them. Both shipped selection stories read the signal directly, which is the recipe
   [`0-product/selection.md`](../../../../../0-product/selection.md) §2.1 is now marked ✅ against.
4. `docs/3-ui/directives/selection.md`'s "Known Blocker" (select-all scope) is **removed by D1** —
   that file is now unblocked for drilling.
