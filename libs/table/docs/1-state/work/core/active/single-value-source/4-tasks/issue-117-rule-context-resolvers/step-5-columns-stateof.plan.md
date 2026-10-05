# Step 5 — Column rules: add `stateOf(path)`

**PR scope:** standalone, independent of Steps 1–4. **Depends on:**
none. **Parallel-safe with:** Steps 1, 2, 3, 4.

**Task type:** code

**Skills used:** angular-developer

**Scaffolding agent:** angular-implementer

## Files

- `libs/table/src/columns-schema/types.ts` (edit — `ColumnRuleContext`)
- `libs/table/src/engine/columns-schema/wire-columns-schema.ts` (edit —
  builds the ctx object)

## Why This Step Exists

`ColumnRuleContext<TRow>` today exposes only `columns: () =>
ColumnDef<TRow>[]` — a rule reading another column's config does
`ctx.columns().find((c) => c.id === 'status')?.visible`, a string-keyed
lookup over the whole array. ADR-0027 Rule 3's `stateOf(path)` is the
bound-tier resolver for "how is this column configured?" — it reads a
declaration (column config), not data, so it takes only a path, no
subject. Per the issue's R2 correction (2026-09-24), `stateOf` ships
**without** `order` — `ColumnDef.order` is `#128`'s to retire, not this
issue's to expose or omit as a design choice.

## What To Do

1. **`columns-schema/types.ts`.** Add to `ColumnRuleContext<TRow>`:

   ```ts
   export interface ColumnRuleContext<TRow> {
     readonly columns: () => ColumnDef<TRow>[]; // unchanged, stays
     stateOf<K extends string>(
       handle: ColumnHandle<TRow, K, unknown>,
     ): Pick<ColumnDef<TRow>, 'visible' | 'label' | 'meta'>; // no `order` — R2
   }
   ```

   `columns` is **not removed** — this is additive, matching the issue's
   own framing ("Column rules can name another column _without_ a
   string-keyed lookup", not "columns() is deleted"). Keep `columns` for
   whatever existing rule logic already reads the raw array for reasons
   other than "read one other column's state" (e.g. counting, filtering
   by visibility across all columns).

2. **`engine/columns-schema/wire-columns-schema.ts`.** The one
   construction site, `const ctx: ColumnRuleContext<TRow> = { columns:
() => core.baseColumns() };` (~line 40), gains `stateOf(handle) {
const column = core.baseColumns().find((c) => c.id === handle.id);
return { visible: column?.visible ?? true, label: column?.label ??
handle.id, meta: column?.meta }; }` — resolves against
   `baseColumns`, **never** the derived `columns` (same reasoning as the
   existing doc comment there: reading the derived `columns` here would
   close the `columns → ruleResults → params → resource →
ruleResults` cycle the file's own header comment warns about). Match
   this file's existing fallback values (`visible ?? true`) — check
   `engine/columns.ts`'s `resolveColumnDefs` defaults (`visible`
   defaults `true`, `label` defaults to `id`) rather than inventing new
   fallback values.

## Implementation Notes

- `stateOf`'s generic is per-method (`<K extends string>`), matching
  `FilterValueOfContext.valueOf`'s and Step 1's `ValueOfContext.valueOf`'s
  existing per-call-generic convention — don't make `ColumnRuleContext`
  itself generic over `K`.
- Reuse `ColumnHandle`/`ColumnsPath` (already exist in this file) — do
  not fabricate a second handle type for this resolver.

## Risks / Watchouts

- Don't read `core.columns` (the derived, folded signal) inside
  `stateOf` — only `baseColumns`, per the file's own existing
  cycle-avoidance comment.

## Non-Goals

- No `order` field on `stateOf`'s return (R2 — #128's decision).
- No removal of `ColumnRuleContext.columns` — additive only.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck` clean.
- [ ] `stateOf`'s return type has no `order` key.
- [ ] `wire-columns-schema.spec.ts`'s existing D8 test (`ctx.columns()`
      resolves against base state) still passes unchanged.

---

← [Step 4: Filtering rename to `criterionOf`](step-4-filtering-criterionof-rename.plan.md) | [Step 6: Construction check for resolver ids](step-6-construction-check.plan.md) →
