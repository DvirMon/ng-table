# Step 5 — The grouping fixtures

**PR scope:** PR 2 of 2 (`#77`). **Parallel-safe with: Steps 1, 2, 3, 4, 6, 7, 8.** **Blocks Step 9.**
**Task type:** `code`
**Stack:** angular
**Skills used:** `angular-developer`, `typescript-conventions`, `file-organization`
**Scaffolding agent:** `angular-implementer`

## Files

| File | Action |
|---|---|
| `libs/shared/table/src/stories/grouping/fixtures/schema.ts` | edit — array schema, `rowOf`, drop the return annotation |
| `libs/shared/table/src/stories/grouping/fixtures/utils.ts` | edit — two helper signatures |
| `libs/shared/table/src/stories/grouping/fixtures/types.ts` | edit — delete `DealFilterState` |

The only site where the filter set is built by a shared **factory** rather than declared in a host.
Its return type is annotated, and two helpers in a sibling file take that type as a parameter — so
the annotation is load-bearing in three files, not one.

## Why This Step Exists

`createDealFilters()` is called from three grouping story hosts' field initializers. It annotates
its return as `Filters<DealRow, DealFilterState>`, and `readRepCriterion` / `repFilterNode` in
`utils.ts` take the same type. Deleting `DealFilterState` therefore breaks a signature that nothing
infers — the case the ticket said to raise rather than guess at.

The resolution: derive from the factory. The factory *is* the declaration; a helper that consumes
its result should say so, not restate its shape.

## What To Do

1. Rewrite the factory:

   ```ts
   /**
    * One text criterion over `rep`. Deliberately minimal: `filter` precedes `group` in
    * `PIPELINE_ORDER`, so what a filter proves here is that counts and summaries are of *visible*
    * rows and that an emptied group disappears — not anything about filtering itself.
    *
    * Must be called from an injection context (a component field initializer).
    */
   export function createDealFilters() {
     return createFilters(rowOf<DealRow>(), (path) => [contains(path.rep)]);
   }
   ```

   The paragraph beginning "Typed with `DealFilterState`, because the host reads the criterion
   back…" goes: it explains an annotation that no longer exists, and the reason it gave (otherwise
   `unknown` behind a bracket) is now what inference delivers for free.
2. **`rowOf<DealRow>()`, not a row array.** The factory holds no rows — its three callers each own
   their own data signal. This is the second legitimate `rowOf()` site after Step 4's server host.
3. Rewrite both helpers in `utils.ts` to take the factory's own return type:

   ```ts
   import type { createDealFilters } from './schema';

   export function readRepCriterion(filters: ReturnType<typeof createDealFilters>): string {
     return filters.rep().value();
   }

   export function repFilterNode(
     filters: ReturnType<typeof createDealFilters>
   ): FilterNode<string> {
     return filters.rep();
   }
   ```

4. Drop the now-unused `Filters` import from `utils.ts` and `schema.ts` if nothing else uses it.
   `FilterNode` stays — `repFilterNode`'s return is still worth stating.
5. Delete `DealFilterState` from `grouping/fixtures/types.ts`, and its comment with it.

## Implementation Notes

- `utils.ts` importing from `schema.ts` introduces no cycle: `schema.ts` imports `./types` and the
  filters domain, never `./utils`. Use `import type` regardless — the value is never needed.
- `ReturnType<typeof createDealFilters>` requires the factory to have an *inferred* return type. If
  someone later re-annotates it, these helpers silently follow the annotation instead of the
  schema. That is the trade for not exporting a utility type; leave a one-line comment on the
  factory saying its return type is inferred on purpose.
- The three grouping story hosts (`grouping-static`, and its siblings) call `createDealFilters()`
  and pass the result to these helpers. They need no edit — they never name the type.

## Risks / Watchouts

- **Uncommitted work in this tree.** `grouping-static-story-host.component.{ts,html}`,
  `grouping-static.stories.ts` and `grouping-story.css` carry unrelated uncommitted changes (a
  group-by tab strip). This step must not touch those files. If a conflict appears there, it is not
  from this step.
- `contains(path.rep)` yields criterion `string`, matching the deleted alias exactly. If
  `readRepCriterion`'s `: string` return stops compiling, the fold is wrong — investigate, do not
  widen the annotation.

## Non-Goals

- Any story host — Steps 1–4. The three grouping hosts are untouched.
- Any spec file — Steps 6–8.
- The unrelated grouping tab-strip work in the working tree.

## Acceptance Checks

- [ ] `createDealFilters()` carries no return annotation and names no type argument
- [ ] It passes `rowOf<DealRow>()`
- [ ] Both `utils.ts` helpers take `ReturnType<typeof createDealFilters>`
- [ ] `readRepCriterion` still returns `string` and `repFilterNode` still returns `FilterNode<string>`
- [ ] `DealFilterState` is gone; grep finds no reference in `src/`
- [ ] No change to any file under `src/stories/grouping/grouping-static/`
- [ ] `nx run shared-table:typecheck` reports no error in the three files this step touched

---
← [Step 4: The server filtering host — the `rowOf()` reference](step-4-server-filtering-host.plan.md) | [Step 6: `create-filters.spec.ts`](step-6-create-filters-spec.plan.md) →
