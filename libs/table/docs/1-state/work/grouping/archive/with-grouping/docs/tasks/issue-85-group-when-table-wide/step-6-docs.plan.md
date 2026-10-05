---
title: 'Step 6 — documentation table-wide admission owes'
type: task-step
issue: 119
---

# Step 6 — documentation table-wide admission owes

**PR scope:** The state-layer surface docs and the design doc's shipped/proposed line. The product
doc's §4.2/§4.3 decision belongs to #88 and is deliberately not here.

**Task type:** docs

**Skills used:** audit-docs, concise-docs

**Depends on:** Step 3.

**Parallel-safe with:** Step 4, Step 5.

**Scaffolding agent:** none — main thread.

## Files

- `libs/shared/table/docs/1-state/work/with-grouping/3-spec.md` (edit)
- `libs/shared/table/docs/1-state/work/with-grouping/design-group-admission.md` (edit)
- `libs/shared/table/docs/1-state/features/grouping.md` (edit)
- `libs/shared/table/docs/1-state/work/with-grouping/issue-graph.md` (edit)

## Why This Step Exists

Two of these files currently say something a reader would act on and be wrong about.

`issue-graph.md` § Open questions still presents Q1 as open with an unresolved counter-case — it
was decided 2026-09-16 and recorded in `2-decisions.md` and on issue #85, but the graph doc never
caught up. It is the file a person opens to find the frontier, so a stale gate there costs a real
detour.

`3-spec.md` § Public surface is the only full statement of `WithGroupingConfig`, and #86 and #87
both amend the same block next. It has to be current before they touch it.

## What To Do

### 1. `3-spec.md` § Public surface

Add the two new types and the config member, on top of what #84 Step 3 left:

```ts
interface ClusterSummary<TRow> {
  readonly columnId: string;
  readonly key: GroupKey;
  readonly rows: readonly TRow[];
}

interface GroupSummary<TRow> extends ClusterSummary<TRow> {
  readonly admitted: boolean; // false ⇒ emits flat, no header
}

type GroupWhen<TRow> = (cluster: ClusterSummary<TRow>) => boolean;

interface WithGroupingConfig<TRow> {
  initial?: ColumnId<TRow>[]; // D14
  groupWhen?: GroupWhen<TRow>; // #85 — table-wide admission
  groupingRule?: () => string[] | undefined; // D6, D7
  groupOrder?: (a: GroupSummary<TRow>, b: GroupSummary<TRow>) => number; // D4
  schema?: (path: ColumnsPath<TRow, AnyGroupingRule<TRow>>) => void; // D8, #84
  rules?: AnyGroupingRule<TRow>[]; // D8
}
```

State the three facts a reader cannot infer from the signature: dissolution happens **after**
ordering, the default with no comparator is a stable partition (admitted first), and a throwing
predicate admits the cluster. Keep it to a short list — the reasoning lives in the design doc.

### 2. `design-group-admission.md`

- The `status:` frontmatter line: table-wide `groupWhen` shipped in #85; per-column (#86) and
  `applyGroupOrder` (#87) still proposed. A reader has to be able to tell which half of § The
  surface is real.
- § Open questions: Q3 is answered by Step 4's test, not just recommended — record which way it
  landed. Q2 stays open and unshipped.

### 3. `1-state/features/grouping.md`

The superseded-sections banner is where this file states current behaviour. Add one entry: clusters
are admitted by default, and `groupWhen` is the table-wide predicate that can leave one flat.
Mention that a dissolved cluster exits the grouping tree entirely (Q1), since that is the part a
reader will otherwise assume the other way.

Do not restate the config block — § Methods already defers to `3-spec.md` and duplicating it is how
the two drift.

### 4. `issue-graph.md`

- § Open questions: mark Q1 decided 2026-09-16 with a one-line statement of the answer and a link
  to `2-decisions.md`. Drop the "Settle on #83 before planning tasks here" instruction — it is
  done.
- § Nodes / § Graph: update #84's and #85's state as they land. Leave the edges alone; the
  dependency structure is unchanged.

## Implementation Notes

- **`0-product/grouping.md` §4.2 and §4.3 are #88's, not this step's.** #85 supplies the
  mechanism; #88 states the product decision and the story that demonstrates it. Writing it here
  would take #88's only deliverable and leave it with nothing.
- **No new ADR.** Admission is a feature decision inside a designed epic, not a cross-cutting one.
  The runtime-vs-construction error split it relies on is already ADR-0014.
- Verify the `.md` link targets resolve from each file's own directory before finishing — these
  docs are four levels deep and relative links are easy to get wrong.

## Risks / Watchouts

- **Do not document the per-column `groupWhen` or the AND-combination rule.** Both are designed,
  neither is shipped until #86; a doc describing them is wrong in the direction readers cannot
  detect.
- **Do not describe the tail position as a rule.** It is what a stable partition produces with no
  comparator, and a consumer comparator is entitled to interleave.

## Non-Goals

- No status roll-up regeneration.
- No `docs/3-ui/directives/grouping.md` edit — the directive layer has no admission surface;
  dissolved rows are ordinary rows to it.

## Acceptance Checks

- [ ] `3-spec.md` § Public surface shows `ClusterSummary`, `GroupSummary.admitted`, `GroupWhen` and
      `config.groupWhen`, and states the ordering, default-partition and throw-admits facts.
- [ ] `issue-graph.md` no longer presents Q1 as blocking, and states the decision.
- [ ] `design-group-admission.md` distinguishes shipped surface from proposed, and records Q3's
      outcome.
- [ ] `features/grouping.md` states admission and Q1 without restating the config block.
- [ ] Every relative link in the edited files resolves.

---

← [Step 5: The story](step-5-grouping-static-story.plan.md)
