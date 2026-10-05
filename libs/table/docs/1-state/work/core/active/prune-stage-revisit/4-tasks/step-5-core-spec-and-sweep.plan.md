# Step 5 — core.spec fake stages, plus the stale-wording sweep

**PR scope:** One PR. `Depends on: Step 1`
`Parallel-safe with: Step 2, Step 3, Step 4, Step 6, Step 7`

**Task type:** `test`
**Stack:** `angular`
**Skills used:** `unit-test`
**Scaffolding agent:** `test-implementer`

## Files

| Path                                                        | Action                      |
| ----------------------------------------------------------- | --------------------------- |
| `libs/table/src/engine/core.spec.ts`                        | edit (4 fake stages)        |
| `libs/table/src/engine/compose-table.spec.ts`               | edit (comments, ~187, ~219) |
| `libs/table/src/api/features/compose-features.spec.ts`      | edit (comments, ~466-472)   |
| `libs/table/src/api/features/with-grouping/feature.spec.ts` | edit (comment, ~1317)       |

## Why This Step Exists

`3-architecture.md`'s call-site table lists `core.spec.ts` as a
`RenderRowTransform` import swap. It is more than that, and this step
exists because that was understated:

- three fake `renderStages.group` transforms (around lines 49, 154,
  179, 206) emit **flat** rows with hand-stamped `depth`;
- the ADR-0017 union test (around lines 240-248) stamps `parentId`
  onto siblings to make a parent/child relationship.

None of those shapes exist any more. They have to be rebuilt as
nested `RenderNode`s or the file compiles and then asserts nothing
real.

The other three files carry prune-era wording in comments only. They
are bundled here because a sweep is one reviewable unit and none of
them is worth a PR alone.

## What To Do

### `engine/core.spec.ts`

1. Swap the `RenderRowTransform` import for `RenderNodeTransform`.
2. **The `sourceIndex` group-row test** — the fake stage returns a
   `kind: 'group'`, `data: null` node whose `children` are the seeded
   nodes, instead of a header followed by `depth: 1` siblings. The
   assertion is unchanged: the header's `sourceIndex` is `undefined`,
   the data rows' are `[0, 1, 2]`.
3. **The three group-cell tests (ADR-0022)** — same rebuild: a header
   node carrying `aggregates` and `groupKey`, with the seeded nodes
   as its `children`. Drop the `depth: 0` literals; the walk assigns
   depth now. The `cells` assertions are unchanged.
4. **The `expandedRows` union test** — rebuild `p1`/`c1` and
   `p2`/`c2` as parent nodes with their child in `children`, rather
   than four siblings with `parentId` stamped. Push the same two
   disjoint `expandedSources` signals. The assertion is unchanged and
   is the point of the test: neither set alone reveals both children,
   only the union does. Fix the comment naming the terminal
   `'prune'` stage.
5. Everything else in this file — `indexById` recompute, `cells`
   rebuilding on a column change — is untouched.

### The three wording-only files

Replace prune-era phrasing with what the code now does. Do not change
an assertion in any of them; if one fails, it is a Step 1 regression,
not wording.

## Implementation Notes

- A fake stage is now a `RenderNodeTransform` — nodes in, nodes out.
  Keep the fakes minimal: `id`, `kind`, `data`, `children`, plus
  `aggregates` / `groupKey` where the test needs them.
- `core.spec.ts`'s domain is the union of contributed `expandedRows`,
  `sourceIndex` and `cells`. Do not add visibility-rule assertions
  here — Step 2 owns those.

## Risks / Watchouts

- **A fake stage that still emits siblings will pass vitest.** It
  type-errors only under `typecheck-spec`, and if the node shape is
  structurally compatible it may not even do that. Read each fake and
  confirm the nesting is real, rather than trusting a green run.
- The union test is the one place a wrong rebuild is invisible: nest
  each child under its _own_ parent, not both under one, or the test
  stops proving the union.

## Non-Goals

- Any new case. This step restores four existing tests to meaning and
  corrects four comments — it adds no coverage.
- `engine/pipeline.spec.ts`, `engine/columns.spec.ts`,
  `engine/slots.spec.ts` — the pipeline layer is untouched by this
  migration.

## Acceptance Checks

- [ ] `nx test shared-table` passes for all four files.
- [ ] `nx run shared-table:typecheck-spec` clean on a second,
      source-clean run.
- [ ] `grep -rn "prune\|StagedRow\|RenderRowTransform\|CLAIMABLE_RENDER_STAGES" libs/table/src`
      returns nothing at all, source and specs alike.
- [ ] No `depth:` or `parentId:` literal remains in a `core.spec.ts`
      fake stage.
- [ ] The union test still fails if either `expandedSources` entry is
      removed — check it by hand once.

---

← [Step 4: Expansion end-to-end](step-4-expansion-spec.plan.md) | [Step 6: The collapsible grouping story](step-6-collapsible-story.plan.md) →
