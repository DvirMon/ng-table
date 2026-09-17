# Step 13 — Split the older workspace's pointers and regenerate the roll-up

**PR scope:** PR 3 of 3 (`#107`). **Depends on: Step 11, Step 12.**
**Task type:** `chore`
**Stack:** angular
**Skills used:** —
**Scaffolding agent:** none (main thread)

## Files

| File | Action |
|---|---|
| `libs/shared/table/docs/1-state/work/with-filtering/state.json` | edit — split `specPath` / `architecturePath` |
| `libs/shared/table/docs/status.md` | **generated** — `npm run table:status` |
| root `llms.txt` | **generated** — `npm run llms`, only if the file set changed |

## Why This Step Exists

The older `with-filtering` workspace points both of its documents at the same place:

```json
"specPath": "libs/shared/table/docs/1-state/filters.md",
"architecturePath": "libs/shared/table/docs/1-state/features/filtering.md"
```

`specPath` aims at the filter model's reference and `architecturePath` at the feature's, so the
workspace claims the filter model is the *spec* for the feature. That pointer is the coupling in
documentation form, and it outlives the code change unless it is explicitly cut — it is why no
document described the feature alone in the first place.

The roll-up is regenerated last, once both owning specs carry correct frontmatter, because it reads
from them.

## What To Do

1. **Split the pointers.** The `with-filtering` workspace is the *feature's* workspace: both
   `specPath` and `architecturePath` belong to `docs/1-state/features/filtering.md`, or
   `architecturePath` is dropped to `null` if the feature has no separate architecture document.
   `docs/1-state/filters.md` must not be reachable from this workspace as its spec — it is the
   filter model's document and belongs to the filters domain.
   - If any other workspace `state.json` under `docs/1-state/work/` points across the same seam,
     fix it here too. Grep for `filters.md` across every `state.json` before deciding this is a
     one-file edit.
2. **Regenerate the capability roll-up**: `npm run table:status`. Never hand-edit `docs/status.md`;
   it is produced by `libs/shared/table/tools/generate-status.ts` from the `capability` / `spec` /
   `code` frontmatter keys that Steps 11 and 12 preserved.
3. **Regenerate `llms.txt`** with `npm run llms` if the context file set changed. Verify with
   `npm run llms:check`.

## Implementation Notes

- Confirm the generator output actually changed before committing. If `docs/status.md` is
  byte-identical after regeneration, that is the correct result — Steps 11 and 12 deliberately left
  `capability`, `spec` and `code` untouched — and the commit carries only the pointer split.
- Leave the `with-filtering` workspace's `checklist` alone. Its `spec`/`issues`/`tasks` flags
  describe that workspace's own history, not this one's.
- The `decouple-filters` workspace's own `state.json` already has `checklist.tasks: true` and needs
  no edit.

## Risks / Watchouts

- **Do not delete the `with-filtering` workspace or its research documents.** The decision record at
  `work/with-filtering/migration-decouple-filters-from-table.md` is cited by ADR-0016 and by this
  workspace's spec. Only the pointers are wrong, not the content.
- `npm run table:status` and `npm run llms` are the only commands this plan runs. Both are
  generators, not builds — everything else in this step is a file edit.

## Non-Goals

- Editing either owning spec — Steps 11 and 12 own their content and frontmatter.
- Hand-editing `docs/status.md` or `llms.txt` under any circumstance.
- Reorganizing the `with-filtering` workspace's files, or merging it into `decouple-filters`.

## Acceptance Checks

- [ ] `work/with-filtering/state.json` no longer points `specPath` at the filter model's document
- [ ] Each pointer names a document describing one domain
- [ ] No other `state.json` under `docs/1-state/work/` still crosses the seam
- [ ] `docs/status.md` is regenerated, not hand-edited
- [ ] `npm run llms:check` passes
- [ ] Across `docs/`, no document describes the deleted filter-model config field, the deleted type parameter, or the deleted internal side channel
- [ ] Cross-references between `features/filtering.md` and `filters.md` resolve to post-move paths

---
← [Step 12: Document the filter model's match contract](step-12-filters-spec-matcher-contract.plan.md)
