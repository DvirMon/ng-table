# Step 2 — Duplicate column ids throw at construction

**PR scope:** One construction-time guard in `resolveColumnDefs`, `ngDevMode`-guarded. Ships and
reviews on its own — it is a correctness fix for a bug that exists today, independent of whether
`cells` ever lands.
**Parallel-safe with:** Step 1, Step 3, Step 4 — touches `engine/columns.ts` only, which no other
step edits.
**Task type:** `code`
**Skills used:** `angular-developer`
**Scaffolding agent:** `angular-implementer`

## Files

| File                               | Action                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------- |
| `libs/table/src/engine/columns.ts` | edit — `declare const ngDevMode`, uniqueness check in `resolveColumnDefs` |

## Why This Step Exists

`cells` (Step 3) is a `Record<string, unknown>` keyed by column id. Two columns sharing an id
collapse to last-wins in that record, and **both** table cells then render the same value — a
silent wrong reading with no degraded-but-visible form. Nothing validates uniqueness today;
`resolveColumnDefs` just `.map()`s.

This is not hypothetical. TanStack v8 keys `Row._valuesCache` by column id — the same
`Record<columnId, unknown>` shape — ships no check, and produces exactly that.

Under ADR-0014's classification this is squarely the construction class: deterministic, fires on
the first run before any data flows, and there is no sane degraded reading of "which of these two
is the value". So it throws.

It lands before, or alongside, Step 3 rather than after, so the invariant `cells` depends on is
in place the moment the record exists.

## What To Do

### `engine/columns.ts`

**Declare the guard.** `tsconfig.lib.json` sets `"types": []`, so there is no ambient
`ngDevMode`. Declare it module-scoped at the top of the file:

```ts
// Angular's global dev-mode flag. Declared locally because `tsconfig.lib.json` sets
// `"types": []`, so no ambient declaration is in scope. Module-scoped, so it cannot
// collide with another file's declaration.
declare const ngDevMode: boolean | undefined;
```

**The check**, inside `resolveColumnDefs`, before the `.map()`:

```ts
function assertUniqueColumnIds<TRow>(defs: ColumnDefInput<TRow>[]): void {
  const seen = new Set<string>();
  for (const def of defs) {
    if (seen.has(def.id)) {
      throw new Error(
        `[createTable] Duplicate column id provided: "${def.id}" — ensure all column ids are unique.`,
      );
    }
    seen.add(def.id);
  }
}
```

Called from `resolveColumnDefs` behind the guard:

```ts
export function resolveColumnDefs<TRow>(defs: ColumnDefInput<TRow>[]): ColumnDef<TRow>[] {
  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    assertUniqueColumnIds(defs);
  }
  return defs.map(/* unchanged */);
}
```

The `typeof ngDevMode === 'undefined' ||` half matters: outside an Angular build (plain `vitest`,
a consumer bundling without the flag defined) the symbol is absent, and the check must still run
rather than silently disappear. This is Angular's own convention.

**Message shape** is settled by D10 and is not a free choice: `[createTable]` prefix matching the
library's other construction throws, the offending id quoted, and the rule stated inside the text
(AG Grid's habit) so the reader does not have to infer it.

## Implementation Notes

`resolveColumnDefs` is the only correct placement. It is the single construction-time entry point
for a column list — reached both from `createTableCore`'s initial `signal(...)` and from any
later `setColumns` path that re-resolves inputs. Angular CDK validates in `_cacheColumnDefs()`
and AG Grid in `buildColumnTree`, both at the same phase. Never per row, never at first paint.

`engine/` is pure — no signals, no Angular imports. A `declare const` adds no runtime import and
keeps that true, so `columns.spec.ts` stays a bare `vitest` spec.

Extract `assertUniqueColumnIds` as a named function rather than inlining the loop: it is a
boolean-shaped guard with its own reason to exist, and naming it is what makes the guarded call
site read as one line (`extract-encapsulated-logic`).

## Risks / Watchouts

- **The guard is `ngDevMode`, and that is a deliberate, recorded cost.** In a production build
  the throw is stripped and a duplicate resolves last-wins silently. Do not "fix" this by making
  it unconditional — D10 weighed it and chose not to take down a production app over a config
  error. It is also the only dev-guarded construction throw in the library; that inconsistency is
  noted in ADR-0022 and is not this step's to resolve.
- **Scope is the `id`, never the `accessor`.** Two columns reading one field under different
  headers is an endorsed pattern (TanStack discussion #5148; AG Grid's `field`/`field_1`). A
  check on `accessor` identity, or on the resolved value, would break it.
- **Do not auto-suffix.** AG Grid's `id`/`id_1` rewrite was rejected — its own docs say not to
  rely on the generated ids, and it suffixes silently when two `field`s collide.
- **An existing fixture or story may have duplicate ids.** If one turns up, that is a real bug
  this check just found — fix the fixture, do not weaken the check.
- No tests in this step — Step 5.

## Non-Goals

- No `cells` field, no `renderRows` change — Step 3.
- No uniqueness check anywhere else (`setColumns` updaters, `columnSchema()` paths). Every path
  that produces a resolved column list already funnels through `resolveColumnDefs`; adding a
  second site would be two guards to keep in sync.
- No audit of whether the library's other construction throws should become `ngDevMode`-guarded.
  That is its own ADR.

## Acceptance Checks

- [ ] `resolveColumnDefs` throws on a duplicate id with the exact message
      `[createTable] Duplicate column id provided: "<id>" — ensure all column ids are unique.`
- [ ] The guard is `typeof ngDevMode === 'undefined' || ngDevMode` — the check still runs when
      the symbol is absent.
- [ ] Two columns with distinct ids and the _same_ `accessor` resolve without throwing.
- [ ] `ngDevMode` is declared module-scoped in `engine/columns.ts`; no ambient/global `.d.ts`
      added, `tsconfig.lib.json` untouched.
- [ ] `engine/columns.ts` still imports nothing from `@angular/core` at runtime.
- [ ] Every existing `columns`, `core` and `compose-table` test passes **unedited**.
- [ ] `nx run shared-table:typecheck` clean, and `nx run shared-table:typecheck-spec` clean —
      re-run each after fixing any `.ts` error, since `ngc` aborts before the template phase.

---

← [Step 1: ADR-0022](step-1-adr-cell-value-surface.plan.md) | [Step 3: `RenderRow.cells`](step-3-render-row-cells.plan.md) →
