# Step 2: Barrel export

## PR scope

Publish `withExpansion()` on the table's public API.

## Task type

code

## Skills used

angular-developer

## Scaffolding agent

angular-implementer

## Files

- `libs/shared/design-system/src/ui/table/index.ts` (edit)

## Why This Step Exists

`with-sorting.ts`, `column-schema.ts`, etc. are all barrel-exported from `index.ts` — this
table has no other export path. Without this, `withExpansion()` is unreachable from outside
the folder.

## What To Do

Add one line, alongside the existing `with-sorting` export:

```ts
export { withExpansion } from './with-expansion';
export type { WithExpansionConfig } from './with-expansion';
```

Do not export `buildExpansionRenderRows` or any other internal helper — same posture as
`with-sorting.ts`'s private `sortRows`/`cycleSortRule`/`replaceSortRule` staying unexported.

## Implementation Notes

None beyond the above — this is a pure re-export, no logic.

## Risks / Watchouts

None.

## Non-Goals

N/A.

## Acceptance Checks

- [ ] `withExpansion` and `WithExpansionConfig` importable from `@acme/shared-design-system`'s
      table barrel (or the local package path used by `apps/demo`)
- [ ] No internal helpers leaked
- [ ] `nx typecheck shared-design-system` passes

---
← [Step 1: withExpansion() feature + RenderRow fields](step-1-with-expansion-feature.plan.md) | [Step 3: with-expansion.spec.ts](step-3-with-expansion-tests.plan.md) →
