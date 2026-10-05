---
title: 'Step 3 — enableRowSelection() write-path gate (D58)'
type: task-step
issue: 63
---

# Step 3 — `enableRowSelection()` write-path gate (D58)

**PR scope:** Parallel-safe with Step 5 (docs step documents an already-settled decision, doesn't read this file).

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/api/features/with-selection.ts` (edit)

## Why This Step Exists

D58 (`2-decisions.md`) settles that row selectability ships as `enableRowSelection`, a
write-path gate with the same shape and resolution pattern as `enableMultiRowSelection`. This
step is the implementation of that decision — nothing here is a new design choice.

## What To Do

1. Add to `WithSelectionConfig<TRow>`, above `enableMultiRowSelection` (D58's own field order):
   ```ts
   /** Whether a row may be selected at all. Default: `true`. */
   enableRowSelection?: boolean | ((row: TRow) => boolean);
   ```
2. Resolve it into a `canSelect: (row: TRow) => boolean` predicate exactly the way
   `multiSelectConfig` resolves into `canMultiSelect` (ternary on `typeof`).
3. Add a gate function reusing the existing `resolveRow` helper:
   ```ts
   function applyRowSelectionGate(ids: readonly RowId[]): readonly RowId[] {
     return ids.filter((id) => {
       const row = resolveRow(id);
       return row === undefined || canSelect(row);
     });
   }
   ```
   The `row === undefined` branch is D8's permissive-when-unresolved rule — copy the same
   condition `applyMultiSelectRule` already uses, don't reinvent the check.
4. Wire the gate into exactly the three id-adding paths named in D58, running it **before**
   `applyMultiSelectRule`:
   - `toggle`'s add branch — gate `[id]` before it joins `previous`.
   - `select(ids)` — gate `ids` before `[...previous, ...ids]`.
   - The `initialSelection` seed — gate `config.initialSelection ?? []` before it reaches
     `applyMultiSelectRule`.
5. Do not touch `deselect`, `clearSelection`, `selectedRows`, `selectionStateOf`, or
   `onRowsRemoved` — D58 scopes the gate to id-adding writes only, write-path not read-path, no
   reconcile.

## Implementation Notes

- Gate ordering matters conceptually, not just mechanically: the gate decides _which ids may be
  added at all_; `applyMultiSelectRule` then truncates what survives. Running gate-then-rule
  keeps the two independent, matching D58's "same shape... applied the same way" framing.
- A gated-out `toggle`/`select` naturally reduces to a no-op: if every requested id is filtered
  out, the resulting candidate set equals `previous`, and `applyNextSelection`'s existing
  added/removed-both-empty early return handles it. Don't add a second no-op branch — the
  acceptance criteria explicitly calls this out as "falls out of the existing guard."

## Risks / Watchouts

- Don't gate `deselect`/`clearSelection` — D58 requires a row that becomes non-selectable while
  selected to stay escapable.
- Don't filter `selectedRows()` or `selectionStateOf()` — Q4 (denominator filtering) is an open
  question in `2-decisions.md`, not answered by this issue.
- Don't add reconciliation for a row that becomes non-selectable while selected — D58 "No
  reconcile," explicitly rejecting AG Grid's approach.

## Non-Goals

- `selectionStateOf(ids)` denominator filtering (Q4, open question) — not this issue.
- Reconciling an already-selected row that becomes non-selectable (D58 "No reconcile").
- The UI-layer `[disabled]` binding on `ngpTableSelectionCheckbox` — belongs to
  `docs/3-ui/directives/selection.md` per the issue's own "Out of scope."

## Acceptance Checks

- [ ] `enableRowSelection` added to `WithSelectionConfig<TRow>`, defaulting to `true`, resolved
      into a `canSelect(row)` predicate the way `canMultiSelect` already is.
- [ ] Gate applied only to `toggle`, `select`, and the `initialSelection` seed.
- [ ] Permissive when the id resolves to no row (D8 untouched).
- [ ] No read-path gate on `selectedRows()`/`selectionStateOf()`.
- [ ] No reconcile added to `onRowsRemoved`.
- [ ] `tsc --noEmit` passes for the file.

---

← [Step 2: withSelection() colocated spec](step-2-with-selection-spec.plan.md) | [Step 4: enableRowSelection() spec coverage](step-4-enable-row-selection-spec.plan.md) →
