# Plan: fold the competitive audit into the docs, and add a derived status roll-up

Execution plan for the work implied by [gap-analysis.md](gap-analysis.md).
Nodes are ranked by dependency edge, not by file layout or importance —
presentation order below is not a dependency.

**Scope:** documentation only. No `src/` changes. Feature implementation
(`withSelection()`, `withGrouping()`, …) is downstream of this and is not
planned here.

## Two invariants this plan is built around

1. **Status is owned by the feature's own doc.** Each spec's frontmatter is the
   single declaration of its status. `docs/status.md` is *derived* from those
   blocks by a script, never hand-edited — otherwise it is two hand-maintained
   copies of the same fact, which is the silent-drift failure
   `.claude/rules/file-organization.md` calls out.
2. **Every doc the gap-analysis assigns a verdict to records that verdict** —
   including the **ahead** ones. The audit's strongest finding is that the
   editing model beats all four researched libraries on dirty-tracking and
   rollback; `features/row-editing.md` records none of it today.

---

## Nodes

### A — Vocabulary and format decision

**Depends on:** nothing. **Parallel-safe with:** H.

The core node. Four downstream nodes encode its output, so it is resolved
first and in one place.

Decides:

- **The two status axes** replacing today's free-text `status:` string:
  - `spec: none | stub | drafted | drilled`
  - `code: none | partial | shipped`
  Today `features/expansion.md` crams both into one line
  (`shipped — everExpanded specced, not yet implemented`), which is why no
  script can read it and why "what's the state of X?" takes three file opens.
- **The verdict block format** — the section D/E/F append to each spec, so
  seventeen docs come out consistent. Carries: verdict
  (ahead / on par / gap / missing / not assessed), the one-line justification,
  and a link back to `gap-analysis.md`.
- **The three new spec filenames and their placement** — pinned here so D can
  link to them before G creates them, which removes what would otherwise be a
  D↔G edge:
  - `docs/1-state/features/column-sizing.md`
  - `docs/1-state/features/column-pinning.md`
  - `docs/1-state/state-persistence.md` — sibling of `row-mutations.md`, not
    under `features/`, because persistence is cross-feature, not a `with-*()`
    plugin (same reasoning D8 applied to row mutations)

Output: `2-decisions.md` in this folder, plus the docs-structure table in
`libs/shared/table/CLAUDE.md` updated to describe the two axes.

---

### B — Stale-doc fixes (unrelated to the audit)

**Depends on:** nothing. **Parallel-safe with:** every other node.

Two defects spotted while surveying the docs tree. Zero edges — touches files
no other node touches, so it can start immediately and land independently.

1. `docs/overview.md` — the executive summary still describes the library as
   "a two-layer composable architecture … built on NgRx Signal Store."
   ADR-0003 removed `@ngrx/signals`, and the docs are three-stream. The
   technology-stack table further down the same file already contradicts the
   paragraph above it.
2. `docs/3-ui/work/core-directives/` contains both `5-tasks/` and
   `docs/tasks/` holding the same six step files. **Verify which is canonical
   from git history before deleting either** — the other work folders are
   split on this too (`with-expansion/5-tasks/` vs
   `effect-free-column-reactivity/docs/tasks/`), so this also settles which
   layout the convention actually uses.

---

### C — Record verdicts: the **ahead** and **on par** docs

**Depends on:** A. **Parallel-safe with:** D, E, F, G.

Seven files. Disjoint from every other node's file set.

| File | Verdict to record |
|---|---|
| `1-state/features/row-editing.md` | **ahead of all four** — the two-feature optimistic/gated split sharing one `EditingState` core, and `RowRestorePoint` making rollback structurally sound. Directly answers the audit's #5 cross-cutting gap, which no vendor has shipped an answer to |
| `1-state/row-mutations.md` | **ahead of 3 of 4** — TanStack/MRT/PrimeNG have no transaction/patch API at all; roughly comparable in intent to AG Grid's `applyTransaction`, narrower (no batch/async variant) |
| `1-state/architecture.md` | **ahead** — ADR-0006 diff-and-prune row-removal reconciliation has no documented competitor equivalent |
| `2-columns/architecture.md` | **ahead** — declarative, async-resolved, multi-writer column visibility (`applyVisible`/`applyVisibleAsync`) exists nowhere in the four |
| `1-state/columns.md` | **ahead** on visibility (as above); **missing** on sizing and pinning — link to the two new specs pinned in A |
| `1-state/features/sorting.md` | **on par** on the sort model; **ahead** on null-ordering rigor (`nulls: 'last'`, `applySortNulls`) — silent/undefined behavior in all four |
| `1-state/features/expansion.md` | **on par** with TanStack/MRT; note ADR-0012's pending panel-vs-tree split |

---

### D — Record verdicts: the **missing** docs

**Depends on:** A. **Parallel-safe with:** C, E, F, G.

Five files. Each records the gap plus what the audit says to avoid when it
gets built — the point is that these specs carry the trap warnings *before*
someone drills them, not after.

| File | Verdict to record |
|---|---|
| `1-state/features/selection.md` | **missing** — the #2 baseline gap and the audit's #2 sentiment finding. Carries the warning to decide selection scope (page / filtered / all) deliberately on day one; nobody else has done this cleanly |
| `1-state/features/grouping.md` | **missing** — spec drafted, zero code. Record that the single-level scope deliberately sidesteps TanStack's unresolved depth-0 aggregation bug, so a future reader doesn't "fix" the scope by adding depth |
| `1-state/features/filtering.md` | **missing** — spec drafted, zero code; `ColumnDef.filterFn`/`enableFiltering` already typed and unconsumed. Baseline in all four |
| `1-state/features/pagination.md` | **missing** — stub, design not settled. Baseline in all four |
| `1-state/features/drag-drop.md` | **behind** AG Grid and PrimeNG on row reorder (both ship it built-in); same gap as TanStack |

---

### E — Scope note: the two docs the audit did not assess

**Depends on:** A. **Parallel-safe with:** C, D, F, G.

Two files: `1-state/features/virtual-scroll.md`,
`1-state/features/infinite-scroll.md`.

The audit is near-silent on both because it was deliberately scoped to the
state layer, and competitors' virtualization is a rendering concern. Each gets
one line recording **not assessed, and why** — so the silence reads as a
scoping decision rather than an oversight, and so a later reader doesn't
re-run the audit expecting to find them.

---

### F — Three new specs

**Depends on:** A (filenames and placement). **Parallel-safe with:** C, D, E, G.

No spec exists for any of these; the audit says all three are table stakes.

- `1-state/features/column-sizing.md` — **missing** vs all four (all ship
  sizing in core). Blocked in code on the presentation-fields ADR;
  `ColumnDef.width` is typed and unused
- `1-state/features/column-pinning.md` — **missing** vs all four
- `1-state/state-persistence.md` — **missing**. PrimeNG is the only competitor
  with a named API (`stateStorage`/`stateKey`) and it has multiple confirmed
  correctness bugs. Spec it as one atomic, round-trippable object from the
  start; the audit's PrimeNG bug list (order not restored until 17.12.0, width
  corruption, spurious restores) is the test list

These are specs, not implementations — status `spec: drafted, code: none`.

---

### G — Roll-up generator script

**Depends on:** A (the frontmatter schema only — not the normalized files).
**Parallel-safe with:** C, D, E, F.

Reads the `spec:`/`code:` frontmatter from every doc under
`libs/shared/table/docs/`, emits `docs/status.md`: one row per feature, columns
`Feature | Layer | Spec | Code | vs. competitors | Priority`.

Authoring the script needs only the schema, so it runs concurrently with the
edits it will later read. `docs/status.md` carries a generated-file header.

---

### H — Generate `docs/status.md`

**Depends on:** C, D, E, F, G. **Parallel-safe with:** nothing.

The join point. Runs the generator once every doc carries normalized
frontmatter and every new spec exists.

---

### I — Wire up `docs/README.md`

**Depends on:** F (new spec paths), H (`status.md` exists).

Adds `status.md` as the entry point at the top of the navigation index, and
adds the three new specs to the feature list. Today `README.md` is a link
index with no status signal at all.

---

## Graph

```
  A ─────┬──────┬──────┬──────┬──────┐
 (core)  │      │      │      │      │
         v      v      v      v      v
         C      D      E      F      G
      ahead  missing  scope  new   script
       (7)     (5)     (2)   (3)
         │      │      │      │      │
         └──────┴──────┴──────┴──────┘
                       │
                       v
                       H  ──────┐
                  status.md     │
                                v
                       F ─────> I
                              README

  B  ────────────────────────────────  (no edges)
 stale fixes
```

**Parallel-safe:** `[C, D, E, F, G]` after A — five tracks, disjoint file sets.
**Independent:** `B` — start now, lands whenever.
**Dependency:** `A → {C,D,E,F,G} → H → I`.

Critical path is `A → F → H → I` (F is the longest of the five — three specs
written from scratch, versus verdict blocks appended to existing files).

## Outcome (2026-09-05)

All nodes landed. Deviations from the graph above, and what they cost:

- **E was merged into D's execution.** Two files carrying one line each did not justify
  their own track. No edge was violated — the file sets stay disjoint.
- **Three nodes were added mid-flight**, each surfaced by an agent that correctly refused to
  fix something outside its scope rather than half-fixing it:
  - **J** — `2-columns/` had a systematically stale link set, not just the one broken
    `parent:` C found. 46 path fixes across 8 files.
  - **L** — nine stale anchor *fragments* in `2-columns/`, caused by headings gaining ✅/⏳
    markers after the links were written. J flagged these rather than touch headings.
  - **K** — all nine `3-ui/directives/*.md` lacked the frontmatter fields, so the roll-up
    would have rendered `—` in every UI cell, defeating the cross-layer pairing that
    justified D2. G caught this while smoke-testing the generator.
- **A's pinned filenames worked as intended.** C linked to
  `features/column-sizing.md` / `features/column-pinning.md` before F created them; no
  rework, and the accepted risk below never fired.
- **The `parent:` fix (D6) was larger than scoped.** All seven of D's files and two of C's
  carried the broken path — `row-editing.md` was the only feature spec that had it right,
  which is why it read as the anomaly rather than the correct one.

`docs/status.md` generates clean: 16 capabilities, zero diagnostics.

### Found while working, not fixed here

- `3-ui/directives/columns.md` specs an `NgpTableColumnDirective` that **does not exist** in
  `src/directives/` and is not exported. Issue 02 was written, never implemented. `sort.md`
  and `resizing.md` both name it as a dependency, so both are blocked on a directive that
  isn't there. K recorded this in the affected bodies; nobody has decided what to do about it.
- `core.md`'s `ngpTableCell` diverges from what shipped (spec: `columnId` + `data-column-id`
  + token styling; shipped: 0-based numeric index, `role`/`aria-colindex` only), and
  `ngpTableHeaderCell` ships entirely unspecced.
- **`features/row-editing.md` is now stale against `src/`.** Commit `580c21a` (D53) replaced
  `RowRestorePoint.detached` with `op: PendingOp`; the spec still documents `detached` in
  three places. ADR-0013 records the rename. Not fixed here because that refactor is still
  in flight in the working tree — fixing docs under a live refactor invites collision.

## Accepted risk

C and F are marked parallel-safe on the strength of A pinning the new spec
filenames up front. If A's placement decision changes mid-flight — say
`state-persistence.md` moves under `features/` after all — C's links break and
that node needs a second pass. Cheap to fix, and cheaper than serializing F
behind C to avoid it.
