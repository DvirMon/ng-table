---
step: 11
type: docs
commit: docs
depends_on: [1, 2, 3, 9]
files:
  - libs/table/CLAUDE.md (edit)
---

# Step 11 — CLAUDE.md doc fix

This step corrects two stale statements in
`libs/table/CLAUDE.md` left behind by this issue's changes. It
leaves the rest of the file, and any broader feature-authoring
documentation, untouched.

Decisions: none (no capability decisions log for this
cross-cutting engine feature — `state.json`'s
`capabilityLogPath` is `null`; the record is
`libs/table/docs/1-state/work/feature-authoring/plan.md` and
ADR-0020)

> **Scope note:** This issue (#154) ships only the **claim**
> form's execution path — the same built-in stages, same fixed
> anchor order, as today. The **declare** form (`name`+
> `placement`) compiles at the type level (step 1) but nothing
> in this issue's fold resolves or executes it — that's issue
> #155 (`resolveStageOrder()`, the full throw matrix,
> declared-stage end-to-end tests, and the `s.tre`/`s.pin`
> types-spec). Do not add resolver logic, ordering-by-placement,
> cycle/tie/unknown-anchor checks, or declared-stage tests in
> this issue — flag any such temptation as out of scope for
> #155 instead.

## Do

Two fixes, both in `libs/table/CLAUDE.md`'s file table / "Rules"
section:

1. The `schema/run.ts` row currently says the declaring form
   (filtering) keeps its own body "until ADR-0020's
   `stageSchema` is a second caller" — this is now wrong in the
   other direction: `stageSchema` is a recording-form caller of
   `runRecordedSchema()` directly (same as
   `columnSchema()`/`withGrouping()`), never a caller of
   filtering's declaring body at all. Correct the row to state
   this plainly.
2. The feature-plugin-pattern "Rules" bullets currently say "Add
   a pipeline stage by editing `PIPELINE_ORDER` in
   `engine/pipeline.ts` — nothing else" and "Add a render stage
   by editing `RENDER_ORDER` in `engine/render-stages.ts` —
   nothing else." Both constants are renamed
   (`PIPELINE_ANCHORS`/`RENDER_ANCHORS`) and the array is no
   longer the sole source of truth — `PipelineStage`/
   `RenderStage` now derive from the exported registry
   interfaces, not from the array. Correct these bullets to name
   the renamed constants and say a **built-in** claimable slot is
   still added by editing the anchor array in that file, while a
   **new** stage name is added by a consumer team's own
   `declare module` registry merge (not by editing this file) —
   note that the merge mechanism itself isn't wired to actually
   execute a declared stage until issue #155 lands, so phrase
   this as "the type exists; execution lands in #155," don't
   overclaim it works end-to-end yet.

## Watch out

- Don't rewrite the whole engine-export line or file-layout
  table — those aren't stale, only the two items above are.
- Don't attempt to fully document the feature-authoring guide
  here — that's issue #157's job.

## Out of scope

- ADR-0011/ADR-0004 edits, `docs/1-state/architecture.md`
  registration, the feature-authoring guide — none of these are
  in this issue's own acceptance criteria (only the
  `schema/run.ts` row is explicitly named).

## Done when

Both corrections are made; no other content changes.

---

← [Step 10: Barrel export](step-10-barrel-stage-exports.plan.md)
