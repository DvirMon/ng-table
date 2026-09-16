---
title: "Step 3 — documentation the reshape owes"
type: task-step
issue: 118
---

# Step 3 — documentation the reshape owes

**PR scope:** Every doc that states `withGrouping()`'s call shape, brought to the shipped one.

**Task type:** docs

**Skills used:** audit-docs, concise-docs

**Depends on:** Step 1 — docs describe what shipped, not what is planned.

**Parallel-safe with:** Step 2.

**Scaffolding agent:** none — main thread.

## Files

- `libs/shared/table/docs/1-state/work/with-grouping/3-spec.md` (edit)
- `libs/shared/table/docs/1-state/work/with-grouping/design-group-admission.md` (edit)
- `libs/shared/table/docs/1-state/features/grouping.md` (edit)
- `libs/shared/table/docs/3-ui/work/grouping-stories/1-gap-analysis.md` (edit)

## Why This Step Exists

`3-spec.md` § Public surface is the one place that writes `WithGroupingConfig` out in full, and it
still shows the pre-#60 shape plus a positional schema fn. Left alone it becomes the authoritative
description of an API that no longer exists — and #119/#120/#121 all amend this same block, so it
has to be correct before they touch it.

## What To Do

### 1. `3-spec.md` § Public surface

Replace the `WithGroupingConfig` block and the schema-fn snippet below it:

```ts
interface WithGroupingConfig<TRow> {
  initial?: ColumnId<TRow>[];                                       // D14
  groupingRule?: () => string[] | undefined;                        // D6, D7 — abstain contract
  groupOrder?: (a: GroupSummary<TRow>, b: GroupSummary<TRow>) => number;  // D4
  schema?: (path: ColumnsPath<TRow, AnyGroupingRule<TRow>>) => void; // D8, #118
  rules?: AnyGroupingRule<TRow>[];                                  // D8, rules-array layer
}

// D8 — schema-fn layer, now a config member rather than an either/or first positional (#118)
withGrouping({
  initial: ['region'],
  schema: (path) => {
    applyGrouping(path.category, { when: () => boolean | undefined });
  },
});
```

The section header already says "Shape settled across D1, D3, D4, D6, D7, D8, D14" — append
`; amended by #118` rather than renumbering any decision. The design doc is explicit that this
amends #60's call shape, not its shape.

### 2. `design-group-admission.md` frontmatter status

The `status:` line says "settled shape, 2026-09-15 … Q1 decided 2026-09-16". Add that the surface
half landed in #118, so a reader can tell which parts of § The surface are shipped and which are
still proposed (`groupWhen` at both scopes, `applyGroupOrder`).

### 3. `1-state/features/grouping.md`

This file deliberately does not restate the config shape — its § Methods defers to `3-spec.md`. Two
narrow edits only:

- The superseded-sections banner at the top references the rule overlay as
  "`groupingRule`/`applyGrouping()`/`applyGroupingAsync()` declarative overlay (D6–D8, issue #60)".
  Add that the schema fn is reached through `config.schema` since #118.
- Leave the `groupOrder` line (~line 25) alone — it is accurate until #121.

### 4. `3-ui/work/grouping-stories/1-gap-analysis.md`

The only remaining doc naming `initialGrouping` outside this workspace. It is a historical gap
analysis, so do not rewrite its findings — update the call shape in any code block a reader would
copy, and leave the prose as the record of what was true when it was written.

## Implementation Notes

- **Do not restate the config in `features/grouping.md`.** One definition of the surface, in
  `3-spec.md`; that file's § Methods already makes the deferral explicit and duplicating it is how
  the two drift.
- **No D-number is renumbered or superseded.** #118 amends a declaration site. D8 still describes
  the schema-fn layer; only where it is passed changed.
- Per `feedback_no-decision-narration-in-code-comments`, the issue-history framing stays in these
  docs — source JSDoc states current behaviour only, which Step 1 already handled.

## Risks / Watchouts

- **Do not pre-document `groupWhen` or `applyGroupOrder`.** They are designed but not shipped; a
  doc describing them before #119/#121 land makes the file wrong in the direction readers cannot
  detect.
- **`0-product/grouping.md` §4.2/§4.3 are not this step's.** They are #122's deliverable and depend
  on behaviour that does not exist yet.

## Non-Goals

- No regeneration of the status roll-up — this slice does not move `code` past its current value.
- No `2-columns/architecture.md` edit; D13's sync-vs-async criterion is a separate debt the spec
  already records.

## Acceptance Checks

- [ ] `3-spec.md` § Public surface shows `initial` and `schema`, and no positional schema-fn form.
- [ ] No doc under `libs/shared/table/` shows `initialGrouping` as current API.
- [ ] `design-group-admission.md`'s status distinguishes the shipped surface from the proposed one.
- [ ] Every code block in the edited files is copy-pasteable against the shipped signature.

---
← [Step 2: Tests for the combined shape](step-2-tests.plan.md)
