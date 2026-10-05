# Step 3: `CLAUDE.md` + ADR-0003 corrections

**PR scope:** `libs/shared/design-system/src/ui/table/CLAUDE.md`, an ADR-0003 amendment under
`libs/shared/design-system/docs/adr/`.

**Task type:** docs

**Depends on:** Step 1 (independent of Step 2 — no file overlap, can run in parallel with it)

## Files

- `libs/shared/design-system/src/ui/table/CLAUDE.md` (edit)
- `libs/shared/design-system/docs/adr/0003-*.md` (edit — find the actual filename; amend, don't
  create a new ADR)

## Why This Step Exists

The table's internal engine reference (`CLAUDE.md`) currently describes `engine/core.ts` and
`api/update-columns.ts` in terms of the pre-#15 shape (`columns` as the writable single source of
truth). Once Step 1 lands, that description is wrong and would mislead the next maintainer who
reads it before touching either file. `TableFeatureSpec` is ADR-0003's documented feature
contract, and Step 1 adds semantics to its `columnRules` key (from "declared but unread" to
"read and merged by `composeTable()`") — the contract's shape doesn't change, so this is an
amendment, not a new ADR (per `4-architecture.md`'s open question 1, resolved this way).

## What To Do

- In `libs/shared/design-system/src/ui/table/CLAUDE.md`'s file-layout table:
  - Correct the `engine/core.ts` row to describe the `baseColumns` / `columnRules` / derived
    `columns` split, not a single writable `columns` signal.
  - Correct the `api/update-columns.ts` row to note it writes to `baseColumns`, not `columns`.
- Find the actual ADR-0003 file under `libs/shared/design-system/docs/adr/` (filename likely
  `0003-*.md` — confirm before editing) and add an amendment section (don't rewrite history)
  documenting: `TableFeatureSpec.columnRules` is now read by `composeTable()`'s `foldFeatures()`
  and merged additively (not through `SlotRegistry` — rules from multiple features on the same
  column both apply, combined via `foldColumnRules`'s AND reducer), landed via #14/#50.

## Implementation Notes

- Keep both edits factual and current-state-only — this isn't a narrative retelling of the
  refactor, it's correcting two references so they match the code that now exists.
- If ADR-0003 has an existing "Amendments" or "Updates" section convention, follow it; if not,
  add a dated subsection rather than editing the original decision text in place.

## Risks / Watchouts

- Don't touch anything under `docs/1-state/`, `docs/2-columns/`, `docs/3-ui/` — those are
  permanent spec/reference docs for other domains within this table, out of scope here.
- Confirm the ADR-0003 filename before editing; don't guess a path that doesn't exist.

## Non-Goals

- Any code change — this step is docs-only.
- Rewriting `3-spec.md` / `4-architecture.md` in this work folder — those stay as the historical
  record of what was decided; they aren't "corrected" after the fact.

## Acceptance Checks

- `CLAUDE.md`'s `engine/core.ts` and `api/update-columns.ts` rows match the post-Step-1 code.
- ADR-0003 has an amendment documenting the `columnRules` semantics change, without rewriting the
  original decision.

---

← [Step 2: `feature.spec.ts` — D2/D5/D8/D9 cases and the required-`onError` rewrite](step-2-feature-spec-tests.plan.md)
