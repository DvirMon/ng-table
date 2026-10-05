# Step 12 — Document the filter model's match contract

**PR scope:** PR 3 of 3 (`#73`). **Depends on: Step 10.** **Parallel-safe with Step 11.**
**Task type:** `docs`
**Stack:** angular
**Skills used:** `audit-docs`, `concise-docs`
**Scaffolding agent:** none (main thread)

## Files

| File                                        | Line       | Action                                                    |
| ------------------------------------------- | ---------- | --------------------------------------------------------- |
| `libs/shared/table/docs/1-state/filters.md` | `:1-11`    | edit — frontmatter `version`, `date`                      |
| `libs/shared/table/docs/1-state/filters.md` | `:202-234` | edit — State: add `matcher()` to the root members         |
| `libs/shared/table/docs/1-state/filters.md` | `:336-344` | rewrite — Wiring → Client                                 |
| `libs/shared/table/docs/1-state/filters.md` | `:422-444` | edit — Semantics: the one-call-is-one-evaluation boundary |
| `libs/shared/table/docs/1-state/filters.md` | `:506-529` | edit — Public API table: post-move paths, barrel claim    |

## Why This Step Exists

`matcher()` shipped in `#68` and is the reason the two domains can be independent at all, but this
document does not mention it once — the only public member of the filters root that is undocumented.
A consumer reading this file today cannot discover the one thing the model exists to answer.

Two facts are needed, and only these two: **the match question** (ask the model for a row
predicate) and **its evaluation boundary** (one call is one evaluation).

## What To Do

**State (`:202-234`).** Add `matcher()` to the root-members snippet and to the member table,
alongside `value`, `active()`, `reset()` and `dirty()`:

```ts
filters().matcher(); // (row: TRow) => boolean, compiled from the current criteria
```

| Member      | Purpose                                                                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `matcher()` | a row predicate compiled from the model's current criteria — the model's answer to "does this row match?", usable with or without a table |

State why it is on the root rather than as a top-level member: `Filters` is an intersection whose
second half is a mapped type over the criterion keys, so a top-level `matcher` would collide with a
filter literally keyed `matcher`. The root is a plain interface with no such hazard — the same
reasoning that put `value`, `active`, `reset` and `dirty` there.

State the consequence for `TRow`: `matcher(): (row: TRow) => boolean` puts `TRow` in the type body,
so a filter set built for an unrelated row type is now rejected at compile time. Structurally
compatible and wider row types still work. Link ADR-0016 for the full statement — this is a public
type-behavior change, not a detail of this section.

**Semantics (`:422-444`).** Add the evaluation boundary: **one `matcher()` call is one evaluation.**
The returned predicate compiles the narrowing records once — gating and emptiness resolve per call,
not per row — and per-filter error reporting is deduped within that one instance. Calling
`matcher()` again produces a fresh predicate with fresh dedup state. A consumer holding the
predicate across passes gets one pass's semantics; the table calls it once per pass, which is what
makes the reporting behavior identical to before the decoupling.

**Wiring → Client (`:336-344`).** The snippet still shows `withFiltering({ filters: this.filters })`.
Replace with the composition expression:

```ts
createTable(
  data,
  { trackBy: 'id', columns },
  withFiltering({ predicates: () => [this.filters().matcher()] }),
);
```

Add the sentence this section now earns: neither side imports the other — the table never learns
what a criterion is, the filter model never learns what a pipeline stage is.

Also add, here or under Semantics, the case that has no table at all: `rows.filter(filters().matcher())`
filters a plain array. That is the claim this whole change makes, and it is currently unwritten.

**Public API (`:506-529`).** Update every path in the table to post-move (`filters/create-filters.ts`,
`filters/types.ts`, `filters/rules.ts`, `filters/matchers.ts`). Remove the `withFiltering`,
`WithFilteringConfig` row — that is the table's surface, documented in
`features/filtering.md`, and listing it here is the doc-level version of the
coupling being removed. Fix the framing sentence: these symbols are exported from
`src/filters/index.ts`, the domain's own barrel, which the library's `src/index.ts` re-exports
wholesale. Drop "(**replaces** the current file)" and the "Files are new unless marked" note — both
are expand–contract scaffolding from a change that has now fully landed.

## Implementation Notes

- Every path must be **post-move**. Grep the file for `api/filters` and `api/create-filters` before
  finishing; `:511-518` is the dense cluster.
- Bump `version` to `1.2` and `date`. Leave `capability: filters`, `spec: drilled`, `code: shipped`
  alone — Step 13 regenerates the roll-up from these keys.
- The status banner at `:32-34` describes what is on disk and names `api/filters/`. Update it or cut
  it; a shipped-state banner citing a folder that no longer exists is the exact staleness this issue
  is removing.
- Keep it terse. Two facts and a corrected snippet — this is not a rewrite of a 530-line document.

## Risks / Watchouts

- Do not document `createFilterEvaluatorFrom`, `FiltersInternal`, or anything else in
  `evaluator.ts`. They are domain-internal by Step 10's barrel and must not reappear as public
  contract in prose.
- The `Deliberately not shipped` section (`:490`) may list the match question as absent. Check it —
  an entry there contradicting the new `matcher()` row is worse than no entry.

## Non-Goals

- Editing `docs/1-state/features/filtering.md` — Step 11.
- Splitting the older workspace's pointers or regenerating the roll-up — Step 13.
- Documenting the folder move as a decision; ADR-0004 owns the layout invariant and ADR-0016 owns
  the contract.

## Acceptance Checks

- [ ] `matcher()` appears in the root-members snippet and the member table, with the on-the-root rationale
- [ ] The one-call-is-one-evaluation boundary is stated, including dedup scope
- [ ] The Client wiring snippet shows the composition expression, and the no-table case is documented
- [ ] The Public API table carries post-move paths and no longer lists the table's feature symbols
- [ ] No path in the file points at `api/filters/` or `api/create-filters`
- [ ] No internal evaluator symbol is described as public
- [ ] Frontmatter `version` and `date` are bumped; `capability` is unchanged
- [ ] No source file is edited by this step

---

← [Step 11: Rewrite the feature's spec for the predicate list](step-11-feature-spec-predicate-list.plan.md) | [Step 13: Split the older workspace's pointers and regenerate the roll-up](step-13-split-pointers-regenerate.plan.md) →
