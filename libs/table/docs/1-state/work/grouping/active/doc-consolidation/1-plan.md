---
title: Plan — consolidate grouping docs into one contract + one decisions log
type: plan
status: Steps A–F executed 2026-09-20. Step G (regenerate + verify) is the maintainer's manual run — not done.
date: 2026-09-20
audience: developers
capability: grouping
---

# Consolidate grouping documentation

> **Input:** [`doc-inventory-2026-09-20.md`](doc-inventory-2026-09-20.md)
> — 111 grouping-owned files, 12 relevant ADRs, corrected against
> `src` and `git log` on 2026-09-20. Read its Answer and Synthesis
> sections; this plan does not restate them.

## Goal

An agent about to change grouping reads **two files** and has full
context on every past decision:

- `docs/1-state/features/grouping.md` — what grouping does today.
- `docs/decisions/grouping.md` — why, what was tried, what was
  reversed.

Everything else becomes a linked record, not a required read.

## What this plan changes vs. the inventory's proposal

Three deliberate departures, plus two corrections already folded
into the inventory itself.

1. **The decisions log lives at `docs/decisions/<capability>.md`.**
   The inventory put it at `1-state/work/grouping/decisions-log.md`.
   `CLAUDE.md` defines `work/` as episodic — "created fresh per
   effort, archived after ship" — so a permanent read-first artifact
   there gets archived with its neighbours. It does not go under a
   numbered stream either: the log spans product, state and UI, and
   a `1-state/` path would lie about that scope. `docs/` root already
   holds `adr/`, `work/` and `status.md` unnumbered for exactly this
   reason, so `decisions/` joins them.
2. **A rollup step is part of the work, not a follow-up.** The
   inventory is a one-time cleanup with nothing stopping re-sprawl.
   The sprawl happened because no step moves a work folder's
   decisions into a durable log before archiving. Step F adds it.
3. **The log format is defined capability-agnostically, piloted on
   grouping.** Filtering, selection and expansion have the same
   disease. Inventing the shape grouping-only yields five
   incompatible logs.

Corrections already applied to the inventory (see its banner):
B3/D9 shipped in `4c86322`; all 22 ADRs carry a `**Status:**` line,
so 0019/0021/0022 are accepted, not unknown.

## Step graph

```
A (log format) ──┬──> C (write the log) ──┐
                 ├──> D (rewrite contract)┤
                 └──> F (rollup rule)     │
B (move + archive)┴──> C, D               ├──> G (regen + verify)
E (fix UI spec) ──────────────────────────┘
```

Parallel-safe: **[A, B, E]** first, then **[C, D, F]**, then **G**.
A and B are independent of each other; C and D both need A's
filename and B's final paths.

---

## Step A — define the decisions-log format

**Parallel-safe with:** B, E

Capability-agnostic convention, written once:

- Lives at `docs/decisions/<capability>.md` — unnumbered, at `docs/`
  root beside `adr/`. Permanent; never under `work/`, never under a
  numbered stream. The folder supplies the domain, so the filename
  drops the prefix (`decisions/grouping.md`, not
  `decisions/grouping.decisions.md`) per `CLAUDE.md`'s naming
  invariant.
- Numbered `G1…Gn`, unique within the capability, **never reusing a
  work folder's D-number**. This is what fixes "D7 means three
  different things".
- Columns: `| G# | Decision (one line) | Date | Status | Full record |`
- `Status` vocabulary: `shipped` · `accepted, unbuilt` ·
  `superseded by G#` · `open`.
- **One line per row.** Needs a second line → it belongs in the
  linked record, not the log.
- Supersession is expressed *in the log*, so nobody reconstructs it
  by diffing folders.
- The log is **capability-scoped, not stream-scoped** — it carries
  product, state-layer and UI-layer decisions alike. The unnumbered
  path is what makes that honest.

Register it in `libs/table/CLAUDE.md`'s docs-structure table, with
the one line that keeps it distinct from ADRs:

> `adr/` holds cross-capability architectural constraints.
> `decisions/<capability>.md` is a per-capability index over that
> capability's decision history — it links to ADRs and work folders,
> and records nothing that is not recorded elsewhere.

Because the contract and the log are no longer siblings in the
tree, each gets a header link to the other, and CLAUDE.md's "Before
implementing a feature" list names both.

**Acceptance:** the format is documented without the word
"grouping" appearing in it; CLAUDE.md's table names the log and
carries the `adr/` vs `decisions/` rule.

---

## Step B — move the strays, archive what is done

**Parallel-safe with:** A, E · Use `git mv`, preserve history.

| From | To | Evidence |
|---|---|---|
| `docs/work/aggregate-config-placement/` | `1-state/work/grouping/active/aggregate-config-placement/` | Purely a grouping decision. Number its bullets `D1…Dn` on the way so the log can cite them |
| `docs/work/grouping-doc-audit/` | `1-state/work/grouping/archive/doc-audit/` | Resolved; keep for its 1 unverified row |
| `docs/work/spec-coverage-audit/grouping*.md` | `1-state/work/grouping/active/spec-coverage/` | 6 untested behaviors — live work. Keep the superseded cut alongside, marked |
| `1-state/work/grouping/active/per-column-group-admission/` | `…/archive/` | Verified: `enable`/`when` ship at `feature.ts:116` |
| `1-state/work/grouping/active/column-group-index/` | `…/archive/` | Verified: `groupingLevels`/`isGroupedBy` ship at `feature.ts:74,78`. Fix its stale `state.json` checklist first |
| `3-ui/work/grouping-stories/` | `3-ui/work/archive/grouping-stories/` | 8/8 steps done. **Promote `3-lesson-audit.md` first** — it is the one-story-one-lesson decision record, not an audit, and `grouping-coverage` depends on it |

Also in this step:

- Mark `active/grouping-config-simplification/3-plan-declarator-split.md`
  **executed in `4c86322`** — do not delete it.
- Leave `docs/work/trim-docs/` and `docs/work/adr-scope-audit/`
  where they are; both are genuinely repo-wide. Add
  `docs/work/<slug>/` to CLAUDE.md's table as the sanctioned home
  for cross-stream efforts, so it stops reading as a violation.

**Stays active:** `grouping-config-simplification` (D6 open) and
`3-ui/work/grouping-coverage` (steps 5 ▶, 6 ☐).

**Resolved 2026-09-20 — minimal shape.** `3-ui/work/` is flat (8
slugs, no capability folders, no `active|archive`), while
`1-state/work/` is `<capability>/active|archive` across all 9
capabilities. Two options were weighed:

- **Minimal (chosen):** add `3-ui/work/archive/`, move
  `grouping-stories` into it, leave the other 7 folders untouched.
- **Symmetric (deferred):** restructure to
  `3-ui/work/grouping/{active,archive}/` to mirror `1-state/`.
  Rejected *for this effort* — it touches `core-directives`,
  `filtering-stories`, `selection-stories` and 4 more folders with
  no grouping involvement. A repo-wide convention change should not
  ride on a grouping cleanup; file it as its own effort.

**Acceptance:** no grouping file remains under `docs/work/`; every
folder under `active/` has open work; `git log --follow` still
reaches moved files.

---

## Step C — write `docs/decisions/grouping.md`

**Depends on:** A (format), B (final paths)

Roll these four D-namespaces into one G-numbered table:

| Source | Range | Note |
|---|---|---|
| `archive/with-grouping/2-decisions.md` | D1–D17 | The foundational set |
| `active/grouping-config-simplification/2-decisions.md` | D1–D9 | D1 supersedes archived D6/D7; D2 reverses archived D8 |
| `archive/column-group-index/2-decisions.md` | D1–D7 | Reopens archived D2 |
| `active/aggregate-config-placement/1-decisions.md` | unnumbered | Number in step B first |

Plus the UI-layer decision from `3-lesson-audit.md`, and any
decision that only exists in an ADR.

**Acceptance:**
- Every D-number across all four namespaces appears exactly once as
  a G-row, or is explicitly marked as rolled into another G-row.
- No G-row exceeds one line.
- Every superseding relationship the inventory's Synthesis names is
  visible in the `Status` column.
- Nothing is restated — each row links out.

---

## Step D — rewrite `features/grouping.md` as the real contract

**Depends on:** A (log filename), B (final paths) ·
**Parallel-safe with:** C, F

- Absorb `archive/with-grouping/3-spec.md`: State Shape, Methods,
  public surface, group admission. An archived file superseding a
  permanent one is the core bug.
- **Then gut `3-spec.md` to a tombstone** (decided 2026-09-20):
  replace its body with one line pointing at
  `features/grouping.md`. Keeping the full body after absorption
  leaves two copies of the contract — the exact disease this plan
  exists to cure. The file itself stays so existing links resolve
  and `git log --follow` keeps working; only the duplicated content
  goes.
- **Delete the 70-line superseded banner.** A banner explaining
  what an old draft got wrong is only needed while the old draft is
  still the body.
- Keep: pipeline clustering, `RenderRow`/`renderRows` design,
  aggregation contract, prior-art comparison, competitive verdict.
- Add a header link: decision history → `../../decisions/grouping.md`.
  The two canonical files are in different folders now, so the
  cross-link is load-bearing, not decoration.
- Add **"ADRs that constrain this feature"**, one line each on what
  it constrains — in this order:

  | ADR | Constrains |
  |---|---|
  | 0017 | Collapse/expand is engine-owned, not grouping's code |
  | 0021 | Grouping names row fields; `columnsSchema` names column ids |
  | 0018 | `when`/`enable` — grouping is the only feature with this shape |
  | 0011 | The `'group'` render stage claim |
  | 0014 | `aggregateFn` degrades, never throws |
  | 0019 | What 0021's D7 amends |
  | 0022 | `buildGroupCells` and the `aggregates`→`cells` spread |
  | 0012, 0006 | Background |

- Keep `capability`/`spec`/`code` frontmatter so `status.md` still
  regenerates.

**Acceptance:** the Methods section is verified against
`src/api/features/with-grouping/feature.ts`, **not** against a doc.
Nine previously-uncited ADRs are now cited.

---

## Step E — reduce `3-ui/directives/grouping.md`

**Parallel-safe with:** A, B, C, D, F

The only grouping doc that is *wrong* rather than incomplete, and
`status.md` publishes it as the UI-layer answer.

Cut every API reference — `setGrouping()`, the `_buildRenderRows`
override slot, "the group value comes from `accessor`", and
"`withGrouping()` is unimplemented". All four describe a world that
never shipped or that ADR-0011/0017 replaced.

Keep: the durable decision ("no `ngpTableGroupBy` directive, and
why") plus the 5 open to-drill items. A full rewrite is a separate
task gated on the UI layer actually existing.

**Acceptance:** no identifier in the file is absent from `src`.

---

## Step F — stop the re-sprawl

**Depends on:** A

The mechanism that prevents doing this audit again in three months.

- Add to `libs/table/CLAUDE.md`: **a work folder may not move to
  `archive/` until every decision in it is registered as a G-row in
  its capability's decisions log.**
- Add the log as item 1 of "Before implementing a feature" — read
  the capability's decisions log before the spec.

**Flagged, not in this plan:** extend `tools/generate-status.ts` to
fail when a folder under `archive/` holds a decisions doc whose
D-numbers are absent from the log. Mechanical enforcement is worth
it only once a second capability adopts the format.

**Acceptance:** the archive rule is stated in CLAUDE.md, and the
"Before implementing a feature" list names the log first.

---

## Step G — regenerate and verify

**Depends on:** C, D, E

Run manually (per the repo's manual-run convention):

```bash
npm run table:status     # regenerates docs/status.md
npm run llms             # regenerates llms.txt
npm run llms:check       # must stay clean
```

Then archive this effort's own input:
`doc-inventory-2026-09-20.md` → `archive/doc-consolidation/`.
It is currently file #112 of the problem it describes.

**Final acceptance — the whole point of the plan.** An agent
reading *only* `1-state/features/grouping.md` and
`decisions/grouping.md` can answer all three without opening
another file:

1. Who owns collapse/expand? (the engine, ADR-0017 — not grouping)
2. Does grouping read `accessor`? (no — archived D7)
3. Where does `aggregateFn` live, and is it built? (grouping-owned,
   `applyAggregate` via `GroupingPath`, **not yet in `src`**)

If any answer requires a third file, step C or D is incomplete.

---

## What this plan does not delete

Stated so it is on the record, not left implicit:

- **The 66 archived task-step files** under
  `with-grouping/docs/tasks/**`, `grouping-expansion-coupling/docs/tasks/**`
  and `grouping-stories/docs/tasks/**`. Pure execution output with
  no unique rationale, and they are `trim-docs`' stated target —
  but that is a repo-wide call for `trim-docs` to make, not
  grouping's to make unilaterally.
- **Everything else.** The only content removed anywhere in this
  plan is the 70-line superseded banner in `features/grouping.md`,
  `3-spec.md`'s now-duplicated body, and the four wrong API claims
  in `3-ui/directives/grouping.md`. No file is deleted.

## Decisions

| | Decision | Date | Status |
|---|---|---|---|
| 1 | `3-ui/work/` gets a flat `archive/`; the symmetric `<capability>/active\|archive` restructure is deferred to its own effort | 2026-09-20 | resolved — see step B |
| 2 | `3-spec.md` is gutted to a tombstone after absorption, not kept whole and not deleted | 2026-09-20 | resolved — see step D |
| 3 | The log is capability-scoped — it carries product, state and UI decisions in one file | 2026-09-20 | resolved |
| 4 | It lives at `docs/decisions/<capability>.md`, unnumbered at `docs/` root beside `adr/`, rather than under `1-state/features/` | 2026-09-20 | resolved — see step A |

No decisions outstanding. Decision 4 supersedes this plan's original
`1-state/features/grouping.decisions.md` placement: a log spanning
four streams should not sit inside one of them. The cost is that the
contract and the log are no longer adjacent in the tree, paid for by
reciprocal header links and CLAUDE.md naming both.
