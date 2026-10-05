# Step 5 — Delete the raw-name label tier and the levels filter

**PR scope:** standalone. **Depends on:** Step 1 (the throw is what makes
both fallbacks unreachable) and Step 2 (a level that resolves through a
column is what makes the label tier redundant).

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/engine/grouping/render.ts` (edit)
- `libs/table/src/api/features/with-grouping/feature.ts` (edit)

## Why This Step Exists

Two pieces of code exist only to survive a level that names no column.
After Step 1 no such level can reach either of them — declarations throw
at construction, and the `grouping` writer throws on `.update()`. G55
deletes the label tier; AC #5 deletes the read filter.

Leaving them is worse than dead code: both are _silent_ degrades. The
label tier renders a raw identifier into the UI where a human-readable
label belongs, and the filter drops a level from the public read with no
signal — a consumer iterating `groupingLevels()` sees fewer levels than
`grouping()` reports, and nothing says why.

## What To Do

**1. `resolveGroupLabel` loses its last tier.**

```ts
/** Explicit `initial` label -> the column's own label. */
function resolveGroupLabel<TRow>(
  columnId: string,
  columns: ColumnDef<TRow>[],
  labelByColumn?: ReadonlyMap<string, string>,
): string {
  const explicit = labelByColumn?.get(columnId);
  if (explicit) return explicit;
  const column = columns.find((c) => c.id === columnId);
  return column ? column.label : columnId; // <- this fallback goes
}
```

Every level has a column now, so the lookup is total. Resolve it without
an unchecked assertion — a type guard or an explicit branch that throws
with a message naming the id, per
`~/.claude/rules/typescript-conventions.md`. If it throws, Step 1's
check has a hole, and that is worth finding loudly rather than papering
over with `!`.

Update the JSDoc to two tiers, and drop "(D7a)" references to the deleted
third.

**2. `groupingLevels`' filter becomes a total map.**

```ts
const groupingLevels = computed(() => {
  const columnById = new Map(input.columns().map((c) => [c.id, c]));
  return appliedGrouping()
    .map((id) => columnById.get(id))
    .filter((column): column is ColumnDef<TRow> => column !== undefined);
  //  ^ this filter goes
});
```

Same rule as above — resolve every id, and treat a miss as a broken
invariant rather than as a row to drop.

**3. Update `GroupingMembers.groupingLevels`' doc comment.**

It currently says _"A level naming no known column is omitted here (no
`ColumnDef` to report) even while applied"_. That sentence is now false.
Keep the other half — a level `when` rejects entirely is still omitted,
because that is D5's applied/declared distinction, not a missing column.

## Implementation Notes

- **`buildGroupNodes` still needs `columns`** after this, for
  `resolveGroupLabel`. Do not drop the parameter.
- **Prefer a shared `columnById` map in `render.ts`.** Step 2 already
  builds one for `readGroupValue`; `resolveGroupLabel`'s
  `columns.find(...)` runs once per emitted header, so reusing the map is
  free and removes the last linear scan in the walk.
- **`isGroupedBy` is unchanged.** It reads a `Set` off `appliedGrouping()`
  and returns `false` for an unknown id — still correct, since an unknown
  id can no longer _be_ applied, and a `false` for a never-declared id is
  a query answer, not a degrade.

## Risks / Watchouts

- **This step is only safe on top of Step 1.** Landing it first turns a
  columnless level from "renders with a raw label" into a crash. The
  dependency is hard, not presentational.
- **`MISSING_GROUPING_LEVEL` (`'territory'`) in the story fixtures is the
  live consumer of the deleted tier**, and `grouping-keys`' third label
  step is the documented lesson. Both go in Step 8. Expect
  `nx test shared-table` red on the grouping story specs until then.
- **`feature.spec.ts` has cases asserting the raw-name label.** Step 7
  owns removing them; deleting an assertion is the correct fix there, not
  rewriting it to expect a throw from a path that no longer exists.

## Non-Goals

- **No change to D5's applied-vs-declared reading.** A level gated off by
  `when` is still absent from `groupingLevels()` and still survives a
  `.update()` round-trip.
- **No new report.** There is nothing left to degrade from, so there is
  nothing to `console.error`.
- **No `visible` enforcement.** A carrier column still renders in a
  consumer that does not filter — the workspace decisions log flags that
  as deserving its own issue, and it is not this one.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` clean outside `src/stories/**`.
- [ ] `resolveGroupLabel` has exactly two tiers and no `columnId`
      fallback.
- [ ] `groupingLevels()` contains one `ColumnDef` per applied level, with
      no filtering step.
- [ ] No `!` assertion or `as` cast was introduced to make either lookup
      total.

---

← [Step 4: `applyAggregate` keys by column id](step-4-apply-aggregate.plan.md) | [Step 6: The two-walks gate spec](step-6-engine-gate-spec.plan.md) →
