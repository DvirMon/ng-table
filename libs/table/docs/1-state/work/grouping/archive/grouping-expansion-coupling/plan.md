# Plan — group-aware `expandAll()`, then decouple grouping from expansion

## Context

`grouping-collapsible-story-host.component.ts:72` hand-rolls an "Expand all" loop because
`table.expandAll()` cannot reach group headers. Cause (`with-expansion.ts:175`): it discovers
ids via `collectExpandableRowIds(input.rows(), …)` — real `TRow`s only. A group header is
synthesized at **render** time (`engine/grouping.ts` → `group:<path>`), never in `rows()`.
`collapseAll()` needs no discovery, which is why it already works on groups.

Pulling that thread found a second, deeper thing. `withGrouping()` reads `withExpansion()`'s
`expandedRows` directly (`with-grouping.ts:36-45`). Documented as deliberate (D11,
`work/with-grouping/2-decisions.md:163`) but the stated reason is stage order: `'group'` runs
before `'tree'`, so grouping must drop a collapsed header's descendants _while emitting them_ —
and that forces it to ask, at that moment, whether the header is collapsed.

The real cause is a gap in the row model: **`RenderRow` (`api/types.ts:33`) carries `depth` but
no parent link.** Without one, "hide everything under id X" is unanswerable by generic code, so
the only code that can hide is the code that knows the parent/child relation at emit time —
grouping. The coupling is a workaround for the missing field, not a decision about expansion.

Prior art (`work/grouping-expansion-coupling/prior-art.md`, verified against published
artifacts) is unanimous against our shape: TanStack `CoreRow.parentId`/`getParentRow()`, AG Grid
`RowNode.parent`, MUI X `GridTreeNode.parent` — all carry `depth` too, none prunes with it; all
prune centrally (TanStack `expandRows()`, MUI X `visibleRowsLookupCreation`, AG Grid
`rowsToDisplay`); all share one expansion state across grouping and tree — MUI X registers the
_identical_ `getVisibleRowsLookup` for row grouping and tree data.

Two parts. **A** ships the user-facing fix. **B** removes the coupling. A's API survives B
unchanged, so A does not need to wait.

---

## Part A — `expandAll(ids?)` + `groupIds`

Expansion stays ignorant of grouping; the caller names what to expand. Matches TanStack/MUI X,
where a synthetic group id is accepted by the generic expand API.

### A1. `withGrouping()` publishes group ids

`api/features/with-grouping.ts`

- Add `readonly groupIds: Signal<RowId[]>` to `GroupingMembers<TRow>`.
- Derive from the same cluster tree the render stage walks. **Do not** re-synthesize the
  `group:<path>` string at a second site — `engine/grouping.ts` centralizes it in
  `buildGroupPath`/`toGroupId` specifically to stop that drift (same reasoning as D17). Export
  `collectGroupIds(rows, grouping, columns, groupOrder)` from `engine/grouping.ts`, walking the
  `buildClusterNodes` tree and reusing those two.
- `computed()` over `input.rows()` + `grouping()` + `input.columns()`, like `rowsOf`. Ungrouped
  ⇒ `[]`.

### A2. `expandAll` accepts explicit ids

`api/features/with-expansion.ts`

- `expandAll(ids?: readonly RowId[], options?: ExpansionWriteOptions): void`
  - Omitted ⇒ today's behavior exactly.
  - Supplied ⇒ used verbatim. No `isExpandable` filter (a synthetic id has no `TRow` to test),
    no recursion into them.
  - Both ⇒ union, so one call opens groups _and_ nested rows. `newlyExpanded`/`everExpanded`/
    `emitChanged` bookkeeping unchanged, applied over the union.
- **Back-compat:** callers pass options first today (`expandAll({ emitEvent: false })`,
  `with-expansion.spec.ts:162`). Keep an overload pair rather than an `Array.isArray` branch —
  no runtime narrowing, better IDE hover.
- Update `ExpansionMembers` (`with-expansion.ts:45`).
- **Never parse an id back apart** anywhere in this work. Prior art logs a live TanStack bug
  from exactly that (`getExpandedDepth()` splits on `.`; grouping ids use `:`/`>`). Our `group:`
  prefix is a reserved marker only.

### A3. Story drops its loop

`src/stories/grouping/grouping-collapsible/`

- `…-story-host.component.ts:72` → `this.table.expandAll(this.table.groupIds())`.
- Remove the "Expand all is this story's own loop" notice (`…component.html:27-29`), the class
  JSDoc (`…component.ts:22`), and the bullet in `grouping-collapsible.stories.ts:34`. Replace
  with one line: group ids are passed explicitly because expansion discovers data rows only.

### A4. Docs + tests

- `docs/1-state/features/expansion.md` — lines 76 and 83 already claim `expandAll()` covers
  groups. Correct them to the real rule: the set is id-agnostic, but _discovery_ is data-rows-
  only; synthetic ids are passed in.
- `docs/1-state/features/grouping.md` — document `groupIds` beside `rowsOf`.
- `with-expansion.spec.ts` — explicit ids; union with discovered; `emitEvent: false` still
  silences; options-only call still compiles.
- `with-grouping.spec.ts` — `groupIds()` matches the ids on `kind: 'group'` render rows, single
  and multi level; `[]` ungrouped.

---

## Part B — `RenderRow.parentId` + one engine-owned prune

Moves hiding from _while emitting_ to _after emitting_. The emit-time lookup disappears, and
with it the coupling.

### B0. ADR first

New ADR under `libs/shared/table/docs/adr/`. It supersedes part of ADR-0011 (stage
responsibilities) and closes out D11 in `work/with-grouping/2-decisions.md`. Cite the prior-art
doc. Also state the relationship to ADR-0012 (`withTree()` split, proposed): a central prune
makes that split cheaper, since tree and grouping would share the prune rather than each owning
one.

Prior art already lives beside this file as `prior-art.md`.

### B1. The field

`api/types.ts` — `readonly parentId?: RowId`, set by whichever stage synthesizes a child:
`'group'` for cluster members, `'tree'` (`buildTreeStage`, `with-expansion.ts:83`) for nested
children. Optional and populated-on-create, exactly like the existing `isExpanded`/`groupKey`/
`sourceIndex` fields — no interface churn, no lookup, no map.

### B2. The stage

`engine/render-stages.ts:8` — `RENDER_ORDER` becomes `['group', 'tree', <prune>, 'paginate']`.
Engine-owned, not a feature slot: one O(n) pass dropping any row with a collapsed ancestor,
walking `parentId` upward. Must run before `'paginate'` so page size counts visible rows, and
before the central `index` assignment (`engine/core.ts`, ADR-0011).

Open question for the ADR: where the prune reads the collapsed set from. Options — a neutral
engine-level slot features write to, or the engine reading `expandedRows` when present. The
second is the same guarded read moved down a layer, which is defensible (engine may know about
optional members; features should not know about each other) but should be argued explicitly,
not assumed.

### B3. Grouping stops pruning

`engine/grouping.ts` `emitGroupRows` emits every member with `parentId`, unconditionally.
Delete `readExpandedRows` + `isExpandedRowsSignal` (`with-grouping.ts:28-45`) and the
`expandedRows` argument to `buildGroupRenderRows`. `buildTreeStage` likewise stops gating on
`self.isExpanded` before appending children — it sets `parentId` and lets the prune decide.

Watch: `rowsOf`/`rowsBeneathGroup` re-derive from `rows()` and are collapse-independent by
construction (D17) — unaffected, and its spec is the regression guard.

### B4. Consequences

- `withGrouping()` composes with zero knowledge of expansion, in any order, typed or not — the
  lazy-read caveat in `grouping.md:96` goes away.
- `expandAll(ids)` from Part A is unchanged and now uniform: a header and a data row differ in
  nothing the expansion feature can see.
- Docs to update: `grouping.md` (37, 48, 59-61, 96, 143), `expansion.md` Dual Use,
  `1-state/architecture.md`, and D11 marked superseded.

---

---

## Issue slicing (user-approved)

This plan is documentation, not the issue set. Publish via `/to-issues` as one epic + three
subs, with native sub-issue and blocked-by edges plus `issue-graph.md` in the workspace.

**Epic — Decouple `withGrouping()` from `withExpansion()`** (`kind:epic`, `area:grouping`,
`area:expansion`, `area:engine`). Workspace:
`libs/shared/table/docs/1-state/work/grouping-expansion-coupling/`. `state.json` created here,
`specPath` = `plan.md`.

| #   | Slice                                                                            | Blocked by | Readiness                            |
| --- | -------------------------------------------------------------------------------- | ---------- | ------------------------------------ |
| S1  | `expandAll()` takes explicit ids; `withGrouping()` publishes `groupIds` (Part A) | none       | `needs:tasks`                        |
| S2  | `RenderRow.parentId` + engine-owned prune stage; grouping still prunes (B0-B2)   | none       | `needs:spec` — ADR is its first task |
| S3  | Grouping stops pruning; delete `readExpandedRows` (B3)                           | S2         | `needs:tasks`                        |

- S1 is in the epic, not standalone: it is the symptom that surfaced the coupling. It survives
  S2/S3 unchanged — **B does not subsume A.** `parentId` fixes the read side (who gets hidden);
  `expandAll`'s gap is the write side (discovery walks `rows()`, where headers never appear).
  Discovering from `renderRows()` post-B does not work either: a collapsed group's descendants
  are absent from it, so nested headers stay invisible and the walk would need repeated passes.
  `groupIds()` derives from the cluster tree and is collapse-independent.
- S2/S3 stay separate — expand-then-contract. Pruning twice is idempotent, so S2 lands green
  while grouping still prunes; S3 deletes the coupling only once the replacement carries the
  behavior. S3's acceptance is that S1's story is unchanged and still passes.
- The ADR is S2's first step, not its own issue — no issue whose sole deliverable is a document;
  decision and implementation review together. Hence S2's `needs:spec`.

**Close #94** (https://github.com/DvirMon/ng-table/issues/94) as superseded by S1 — created by
hand, outside the pipeline, Part A only.

Both docs stay in the repo: `prior-art.md` (verified discovery output) and `plan.md` (the record
every slice points at).

## Verification

- `nx run shared-table:typecheck` clean — template-aware; the story host renders `.html`. Re-run
  after any `.ts` error (`.claude/rules/typecheck-angular-templates.md`: `ngc` aborts before the
  template phase on a source error, so the first run proves nothing about templates).
- `nx test shared-table`.
- Storybook `grouping/collapsible`: "Expand all" opens every level, "Collapse all" still closes
  them, and a grouped-plus-tree table opens headers _and_ nested children in one click. After
  Part B, same behavior with no code change to the story — that is B's acceptance test.

All three are run manually; I do not run builds, tests, or servers.
