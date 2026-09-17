# Step 4 — The row carrier, the array schema, and the construction guard

**PR scope:** PR 1 of 2 (`#110`). **Depends on: Step 1, Step 2, Step 3.** **Blocks Step 5.**
**Task type:** `code`
**Stack:** angular
**Skills used:** `typescript-conventions`, `classify-errors-construction-vs-runtime`, `terse-jsdoc-for-ai-and-humans`
**Scaffolding agent:** `angular-implementer`

## Files

| File | Action |
|---|---|
| `libs/shared/table/src/filters/create-filters.ts` | rewrite signature + body |

`buildFiltersPath` moves into this file from `recorder.ts`. After Step 3 it has exactly one caller —
this one — and the architecture's file-layout table adds no new file beyond `row-of.ts`.

## Why This Step Exists

This is where the change becomes visible to a consumer. The second type parameter disappears, the
row type starts coming from an argument, and the schema's return value becomes the channel the
criterion map folds out of.

It is also where the two runtime guards live, because both are construction-time facts: a schema
that returns nothing, and an empty untyped carrier. Both fire on first run, before data flows, and
neither has a sane degraded reading — so both fail loudly rather than quietly producing a filter set
that does not match its type.

## What To Do

1. **The signature.**

   ```ts
   export function createFilters<TRow, S extends readonly unknown[]>(
     rows: readonly TRow[] | (() => readonly TRow[] | undefined) | RowToken<TRow>,
     schema: (path: FiltersPath<TRow>) => S,
     opts?: { injector?: Injector },
   ): Filters<TRow, StateOf<S>>;
   ```

   The middle union member — any callable returning rows — covers a `Signal`, a `WritableSignal`, a
   signal of `TRow[] | undefined` and a bare store accessor, all at once. Seven carriers, three
   union members. Do not add a recursive `RowOf<E>` conditional or a named `RowEvidence` constraint:
   same coverage, more machinery.

2. **Document the carrier on the first line of the doc comment.** Not a footnote:

   > `rows` is an inference anchor. It is never read at runtime.

   The wide slot reads as if it binds data, which is the ergonomic cost that was accepted for it.
   State it where a reader hits it first. Keep the comment terse — a line for the anchor, a line for
   the token, a pointer to the filters doc, no decision-number narration.

3. **`opts` stays the third parameter.** `{ injector }` for a call outside an injection context. An
   earlier published signature omitted it; that was elision, not removal.

4. **Body.**
   1. `const path = buildFiltersPath<TRow>();` — no recorder, no session, no ambient stack.
   2. `const declared = schema(path);`
   3. Guard the return **before anything else**:

      ```
      [createFilters] The schema function must return its rules. A body that calls rules as
      statements declares nothing — return an array: (path) => [equals(path.status)]
      ```

      Throw. The message must carry the array form — the whole-body mistake is the one a reader
      migrating from the previous shape will make, and the fix has to be in the message.
   4. Flatten `declared` into `FilterRuleRecord<TRow>[]`, recursing through nested arrays and
      through a conditional node's children — the runtime mirror of `StateOf`'s `Flatten`. A
      conditional's children come out as individual records tagged `kind: 'conditional'` carrying
      the shared `condition`, matching whatever Step 3 decided about where the re-tag happens.
   5. From there the existing flow is **unchanged**: `runInInjectionContext` →
      `validateRecords(records)` → the per-record `buildFilterState` / `pathToKey` / `pendingGates`
      loop → the second gating pass → `buildFiltersObject`.

5. **Move `buildFiltersPath` in, minus the recorder.** The proxy fabricates a `FilterHandle` per
   string property and caches it. It takes no argument now and the handle carries no recorder field.
   Keep the cache — identity-stable handles are what let a schema pass the same path to two rules.

6. **Drop the recorder re-export block** at the bottom of the file, if the rewrite has not already
   removed it.

## Implementation Notes

- **`S extends readonly unknown[]`, never a rule-typed constraint.** Naming the key type here
  contextually types the returned array's elements and widens every rule's key to `string`. The
  tuple survives, so the symptom looks like tuple widening and sends you after the wrong cause.
  `as const`, the `const` type-parameter modifier and a variadic `[...T[]]` constraint all fail —
  none of them addresses contextual typing.
- `FiltersPath<TRow>` is a conditional type after Step 1, so the proxy's `{} as FiltersPath<TRow>`
  may need an assertion it did not need before. Take the assertion; do not weaken the brand to avoid
  it.
- The schema-return guard is a runtime `Array.isArray` check, and it is the only thing standing
  between an untyped caller and a filter set with no filters. Put it before the flatten, not inside
  it.
- Duplicate-key and duplicate-path throws stay exactly where they are, in `validate.ts`. Do not move
  or restate them here.

## Risks / Watchouts

- **`StateOf<S>` collapsing to `{}` compiles.** If the fold stops resolving, the call site gets an
  empty criterion map rather than an error, and the failure surfaces much later as "why is
  `filters.status` not there". Before moving on, check one real schema's inferred `Filters<…>` type
  by hand and confirm the keys are present with their criterion shapes.
- **The carrier union must reject non-row values.** An array is not callable and a token is neither,
  so the three members are disjoint — but a non-row value must be an error, not something that
  silently matches the callable member. Confirm `42` and `{ foo: 1 }` do not compile.
- **A schema that returns some rules and calls others bare** runs the bare rule for nothing and omits
  it from the type. Accepted residue: after the cutover a bare call has no side effect, so the
  statement is merely inert. Do not build a lint rule for it, and do not build a dual-mode overload —
  a dual mode would make that same body a type that lies about the runtime.
- This step is where `recorder.ts` loses its last caller. Do not delete it here; Step 5 owns the
  deletion, including the type symbols that come with it.

## Non-Goals

- Touching `state.ts`, `evaluator.ts`, `validate.ts` or `matchers.ts`. They consume
  `FilterRuleRecord`, which survives this change intact.
- Touching `src/api/features/with-filtering.ts`. It takes a predicate list and nothing else, and
  imports nothing from this domain. **If an edit to it seems necessary, the edit is wrong.**
- Reading `rows`. Ever. Rows reach the engine through the table feature's predicate list.
- Rewriting any spec or story — `#111`.

## Acceptance Checks

- [ ] `createFilters` takes a carrier, a schema returning `S`, and `opts`; it has no criterion-map
      type parameter
- [ ] The first line of its doc comment states that the carrier is an inference anchor never read at
      runtime
- [ ] An array, a readonly array, a signal, a writable signal, a signal of rows-or-undefined, a bare
      accessor and `rowOf<Row>()` each infer the row type; `42` and `{ foo: 1 }` do not compile
- [ ] A schema whose body calls rules as statements throws, and the message shows the array form
- [ ] The flattener produces the same `FilterRuleRecord[]` the recorder produced for an equivalent
      schema — same order, same fields
- [x] `applyWhen(…)` placed directly in the schema array produces its children's records;
      `...applyWhen(…)` is a `TS2488` compile error (amended 2026-09-14 — the plan originally
      required both spellings to work; a node is not iterable)
- [ ] No symbol from `recorder.ts` is imported
- [ ] `nx run shared-table:typecheck` is clean

---
← [Step 3: Rules return their records](step-3-rules-return-records.plan.md) | [Step 5: Delete the ambient recorder](step-5-delete-recorder.plan.md) →
