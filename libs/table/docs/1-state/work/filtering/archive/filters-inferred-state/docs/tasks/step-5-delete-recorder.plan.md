# Step 5 — Delete the ambient recorder and its type residue

**PR scope:** PR 1 of 2 (`#76`). **Depends on: Step 3, Step 4.** **Blocks Step 6.**
**Task type:** `code`
**Stack:** angular
**Skills used:** `file-organization`
**Scaffolding agent:** `angular-implementer`

## Files

| File                                              | Action                                           |
| ------------------------------------------------- | ------------------------------------------------ |
| `libs/shared/table/src/filters/recorder.ts`       | **delete**                                       |
| `libs/shared/table/src/filters/types.ts`          | edit — remove the recorder residue               |
| `libs/shared/table/src/filters/create-filters.ts` | edit — drop the stub recorder Step 4 left behind |

**Added 2026-09-14 during `/implement`:** `create-filters.ts` was not in this table originally.
Step 4 had to fabricate each `FilterHandle` with a dead `[FILTER_RECORDER]: { record: () => {} }`
stub, because `FilterHandle` still required the field. Removing the field here without removing
that stub leaves an excess-property error, so the two edits are one step.

## Why This Step Exists

Steps 3 and 4 left the recorder with no callers. Keeping it would leave two mechanisms for the same
job in the same folder, and the dead one is the one with the ambient stack, the session lifetime and
the staleness assertion — precisely the machinery whose caveats this change exists to remove.

It is a separate step from Step 4 so the deletion is reviewable on its own: a diff that is purely
removal is read differently from a diff that is a rewrite, and mixing them hides whether anything
was quietly kept.

## What To Do

1. **Delete `src/filters/recorder.ts`.** Everything in it goes: `createFilterRecorderSession`, the
   `activeFilterRecorderStack`, `withActiveFilterRecorder`, `currentFilterRecorder` and
   `assertFilterPathIsCurrent`. `buildFiltersPath` is not lost — Step 4 moved it into
   `create-filters.ts`.
2. **Remove the residue from `types.ts`:**
   - `FILTER_RECORDER` (the `unique symbol`)
   - `FilterSchemaRecorder<TRow>`
   - the `[FILTER_RECORDER]` field on `FilterHandle`
3. **Confirm the remaining handle shape.** `FilterHandle<TRow, K>` should be `{ readonly id: K }`
   and nothing else. Leave the `@internal` tag and the comment about it being fabricated per path
   access; drop the clause about carrying its own recorder.
4. **Drop the stub recorder in `create-filters.ts`.** `buildFiltersPath`'s handle literal carries
   `[FILTER_RECORDER]: { record: (): void => {} }` with a comment marking it stale and owned by this
   step. Remove the property and the comment, and drop `FILTER_RECORDER` from that file's import
   list. The handle becomes `{ id: property as Extract<keyof TRow, string> }`.
5. **Grep the library for stragglers.** `recorder`, `FILTER_RECORDER`, `withActiveFilterRecorder`,
   `assertFilterPathIsCurrent`, `currentFilterRecorder`. Hits under `src/schema/` are a **different,
   unrelated recorder** — `ColumnSchemaRecorder` — and must not be touched.

## Implementation Notes

- The library's own typecheck is green at the end of this step. The **spec** typecheck is not: every
  call site still declares the previous shape, and `#77` is what restores it. Expect
  `tsconfig.spec.json` to fail here and do not chase it.
- `state.ts`, `evaluator.ts`, `validate.ts` and `matchers.ts` never imported the recorder. If a
  deletion breaks one of them, something in Step 3 or 4 leaked — fix that, do not re-add a symbol.
- Non-reentrancy, "handles are only valid inside the synchronous schema execution", and the `anyOf`
  row-type gap were all consequences of the ambient stack. They stop being true facts about the
  library here. Correcting the prose that states them is `#79`; do not fix docs in this step.

## Risks / Watchouts

- **`src/schema/`'s recorder is a different thing with a similar name.** It serves column schemas,
  carries `ColumnDef`/`baseColumns` this domain has never had in scope, and is live. A search-driven
  deletion that reaches it breaks a shipped, unrelated feature.
- A `unique symbol` removal is invisible at runtime but changes structural assignability of
  `FilterHandle`. If a file elsewhere constructs a handle literal, it now has an extra property —
  grep before deleting rather than after.

## Non-Goals

- The barrel — Step 6. It still lists the same symbols at the end of this step, and its header
  comment still names `recorder.ts` as a withheld internal. That is stale for one step, on purpose.
- Any doc, ADR or `CLAUDE.md` edit — `#79`.
- Any spec edit — `#77`.

## Acceptance Checks

- [ ] `src/filters/recorder.ts` does not exist
- [ ] `FILTER_RECORDER`, `FilterSchemaRecorder` and the handle's recorder field are gone from
      `types.ts`
- [ ] `FilterHandle` carries only `id`
- [ ] No file under `src/filters/` references any recorder symbol
- [ ] `src/schema/`'s column-schema recorder is untouched
- [ ] `nx run shared-table:typecheck` is clean
- [ ] `npx tsc -p libs/shared/table/tsconfig.spec.json --noEmit` fails **only** in spec files, and
      only on the declaration shape `#77` rewrites

---

← [Step 4: The row carrier and the array schema](step-4-carrier-and-array-schema.plan.md) | [Step 6: Export the token from the domain barrel](step-6-barrel-export.plan.md) →
