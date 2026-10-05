# Step 1 — Guard `sortRows` per ADR-0014

**PR scope:** standalone. Ships alone (V1 in `../../decisions.md`'s
dependency ranking).

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/api/features/with-sorting.ts` (edit)

## Why This Step Exists

`sortRows` calls `column.accessor(a)` / `column.accessor(b)` directly
for its empty-check, and calls the consumer's `sortFn` (or the
built-in auto-detected comparator) directly inside
`[...rows].sort()`. Both run unwrapped, so a throw from either escapes
the sort stage and takes the whole table down — the exact class of
failure [ADR-0014](../../../../../adr/0014-runtime-error-policy.md)
exists to prevent, and which `engine/cells.ts`'s `readAccessor` and
`engine/grouping/render.ts`'s `computeAggregates` already close for
cells and aggregates. Sorting is the one consumer-callback path still
unguarded, tracked as **SO24** in
[`docs/decisions/sorting.md`](../../../../../decisions/sorting.md).

## What To Do

In `libs/table/src/api/features/with-sorting.ts`:

1. Import `readAccessor` from `'../../engine/cells'`.

2. Add a report function, matching the exact pattern of
   `reportAggregateError` in `engine/grouping/render.ts`:

   ```ts
   function reportComparatorError(columnId: string): void {
     // eslint-disable-next-line no-console -- ADR-0014: floor reporting mechanism, no existing
     // runtime-degradation logging abstraction to reuse in this codebase yet.
     console.error(
       `[withSorting] comparator threw for column "${columnId}". Treating the affected ` +
         'comparison as equal for this evaluation.',
     );
   }
   ```

3. Add a guard that wraps a comparator function, returning `0` and
   reporting once per column on a throw:

   ```ts
   function guardCompare<TRow>(
     compare: (a: TRow, b: TRow) => number,
     columnId: string,
     reportedColumns: Set<string>,
   ): (a: TRow, b: TRow) => number {
     return (a, b) => {
       try {
         return compare(a, b);
       } catch {
         if (!reportedColumns.has(columnId)) {
           reportedColumns.add(columnId);
           reportComparatorError(columnId);
         }
         return 0;
       }
     };
   }
   ```

4. Rewrite `sortRows` to thread one `reportedColumns` `Set<string>`
   per evaluation for accessor reads (shared across every rule/column,
   same shape as `core.ts`'s `renderRows` computed and
   `computeAggregates`'s `reportedColumns`), and one for comparator
   throws. Replace every direct `column.accessor(...)` read with a
   wrapped `accessor` closure, and wrap `compare` before it's called:

   ```ts
   function sortRows<TRow>(rows: TRow[], rules: SortRule[], columns: ColumnDef<TRow>[]): TRow[] {
     if (rules.length === 0) {
       return rows;
     }
     const columnById = new Map(columns.map((column) => [column.id, column]));
     const reportedAccessorColumns = new Set<string>();
     const reportedComparatorColumns = new Set<string>();
     const comparators = rules.flatMap((rule) => {
       const column = columnById.get(rule.columnId);
       if (!column) {
         return [];
       }
       const accessor = (row: TRow): unknown => readAccessor(column, row, reportedAccessorColumns);
       const compare = guardCompare(
         column.sortFn ?? detectComparator(accessor, rows),
         column.id,
         reportedComparatorColumns,
       );
       const sign = rule.direction === 'asc' ? 1 : -1;
       const nulls = nullsOrderFor(column);

       return [
         (a: TRow, b: TRow): number => {
           const aEmpty = isEmpty(accessor(a), column);
           const bEmpty = isEmpty(accessor(b), column);
           if (aEmpty || bEmpty) {
             if (aEmpty && bEmpty) return 0;
             return (aEmpty ? 1 : -1) * (nulls === 'last' ? 1 : -1);
           }
           return sign * compare(a, b);
         },
       ];
     });

     return [...rows].sort((a, b) => {
       for (const compare of comparators) {
         const result = compare(a, b);
         if (result !== 0) {
           return result;
         }
       }
       return 0;
     });
   }
   ```

   `detectComparator` itself needs no change — it already takes a
   generic `accessor` parameter, so passing the wrapped closure is a
   call-site change only.

## Implementation Notes

- **Why the accessor throw needs no separate fallback branch.** A
  throwing `readAccessor` returns `undefined`, and `isEmpty()` already
  treats `value == null` as empty — the row falls into the existing
  null/empty-ordering branch (`nullsOrderFor`) instead of ever
  reaching `compare`. This is what satisfies "a column whose accessor
  throws sorts with that row treated as empty" without new branching.
- **Why `guardCompare` wraps both `sortFn` and the built-in
  comparator.** By the time `compare(a, b)` runs, `isEmpty` has
  already confirmed both `accessor(a)` and `accessor(b)` are non-null
  for this call, so the built-in comparator (e.g. `.getTime()`) should
  not throw from a null value — but it can still throw from a
  type-inconsistent column (sample detected `Date`, a later row
  produced a `string`). Guarding the call site rather than special-casing
  `sortFn` covers both without extra surface.
- **Why one shared `Set` per kind, not one per column.** Matches
  `readAccessor`'s own dedupe contract (`engine/cells.ts`) and
  `computeAggregates`'s — the Set's `.has(columnId)` check is what
  scopes the dedupe per column; sharing the Set across columns within
  one `sortRows` call is exactly what makes "once per column per
  evaluation" true for a multi-column sort.

## Risks / Watchouts

- Do not wrap `compare` before the `isEmpty` short-circuit — wrapping
  it after keeps `guardCompare` off the hot path when either side is
  already empty.
- `accessor` must be defined once per rule (per column), not per call
  to `isEmpty` — it closes over `column` and `reportedAccessorColumns`,
  same as the original `column.accessor` reference did.

## Non-Goals

- No change to `detectComparator`, `isEmpty`, `readSortNulls`, or
  `nullsOrderFor` — none of them call a consumer callback directly.
- No change to the `stages.sort` wiring in `buildSortingSpec` — it
  already calls `sortRows` once per pipeline evaluation, which is what
  makes a fresh `Set` per `sortRows` call equivalent to "once per
  evaluation".
- Tests and docs are Steps 2 and 3.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` clean — **run twice** (`ngc`
      aborts at the first `.ts` error before reaching templates).

---

[Step 2: Cover the two degrade paths](step-2-degrade-path-tests.plan.md) →
