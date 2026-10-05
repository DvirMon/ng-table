# Step 3 — One recording runner, shared

**PR scope:** standalone. **Depends on:** Step 2 (same two `schema.ts`
files; the runner is extracted on top of the decoupled recorder).
**Parallel-safe with:** Step 4.

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/schema/run-schema.ts` (create)
- `libs/table/src/columns-schema/schema.ts` (edit)
- `libs/table/src/api/features/with-grouping/schema.ts` (edit)

## Why This Step Exists

`runColumnsSchemaFn` (`columns-schema/schema.ts:36-44`) and
`runGroupingSchemaFn` (`with-grouping/schema.ts:38-46`) are the same five
statements — open a session, build the path, run the fn, close, return the
rules — differing only in which typed path they hand over. Sorting is a
third caller once [#100](https://github.com/DvirMon/ng-table/issues/100)
lands (G69), and it is blocked on this file existing.

This is node **M2** in [`decisions.md`](../../decisions.md), under
reading **B**: the _recording_ form gets one runner. The _declaring_ form
keeps `buildFiltersPath` / `keyRules` in `engine/filters/build.ts` until
`stageSchema` (ADR-0020, #102) is a second caller — recorded in Step 1.

Behaviour-preserving. Both wrappers keep their names, signatures and return
types, so the nine `runGroupingSchemaFn` call sites in
`with-grouping/schema.spec.ts` compile untouched (AC #8).

## What To Do

### 1. Create `libs/table/src/schema/run-schema.ts`

```ts
import { createRecorderSession, type PathRecorder } from './path-proxy';

/**
 * Runs a recording-form schema fn once, synchronously, through a fresh
 * recorder session and returns the rules it recorded. The one body behind
 * every recording-form schema — `columnSchema()`, `withGrouping()`, and
 * `withSorting()` once #100 lands.
 *
 * `buildPath` owns the handle shape, so each key space keeps its own
 * handle type (`ColumnHandle`, `GroupingHandle`) and its own single,
 * well-typed proxy cast. See #111 reading B.
 */
export function runRecordedSchema<TRow, TRule, TPath>(
  buildPath: (recorder: PathRecorder<TRow, TRule>) => TPath,
  fn: (path: TPath) => void,
): readonly TRule[] {
  const session = createRecorderSession<TRow, TRule>();
  fn(buildPath(session.recorder));
  session.close();
  return session.rules;
}
```

### 2. `columns-schema/schema.ts`

`buildColumnsPath` stays exactly as it is — it declares what a
`ColumnHandle` is, which is columns' own concern. Only the runner's body
moves:

```ts
export function runColumnsSchemaFn<TRow, TId extends string, TRule = ColumnRule<TRow>>(
  fn: (path: ColumnsPath<TRow, TId, TRule>) => void,
): readonly TRule[] {
  return runRecordedSchema<TRow, TRule, ColumnsPath<TRow, TId, TRule>>(
    (recorder) => buildColumnsPath<TRow, TId, TRule>(recorder),
    fn,
  );
}
```

`createRecorderSession` is no longer used directly here — drop it from the
import list at `:8-13`, but **keep the re-export on `:15`**, which is a
separate statement and part of this module's surface.

### 3. `with-grouping/schema.ts`

Same shape. `buildGroupingPath` stays put (D7 — a grouping schema fn never
sees a `ColumnHandle`, and this file imports nothing from the columns
schema):

```ts
export function runGroupingSchemaFn<TRow>(
  fn: GroupingSchemaFn<TRow>,
): readonly AnyGroupingRule<TRow>[] {
  return runRecordedSchema<TRow, AnyGroupingRule<TRow>, GroupingPath<TRow>>(
    (recorder) => buildGroupingPath<TRow>(recorder),
    fn,
  );
}
```

Drop `createRecorderSession` from the import at `:3-9`; add
`runRecordedSchema` from `'../../../schema/run-schema'`.

The doc comment on `runGroupingSchemaFn` currently says it "Mirrors
`column-schema.ts`'s `runColumnsSchemaFn`". It no longer mirrors it — it
shares a body with it. Reword, and drop the stale `column-schema.ts`
filename (the file is `columns-schema/schema.ts`).

## Implementation Notes

- **Why `buildPath` is a parameter rather than a `makeHandle` callback
  inlined into the runner.** Folding the handle literal into
  `run-schema.ts` would make the runner return `Record<string, THandle>`,
  which has to be cast to an unresolved `TPath` — i.e. `as unknown as
TPath`, a _new_ double cast, immediately after Step 2 removed two. With
  `buildPath` as a parameter each module keeps the one narrow cast it
  already has (`createPathProxy(...) as ColumnsPath<…>`), and the shared
  body has none.
- **What is left duplicated, and why that is not the duplication #111
  names.** `buildColumnsPath` and `buildGroupingPath` are three lines each
  and look alike. They are not the same statement: each declares its own
  handle type, and `GroupingHandle` being distinct from `ColumnHandle` is
  a decision (D7), not an accident waiting to be deduped. The runner was
  the duplicated _logic_.
- **The wrappers are kept, not inlined into their callers.** `columnSchema()`
  and `withGrouping()`'s `feature.ts:110` call them by name, as do the
  grouping specs. Keeping them is what makes AC #8 true with no spec edit.

## Risks / Watchouts

- `runRecordedSchema`'s parameter order is `(buildPath, fn)`. Passing the
  schema fn first typechecks in neither direction, but a partially-applied
  helper written the other way round will confuse the sorting slice later —
  keep the order.
- Do not export `runRecordedSchema` from `libs/table/src/index.ts`. #102
  (ADR-0020 open stage registration) is what would export it, and it is a
  different epic — `issue-graph.md`'s "Not in this epic".
- `session.rules` is the live array the recorder pushes into. Returning it
  directly is what the two existing runners already do; `withGrouping()`
  copies with `[...]` at its own call site (`feature.ts:110`). Do not add a
  defensive copy inside the runner — that is a behaviour change to the
  columns path, which does not copy.

## Non-Goals

- No `runDeclaredSchema`, no `keyDeclarations` — reading B, recorded in
  Step 1. `engine/filters/build.ts` is untouched by this slice.
- No change to `createPathProxy`, `createRecorderSession` or `recorderOf`.
- No sorting consumer — that arrives with #100.

## Acceptance Checks

- [ ] `libs/table/src/schema/run-schema.ts` exists and holds the only
      session-open/run/close body in `src` (AC #4).
- [ ] `createRecorderSession` is called from exactly one place in `src`.
- [ ] `runColumnsSchemaFn` and `runGroupingSchemaFn` keep their exported
      signatures and return types (AC #8).
- [ ] No `expect(...)` in any existing spec was edited; the nine
      `runGroupingSchemaFn` call sites in `with-grouping/schema.spec.ts`
      are unchanged.
- [ ] The path proxy, the handle and the recorder session are reached by
      both forms through `schema/` (AC #5) — grouping and columns through
      the runner, filtering through `createPathProxy` as it already does.
- [ ] `nx run shared-table:typecheck` clean — **run twice**.
- [ ] `nx run shared-table:typecheck-spec` clean.

---

← [Step 2: Decouple `path-proxy.ts`](step-2-decouple-path-proxy.plan.md) | [Step 4: Shared identifier check](step-4-shared-identifier-check.plan.md) →
