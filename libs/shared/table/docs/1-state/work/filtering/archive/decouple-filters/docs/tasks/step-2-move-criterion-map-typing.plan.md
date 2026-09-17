# Step 2 — Move the criterion-map typing assertions into the filter model's own spec

**PR scope:** one PR. Parallel-safe with Step 1, Step 4. **Blocks Step 3.**
**Task type:** `test`
**Stack:** angular
**Skills used:** `unit-test`
**Scaffolding agent:** `test-implementer`

## Files

| File | Line | Action |
|---|---|---|
| `libs/shared/table/src/api/create-filters.spec.ts` | `describe('types')` @ 685 | edit — add cases |

Source of the moved assertions (read-only in this step):
`libs/shared/table/src/api/features/with-filtering.spec.ts:515-552`.

## Why This Step Exists

`with-filtering.spec.ts` currently asserts how the filter model carries its criterion map — that a
concretely-keyed `TState` survives declaration, that criteria are reachable by property access
rather than by bracket, and that `value()` / `active()` come back typed. None of that is table
behavior. It is the filter model's own contract, asserted from the wrong file.

This step is **add-only**, and it is sequenced before the deletion in Step 3 for exactly that
reason: the assertions exist in their new home before they leave the old one, so no revision of
the branch is ever missing them.

## What To Do

Extend `describe('types')` in `create-filters.spec.ts` with the criterion-map typing facts, using
that file's existing `Invoice` fixture and `build<TState>()` helper (`:62`) rather than importing
the feature spec's `Row`:

1. A concretely-keyed filter set keeps its criteria typed and reachable by **property** access:
   `expectTypeOf(filters.status().value()).toEqualTypeOf<string | null>()`.
2. The root's `value()` comes back as the declared criterion map, not widened:
   `expectTypeOf(filters().value()).toEqualTypeOf<InvoiceFilterState>()`.
3. `active()` comes back as `Partial<InvoiceFilterState>`.
4. A runtime companion proving the typed declaration actually narrows — set one criterion through
   property access, filter a plain array with `matcher()`, assert the surviving rows. This is what
   `with-filtering.spec.ts:530` was really testing once the table is taken out of it.

Declare a local `type InvoiceFilterState = { status: string | null; category: string | null }` and
a `buildTypedFilters()` helper inside the `types` describe, mirroring the existing
`buildTypedFilters()` at `:693` — either extend that helper to carry both keys or add a sibling;
do not duplicate a third shape.

Carry the explanatory comment from `with-filtering.spec.ts:506-514` across, trimmed to the part
that is still true: `Filters<TRow, TState>` is not assignable to `Filters<TRow>` because
`FilterNode<T>` holds an invariant `WritableSignal<T>`, so a consumer who declared a concrete
`TState` must not be forced to widen back to `unknown`.

## Implementation Notes

- Type-level assertions are inert under the vitest executor. The verification step for this block
  is `npx tsc -p libs/shared/table/tsconfig.spec.json --noEmit`, matching the banner already at
  `with-filtering.spec.ts:428-433`.
- `create-filters.spec.ts` already owns the row-type facts this pairs with — structural acceptance
  and unrelated-row rejection at `:699` and `:709`. Put the new cases next to them, not in a new
  top-level describe.
- Do not add a `withFiltering` import to this file. The filter model's spec must not reach for the
  table to state its own contract; that inversion is the defect this issue removes.

## Risks / Watchouts

- `Invoice`'s criterion types are not `Row`'s. Port the *assertions*, not the literals — a
  copy-paste of `string | null` against a field that is `number | null` passes for the wrong
  reason.
- `build<TState>()` runs inside `TestBed.runInInjectionContext`. Keep new helpers on that path.

## Non-Goals

- Deleting anything from `with-filtering.spec.ts` — Step 3 owns the deletion.
- Re-testing OR-within-a-group, empty-criterion skipping, or row-type rejection — already present
  at `:587`, `:575`, `:699` and `:709`.
- Touching `api/filters/matchers.spec.ts` or `api/filters/state.spec.ts` — untouched by this issue.

## Acceptance Checks

- [ ] The criterion-map typing assertions live in `create-filters.spec.ts`
- [ ] They use the file's own `Invoice` fixture and `build()` helper
- [ ] `create-filters.spec.ts` imports nothing from `./features/with-filtering`
- [ ] `npx tsc -p libs/shared/table/tsconfig.spec.json --noEmit` is clean
- [ ] `npx nx test shared-table` passes for `create-filters.spec.ts`
- [ ] `with-filtering.spec.ts` is unchanged by this step

---
← [Step 1: Migrate the story hosts](step-1-migrate-story-hosts.plan.md) | [Step 3: Split the feature spec by ownership](step-3-split-feature-spec.plan.md) →
