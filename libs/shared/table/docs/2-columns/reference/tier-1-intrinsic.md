---
title: Columns Schema — Tier 1 Intrinsic (column-owned)
type: architecture
version: 0.1
date: 2026-07-24
status: drafted — spec only, not yet implemented
audience: developers
parent: ../2-columns/architecture.md
---

# Tier 1 — Intrinsic (column-owned)

**No store feature exists for these; the column definition is their sole home.** Present on *every*
column, always, with a default. The column schema exists to manage them. This is the first-impl
scope. Read [Ownership model](ownership-model.md) first — every function below is seed-or-rule.

## `applyVisible` — show / hide (reactive/async only — static goes on the array)

```ts
export function applyVisible<TRow, K extends Extract<keyof TRow, string>>(
  path: ColumnHandle<TRow, K>,
  visible: { when: (ctx: ColumnRuleContext<TRow>) => boolean }
): void;

export function applyVisibleAsync<TRow, K extends Extract<keyof TRow, string>, TParams, TResult>(
  path: ColumnHandle<TRow, K>,
  opts: {
    params: (ctx: ColumnRuleContext<TRow>) => TParams | undefined;
    factory: (params: Signal<TParams | undefined>) => ResourceRef<TResult | undefined>;
    onSuccess: (result: TResult) => boolean;
    onError?: (error: unknown) => boolean;
  }
): void;
```

- **Concern:** column `visible` state — whether the column renders.
- **Default / static override:** `visible: true`, set directly on the array (`{ id: 'x', visible:
  false }`) — not through the schema. `applyVisible` only exists for the reactive case.
- **AG-Grid analog:** `hide` field + `_setColsVisible` (visibility can't change membership/order, so
  it skips the full rebuild).
- **Async semantics:** mirrors Signal Forms' `validateAsync` (`params` / `factory` / `onSuccess` /
  `onError`). On loader throw, `onError` (if provided) decides the resulting `visible` via
  `updateColumns()`, same path as `onSuccess`. Omit `onError` → the column holds its last-resolved
  `visible` (documented, not a silent failure).

## `label` — array-only, static ✅ decided 2026-08-03

**Not yet on `ColumnDef`.** Column header text. Same ownership call as `applyOrder`: no
`apply*` in the schema. `label: string` belongs on `ColumnDef`/`ColumnDefInput` (array-only,
static, defaults to `id` if unset — same optionality posture as `accessor`/`visible`/`order` in
`resolveColumnDefs()`). No reactive/async case has surfaced yet — revisit only if a real
i18n/locale-switch demand shows up (would then follow `applyVisible`'s reactive-only precedent,
same reasoning as [ownership-model.md](ownership-model.md)).

## `applyOrder` — removed ✅ decided 2026-07-25

**Dropped from `columnsSchema` entirely.** Order has no static role in the schema (static goes on
the array — `{ id, order }`, or is left to the array-index default) and no credible reactive/async
role ever surfaced — [the open question below](#open-questions-tier-1) that used to sit here is now
answered by elimination. Order stays 100% core config: array-index default (`resolveColumnDefs()` in
`api/create-table.ts`) + runtime mutation only via `reorderColumns()` (drag-drop, or any future
pinning-driven reposition). See [ownership-model.md](ownership-model.md#columnsschema-is-reactiveasync-only--decided-2026-07-25).

## Summary

| Function | Concern | AG-Grid analog | Static override | Reactive/async |
|---|---|---|---|---|
| `applyVisible` (+`applyVisibleAsync`) | show / hide | `hide`, `_setColsVisible` | array `visible` field, default `true` | ✅ schema |
| ~~`applyOrder`~~ | display order | `colsList` reorder | array `order` field / array-index default | ❌ removed — no schema path |
| ~~`applyLabel`~~ | header text | `headerName` | array `label` field, default `id` | ❌ no schema path — array-only, static |

## Open questions (Tier 1)

- [x] **~~Reactive `applyOrder` demand.~~** RESOLVED 2026-07-25 by removing `applyOrder` — no case
  ever surfaced, so the question is moot rather than answered either way.
