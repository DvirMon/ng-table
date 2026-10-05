# Step 6 — The two-walks gate spec

**PR scope:** standalone. **Depends on:** Step 2 (the accessor read) and
Step 3 (the re-keyed path, which `applyGroupKey`'s case declares
through). **Parallel-safe with:** Step 7 (different domain, different
files).

**Task type:** test

**Skills used:** unit-test

**Scaffolding agent:** test-implementer

## Files

- `libs/table/src/engine/grouping/clusters.spec.ts` (edit)
- `libs/table/src/engine/grouping/pipeline.spec.ts` (edit)
- `libs/table/src/engine/grouping/render.spec.ts` (edit)
- `libs/table/src/engine/grouping/queries.spec.ts` (edit)

## Why This Step Exists

**AC #3 calls this the gate for the slice, not a nice-to-have.** Two
walks build the cluster tree — `clusterRows` (pipeline) and
`buildGroupRenderRows` (render) — and before Step 2 only one of them had
the column list. If they resolve a value differently, the pipeline's
`TRow[]` and the render tree disagree about which rows belong to which
cluster. That divergence is the exact bug class ADR-0024 exists to close,
and it is invisible to every existing spec because today both walks read
the same raw field.

Step 2 makes them share one body (`readGroupValue`). A spec is what keeps
them sharing it — a future edit that gives the render path its own
resolution would otherwise pass everything currently written.

## What To Do

**1. The agreement case — the gate itself.** In `pipeline.spec.ts` (or a
new shared `describe` reachable from both, author's call):

Build one fixture with a **derived-accessor** column — an id absent from
the row shape, whose `accessor` computes the grouped value, e.g.
`{ id: 'tier', accessor: (row) => row.amount > 100 ? 'high' : 'low' }`.
Run both walks over the same rows and the same `grouping`, then assert:

- `clusterRows` returns the rows in the same partition order the render
  tree's leaves appear in;
- every render header's `groupKey.value` matches the cluster the pipeline
  put those rows in.

Derive the render side's expectation **from the render tree**, not from a
hand-written literal — a hardcoded expectation on both sides can agree
with each other while both being wrong.

**2. Grouping by a derived accessor.** `clusters.spec.ts` — grouping on
`tier` yields `'high'` / `'low'` clusters, not one `undefined` cluster.
This is AC #1, and it is the case that fails on the pre-Step-2 tree.

**3. A carrier column is groupable.** A column
`{ id: 'region', accessor: (row) => row.meta.region, visible: false }`
whose id matches no row field. Grouping by it partitions correctly. This
is AC #2 and G54's whole point — assert on the partition, not on
rendering, since `visible` is not enforced by the library.

**4. `applyGroupKey` receives the accessor's output.** This is AC #8 and
G68, and the issue says explicitly it is "worth stating which value it
receives, because the answer is not obvious". Two halves:

- A column with a plain accessor plus an extractor: the extractor's
  argument is the raw field value, because that is what the default
  accessor returns.
- A column with a **derived** accessor plus an extractor: the extractor's
  argument is the accessor's output, **not** `row[columnId]` — which for
  a derived column does not exist at all. Assert on the argument the
  extractor was called with (capture it), not only on the resulting
  cluster key, or the case passes for the wrong reason.

**5. A throwing accessor degrades and dedupes.** One cluster keyed
`undefined`, and `console.error` called once for that column across the
whole walk, not once per row. Mirrors `cells.spec.ts`'s existing
`readAccessor` dedupe cases — match their spy setup rather than inventing
one.

**6. `queries.spec.ts` — the three readers take columns.**
`rowsBeneathGroup`, `collectGroupIds` and `collectAppliedLevels` resolve
through the accessor too. One derived-accessor case each is enough; the
partition logic itself is already covered.

## Implementation Notes

- **Load the `unit-test` skill for selection policy** before adding
  cases. Everything listed above is behaviour a consumer can observe; do
  not add structural assertions on `ClusterNode`'s shape.
- **These are engine specs — construct `ColumnDef[]` directly.** Do not
  route through `createTable()`; that is Step 7's domain, and a spec
  asserts its own domain only
  (`~/.claude/rules/spec-files-assert-own-domain-only.md`).
- **`buildClusters`' `accessor` parameter stays the seam.** The agreement
  case works precisely because both walks pass a lambda built from
  `readGroupValue`; if a future refactor makes one of them pass something
  else, this spec is the thing that notices.
- Existing cases in these four files that assert raw-field reads on a
  **plain** column keep passing — the default accessor is `(row) => row[id]`.
  Any that break were asserting the raw read on a column with an accessor,
  and those are the bug.

## Risks / Watchouts

- **An agreement spec that compares two hardcoded literals proves
  nothing.** Both sides must be derived from the actual walks.
- **Do not weaken case 4 to assert only the cluster key.** The cluster
  key is the same whether the extractor got the raw field or the
  accessor's output, whenever the accessor is the default — which is why
  the derived-accessor half is the one that matters.
- **`console.error` spies must be restored.** These files already have a
  convention for it; follow it or the dedupe assertions leak across tests.
- **Run this against the pre-Step-2 tree once, deliberately.** Cases 1–4
  must fail there. If they pass, they are asserting the old behaviour.

## Non-Goals

- **No public-API assertions.** Construction throws, `applyAggregate`,
  `initial`'s shorthand and the `columnId` rename are Step 7's.
- **No filtering cases.** #115.
- **No story-fixture usage.** These specs own their fixtures.

## Acceptance Checks

- [ ] `nx test shared-table` passes for `src/engine/grouping/**`.
- [ ] `nx run shared-table:typecheck-spec` clean.
- [ ] The agreement case fails when either walk's resolution is changed
      in isolation — verify by temporarily reverting `render.ts`'s call
      to the old raw read, then restoring it.
- [ ] Cases 1–4 fail on the pre-Step-2 tree.

---

← [Step 5: Delete the raw-name label tier and the levels filter](step-5-delete-fallbacks.plan.md) | [Step 7: The public-surface spec](step-7-public-surface-spec.plan.md) →
