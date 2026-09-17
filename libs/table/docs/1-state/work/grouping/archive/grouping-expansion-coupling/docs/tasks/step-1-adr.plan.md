# Step 1 — ADR-0017: engine-owned descendant prune

**PR scope:** One ADR file, plus the number check. No source changes.
**Parallel-safe with:** Step 2.
**Task type:** `docs`
**Skills used:** none
**Scaffolding agent:** none — main thread

## Files

| File | Action |
|---|---|
| `libs/shared/table/docs/adr/0017-engine-owned-descendant-prune.md` | create |

## Why This Step Exists

The issue says the ADR is its first task, and two later steps are gated on what it settles. Step 3
cannot type `collapsedRows` until the polarity question is answered, and Step 4 cannot write the
prune rule until the same answer exists. Writing them first would mean deciding by implementation
and back-filling the rationale.

It also supersedes part of ADR-0011 and closes out D11, so the record has to change in the same
slice that changes the behavior it described.

## What To Do

Write the ADR following the format of the existing files in `docs/adr/` (`0016` is the most
recent — read it for the section shape: Status / Date / Related, Context, Decision, Alternatives
considered, Consequences, Verification plan).

**Confirm the number first.** `0017` is assumed because `0016-filtering-takes-a-predicate-list.md`
is the highest on disk. Check no parallel branch has claimed it before writing.

Record these decisions, all already settled in [`spec-132.md`](../../spec-132.md) — do not
relitigate them:

- **D1** — `RenderRow.parentId?: RowId`, populated on create by the synthesizing stage.
- **D2** — the prune is an engine-owned terminal pass, positioned after every feature-claimable
  stage and before `'paginate'`, and before `engine/core.ts`'s central `index` assignment. The
  justification is ordering, not ownership: no feature can know it runs last.
- **D3** — collapse state stays in the feature; the engine holds a read-only `Signal`.
- **D4** — the slot accumulates rather than single-claims.
- **D5** — no contributor means nothing is hidden.

**Settle the three open questions** from
[`architecture-132.md`](../../architecture-132.md) § Open questions:

1. **Polarity — the one that can change Step 3's type.** The leading candidate, developed during
   `/to-spec` and not yet ratified: features contribute `expandedRows` **as-is** (an expanded set,
   collapsed-by-default), and the prune rule is *hide a row when its `parentId` is set and absent
   from every contributed set*. This needs no "universe of expandable ids" — a set `parentId`
   already means the parent nests. Both existing emit sites are already expanded-set semantics
   (`engine/grouping.ts:232`, and `expandRow`'s `expanded.has(row.id)` in
   `api/features/with-expansion.ts`).

   If adopted, note the consequence for D4's wording: contributions are *expanded* sets, so
   "union of hiding" reads as "visible if the parent is in any contributed set". There is still no
   precedence conflict, because group ids and data-row ids are disjoint universes — a group
   member's `parentId` can only ever appear in the group-collapse set. Say that explicitly; it is
   what keeps D4 total without a winner rule.

   Adopt it or record why not. Either way the ADR, not Step 3, owns the answer.

2. **`'prune'` unclaimability.** Type-level `Exclude<RenderStage, 'prune'>` on the `RenderStages`
   key union is preferred over a runtime reject in `engine/compose-table.ts`. Confirm it survives
   `RenderStages` being derived from `RENDER_ORDER` — that derivation is a stated invariant in the
   library's `CLAUDE.md` and must not be broken to get the exclusion.

3. **ADR number** — as above.

**Also record the emit-ordering invariant.** Both synthesizing stages emit a parent immediately
before its descendants (`emitGroupRows` is depth-first; `expandRow` appends children inline), so a
single forward pass sees every parent before its children. That is what makes the prune `O(1)` per
row instead of an ancestor climb. It is an invariant a future stage could break, so it belongs in
the ADR rather than only in a code comment.

**Cross-references, all required by the issue:**

- Cites [`prior-art.md`](../../prior-art.md) — the TanStack / AG Grid / MUI X survey.
- Supersedes ADR-0011 in part (stage responsibilities).
- Names the ADR-0012 relationship **both ways**: ADR-0012 decisions 3 and 5 are what force D4's
  accumulating slot, and this ADR's central pass is what makes the `withTree()` split cheaper,
  since the tree and panel features share one prune instead of each owning one.
- Closes out D11 in `docs/1-state/work/with-grouping/2-decisions.md`.

## Implementation Notes

Status is `accepted` — this ADR is implemented by the steps that follow it in the same slice,
unlike ADR-0012 which sits at `proposed`.

Do not copy the spec into the ADR. The ADR records the decision and its reasoning; the spec records
the contract. Link, don't duplicate.

## Risks / Watchouts

- ADR-0012 is `proposed`, not `accepted`. This ADR depends on its decisions 3 and 5 for D4's
  justification. State that dependency plainly — if the split is ever abandoned, D4 should be
  revisited and single-claim would become correct again.
- Do not mark D11 or ADR-0011 in this step. That edit is Step 7, so this step stays one file.

## Non-Goals

- No source changes.
- Not documenting the `withTree()` split itself.
- Not updating `features/grouping.md` or `features/expansion.md` — their caveats disappear in
  #99, and they are edited there.

## Acceptance Checks

- [ ] `docs/adr/0017-engine-owned-descendant-prune.md` exists, number confirmed unclaimed.
- [ ] Records D1-D5 and settles all three open questions, polarity explicitly.
- [ ] Records the parent-before-child emit invariant.
- [ ] Cites `prior-art.md`; names ADR-0011 partial supersession, ADR-0012 in both directions, and D11.
- [ ] Section shape matches `docs/adr/0016-filtering-takes-a-predicate-list.md`.

---
[Step 2: `RenderRow.parentId` + both synthesizing stages](step-2-parent-id.plan.md) →
