---
title: "Step 4 — createFilters() core"
type: task-step
issue: 61
---

# Step 4 — `createFilters()` core

**PR scope:** Depends on Step 1 only. Does **not** import Step 5 (`rules.ts`) — same file
direction as `schema/column-schema.ts` never importing `schema/column-rules.ts`. Step 5 imports
from this file, not the reverse.

**Task type:** code

**Skills used:** angular-developer (signals, `linkedSignal`, injection context), file-organization

**Scaffolding agent:** angular-implementer

## Files

- `libs/shared/table/src/api/create-filters.ts` (new)

## Why This Step Exists

This is the actual `createFilters()` factory and everything it needs to run a schema fn and turn
the recorded rules into live state: the path proxy, the recorder session, key derivation,
construction-time validation, per-filter state (`value`/`active`/`reset`/`dirty`), source
reconciliation, and the safe-evaluate runtime guard. Structurally this is the filters equivalent
of `schema/column-schema.ts` (proxy + session + factory) — not `api/create-table.ts` alone, which
has no path-proxy concern of its own.

## What To Do

### Path proxy + recorder session (mirrors `buildColumnsPath`/`createRecorderSession`)

1. `createFilterRecorderSession<TRow>()`: tracks open/closed like `column-schema.ts`'s recorder
   session (the schema fn runs once, synchronously; a handle used after the fn returns — e.g.
   stashed and reused inside a later callback — must throw, matching the existing
   `assertPathIsCurrent` guard's message style).
2. `buildFiltersPath<TRow>(recorder)`: a `Proxy` fabricating a `FilterHandle<TRow, K>` per string
   property accessed, cached per key. Do not read row data — 100% compile-time typing, runtime
   only carries the key + recorder, exactly like `buildColumnsPath`.
3. Export `assertFilterPathIsCurrent(handle)` (internal) — `rules.ts` (Step 5) imports this to
   validate a handle and get its recorder before pushing a `FilterRuleRecord`.

### Key derivation (R3, R9, R31)

4. After the schema fn runs and the session closes, resolve each `FilterRuleRecord`'s final key:
   - **Single-path rule** (`kind: 'single'`, `'conditional'`): key = `options.as` if given,
     else the path's own property name (`equals(path.status)` → `'status'`).
   - **`anyOf` group** (`kind: 'group'`): key = the positional key argument — never borrowed
     from a path, since a group has no single path (R9).
   - `as` must be a **string literal** — if you can't enforce this at the type level for every
     call site, at minimum enforce it in `rules.ts` (Step 5)'s signatures; document which side
     owns the check.

### Construction-time validation (throws — ADR-0014, all deterministic, fire before data flows)

5. **One filter per path** (R5): after resolving all records, check for any path appearing in
   more than one record's `paths` array — `as` does not exempt this (the check is on the path,
   not the key). Throw naming both conflicting rules and the shared path.
6. **Duplicate/colliding keys**: two records resolving to the same key (whether via `as` vs. a
   borrowed key, or two `as` values), throw naming the collision.
7. **`anyOf` without a key**: enforce this as a required positional parameter in `rules.ts`'s
   `anyOf` signature (Step 5) rather than a runtime check here, if the type system can make the
   key non-optional — otherwise validate it here and throw.
8. Match `engine/slots.ts`'s existing single-occupancy throw style/message shape for consistency
   across the codebase's construction-time errors.

### Per-filter state (`FilterNode<TCriterion>`)

9. For each resolved record, build:
   - `value: WritableSignal<TCriterion>` — seeded from `options.source?.()` if present, else the
     predicate's declared empty value (see `isEmpty`/default-value pairing in `rules.ts`, Step 5 —
     each rule must hand this step a concrete empty value, not just a boolean test, so there's
     something to seed `value` with and to `reset()` to).
   - `active(): TCriterion | undefined` — `undefined` when `isEmpty(value())` is true, else
     `value()`.
   - `reset(v?)`: no-arg → `sourceValue()` (or empty if no source); `null` → empty value;
     otherwise → `v` (R17).
   - `dirty(): boolean` — `computed(() => !equalsCriterion(value(), sourceValue()))` (R19's
     literal formula from `filters.md`). Needs a structural `equalsCriterion` (deep-equal for
     plain objects/arrays is enough here; don't reach for a library — this repo has no deep-equal
     dependency, write the narrow comparison the criterion shapes actually need: primitive,
     `{min,max}`/`{from,to}` range objects, and arrays).

### Sources (R19)

10. `{ source: () => T }` wires a `linkedSignal`-style default: recompute from the source when it
    changes, but a user write to `value` wins until the source changes again. This is exactly the
    semantics `linkedSignal({ source, computation })` already provides elsewhere in this codebase
    (`engine/columns-schema/wiring.ts`'s `buildAsyncMetadataEntry` uses the same primitive for a
    different reconciliation problem — read it for the pattern, not the specific logic). A filter
    with no `source` just uses a plain `signal(emptyValue)`.
11. `dirty()` is what makes source arrivals safe: an untouched filter whose source changes stays
    `dirty() === false` and reflects the new source value; once the user writes, `dirty()` flips
    `true` and further source changes must not stomp the user's value. Get this reconciliation
    right — it's the one place a signal-composition bug would be silent (stale state) rather than
    a thrown error.

### Root `Filters<TRow>` object

12. Assemble the callable + indexable root per Step 1's `Filters<TRow>` type: `filters()` returns
    the root `FiltersRoot` (`value()`/`active()`/`reset()`/`dirty()` aggregating every child node —
    `value()` is the full flat object, `active()` omits empty entries, root `dirty()` is true if
    any child is dirty), and `filters.<key>` returns each child `FilterNode`.
13. Root `reset(value?)`/`filters().reset(value?)` fans out to every child per the same
    no-arg/`null`/value rule (9).

### Safe-evaluate runtime guard (ADR-0014 — "runtime never throws")

14. Build the mechanism `withFiltering()` (issue #28, separate) will call per row: something like
    an internal (non-exported-from-`index.ts`) `evaluateFilter(record, row): boolean | 'error'` or
    equivalent, which:
    - Reads the cell via the record's path accessor.
    - Wraps the predicate call in try/catch.
    - On throw: deactivates *that filter* for this evaluation (treat as non-matching, or however
      the eventual caller composes results — decide and document here since issue #28 will build
      on it), and reports **once per filter per evaluation** (not per row) — matching the
      `classify-errors-construction-vs-runtime` split: this is the runtime half, so it degrades,
      it never throws up to the caller.
    - The reporting mechanism itself: match whatever this codebase already uses for
      runtime-degradation reporting elsewhere (check `ADR-0014`'s own examples / any existing
      `sortFn`/`aggregateFn` guard code — if none exists yet as precedent, a `console.error` with
      a structured message naming the filter key, the predicate, and the offending cell is the
      floor; don't invent a new logging abstraction for this one call site).
15. This guard belongs here, not in `withFiltering()` (features/filtering.md explicitly says "the
    feature adds no policy of its own") — `createFilters()` owns the full error contract because
    it's the one place that knows about predicates, keys, and emptiness together.

### Public factory

16. `createFilters<TRow>(schema, opts?)`:
    - Resolve `injector = opts?.injector ?? inject(Injector)` (same pattern as `createTable`).
    - Run the schema fn once through a fresh recorder session to collect `FilterRuleRecord[]`.
    - Resolve keys, validate (steps 5-8), build state (steps 9-13) — under
      `runInInjectionContext(injector, ...)` since sources' `linkedSignal`s need reactive/DI
      context, matching `createTable()`'s `runInInjectionContext` wrapping of `composeTable()`.
    - Return the assembled `Filters<TRow>`.

## Implementation Notes

- `TRow` must be explicitly annotated at the call site — there's no value argument to infer from
  (R11/R24, `filters.md` "Signature"). Don't add an inference workaround; this is accepted.
- Keep the internal evaluate-guard function `@internal`, exported only for `api/features/with-filtering.ts` (issue #28) to import directly — not part of the `index.ts` public barrel.

## Risks / Watchouts

- **Don't let `dirty()` become a stored flag.** `filters.md` R19 is explicit: derived, never
  stored, recomputed from `value()` vs. `sourceValue()` every time. A stored boolean would drift
  the moment a source or value changes outside whatever write path happened to update the flag.
- **Don't conflate `active()`'s "empty means omitted" with the safe-evaluate guard's "predicate
  threw means deactivated."** These are different reasons a filter doesn't narrow rows, and
  `filters.md`'s Errors section is explicit that a failed filter still appears in `active()`
  ("`active()` describes which criteria are set, not which evaluations succeeded").
- **Do not import `schema/column-schema.ts` or its types.** See Step 1's note — the two recorder
  mechanisms are deliberately parallel, not shared.

## Non-Goals

- No rule functions (`equals`, `contains`, etc.) — Step 5.
- No actual per-row filtering loop over a table's rows — that's `withFiltering()`, issue #28. This
  step only builds the guarded single-predicate evaluator issue #28 will call once per row per
  active filter.
- No `Forms`/Signal Forms integration code — `filters().value` being a real `WritableSignal` is
  what makes that free (filters.md §Forms); nothing extra to build for it here.

  > **Corrected 2026-09-14.** This premise was wrong, and the gap shipped because of it. As
  > built, `buildFiltersRoot()` made root `value` a plain getter (`value(): TState`), not a
  > `WritableSignal` — so `form(filters().value, …)` could not be constructed at all, and R18
  > was never actually delivered. The filtering stories worked around it with a duplicate model
  > plus a sync effect. Closed by `createRootValueSignal()` in `api/filters/state.ts`: root
  > `value` is now a writable view over the child nodes. The lesson for a future plan — "free,
  > nothing to build" deserves one line of verification before it becomes a Non-Goal.

## Acceptance Checks

- [ ] `createFilters<TRow>(schema, opts?)` constructs without a `data` argument
- [ ] Duplicate filter on one path throws at construction, even with different `as` names
- [ ] Duplicate/colliding keys throw at construction
- [ ] `anyOf` without a key throws at construction (enforced here or in Step 5's signature)
- [ ] `value()`, `active()`, `reset()`, `dirty()` behave per spec at root and per-filter level
- [ ] A source's `linkedSignal` yields correctly to a later user write, gated by `dirty()`
- [ ] A throwing predicate deactivates only its own filter for that evaluation and is reported
      once, not per row, and does not throw out of the evaluator
- [ ] A failed filter still appears in `active()`
- [ ] `tsc --noEmit` passes with no new errors

---
← [Step 3: Matchers spec](step-3-filters-matchers-spec.plan.md) | [Step 5: Rules + public exports](step-5-filters-rules-and-exports.plan.md) →
