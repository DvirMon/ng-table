# Step 3 — Delete the old surface

**PR scope:** standalone, and **breaking**. **Depends on:** Step 2.
Nothing reads the old fields after Step 2, so deleting them removes no
behavior.

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/api/types.ts` (edit: `ColumnDef`)
- `libs/table/src/columns-schema/rules.ts` (edit)
- `libs/table/src/engine/columns.ts` (edit)
- `libs/table/src/index.ts` (edit)
- `libs/table/src/stories/row-edit/sorting-editing/sorting-editing-story-host.component.ts` (edit: comment at `:81`)

## Why This Step Exists

SO19: `sortFn` and `enableSorting` are **deleted** from `ColumnDef`, not
deprecated and kept (0 production authors). #100 Q4: afterwards,
`ColumnDef` carries no feature config at all. SO21: `sortNulls` leaves
the columns schema.

## What To Do

1. `api/types.ts`: delete `sortFn`, `enableSorting` and the
   "Feature-contributed fields" comment. `ColumnDef` is then `id`,
   `accessor`, `visible`, `order`, `label`, `meta`.
   `ColumnDefInput` derives from it, so it follows automatically.
2. `columns-schema/rules.ts`: delete `sortNulls` and `SortNullsOpts`, and
   drop `SORT_NULLS` from the import. The file keeps `visible` and
   `visibleAsync`.
3. `engine/columns.ts`: delete the `SORT_NULLS` key and its JSDoc.
4. `index.ts`: change `:71` to export only `visible, visibleAsync` from
   `columns-schema/rules`. Export `sortNulls`, `sortFn`, `sortable`,
   `sortingSchema` and the public types (`SortingHandle`, `SortingPath`,
   `SortingSchemaFn`, `SortNullsOpts`, `SortableOpts`) from
   `api/features/with-sorting`, beside `withSorting`.
5. Story host `:81`: the comment names "`sortNulls()` default". It still
   holds, since the default is unchanged; update it only if it cites the
   columns schema.

## Implementation Notes

- **Search after deleting:** `rg "SORT_NULLS|enableSorting|\.sortFn\b" libs/table/src`
  should find nothing outside `*.spec.ts`. Step 4 owns the specs.
- `stories/**`: the earlier survey found no story fixture using
  `sortFn`/`enableSorting`/`sortNulls`. If typecheck says otherwise,
  migrate that fixture here, since story hosts are code, and name it in
  the report.

## Risks / Watchouts

- **The spec target stays red until Step 4.** `with-sorting.spec.ts`
  imports `sortNulls` from `columns-schema/rules` and writes `sortFn` and
  `enableSorting` on columns. Expected; don't soften the lib typecheck to
  get around it.
- **The `ColumnDef` import in `columns-schema/metadata.ts`**:
  `readColumnMeta` stays, because `visible` still uses the metadata channel.

## Non-Goals

- No deprecation aliases, re-exports or shims (SO19).

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` clean, run twice (story hosts are
      in scope, and `ngc` stops before templates on a `.ts` error).
- [ ] `ColumnDef` has exactly `id`, `accessor`, `visible`, `order`,
      `label`, `meta`.
- [ ] `columns-schema/rules.ts` exports only `visible` and `visibleAsync`.

---
← [Step 2: Wire `withSorting({ schema })`](step-2-wire-with-sorting.plan.md) | [Step 4: Runtime spec](step-4-runtime-spec.plan.md) →
