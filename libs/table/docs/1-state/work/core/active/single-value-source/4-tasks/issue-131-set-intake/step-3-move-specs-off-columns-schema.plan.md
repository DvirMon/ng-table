# Step 3 — Move the three specs off `columnsSchema`

**PR scope:** standalone. **Depends on:** Step 1.
**Parallel-safe with:** Step 2.

**Task type:** test

**Skills used:** unit-test

**Scaffolding agent:** test-implementer

## Files

- `libs/table/src/api/create-table.spec.ts` (edit — 2 sites,
  `:213-245`)
- `libs/table/src/api/features/with-sorting.spec.ts` (edit —
  2 sites, `~:457`, `~:506`)
- `libs/table/src/engine/columns-schema/wire-columns-schema.spec.ts`
  (edit — ~19 sites)

## Why This Step Exists

Step 4 deletes `columnsSchema`. These are the only three
files that pass it (verified 2026-09-24: no story host,
fixture or mock does). Moving them first keeps every step
green.

These specs also become the runtime proof for the AC
"a set resolves the same declared columns and the same
rules". The assertions don't change, only the intake does.
So a pass shows the set path is behaviour-equivalent to
the array + schema path it replaces.

## What To Do

At each call site, the rules move into the third argument
of `createColumns(data, build, schema)`, and `columns:` takes
the resulting set:

```ts
// before
createTable(data, {
  trackBy: 'id',
  columns: makeColumns(),
  columnsSchema: (path) => visible(path.status, { when }),
});

// after
createTable(data, {
  trackBy: 'id',
  columns: createColumns(data, (col) => [col('name'), col('status')],
    (path) => visible(path.status, { when })),
});
```

- **One local set-factory per file** (e.g.
  `makeColumnSet(data, schema?)`) mirroring that file's
  existing `makeColumns()` via `col()`. Call sites stay
  one-liners.
- **Leave `makeColumns()` and every non-schema call site
  alone.** Migrating the array fixtures is #137's job.
- A standalone `columnSchema(...)` value
  (`create-table.spec.ts:233`,
  `wire-columns-schema.spec.ts:146`) passes straight through
  as `createColumns`' third argument. Keep one case per file
  that exercises that form.
- The data witness is the same signal handed to
  `createTable`. Where the spec inlines `signal<Row[]>([])`,
  bind it to a `const` first.
- `wire-columns-schema.spec.ts`'s `makeStore(config)` helper
  may take a set directly. Adjust its parameter type rather
  than wrapping every call.
- Rename the `describe`/`it` titles that name
  `columnsSchema`, e.g. "(via createTable columnsSchema
  wiring)" → "(via a column set's schema)".

Add **one** new case in `create-table.spec.ts`: a set whose
schema names an undeclared id throws at `createTable`, not
at `createColumns`. That pins the interim location until
#132 moves the check.

## Implementation Notes

- `col()` accepts only `label`, `visible` and `accessor`.
  Reproduce each factory's accessors with
  `col(id, { accessor })`.

## Risks / Watchouts

- **If a migrated factory sets something `col()` cannot
  express** (`sortFn`, `order`, `enableSorting`, `meta`),
  stop and report the site. Don't widen `ColumnBuilder`,
  and don't drop the field. The `with-sorting.spec.ts`
  nullable-column factory is the likely one. Check it
  first.
- Pair every changed site with its unchanged assertion. If
  an assertion needs editing to pass, that is a behaviour
  difference between the two intakes. Report it, don't
  adjust it.

## Non-Goals

- No `makeColumns()` / `ColumnDef<Row>[]` migration (#137).
- No type-spec edits (Step 5).
- No `columnsSchema` removal (Step 4).

## Acceptance Checks

- [ ] `grep -rn "columnsSchema:" libs/table/src` returns
      nothing.
- [ ] No existing assertion edited.
- [ ] The new unknown-id-in-a-set case throws at
      `createTable`.
- [ ] The three spec files pass.
- [ ] `nx run shared-table:typecheck-spec` clean.

---
← [Step 2: Generator constraint](step-2-generator-constraint.plan.md) | [Step 4: Delete `columnsSchema`](step-4-delete-columns-schema.plan.md) →
