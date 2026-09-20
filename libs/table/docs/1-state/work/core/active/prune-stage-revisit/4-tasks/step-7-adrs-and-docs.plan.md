# Step 7 — ADR-0023, three ADR edits, and the maintainer docs

**PR scope:** One PR. No incoming edge.
`Parallel-safe with: Step 1, Step 2, Step 3, Step 4, Step 5, Step 6`

**Task type:** `docs`
**Stack:** `angular`
**Skills used:** — (main thread, no agent)
**Scaffolding agent:** none

## Files

| Path | Action |
|---|---|
| `libs/table/docs/adr/0023-tree-shaped-render-ir.md` | **new** |
| `libs/table/docs/adr/0017-engine-owned-descendant-prune.md` | edit |
| `libs/table/docs/adr/0011-…render-stages….md` | edit |
| `libs/table/docs/adr/0020-open-stage-registration-for-third-party-features.md` | edit |
| `libs/table/CLAUDE.md` | edit |
| `libs/table/docs/1-state/architecture.md` | edit (the `'prune'` sentence, ~line 158) |
| `llms.txt` | regenerate |

## Why This Step Exists

The decision is already settled in `2-spec.md` and `1-decisions.md`,
so none of this waits on code — it is parallel-safe with Step 1.

It is its own step because `libs/table/CLAUDE.md` is injected into
every session. Stale text there does not sit quietly; it propagates
into conclusions. The file currently teaches that `'prune'` is
engine-owned and unclaimable, that `RenderStages` excludes it, and
that `withGrouping()` composes with zero knowledge of expansion
*because of* ADR-0017's prune stage. All three become false.

## What To Do

1. **New ADR-0023** — `0023` is free at `29052f7`; confirm nothing
   else claims it before the branch lands. It records the tree IR:
   stages exchange nested `RenderNode`s, `flattenVisible` is the only
   reader of expansion state and the only producer of `depth` and
   `parentId`, and the four prune-support constructs are deleted.
   Use this repo's `supersedes:` front-matter plus the inline
   `*(Superseded <date> by …)*` convention.
   - It supersedes **ADR-0017 §Decision D2 only**. Say so explicitly,
     and say that D1, D3 and D4 stand — user story 26 exists because
     someone will otherwise read all of ADR-0017 as retired.
   - **G2** — it also amends **ADR-0011**: the render-stage signature
     becomes `RenderNodeTransform`, so "chained render stages" chains
     node transforms.
2. **ADR-0017** — add the supersede marker on D2. D1 stays, but its
   wording changes: `parentId` goes from *stamped by each stage* to
   *derived by the walk*.
3. **ADR-0011** — amend D2's `RENDER_ORDER` literal and the
   `RenderRowTransform` snippet.
4. **ADR-0020** (`proposed`, edited **in place**, not superseded —
   G3/E3/B2). Three edits:
   - drop **D3**, the `preservesEmissionOrder` flag — there is no
     emission order to preserve, so the boolean is not built;
   - drop the emission-order half of **D5**;
   - remove `'paginate'` and `'prune'` from **D2**'s anchor set.
     D2 justified keeping `'paginate'` as the only way to say *before
     the window is cut*; with the name gone there is **no**
     post-flatten anchor. State that there is none, deliberately —
     do not leave a reserved name nobody designed. Whether to add one
     is #102's call (architecture open question 1); flag it there.
5. **`libs/table/CLAUDE.md`** — four places, by section rather than
   line number (the file moved since `3-architecture.md` was
   written):
   - the `engine/render-stages.ts` row in the file table;
   - the `engine/rows.ts` row (the seed is a node seed now);
   - add an `engine/flatten.ts` row;
   - the "add a render stage" rule under *Feature plugin pattern* —
     `RENDER_ORDER` is now exactly "stages a feature may claim", with
     no exclusion list beside it;
   - the `withGrouping()` / ADR-0017 paragraph in the same section,
     which currently credits the `'prune'` stage for grouping's
     independence from expansion. Point it at ADR-0023 and the walk.
6. **`docs/1-state/architecture.md`** — the sentence reading
   "is entirely the engine-owned `'prune'` render stage's job".
7. **Regenerate `llms.txt`** — `npm run llms`, then
   `npm run llms:check` must stay clean.

## Implementation Notes

- Per `.claude/rules/claude-md-no-implementation-status.md`, the
  CLAUDE.md edits carry invariants only. Do not add "#107 landed" or
  a migration note — the rule is what the reader needs to not misuse
  the code.
- ADR-0023's *Alternatives considered* should name both rejected
  options with the reason they were rejected: *alt-1 terminal
  finalize* (fold the prune into `core.ts`'s terminal pass) and
  *keep ADR-0017 as shipped*. Both relocate the emission-order
  invariant instead of removing it. `alt-1-terminal-finalize.md` and
  `alt-tree-shaped-stages.md` in this workspace have the detail.
- Record **X5** in the consequences: allocation roughly doubles, one
  `RenderNode` per row plus the flat output. Accepted — prior-art
  discovery found no reported tree-vs-flat cost below ~10k rows.

## Risks / Watchouts

- `npm run llms:check` is a CI gate. Regenerating is the last action
  in this step, after every doc edit, not before.
- ADR-0020 is `proposed` and nothing depends on it, which is the only
  reason it may be edited in place. Do not extend that treatment to
  ADR-0017 or ADR-0011 — both are accepted, both get markers.

## Non-Goals

- Rolling these decisions up into `docs/decisions/<capability>.md`.
  The log gets its `G`-rows when the epic's work folder is archived,
  not per slice — and no `core` log exists yet (`grouping.md` is the
  only one).
- `docs/status.md` — generated from feature-spec frontmatter, and no
  frontmatter field changes here.
- Deciding whether a post-flatten anchor should exist. #102's.
- Re-pointing #101's ADR-0012 link away from its `acme` URL (G5).

## Acceptance Checks

- [ ] `npm run llms:check` clean.
- [ ] `grep -rn "'prune'\|CLAIMABLE_RENDER_STAGES\|RenderRowTransform" libs/table/docs libs/table/CLAUDE.md`
      returns only the historical references inside ADR-0017 and
      ADR-0023's own "what this supersedes" prose.
- [ ] ADR-0023 exists, is `accepted`, and names ADR-0017 D2 as the
      only superseded text.
- [ ] ADR-0017's D1, D3 and D4 are visibly still standing.
- [ ] ADR-0020 has no `preservesEmissionOrder`, and its D2 anchor set
      names neither `'paginate'` nor `'prune'`.
- [ ] Every link touched in this step resolves.

---
← [Step 6: The collapsible grouping story](step-6-collapsible-story.plan.md)
