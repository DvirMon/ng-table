# Step 4 — Correct the remaining surfaces, close #56, regenerate the roll-up

**PR scope:** PR 1 of 1 (`#79`). **Depends on: Step 1, Step 2.**
**Task type:** `chore`
**Stack:** angular
**Skills used:** —
**Scaffolding agent:** none (main thread)

## Files

| File | Action |
|---|---|
| `libs/shared/table/CLAUDE.md` | edit — the filters barrel row and its internals claim |
| `libs/shared/table/docs/3-ui/stories.md` | edit — the `createFilters` placement rule's landmine |
| `libs/shared/table/docs/0-product/filtering.md` | edit — one illustrative call, one line |
| `libs/shared/table/docs/adr/0016-filtering-takes-a-predicate-list.md` | edit — dated amendment note only, body untouched |
| `libs/shared/table/docs/status.md` | **generated** — `npm run table:status` |
| root `llms.txt` | **generated** — `npm run llms`, only if the context file set changed |
| GitHub issue `#56` | comment + confirm closed as fixed-by-design |

## Why This Step Exists

Four small corrections, one issue close and two generator runs. They are one step because they are
each a few lines, they route the same way (main thread, no agent), and splitting them would
produce four PRs whose review is "yes, that sentence was stale."

It depends on Steps 1 and 2 for two different reasons, and both are real:

- the roll-up is derived from the two specs' frontmatter, so it is regenerated *after* they are
  final, never before;
- `#56`'s closing comment has to name the change that removed the landmines, which is only true
  once the landmine text is actually gone from the filters spec and from `stories.md`.

## What To Do

### 1. The library's maintainer notes — `libs/shared/table/CLAUDE.md`

The `filters/index.ts` row (~L44) describes the barrel by what it lists and what it withholds, and
both halves are now wrong. Check the row against `src/filters/index.ts` and correct:

- the symbol inventory — the barrel now also exports `rowOf` and the `RowToken` type, so a count
  or a phrase like "its three types, the nine rules, the six matchers" has to account for them;
- the withheld-internals clause — it names `recorder.ts`, which does not exist. `evaluator.ts`,
  `state.ts` and `validate.ts` are the internals that remain. Citing a deleted file as a withheld
  internal is worse than not mentioning it: it sends a maintainer looking for something gone.

Check the `filters/` line in the layout tree (~L33) and the `docs/1-state/filters.md` row (~L122)
in the same pass — both are expected to still be accurate, and confirming that is the point.

This file carries invariants and conventions only — implementation status lives in `docs/status.md`
and in the ADRs. Do not add an "as of #79" note or any status line.

### 2. The story conventions — `docs/3-ui/stories.md`

The "`createFilters()` is the exception, and belongs in the host" paragraph (~L141) ends with a
landmine that has inverted: *"the `createFilters<TRow, TState>(…)` call goes in the host's field
initializer. Pass `TState` there too: without it every node reads back `unknown`…"*

Following that advice now fails to compile. Replace those two sentences with the shipped shape —
`createFilters(rows, (path) => [ … ])` in the host's field initializer, criterion types inferred
from the returned rules, no annotation to pass. The convention the paragraph exists to state (the
schema belongs in the host, not the fixture) is unchanged and stays.

### 3. The product doc — `docs/0-product/filtering.md`

One line (~L33) quotes a developer-voice call as an illustration:
`createFilters<Invoice>((path) => { equals(path.status); })`. Update the snippet to the array form.
Nothing else in this file changes — it is the product pass's document and its coverage marks,
scope and §8 disagreement are not this issue's to touch.

### 4. ADR-0016 — amendment note, body untouched

The ADR shows `createFilters<InvoiceRow>(…)` (~L98) and names both `TState` landmines (~L106) as
the record of what was true when it was accepted. **Decided 2026-09-14: add a dated amendment note
near the top, change nothing in the body** — the same treatment R43's banner gets in the decisions
doc.

Three or four lines: dated, naming `#75` as the change that inferred the criterion map, stating
that the call sites the ADR quotes now take a row carrier and return an array, and pointing at
`../1-state/filters.md` for the shipped surface. Do not rewrite the quoted call and do not delete
the landmine sentence — the ADR is a record of a moment, and the landmines are part of why the
decision read the way it did.

### 5. Close `#56` as fixed-by-design

`#56` ("Table: typed createFilters() state cannot reach withFiltering()") is already in the
`CLOSED` state. Confirm that, then add the comment it is missing:

- the criterion map is now inferred from the schema, so there is no caller-supplied type parameter
  left to fail to reach the feature;
- the feature takes a predicate list and names no filter type at all (ADR-0016, `#71`), so the
  assignability path the issue described no longer exists;
- both documented landmines are deleted, not worked around;
- name the changes: `#76` inferred the map, `#77` migrated the call sites, `#79` reconciled the
  docs. Closed as **fixed-by-design**, not as completed work.

Check whether the two consumer-side workarounds the issue cites still exist
(`src/stories/filtering/fixtures/utils.ts`'s `CriterionControl<T>`, and the grouping cluster's
`readRepCriterion`). State what you find in the comment — if they survived `#77`, say so plainly
rather than implying the workaround is gone. **Do not delete them in this step**; that is a code
change and this issue is documentation.

### 6. Regenerate, never hand-edit

```bash
npm run table:status     # rewrites libs/shared/table/docs/status.md
npm run llms             # rewrites root llms.txt, only if the context file set changed
npm run llms:check       # verifies
```

`docs/status.md` is derived from the specs' `capability` / `spec` / `code` frontmatter, which
Steps 1 and 2 deliberately left untouched — so byte-identical output is the **correct** result
here, not a sign the command failed. If the file does change, something in Step 1 or 2 edited
frontmatter it should not have; fix that there, not here.

## Implementation Notes

- These are the only two commands this plan runs. Both are generators, not builds.
- `npm run llms` is conditional: no context file was added or removed by this issue, so it is
  expected to be a no-op. Run `llms:check` regardless.
- The step's `Task type` is `chore` because it runs generators and touches the tracker. Both
  `docs` and `chore` route to the main thread, so the mixed content carries no routing ambiguity.

## Risks / Watchouts

- **Do not hand-edit `docs/status.md` or `llms.txt` under any circumstance.** Both carry a
  generated-file banner.
- **Do not reopen `#56`.** It is closed; this adds the comment that explains *why* it is closed.
- The `#56` comment is outward-facing and permanent. Get the issue numbers right before posting —
  `#76` (inference), `#77` (call sites), `#79` (docs).

## Non-Goals

- Deleting `CriterionControl<T>` or `readRepCriterion`. If they are dead after `#77`, that is a
  code cleanup and wants its own issue.
- Editing ADR-0016's body, or adding a superseded banner to the ADR as a whole — the decision it
  records still stands; only its illustrations date it.
- The workspace's own research and migration documents. They are records of their tickets.
- `docs/0-product/filtering.md` beyond the one snippet.

## Acceptance Checks

- [ ] `CLAUDE.md`'s `filters/index.ts` row matches `src/filters/index.ts`, `rowOf`/`RowToken`
      included, and no longer cites `recorder.ts`
- [ ] `CLAUDE.md` gained no status or changelog line
- [ ] `3-ui/stories.md` no longer tells a host author to pass the criterion map
- [ ] Across `docs/` and `CLAUDE.md`, no living document shows a `createFilters` call with explicit
      type arguments — ADR-0016's quoted call is the one deliberate exception, and it carries the
      amendment note
- [ ] ADR-0016's body is byte-identical apart from the added note
- [ ] `#56` is closed with a comment naming `#76`, `#77`, `#79` and saying fixed-by-design
- [ ] The `#56` comment states the current status of both cited workarounds
- [ ] `docs/status.md` was regenerated, not hand-edited
- [ ] `npm run llms:check` passes
- [ ] `git status` shows no change under `libs/shared/table/src/`

---
← [Step 3: Mark the decision record](step-3-decision-record.plan.md)
