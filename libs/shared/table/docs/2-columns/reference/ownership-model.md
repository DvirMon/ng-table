---
title: Columns Schema — Ownership Model (every `apply*`)
type: architecture
version: 0.1
date: 2026-07-24
status: drafted — spec only, not yet implemented
audience: developers
parent: ../2-columns/architecture.md
---

# Columns Schema — Ownership Model

The contract every `apply*` function obeys, regardless of tier. Read this before any tier file.

## `columnsSchema` is reactive/async only ✅ decided 2026-07-25

**Static column config never goes through `columnsSchema` — it goes on the `columns` array
(`ColumnDefInput<TRow>`, only `id` required, `accessor`/`visible`/`order` default and are set
directly as object literals).** `columnsSchema`'s entire value proposition is the wiring it gives —
`effect()`/`resource()`/store-owned `updateColumns()` calls — over something that changes. A static
value gets none of that: same outcome, same resolution timing as a literal on the array, just paid
for with a function call, a path-proxy lookup, and an import. Routing statics through the rules
layer is the wrong tool for the job, not a style choice — see the design-session reasoning this
decision is drawn from. This also removes the "which place do I write this" ambiguity: static → the
array, needs to react to something → the schema. One fact, one home.

Confirmed with the array already this terse (defaults ship in `api/create-table.ts`'s
`resolveColumnDefs()`), there's even less reason for the schema to also carry statics — the cheap
path already exists.

**Consequence for `applyOrder` (Tier 1):** removed from `columnsSchema` entirely — see
[tier-1-intrinsic.md](tier-1-intrinsic.md). No credible reactive or async case for column order ever
surfaced (Tier 1's own open question flagged this before the narrowing); order stays 100% core
config — array-index default + `reorderColumns()` mutation, same as today, no schema involvement.

## Two roles, never conflated

- **Config seed** — a build-time value written into a *feature's* initial state at construction
  (not `ColumnDef` — that's the array's job now). `applyPinned` (Tier 2) is the example: it seeds
  `withColumnPinning()`'s `columnPinning: {left, right}` state, which has no array-literal
  equivalent — see [tier-2-layout.md](tier-2-layout.md). Static; no reactivity.
- **Rule** — a store-owned reactive/async binding that calls `updateColumns()` when its source
  changes.

A single `apply*` call is *either* a seed (only for properties with no `ColumnDef`/array home, e.g.
pinning) or a rule (reactive/async on a `ColumnDef` field), decided by which property it targets.

## One law: the store always owns reactivity

Every `apply*` accepts up to two input shapes (narrowed from three — static dropped, see above),
all routing to the same store-owned patcher:

| Input shape | Wiring | Example |
|---|---|---|
| **reactive** `{ when: () => T }` | store `effect()` → `updateColumns()` on change (live) | `applyVisible(path.status, { when: () => role() === 'admin' })` |
| **async** `{ params, factory, onSuccess, onError }` | store `resource()` + `effect()` → `updateColumns()` | `applyVisibleAsync(path.status, {...})` |

> **`{ when }` object form, not a bare function.** Signal Forms deprecated passing a raw function to
> `hidden`/`disabled` (`packages/forms/signals/src/api/rules/hidden.ts:45-50`) precisely because the
> `boolean | fn` overload is ambiguous. Adopt the object form for the reactive shape. See
> [Signal Forms techniques](signal-forms-techniques.md#3--when-object-form-not-bare-fn).

**Seeds keep a static input** (e.g. `applyPinned(path.id, 'left')`) — the narrowing above only
removes static from *rule* functions that duplicate an existing `ColumnDef`/array field. A seed like
`applyPinned` has no array-literal equivalent to defer to (pinning isn't a `ColumnDef` field at
all), so its one and only input shape is the static value it seeds into the target feature's initial
state. No duplication exists there, so nothing to narrow.

Reactive resolution consequence: the "function form evaluated once, eagerly" divergence flagged in
early drafts is gone — the reactive shape is genuinely live because the store owns the `effect()` at
construction, not the schema fn at module scope.

## Snapshot-then-diff patcher underneath

Every rule resolution writes through an `applyColumnState`-style patcher, **not** a raw array
replace. Modeled on AG-Grid's `captureColumnStateChanges` → mutate → `dispatchColStateChanges`
(fetched `ag-grid/ag-grid` source, `packages/ag-grid-community/src/columns/columnStateUtils.ts`):
snapshot the affected columns' prior scalar state, apply, diff, and fire the granular per-property
change event **only for columns that actually changed**. This is what removes the original
flash-then-hide UX bug and gives per-property change events for free.

## Async variants are not built speculatively

Ship the static + reactive shape for every feature. Add an `apply*Async` variant only when a real
permission/role case demands it. The recorder pattern (see
[the standalone `columnSchema()` helper](../2-columns/architecture.md#columnschema--the-standalone-helper))
makes each async variant cheap to add later — one rule type + one function, landing in
`api/column-rules.ts`.

## Conflict handling — decided: reducer-combine

Two rules targeting the same column property **combine via a reducer** (Signal Forms' model), not
build-time rejection — decided 2026-07-25, see
[Signal Forms techniques §2](signal-forms-techniques.md#2--reducers-replace-conflict-rejection-decided-2026-07-25--reducer-combine-reverses-the-earlier-settled-decision).
Each `MetadataKey` (§1's generic core) carries its own reducer; `visible` defaults to `and`. This
supersedes the hub's earlier "reject at build time" Decisions entry.
