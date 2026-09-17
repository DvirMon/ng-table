# Alt 1 — fold the prune into `core.ts`'s terminal step; delete the `'prune'` stage

**Status:** exploration, 2026-09-17. Revisits [ADR-0017](../../../../../adr/0017-engine-owned-descendant-prune.md) **D2 only**.
Siblings (not yet written): `alt-2-stage-context-predicate.md`, `alt-3-tree-shaped-stages.md`.

## The objection

ADR-0017 keeps hiding out of the features — correct, and not up for revisiting. It pays for that
by adding a *pipeline slot no feature may claim*. Four constructs exist only to say "this entry
isn't a feature":

| Construct | Why it exists |
|---|---|
| `'prune'` in `RENDER_ORDER` | the slot itself |
| `Exclude<RenderStage, 'prune'>` in `RenderStages` | forbid a feature claiming it |
| `CLAIMABLE_RENDER_STAGES` | re-derive the list *without* it, for `compose-table.ts`'s fold |
| `if (stage === 'prune')` in `runRenderStages` | the reduce special-cases its own order array |

Plus one unchecked, load-bearing rule: `'prune'` must sit after every claimable stage. Nothing
enforces that — it is a position in a hand-written array.

## The idea, one sentence

Hiding is not a stage. It is part of **finalizing** render rows, which `core.ts` already does.

## What already exists

`core.ts`'s `renderRows` computed ends with a terminal pass over the stage output that stamps
`index` and `sourceIndex`. That pass:

- runs after the whole stage chain **by construction** — not by a position in an array;
- is already engine-owned and already unclaimable, with no type needed to say so;
- already computes a fact no single feature could compute (final position).

Descendant-hiding is the same category of fact. Same place.

## The change

```ts
// render-stages.ts — claimable stages only
export const RENDER_ORDER = ['group', 'tree'] as const;
export type RenderStages<TRow> = Partial<Record<RenderStage, RenderRowTransform<TRow>>>;

export function runRenderStages<TRow>(rows, stages) {
  return RENDER_ORDER.reduce((cur, stage) => stages[stage]?.(cur) ?? cur, rows);
}
```

`pruneUnexpandedDescendants` moves beside the finalize code, called from it:

```ts
// core.ts — the existing terminal computed, one extra line
const renderRows = computed(() => {
  const byId = indexById();
  const shaped = runRenderStages(seedRenderRows(rows()), renderStages);
  const visible = pruneUnexpandedDescendants(shaped, expanded());   // ← was a stage
  return visible.map((row, index) => ({
    ...row,
    index,
    sourceIndex: row.data === null ? undefined : byId.get(row.id),
  }));
});
```

**Deleted:** the `'prune'` entry, the `Exclude<…>`, `CLAIMABLE_RENDER_STAGES`, the
`stage === 'prune'` branch, the `expanded` parameter on `runRenderStages`.

**Unchanged:** `RenderRow.parentId` (D1), the contributed read-only `expandedRows` signal (D3),
the accumulating slot (D4), `expandedSources`, the union computed, and the prune function's own
body. The decoupling is untouched — grouping still never reads expansion.

## What it fixes / doesn't

Fixes:

- **No non-feature entry in the pipeline.** `RENDER_ORDER` becomes exactly "stages a feature may
  claim" — the name stops lying.
- **"Runs last" stops being a rule.** It is where the code sits, not an array position someone
  must not disturb. The type-level exclusion becomes unnecessary — nothing left to exclude.
- **Surface shrinks.** The diff removes more than it adds.

Does not fix:

- Parent-before-child emission is still load-bearing and unchecked — same single forward pass,
  called from elsewhere. (Alt 3 is the option that removes it.)
- "Forgetting to stamp `parentId` yields silently unprunable rows." Unchanged.

## The one decision this forces

`'paginate'` sits *after* `'prune'` today, so a page counts visible rows (spec-132 story 6). It
has **no claimant** — no feature implements it; it is a reserved name.

Fold the prune into finalize and pagination can no longer be a feature stage: it would run before
hiding, and pages would count hidden rows. So pagination joins the same terminal step:

```
stages (group → tree) ──▶ finalize: prune → paginate → stamp index/sourceIndex
```

All three are engine-derived presentation facts computable by no single feature — a coherent
grouping, not a dumping ground. But it is a decision to take **now**, while `'paginate'` is
unclaimed and therefore free.

**If pagination must stay feature-owned, Alt 1 does not apply** and ADR-0017 as shipped is right.

## Cost

- Touches `render-stages.ts`, `core.ts`, `render-stages.spec.ts`, `core.spec.ts`.
- Behavior-neutral — every grouping/expansion test passes unchanged (spec-132 story 21).
- Amends ADR-0017 D2 (a stage → a terminal step) and reverses the epic plan's assumption that
  `'paginate'` is claimable.
- Stories 6, 7, 13 all still hold.
