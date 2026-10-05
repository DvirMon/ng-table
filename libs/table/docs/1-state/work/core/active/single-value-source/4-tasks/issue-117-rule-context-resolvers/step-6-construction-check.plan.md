# Step 6 — Construction check for resolver-referenced ids

**PR scope:** standalone. **Depends on:** Step 1, Step 2, Step 3, Step 5.
**Parallel-safe with:** none (needs every resolver body to exist first).

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/engine/resolvers.ts` (edit — `buildValueOfContext`
  takes `knownIds`)
- `libs/table/src/api/features/with-grouping/feature.ts` (edit — pass
  `knownIds` at construction)
- `libs/table/src/api/features/with-sorting/feature.ts` (edit — pass
  `knownIds` at construction)
- `libs/table/src/engine/columns-schema/wire-columns-schema.ts` (edit —
  `stateOf` gets the same guard)

## Why This Step Exists

The issue's own acceptance criterion: _"A resolver naming an undeclared
column id is rejected by the same construction check the declarations
use — not a separate one."_ `schema/validate.ts` already has exactly
that check — `assertDeclarationsAreKnown(declaredIds, knownIds, label)`
— dev-gated, throws, used today by every feature's own declared-rule
validation (e.g. `with-sorting/feature.ts`'s
`assertDeclarationsAreKnown(declaredRules.map(...),
input.columns().map(...), 'withSorting')`). A resolver call site never
goes through `PathRecorder.record()` (it reads a handle, it doesn't
declare one), so it needs its own call to the same assert function, at
the moment the resolver runs — classified as a **construction-class**
error (a truly undeclared id is a deterministic wiring bug, not
data-dependent) even though the call happens lazily, inside a
consumer-callback invocation rather than at feature-build time. This is
distinct from — and must not be confused with — a column that _was_
declared but was later removed via `setColumns()`, which is the existing
runtime-degrade case (`readGroupValue`'s "unknown columnId reads
`undefined`" comment) and must keep degrading, not throw.

## What To Do

1. **`engine/resolvers.ts`.** `buildValueOfContext<TRow>(columns,
knownIds: ReadonlySet<string>, label: string)` — add `knownIds` (the
   declared-id set fixed at the calling feature's own construction time,
   the same list already passed to that feature's
   `assertDeclarationsAreKnown` call) and `label` (names the calling
   feature, e.g. `'withGrouping'`/`'withSorting'`, in the thrown
   message, matching every other `assertDeclarationsAreKnown` call
   site's convention). Inside `valueOf`:

   ```ts
   valueOf(handle, row) {
     assertDeclarationsAreKnown([handle.id], knownIds, label);   // dev-gated, throws on a genuinely undeclared id
     const column = columnById().get(handle.id);                 // undefined here = "declared once, since removed" — degrade
     return column ? readAccessor(column, row, reportedColumns) : undefined;
   }
   ```

   Import `assertDeclarationsAreKnown` from `../schema/validate`.

2. **`with-grouping/feature.ts`, `with-sorting/feature.ts`.** Each
   already computes its own `knownIds` for its existing
   `assertDeclarationsAreKnown` call (`input.columns().map((c) =>
c.id)`) — pass that **same array/set** into
   `buildValueOfContext(..., new Set(knownIds), 'withGrouping')` /
   `'withSorting'` at the Step 2/Step 3 call sites. Don't compute a
   second, separate known-id list.

3. **`wire-columns-schema.ts`'s `stateOf`.** Add the identical guard,
   reusing whatever known-ids this file already has in scope for its own
   construction check (check `assertRuleColumnIdsAreKnown` / the
   equivalent call in `api/create-columns.ts` or this file — trace where
   column-rule column ids are already validated at construction and
   reuse that same list, not a new one).

## Implementation Notes

- The thrown message should read like every other
  `assertDeclarationsAreKnown` failure — `[withGrouping] Unknown column
id "..." — no declared column has this id.` — don't write a custom
  message for the resolver case; it's the literal same function.
- `knownIds` must be captured at the _calling feature's_ construction
  time (once), not re-read on every `valueOf` call — build the `Set`
  once, close over it.

## Risks / Watchouts

- Don't conflate "undeclared" (throw) with "declared, later removed via
  `setColumns()`" (degrade to `undefined`) — they use different data
  (the fixed `knownIds` set vs. the live `columnById()` map) and must
  not collapse into one check.

## Non-Goals

- No change to filtering's `criterionOf` — filtering's existing
  `FilterValueOfContext` has no equivalent unknown-id guard today and
  this issue doesn't add one to it (out of scope — not named in the
  acceptance criteria, which only mention "a resolver", singular,
  matched by the worked grouping/sorting/columns examples).

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` clean.
- [ ] The guard in `engine/resolvers.ts` calls
      `assertDeclarationsAreKnown` — not a hand-written duplicate throw.

---

← [Step 5: Column rules `stateOf`](step-5-columns-stateof.plan.md) | [Step 7: Runtime specs](step-7-runtime-specs.plan.md) →
