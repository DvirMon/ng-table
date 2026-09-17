# Step 1 — Rewrite the filters spec to the shipped surface

**PR scope:** PR 1 of 1 (`#79`). **Parallel-safe with: Step 2, Step 3.**
**Task type:** `docs`
**Stack:** angular
**Skills used:** `concise-docs` (only if a rewritten section grows past what it replaced)
**Scaffolding agent:** none (main thread)

## Files

| File | Action |
|---|---|
| `libs/shared/table/docs/1-state/filters.md` | edit — signature, schema form, carrier, guards, public API |

## Why This Step Exists

`#76` and `#77` shipped (`ffd9649`, `a2f73f4`). The spec still describes the surface they
replaced: a single-argument `createFilters<TRow, TState>(schema)` whose schema body calls rules as
statements, with a section arguing that the criterion map *cannot* be inferred. Every one of those
claims is now false, and this document is the one a reader reaches first.

This is the largest edit in the issue and the only one that adds new material rather than
correcting existing text — the row carrier, `rowOf()` and the third guard have never been
documented anywhere outside the workspace.

## What To Do

Work section by section. Verify each claim against `src/filters/`, not against this plan.

1. **Signature** (`## Signature`, ~L47). Replace the code block with the shipped one:
   ```ts
   function createFilters<TRow, S extends readonly unknown[]>(
     rows: readonly TRow[] | (() => readonly TRow[] | undefined) | RowToken<TRow>,
     schema: (path: FiltersPath<TRow>) => S,
     opts?: { injector?: Injector }
   ): Filters<TRow, StateOf<S>>;
   ```
   Then rewrite the bullets beneath it:
   - **`rows` is an inference anchor and is never read.** This is the *first* bullet, not a
     footnote — the call reads as if it binds data and it does not. Say what the slot accepts: an
     array, a readonly array, any callable returning rows (a `Signal`, a `WritableSignal`, a signal
     of `rows | undefined`, a bare store accessor), or `rowOf<Row>()`.
   - **`TRow` infers from the carrier.** Delete the old bullet's claim that it must be annotated.
   - **The criterion map is inferred from the returned array.** It is no longer a parameter a
     caller writes.
   - Keep the `{ injector }` bullet (R24) as is.
   - Delete the `anyOf<Invoice>(…)` explicit-type-argument bullet (R33) outright — the nested
     schema callback is gone, so the gap it described cannot occur.
2. **Delete the caller-supplied-map rationale, do not amend it.** The bullet beginning "**`TState`,
   the flat criterion map, is also caller-supplied**" and any surviving prose explaining why the
   map could not be derived goes. Its replacement is the one-line statement in the bullet above,
   not a rebuttal.
3. **Every schema example moves to the array form.** The executive-summary snippet (~L24), the
   `### Rules` example (~L95) and the `## Wiring — three modes` snippets (~L350–L389). Model them
   on the shipped hosts, which are real and compile:
   - client — `src/stories/filtering/client-filtering/client-filtering-story-host.component.ts:159`
   - server — `src/stories/filtering/server-filtering/server-filtering-story-host.component.ts:109`

   In the Server subsection, `rowOf<Invoice>()` is the carrier and the reason belongs there: the
   resource has not fetched, so there is no data to anchor the row type to.
4. **`anyOf` and `applyWhen` rows in the rules table.** `anyOf(key, children)` takes a non-empty
   tuple of already-built rules, not a nested schema callback. `applyWhen(path, condition,
   children)` returns one node that is **placed directly and never spread** — `...applyWhen(…)` is
   a `TS2488` compile error, which is the shape's whole point. Note that `path` is retained for
   signature parity with Signal Forms and is not read.
5. **Add `rowOf()` where a reader will look for it.** A short subsection under the schema or
   wiring material: `rowOf<Row>()` is a phantom token carrying only a row type, exported from the
   library's public surface, never read at runtime, and the answer to server mode.
6. **`## Errors` — document the three guards.** Two are new to this document. Quote each message
   as it is actually thrown or branded, verbatim from source:
   - **Unnamed row type** — `src/filters/types.ts:102`. A carrier that cannot name a row type (an
     empty array literal) resolves `FiltersPath<never>` to a single branded property; the error
     lands on the first property access and names `rowOf<Row>()`.
   - **Non-returning schema** — `src/filters/create-filters.ts`. Construction throws
     `[createFilters] The schema function must return its rules. A body that calls rules as
     statements declares nothing — return an array: (path) => [equals(path.status)]`.
   - **Empty or mixed group** — both compile errors now (non-empty tuple constraint; every later
     child checked against the first child's criterion), with the runtime throw in `validate.ts`
     kept as a backstop for untyped callers.

   Keep the existing construction/runtime split and the ADR-0014 framing — these are three more
   construction-class errors, not a new policy.
7. **`### Keys`.** The `as`-must-be-a-string-literal claim is now enforced rather than aspirational
   (`EnforceLiteralKey`, `types.ts:11`, reached through the rule's own inference site). Say that it
   bites; do not restate the mechanism.
8. **`## Public API`.** Add `rowOf` (`filters/row-of.ts`, factory) and `RowToken` (type) to the
   table. In the paragraph above it, drop `recorder.ts` from the list of files that are internal
   because they are not listed — that file no longer exists. `evaluator.ts`, `state.ts` and
   `validate.ts` stay.
9. **Frontmatter.** Bump `version` and set `date: 2026-09-14`. Leave `capability`, `spec` and
   `code` exactly as they are — Step 4 regenerates the roll-up from them and they have not changed.

## Implementation Notes

- The `## State` section's `Partial<TState>` wording stays correct. `TState` still exists as a
  parameter of `Filters<TRow, TState>`; what changed is that it is inferred rather than written.
  Do not sweep the identifier out of the document — sweep the claim that a caller supplies it.
- The `Deliberately not shipped` table's R11 row ("Data-derived filter options") still stands. R11
  is superseded on the *data argument*, not on set filters — the rows are an anchor and are never
  read, so the consumer still computes options themselves.
- `filters().matcher()`, `active()`, `reset()`, source defaults, empty criteria and the null-cell
  policy are all unchanged. If a rewrite touches them, it has gone past its scope.

## Risks / Watchouts

- **Do not restate the mechanism.** `StateOf`, `Flatten`, the phantom key/criterion pair and the
  widening trap are implementation, and they live in the workspace architecture doc. This spec is
  the contract: what a caller writes and what comes back.
- **Every code block in this file must be one a reader could paste.** The old examples compiled
  against the old signature; a half-migrated snippet is worse than the stale one it replaces.
- Line numbers in this plan are from the pre-edit file and will drift as you work. Anchor on
  headings.

## Non-Goals

- `docs/1-state/features/filtering.md` — Step 2.
- The decision record's R-numbers — Step 3.
- `CLAUDE.md`, `3-ui/stories.md`, `0-product/filtering.md`, ADR-0016, `#56`, `status.md` — Step 4.
- Any change under `src/`. The code shipped; this issue describes it.

## Acceptance Checks

- [ ] The signature block matches `src/filters/create-filters.ts` exactly, including `opts`
- [ ] The carrier's "inference anchor, never read" statement is the first thing said about `rows`
- [ ] Every schema example returns an array; none passes an explicit type argument
- [ ] The section explaining why the criterion map is caller-supplied is gone, not rebutted
- [ ] `rowOf()` is documented, with server mode as its reason
- [ ] All three guards are documented, each quoting its message as source spells it
- [ ] `rowOf` and `RowToken` appear in the Public API table
- [ ] The internals sentence no longer names `recorder.ts`
- [ ] `capability`, `spec` and `code` frontmatter are untouched
- [ ] Every relative link in the file still resolves

---
[Step 2: Reconcile the feature doc](step-2-feature-doc.plan.md) →
