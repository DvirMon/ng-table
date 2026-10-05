---
title: 'Step 1 — expose renderRows on TableCore'
type: task-step
issue: 65
---

# Step 1 — expose `renderRows` on `TableCore`

**PR scope:** Engine seam only, no feature behavior. **Parallel-safe with Step 2** — they touch
different files and neither reads the other.

**Task type:** code

**Skills used:** angular-developer, file-organization

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/engine/types.ts` (edit)
- `libs/shared/table/src/engine/core.ts` (edit)

## Why This Step Exists

D16.1 constraint 2 requires `rowsOf` to **read `renderRows()`**, so a consumer's `computed()`
tracks every pipeline change. A feature factory receives `core: TableCore<TRow>` — and
`TableCore` has no `renderRows`. Today the computed is built in `createTableCore()` but handed
out only on `TableCoreHandle`, and `composeTable()` attaches it to the store object
(`compose-table.ts:111`). No feature can reach it.

The second factory parameter (`composed`) is not an alternative: it holds only _feature_ members,
and `renderRows` is core.

Decision: `../../../2-decisions.md` D16 / D16.1.

## What To Do

### 1. Add the member to the feature-facing core contract

`engine/types.ts`, on `TableCore<TRow>`, next to `rows`:

```ts
  /** The render-layer output every render stage chain produced, `index`/`sourceIndex` already
   * stamped. Same lazy-computed safety as `rows`: reading it from a member function or
   * `computed()` sees the complete stage registry. */
  readonly renderRows: Signal<RenderRow<TRow>[]>;
```

`RenderRow` needs adding to the existing `import type { … } from '../api/types'` block.

### 2. Put the existing computed on the core object

`engine/core.ts` — the `renderRows` computed already exists (`core.ts:65`). Add it to the `core`
object literal (`core.ts:78-92`). `TableCoreHandle.renderRows` keeps returning **that same
computed reference**, so `composeTable()` and every existing reader are untouched.

## Implementation Notes

- One computed, two references — do not create a second `computed()` for the core member, or a
  feature and the store would track separate (equal-valued) nodes.
- `TableCoreHandle` keeps its own `renderRows` field: `composeTable()` reads it there, and
  narrowing that to `handle.core.renderRows` is an unrelated cleanup. Out of scope.

## Risks / Watchouts

- **Do not reorder the `core` object relative to the `renderRows` computed declaration** — the
  computed is declared above the object literal for a reason; referencing it before declaration
  is a TDZ error, not a type error.
- This widens what _every_ feature can read. That is intended (`rows` is already there on the
  same terms), but it means a future feature can now close over render output — the existing
  "lazy computed, registry complete at evaluation time" note in the `TableCore` doc comment
  covers it; don't add a second caveat.

## Non-Goals

- No `rowsOf`, no grouping change (Steps 2–3).
- No change to `TableStore`'s public `renderRows` — it is already exported and unchanged.

## Acceptance Checks

- [ ] `TableCore<TRow>` declares `renderRows: Signal<RenderRow<TRow>[]>`.
- [ ] `createTableCore()` returns that same computed on both `core` and the handle (identity, not
      a copy).
- [ ] `compose-table.ts` is unchanged.
- [ ] `tsc --noEmit` passes with no new errors.

---

[Step 2: rowsBeneathGroup() engine walk](step-2-engine-rows-beneath-group.plan.md) →
