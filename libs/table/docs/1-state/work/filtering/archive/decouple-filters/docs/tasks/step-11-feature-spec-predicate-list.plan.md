# Step 11 — Rewrite the feature's spec for the predicate list

**PR scope:** PR 3 of 3 (`#73`). **Depends on: Step 10.** **Parallel-safe with Step 12.**
**Task type:** `docs`
**Stack:** angular
**Skills used:** `audit-docs`, `concise-docs`
**Scaffolding agent:** none (main thread)

## Files

| File | Line | Action |
|---|---|---|
| `libs/shared/table/docs/1-state/features/filtering.md` | `:1-11` | edit — frontmatter `version`, `date` |
| `libs/shared/table/docs/1-state/features/filtering.md` | `:41-71` | rewrite — Config |
| `libs/shared/table/docs/1-state/features/filtering.md` | `:62-71` | delete — the criterion-map section and both call-site rules |
| `libs/shared/table/docs/1-state/features/filtering.md` | `:73-81` | edit — Behavior |
| `libs/shared/table/docs/1-state/features/filtering.md` | `:83-101` | edit — `manual` |
| `libs/shared/table/docs/1-state/features/filtering.md` | `:103-107` | edit — Errors |
| `libs/shared/table/docs/1-state/features/filtering.md` | `:109-117` | rewrite — Compile-Time Dependencies |

## Why This Step Exists

ADR-0016 records the decision; this brings the reference doc in line with what shipped. As written,
the document still describes a config field that no longer exists, a type parameter that no longer
exists, and two call-site rules that can no longer be violated — and it is the first thing a
developer reads when `withFiltering` does not compile.

## What To Do

**Config (`:41-61`).** Replace the code block and the field table:

```ts
interface WithFilteringConfig<TRow> {
  predicates: () => readonly ((row: TRow) => boolean)[];
  manual?: boolean;
}
```

| Field | Purpose |
|---|---|
| `predicates` | a thunk returning the row predicates to apply. Required — the feature's only input |
| `manual` | skip the client-side filter stage |

Keep the `TRow` inference note (`TRow` comes from the enclosing `createTable()` config, no per-call
generic). Add the two facts the thunk shape carries and that nothing else in the doc states: **one
call is one evaluation** — the thunk is invoked once per pass, not once per row, so every row in a
pass sees the same term list — and the thunk is read reactively, so filtering recomputes when a
signal it reads changes. Show the filter-model wiring as an example of composition, not as a config
option: `withFiltering({ predicates: () => [this.filters().matcher()] })`.

**Delete `:62-71` outright** — the "`TState` is carried, not pinned to the default" paragraph and
both bullets under it. The type parameter is gone, so neither rule (`TState` must be a `type`, not
an `interface`; never pass `In` explicitly) describes anything that can still happen.

**Behavior (`:73-81`).** Drop "Reads `filters().active()` and applies each active filter's
predicate to each row" — the feature no longer reads the filter model. Replace with: terms are
applied in order and AND'd; an empty list never narrows. Move the OR/AND and empty-criteria bullets
to a sentence saying those are the filter model's semantics, reached through whatever term the
consumer supplies — with the link to `filters.md`, not a restatement. The pipeline-stage and
null-cell bullets stand.

**`manual` (`:83-101`).** Fix the snippet to `withFiltering({ predicates, manual: true })`. Trim the
rationale one step further: with a consumer-supplied predicate list, "skip the stage" is very close
to "do not compose the feature". It stays for symmetry with `withSorting`, which is the same
argument as before, one step weaker. Keep the two-feature-convention precision note.

**Errors (`:103-107`).** State the table's own layer: the catch unit is one term, a throwing term is
dropped for that pass and reported once by its index, siblings keep narrowing. Note that a term
produced by `matcher()` reports under its own filter key from inside the evaluator, so the
index-based report is the floor for anonymous terms. Link ADR-0016 alongside ADR-0014.

**Compile-Time Dependencies (`:109-117`).** The section already says "None". Make it literally true
for the first time by stating that the feature imports nothing from the filters domain and names no
filter type — checkable by reading its import list. Keep the `ColumnDef.filterFn` /
`enableFiltering` removal paragraph.

## Implementation Notes

- Every path this doc cites must be the **post-move** path (`src/filters/…`, not `src/api/filters/…`)
  — Steps 9 and 10 have landed by the time this is written. Grep the file for `api/filters` and
  `api/create-filters` before finishing.
- Bump `version` to `3.0` and `date` to the day of the change. Leave `capability: filtering`,
  `spec: drilled` and `code: shipped` alone — Step 13 regenerates the roll-up from these keys.
- Per the repo convention, this doc is the reference; the *why* belongs in ADR-0016. Link, do not
  restate the rejected alternatives.

## Risks / Watchouts

- The Decisions and Resolved Questions sections (`:131-162`) carry R-numbers that reference the old
  config. Audit them — an R-number that is now moot should say so and point at ADR-0016, not be
  deleted silently, because the decision record still cites it.
- Do not delete the `manual` section. It is a retained feature with a weakened rationale, not a
  removed one.

## Non-Goals

- Editing `docs/1-state/filters.md` — Step 12 owns it.
- Splitting the older workspace's pointers or regenerating the roll-up — Step 13.
- Re-deciding anything. This step describes what shipped.

## Acceptance Checks

- [ ] The Config section describes the predicate list and names no filter-model type
- [ ] The criterion-map section is gone, along with both call-site rules it documented
- [ ] Compile-Time Dependencies says "None" and that is accurate against `with-filtering.ts`'s import list
- [ ] The `manual` rationale is trimmed to what still holds, and the section survives
- [ ] The Errors section states the per-term catch unit and links ADR-0016
- [ ] No path in the file points at `api/filters/` or `api/create-filters`
- [ ] Frontmatter `version` and `date` are bumped; `capability` is unchanged
- [ ] No source file is edited by this step

---
← [Step 10: Give the filters domain its own barrel](step-10-filters-barrel.plan.md) | [Step 12: Document the filter model's match contract](step-12-filters-spec-matcher-contract.plan.md) →
