# Step 4 — A non-primitive group value reports instead of collapsing silently

**PR scope:** One report site in `engine/grouping/clusters.ts`. Closes C3 / #80's S8 / OQ-5. No
behavior change to the grouping itself — the collapse still happens, it just stops being silent.
**Parallel-safe with:** Step 1, Step 2, Step 3 — touches `engine/grouping/clusters.ts` only, and
has no edge to the `cells` shape.
**Task type:** `code`
**Skills used:** `angular-developer`
**Scaffolding agent:** `angular-implementer`

## Files

| File | Action |
|---|---|
| `libs/table/src/engine/grouping/clusters.ts` | edit — report from the `toGroupKey` collapse path |

## Why This Step Exists

`toGroupKey` falls back to `` `${typeof value}:${String(value)}` ``, so every distinct object at a
grouping level collapses into one `"object:[object Object]"` bucket. The table renders fine and
the grouping is wrong — the worst shape a failure can take.

The fix already exists: `GroupingRule.extractValue` (grouping's D7) narrows an object-valued
field to a primitive before it becomes a group key. That is what makes a report actionable rather
than merely noisy — it names the declaration that is missing.

D11 extends ADR-0014's reasoning rather than applying it: the ADR covers a callback *throwing*,
this is a silent collapse. Same principle — a failure must be visible.

> **Naming note.** D11 calls the extractor `GroupingRule.valueOf`. That name is stale; the shipped
> API is `extractValue` (`api/features/with-grouping/schema.ts:59`,
> `api/features/with-grouping/types.ts:23`). Use `extractValue` everywhere, including in the
> message text.

## What To Do

### `engine/grouping/clusters.ts`

**The predicate.** A value is reportable when, *after* any `extractValue` has run, it is a
non-null object that `toGroupKey` has no dedicated branch for — i.e. not a `Date`:

```ts
function isCollapsingGroupValue(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !(value instanceof Date);
}
```

Keep it a named guard with an `is*` prefix rather than inlining the condition
(`declarative-naming`). Note that `null` and `undefined` are *not* reportable — `toGroupKey` gives
each its own key, so they cluster correctly and a "no value" bucket is a legitimate result.

**The report:**

```ts
function reportNonPrimitiveGroupValue(columnId: string): void {
  // eslint-disable-next-line no-console -- ADR-0014: floor reporting mechanism, no existing
  // runtime-degradation logging abstraction to reuse in this codebase yet.
  console.error(
    `[withGrouping] field "${columnId}" groups on a non-primitive value — every distinct ` +
      'object collapses into one group. Declare extractValue on that field to key the group ' +
      'on a primitive.'
  );
}
```

**Where it fires.** `buildClusters` is the single place a value becomes a key — it already
computes `toGroupKey(value)` per item, and both entry points (`buildClusterNodes`, and
`render.ts`'s direct call) go through it. Add a dedup set threaded through the recursion, created
once per top-level call:

```ts
export function buildClusters<T>(
  items: T[],
  levels: readonly string[],
  accessor: (item: T, columnId: string) => unknown,
  reportedFields: Set<string> = new Set()
): ClusterNode<T>[] {
  // …
  for (const item of items) {
    const value = accessor(item, columnId);
    if (isCollapsingGroupValue(value) && !reportedFields.has(columnId)) {
      reportedFields.add(columnId);
      reportNonPrimitiveGroupValue(columnId);
    }
    // …unchanged bucketing
  }
  // recursive call passes `reportedFields` through
}
```

The default parameter keeps every existing caller compiling unchanged, and makes the dedup scope
"one `buildClusters` call tree" — which is one evaluation, matching `computeAggregates` and
`evaluateGroupWhen`.

Check the value *after* `accessor` runs, not the raw field: `accessor` is the lambda that already
applied `extractValue` (`readGroupFieldValue`), so a field with a declared extractor that returns
a primitive must not report.

## Implementation Notes

**Dedup granularity is per field, not per column and not per cluster.** A grouping level names a
row field (ADR-0021 / grouping's D7), and `node.columnId` on a cluster carries that field name —
so `columnId` here is the field. The message says "field" for that reason; do not call it a
column.

`console.error` matches the two existing report sites in this same file
(`reportGroupWhenError`, `reportGroupOrderError`) and ADR-0014's own "for now" scoping. A real
diagnostics channel — an injectable reporter, or a `table.diagnostics()` signal needing no DI —
is its own ADR covering every site at once, and cannot be an injected `ErrorHandler` because
`engine/` is pure.

Put the guard and the reporter next to `toGroupKey`, above `buildGroupPath`, so the three
functions that understand the key format sit together.

## Risks / Watchouts

- **Grouping behavior must not change.** The collapse still happens; only the report is new. If
  any existing grouping test changes its expected row shape, something is wrong with this step.
- **Do not report on `null`/`undefined`.** Both get their own `toGroupKey` branch and cluster
  correctly. Reporting them would fire on the common "missing value" case and train people to
  ignore the message.
- **Do not report on `Date`.** `toGroupKey` normalizes it to `date:<time>`, which is correct.
- **Arrays are objects.** `typeof [] === 'object'`, so an array-valued field reports — that is
  intended: `String([1,2])` is `"1,2"`, which collides `[1,2]` with `["1,2"]`.
- **The dedup set must not be created per recursion level.** A default parameter that the
  recursive call forgets to forward silently degrades to once-per-level. Forward it explicitly.
- **`queries.ts` clusters too.** `rowsBeneathGroup`/`collectGroupIds`/`collectAppliedLevels` all
  route through `buildClusterNodes` → `buildClusters`, so each of those calls gets its own dedup
  scope and may report independently. That is correct — each is a separate evaluation — but it
  means a single render can log more than once. Accepted; do not add a module-level set to
  suppress it, which would hide the report entirely after the first table.
- No tests in this step — Step 6.

## Non-Goals

- No throw. This is runtime, data-dependent degradation, not a construction error.
- No change to `toGroupKey`'s key format, and no attempt to key an object structurally
  (`JSON.stringify`, a hash). The declared fix is `extractValue`; the report points at it.
- No injectable diagnostics channel — that is its own ADR (D11).
- No `accessor` involvement. Since grouping's D7, `accessor` is not in the grouping path at all;
  #80's original S8/OQ-5 framing ("a column with no `accessor`") is obsolete.

## Acceptance Checks

- [ ] Grouping a field whose values are plain objects logs one `console.error` naming the field
      and `extractValue`, and the resulting row shape is unchanged from today.
- [ ] Two distinct objects still collapse into one cluster — the report does not alter clustering.
- [ ] A field with a declared `extractValue` returning a primitive logs nothing.
- [ ] `null` and `undefined` field values log nothing.
- [ ] A `Date`-valued field logs nothing.
- [ ] Grouping 4,000 rows on one object-valued field logs exactly once.
- [ ] Two object-valued levels in one grouping log once each.
- [ ] Every existing `clusters`, `pipeline`, `render`, `queries` and `with-grouping` test passes
      **unedited**.
- [ ] `nx run shared-table:typecheck` and `nx run shared-table:typecheck-spec` clean.

---
← [Step 3: `RenderRow.cells`](step-3-render-row-cells.plan.md) | [Step 5: Engine tests — cells and duplicate ids](step-5-engine-tests-cells.plan.md) →
