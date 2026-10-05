---
title: 'Step 1 — Filter types'
type: task-step
issue: 61
---

# Step 1 — Filter types

**PR scope:** Standalone. Every later step depends on this one; nothing depends on it in reverse.

**Task type:** code

**Skills used:** typescript-conventions (explicit return types, no `any`), file-organization (`<feature>.types.ts` concern split)

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/api/filters.types.ts` (new)

## Why This Step Exists

Every other file in this issue (`matchers.ts`, `create-filters.ts`, `rules.ts`) imports shapes declared here. Writing it first, alone, matches `schema/column-schema.types.ts`'s role as the type-only foundation `column-schema.ts`/`column-rules.ts` build on.

## What To Do

1. Public state types, matching `filters.md`'s "State" section exactly:

   ```ts
   export interface FilterOptions<TSource = unknown> {
     readonly source?: () => TSource;
     readonly as?: string;
   }

   export interface FilterNode<TCriterion> {
     value: WritableSignal<TCriterion>;
     active(): TCriterion | undefined; // undefined when this filter's criterion is empty
     reset(value?: TCriterion | null): void;
     dirty(): boolean;
   }
   ```

   `active()` returning `undefined` (rather than omitting a key) is the per-filter primitive that
   `Filters<TRow>.active()` (root) composes into "empties omitted" (filters.md §State).

2. Root `Filters<TRow>` type — callable (root state) + indexable (child nodes), mirroring
   `ColumnsPath<TRow>`'s split between property access and call:

   ```ts
   export interface FiltersRoot<TRow> {
     value(): TRow extends unknown ? Record<string, unknown> : never; // see note below
     active(): Record<string, unknown>;
     reset(value?: Record<string, unknown> | null): void;
     dirty(): boolean;
   }

   export type Filters<TRow> = (() => FiltersRoot<TRow>) & {
     readonly [key: string]: FilterNode<unknown> | (() => FilterNode<unknown>);
   };
   ```

   Treat the exact root-`value()`/child-key typing as a spike inside this step, not a copy-paste:
   the real shape is **derived from the compiled rule list** (each rule contributes one key to
   the root's flat state object — `{ status: ..., amount: {min,max}, search: ... }` per
   `filters.md`'s Keys section), which is only knowable once `create-filters.ts` (Step 4) resolves
   keys from paths/`anyOf`/`as`. Model this the same way `ComposedFeatureMembers` in `api/types.ts`
   reconstructs a runtime-length feature array's static member type (ADR-0003) — a mapped/inferred
   type driven by the schema fn's recorded calls, not a hand-written interface. Get this type
   right before writing Step 4; it is the hardest part of this step.

3. Internal recorder/session types — **do not reuse `schema/column-schema.types.ts`'s
   `ColumnSchemaRecorder`/`ColumnHandle`/`COLUMN_RECORDER`.** They're shaped for
   `MetadataRule`/`MetadataAsyncRule` (column-metadata concerns: `ColumnRuleContext`,
   `ResourceRef`). Filters need their own parallel recorder carrying a different rule shape, and
   `createFilters()` must work with zero `ColumnDef`/`baseColumns` in scope (server mode: filters
   exist before any table). Reusing the column-schema module would mean widening its recorder to
   a rule union it has no reason to know about, coupling an already-shipped, unrelated feature to
   this one. Declare instead:

   ```ts
   /** @internal */
   export const FILTER_RECORDER: unique symbol = Symbol('FILTER_RECORDER');

   /** @internal */
   export interface FilterSchemaRecorder<TRow> {
     record(rule: FilterRuleRecord<TRow>): void;
   }

   export interface FilterHandle<
     TRow,
     K extends Extract<keyof TRow, string> = Extract<keyof TRow, string>,
   > {
     readonly id: K;
     /** @internal */
     readonly [FILTER_RECORDER]: FilterSchemaRecorder<TRow>;
   }

   export type FiltersPath<TRow> = {
     readonly [K in Extract<keyof TRow, string>]: FilterHandle<TRow, K>;
   };
   ```

4. The internal compiled-rule record every rule function (Step 5) pushes into the recorder, and
   `create-filters.ts` (Step 4) consumes to build state:

   ```ts
   /** @internal */
   export interface FilterRuleRecord<TRow, TCell = unknown, TCriterion = unknown> {
     readonly key: string; // resolved later — borrowed from path, or `as`, or anyOf's positional key
     readonly paths: readonly string[]; // one entry, except `anyOf` groups (R8/R9)
     readonly predicate: (cell: TCell, criterion: TCriterion) => boolean;
     readonly isEmpty: (criterion: TCriterion) => boolean; // per-predicate emptiness test (R14)
     readonly options?: FilterOptions;
     readonly kind: 'single' | 'group' | 'conditional';
   }
   ```

   Exact fields are a starting point — adjust once Step 4/5 reveal what `anyOf`/`applyWhen`
   actually need (e.g. `applyWhen`'s condition callback, `anyOf`'s child records). Keep whatever
   you land on `@internal` and out of `index.ts`.

## Implementation Notes

- Nothing here is exported from `index.ts` except `Filters`, `FilterNode`, `FilterOptions` (per
  `filters.md`'s Public API table) — `FilterHandle`, `FiltersPath`, `FilterSchemaRecorder`,
  `FILTER_RECORDER`, `FilterRuleRecord` are internal, consumed only by `create-filters.ts` and
  `filters/rules.ts`.
- Use type guards / `as const` discriminators for `kind`, never a bare `as` assertion
  (`typescript-conventions.md`).

## Risks / Watchouts

- The root `Filters<TRow>`/`FiltersRoot<TRow>` type is the one genuinely hard type-level problem
  in this issue — don't rush it to unblock Step 4. If the "derive keys from recorded rules"
  approach fights TypeScript's inference, fall back to `Filters<TRow, TState extends
Record<string, unknown>>` with `TState` supplied by the consumer as a second type parameter to
  `createFilters<TRow, TState>(...)`, and document that as a deliberate simplification.

## Non-Goals

- No matcher implementations (Step 2), no rule functions (Step 5), no factory (Step 4) — types
  only.

## Acceptance Checks

- [ ] `FilterOptions`, `FilterNode`, `Filters` exported and match `filters.md`'s public shape
- [ ] Internal recorder/session/record types are `@internal`, not re-exported from `index.ts`
- [ ] No import from `schema/column-schema.types.ts`
- [ ] `tsc --noEmit` passes with no new errors (file compiles standalone — no other filters file exists yet, so this only checks internal consistency)

---

[Step 2: Matchers](step-2-filters-matchers.plan.md) →
