# Step 6 — Test: the non-primitive group-value report

**PR scope:** Unit coverage for Step 4. No source changes.
**Depends on:** Step 4 (the report exists).
**Parallel-safe with:** Step 5, Step 7, Step 8.
**Task type:** `test`
**Skills used:** `unit-test`
**Scaffolding agent:** `test-implementer`

## Files

| File | Action |
|---|---|
| `libs/table/src/engine/grouping/clusters.spec.ts` | edit — report cases |

## Why This Step Exists

The report's whole value is that it fires on the case a person would otherwise never notice. Two
halves need locking down, and both fail invisibly:

- **it fires** on an object-valued grouping field, once per field per evaluation — a dedup set
  forwarded wrongly through the recursion degrades to once per level, which looks like noise
  rather than a bug;
- **it stays quiet** on `null`, `undefined`, `Date`, and any field with an `extractValue` that
  returns a primitive — a false positive here trains people to ignore the message, which costs
  more than having no message.

## What To Do

Extend `engine/grouping/clusters.spec.ts`. Bare `vitest` — `clusters.ts` is pure.

**Fires:**

- grouping on a field whose values are plain objects logs one `console.error`, and the message
  names the field and `extractValue`;
- clustering many rows on that one field logs exactly once;
- two object-valued levels in one `buildClusters` call log once each;
- an array-valued field logs — `typeof [] === 'object'`, and `String([1,2])` collides `[1,2]`
  with `["1,2"]`.

**Stays quiet:**

- a field whose declared `extractValue` returns a primitive logs nothing — assert this through
  `buildClusterNodes` with a populated `extractValueByColumn`, so the test exercises the real
  path where the extractor runs before the check;
- `null` and `undefined` field values log nothing;
- `Date` values log nothing.

**Behavior unchanged:**

- two distinct objects still land in one cluster. Assert the resulting `ClusterNode[]` shape is
  what it was before the report existed — the report must not alter clustering.

## Implementation Notes

Spy with `vi.spyOn(console, 'error')` and restore per test; assert the **call count**, not just
that it was called. The count is the assertion that catches a mis-threaded dedup set.

Drive the extractor case through `buildClusterNodes` rather than calling `buildClusters` with a
hand-written accessor: `buildClusterNodes` is what composes `readGroupFieldValue` with
`extractValueByColumn`, and "the check runs after the extractor" is precisely what is being
tested. A hand-written accessor would pass even if Step 4 checked the raw field value.

## Risks / Watchouts

- **Do not edit an existing passing test.** Step 4 is additive. An existing `clusters`,
  `pipeline`, `render` or `queries` expectation that now fails means the source step changed
  clustering, which it must not.
- **`queries.ts` clusters independently**, so a spec that drives a full table may see more than
  one report from one render. That is accepted (Step 4's watchouts) — scope these tests to
  `buildClusters`/`buildClusterNodes` directly so the count is deterministic.
- **`vi.restoreAllMocks()` between tests**, or a leaked spy makes a later count wrong.

## Non-Goals

- No coverage for `cells`, the `accessor` wrap, or the duplicate-id throw — Step 5.
- No story demonstrating the report on canvas. The message is a developer diagnostic, not a UI
  affordance.
- No test asserting the exact message string character-for-character; assert it contains the
  field name and `extractValue`, so a wording fix is not a test failure.

## Acceptance Checks

- [ ] An object-valued grouping field logs exactly once across many rows, naming the field and
      `extractValue`.
- [ ] Two object-valued levels log once each.
- [ ] An array-valued field logs.
- [ ] A field with an `extractValue` returning a primitive, driven through `buildClusterNodes`,
      logs nothing.
- [ ] `null`, `undefined` and `Date` values log nothing.
- [ ] Cluster shape for object-valued fields is asserted unchanged.
- [ ] No `TestBed`; no previously-passing test edited.
- [ ] `nx run shared-table:typecheck-spec` clean.

---
← [Step 5: Engine tests — cells and duplicate ids](step-5-engine-tests-cells.plan.md) | [Step 7: Document `accessor` as the value contract](step-7-docs-accessor-contract.plan.md) →
