# Step 4 — Barrel exports

**PR scope:** `index.ts` — export both directives and both tokens from the public barrel.

**Task type:** chore
**Stack:** angular

**Depends on:** Step 2, Step 3

**Skills used:** none

**Scaffolding agent:** none (main thread)

**Files:**
- `libs/shared/design-system/src/ui/table/index.ts` (edit)

## Why This Step Exists

Issue 01's checklist requires both directives to export from the barrel. Consumers (and later feature directives in Issues 02–04) import `NgpTableDirective`, `NgpTableRowDirective`, `NGP_TABLE_STORE`, `NGP_TABLE_ROW` from the package entry point, not from internal file paths.

## What To Do

Add two `export *` lines to `index.ts`, matching the existing style (`export * from './table.store';`, `export * from './with-sorting';`):

```ts
export * from './ngp-table.directive';
export * from './ngp-table-row.directive';
export * from './table.tokens';
```

Insert alongside the existing `export * from` block at the top of the file — keep the barrel's existing grouping (bulk `export *` lines first, then the named `export type { ... }` block for the columns-schema types).

## Implementation Notes

- `index.ts` is a barrel per `file-organization.md` — re-export only, no logic.

## Risks / Watchouts

- None — this is a pure re-export addition.

## Non-Goals

- No new named/type-only exports here — `export *` covers the directive classes and tokens; no need to hand-pick symbols the way the columns-schema block does.

## Acceptance Checks

- [ ] `NgpTableDirective` importable from the package barrel
- [ ] `NgpTableRowDirective` importable from the package barrel
- [ ] `NGP_TABLE_STORE` / `NGP_TABLE_ROW` importable from the package barrel
- [ ] Typecheck passes

---
← [Step 3: NgpTableRowDirective](step-3-ngp-table-row-directive.plan.md) | [Step 5: NgpTableDirective spec](step-5-ngp-table-directive-spec.plan.md) →
