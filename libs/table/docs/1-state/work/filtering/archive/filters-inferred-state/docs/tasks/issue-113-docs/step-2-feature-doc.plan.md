# Step 2 — Reconcile the client-side filtering feature doc

**PR scope:** PR 1 of 1 (`#113`). **Parallel-safe with: Step 1, Step 3.**
**Task type:** `docs`
**Stack:** angular
**Skills used:** —
**Scaffolding agent:** none (main thread)

## Files

| File | Action |
|---|---|
| `libs/shared/table/docs/1-state/features/filtering.md` | edit — verify the config, fix two stale sentences |

## Why This Step Exists

This document was already rewritten to v3.0 when the decoupling landed (`#105`, ADR-0016), so the
body is expected to be correct: `WithFilteringConfig<TRow>` is `predicates` plus `manual`, and the
feature names no filter type. The step exists to *confirm* that — the issue's acceptance criteria
name it, and a check that finds nothing is a real result — and to fix the two places where the
rewrite left the previous signature visible:

- the composition snippet (~L21) still declares `createFilters<Invoice>((path) => { … })` with a
  statement body;
- the superseded-decisions paragraph (~L153) still sends readers away from "the `TState` call-site
  rules", a phrase that describes something a reader can no longer find.

Small edit, separate step, because it is the *feature's* document and Step 1 is the *model's*.
Nothing here depends on Step 1 landing — both are fixed by the architecture doc's signature.

## What To Do

1. **Verify the config first, before editing anything.** `## Config` must show exactly
   `predicates` (required) and `manual` (optional), with no `filters` field and no criterion-map
   type parameter. Compare against `src/api/features/with-filtering.ts`. If they disagree, stop —
   that is a code fact this issue does not own, and the architecture doc says nothing in that file
   changes.
2. **Fix the composition snippet.** Move it to the array form and drop the explicit type argument:
   ```ts
   readonly filters = createFilters(this.data, (path) => [
     equals(path.status),
     inRange(path.amount),
   ]);

   readonly table = createTable(
     this.data,
     { trackBy: 'id', columns: [...] },
     withFiltering({ predicates: () => [this.filters().matcher()] }),
   );
   ```
   The `this.data` carrier appearing in both calls is the point worth one clause: the table reads
   the rows, `createFilters` only takes the row type from them.
3. **Fix the superseded-decisions paragraph.** The sentence ending "or the `TState` call-site
   rules describes a shape that no longer exists" needs its middle term replaced — those rules are
   gone from every living document as of this issue, so pointing at them by name sends a reader
   looking for text that has been deleted. Name what actually dates an R-number instead: the
   `filters` config field, `createFilterEvaluator`, or a caller-supplied criterion map.
4. **Leave R10's server-mode paragraph alone.** "In server mode this feature is not composed at
   all" is still exactly true, and the carrier does not change it — `rowOf()` exists precisely
   because there is no data and no feature there.
5. **Frontmatter.** Bump `version`, set `date: 2026-09-14`, leave `capability` / `spec` / `code`
   untouched.

## Implementation Notes

- The D1–D3 table and the R23/R26 notes are history and stay as written. This issue supersedes
  nothing in this file's own decision log.
- The cross-link to `../filters.md` must keep resolving; Step 1 changes that file's contents, not
  its path or its headings' slugs. If Step 1 renames a heading this file anchors into, that is
  Step 1's to keep consistent.

## Risks / Watchouts

- **Do not import Step 1's material into this document.** The carrier, `rowOf()` and the three
  guards belong to the model's spec. This file's job is to describe a feature that takes
  predicates and knows nothing about filters — restating the model here is the coupling ADR-0016
  removed, in documentation form.

## Non-Goals

- `docs/1-state/filters.md` — Step 1.
- `docs/0-product/filtering.md` — Step 4 (it is the product doc, maintained by the product pass).
- ADR-0016 itself — Step 4, and by amendment note only.

## Acceptance Checks

- [ ] `## Config` shows `predicates` and `manual`, and nothing else
- [ ] No filter model, criterion map or filter type appears in the feature's config
- [ ] The composition snippet uses the array schema and passes no explicit type argument
- [ ] No sentence in the file points a reader at the `TState` call-site rules
- [ ] `capability`, `spec` and `code` frontmatter are untouched
- [ ] Links to `../filters.md` and `../../adr/0016-*.md` resolve

---
← [Step 1: Rewrite the filters spec](step-1-filters-spec.plan.md) | [Step 3: Mark the decision record](step-3-decision-record.plan.md) →
