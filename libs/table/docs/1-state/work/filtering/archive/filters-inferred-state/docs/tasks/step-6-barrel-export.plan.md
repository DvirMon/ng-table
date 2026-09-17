# Step 6 — Export the row-type token from the domain barrel

**PR scope:** PR 1 of 2 (`#76`). **Depends on: Step 2, Step 5.**
**Task type:** `code`
**Stack:** angular
**Skills used:** `file-organization`
**Scaffolding agent:** `angular-implementer`

## Files

| File | Action |
|---|---|
| `libs/shared/table/src/filters/index.ts` | edit |

## Why This Step Exists

`rowOf()` is the server-mode escape hatch and is useless while it is internal — the story that
demonstrates it in `#77` reaches it through the library's public surface, not through a deep
import. The barrel is also where the deletion in Step 5 becomes visible: the header names
`recorder.ts` as an internal the barrel deliberately withholds, and that file no longer exists.

Last step in the issue, because both halves depend on earlier work landing — the token on Step 2,
the header correction on Step 5.

## What To Do

1. Add to the explicit export list:
   ```ts
   export { rowOf } from './row-of';
   export type { RowToken } from './row-of';
   ```
   Keep the file's existing convention: named symbols, alphabetised, never `export *`.
2. Fix the header comment. It currently reads, in part, that `evaluator.ts`, `recorder.ts`,
   `state.ts` and `validate.ts` are internal precisely because they are not listed. Drop
   `recorder.ts` from that list — citing a deleted file as a withheld internal is worse than not
   mentioning it, because it tells a maintainer to go looking for something that is gone.
3. Leave `src/index.ts:88` alone. It is already `export * from './filters'`, so the new symbols
   reach the library's public surface with no edit there.

## Implementation Notes

- `RowToken` is exported as a **type**, `rowOf` as a value. A consumer annotating with `RowToken`
  should be able to, but nobody constructs one by hand.
- The near-collision with `engine/types.ts`'s `RowOf<S>` is accepted and casing separates them.
  `RowOf` is internal and stays unexported; do not rename either to avoid the pair.
- Do not opportunistically reorganise the barrel or move symbols between its blocks. That churn was
  deliberately sequenced away from this change.

## Risks / Watchouts

- **Check for a name collision on the public surface.** `src/index.ts` re-exports this barrel
  wholesale alongside several others. Confirm no other domain already exports `rowOf` or `RowToken`
  before adding them.
- The library's maintainer notes describe this barrel by what it lists and what it withholds. Those
  notes are `#79`'s to correct — this step changes the barrel, not the notes.

## Non-Goals

- Editing `libs/shared/table/CLAUDE.md` or any doc that describes the barrel — `#79`.
- Restructuring the barrel, or splitting the domain's public surface — a separate concern,
  deliberately sequenced after this ticket.
- Exporting anything else new. `FilterRule`, `StateOf`, `GroupRule` and `ConditionalRule` are
  mechanism: a consumer reads the criterion map off `Filters`, never off the fold.

## Acceptance Checks

- [ ] `rowOf` and `type RowToken` are exported from `src/filters/index.ts`
- [ ] No other symbol was added, removed or reordered
- [ ] The header comment no longer cites `recorder.ts`
- [ ] `src/index.ts` is unchanged
- [ ] `rowOf` is importable from the library's public entry point
- [ ] `nx run shared-table:typecheck` is clean

---
← [Step 5: Delete the ambient recorder](step-5-delete-recorder.plan.md)
