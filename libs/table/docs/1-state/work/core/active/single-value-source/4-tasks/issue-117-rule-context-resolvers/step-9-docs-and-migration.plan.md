# Step 9 — Docs, stories and fixtures migration

**PR scope:** standalone. **Depends on:** Step 2, Step 3, Step 4, Step 5.
**Parallel-safe with:** none (last step — describes the shipped
surface).

**Task type:** docs

**Skills used:** none

**Scaffolding agent:** none

## Files

- Any file matching
  `rg -n "\.valueOf\(" libs/table/src/stories libs/table/docs --glob
'*.ts' --glob '*.html' --glob '*.mdx'` that sits inside a
  `FilterOptions.when` — rename to `.criterionOf(`.
- `libs/table/docs/1-state/features/grouping.md` — document `when`'s new
  `ctx` parameter.
- `libs/table/docs/1-state/features/sorting.md` — document `sortFn`'s
  new `ctx` parameter.
- `libs/table/docs/1-state/features/filtering.md` — rename `valueOf` →
  `criterionOf` in prose.
- `libs/table/docs/2-columns/reference/tier-3-feature-config.md` —
  document `stateOf` alongside the existing `columns` context member.
- `libs/table/docs/decisions/grouping.md`, `sorting.md` — the workspace
  `decisions.md` already records G63–G68 as `shipped` pointing at
  ADR-0027 as their "built record"; **do not** re-flip these rows —
  ADR-0027 already marked them shipped in advance of this issue landing
  the code. Only add a new row if this issue makes a decision not
  already recorded (e.g. the `engine/resolvers.ts` file location, or the
  `knownIds`-reuse mechanism in Step 6) — check each capability's log
  first before adding anything. **Filtering has no decisions log yet**
  (`libs/table/docs/decisions/` has no `filtering.md`/`filters.md` —
  it hasn't been consolidated; `docs/status.md`'s Decisions column reads
  `—` for it). Don't create one as a side effect of this step — that's
  `capability-docs.md`'s own consolidation procedure, entered via
  `/audit-docs filtering`, not this issue's job. Note the rename in
  `docs/1-state/features/filtering.md` only.
- `libs/table/docs/1-state/work/core/active/single-value-source/decisions.md`
  — mark this issue's own R1 node (the "#117" entry, currently
  unresolved prose) as done, referencing this workspace's
  `4-tasks/issue-117-rule-context-resolvers/`.

## Why This Step Exists

The issue's own acceptance criteria: "Existing `when` predicates ...
untouched, and a spec proves it" (Step 7 covers the spec; this step
covers the docs saying the same); "Affected stories and fixtures
migrated; their `.mdx` code tabs match the code."

## What To Do

1. Run the `rg` search above; for each hit inside a `FilterOptions.when`,
   rename `.valueOf(` → `.criterionOf(`. Skip any hit that's actually
   Step 1–3's new grouping/sorting `valueOf` (by the time this step
   runs, those exist too — disambiguate by which feature's
   `when`/`sortFn` the call sits inside, same disambiguation Step 4
   already had to do).
2. Update the three feature docs and the columns reference doc with the
   new resolver shapes, using ADR-0027's own worked example table
   (`valueOf`/`criterionOf`/`stateOf` rows) as the canonical phrasing —
   don't restate ADR-0027's reasoning, just its shape, and link to it.
3. Check each of `decisions/grouping.md`, `decisions/sorting.md`, and
   whichever file holds filtering's decisions log for any row still
   reading `accepted, unbuilt` that this issue resolves (e.g. `sortFn`'s
   own resolver-spelling note) — flip only rows this issue's own work
   actually built, and cite this issue/workspace as the record.
4. Hand the edited docs to the `doc-compressor` agent afterwards for
   concision, matching how #100's own docs step (Step 6) did.

## Implementation Notes

- State invariants only, never implementation status, in any
  `CLAUDE.md` touched ([[claude-md-no-implementation-status]]).
- The status column is the only place supersession is expressed in a
  decisions log — no "(was ...)" prose in row text.

## Risks / Watchouts

- Don't touch archived work folders.
- Don't hand-edit `docs/status.md` — regenerate with
  `npm run table:status` only if a spec's frontmatter `code:` field
  actually changes because of this issue (unlikely — these three
  features' `spec`/`code` maturity doesn't change, only their resolver
  surface grows).

## Non-Goals

- No re-flip of G63–G68 (already `shipped` per ADR-0027, ahead of this
  issue's code landing).
- No changes to #100's own docs/decisions (its own Step 6 owns those).

## Acceptance Checks

- [ ] The `rg` search from step 1 above, re-run, returns zero hits
      inside a `FilterOptions.when`.
- [ ] `nx run shared-table:typecheck` clean, run **twice** — the second
      run is the only one that proves nothing regressed after any final
      doc-driven code touch-ups ([[typecheck-angular-templates]]'s "run
      twice" trap).
- [ ] `npm run llms:check` clean if any touched doc is in `llms.txt`'s
      scope.

---

← [Step 8: Cross-domain types-spec](step-8-types-spec.plan.md)
