---
title: Research — internal coverage audit for selection (N3)
type: research
status: complete
date: 2026-09-12
audience: product (story-discovery), developers
---

# Selection — internal coverage audit

Read-only audit feeding the product user-stories pass for `withSelection()`. Does not restate the
settled spec ([selection.md](../../../../features/selection.md), [3-spec.md](3-spec.md)) or the decision
log ([2-decisions.md](2-decisions.md), D1–D19, D58–D60) — those are linked, not duplicated, below.

## 1. Every settled decision, tagged product-visible / internal-only

| # | Decision (one line) | Tag |
|---|---|---|
| D1 | No selection-scope concept — every write names its own id set, no dependency on pagination/filtering | **product-visible** — "select all" never silently means something the consumer didn't ask for; but also means the library gives no default at all (see §4) |
| D2 | `toggle(id)` ships; single/multi is a rule on the verb, never stored mode state | **product-visible** — clicking a row's checkbox always "just works" the same way whether the table is single- or multi-select |
| D3 | State/UI seam: directives store nothing, only reflect signals and call verbs | internal-only |
| D4 | UI selection doc unblocked (scope blocker struck) | internal-only (process) |
| D5 | Selection read from `selectedRows()` signal, never stamped on `RenderRow` | internal-only — but rules out a `row.isSelected` template field a consumer might expect from other libraries |
| D6 | Checkbox directive targets native `<input>` only; component hosts (Material, DS wrappers) need a documented recipe, not auto-wiring | **product-visible** — a team using a component-based checkbox (not a native `<input>`) gets no batteries-included wiring, ever, by design |
| D7 | Tri-state ships as `selectionStateOf(ids)`, caller supplies the denominator | **product-visible** — a header checkbox's "some selected" indeterminate state is computable, but only if the consumer explicitly names which ids count as "all" |
| D8 | Unknown/unloaded ids are still selectable — no data-backed invariant, extended to cover async-restore | **product-visible** — a restored selection for a row not yet fetched (pagination, async load) is not silently dropped |
| D9 | `selectionChanged` emits a `{added, removed}` delta, one emission per write verb, CDK-shaped | **product-visible** consequence — enables server-sync/analytics without hand-diffing; a no-op write is silent (D15) |
| D10 | No cross-feature `RowIdSetChange` type, no `source`/cause discriminator on the event | internal-only |
| D11 | Removal reconciliation prunes the set but never emits `selectionChanged` | **product-visible** — deleting a selected row does not trigger a spurious second notification for a "delete selected" flow |
| D12 | Bulk `removeRow(id[])`/`patchRow(id[], partial)` out of scope for this effort | **product-visible** — bulk delete/bulk edit UI is not shippable from this feature alone yet (see X-1, §3) |
| D13 | Selection ids are flat, no parent/child cascade | **product-visible** — selecting a group/parent selects exactly that id, never its children, unless the consumer writes the cascade themselves |
| D14 | Multi-select rule applies to every write verb (not just toggle), checked against the full candidate set | **product-visible** — a bulk `select([a,b])` under single-select truncates the same way a click would |
| D15 | No-op writes emit nothing; duplicate ids collapse | **product-visible** consequence — re-applying the same selection produces no spurious "activity" signal |
| D16 | `initialSelection` config seeds silently, written directly into the signal (never through `select()`) | **product-visible** — restoring a saved selection on load never looks like a user action to a sync subscriber |
| D17 | `selectionChanged` completes in `onDestroy` | internal-only |
| D18 | `emitEvent: false` write option for async/programmatic restores | **product-visible** consequence — server-driven sync never echoes back as apparent user intent |
| D19 | `withSelection()` will declare a persistence snapshot slice later; ships no persistence now | **product-visible** — a selected set does **not** survive a reload today, and is explicitly the intended session-scoped behavior for now |
| D58 | `enableRowSelection` ships as a write-path gate (boolean or per-row predicate) | **product-visible** — some rows (e.g. locked records) can be made permanently unselectable via config, with no consumer-side re-filtering needed |
| D59 | `selectAllIds()` ships as a standalone helper (`rows`/`value`/`trackBy` only), never a `SelectionMembers` method | **product-visible** — "select all currently visible/matching" is now a one-line library call, not something every consumer hand-rolls; `includeHidden` covers "every row" |
| D60 | A write fully blocked by `enableRowSelection` is a silent no-op — no throw, no console warning | **product-visible** — ticking "select all" over a table containing non-selectable rows quietly selects only the eligible ones, with no dev-facing signal that anything was dropped (contrast: `enableMultiRowSelection` violations *do* throw in dev mode) |

**Summary for the product pass:** the highest-leverage product-visible decisions are D1 (no
default "select all" scope — the library refuses to guess, but ships nothing to fill the gap
except D59's helper), D59 (the actual working answer to "select all visible/matching rows",
shipped one day after the rest of the spec), D58/D60 (non-selectable rows, silently gated), D8
(restored/unloaded ids never get dropped), and D19 (selection does not persist across reloads,
by design, today).

## 2. What's actually built and tested

**Shipped, at `src/api/features/with-selection.ts`:** the full `SelectionMembers` surface —
`selectedRows`, `selectionChanged`, `toggle`, `select`, `deselect`, `clearSelection`,
`selectionStateOf` — plus `enableRowSelection`/`enableMultiRowSelection`/`initialSelection`
config and `onRowsRemoved` reconciliation. Matches the spec's public surface exactly; no drift
found between `3-spec.md`'s interface block and the real `.ts` file.

**Shipped, at `src/api/features/selection.utils.ts`:** `selectAllIds(table, opts?)` — a plain
function over `Pick<TableStore, 'rows' | 'value' | 'trackBy'>`, exactly as D59 describes. Not a
`SelectionMembers` addition; no DI.

**Tested, at `with-selection.spec.ts`** (24 test cases) — covers every item in `3-spec.md`'s
"Coverage" list: toggle alternation, bulk select/deselect with dedup, clear, both
`enableMultiRowSelection` truncation paths (dev-throw and prod-truncate) plus per-row predicate
scoping, both `enableRowSelection` gating paths (toggle-blocks, select-drops-mixed,
deselect-stays-ungated, initialSelection-gated, unresolvable-id-permissive per D8, blocked-write
emits-nothing per D60), unknown-id toggling, `selectionStateOf` denominator independence, exactly-
one-emission-per-verb with correct deltas, no-op/`emitEvent:false` silence, silent seeding
(including a subscriber attached immediately after construction), silent prune on row removal,
survival across sort/reorder, and stream completion on destroy. This is real, matches the spec's
stated test seam (composes through `createTable()`, asserts only on public members) — not a case
of tests trailing the spec.

**Tested, at `selection.utils.spec.ts`** (4 test cases) — default scope vs. `includeHidden`,
composition with pre-existing selection relying on `select()`'s own D15 dedup (not
re-implemented), and the empty-row-set edge case. This exactly matches the four acceptance cases
named in `docs/tasks/step-7-select-all-ids-tests.plan.md`.

**Drift found — tracking docs understate what's done.** `docs/tasks/progress.md` marks Step 7
("selectAllIds() unit tests") as `▶ in progress`, and `step-7-select-all-ids-tests.plan.md`'s four
acceptance checkboxes are all unchecked. But `selection.utils.spec.ts` already exists on disk and
fully implements all four named cases verbatim. The code and tests are done; only the tracking
artifacts (progress table, checkboxes) were never updated to reflect it. Not a functionality gap —
a bookkeeping one, worth fixing before this feeds the product doc so "in progress" isn't read as
"untested."

**Zero Storybook coverage, confirmed by reading actual story-host source, not just filenames.**
Grepped every `*-story-host.component.ts` under `src/stories/` (`live-optimistic`,
`gated-bulk-optimistic`, `gated-multiple-optimistic`, `gated-single-optimistic`,
`gated-single-pessimistic`, `external-write`, `form-write-mutations`, `sorting-editing`,
`live-table`) for `withSelection`, `selectedRows`, `selectionChanged`, `selectAllIds`,
`selectionStateOf`, `toggle(`, `clearSelection` — zero matches anywhere. A broader
case-insensitive `select` grep across `src/stories/` turns up only unrelated hits (`<select>`
dropdown elements, "selected element" wording, generic `Array.prototype.select`-adjacent naming)
— no false positives that need re-checking. There is no `selection/` story folder at all (compare
`sorting-editing/`, `live-table/`). This matches `docs/status.md`'s registered UI code as `none`
and story research as `—`.

## 3. Cross-feature stories already owned elsewhere — link, don't restate

| Story | File:line | Status marked there | Note for this audit |
|---|---|---|---|
| **F-S1** — "Selecting everything I can currently see stays true to what I see" (select-all under an active filter; hidden-selection retention + count) | [`docs/0-product/filtering.md:433-475`](../../../../../0-product/filtering.md) | ❌ not covered *(forward-looking)*, filed under "Owned by selection *(built)*" | **Partially stale.** Bullet 1 ("select all under a filter selects only currently-matching rows") is now literally what `selectAllIds(table)`'s default scope does (D59, shipped 2026-09-11) — filtering.md is dated 2026-09-10, one day before D59 landed, and was never revisited. Bullet 2 (retention of a selection that becomes hidden, plus the "N selected, M hidden" count) is genuinely still unbuilt — that's the read-side derived signal routed to `computed-state-mechanism/1-intake.md`, not solved by `selectAllIds()`. So the ❌ mark is right for the story as a whole, but for the wrong reason if read today — it should say "half solved by D59, half still open," not leave the impression nothing shipped. |
| **OQ-2** (same file, `filtering.md:536-539`) — "What does 'select all' mean under an active filter, and what happens to a hidden selection?" | `docs/0-product/filtering.md:536-539` | open, recommendation given (retain + flag hidden) | Same D59 note applies to half of this — "select all matching" is now answered; "flag hidden count" is not. |
| **X-1** — "Bulk delete and bulk edit need a selection source" | [`docs/0-product/row-editing.md:724-729`](../../../../../0-product/row-editing.md) | ❌ not covered *(forward-looking)*, filed under "Owned by selection *(unbuilt)*" | **Section header is now inaccurate.** `withSelection()` is no longer unbuilt — it has shipped, tested code (`spec: drilled, code: partial` per `docs/status.md`). The story itself is still correctly ❌: D12 explicitly keeps bulk `removeRow(id[])`/`patchRow(id[], partial)` out of scope for this effort, and bulk edit additionally needs G4 (multiple-open semantics) resolved first. So the *story* status is right, but the section header "(unbuilt)" describing the selection feature itself should read "(built, blocked on bulk-verb work)" or similar — the blocker moved from "no selection source exists" to "selection source exists, bulk verbs don't." |
| **X-G1** — "Ticking a group's checkbox" (group-header select-all semantics) | [`docs/0-product/grouping.md:599-635`](../../../../../0-product/grouping.md) | Story body still reads ❌ not covered *(forward-looking)*, "Raised as OQ-1" | **Internally contradicted within grouping.md itself, not just relative to selection's docs.** The file's own §1 changelog (line 11) and §9 gap table (lines 941, 950-952) record "OQ-1 and OQ-2 resolved 2026-09-12 by D16 (group selection)" and "Closed by D16 — the library ships no semantics; `rowsOf(group)` plus consumer cascade. Discharges the instruction in `with-selection/2-decisions.md:168-173`" — but the X-G1 story block itself (lines 601-635) was never edited to match: it still says "Undecided," still says "Raised as OQ-1" with no resolution note. Whoever regenerates/audits grouping.md next should reconcile this; flagged here because it's selection's own open question that got answered from the grouping side. |
| Group-header select-all (selection's own open question) | [`2-decisions.md:227-232`](2-decisions.md) (open questions section) and [`selection.md:182-186`](../../../../features/selection.md) | Both still say "Undecided whether this is library API or consumer code... Not blocking `withSelection()` — `withGrouping()` is unbuilt" | **Stale on selection's side too.** `withGrouping()` is no longer unbuilt (`docs/status.md`: `spec: drafted, code: partial`), and D16 (grouping) already answered the question these files still call open: no library semantics, `table.rowsOf(group)` (issue #65) plus consumer-owned cascade. Both `2-decisions.md` and `selection.md` should be updated to point at D16 rather than continuing to describe this as undecided. |
| Selection-under-filter non-dependency mention | [`docs/0-product/filtering.md:85`](../../../../../0-product/filtering.md) (§2a passing mentions, cited via the sibling filtering audit) | Architectural non-dependency note | Confirms D1 from the filtering side; no new information, just cross-referenced. |

Not found as a dedicated story anywhere: selection × column-pinning, selection × column-sizing,
selection × sorting (only covered implicitly by the `with-selection.spec.ts` "unaffected by
sorting" test, never as a product story), selection × pagination beyond the generic phantom
mentions already logged in the filtering audit.

## 4. What shipped code gives selection "for free" vs. what it deliberately does not solve

**For free, already in the engine (not selection-specific work):**

- **`SlotRegistry` single-occupancy pattern** (`engine/slots.ts`) — the mechanism behind "a second
  feature claiming a member name throws at construction" (spec user story 43), already proven
  before selection existed.
- **`pruneByIds()` / ADR-0006 reconciliation helper** (`engine/rows.ts`) — selection reuses the
  same shared removal-pruning mechanism `withExpansion()` and `withRowEdit()` already use; no new
  engine work, just a feature declaring `onRowsRemoved`.
- **`TableCore.rows`/`trackBy`** — `selectAllIds()` costs nothing at the engine level; it reads
  outputs the pipeline already produces.

**Not free / selection had to build its own:**

- **The delta-emission contract (D9)** is selection-local, hand-written per write verb
  (`applyNextSelection`'s added/removed diff) — no shared "change stream" primitive exists yet in
  the engine (D10 explicitly declines to generalize one from a single example).
- **The multi-select truncation rule and its dev/prod branch (D14)** is bespoke to this feature;
  nothing shared with `withExpansion()` or any other feature.

**Deliberately not solved — verified against code and decisions, not just restated from the
spec's "Not Shipped" table:**

- **Bulk `removeRow(id[])`/`patchRow(id[], partial)`** — confirmed absent from `src/mutations/`
  (only single-row `insertRow`/`removeRow`/`patchRow` exist there); D12 is accurate.
- **Selection checkbox directive** — confirmed zero directive files reference `selectedRows` or
  `toggle` under `src/directives/`; matches `docs/status.md`'s UI code: `none`.
- **Auto-wiring component checkbox hosts** — D6's reasoning (private Angular API) checked against
  the actual shipped code has no counter-evidence; still accurate.
- **Persistence** — confirmed no `FeatureSnapshotSlice`/`key`/`read`/`write` shape exists anywhere
  in `with-selection.ts`; D19 is accurate as "not yet, by design."
- **Group-header select-all / parent-child cascade** — confirmed `with-selection.ts` has no
  children accessor, no group-aware logic; D13 is accurate for the shipped code. (The *product
  doc's* description of this as "unowned/undecided" is what's stale — see §3 above; the code
  itself correctly implements "flat ids only.")
- **A cause discriminator on `SelectionChange`** — confirmed the type is exactly `{added,
  removed}`, no `source`/`cause` field; D10 is accurate.
- **The read-side "are all currently-visible rows already selected" signal** a select-all checkbox
  needs for its own indeterminate state — confirmed not built; `selectionStateOf(ids)` exists but
  requires the caller to already know and pass the id set, it does not derive "is everything
  currently visible selected" on its own. Routed to `computed-state-mechanism/1-intake.md` per
  D59's own text — verified that intake file exists as a work-in-progress folder
  (`docs/1-state/work/computed-state-mechanism/`), not yet a resolved design.

## 5. Additional internal drift found (not asked for by name, but load-bearing)

- **`0-architecture-seam.md:83`** (the pre-grill working note, dated 2026-09-06) states "The
  directive's read path is a `RenderRow` field (`isSelected?`) plus store signals" — this is
  superseded by **D5**, decided the same day, which explicitly rejects any `RenderRow` field for
  selection ("No `isSelected?` field, no render-stage claim... Divergence from `withExpansion()`'s
  `isExpanded` stamp is deliberate"). The working note was never corrected after the decision it
  fed diverged from it. Selection's actual read path is `selectedRows().has(row.id)` only — no
  `RenderRow` field exists in `api/types.ts` for it, confirmed.
- **`docs/1-state/state-persistence.md:227-230`** — the "Is selection persisted?" open question
  still reads "`withSelection()` doesn't exist yet" and "cannot be decided until the
  selection-scope concept... is settled." Both preconditions are gone: `withSelection()` has
  shipped code, and D1 settled scope on 2026-09-06 (this doc predates that resolution and was
  never revisited). D19 already answers the substance of this question from selection's side
  ("will declare a slice later, ships none now") — `state-persistence.md` should point at D19
  rather than continuing to describe the question as blocked on selection not existing.

## 6. Registry status — confirmed against `docs/status.md`

Current row (verified, not regenerated by this audit):

```
| `selection` | drilled | partial | stub | none | — | state · ui |
```

- State spec: `drilled` — accurate; `3-spec.md` is settled, D1–D19/D58–D60 all resolved, none
  marked open for relitigation.
- State code: `partial` — accurate; the full `SelectionMembers` surface plus `selectAllIds()` ship
  and are tested, but bulk verbs (D12), persistence (D19), and any group-cascade helper remain
  unbuilt — "partial" is the correct word, not "shipped."
- UI spec: `stub` — accurate; `3-ui/directives/selection.md` is an unblocked placeholder, not
  drilled.
- UI code: `none` — accurate; confirmed zero directive files reference selection members.
- Story research: `—` — accurate and is the entire reason this audit exists; confirms no
  `0-product/selection.md` (or equivalent) exists yet, and Storybook coverage is genuinely zero
  (§2 above), not merely undocumented.

No discrepancy found between `status.md` and the underlying frontmatter/code for this capability —
unlike filtering's audit, which caught a stale `status.md` row; selection's row is current.

---

**Sources consulted in full:** `docs/1-state/features/selection.md`,
`docs/1-state/work/with-selection/2-decisions.md`, `3-spec.md`, `0-architecture-seam.md`,
`state.json`, `docs/tasks/progress.md` and all eight `step-*.plan.md` files,
`research-row-selectability.md` (cross-checked against D58's citations), `docs/adr/0015-feature-
member-namespacing.md`, `src/api/features/with-selection.ts`, `src/api/features/
selection.utils.ts`, `src/api/features/with-selection.spec.ts`, `src/api/features/
selection.utils.spec.ts`, `docs/status.md`, `docs/0-product/filtering.md` (§5, F-S1/OQ-2 in full),
`docs/0-product/row-editing.md` (§5, X-1), `docs/0-product/grouping.md` (X-G1 story block, §1
changelog, §8/§9 gap tables), `docs/1-state/state-persistence.md` (selection open question), and
every `*-story-host.component.ts` under `src/stories/`.
