# Step 4 — `'prune'` stage + engine wiring

**PR scope:** The terminal prune itself — stage order, the pass, and `core.ts` feeding it the
unioned set. The behavioral centre of the slice, still observably neutral because grouping
double-prunes.
**Depends on:** Step 2 (the pass reads `parentId`), Step 3 (the pass reads the slot).
**Task type:** `code`
**Skills used:** `angular-developer`
**Scaffolding agent:** `angular-implementer`

## Files

| File                                            | Action                                                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `libs/shared/table/src/engine/render-stages.ts` | edit — `'prune'` in `RENDER_ORDER`, key exclusion, `runRenderStages` signature, the pass |
| `libs/shared/table/src/engine/core.ts`          | edit — union computed, pass into `runRenderStages`                                       |

## Why This Step Exists

This is the replacement the epic is built around: hiding moves from _while emitting_ to _after
emitting_. Everything before this step is additive scaffolding; everything after is verification.

It stays behavior-neutral because grouping keeps its own prune (D6) and pruning twice is
idempotent — which is exactly why #98 and #99 are separate issues.

## What To Do

### `engine/render-stages.ts`

**Stage order** (line 8):

```ts
export const RENDER_ORDER = ['group', 'tree', 'prune', 'paginate'] as const;
```

Before `'paginate'` so a page counts visible rows; after every feature-claimable stage so no
feature has to know it runs last.

**Make `'prune'` unclaimable.** Per the ADR (preferred: type-level), key the `RenderStages` map on
`Exclude<RenderStage, 'prune'>` so a feature declaring `renderStages.prune` is a compile error.
`RenderStages` must still be **derived from `RENDER_ORDER`** — that one-declaration invariant is
stated in the library's `CLAUDE.md` and must survive the exclusion. Follow whatever the ADR
settled if it chose the runtime reject instead.

**Signature** — `runRenderStages` gains the collapsed set as a third parameter, already unioned by
the caller:

```ts
export function runRenderStages<TRow>(
  rows: Omit<RenderRow<TRow>, 'index'>[],
  stages: RenderStages<TRow>,
  collapsed: ReadonlySet<RowId>,
): Omit<RenderRow<TRow>, 'index'>[];
```

The `reduce` runs the prune when it reaches `'prune'` rather than looking that key up in `stages`.

**The pass.** One forward pass. Sketch — adjust the predicate to the polarity the ADR settled:

```ts
function pruneCollapsedDescendants<TRow>(
  rows: Omit<RenderRow<TRow>, 'index'>[],
  collapsed: ReadonlySet<RowId>,
): Omit<RenderRow<TRow>, 'index'>[] {
  if (collapsed.size === 0) return rows;
  const hidden = new Set<RowId>();
  return rows.filter((row) => {
    const hasHiddenParent =
      row.parentId !== undefined && (hidden.has(row.parentId) || collapsed.has(row.parentId));
    if (hasHiddenParent) {
      hidden.add(row.id);
      return false;
    }
    return true;
  });
}
```

A single pass is correct **only** because both synthesizing stages emit a parent immediately
before its descendants — `emitGroupRows` is depth-first, `expandRow` appends children inline. The
ADR records this invariant; restate it as a `//` comment on the function, because a future stage
could break it and the failure would be silent.

The `collapsed.size === 0` early return is the D5 no-op path: no contributor, nothing hidden.

### `engine/core.ts`

Union the contributed sets into one `computed`, and pass it to `runRenderStages` at line 66.

Placement matters: the prune runs **inside** `runRenderStages`, so it is already before the
central `index` / `sourceIndex` stamping at lines 67-73. Do not move that stamping — it is the
ADR-0011 arrangement, and the prune running first is what makes `index` count visible rows.

An empty `collapsedSources` array unions to an empty set, which the pass short-circuits.

## Implementation Notes

Keep `pruneCollapsedDescendants` in `render-stages.ts` beside `runRenderStages` — it is the one
engine-owned stage and has no state of its own. If a second engine-owned stage ever lands, promote
both to their own file then (`.claude/rules/file-organization.md`: promote on evidence, not
anticipation).

`engine/` is pure — no signals, no Angular — except `compose-table.ts`. The pass takes a plain
`ReadonlySet` and returns a plain array, so it stays testable with bare `vitest`. The `computed`
that unions the sources lives in `core.ts`, which is already the signal boundary.

## Risks / Watchouts

- **Order is the whole point.** `'prune'` after `'tree'`, before `'paginate'`, and before the
  central `index` stamping. Getting any of the three wrong produces a table that looks right in a
  simple case and is wrong under pagination or assistive technology.
- **`RenderStages` must stay derived from `RENDER_ORDER`.** Do not hand-write a second key union to
  get the exclusion — that reintroduces the drift the derivation exists to prevent.
- **Behavior must not change.** Grouping still prunes; this pass re-prunes the same rows. If any
  existing grouping, expansion or `render-stages` test changes behavior, something is wrong with
  this step, not with the test.
- Do not extend the pass to walk an ancestor chain. The forward-pass `hidden` set is sufficient
  given the emit invariant, and a chain climb would hide the fact that the invariant is load-bearing.

## Non-Goals

- No deletion of grouping's prune or `readExpandedRows` — that is #99.
- No pagination feature. `'paginate'` remains an unclaimed slot; only the ordering relative to it
  is established here.
- No tests — Steps 5 and 6.

## Acceptance Checks

- [ ] `RENDER_ORDER === ['group', 'tree', 'prune', 'paginate']`.
- [ ] A feature declaring `renderStages.prune` fails to compile (or is rejected, per the ADR).
- [ ] `RenderStages` is still derived from `RENDER_ORDER` — no second hand-maintained key list.
- [ ] `runRenderStages` takes the collapsed set; the prune runs from the `reduce`, not from `stages`.
- [ ] The pass short-circuits on an empty set, and carries a comment naming the parent-before-child emit invariant.
- [ ] `core.ts` unions the contributed sources; `index` / `sourceIndex` stamping is unmoved and now runs on pruned rows.
- [ ] Every existing grouping, expansion and `render-stages` test passes **unedited**.
- [ ] `nx run shared-table:typecheck` clean — re-run after fixing any `.ts` error.

---

← [Step 3: `collapsedRows` slot](step-3-collapsed-rows-slot.plan.md) | [Step 5: Engine tests](step-5-engine-tests.plan.md) →
