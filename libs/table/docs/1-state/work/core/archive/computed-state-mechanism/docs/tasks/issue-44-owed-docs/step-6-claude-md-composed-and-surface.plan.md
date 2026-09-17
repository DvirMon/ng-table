---
title: "Step 6 — CLAUDE.md: kill the false composed claim, add withComputed() and composeFeatures()"
type: task-step
issue: 78
---

# Step 6 — `CLAUDE.md`: kill the false `composed` claim, add `withComputed()` and `composeFeatures()`

**PR scope:** One file — the library's agent-facing invariants doc.

**Task type:** docs

**Skills used:** —

**Depends on:** —
**Parallel-safe with:** Step 1, Step 2, Step 3, Step 4, Step 5, Step 7

**Scaffolding agent:** main thread

## Why This Step Exists

Two separate debts land in the same file.

**The false claim.** D25 records it explicitly: "The spec's claim that no shipped feature reads
`composed` was false: `withGrouping()` reads `composed['expandedRows']` lazily inside its group
render stage, guarded. … `CLAUDE.md` repeats the false claim and owes a rewrite." This is not in
#44's issue body — it surfaced in the decisions log — but it is the same docs debt and has no
other owner.

**The missing surface.** `CLAUDE.md` already shows the positional form (`:226–:230`) and already
documents `createTableFeature`'s two call forms (`:183–:185`), so the migration mostly landed here.
What it never gained is the two composition primitives #36 and #37 shipped: `withComputed()` and
`composeFeatures()`. An agent reading this file to author a feature does not learn they exist.

This is the file every agent session loads for this library, so a false invariant here propagates
into generated code — higher blast radius than any other file in this issue.

## Files

- `libs/shared/table/CLAUDE.md` (edit)

## What To Do

1. **Correct the `composed` claim.** Replace "no shipped feature reads `composed`" (and any
   variant phrasing) with what is true: `withGrouping()` reads `composed['expandedRows']` as a lazy
   guarded read inside its group render stage. State the general rule it exemplifies — **types are
   stricter than runtime**: the read works in either argument order at runtime, but is only typed
   when `withExpansion()` precedes `withGrouping()`. One invariant line plus the example.
2. **Add the two primitives** to the plugin-surface section, in the file's existing table/bullet
   voice, one line each:
   - `withComputed(block)` — library-declared derived state as a feature; validates and wraps at
     construction, reports-then-rethrows per member at evaluation (ADR-0014, Step 3).
   - `composeFeatures(...features)` — collapses N features into one slot; inner features fold
     against a per-composite registry and merge into one spec.
3. **State the argument-order invariant** if it is not already stated: member visibility follows
   argument order; pipeline execution follows `PIPELINE_ORDER` and does not. Step 4's
   `architecture.md` explains it at length — here it is one line, consistent with that file.
4. **Verify the rest of the file against the shipped code** rather than assuming. `:44–:45`
   (generated overloads), `:57` (`baseColumns` private), `:65` (`internalFeatures` folding before
   consumer features), `:169`/`:183–:185` (`createTableFeature`) all describe #34/#69 behaviour —
   confirm each still matches before leaving it.

## Implementation Notes

- Per `claude-md-no-implementation-status`: invariants and conventions only. No "shipped in #36",
  no status. The ADR and decisions log carry the history.
- Per `terse-jsdoc-for-ai-and-humans`: one line per primitive. The feature docs carry the detail.
- `:45` says the overload count is 16; `3-decisions.md` D27 says arity 15. Check which the
  generated file actually emits and fix whichever is wrong — do not assume the doc is.

## Risks / Watchouts

- The file is 247 lines of invariants an agent will act on. A wrong line here is worse than a wrong
  line anywhere else in this issue — verify against source, not against the other docs.
- Do not restate Step 4's composition section. One line and a pointer.

## Non-Goals

- `apps/demo/CLAUDE.md` — already migrated on #42.
- Root `CLAUDE.md` — not a table-library doc.

## Acceptance Checks

- [ ] No sentence claims that no shipped feature reads `composed`
- [ ] The `withGrouping()`/`expandedRows` lazy guarded read is stated, with the types-stricter-than-runtime rule
- [ ] `withComputed()` and `composeFeatures()` each appear once in the plugin surface, one line each
- [ ] The argument-order vs. `PIPELINE_ORDER` invariant is stated once
- [ ] The overload count matches `api/create-table.overloads.ts` as generated
- [ ] No implementation status, no issue numbers as status markers

---
← [Step 5: row-editing shared-store rationale](step-5-row-editing-shared-store-rationale.plan.md) | [Step 7: call-shape sweep](step-7-call-shape-sweep.plan.md) →
