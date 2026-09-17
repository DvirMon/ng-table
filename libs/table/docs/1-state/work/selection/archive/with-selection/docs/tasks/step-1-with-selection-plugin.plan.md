---
title: "Step 1 — withSelection() feature plugin"
type: task-step
issue: 55
---

# Step 1 — `withSelection()` feature plugin

**PR scope:** Standalone. No dependency on Step 2 to merge (tests land after), but Step 2 depends on this step's public shape.

**Task type:** code

**Skills used:** angular-developer (signals/DI conventions), file-organization (single-file feature plugin, matching `with-expansion.ts` precedent)

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/api/features/with-selection.ts` (new)
- `libs/shared/table/src/index.ts` (edit — export the new feature + its public types)

## Why This Step Exists

`withSelection()` is the single largest baseline gap in the state layer (spec Problem Statement) and unblocks the bulk row verbs (`removeRow(id[])`/`patchRow(id[], partial)`, D12 — separate ticket). This step delivers the whole state-layer contract in one file, following the exact shape every other `with-*()` plugin uses — no engine changes, no new file-organization split beyond what `with-expansion.ts` already establishes as precedent for this codebase.

## What To Do

1. Define config + public types, matching the spec's "Public surface" section exactly:

   ```ts
   export interface WithSelectionConfig<TRow> {
     enableMultiRowSelection?: boolean | ((row: TRow) => boolean);   // default true
     initialSelection?: RowId[];
   }

   export interface SelectionChange {
     readonly added: readonly RowId[];
     readonly removed: readonly RowId[];
   }

   export interface SelectionWriteOptions {
     emitEvent?: boolean;                                            // default true
   }

   export interface SelectionMembers {
     readonly selectedRows: Signal<ReadonlySet<RowId>>;
     readonly selectionChanged: Observable<SelectionChange>;
     toggle(id: RowId, opts?: SelectionWriteOptions): void;
     select(ids: RowId[], opts?: SelectionWriteOptions): void;
     deselect(ids: RowId[], opts?: SelectionWriteOptions): void;
     clearSelection(opts?: SelectionWriteOptions): void;
     selectionStateOf(ids: readonly RowId[]): 'none' | 'some' | 'all';
   }
   ```

2. Narrow the core input like `with-expansion.ts`'s `ExpansionInput`:
   `type SelectionInput<TRow> = Pick<TableCore<TRow>, 'rows' | 'trackBy'>`. `rows` (pipeline output) is what the multi-select predicate resolves a row against — find by `trackBy(row) === id`; when no row resolves, the predicate defaults permissive (D8).

3. Internal state, all closure-local (no engine-managed state, per the plugin pattern):
   - `const selectedIds = signal(new Set<RowId>())`
   - `const selectionChangedSource = new Subject<SelectionChange>()` — **must be a plain `Subject`, never `ReplaySubject`/`BehaviorSubject`** (D16 constraint #2 — a replaying variant would deliver construction state to every late subscriber).

4. Resolve the multi-select predicate once at factory time from config:
   ```ts
   const canMultiSelect = typeof config.enableMultiRowSelection === 'function'
     ? config.enableMultiRowSelection
     : () => config.enableMultiRowSelection ?? true;
   ```
   Evaluated per-id inside each write verb against the row resolved from `core.rows()` (step 2) — never cached, never evaluated once for a whole call.

5. Write a single internal apply function all four write verbs funnel through, so the emit-delta/no-op/collapse rules (D9, D14, D15) live in one place:
   - Compute the next `Set<RowId>` for the requested op (add ids / remove ids / replace-with-last-id when the multi predicate is false for any requested id / clear).
   - **Multi-select rule (D2/D14):** for `toggle`/`select`, if `canMultiSelect` is `false` for *any* target row involved in a multi-id write, keep only the last id in the write's `ids` array, discarding the rest. Under `ngDevMode`, throw naming the discarded ids (`typeof ngDevMode === 'undefined' || ngDevMode` guard, matching Angular's own convention — no other file in this package uses this guard yet, so this introduces the pattern per D14). In production, truncate silently.
   - Diff previous vs. next set to get `added`/`removed` (D15: no-op → both empty → skip the signal write and the emission).
   - `selectedIds.set(next)` only when it actually changed.
   - Emit `{ added, removed }` on `selectionChangedSource` unless `opts?.emitEvent === false` (D18) or the delta is empty (D9/D15).

6. Implement the four write verbs and `selectionStateOf` on top of that internal function:
   - `toggle(id, opts)` — single id; add if absent, remove if present; multi-select rule applies (D2).
   - `select(ids, opts)` — bulk add; dedupe (D15); multi-select rule applies (D14).
   - `deselect(ids, opts)` — bulk remove; dedupe; multi-select rule does not apply to removal (removing never violates single-select).
   - `clearSelection(opts)` — empty the set; no-op (emits nothing) if already empty.
   - `selectionStateOf(ids)` — `'none'` if none of `ids` are in `selectedIds()`, `'all'` if every one is, `'some'` otherwise; ids outside the given set must not affect the result (D7).

7. `initialSelection` (D16): write `new Set(config.initialSelection ?? [])` **directly into the `selectedIds` signal at construction** — never route through `select()` (which emits). Apply the D14 multi-select truncation rule to the seed too (dev-mode throw included), since it is a write in every sense except emission.

8. `onRowsRemoved(ids)` (ADR-0006/D11): prune `selectedIds` via `pruneByIds` (`engine/rows.ts`), no exemption. Do **not** emit `selectionChanged` — this is reconciliation, not a write verb.

9. `onDestroy`: `selectionChangedSource.complete()` (D17).

10. Return the `TableFeatureSpec<TRow, SelectionMembers>` — `members`, `onRowsRemoved`, `onDestroy`. No `stages`, no `renderStages` (D5 — selection is never stamped onto `RenderRow`, never claims a render stage).

11. Export from `libs/shared/table/src/index.ts`, matching the existing export style for `withExpansion`/`withRowEdit`:
    ```ts
    export { withSelection } from './api/features/with-selection';
    export type {
      WithSelectionConfig,
      SelectionChange,
      SelectionWriteOptions,
      SelectionMembers,
    } from './api/features/with-selection';
    ```

## Implementation Notes

- Follow `with-expansion.ts`'s file shape closely (imports, `TableCore`/`TableFeatureSpec` annotated directly — do **not** use `createTableFeature`, per `CLAUDE.md`'s note that internal `with-*()` files annotate directly since `engine/` is already in scope).
- No render stage, no pipeline stage — this feature only contributes `members`, `onRowsRemoved`, `onDestroy`. Composing it alongside any other feature must never collide (`engine/slots.ts` already throws on a duplicate member name at construction — nothing extra to build here, just don't reuse an existing member key).
- `RowId = string | number` (`api/types.ts`) — already imported elsewhere as a type-only import; keep it type-only here too.
- Comments only where they explain a *why* that isn't obvious from the code (the D-references above are for this plan, not necessarily verbatim source comments — keep source comments terse, per repo convention. A short comment noting the "reconciliation is not a write verb, no emission" rule at the `onRowsRemoved` call site is warranted, mirroring `with-expansion.ts`'s existing comment style there).

## Risks / Watchouts

- **Do not reuse `select()`/`selectionChanged`-emitting code paths for `initialSelection`.** It's tempting to call `select(config.initialSelection)` in the constructor for DRY-ness — this is explicitly forbidden (D16 constraint #3) because `select()` emits.
- **Do not make `selectionChangedSource` a `ReplaySubject`/`BehaviorSubject`** even to make "read current state from the stream" convenient elsewhere — D16 forbids this explicitly; current state is read from `selectedRows()`, never carried in the stream.
- **The multi-select truncation must apply to every write verb that can add ids** (`toggle`, `select`, and the `initialSelection` seed) — not just `toggle`. `deselect`/`clearSelection` never add, so the rule is moot for them.
- Resolve the predicate's row lookup from `core.rows()` (pipeline output, already-sorted/filtered), not `core.value()` (raw data) — matches `with-expansion.ts`'s established pattern of reading `core.rows` for this kind of per-row lookup.

## Non-Goals

- No `RenderRow.isSelected` field, no render stage (D5) — out of scope per spec.
- No bulk `removeRow(id[])`/`patchRow(id[], partial)` (D12), no cascade/children accessor (D13), no persistence slice (D19), no UI directives (D6/H) — all tracked separately or explicitly out of scope.

## Acceptance Checks

- [ ] `withSelection<TRow>()` composes into `createTable()`'s `features` array with no engine changes.
- [ ] `selectedRows` is a `Signal<ReadonlySet<RowId>>`; `selectionChanged` is an `Observable<SelectionChange>` backed by a non-replaying `Subject`.
- [ ] `toggle`, `select`, `deselect`, `clearSelection` all accept `SelectionWriteOptions`; `selectionStateOf` takes `readonly RowId[]` and returns `'none' | 'some' | 'all'`.
- [ ] `initialSelection` is applied directly to the signal at construction, never via `select()`.
- [ ] `onRowsRemoved` prunes silently (no emission); `onDestroy` completes the subject.
- [ ] Exported from `index.ts` alongside its public types.
- [ ] `tsc --noEmit` (or the project's equivalent type-check) passes with no new errors.

---
[Step 2: withSelection() colocated spec](step-2-with-selection-spec.plan.md) →
