# Step 1 — Expose `data` on `TableCore` for write-back

**PR scope:** Independent, deployable on its own.
**Task type:** code
**Stack:** angular
**Skills used:** angular-developer
**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/design-system/src/ui/table/engine/types.ts`
- `libs/shared/design-system/src/ui/table/engine/core.ts`

## Why This Step Exists

Resolves the write-access gap for issue #12 (D6/D12 in `../../2-decisions.md`). `updateRows`
(Step 2) must write through to the consumer's `WritableSignal<TRow[]>` (D3/D4), but
`TableCore`/`TableStore` currently expose only the pipeline output (`rows`), never the raw
`data` signal — issue #11's data-ingress rework deliberately left this out as a non-goal. This step adds it,
engine-internal only: `TableCore.data` is not part of the public `TableStore` contract in
`api/types.ts`, matching the "no private store members, but an engine-internal field is fine"
carve-out in `table/CLAUDE.md`.

## What To Do

1. `engine/types.ts`
   - Add `readonly data: WritableSignal<TRow[]>;` to `TableCore<TRow>`. Import
     `WritableSignal` from `@angular/core` alongside the existing `Signal` import.
   - One-line comment: this is read by `updateRows`/`updateColumns`-style free functions via a
     typed cast (`api/row-mutations.ts`, Step 2) — never assigned to publicly on `TableStore`.

2. `engine/core.ts`
   - In `createTableCore()`, add `data: config.data,` to the returned `core` object (alongside
     `columns`, `rows`, `trackBy`). `config.data` is already the `WritableSignal<TRow[]>` — no
     new signal, just exposing the existing reference.

## Implementation Notes

- `composeTable()` (`engine/compose-table.ts`) spreads `handle.core` into the returned store
  object and casts the result to `TableStore<TRow>` — no edit needed there. The `data` field
  will physically exist on every store instance at runtime but stays untyped on the public
  `TableStore<TRow>` surface, exactly like the `OmitPrivate` pattern `table/CLAUDE.md`
  describes for engine-only members.
- Do not add `data` to `api/types.ts`'s `TableStore<TRow>` — that would make it part of the
  public consumer contract, which D3/D4 explicitly reserve for the consumer's own signal
  reference, not something read off the store.

## Risks / Watchouts

- `TableCore<TRow>` is structurally duck-typed elsewhere (feature factories take `TableCore<TRow>`
  or a `Pick<...>` of it) — adding a field is additive and should not break existing feature
  signatures, but scan `api/features/*.ts` for any `Pick<TableCore<TRow>, ...>` that
  enumerates fields explicitly (none currently do; confirm this hasn't changed).

## Non-Goals

- Writing `updateRows` or any updater — that's Step 2.
- Exposing `data` publicly on `TableStore` — deliberately internal-only.

## Acceptance Checks

- [ ] `TableCore<TRow>.data: WritableSignal<TRow[]>` exists in `engine/types.ts`
- [ ] `createTableCore()`'s returned `core` object carries `data: config.data`
- [ ] `TableStore<TRow>` in `api/types.ts` is unchanged — `data` does not appear there
- [ ] `nx typecheck shared-design-system` passes

---

Depends on issue [#11 — data ingress rework](../issue-11-data-ingress/step-1-rework-data-ingress.plan.md) (shipped).

[Step 2: Row updaters and updateRows](step-2-row-updaters-and-updaterows.plan.md) →
