# Step 5 — Update the prose that describes the old config shape

**PR scope:** one PR. **Depends on: Step 1.**
**Task type:** `docs`
**Stack:** angular
**Skills used:** —
**Scaffolding agent:** none — main thread

## Files

| File                                                                                                | Line      | Says today                                                                                                            |
| --------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------- |
| `libs/shared/table/src/stories/filtering/client-filtering/client-filtering.mdx`                     | 13        | "`withFiltering({ filters })` applies a standalone `createFilters()` object…"                                         |
| `libs/shared/table/src/stories/filtering/server-filtering/server-filtering.mdx`                     | 14, 16-17 | "`withFiltering({ manual: true })`…"; "the same `createFilters()` object the client story hands to `withFiltering()`" |
| `libs/shared/table/src/stories/filtering/fixtures/schema.ts`                                        | 25, 38    | "Consumed by `client-filtering/`, which composes `withFiltering({ filters })`."                                       |
| `libs/shared/table/src/stories/filtering/client-filtering/client-filtering-story-host.component.ts` | 107, 110  | "The filtering baseline — `withFiltering({ filters })` over a standalone `createFilters()`…"                          |
| `libs/shared/table/src/stories/filtering/server-filtering/server-filtering-story-host.component.ts` | 72-74     | "No filtering feature is composed. `withFiltering({ manual: true })` exists for symmetry…"                            |

## Why This Step Exists

The issue's own note: prose references to the old config shape appear in three story docs and two
story fixture comments. Step 1 changes the code under them, so left alone they become documentation
that contradicts the file it sits in — the worst kind of stale doc, because it reads as
authoritative and is colocated with its own counter-example.

This step depends on Step 1 rather than running alongside it: the prose describes what the hosts
do, and it should be rewritten against the migrated code, not against the intention.

## What To Do

Rewrite each site to describe the composition the code now performs:

- `withFiltering({ filters })` → `withFiltering({ predicates: () => [filters().matcher()] })`.
- Where the prose frames the feature as _taking a filter model_, reframe it: the feature takes a
  list of row predicates, and the filter model supplies one of them through `matcher()`. The two
  are composed by the host, not welded by the library.
- Keep every claim that is still true. The client story is still the filtering baseline; the server
  story still composes no filtering feature and still serializes its `createFilters()` object into
  the request. Only the sentence describing _how the model reaches the table_ changes.

Site-specific:

- **`client-filtering.mdx:13`** — the opening sentence describing the feature's input. Rewrite, and
  check the rest of the file for a second mention before calling it done.
- **`server-filtering.mdx:14,16-17`** — `{ manual: true }` is unchanged and still correct; the
  cross-reference at `:17` ("the same `createFilters()` object the client story hands to
  `withFiltering()`") is the part that goes stale. The client story now hands `withFiltering()` a
  predicate; it hands the _request builder_ the filter model. Say that.
- **`fixtures/schema.ts:25,38`** — two JSDoc comments naming their consumer. Terse per the repo's
  JSDoc rule: name the consumer and the composition, nothing more.
- **`client-filtering-story-host.component.ts:107,110`** — the host's own class-level doc comment.
  `:110` ("The declaration is in the host, not a fixture") is still true and stays; `:107` is the
  sentence to rewrite. `:137`'s note about hand-supplied option lists is unaffected.
- **`server-filtering-story-host.component.ts:72-74`** — same reframing as the `.mdx`.

## Implementation Notes

- `predicate-filtering.mdx:15-16` already describes the predicate contract correctly (it shipped
  with `#69`). Read it for voice and vocabulary, then leave it alone.
- `client-filtering-story-host.component.ts:338,349` mirror console reports prefixed `[createFilters]`.
  That prefix is emitted by the evaluator and is unchanged by this issue — do not touch it.
- Per the repo's JSDoc rule, keep these terse. A host doc comment states what the story shows and
  the one non-obvious constraint; it is not a tutorial on the feature's config.
- No decision narration in source comments — the reasoning for the decoupling belongs in the ADR
  (`#71`), not in a story host's header.

## Risks / Watchouts

- Easy to "fix" prose that was already correct. The server story genuinely composes no filtering
  feature; do not rewrite it into one.
- The two `.mdx` files and the two host doc comments say overlapping things. Keep them consistent
  with each other, and prefer deleting a duplicated sentence over maintaining two copies of it.

## Non-Goals

- Rewriting `docs/1-state/features/filtering.md` or `docs/1-state/filters.md` — those are `#73`.
- Writing ADR-0016 — that is `#71`.
- Any code change. If a prose fix reveals a code bug, note it and stop.

## Acceptance Checks

- [ ] No story doc or fixture comment describes `withFiltering({ filters })`
- [ ] `grep -rn "withFiltering({ filters" libs/shared/table/src/stories/` returns nothing
- [ ] The server story's prose still says no filtering feature is composed
- [ ] Each rewritten comment is terse — no narrative expansion, no decision narration
- [ ] No `.ts` behavior changed by this step

---

← [Step 4: Cross-feature specs narrow with bare predicates](step-4-cross-feature-specs.plan.md) | [Step 6: Migrate `create-filters.spec.ts` off `createFilterEvaluator(filters)`](step-6-migrate-evaluator-spec-to-matcher.plan.md) →
