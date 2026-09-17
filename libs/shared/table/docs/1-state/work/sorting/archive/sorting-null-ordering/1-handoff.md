---
title: Handoff — sorting null ordering and the nullable-Date crash
type: plan
status: shipped 2026-08-27 (2d13dda)
date: 2026-08-27
parent: ../../features/sorting.md
---

# Handoff — null ordering in `withSorting()`

Self-contained brief. Everything needed is here or linked.

## Why now

`features/sorting.md` §"Null / Empty Value Ordering" is marked **REQUIRED, NOT IMPLEMENTED** and
says it must ship *with or before* editable rows. Editable rows are shipping. Two defects are
reachable by an ordinary user on day one:

1. **A crash.** A nullable Date column with `withSorting()` throws `TypeError` on the first sort —
   `(value as Date).getTime()` on `null`. Independent of editing; any table with a nullable date
   column hits it today.
2. **The direction flip.** Empty values sort first ascending and last descending, so the blank row
   a person just added jumps from top to bottom when they toggle the sort header.

## Scope — decided 2026-08-27

**Mechanical fix only.** The nine parked scenarios S1–S9 in the sorting spec (what counts as
"empty", whether emptiness is a row- or cell-level predicate, which feature owns it) **stay
parked**.

*Why they can stay parked:* S1–S9 exist because a blank row's landing spot mattered — the person
was filling it in and needed to not lose it. Product **OQ-3** decided the edited row **holds its
display position for the whole gated edit session**
([`0-product/row-editing.md`](../../../../../0-product/row-editing.md) §5, S-1). The row no longer moves
at all while it is being worked on, so null ordering only has to make empties land somewhere
**stable and predictable** — not solve "don't lose the row I'm typing in."

That is a real dependency, not a convenience: if OQ-3's row-hold is dropped, S1–S9 come back.

## The fix

`api/features/with-sorting.ts`, in `sortRows` (line 76) — **not** in `detectComparator`.

The current comparator composition is:

```ts
const compare = column.sortFn ?? detectComparator(column.accessor, rows);
const sign = rule.direction === 'asc' ? 1 : -1;
return [(a: TRow, b: TRow) => sign * compare(a, b)];
```

Wrap it so nullish values are resolved **before** the comparator runs and **outside** the direction
multiplication:

```ts
const compare = column.sortFn ?? detectComparator(column.accessor, rows);
const sign  = rule.direction === 'asc' ? 1 : -1;
const nulls = nullsOrderFor(column);            // 'last' unless overridden — see below

return [(a: TRow, b: TRow) => {
  const aEmpty = isEmpty(column.accessor(a), column);
  const bEmpty = isEmpty(column.accessor(b), column);
  if (aEmpty || bEmpty) {
    if (aEmpty && bEmpty) return 0;
    // NOT multiplied by `sign` — this is what makes placement direction-independent
    return (aEmpty ? 1 : -1) * (nulls === 'last' ? 1 : -1);
  }
  return sign * compare(a, b);
}];
```

**The whole fix is that the empty branch does not multiply by `sign`.** Everything else follows.

### What this closes

| Defect (from the spec's table) | Closed by |
|---|---|
| Date + `null` → `TypeError` on `.getTime()` | nullish never reaches the comparator |
| number + `undefined` → `NaN`, whole-array ordering undefined | same |
| number + `null` → coerced to `0`, sorts among real zeros | same |
| string + `null` → `String(null)` is `"null"`, sorts among the n-words | same |
| `""` / empty flips ends with direction | the empty branch ignores `sign` |

It also applies to a **consumer-supplied `sortFn`**, which is deliberate: a custom comparator should
not have to re-implement null guards. Recorded as an accepted trade — a `sortFn` author who
deliberately orders nulls themselves is overridden. No escape hatch ships; add one if someone asks.

## Policy decisions — settled

**Default `nulls: 'last'`.** SQL and AG Grid convention; real data is what the person is scanning.
The `'first'` argument (a blank row being filled should stay visible) is obsoleted by OQ-3's
row-hold.

**`""` is a real value, not empty, by default.** Only `null` and `undefined` are empty. An empty
string is legitimate data in many columns, and silently relocating it is worse than the flip we are
fixing.

**Per-column override is a declarative rule, not a `ColumnDef` field.**

```ts
columnSchema<Person>((path) => {
  applySortNulls(path.startDate, { order: 'first' });
  applySortNulls(path.notes,     { emptyString: 'is-empty' });
});
```

Implemented the way `applyVisible` already is (`api/column-rules.ts`): a thin wrapper over
`metadata()` writing to an internal key minted in `engine/columns.ts`, consumed by `sortRows`.
`applyVisible` is the exact precedent — copy its shape.

*Single-writer applies* (a second rule for the same column throws at resolve time), unlike `VISIBLE`
which is specially exempted to AND-combine. Two conflicting null orders on one column should be an
error, not a merge.

*Why a rule rather than `ColumnDef.nulls`:* the spec's own **S7** lists "is `withSorting()` even the
right owner" as unresolved. Keeping the declaration in the schema and the mechanism in `sortRows`
means moving ownership later does not churn `ColumnDef`. It also avoids adding two fields (`nulls`,
`treatEmptyStringAsNull`) to a type the spec already flags as carrying unimplemented entries.

**Known limitation, accepted:** rules require `withColumnsSchema()`. A table passing a plain columns
array gets the default and cannot override per column. That is why the default — not the override —
carries the fix; every table is correct without composing anything.

## Files

| File | Change |
|---|---|
| `api/features/with-sorting.ts` | the wrapper in `sortRows`; `isEmpty` / `nullsOrderFor` helpers |
| `engine/columns.ts` | mint the internal nulls metadata key beside `VISIBLE` |
| `api/column-rules.ts` | `applySortNulls()`, mirroring `applyVisible()` |
| `index.ts` | export `applySortNulls` and its options type |
| `api/features/with-sorting.spec.ts` | tests below |
| `features/sorting.md` | replace the REQUIRED-NOT-IMPLEMENTED section with shipped behavior; keep S1–S9 parked and note why (the OQ-3 dependency) |

## Tests

- nullable Date column sorts without throwing — the crash regression, and the only one a consumer
  has hit.
- empties stay at the same end under `asc` and `desc` — the direction-independence property.
- `undefined` in a number column does not make the whole array's order implementation-defined.
- `null` in a string column does not sort as the literal `"null"`.
- `""` sorts as a normal string by default; sorts as empty when the column opts in.
- a consumer `sortFn` inherits null-safety without implementing it.
- two `applySortNulls` calls on one column throw at resolve time.
- multi-column sort: a column whose values are all empty contributes 0 and falls through to the next
  rule.

## Open — minor, does not block

**Should `withSorting({ nulls })` take a table-wide default?** Not proposed here: the built-in
`'last'` plus per-column rules covers what is known. Add it only if a real table wants `'first'`
everywhere — at which point it is one config field and a fallback in `nullsOrderFor`.

## Not in scope

S1–S9 in [`features/sorting.md`](../../../../features/sorting.md): "new" versus "empty" as different
predicates, emptiness as a row-level rather than cell-level property, what counts as empty beyond
nullish (`0`, `false`, `[]`, whitespace), where an empty row sits under grouping, and which feature
should own the concept. All remain parked, and remain parked *because* OQ-3 holds the edited row
still.
