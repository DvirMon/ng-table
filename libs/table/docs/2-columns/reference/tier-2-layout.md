---
title: Columns Schema — Tier 2 Layout (sizing column-owned, pinning store-owned)
type: architecture
version: 0.2
date: 2026-07-25
status: drafted — spec only, not yet implemented
audience: developers
parent: ../architecture.md
---

# Tier 2 — Layout (sizing column-owned, pinning store-owned)

High user demand, zero story today. The real gaps versus AG-Grid. Ship after Tier 1. Read
[Ownership model](ownership-model.md) first.

**Not one ownership story.** Sizing (`applyWidth`/`applyFlex`) stays column-owned by default (a
config seed, no store feature) unless resizable. Pinning (`applyPinned`) is **not** column-owned —
fetched TanStack source (`packages/table-core/src/features/column-pinning/columnPinningFeature.ts`,
pulled into `/tmp/ts_columnPinningFeature.ts` this session) confirms pinning is table-level logic
state, not a per-column geometry field: `columnPinning: { left: string[]; right: string[] }`, plus
row-level start/center/end region derivation (`row_getStartVisibleCells`, `row_getCenterVisibleCells`,
`row_getEndVisibleCells`) and column methods (`column_pin`, `column_getIsPinned`,
`column_getPinnedIndex`). `applyPinned` therefore **seeds a new `withColumnPinning()` store
feature's initial state** — the same seed-into-a-feature pattern Tier 3 already uses for
`applyDefaultSort` seeding `withSorting()` — it does not write a `pinned` field onto `ColumnDef`.

## `applyWidth` / `applyFlex` — sizing (column-owned, default)

```ts
export function applyWidth<TRow, K extends Extract<keyof TRow, string>>(
  path: ColumnHandle<TRow, K>,
  width: number | { when: (ctx: ColumnRuleContext<TRow>) => number },
  opts?: { min?: number; max?: number }
): void;

export function applyFlex<TRow, K extends Extract<keyof TRow, string>>(
  path: ColumnHandle<TRow, K>,
  flex: number | { when: (ctx: ColumnRuleContext<TRow>) => number }
): void;
```

- **Concern:** per-column `width` / `flex` / `minWidth` / `maxWidth`; feeds the UI-layer resize
  directive.
- **AG-Grid analog:** `width`, `flex`, `minWidth`, `maxWidth` — first-class per-column state;
  `columnFlexService.ts` owns flex distribution.
- **`width`/`flex` mutually exclusive per column — flex wins if both set** (matches AG-Grid).
- **Biggest missing story:** the table has zero sizing model today.
- **`min`/`max` reducer link:** if the [metadata+reducer core](signal-forms-techniques.md#1--generic-metadata--reducer-instead-of-n-bespoke-apply--decided-2026-07-25--hybrid)
  is adopted, `opts.min`/`opts.max` fall out of `MetadataReducer.min`/`.max` for free instead of
  bespoke clamp code.

## `applyPinned` — freeze left / right (seeds `withColumnPinning()`, store-owned)

```ts
export function applyPinned<TRow, K extends Extract<keyof TRow, string>>(
  path: ColumnHandle<TRow, K>,
  pinned:
    | 'left' | 'right' | null
    | { when: (ctx: ColumnRuleContext<TRow>) => 'left' | 'right' | null }
): void;
```

- **Concern:** seeds a column id into `withColumnPinning()`'s `columnPinning: { left: string[];
  right: string[] }` state — a new table-level state slice, **not** a `ColumnDef` field. The UI
  layer reads the feature's start/center/end region derivation (mirroring TanStack's
  `row_getStartVisibleCells`/`row_getCenterVisibleCells`/`row_getEndVisibleCells`) to render pinned
  columns in a fixed rail.
- **AG-Grid analog:** `pinned` field (`ColumnPinnedType`); `pinnedCols.setColPinned`. AG-Grid keeps
  it on the column def because its column model is centralized internally either way (see
  `overview.md`'s AG-Grid-vs-TanStack framing) — this table follows TanStack instead,
  where pinning is an explicit logic-layer feature with its own state.
- **Why high demand:** freeze ID / action columns while scrolling wide tables. Extremely common, no
  plan today.
- **Store feature stub:** register `withColumnPinning()` in `1-state/architecture.md`'s feature
  table (state shape, `column_pin`/`column_getIsPinned`/`column_getPinnedIndex`-equivalent methods)
  before implementing this `apply*` — the seed has nothing to seed into otherwise.

## Summary

| Function | Ownership | Concern | AG-Grid analog | Note |
|---|---|---|---|---|
| `applyWidth` / `applyFlex` | column-owned (seed only; store-owned if resizable) | column sizing | `width` / `flex` / `minWidth` / `maxWidth`; `columnFlexService.ts` | mutually exclusive, flex wins |
| `applyPinned` | seeds `withColumnPinning()` store feature | freeze left / right | `pinned`, `pinnedCols.setColPinned` | not a `ColumnDef` field — table-level state |

## Open questions (Tier 2)

- [x] **Sizing state ownership** — RESOLVED 2026-07-25, using the pinning precedent above: width is
  a column-owned config seed (consumer CSS) by default. If resizable via a drag directive, promote
  it to a dedicated `withColumnSizing()` store feature — `applyWidth` then seeds that feature's
  initial per-column width state instead of a `ColumnDef` field, the same seed-into-a-feature
  pattern `applyPinned` uses. Static, non-resizable width stays on the column def / CSS; there is no
  in-between state.
- [x] **Reactive `applyWidth`/`applyPinned` demand** — RESOLVED 2026-07-31: static-only, consumer
  template/CSS owns width (matches Sizing state ownership resolution above). No store-driven
  reactive width. Revisit only if a resizable-column story lands (promotes to `withColumnSizing()`
  per the resolution above).
