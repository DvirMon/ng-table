# Step 4 — One declared-identifier check, shared

**PR scope:** standalone. **Depends on:** Step 1 (AC #3).
**Parallel-safe with:** Step 2, Step 3 — disjoint files.

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/schema/validate.ts` (create)
- `libs/table/src/engine/columns-schema/resolve.ts` (edit)

## Why This Step Exists

Node **M3** in [`decisions.md`](../../decisions.md), and #111's AC #6.

`assertRuleColumnIdsAreKnown` (`engine/columns-schema/resolve.ts:18-31`) is
the only "does this declared identifier name a real column?" check in the
library, and it is private to the columns schema's resolve phase. Under
ADR-0024 every schema fn names declared column ids, so grouping (#114),
filtering (#115) and sorting (#100) each need the same check — three copies
of the same eleven lines, or one shared function they call.

The check moves to `schema/`, beside the mechanism the declarations come
from, and the columns version becomes a call into it. Behaviour-preserving:
the thrown message is byte-identical for the columns caller, which two
specs assert by regex.

This step touches neither `path-proxy.ts` nor either `schema.ts`, so it can
land before, after, or alongside Steps 2 and 3.

## What To Do

### 1. Create `libs/table/src/schema/validate.ts`

```ts
/**
 * Construction-time check: every identifier a schema declared names a column
 * that exists. Deterministic, fires before any data flows — throws
 * (ADR-0014). `label` names the declaring surface in the message, so one
 * body serves `columnsSchema`, `withGrouping`, `withFiltering` and
 * `withSorting`.
 */
export function assertDeclarationsAreKnown(
  declaredIds: Iterable<string>,
  knownIds: Iterable<string>,
  label: string
): void {
  const known = new Set(knownIds);
  for (const declaredId of declaredIds) {
    if (!known.has(declaredId)) {
      throw new Error(
        `[${label}] Unknown column id "${declaredId}" — no column with ` +
          'this id exists in the `columns` array.'
      );
    }
  }
}
```

The message body is lifted verbatim from `resolve.ts:25-28` — only the
bracketed prefix becomes a parameter.

### 2. `engine/columns-schema/resolve.ts`

`assertRuleColumnIdsAreKnown` keeps its name and stays private to the file.
Its body becomes the two projections plus the call:

```ts
function assertRuleColumnIdsAreKnown<TRow, TId extends string>(
  rules: readonly ColumnRule<TRow>[],
  columns: ColumnDefInput<TRow, TId>[]
): void {
  assertDeclarationsAreKnown(
    rules.map((rule) => rule.columnId),
    columns.map((column) => column.id),
    'columnsSchema'
  );
}
```

Import from `'../../schema/validate'`.

`assertMetadataKeysAreUnique` (`:43-58`) is **not** touched — it is a
columns-only rule (`metadata()` is single-writer per `(column, key)` pair,
with the `VISIBLE` exemption), not a declared-identifier check.

## Implementation Notes

- **Why `label` is a parameter and not four exported wrappers.** Every
  caller differs in exactly one token. A wrapper per feature is the
  enumerated-surface shape `general-mechanism-over-enumerated-cases` warns
  against, and the projections (`rule.columnId` here, something else in
  grouping) differ per caller anyway, so each caller already has a private
  adapter — this one.
- **Why `Iterable<string>` and not arrays.** The two call sites hand over
  freshly-mapped arrays today; #114/#115 will hand over map keys and set
  members. `Iterable` costs nothing and saves those slices a `[...spread]`.
- **The check still fires at construction only.** Nothing about error
  timing changes — `resolveColumnsConfig` calls it synchronously from
  `createTable()`, exactly as now. This is the construction half of
  ADR-0014's split, correctly.
- **`assertDeclarationsAreKnown` is not exported from `index.ts`.** It is
  engine-internal. #102 is what would make it public.

## Risks / Watchouts

- **The message must not drift.** `columns-schema/schema.spec.ts:145` and
  `engine/columns-schema/wire-columns-schema.spec.ts:414` both assert
  `/Unknown column id "<id>"/`. Keep the em dash, the backtick-quoted
  `columns`, and the exact wording; a reflow of the string concatenation is
  fine, a reword is not (AC #8).
- Pass `'columnsSchema'` without brackets — the template already supplies
  them. `[[columnsSchema]]` would pass both regexes and still be wrong.

## Non-Goals

- No new caller. Grouping, filtering and sorting start calling this in
  #114 / #115 / #100 — those are separate slices and this one ships with
  one caller by design.
- No change to `engine/filters/validate.ts`. Its `validateRecords` is a
  one-filter-per-path rule, not an identifier check, and filtering does not
  key by column id until #115.
- No change to `assertMetadataKeysAreUnique`.

## Acceptance Checks

- [ ] `libs/table/src/schema/validate.ts` exists, exporting
      `assertDeclarationsAreKnown` (AC #6).
- [ ] `resolve.ts` contains no `throw` for an unknown column id — it calls
      the shared check (AC #6).
- [ ] Both existing specs asserting `/Unknown column id/` pass unedited
      (AC #8).
- [ ] `nx run shared-table:typecheck` clean — **run twice**.
- [ ] `nx run shared-table:typecheck-spec` clean.

---
← [Step 3: Shared recording runner](step-3-shared-recording-runner.plan.md) | [Step 5: Spec the shared check](step-5-validate-spec.plan.md) →
