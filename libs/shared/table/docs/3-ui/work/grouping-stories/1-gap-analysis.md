---
title: Gap analysis — Storybook stories vs. product grouping stories
type: plan
status: open — proposal, nothing here built yet
date: 2026-09-13
parent: ../../architecture.md
---

# Grouping — Story Coverage Report

Measures [`0-product/grouping.md`](../../../0-product/grouping.md)'s user stories against the 9
existing Storybook stories in `src/stories/`, then proposes the target set under
[`3-ui/stories.md`](../../stories.md)'s conventions. Same shape as the row-editing pass
([`row-edit-stories/2-gap-analysis.md`](../row-edit-stories/2-gap-analysis.md)); no content
repeated from it.

**Revised 2026-09-13** to fold in the `with-grouping/research-*.md` corpus, which the first pass
was written without — above all
[`research-grouping-ux-capabilities.md`](../../../1-state/work/with-grouping/research-grouping-ux-capabilities.md),
the version-pinned inventory of what a person can click in a grouped table across AG Grid
Enterprise, TanStack v8, MUI X Premium, PrimeNG and Material React Table. The premise the first
pass got wrong: the product doc says what a person needs to *do*; only the capability research
says what peers actually *render* for it. Story shapes derived from the first alone are invented
affordances. §2 is new, every target story's affordance list was re-checked against it, and each
revised story carries a **Changed from the first pass** block. Also folded in:
[community-pain](../../../1-state/work/with-grouping/research-grouping-community-pain.md) (T1–T7),
[internal-coverage](../../../1-state/work/with-grouping/research-grouping-internal-coverage.md),
[state-ownership](../../../1-state/work/with-grouping/research-grouping-state-ownership.md),
[group-ordering](../../../1-state/work/with-grouping/research-group-ordering.md),
[generic-utilities](../../../1-state/work/with-grouping/research-generic-grouping-utilities.md).

Coverage marks in the product doc are re-derived here from `src/`, not trusted. That doc's
blanket "every story is ❌, verified 2026-09-10" is **stale**: `withGrouping()`, the `'group'`
pipeline and render stages, `groupOrder`, collapse-via-`expandedRows`, and `rowsOf()` all shipped
between 2026-09-10 and today (issues #58/#59/#65, all 5/5 steps done — the `0 / 5 complete`
headers on their `progress.md` files are stale counters, the step rows are all ✅). The marks move
from ❌ to 🟡 in bulk. What does **not** move: nothing in `src/stories/` touches grouping at all.

## Step 1 — Inventory: which existing stories touch grouping

**None.** `grep -ri "grouping\|kind === 'group'\|aggregates" src/stories/` returns zero hits across
all nine folders (`external-write/`, `form-write-mutations/`, `gated-bulk-optimistic/`,
`gated-multiple-optimistic/`, `gated-single-optimistic/`, `gated-single-pessimistic/`,
`live-optimistic/`, `live-table/`, `sorting-editing/`). Every host is built on the row-editing
cluster's `EditRow` fixture and composes some combination of `withRowEdit()`, `withOptimistic()`
and `withSorting()`. No host composes `withGrouping()`, branches on `row.kind`, or binds
`aggregates`.

So the inventory table has no rows, and the whole target set is new. What the existing cluster
*does* supply is the pattern to copy, not coverage:

| Existing asset | What the grouping cluster reuses |
|---|---|
| `row-edit.handlers.ts` + `row-edit.http.ts` | `x-force-failure` / `x-latency-ms` request headers driven by Storybook args — the only sanctioned way to simulate a server outcome |
| `sorting-editing/`'s `rowHoldNotice` | The honest-regression precedent: build the affordance, let it visibly fail, annotate why |
| `live-table/`'s `ngp-commit-counter` | Instrumenting a boundary that is otherwise invisible on screen |
| `row-edit-story.css`, `code-tabs.css` | Shared styling + the mdx HTML/TS toggle |

**Fixture verdict:** the grouping stories get their **own** sibling fixture cluster
(`grouping.types.ts` / `.mock.ts` / `.schema.ts` / `.handlers.ts` / `.http.ts` /
`grouping-story.css`), not an extension of `row-edit.*`. `EditRow` is `{ id, name, dept }` with
three rows — one per dept, so every group would be a single-row group — and it has no numeric
column to aggregate, no nullable column, and no object-valued column. Widening it churns nine
unrelated hosts to serve a tenth.

---

## Step 2 — Conventions from peer libraries

All cells from
[`research-grouping-ux-capabilities.md`](../../../1-state/work/with-grouping/research-grouping-ux-capabilities.md)
(versions pinned there: `ag-grid-community@36.1.0` Enterprise-gated, `@tanstack/table-core@8.21.3`,
`@mui/x-data-grid-premium@9.13.0`, `primeng@22.1.1`, `material-react-table@3.2.1`). Cited from the
research, not re-fetched from vendor docs.

Legend: **✅** built in and user-operable · **⚙️** exists, developer renders it · **❌** absent.

| # | Affordance | AG Grid | TanStack | MUI X | PrimeNG | MRT | Converge? |
|---|---|---|---|---|---|---|---|
| P1 | **Group header label** = the grouped value | ✅ | ⚙️ | ✅ | ⚙️ template | ✅ | **Yes — unanimous.** Every library with a UI layer makes the value the header's primary content; the two ⚙️s are the two that ship no UI at all |
| P2 | **Expand/collapse chevron on the group row** | ✅ chevron | ⚙️ `getToggleExpandedHandler()` | ✅ chevron in the grouping cell | ✅ a focusable `button` with `aria-expanded`/`aria-controls` | ✅ | **Yes.** A chevron-shaped control on the header row, everywhere. Nobody ships the whole row as the only target |
| P3 | **Expand-all / collapse-all** | ⚙️ `expandAll()`, no button | ⚙️ `toggleAllRowsExpanded()` | ⚙️ `apiRef` only | ❌ (open since [primeng#3670](https://github.com/primefaces/primeng/issues/3670)) | ✅ `enableExpandAll` **default true** | **Split.** The *verb* converges (4/5); the *button* does not — MRT alone ships it |
| P4 | **"Group by this column" in a column menu** | ✅ `rowGroup`/`rowUnGroup` | ❌ | ✅ the documented end-user route | ❌ | ✅ column-actions menu | **Yes among the three with a column menu.** The menu is the convergent delivery vehicle for add/remove-a-level |
| P4b | **Drag a column into a group panel / dropzone** | ✅ Row Group Panel (drag in, reorder pills, remove pills) + a second dropzone in the Columns Tool Panel | ❌ | ❌ (a *recipe* only) | ❌ | ✅ drag handle → dropzone | **No** — AG Grid and MRT only. The *pills-in-order* readout is AG Grid's alone |
| P5 | **Multi-level nesting** | ✅ unlimited | ✅ unlimited | ✅ unlimited | ❌ **single level only** | ✅ | **Yes, 4/5.** PrimeNG is the outlier |
| P5b | **Indentation per level** | ✅ auto group column renderer | ⚙️ | ✅ CSS var `--DataGrid-cellOffsetMultiplier` (default `2`) | ❌ | ⚙️ | **Yes where nesting exists** — depth reads as horizontal offset, and MUI X exposes it as a single CSS multiplier |
| P6 | **Child count badge on the header** | ✅ **default on**, `suppressCount` hides | ❌ | ✅ **default on**, `hideDescendantCount` hides | ❌ | ✅ **default on** | **Yes — near-unanimous, and it is a default-on-with-a-switch.** The research's own conclusion: not rendering one is the surprising choice |
| P7 | **Aggregates inline on the group header row** | ✅ except in full-width `groupRows` mode, where they are **lost** | ⚙️ `aggregatedCell` | ✅ | ❌ nothing computed | ⚙️/✅ | **Yes** — the header row is where the summary goes |
| P7b | **Group footer / subtotal row** | ✅ `groupTotalRow: 'top' \| 'bottom'` | ❌ | ⚙️ recipe | ✅ `groupfooter` template, consumer-computed | ❌ | **No.** Only AG Grid ships it as a placement choice |
| P8 | **Sticky group header while scrolling** | ✅ **default on**, `suppressGroupRowsSticky` opts out | ❌ | ❌ not even a recipe | ❌ | ❌ | **No — AG Grid alone.** Research §8 calls it "the single biggest readability difference on screen" for long groups |
| P9 | **Group order — default** | data-insertion | `Map` insertion (first-occurrence) | criterion's `sortComparator` | grouping *is* a sort (`groupRowsByOrder`, default asc) | first-occurrence | **Yes on first-occurrence**, 3/5 explicitly; PrimeNG is alphabetical-by-construction |
| P9b | **Order groups by count / aggregate** | ✅ `initialGroupOrderComparator` over full `IRowNode` pairs — but it "executes before filtering and aggregation" | ⚙️ indirectly | ⚙️ recipe | ❌ | ⚙️ | **No.** AG Grid is closest and is Enterprise; its own docs record the limitation |
| P9c | **End user places groups in an arbitrary order** | ❌ | ❌ | ❌ | ❌ | ❌ | **Unanimous absence.** Research §3: "no library offers this anywhere" — greenfield, no UX to copy |
| P10 | **Ticking a group's checkbox** | `groupSelects` default **`'self'`** — no side effects | `enableSubRowSelection` default **true** — all descendants | `rowSelectionPropagation` default **both directions** | — | inherits TanStack | **No — the sharpest split in the inventory.** Three majors, three defaults. D16's "ship no cascade" is the answer to exactly this |
| P10b | **Indeterminate / partial group state** | not described | ✅ `getIsSomeSelected()` | ⚙️ implied | — | ✅ | **Yes wherever a cascade exists** — a partly-selected group renders tri-state |
| P11 | **Keyboard expand/collapse** | ✅ **`Enter`** on the group element | n/a headless | ✅ **`Space`** on the focused grouping cell | ⚙️ the toggle is a real `button`, so Enter/Space | — | **Yes on "the toggle is keyboard-operable"**; the exact key diverges (Enter vs Space), which is what a real `<button>` resolves by giving both |
| P12 | **What happens to the grouped column** | hidden, replaced by a synthetic group column | `'reorder'` default — kept, moved to front | `'single'` default — **stays where it was**, value shown twice | stays; `rowGroupMode: 'rowspan'` merges its cells instead of adding headers | `'reorder'` | **No — four libraries, four answers.** U2 has no convention to inherit |

**What converges, and therefore what a story demonstrates by default:** P1 label, P2 chevron,
P5/P5b nesting with indentation, P6 count badge default-on-with-a-switch, P7 aggregates on the
header row, P9 first-occurrence default order, P10b tri-state, P11 a keyboard-operable toggle.

**What does not converge, and therefore needs a stated position rather than a copied one:** P3
the expand-all *button*, P8 sticky headers, P9b/P9c group ordering, P10 selection cascade, P12
grouped-column disposition. Five of these already have an internal answer (OQ-3, OQ-3, D4/D15,
D16, U2-open) — the research's contribution is to say they are *choices*, not oversights.

---

## Step 3 — Product stories, re-derived against `src/`

**Partially covered** below means exactly one thing: the mechanism is in `src/` and tested, and
nothing on screen lets a person see or trigger it. That is the dominant result.

**Where the internal-coverage research and this section disagree, this section wins — and that is
the one place the research does not.** `research-grouping-internal-coverage.md` §4–§5 (2026-09-10)
concludes "grouping coverage today is zero… there is no `with-grouping.ts`, no
`mutations/update-grouping.ts`, no clustering function." All three now exist
(`api/features/with-grouping.ts`, `mutations/update-grouping.ts`, `engine/grouping.ts`), verified
by reading `src/` on 2026-09-13. The research is a correct snapshot that the code overtook; it is
superseded on §4–§5 only. **It is not superseded on §2–§3**, and two findings there were missing
from the first pass and are folded in below:

- `features/grouping.md:108` already **specifies** `RenderRow.groupKey?: { columnId: string; value: unknown }`.
  C1 is therefore an unimplemented spec field, not a new design — see C1.
- `tier-3-feature-config.md:49-81` describes an `applyGroup(path, …)` column rule driven by "a
  store `effect()`" — both the name and the mechanism diverge from the shipped `applyGrouping`
  and from D6's no-`effect()` fold. A doc fix, not a story; recorded in *Left out on purpose*.

### §1 — See the data grouped at all

| Story | Verdict | Evidence in `src/` |
|---|---|---|
| 1.1 contiguous rows + a header per group | 🟡 partial | `clusterRows` + `buildGroupRenderRows` (`engine/grouping.ts`); stable, contiguous at every depth; empty/all-unknown `grouping` is a reference-preserving no-op. **But the header carries no label** — see C1. P1 makes this the one affordance every peer with a UI renders, unanimously |
| 1.2 row count per group | 🟡 partial | `rowsOf(g).length`; `rowsBeneathGroup` re-derives from the pipeline's `TRow[]`, so it is post-filter by construction *and* collapse-independent. Nothing renders it. P6: default-on with a hide switch in 3/3 peers that have a UI and a count |
| 1.3 per-group summary | 🟡 partial | `computeAggregates` reads `ColumnDef.aggregateFn` over the cluster's own leaves at every depth (D9) — which is T2's five-year bug class (TanStack [#3323](https://github.com/TanStack/table/issues/3323)/[#6228](https://github.com/TanStack/table/issues/6228): blank at the top level of a two-level grouping) fixed by construction. **Failure gap:** `aggregateFn` is unwrapped — `engine/grouping.ts:173-174` calls it bare, so a throw on one group takes the table down, contradicting 1.3's "that group shows no summary and the rest is unaffected". ADR-0014's retrofit has not reached it (S2). **No peer prior art** — P7 records what is rendered, none of the five documents per-group aggregation failure isolation, so the product doc is the only authority here |
| 1.4 know what the table is grouped by | ❌ not covered | `table.grouping()` is readable; nothing renders it. P12 is why U2 is still open: four libraries, four dispositions for the grouped column (hidden / moved to front / shown twice / cells merged). There is no convention to inherit, so the story has to *show* the choices |

### §2 — Move around a grouped table

| Story | Verdict | Evidence in `src/` |
|---|---|---|
| 2.1 fold away a group | 🟡 partial | The render stage omits a header's descendants unless `expandedRows.has(id)`; `undefined` (no `withExpansion()`) means always expanded. `toggleExpanded(group.id)` works today on a synthetic id. No affordance — `3-ui/directives/grouping.md` is `spec: stub`, and even `expansion.md` is `code: none`, so any story is Tier 0. P2: the convergent control is a **chevron**; the whole-row target is Telerik's *unimplemented* request, not a shipped convention |
| 2.2 collapse/expand everything | 🚫 blocked | `expandAll()` walks `childrenAccessor` over real rows (`with-expansion.ts:118-134`) and cannot discover a group. No "is everything expanded" signal either. S4 + S5, OQ-3 — no issue open. P3 splits the question: the *verb* is convergent (4/5 expose it), the *button* is not (MRT alone). T7/ag-grid [#8621](https://github.com/ag-grid/ag-grid/issues/8621) is the missing-signal half exactly |
| 2.3 open at a chosen depth | 🚫 blocked | No initial-expansion config anywhere (S6, no issue open). P-research §6: the two libraries that have it both model it as an **int depth with `-1` = all** (`groupDefaultExpanded`, `defaultGroupingExpansionDepth`); TanStack has no depth concept and consumers do the arithmetic. That is the shape S6 should land on |
| 2.4 sticky group header | ❌ not covered | `ngpTableRow` binds `data-row-kind` and `data-depth` today, so this is plausibly pure CSS — OQ-3 asks exactly that and nobody has checked. P8: **AG Grid alone ships it, default on**; MUI X has not even a recipe, and T7/mui-x [#10671](https://github.com/mui/mui-x/issues/10671) (16 👍) is the purest end-user complaint in the corpus |
| 2.5 expand/collapse survives refresh/sort | 🟡 partial | `expandedRows` holds `group:>col:type:value` ids, ADR-0006 never prunes them → likely survives a refetch by accident. Unconfirmed, untested (S3/OQ-4). The id is **value**-derived, so a value that formats differently between renders breaks it silently. **T1 is the corpus's most durable complaint — same bug shape, four libraries, 2015→2026**; TanStack is the live outlier (`autoResetExpanded` defaults on). mui-x [#16495](https://github.com/mui/mui-x/issues/16495): half-restored is worse than reset |

### §3 — Control the grouping myself

| Story | Verdict | Evidence in `src/` |
|---|---|---|
| 3.1 change what it is grouped by | 🟡 partial | All four updaters ship and are tested (`mutations/update-grouping.ts`: `setGroupLevels`, `addGroupLevel`, `removeGroupLevel`, `reorderGroupLevels`) — but **none is exported from `index.ts`** (verified 2026-09-13; the column updaters beside them *are*, at `index.ts:67-69`). A consumer cannot import them. No affordance either (U6). P4/P4b sharpen what the affordance should be: a **column menu item** is the convergent route (3/5), a **drag-in panel with reorderable pills** is AG Grid+MRT only, and **programmatic-only is TanStack's route — the one library that ships no UI at all**. We are not headless, so unexported is the worst of both |
| 3.2 multi-level + re-nest | 🟡 partial | Ordered `string[]`, `reorderGroupLevels` bounds-checked to a no-op; `addGroupLevel` no-ops on an already-present id, so 3.2's "grouped by the same column twice" failure case is already harmless. Unexported, undemoed |
| 3.3 order the groups myself | 🟡 partial | `groupOrder` + `sortClusters` — siblings only, at every depth, `GroupSummary.rows` carries post-filter leaves. D15 fallback on throw: stable first-occurrence order, reported **once per evaluation to `console.error`** — invisible on screen. **Also: 3.3's fourth criterion ("changing the row sort does not disturb the group order") is unverified** — `PIPELINE_ORDER` is `filter → group → sort → expand`, so a composed `withSorting()` reorders rows *after* clustering and the render stage then re-clusters them, meaning first-occurrence group order follows the sorted rows. If that holds, D5's decoupling is `groupOrder`-only. A story is how we find out |
| 3.4 order groups by size | 🟡 partial | Falls out of `GroupSummary.rows` for free — the specific thing AG Grid's comparator cannot do (P9b: it "executes before filtering and aggregation"). `research-generic-grouping-utilities.md` Finding 3 confirms the shape independently: d3's `groupSort` takes each group's **value array**, never the bare key, and a `GroupKey`-only comparator cannot express the count case. Ours takes `GroupSummary` with `rows`. Zero demonstration |

### §4 — When the data does not cooperate

| Story | Verdict | Evidence in `src/` |
|---|---|---|
| 4.1 rows with nothing in the grouped column | ❌ not covered | `toGroupKey` yields `'null'`, `'undefined'` and `'string:'` — **three separate groups**, each rendering with no label and no fixed position. That is precisely 4.1's stated failure behavior, shipped. S7/OQ-5. T6 is the theme: mui-x [#9094](https://github.com/mui/mui-x/issues/9094) (null deliberately not grouped) and [#13204](https://github.com/mui/mui-x/issues/13204) (null rows render inline instead of as a group a person can expand) |
| 4.2 non-text grouped values | ❌ not covered | `toGroupKey` type-tags primitives and normalizes `Date` (`date:<time>`), which is better than the field — but an object gives `object:[object Object]`, the exact T6 failure (mui-x [#10729](https://github.com/mui/mui-x/issues/10729), open, 10 comments), and there is no label path at all. S8/OQ-5 — and `features/grouping.md:108` already specifies the `groupKey` field that would carry one |
| 4.3 a group with exactly one row | 🟡 partial | `hasChildren: node.items.length > 0` — single-row groups render as ordinary groups, which *is* OQ-6's recommendation, arrived at by omission rather than decision |
| 4.4 a saved grouping that no longer fits | 🟡 partial | `resolveGroupingLevels` drops unknown ids and groups by the rest; a bad `initialGrouping` throws at construction (D14, both halves shipped). Nothing exposes *that a level was dropped*, so 4.4's third criterion has no possible affordance |

### §5 — Cross-feature

| Story | Verdict | Evidence in `src/` |
|---|---|---|
| X-G1 group checkbox | 🟡 partial | `rowsOf()` ships collapse-independent and post-filter (D16); `withSelection()` ships. The consumer-side cascade, the tri-state checkbox, and the count-vs-selection agreement have no reference implementation anywhere. P10 is the sharpest disagreement in the inventory (three majors, three defaults) — which is *why* D16 ships none; P10b says tri-state is conventional wherever a cascade exists. T3: every library has shipped this and every library has broken it — ag-grid [#11209](https://github.com/ag-grid/ag-grid/issues/11209) is the filtered-collapsed-group case verbatim |
| S-G1 sorting the grouped column | ❌ not covered | D5's accepted visible no-op. Nothing makes it legible (U9) |
| S-G2 sorting rows inside a group | 🟡 partial | Structurally available; see the 3.3 caveat above — the render stage's re-cluster is what preserves contiguity, not the pipeline order |
| F-G1 filtering a grouped table | 🟡 partial | `filter` precedes `group`, so an empty group is unrepresentable and counts/summaries are post-filter by construction. Undemoed |
| F-G2 filtering by a group's summary | ❌ not covered | Deliberately out of scope |
| E-G1 groups + expandable rows | 🟡 partial | ADR-0011's `'group'` → `'tree'` render chain makes it compose; ADR-0012 is `proposed`, unimplemented; the shared-affordance question (U10) is open |
| P-G1 / P-G2 pagination, scale | 🚫 blocked | `'paginate'` is a free render stage; no `withPagination()` exists. OQ-7 |
| D-G1 drag under grouping | 🚫 blocked | No drag feature |
| G-1 / G-2 (owned by row editing) | 🚫 blocked | OQ-8 open, and `with-mutations/2-decisions.md:331-343` defers insertion under grouping |

### Redundancy

None to report — there is nothing to merge, because no existing story touches grouping. The one
adjacency worth naming and **rejecting**: bolting grouping onto `sorting-editing/` to get S-G1
cheaply. That host already composes two features for a stated reason; a third would break
`stories.md`'s "inherent to the surface, not merely adjacent" test.

---

## Step 4 — Target story set

Three new folders. Nothing to extend, nothing to merge. Each is standalone only because it passes
the "if someone opened *only* this story, would they understand the whole mechanism?" test — and
where a gap could be a button instead of a folder, it is a button.

Every story's affordance list was re-checked against §2. Each carries a **Changed from the first
pass** block naming what moved and why; unmarked rows are unchanged and were correct.

Every network/async effect is an MSW-intercepted round trip driven by `forceFailure` / `latencyMs`
Storybook args threaded into request headers — the existing pattern, not a new one.

### B. `grouping-static/` — the grouped table, always fully shown

`withGrouping()` + `withFiltering()`. **No `withExpansion()`** — deliberately, so the static mode
exists as its own product (product doc §Scope) and nothing renders a control that does nothing.
Filtering is not bolted on: 1.2's and 1.3's acceptance criteria are *about* the filtered count and
the filtered summary, and cannot be shown without it.

| Product story covered | Covered by |
|---|---|
| 1.1 contiguous rows, header per group | **new** — `@for` over `renderRows()`, branching on `row.kind === 'group'`; header row reads its label from `row.groupKey` (C1). P1: the label is the header's primary content, unanimously |
| 1.2 count per group | **new** — `{{ table.rowsOf(row).length }}` in the header, **plus a `showCount` arg defaulting to `true`** — P6's shape is default-on-with-a-switch in all three peers that render one. A filter input proves the count is of visible rows |
| 1.3 per-group summary | **new** — an `amount` column with `aggregateFn`, rendered from `row.aggregates` **on the group header row** (P7 — the convergent placement); nested levels show a parent total that is the sum of its subtree, which is T2's blank-at-depth-0 bug not happening |
| 1.3 failure — one bad group *([#79](https://github.com/DvirMon/acme/issues/79), filed 2026-09-13 — runtime-class error per ADR-0014, degrade not throw; fallback + reporting shape specced there, not inline)* | **new**, honest regression — a "Break one group's summary" button flips a signal the `aggregateFn` throws on; today this takes the table down (S2). Annotated in the doc-comment, starts passing when ADR-0014's wrap lands. No peer documents this behavior at all, so the product doc's criterion is the only bar |
| 1.4 what the table is grouped by | **new** — a persistent pill list of the active levels, in order, above the table. This is AG Grid's Row Group Panel (P4b) in its read-only half |
| 1.4 / U2 what happens to the grouped column | **new**, **added in revision** — a `groupedColumnMode` arg (`keep` / `hide` / `move-to-front`) over the already-exported `toggleColumnVisibility` / `reorderColumns` (`index.ts:67-69`). P12 is four libraries with four defaults; U2 is open; a story that renders all three is how the choice gets made on screen instead of on paper |
| 3.1 / 3.2 change and re-nest the grouping | **new**, **changed** — a per-column-header **"Group by this column" / "Ungroup"** control (P4, the convergent route) for `addGroupLevel`/`removeGroupLevel`, and the §1.4 pills made interactive — drag-or-`◀ ▶` to reorder, `×` to remove (P4b) — for `reorderGroupLevels`. A "Reset levels" control exercises `setGroupLevels`. Needs C2 |
| 3.2 failure — group by the same column twice | **new**, **added in revision** — the "Group by this column" control offered on an already-grouped column; `addGroupLevel` no-ops. ag-grid [#14635](https://github.com/ag-grid/ag-grid/issues/14635) (open, 2026) is the level-order corruption our ordered array makes unwritable; the product doc asks for a test, and this is the on-screen half |
| 3.3 order the groups | **new** — a `groupOrder` Storybook arg (`first-occurrence` default / `by-label` / `external-list`) threaded into **one** comparator closure reading a signal, not a branch per mode. `first-occurrence` is the default because P9 says 3/5 peers default to it; `by-label` is PrimeNG's entire model (grouping *is* a sort). **This is a developer-config arg, not an end-user affordance, and deliberately so** — P9c records that no library anywhere lets an end user place groups by hand, so there is no UX to copy and inventing one in a story would ship an unowned capability |
| 3.3 failure — comparator throws | **new**, own story export `ThrowingGroupOrder` — the D15 fallback only ever renders on the unhappy path, same reasoning `stories.md` gives for `ForcedFailure` earning a pinned export. The host also surfaces the report on canvas, since `console.error` is not an affordance |
| 3.4 order groups by size | **new** — a `by-count` value on the same arg. P9b: AG Grid's comparator cannot express this because it runs before filtering and aggregation; ours can |
| 4.1 empty/null grouped values | **new**, honest regression — fixture rows with `null`, `undefined` and `""`; today three unlabelled groups (S7). The story is the bug report. T6 is the theme this sits in |
| 4.2 non-text grouped values | **new**, honest regression — an object-valued column and a `Date` column; `Date` groups correctly, the object gives `[object Object]` (S8) — mui-x [#10729](https://github.com/mui/mui-x/issues/10729) verbatim |
| 4.3 single-row group | **new** — the fixture carries one, shown rendering as an ordinary group. mui-x [#9032](https://github.com/mui/mui-x/issues/9032) states the trade (an extra click vs. wasted vertical space); OQ-6 picks "always a group" and the story is what makes that choice visible |
| 4.4 a dropped grouping level | **new** — a "Group by a column that isn't there" button; the table degrades to the remaining levels and the story states that nothing tells the person (the missing half of D14) |
| F-G1 filter a grouped table | **new** — the same filter input; a group whose rows all filter out disappears. Structurally impossible to have an empty group, the same guarantee TanStack gets from its row-model order; AG Grid's `groupAggFiltering` is the opt-in that breaks it |
| 2.4 sticky group headers | **new** — a `stickyHeaders` arg toggling one CSS class keyed off `data-row-kind`/`data-depth`. P8: AG Grid alone ships it and ships it **default on**; mui-x #10671 (16 👍) is the demand. Cheap enough to settle OQ-3's "is it just CSS?" empirically instead of by discussion |
| 1.1 / P5b indentation per level | **new**, **added in revision** — `data-depth` driving a single CSS offset multiplier, MUI X's `--DataGrid-cellOffsetMultiplier` shape. The first pass demoed three levels and never said how depth reads on screen |

**Changed from the first pass**

| Row | Was | Now | Why |
|---|---|---|---|
| 3.1 / 3.2 | Four bare buttons: Group by / Add level / Remove level / Move level up-down | A column-header "Group by this column" / "Ungroup" control + interactive pills (reorder, remove) + Reset levels | **Invented.** No peer renders four bare level buttons. P4: the column menu is the convergent route for add/remove; P4b: pills-in-a-panel is the route for reorder/remove. Same four updaters, conventional shapes |
| 1.2 | Count always rendered | Count with a `showCount` arg, default on | **Omitted convergent affordance.** P6 — all three peers that render a count also ship a switch to hide it |
| 3.3 | `groupOrder` arg, mode unmarked | Same arg, `first-occurrence` pinned as the default, and explicitly labelled developer-config | P9 fixes the default; P9c says the end-user version is greenfield with no prior art, so a story must not imply one exists |
| — | absent | `groupedColumnMode` arg (P12) | Four peers, four answers, U2 open — the plan covered 1.4 with a pill list and never showed the column itself |
| — | absent | Indentation off `data-depth` (P5b) | Nesting was demoed without saying how depth reads |
| — | absent | 3.2's duplicate-level no-op | ag-grid #14635 is the live bug our ordered array precludes |

**New on-canvas controls:** filter input, "Group by this column"/"Ungroup" per column header,
interactive level pills (reorder + remove), Reset levels, Break-one-group's-summary,
Group-by-a-missing-column, sticky toggle, `groupOrder` / `showCount` / `groupedColumnMode` args.
**Story exports:** `Default`, `ThrowingGroupOrder`.

### D. `grouping-collapsible/` — the grouped table as a navigable outline

`withGrouping()` + `withExpansion()` + `withSorting()`. Sorting is inherent, not adjacent: §2.5's
acceptance criteria are "survives a sort change", and S-G1/S-G2 fall out of the same surface.

| Product story covered | Covered by |
|---|---|
| 2.1 fold away a group | **new**, **changed** — a **chevron `<button>` on the header row carrying `aria-expanded`** (P2 — every peer with a UI renders a chevron; PrimeNG's is literally a `button` with `aria-expanded`/`aria-controls`), **and** the whole header row as an enlarged hit area delegating to it (U3, Telerik [1525732](https://feedback.telerik.com/blazor/1525732-expand-collapse-a-group-by-clicking-on-the-grouping-row-group-header-not-only-the-arrow-icon), unplanned since 2021). `toggleExpanded(row.id)` at Tier 0, since no grouping/expansion directive ships |
| 2.1 keyboard expand/collapse | **new**, **added in revision** — because the chevron is a real `<button>`, Enter *and* Space both toggle. P11: AG Grid binds `Enter`, MUI X binds `Space`, and the peers disagree only because neither used a button; using one resolves the split rather than picking a side |
| 2.1 collapsing a parent hides the subtree | **new** — a three-level fixture; the render stage already does the subtree walk (D11) |
| 2.2 collapse/expand all | **new**, honest regression — an Expand all / Collapse all button implemented with a story-local walk over `renderRows()`, plus an on-canvas notice that `expandAll()` cannot discover a group (S5) and that the button cannot label itself correctly without S4. P3 is why this is a regression and not an omission: the *verb* is convergent (4/5 peers expose it) while the *button* is not (MRT alone), so OQ-3's "own the state, ship no UI" is defensible — but the state has to exist. ag-grid [#8621](https://github.com/ag-grid/ag-grid/issues/8621) and mui-x [#11421](https://github.com/mui/mui-x/issues/11421) (8 👍, both hand-rolled workarounds "not performant enough") are T7's version of the same two halves |
| 2.5 survives a background refresh | **new** — a "Refetch" button doing a real MSW `GET /api/grouped-rows` that returns fresh object identities; collapse state must survive (S3/OQ-4 confirmed or disproved on screen). **T1, the corpus's most durable complaint** — ag-grid [#600](https://github.com/ag-grid/ag-grid/issues/600) (2015, live data every 10s) through mui-x [#21398](https://github.com/mui/mui-x/issues/21398) (open, 2026) |
| 2.5 survives a sort change | **new** — sort toggle; the same check. mui-x #21398's exact reproduction is "sort model changes → `getRows` → expanded state lost" |
| 2.5 discarded on a grouping change | **new** — a "Regroup" button; the story shows the state discarded wholesale, never half-restored. mui-x [#16495](https://github.com/mui/mui-x/issues/16495) is the half-restored failure: the chevron still reads expanded while the content is gone |
| S-G1 sorting the grouped column | **new** — clicking the grouped column's header; the story makes the no-op legible instead of leaving a dead header (U9's minimum bar). mui-x [#16540](https://github.com/mui/mui-x/issues/16540) (open) is a person filing exactly this as a bug — "the sorting indicator disappears… an inconsistent user experience" |
| S-G2 sorting rows inside a group | **new** — sort by a data column, confirm the groups stay put; this is where 3.3's unverified fourth criterion actually gets tested. P9-adjacent and a genuine differentiator: TanStack cannot express it at all (one recursive pass), and AG Grid needs `groupMaintainOrder: true` — an opt-in flag — to get what our fixed stage order gives unconditionally |
| E-G1 groups + expandable rows | **new** — rows with `children`, so `'group'` and `'tree'` both run; two visibly different affordances that never trigger each other (primeng [#18171](https://github.com/primefaces/primeng/issues/18171): "the `pRowToggler` toggles the expansion of *all* rows of the group" — both features wanted the same toggle and the same row-level state slot) |

**Changed from the first pass**

| Row | Was | Now | Why |
|---|---|---|---|
| 2.1 | Whole header row as the click target, **explicitly not a chevron** | Chevron `<button>` with `aria-expanded`, plus the whole row as an enlarged hit area | **Invented — the chevron was rejected against the evidence.** P2: every peer with a UI renders one, and it is what carries the expand state to assistive tech. The whole-row target is a real ask but it is Telerik's *unimplemented request*, not a shipped convention. Both, not either |
| — | absent | Keyboard expand/collapse | **Omitted convergent affordance.** P11 — peers converge on a keyboard-operable toggle and diverge only on the key, which a real `<button>` settles |

**New on-canvas controls:** header chevrons (+ whole-row hit area), Expand/Collapse all, Refetch,
Sort toggle, Regroup.
**Story exports:** `Default`, `ForcedFailure` (the refetch fails; collapse state must survive a
failed refresh too).

### E. `grouping-selection/` — what ticking a group's checkbox does

`withGrouping()` + `withSelection()` + `withFiltering()`. Standalone because D16 made the cascade
**consumer-owned** and then said the directive layer "should ship the correct wiring as its
default so most people never hold it wrong" — until that layer exists, this story *is* the
reference wiring. Folding a tri-state checkbox column into B would also clutter the baseline whose
job is to be readable.

| Product story covered | Covered by |
|---|---|
| X-G1 tick a group's checkbox | **new**, **changed** — `select(table.rowsOf(group).map(r => r.id))`, the D16 pattern, written once where it can be copied — behind a **`cascade` arg (`self` / `descendants` / `descendants+parents`)**. P10 is the inventory's sharpest split: AG Grid defaults `'self'`, TanStack cascades to descendants, MUI X propagates **both** directions. D16's position is that the library ships none of them; the strongest possible demonstration of that position is one story rendering all three as ordinary consumer code off one `rowsOf()` |
| X-G1 partly-selected is visibly partly selected | **new** — tri-state derived from `rowsOf(group)` ∩ `selectedRows()`. P10b: conventional wherever a cascade exists (TanStack `getIsSomeSelected()`, MRT) |
| X-G1 count matches what the header says | **new** — tick a **collapsed** group under an active filter; `rowsOf()` is collapse-independent and post-filter, so the two agree by construction. **This is ag-grid [#11209](https://github.com/ag-grid/ag-grid/issues/11209) not happening** — there, an external filter left a group reading partially-selected when every *visible* child was selected |
| X-G1 selection counts rows, never headers | **new** — a "3 of 40 selected" readout; §6's "a group is a view, not a record" made visible. TanStack [#5700](https://github.com/TanStack/table/issues/5700) is the failure, diagnosed by its own reporter: "the grouped row being considered in the selected state object… even if it not a 'real' row" |
| X-G1 failure — no phantom entries after ungrouping | **new** — an Ungroup button; no group id was ever in `selectedRows`, so nothing to prune. TanStack [#5822](https://github.com/TanStack/table/issues/5822): pin an aggregation row, ungroup, hard error on an id that no longer exists |

**Changed from the first pass**

| Row | Was | Now | Why |
|---|---|---|---|
| X-G1 cascade | One hardcoded select-all-descendants cascade | A `cascade` arg rendering all three peer defaults | P10 — there is no majority default to demonstrate. A single hardcoded cascade reads as the library's position, which is the opposite of D16 |

**New on-canvas controls:** per-group and per-row checkboxes, `cascade` arg, filter input, Ungroup,
selection readout.
**Story exports:** `Default`.

### F. Async grouping rule — extension to B, **unblocked in revision**

`applyGroupingAsync()` + `forceFailure`/`latencyMs` args, proving D13's "a pending rule holds the
last explicit choice rather than flashing ungrouped" — the one genuinely async surface grouping
has, and §1.4's "not silently getting a different report". Adds one story export to B, not a folder.

**Status corrected 2026-09-13.** The first pass called this blocked on issue #60 step 4, with
`applyGrouping` "exported but inert". Step 4 is **done** — `progress.md` reads 4/6, and
`api/features/with-grouping.ts:96-108` folds `config.groupingRule ?? rulesGroupingRule` over
`baseGrouping` and writes through to `baseGrouping`. `applyGrouping`/`applyGroupingAsync` are live
(`index.ts:44-45`). What remains on #60 is step 5 (tests through the public surface, in progress)
and step 6 (docs, pending) — neither changes behavior, so **C4 drops from a hard edge to a tracked
note**.

---

## Build order — dependency graph

Nodes are concrete build units: fixture work, code dependencies, story folders.

### Core

**A — `grouping.*` fixture cluster** (`grouping.types.ts`, `.mock.ts`, `.schema.ts`, `.handlers.ts`,
`.http.ts`, `grouping-story.css`). Must define **all three** schemas up front
(`staticGroupingSchema`, `collapsibleGroupingSchema`, `groupedSelectionSchema`) and the full
fixture — nested region/category levels, a numeric column, a nullable column, an object column, a
`Date` column, a single-row group, and rows with `children` for E-G1. Landing it complete is what
makes B, D and E parallel-safe; landing it partially turns the shared schema file into an edge
between all three.
*Depends on: nothing. Parallel-safe with: C1, C2.*

**C1 — `RenderRow.groupKey`** (S8 / OQ-5). Unbuilt. A group header today carries `id`, `depth`,
`kind`, `hasChildren` and `aggregates` — and no value. The only way to render "North East" is to
parse it back out of `group:>region:string:North East`, which no story should model. The value is
already in hand at the emit site (`ClusterNode.value` in `emitGroupRows`), so this is the smallest
unblocking change in the plan and every story in it is behind the change.
*Depends on: nothing. Parallel-safe with: A, C2.*

> **Decision 2026-09-13 — implement now**, rather than filing an issue or deferring. It is an
> unimplemented spec field (`features/grouping.md:108`), the value is already in hand at the emit
> site, and all three stories are behind it.

### Independent / leaf — start now

**C2 — export the four group-level updaters from `index.ts`.** `setGroupLevels`, `addGroupLevel`,
`removeGroupLevel`, `reorderGroupLevels` ship and are tested but are not on the public surface. B's
§3.1/§3.2 buttons are what a consumer copies, so they cannot import from `mutations/` by path.

> **Decision 2026-09-13 — implement now.** Mechanical export addition, no behaviour change; the
> surface was reviewed as correct rather than re-litigated.
*Depends on: nothing. Parallel-safe with: A, C1.*

### Dependent

**B — `grouping-static/`.** *Depends on: A, C1, C2. Parallel-safe with: D, E.*
**D — `grouping-collapsible/`.** *Depends on: A, C1. Parallel-safe with: B, E.*
**E — `grouping-selection/`.** *Depends on: A, C1. Parallel-safe with: B, D.*
**F — async grouping rule export on B.** *Depends on: B. Parallel-safe with: D, E.*

### Not blocking, tracked

**C3 — S4 signal + S5 group-aware expand/collapse verb** (OQ-3, no issue open). D's Expand-all
button ships as an honest regression without it and starts passing when it lands — a soft edge, so
D is not held.
**C4 — issue #60 steps 5–6** (tests through the public surface, then docs). Steps 1–4 are done;
the fold is live and `applyGrouping`/`applyGroupingAsync` work, so **this is no longer an edge on
F**. Owned by the state effort, tracked here only because step 6 owes the doc updates these
stories will cite.
**C5 — null/empty group-key policy** (S7/OQ-5). Same shape: B carries the three-unlabelled-groups
rows as a regression demo rather than waiting.

### Graph

```
A  (grouping.* fixture cluster) ─┬─→ B (grouping-static/) ──→ F (async grouping rule)
C1 (RenderRow.groupKey) ─────────┤    ▲
                                 │    │
C2 (export group-level updaters) ─────┘
                                 │
                                 ├─→ D (grouping-collapsible/)
                                 └─→ E (grouping-selection/)

soft edges (regression demos / tracked, nothing held):
  C3 ⇢ D's Expand-all     C5 ⇢ B's §4.1 rows     C4 ⇢ F's doc references
```

**Parallel-safe: [A, C1, C2] — start now. Parallel-safe: [B, D, E] after A + C1 (B also after C2).
Dependency: A + C1 + C2 → B → F.**

**Changed from the first pass:** one edge removed — `C4 → F`, because issue #60 step 4 shipped
(see F above), so F is now blocked only by B. Node set is unchanged: the revision's new
affordances (`groupedColumnMode`, `showCount`, indentation, the chevron/keyboard toggle, E's
`cascade` arg) all build on already-exported surface — `toggleColumnVisibility`/`reorderColumns`
(`index.ts:67-69`), `rowsOf`, `data-depth`, `rowsOf(g).length` — so none of them adds a code node
or an edge. C4 moves from *in-flight dependency* to *tracked note*; the fields, the diagram and
the summary line above are all re-derived from that single ranking.

---

## Left out on purpose

| Item | Why not a story |
|---|---|
| 2.2 expand-all as a *working* control | Blocked on S4 + S5 (`expandAll()` walks `childrenAccessor` over real rows and cannot see a group). Shipped as D's honest regression instead of omitted, so the gap is visible rather than absent |
| 2.3 initial expansion depth | Blocked on S6 — no config exists to demo. A story would have to hand-seed `expandedRows`, which misrepresents a consumer-owned loop as a library feature. When S6 lands, the convergent shape is an **int depth with `-1` = all** (AG Grid `groupDefaultExpanded`, MUI X `defaultGroupingExpansionDepth`) — TanStack's absence of a depth concept is what forces consumer arithmetic |
| Group footer / subtotal rows (P7b) | **Added in revision.** `RenderRow.kind` is `'row' \| 'group'` with no footer kind, so it is not representable. Only AG Grid ships the placement choice (`groupTotalRow: 'top' \| 'bottom'`), and mui-x [#16766](https://github.com/mui/mui-x/issues/16766) is finance users saying subtotals belong at the *bottom* with rows auto-expanded. Owned by §9.1 aggregation, which has no doc — not a grouping story |
| `role="treegrid"` / `aria-level` on group rows | **Added in revision.** P11's neighbours diverge: AG Grid sets `treegrid` "when the grid has Row Grouping applied", PrimeNG deliberately stays a plain table. A container-role decision belongs to `3-ui/directives/`, not to a story host. The one a11y piece the stories *do* own is the toggle itself — a real `<button>` with `aria-expanded` (D, 2.1) |
| F-G2 filter by a group's summary | Deliberately out of scope for v1; no mechanism to demonstrate |
| P-G1 / P-G2 pagination and scale | Blocked — `withPagination()` does not exist; `'paginate'` is an unclaimed render stage. OQ-7 stays a paper decision |
| D-G1 drag under grouping | Blocked — no drag feature. Nothing to story |
| G-1 / G-2 (edited row changes group) | Blocked on OQ-8, and `with-mutations/2-decisions.md:331-343` defers insertion under grouping. Owned by row editing, not by this plan |
| A group panel / column menu as *capabilities* (§9.2, §9.3) | Capabilities with no doc and no owner. B borrows their **shapes** — a "Group by this column" control and reorderable pills, per P4/P4b — because those are the conventional affordances for the four updaters, but story-local and minimal. Building an actual drag-to-group toolbar or a general column menu would ship an unowned capability as a story |
| End-user group ordering as an affordance (P9c) | **Added in revision.** No library anywhere lets a person place group instances in an arbitrary order — the research is unanimous on the absence. B exposes `groupOrder` as a developer-config Storybook arg for that reason; inventing an end-user drag-to-reorder-groups UI in a story would imply a settled UX that does not exist. It is design work (§9.3), not porting |
| End user picking the aggregation function | **Added in revision.** AG Grid (`valueAggSubMenu`) and MUI X (column menu → Aggregation) both ship it; ours is fixed by the developer on `ColumnDef.aggregateFn`. That is §9.1's third bullet — an unowned capability, and it needs the column menu that does not exist |
| `TableSnapshot.grouping?: string \| null` | A live contradiction with D3 in `state-persistence.md:90` — a doc/type fix, not a demonstrable mechanism |
| `tier-3-feature-config.md`'s `applyGroup(path, …)` | **Added in revision** (from `research-grouping-internal-coverage.md` §3.2). Both the name and the mechanism diverge from the shipped `applyGrouping` and from D6's no-`effect()` fold. A doc fix owed by issue #60 step 6, not a story |
| `3-ui/directives/grouping.md`'s "no new directive" decision | Needs revisiting (it predates D3's multi-level array), but that is a spec decision. These stories are Tier 0 by necessity and will show what a directive would have to own |

---

## Summary — 3 stories, all new

| # | Story | Status | Standalone reason |
|---|---|---|---|
| A | `grouping.*` fixture cluster | **new** (shared) | — (not a story) |
| B | `grouping-static/` | **new** | Static mode is its own product, not a degraded collapsible one — headers, counts, summaries and level control with nothing to fold |
| D | `grouping-collapsible/` | **new** | The outline mode: collapse + state survival + sorting collisions, a sequence of states worth seeing in order |
| E | `grouping-selection/` | **new** | D16 made the cascade consumer-owned; this is the reference wiring — and P10's three-way peer split is exactly why it renders all three cascades rather than one. A tri-state checkbox column would clutter B |
| F | async grouping rule (export on B) | **unblocked** (was blocked) | — (extension, not a folder) |
| C1 | `RenderRow.groupKey` | **blocked → build first** | — (code dependency; every story is behind it, and P1 makes the label the one unanimous peer convention we cannot render) |
| C2 | export group-level updaters | **blocked → build first** | — (code dependency) |

Net: 9 existing story folders, none touching grouping → 3 new folders, one shared fixture cluster,
two small code changes ahead of them, and roughly 25 on-canvas controls rather than a folder per
gap.

**What the revision changed, in one place:** §2 is new; three invented affordances were replaced
with conventional ones (D's no-chevron whole-row toggle → chevron `<button>` + enlarged hit area;
B's four bare level buttons → column-header group-by control + interactive pills; E's single
hardcoded cascade → a three-mode `cascade` arg); five convergent affordances the first pass omitted
were added (keyboard expand/collapse, `showCount`, indentation off `data-depth`,
`groupedColumnMode`, the duplicate-level no-op); the three code gaps survive and C1 is materially
stronger (P1 unanimous, and `features/grouping.md:108` already specifies the field); F is unblocked
and one graph edge dropped.
