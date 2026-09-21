# Step 3 — Docs and ADRs catch up

**PR scope:** ships alone. **Parallel-safe with: Step 1, Step 2** —
every edit here is fully determined by `2-spec.md` already (which API
shape landed is pinned by the spec, not discovered during
implementation), and no doc here is read by the code or the specs.

**Task type:** docs

**Skills used:** none (prose/ADR editing)

**Scaffolding agent:** none — dispatch via fork per
`~/.claude/rules/fork-doc-writes-during-discussion.md` /
`/implement`'s docs-routing convention.

## Files

- `libs/table/docs/adr/0012-split-expansion-into-panel-and-tree.md` (edit)
- `libs/table/docs/adr/0015-feature-member-namespacing.md` (edit)
- `libs/table/docs/1-state/features/expansion.md` (edit — narrows to panel)
- `libs/table/docs/1-state/features/tree.md` (**new** — split out of expansion.md)
- `libs/table/docs/1-state/features/grouping.md` (edit — delegation note)
- `libs/table/docs/1-state/prd.md` (edit — user stories 10, 23, 31)
- `libs/table/docs/decisions/expansion.md` (edit — E-row status)

## Why This Step Exists

`2-spec.md` §"Docs and ADRs" (lines 336-354) enumerates exactly this
list — this step executes that enumeration. Nothing here is a new
decision; it's the maintainer docs catching up to what Steps 1-2 (and,
for the tree half, #118/#119 already merged) actually shipped. Per
`libs/table/CLAUDE.md`, `docs/decisions/<capability>.md` is "the first
thing to read before changing a capability" and specs "must match
[code] exactly" — leaving these stale after #121 merges means the next
person to touch expansion reads a doc describing a union collision
that no longer exists.

## What To Do

### 1. ADR-0012 (`0012-split-expansion-into-panel-and-tree.md`)

- **Status:** `proposed` → `accepted`.
- **Decision 2** (currently drops `depth`): note it's engine-owned
  since ADR-0023 — confirm the decision text doesn't still frame this
  as pending.
- **Decision 5:** reverses. Read the current text first — it likely
  says the panel composes with grouping for collapse; correct it to
  say grouping composes `withTree()`, not the panel (D8/E12,
  `2-spec.md` §Grouping).
- **Decision 6:** superseded — G6 (whatever row-shape case that
  numbered decision was guarding) is impossible under the real-row-only
  contract `withTree()` ships with, and `sourceIndex` is no longer
  stamped by a stage. Mark it superseded, don't delete it (ADR history
  rule: reversed decisions keep their row).
- **Alternatives table:** the "separate instances prevent collision"
  claim is corrected to name the actual mechanism — the union is what
  prevents collision (because the panel no longer contributes to it),
  not instance separation.
- **Verification plan:** swap any `[withExpansion(), withGrouping()]`
  composition example for `[withGrouping(), withTree()]`.

### 2. ADR-0015 (`0015-feature-member-namespacing.md`)

Its slice table currently lists one `expansion` row covering both
shapes (`| expansion | Set<RowId> | 1 — everExpanded, rowExpanded
become properties |`, line 41). Split into two rows: `expansion`
(the panel — `everExpanded` and `changed` as properties, per Step 1's
`ExpansionSlice`) and `tree` (already shipped — `changed` and `state`
as properties, per `with-tree.ts`'s `TreeSlice`). This is ahead of
#50 per `2-spec.md` line 345.

### 3. `1-state/features/expansion.md` — split in two

This file currently carries the "being split" banner (lines 13-21)
pointing at ADR-0012. Read the whole file first — it's the fullest
description of the pre-split feature and both new docs derive from it.

**Narrow `expansion.md` to the panel:**
- Drop the "being split" banner — the split is done.
- Frontmatter: `code: partial` → `shipped` (the `partial` axis rested
  on `everExpanded` being unshipped — Step 1 ships it as part of the
  slice).
- Drop the "Specced, not yet implemented" paragraph about
  `everExpanded` (line 74 today) — it's shipped now.
- Drop the "dual use" framing (line 76) — grouping no longer delegates
  here; it composes `withTree()` (see grouping.md below).
- Drop the engine-owned `'prune'` render-stage reference (`2-spec.md`
  line 348 calls this out explicitly as stale) — visibility is
  `engine/flatten.ts`'s `flattenVisible` walk now, not a `'prune'`
  stage; there is no `'prune'` entry in `RENDER_ORDER`.
- Rewrite the API table / state shape section against Step 1's actual
  `ExpansionSlice` (`expansion()`, `.everExpanded`, `.changed`,
  `.toggle`, `.expand`, `.collapse`, `.set`) — this doc must match the
  shipped code exactly, not describe an earlier draft of it.

**New `tree.md`:** derive from `expansion.md`'s tree-specific sections
(childrenAccessor, isExpandable, depth, the `'tree'` render stage,
real-row-only parents, `state()`) plus `with-tree.ts`'s own JSDoc as
the source of truth for what actually shipped. Follow the same
frontmatter contract (`capability: expansion` — both docs share the
capability, or introduce `capability: tree` if the status generator's
grouping-by-capability expects a distinct one; check `docs/status.md`'s
existing grouping logic before deciding, don't guess). `spec: drilled`,
`code: shipped` — `withTree()` is fully built.

### 4. `1-state/features/grouping.md` — delegation note

Repoint the note that currently says grouping delegates collapse state
to `withExpansion()` — it delegates to `withTree()` now
(`createTable(config, withGrouping(schema), withTree())`, per
`2-spec.md` §Grouping). Grouping composed alone (no `withTree()`) still
renders every group open, unchanged.

### 5. `1-state/prd.md` — user stories 10, 23, 31

Each currently carries the superseded framing "`withGrouping()`
requires `withExpansion()` at compile time." Correct to: grouping has
no compile-time dependency on either expansion feature; collapsible
grouping is an opt-in composition with `withTree()`.

### 6. `docs/decisions/expansion.md` — E-row status

Per the log's own maintenance rule ("supersede forward, never
delete"), update **Status** cells only, never remove rows:

- **E5, E6, E9, E13, E15** (the `withTree()`-owned decisions, `PTS D1/
  D2/D3.../D11` in the Record column) — currently read `accepted, not
  built`. `withTree()` shipped in #119; flip these to `shipped` with a
  Record note (e.g. "shipped in `with-tree.ts` (#119)").
- **E7** — `everExpanded` is panel-only. `accepted, not built` →
  `shipped` once Step 1 lands (`withExpansion()`'s `everExpanded`
  property).
- **E8, E11** — the `setExpanded`/named-verb split. Flip to `shipped`
  — both `with-tree.ts` and Step 1's `with-expansion.ts` ship this
  shape.
- **E10** — both features ship as ADR-0015 slices. `shipped` once
  both #119 (already) and Step 1 (this issue) have landed.
- **E12** — the union-collision fix. `shipped` once Step 1 removes the
  panel's `expandedRows` contribution.
- **E14** — `initial` ships with the split. `shipped`.
- **E16** — the degrading `childrenAccessor`. Already shipped in
  `with-tree.ts` (the panel has no `childrenAccessor` to degrade) —
  flip to `shipped`, Record note pointing at `with-tree.ts` only.
- **E19** — currently `accepted, not built — pinned in #121's
  acceptance criteria`. Flip to `shipped` once Step 1 ships
  `table.expansion.changed` exposing `ExpansionChange` directly.
- **E3** — already reads "shipped ·  stayed E3-shaped via an adapter
  ... until #121; superseded by E19" — no change needed, it's already
  written from this issue's perspective; leave as-is or drop the
  future-tense "until #121" wording now that it's landed.
- **E1, E2, E4, E17, E18** — leave untouched; already correctly
  `shipped`/`standing`/superseded.
- **"Still open" section** — the `ReadonlySet<RowId>` narrowing item
  (both slices today are `Signal<Set<RowId>>`) stays open unless Step 1
  actually narrows the panel's return type — confirm against Step 1's
  landed `ExpansionSlice` signature before touching this bullet.

## Implementation Notes

- Read `2-spec.md` §"Docs and ADRs" (lines 336-354) as the checklist
  this step is executing — don't re-derive it from scratch, cross-check
  against it before finishing.
- `docs/status.md` and `llms.txt` are **generated** files
  (`npm run table:status`, `npm run llms`) — per this session's
  standing rule, do not run install/build/generate scripts
  unprompted. Make the frontmatter edits that feed the generator
  (`expansion.md`/`tree.md`'s `spec`/`code` fields), then tell the user
  the two generator commands are ready to run so `docs/status.md` and
  `llms.txt` pick up the change — don't run them as part of this step.

## Risks / Watchouts

- **This is the log catching up wholesale, not per-decision.** E5/E6/
  E9/E13/E15/E16 describe work `withTree()` already shipped in #119,
  but nobody flipped their status when that PR merged — that gap
  predates this issue. Fix it here rather than treating the log's
  current "accepted, not built" as still-accurate for tree-side rows.
- **Don't delete or renumber any E-row** — supersede forward only, per
  the log's own maintenance rules (`docs/decisions/expansion.md`'s
  final section).
- **`tree.md`'s `capability:` frontmatter value is a real decision,
  not a copy-paste.** Check how `docs/status.md`'s generator groups by
  `capability:` before picking between reusing `expansion` or
  introducing `tree` — getting this wrong either merges two now-
  separate features back into one status row, or silently drops one
  from the generated index.

## Non-Goals

- No change to `docs/status.md` or `llms.txt` themselves — generated,
  flagged for the user to regenerate.
- No change to `libs/table/docs/3-ui/directives/expansion.md` (the
  UI-layer doc) — out of scope for this state-layer issue unless a
  later issue's acceptance criteria say otherwise.
- No change to `libs/table/docs/1-state/architecture.md` — not named
  in `2-spec.md`'s Docs and ADRs list.

## Acceptance Checks

- [ ] ADR-0012 status reads `accepted`; Decisions 2/5/6 and the
      alternatives/verification-plan text match what Steps 1-2 shipped.
- [ ] ADR-0015's slice table lists `expansion` and `tree` as two rows.
- [ ] `1-state/features/expansion.md` describes only the panel;
      `1-state/features/tree.md` exists and describes only the tree.
      Neither still references the `'prune'` render stage or the "not
      yet implemented" `everExpanded` framing.
- [ ] `grouping.md`'s delegation note names `withTree()`.
- [ ] `prd.md` stories 10, 23, 31 no longer claim a compile-time
      dependency between grouping and expansion.
- [ ] `docs/decisions/expansion.md`: every E-row listed above reads
      `shipped` with a Record note; no row was deleted or renumbered.

---
← [Step 2: `with-expansion.spec.ts` narrows to the panel](step-2-with-expansion-spec-narrows-to-panel.plan.md)
