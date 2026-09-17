---
title: Internal coverage — sorting
type: research
status: complete
date: 2026-09-17
audience: product, engineering
---

# What has this repo already decided, documented, and demonstrated for sorting?

**Date:** 2026-09-17 · **Mode:** internal-coverage

> ⚠ **The sorting spec is about to be partly superseded and carries no banner saying so.**
> [`work/sorting/active/per-column-config-placement/1-plan-sorting.md`](../per-column-config-placement/1-plan-sorting.md)
> (`status: approved shape, 2026-09-17 — not implemented`) deletes `ColumnDef.sortFn`,
> `ColumnDef.enableSorting` and `applySortNulls()` and replaces them with
> `withSorting({ sortable, schema })` + `applySorting(p.x, { compare, nulls })`. Five permanent
> docs still describe the old surface as current. A product doc must write stories against the
> *capability*, not either spelling.

## Answer

- **The state layer is genuinely shipped and the null/empty contract is the strongest thing in
  it** — resolved before the comparator and outside the direction multiply, so empties never flip
  ends (`with-sorting.ts:116-125`). Everything a person clicks works today.
- **There is no sorting UI layer and no sorting story.** `ngpTableSort` is `spec: drafted,
  code: none`, and it is specced against a `toggleSort(id, { accumulate })` signature that does
  not exist. Every one of the four stories that sorts hand-wires `(click)="table.toggleSort(id)"`.
- **The richest sorting demo is in the grouping story, not the sorting-named one.**
  `grouping-collapsible/` puts a sort button on all six columns — number, `Date`, accessor-derived
  string and a nullable string — which is the only place auto-detection and null-last are
  exercised across types. `row-edit/sorting-editing/` sorts two `string`/`string | null` columns.
- **Five shipped capabilities are demonstrated nowhere:** `multi: true`, `manual: true`, a custom
  comparator, a non-sortable column, and any `applySortNulls()` override. All five are covered by
  unit tests, which a person cannot see.
- **A person cannot start a table already sorted.** `sorting` initialises to `[]`
  (`with-sorting.ts:146`) and no config field seeds it. `applyDefaultSort` is proposed in a
  reference doc and exists nowhere.

## Method and source reliability

- Read the shipped feature end to end: `src/api/features/with-sorting.ts` (217 lines),
  `src/schema/column-rules.ts`, `src/engine/columns.ts:87-90`, `src/api/types.ts:15-19,80-81`,
  `src/index.ts:15,47-48`. Doc prose was checked against these, never trusted on its own.
- Story coverage read from **host component `.ts` and `.html`**, plus each host's fixtures
  (`*.mock.ts`, `fixtures/types.ts`, `fixtures/schema.ts`) — never from folder names or `.mdx`.
  Folder names mislead here in both directions: `sorting-editing/` is filed under the Row Editing
  Storybook title, and the broadest sorting demo lives under Grouping.
- `grep -rn "withSorting|toggleSort|..." libs/table` returned 116 files; every permanent doc among
  them was opened. Episodic `work/` folders were read only where they carry an unarchived
  decision.
- `docs/status.md` is **generated** (`tools/generate-status.ts`). A wrong value there is a
  frontmatter or generator bug, not a doc edit — filed accordingly below.
- Link targets were existence-checked on disk, not assumed from the link text.
- Unit-test names were read from `with-sorting.spec.ts`; **no test was run** (`nx test` is the
  user's to run). Test *existence* is the claim, not test *passing*.

## Findings

### 1. Settled decisions — the inventory

**Product-visible** = a person at the screen can perceive the difference.

| # | Decision | Where it is decided | Where it is implemented | Tag |
|---|---|---|---|---|
| D-S1 | Three-state toggle: ascending → descending → unsorted | [`features/sorting.md:37`](../../../features/sorting.md) | `with-sorting.ts:38-60` | **product-visible** |
| D-S2 | Single-column replace is the default; `multi: true` accumulates by click order | [`adr/0001-sorting-single-column-default.md`](../../../../adr/0001-sorting-single-column-default.md) | `with-sorting.ts:161-165` | **product-visible** |
| D-S3 | Sort state is an ordered `SortRule[]`; array position is sort priority | [`features/sorting.md:36`](../../../features/sorting.md) | `with-sorting.ts:146` | **product-visible** (under `multi`) |
| D-S4 | `manual: true` skips the client sort stage; state and `sortChanged` still update | [`features/sorting.md:60-71`](../../../features/sorting.md) | `with-sorting.ts:179` | **product-visible** (server-sorted tables) |
| D-S5 | `enableSorting: false` makes `toggleSort` a no-op for that column | [`features/sorting.md:85`](../../../features/sorting.md) | `with-sorting.ts:157-160` | **product-visible** (a header that does nothing) |
| D-S6 | Per-column `sortFn` overrides the comparator | [`features/sorting.md:83`](../../../features/sorting.md) | `with-sorting.ts:112` | internal-only (its *effect* is visible; the knob is not) |
| D-S7 | Auto-detect fallback: `Date` → `getTime()`, `number` → subtraction, else `String().localeCompare()` | **code only** — `features/sorting.md:194` still lists the algorithm as unspecced | `with-sorting.ts:62-80` | **product-visible** (zero-config correct order) |
| D-S8 | Empties resolve **before** the comparator and **outside** the `sign` multiply — placement is direction-independent | [`features/sorting.md:93-98`](../../../features/sorting.md) | `with-sorting.ts:116-125` | **product-visible** |
| D-S9 | Default placement is `nulls: 'last'` (SQL / AG Grid convention) | [`features/sorting.md:101`](../../../features/sorting.md) | `with-sorting.ts:94-96` | **product-visible** |
| D-S10 | `null`/`undefined` are always empty; `''` is a real value unless the column opts in | [`features/sorting.md:100`](../../../features/sorting.md) | `with-sorting.ts:86-92` | **product-visible** |
| D-S11 | The null rule overrides a consumer `sortFn` too — no escape hatch | [`features/sorting.md:96-98,198`](../../../features/sorting.md) | `with-sorting.ts:116-125` (the empty branch precedes `compare`) | internal-only |
| D-S12 | `applySortNulls()` is single-writer — a second call on one column throws at resolve time | [`features/sorting.md:104-105`](../../../features/sorting.md) | `column-rules.ts:60-65` + `metadata()` | internal-only (construction error) |
| D-S13 | Per-column null override requires a columns **schema**; a plain columns array gets the default and cannot override | [`features/sorting.md:106-108`](../../../features/sorting.md) | `column-rules.ts:60` | internal-only |
| D-S14 | `setSorting()` / `clearSorting()` drive state programmatically | [`features/sorting.md:47-48`](../../../features/sorting.md) | `with-sorting.ts:174-175` | **product-visible** (a "Clear sort" button) |
| D-S15 | `sortChanged: Observable<SortRule[]>` is the only sort event | [`features/sorting.md:190`](../../../features/sorting.md) | `with-sorting.ts:148,172` | internal-only |
| D-S16 | `sortDirections` — a derived `columnId → direction` map | code + [`features/sorting.md`](../../../features/sorting.md) is silent on it | `with-sorting.ts:147` | internal-only (but it is what every story binds `aria-sort` and the glyph from) |
| D-S17 | Sorting is a copy, not in-place: `[...rows].sort(...)` — ties keep input order | **code only**, undocumented | `with-sorting.ts:128` | **product-visible** (stable ties) |
| D-S18 | Pipeline order is fixed `filter → group → sort → expand` regardless of composition order | [`1-state/architecture.md:146`](../../../architecture.md) | `engine/pipeline.ts` | **product-visible** (sorting cannot reorder groups) |
| D-S19 | Sorting reads `columns` core config — **not** a feature dependency on `withColumns()` | [`1-state/columns.md:156`](../../../columns.md), [`architecture.md:121`](../../../architecture.md) (both carry a retroactive-correction banner) | `with-sorting.ts:18,156` | internal-only |
| D-S20 | FLIP row-reorder animation is built into `ngpTable`/`ngpTableRow`, **off by default** — the directives always write the transform, a consumer stylesheet turns the transition on | [`3-ui/directives/row-animation.md`](../../../../3-ui/directives/row-animation.md) (`spec: drilled, code: shipped`) | `directives/ngp-table-row.directive.ts:20-21,33-40`; opt-in rule in `src/row-flip.css` | **product-visible** — this is what makes a sort-driven move perceptible |
| D-S21 | `ngpTableSort` owns click/keydown activation and reads a configurable modifier key; reverses the earlier display-only decision | [`3-ui/directives/sort.md:16,24-31`](../../../../3-ui/directives/sort.md) | **nothing — `code: none`** | **product-visible when built** |
| D-S22 | `aria-live` announcement of a sort change is deferred, by decision — nothing announces it | [`3-ui/cross-cutting/accessibility.md:53`](../../../../3-ui/cross-cutting/accessibility.md), [`3-ui/architecture.md:96`](../../../../3-ui/architecture.md) | n/a — accepted cost | **product-visible gap** |
| D-S23 | A consumer `sortFn` that throws must degrade (that column's sort does not apply), never take the table down | [`adr/0014-runtime-error-policy.md:81`](../../../../adr/0014-runtime-error-policy.md) | **not implemented** — `with-sorting.ts:123` calls `compare(a, b)` unwrapped | **product-visible gap** |

### 2. Decided but not built

| Gap | Status | Source |
|---|---|---|
| `ngpTableSort` directive (the whole UI layer) | `spec: drafted, code: none` | [`status.md:30`](../../../../status.md) |
| `toggleSort(id, { accumulate })` — per-click modifier multi-sort | specced, **unticketed**; "not ticketed" said twice | [`sort.md:115`](../../../../3-ui/directives/sort.md), [`3-ui/architecture.md:95,134`](../../../../3-ui/architecture.md) |
| Multi-sort priority indicator (numbered badges) | open in three docs; elevated 2026-07-21 from "low stakes" to load-bearing, because a modifier+click succeeding is otherwise invisible | [`sorting.md:199`](../../../features/sorting.md), [`sort.md:129`](../../../../3-ui/directives/sort.md), [`3-ui/architecture.md:107`](../../../../3-ui/architecture.md) |
| Initial / default sort state | **no mechanism at all.** `sorting` starts `[]`; no config field seeds it. `applyDefaultSort(path, { direction, index })` is proposed in a reference doc and exists nowhere | `with-sorting.ts:146`; [`tier-3-feature-config.md:30,33-34`](../../../../2-columns/reference/tier-3-feature-config.md) |
| Table-wide `nulls` default (`withSorting({ nulls })`) | open, "not proposed"; the 2026-09-17 plan explicitly leaves it out | [`sorting.md:197`](../../../features/sorting.md); [`1-plan-sorting.md:158`](../per-column-config-placement/1-plan-sorting.md) |
| `isSortable(columnId)` store member | proposed in the plan (step 3) as what a header needs for `aria-sort`/`data-sortable`; does not exist | [`1-plan-sorting.md:105`](../per-column-config-placement/1-plan-sorting.md) |
| `data-sort-direction` host binding ownership | open — directive or consumer? | [`sort.md:130`](../../../../3-ui/directives/sort.md), [`3-ui/architecture.md:104`](../../../../3-ui/architecture.md) |
| Standalone sort-icon component | raised and explicitly parked | [`3-ui/architecture.md:105`](../../../../3-ui/architecture.md) |
| Drag-reorder vs. an active sort | open state-layer question — does drag clear the sort or silently no-op? | [`3-ui/architecture.md:52,84`](../../../../3-ui/architecture.md), [`1-state/architecture.md:205`](../../../architecture.md) |
| Sort-toggle performance budget | no ms figure agreed, no harness | [`0-product/performance.md:100`](../../../../0-product/performance.md) |
| Sort as part of a saved view | `sorting?: SortRule[]` is in the persistence snapshot; `spec: drafted, code: none` | [`state-persistence.md:92`](../../../state-persistence.md) |
| `prefers-reduced-motion` on the FLIP animation | **not mentioned anywhere** in `row-animation.md` | grep for `motion` returns one unrelated hit (`row-animation.md:93`) |
| S1–S9 "what is an empty row" | parked, by an explicit dependency on row-editing's OQ-3 | [`sorting.md:116-172`](../../../features/sorting.md) |

### 3. Contradictions between older docs and newer decisions

**Flagged by the docs themselves** (the safe half):

- [`sort.md:20,104-116`](../../../../3-ui/directives/sort.md) carries its own ⚠ divergence table
  against shipped `withSorting()`, and [`3-ui/architecture.md:95`](../../../../3-ui/architecture.md)
  repeats it as a cross-cutting open question. Correctly flagged in both places.
- The `withColumns()` dependency framing is corrected in-place with a visible banner in
  [`columns.md:156`](../../../columns.md), [`architecture.md:121`](../../../architecture.md) and
  [`sorting.md:186`](../../../features/sorting.md).
- [`adr/0014:136-137`](../../../../adr/0014-runtime-error-policy.md) admits `sortFn`'s wrap is "a
  retrofit, tracked separately — this ADR is not implemented by the filtering work alone", and
  that `sorting.md` "gets that line when next touched". Half-flagged: the admission is in the ADR,
  but `sorting.md` still says nothing about error behaviour.

**Not flagged — the dangerous half:**

| # | Contradiction | Stale side | Wins |
|---|---|---|---|
| C-1 | `sortFn` / `enableSorting` / `applySortNulls` described as the current per-column surface | [`sorting.md:74-86,102-108`](../../../features/sorting.md), [`columns.md:72-73,152`](../../../columns.md), [`prd.md:51,53`](../../../prd.md), [`overview.md`](../../../../overview.md), [`sort.md:113`](../../../../3-ui/directives/sort.md) | [`1-plan-sorting.md`](../per-column-config-placement/1-plan-sorting.md) — all three are deleted and replaced by `withSorting({ sortable, schema })` + `applySorting()`. **Plan approved, not implemented**, so the code still matches the docs today; the docs carry no forward warning |
| C-2 | PRD user story 14 — "click multiple headers in sequence to express priority ordering" — is stated as plain end-user behaviour | [`prd.md:50`](../../../prd.md). A grep for `supersed` / `ADR-0001` in `prd.md` returns **nothing** | [`adr/0001`](../../../../adr/0001-sorting-single-column-default.md) — that behaviour now requires `multi: true`, and ADR-0001 explicitly supersedes "PRD #2 / issue #4". The PRD was never annotated |
| C-3 | A **third**, incompatible per-column API — `applyEnableSorting()`, `applySortFn()`, `applyDefaultSort()`, each with a reactive `{ when }` form | [`tier-3-feature-config.md:25-35`](../../../../2-columns/reference/tier-3-feature-config.md) | Neither shipped code nor the plan. The plan's own finding is the opposite: sortability has "no real reactive case" and becomes a table-level **set**, not a rule ([`1-plan-sorting.md:28,35-40`](../per-column-config-placement/1-plan-sorting.md)). Three named APIs in a permanent reference doc, none of which exist |
| C-4 | ADR-0014 names `sortFn`'s degradation fallback in its policy table as though it were the contract | [`adr/0014:81`](../../../../adr/0014-runtime-error-policy.md) | The code. `with-sorting.ts:123` calls `compare(a, b)` with no `try`. A consumer `sortFn` that throws today blanks the table |
| C-5 | `accessibility.md:86` — "See `sort.md` for the one known limitation carried forward (screen readers not reliably announcing `aria-sort` value changes on their own)" | [`accessibility.md:86`](../../../../3-ui/cross-cutting/accessibility.md) | `sort.md` v0.3 contains no such passage. A dangling cross-reference to content that was dropped or never written |
| C-6 | "Sort × grouping interaction — N/A, grouping doesn't exist yet" | [`gap-analysis.md:49`](../../../../1-state/work/meta/archive/state-feature-competitive-audit/gap-analysis.md) (archived) | Grouping ships with six stories, and S-G1/S-G2 in [`0-product/grouping.md:695-738`](../../../../0-product/grouping.md) answer exactly the bug class that row said to test for later. **Rows 45-48 of that table were re-verified against source and are still accurate**; only row 49 is stale |
| C-7 | `features/sorting.md:194` — "Auto-detection fallback logic needs precise algorithm definition **before implementation**" is still an unchecked open question | [`sorting.md:194`](../../../features/sorting.md) | It shipped. `detectComparator` (`with-sorting.ts:62-80`) is the algorithm, and the source comment there records a deliberate `String()`-not-`.toString()` deviation from the spec's own wording |

**Broken links** (existence-checked on disk today):

| Link | Written as | Actually at |
|---|---|---|
| [`sorting.md:89`](../../../features/sorting.md) null-ordering handoff | `docs/1-state/work/sorting-null-ordering/1-handoff.md` | `docs/1-state/work/sorting/archive/sorting-null-ordering/1-handoff.md` |
| [`sorting.md:210`](../../../features/sorting.md) gap-analysis | `../work/state-feature-competitive-audit/gap-analysis.md` | `../work/meta/archive/state-feature-competitive-audit/gap-analysis.md` |
| [`grouping.md:693,720`](../../../../0-product/grouping.md) — S-G1's own citation | `../1-state/work/with-grouping/research-grouping-community-pain.md` | under `work/grouping/archive/with-grouping/` |
| [`status.md:12`](../../../../status.md) field-vocabulary link | same wrong `state-feature-competitive-audit` path | **`status.md` is generated** — the string is hardcoded at `tools/generate-status.ts:266`. Fix the generator, not the file |

### 4. Where a sorting story is already written somewhere else — link, do not rewrite

Per the convention stated in [`selection.md:581-585`](../../../../0-product/selection.md), a story
belongs to the feature that must change its behaviour, and is **linked, not restated**; that file
keeps owning its coverage mark.

| Story | Lives at | Mark | Why it is sorting's |
|---|---|---|---|
| **S-G1** — sorting by the column I grouped by | [`0-product/grouping.md:697`](../../../../0-product/grouping.md) | ✅ | grouping owns the mark; the dead header does not occur because group order follows first occurrence over sorted rows |
| **S-G2** — sorting rows inside a group while the groups stay put | [`0-product/grouping.md:722`](../../../../0-product/grouping.md) | 🟡 | rows half covered; "groups stay put" needs a `withGrouping({ groupOrder })` + `withSorting()` composition that no story has |
| **S-1** — a row must not move while I am working in it | [`0-product/row-editing.md:564`](../../../../0-product/row-editing.md) | 🟡 | OQ-3 decided 2026-08-27 (hold position for the gated session); **not implemented** — `sorting-editing/` renders the violation on canvas rather than hiding it |
| **S-2** — a blank value sorts somewhere predictable | [`0-product/row-editing.md:595`](../../../../0-product/row-editing.md) | ✅ | `applySortNulls()`; explicitly "tagged to sorting because sorting is what must change" |
| **2.2** — find the row I just added, under a sort | [`0-product/row-editing.md:340`](../../../../0-product/row-editing.md) | ❌ | comparator half fixed by S-2; the row-hold half is OQ-3. row-editing keeps the mark — the person meets it during Add |
| **2.4 / 1.4** — my marks survive a sort | [`0-product/selection.md:324,172`](../../../../0-product/selection.md) | ✅ | **owned by selection, not sorting** — sorting changes nothing, so selection owns it. Consistent with `selection.md` §6 having no "Owned by sorting" section at all |

`filtering.md` §5 likewise has no "Owned by sorting" section. So the whole existing cross-feature
surface for sorting is the six rows above — a new `0-product/sorting.md` §5 should link them and
write nothing new for grouping, row-editing or selection.

### 5. What ships for free

Compose `withSorting()` bare and a person gets, with no further configuration:

- Every column sortable, three-state, single-column replace (`with-sorting.ts:155-166`).
- Correct ordering for `string`, `number` and `Date` columns with no comparator written
  (`with-sorting.ts:62-80`), including columns whose value is reached through a custom `accessor`.
- Blank and null cells at the end, on the same end in both directions, with no crash on a nullable
  `Date` column (`with-sorting.ts:86-125`).
- Stable ties (`with-sorting.ts:128`).
- An `aria-sort`-ready direction lookup (`sortDirections`, `with-sorting.ts:147`).
- Rows that **animate** into their new position — if, and only if, the consumer adds a transition
  rule; `src/row-flip.css` is shipped as that opt-in (`ngp-table-row.directive.ts:20-21`).
- Correct interaction with grouping, filtering and selection by pipeline construction, in any
  composition order (`engine/pipeline.ts`, D-S18).

What does **not** ship for free: any header markup, any sort glyph, `aria-sort` itself, keyboard
activation, a multi-sort affordance, a priority indicator, a screen-reader announcement, an initial
sort, and any degradation if a consumer comparator throws.

### 6. Real story and demo coverage

Four hosts compose `withSorting()`. **All four call it bare — no `multi`, no `manual`, no config
of any kind.** Verified by reading each host's `createTable(...)` call.

| Host | `withSorting()` at | Sortable columns, and how they are wired | What it actually demonstrates |
|---|---|---|---|
| [`grouping/grouping-collapsible/`](../../../../../src/stories/grouping/grouping-collapsible/) | `...-story-host.component.ts:62` | **Every visible column**, in a generic `@for` (`...component.html:52-64`) | The broadest sorting demo in the repo. Columns are `region?: string \| null`, `category`, `rep`, `amount: number`, `closedAt: Date`, `owner` via `accessor` (`fixtures/types.ts:14-21`, `fixtures/schema.ts:31-36`) — so **number, `Date`, plain string and accessor-derived string auto-detection are all exercised here, plus null-last on a nullable string**. The grouped column's button carries a `[title]` explaining the within-group no-op (`html:57-60`) and a "grouped" badge (`html:75-77`) — this is what makes S-G1 ✅ |
| [`row-edit/sorting-editing/`](../../../../../src/stories/row-edit/sorting-editing/) | `...-story-host.component.ts:45` | Two, hand-enumerated: `(click)="table.toggleSort('name')"` and `('dueDate')` (`...component.html:28,44`) | Three-state toggle with a `@switch` glyph (`html:30-40`); derived `aria-sort` (`ts:54-57`); `clearSorting()` behind a "Clear sort" button (`ts:65-67`, toolbar `html:2`); **null-last on `dueDate: string \| null`** — the mock ships two null rows (`sorting-editing.mock.ts:5,8`) and a toolbar button adds a third live (`ts:81-86`). It imports `row-flip.css` (`sorting-editing-flip.css:1`), so this is the one story where **rows visibly animate to their new sorted position**. It also renders the **S-1 failure on canvas** — `row-hold-probe.ts` drives a banner naming the row's index at open vs. now (`html:16-22`), a deliberately failing demo, not an oversight |
| [`row-edit/live-table/`](../../../../../src/stories/row-edit/live-table/) | `...-story-host.component.ts:77` | Two: `name`, `dept` (`...component.html:28,44`) | Sorting under a **no-session live-edit** table, where a field commit is the save. `toAriaSort` helper (`ts:33-44,100-101`). Sorting composed with `withOptimistic()` |
| [`selection/filtering-selection/`](../../../../../src/stories/selection/filtering-selection/) | `...-story-host.component.ts:40` | All, via a `@for` header (`...component.html:49-56`) calling a `toggleSort()` wrapper (`ts:87-89`) | Sorting composed with `withFiltering()` + `withSelection()` — a sort reorders rows and changes no selection ([`selection.md:339`](../../../../0-product/selection.md)) |

**No `src/stories/sorting/` folder exists, and no Storybook title contains "Sorting."** Every
sorting story is filed under another feature's title: `Table / Row Editing` (×2),
`Table / Grouping`, `Table / Selection`. The nearest thing to a sorting story is named
`Sorting × Editing` under Row Editing (`sorting-editing.stories.ts:7,22`).

**Shipped capabilities no story demonstrates at all** — each verified absent by grepping all 119
story files:

| Capability | Demonstrated? | Unit test that does cover it |
|---|---|---|
| `multi: true` — multi-column priority sort | ❌ nowhere | `with-sorting.spec.ts:114,261` |
| `manual: true` — server-side sorting | ❌ nowhere (both server stories are `withFiltering({ manual })`) | `with-sorting.spec.ts:299` |
| A custom `sortFn` | ❌ nowhere | `with-sorting.spec.ts:192,448` |
| `enableSorting: false` — a deliberately dead header | ❌ nowhere | `with-sorting.spec.ts:140` |
| `applySortNulls()` **override** — `order: 'first'` or `emptyString: 'is-empty'` | ❌ nowhere; only the `'last'` default is shown | `with-sorting.spec.ts:355,412,479` |
| `setSorting()` — restoring a saved sort | ❌ nowhere (only `clearSorting()`) | `with-sorting.spec.ts:179` |
| `sortChanged` subscription | ❌ nowhere | `with-sorting.spec.ts:299` |

`with-sorting.spec.ts` carries 27 tests covering all seven — that is real, but it is
**internal-only**: a unit test is not something a person can be shown.

## Synthesis — where they disagree

- **Three specs of the per-column surface exist and no two agree.** Shipped code says `ColumnDef`
  fields plus a metadata-key rule; `tier-3-feature-config.md` says three reactive `apply*()` rules;
  `1-plan-sorting.md` says a table-level `sortable` set plus one `applySorting()` rule. The
  *capability* is identical in all three — which columns sort, how they compare, where blanks land
  — so a product doc must write to the capability and stay out of the spelling fight. It would be a
  mistake to cite `applySortNulls()` by name in a user story; cite the behaviour and let §5 of the
  product doc name whichever API is current.
- **The UI-layer divergence is the real blocker, and it is a product decision wearing an API
  costume.** `sort.md` needs `toggleSort(id, { accumulate })`; `with-sorting.ts` decides `multi`
  once at construction. Underneath: *is multi-sort a table-wide mode the developer picks, or a
  gesture the person performs?* ADR-0001 answered the first (single-column default, `multi: true`
  opt-in); `sort.md` then answered the second (shift+click) without reopening the first. Both are
  "accepted" and they are not the same product. Whoever writes `0-product/sorting.md` has to name
  this, because the priority-indicator question (open in three docs, elevated 2026-07-21) only has
  stakes under the second answer.
- **Coverage marks and demo reality diverge in opposite directions.** S-2 is ✅ and genuinely
  demonstrated. S-G1 is ✅ **incidentally** — grouping-collapsible supplies no `groupOrder`, so the
  dead header never appears; `grouping.md:713-714` is honest that adding one brings it back. Any
  sorting product doc inherits a ✅ that is contingent on a story's configuration, not on a shipped
  guarantee.
- **The null-ordering contract's strength is load-bearing on a decision that has not shipped.**
  `sorting.md:116-124` parks S1–S9 *because* row-editing's OQ-3 holds the edited row's position —
  and OQ-3 is not implemented (`sorting-editing/` renders the violation deliberately). So the
  stated reason nine scenarios stay parked is currently false in code. It is flagged in
  `row-editing.md:589-593` as 🟡 and in the story's own doc comment, which is the honest half; the
  unflagged half is `sorting.md` presenting the dependency as settled.
- **Two error-handling positions coexist in one feature.** `applySortNulls()` registered twice
  throws at construction (correct, per ADR-0014's construction class); a `sortFn` that throws at
  runtime takes the table down (wrong, per the same ADR's runtime class). The feature implements
  half of its own policy. Per this repo's own rule, the absent guard is not precedent — nobody
  specced it.
- **No sorting story exists because sorting was never the subject of one.** Sorting reached four
  stories as the *other* feature in a composition — which is why what is demonstrated is exactly
  the intersection of sorting with grouping, editing and selection, and what is missing is
  everything sorting owns alone: multi-column, server mode, a custom comparator, a dead header, a
  null override. That is the shape of the gap, and it is the argument for a standalone story rather
  than more toggles bolted onto `sorting-editing/`.

## Not researched

- Competitor behaviour, and community complaints about sorting — the other two nodes of this
  fan-out own those.
- GitHub issues #9, #100 and any other open tracker item; only what the repo's own files say about
  them was read. Issue #100's blast-radius numbers are quoted from `1-plan-sorting.md:18-19`, not
  re-measured.
- `apps/site` and `apps/demo` — the audit was scoped to `libs/table`. A sorting demo may exist
  outside it; `row-animation.md:17` references an `apps/demo/src/app/table-demo/` prototype that
  was not opened.
- `with-sorting.spec.ts` bodies beyond their `it(...)` titles, and `engine/pipeline.ts` /
  `engine/grouping.ts` internals beyond confirming the fixed stage order.
- Every archived `work/` plan file mentioning sorting (roughly 40 of the 116 grep hits). Archived
  episodic decisions were sampled, not swept; a superseded decision could still be hiding in one.

## Unverified

- **No test was run, and no story was rendered.** Every "demonstrates X" claim is read from host
  code and fixtures, not from a screen. That `grouping-collapsible/` actually sorts its `Date`
  column correctly is a *strong inference* from `closedAt: Date` + `detectComparator`'s `Date`
  branch, not an observation.
- **Whether `0-product/sorting.md` will appear in `status.md`'s "Story research" column.**
  `generate-status.ts:26,30` says `docs/0-product/*.md` are scanned for `capability:` only, which
  implies `capability: sorting` is sufficient — but the generator body was not read past those
  lines and `npm run table:status` was not run.
- **Whether C-1 is a live risk or a resolved one.** The plan is `status: approved shape … not
  implemented` and dated today. If it lands this week the stale docs self-correct via its step 7;
  if it stalls, five permanent docs describe a surface with a deletion order against it. Which of
  those is true is a scheduling fact nobody in the repo has written down.
- **Whether the FLIP animation respects `prefers-reduced-motion`.** Grep found no handling in
  `row-animation.md` or `row-flip.css`, but only those two files and the row directive's host
  bindings were read — a media query could live in a shared story stylesheet not opened here.
- **C-5's history.** `accessibility.md:86` points at a `sort.md` passage that is absent from v0.3.
  Whether it was removed in a revision or never written cannot be told without git history, which
  was not consulted.

## Sources

| Claim | Source |
|---|---|
| Three-state cycle, single/multi toggle implementation | `libs/table/src/api/features/with-sorting.ts:38-60,155-166` |
| Auto-detect comparator, and its deliberate `String()` deviation | `libs/table/src/api/features/with-sorting.ts:62-80` |
| Empty resolution before the comparator, outside `sign` | `libs/table/src/api/features/with-sorting.ts:116-125` |
| Default `nulls: 'last'`; `''` opt-in | `libs/table/src/api/features/with-sorting.ts:86-96` |
| Sort state initialises to `[]`; `manual` skips the stage | `libs/table/src/api/features/with-sorting.ts:146,179` |
| `[...rows].sort()` — copy, stable ties | `libs/table/src/api/features/with-sorting.ts:128` |
| `compare(a, b)` called unwrapped (ADR-0014 gap) | `libs/table/src/api/features/with-sorting.ts:123` |
| `applySortNulls()` signature and single-writer note | `libs/table/src/schema/column-rules.ts:47-65` |
| `SORT_NULLS` metadata key | `libs/table/src/engine/columns.ts:87-90` |
| `sortFn` / `enableSorting` on `ColumnDef` | `libs/table/src/api/types.ts:80-81` |
| Public exports of `applySortNulls` / `SortNullsOpts` | `libs/table/src/index.ts:47-48` |
| 27 unit tests, incl. every undemonstrated capability | `libs/table/src/api/features/with-sorting.spec.ts:71-570` |
| State-layer contract, parked S1–S9, open questions | `libs/table/docs/1-state/features/sorting.md` |
| Auto-detection still listed as unspecced | `libs/table/docs/1-state/features/sorting.md:194` |
| Broken null-ordering handoff link | `libs/table/docs/1-state/features/sorting.md:89` |
| Broken gap-analysis link | `libs/table/docs/1-state/features/sorting.md:210` |
| Single-column default supersedes PRD #2 / issue #4 | `libs/table/docs/adr/0001-sorting-single-column-default.md` |
| PRD story 14 (multi-header click), unannotated | `libs/table/docs/1-state/prd.md:50` |
| PRD stories 13-19 — the original sorting user stories | `libs/table/docs/1-state/prd.md:49-55` |
| `sortFn` runtime fallback named in the policy table | `libs/table/docs/adr/0014-runtime-error-policy.md:81` |
| ADR-0014 admits the `sortFn` wrap is an untracked retrofit | `libs/table/docs/adr/0014-runtime-error-policy.md:136-137` |
| `ngpTableSort` spec and its own divergence table | `libs/table/docs/3-ui/directives/sort.md:16,104-116` |
| Modifier-key reversal rationale | `libs/table/docs/3-ui/directives/sort.md:24-31` |
| `toggleSort()` per-call options as a cross-cutting open question | `libs/table/docs/3-ui/architecture.md:95` |
| Priority indicator elevated to load-bearing | `libs/table/docs/3-ui/architecture.md:107` |
| `aria-live` sort announcement deferred by decision | `libs/table/docs/3-ui/architecture.md:96` |
| Dangling SR-limitation cross-reference | `libs/table/docs/3-ui/cross-cutting/accessibility.md:86` |
| FLIP animation shipped, off by default | `libs/table/docs/3-ui/directives/row-animation.md:14-22` |
| FLIP host bindings on the row directive | `libs/table/src/directives/ngp-table-row.directive.ts:20-21,33-40` |
| Opt-in transition rule | `libs/table/src/row-flip.css:7-9` |
| Approved plan: `sortable` set + `applySorting()`, deletions | `libs/table/docs/1-state/work/sorting/active/per-column-config-placement/1-plan-sorting.md:28-30,111-116` |
| Sortability-is-a-set rationale and prior art | `libs/table/docs/1-state/work/sorting/active/per-column-config-placement/1-plan-sorting.md:35-50` |
| Plan confirms all four sorting hosts call `withSorting()` bare | `libs/table/docs/1-state/work/sorting/active/per-column-config-placement/1-plan-sorting.md:129-132` |
| Third API shape: `applyEnableSorting` / `applySortFn` / `applyDefaultSort` | `libs/table/docs/2-columns/reference/tier-3-feature-config.md:25-35` |
| Sorting reads core `columns`, not `withColumns()` | `libs/table/docs/1-state/columns.md:152,156` |
| Fixed pipeline order | `libs/table/docs/1-state/architecture.md:146` |
| Drag-reorder vs. active sort, open | `libs/table/docs/1-state/architecture.md:205` |
| `sorting?: SortRule[]` in the persistence snapshot | `libs/table/docs/1-state/state-persistence.md:92` |
| No agreed ms budget for a sort toggle | `libs/table/docs/0-product/performance.md:100` |
| S-G1 ✅ and why the dead header does not occur | `libs/table/docs/0-product/grouping.md:697-720` |
| S-G2 🟡 and the missing `groupOrder` composition | `libs/table/docs/0-product/grouping.md:722-738` |
| S-1 🟡, OQ-3 decided 2026-08-27 | `libs/table/docs/0-product/row-editing.md:564-593` |
| S-2 ✅ | `libs/table/docs/0-product/row-editing.md:595-607` |
| 2.2 ❌ — the added row under a sort | `libs/table/docs/0-product/row-editing.md:340-354` |
| Sorting changes no selection | `libs/table/docs/0-product/selection.md:332,339` |
| Link-don't-restate convention for cross-feature stories | `libs/table/docs/0-product/selection.md:581-585` |
| House template: frontmatter, scope, coverage marks, story table | `libs/table/docs/0-product/filtering.md:1-96` |
| `sorting` row: state drilled/shipped, UI drafted/none, no product doc | `libs/table/docs/status.md:30` |
| `status.md` is generated; product docs scanned for `capability:` | `libs/table/tools/generate-status.ts:3,26,30` |
| Hardcoded broken decisions.md link in the generator | `libs/table/tools/generate-status.ts:266` |
| Stale "grouping doesn't exist yet" row | `libs/table/docs/1-state/work/meta/archive/state-feature-competitive-audit/gap-analysis.md:49` |
| Sorting rows still accurate in that audit | `libs/table/docs/1-state/work/meta/archive/state-feature-competitive-audit/gap-analysis.md:45-48` |
| `grouping-collapsible` composes `withSorting()` bare | `libs/table/src/stories/grouping/grouping-collapsible/grouping-collapsible-story-host.component.ts:62` |
| Every column is a sort button; grouped-column title and badge | `libs/table/src/stories/grouping/grouping-collapsible/grouping-collapsible-story-host.component.html:52-77` |
| Column types: number, `Date`, nullable string, accessor | `libs/table/src/stories/grouping/fixtures/types.ts:14-21` |
| Column defs incl. `owner` accessor | `libs/table/src/stories/grouping/fixtures/schema.ts:31-36` |
| `sorting-editing` composes `withSorting()` + `withRowEdit()` bare | `libs/table/src/stories/row-edit/sorting-editing/sorting-editing-story-host.component.ts:45` |
| `clearSorting()`, blank-row button, `aria-sort` derivation | `libs/table/src/stories/row-edit/sorting-editing/sorting-editing-story-host.component.ts:54-57,65-67,81-86` |
| Two hand-enumerated sort headers with `@switch` glyphs | `libs/table/src/stories/row-edit/sorting-editing/sorting-editing-story-host.component.html:27-58` |
| S-1 violation banner rendered on canvas | `libs/table/src/stories/row-edit/sorting-editing/sorting-editing-story-host.component.html:16-22` |
| Two null `dueDate` rows in the fixture | `libs/table/src/stories/row-edit/sorting-editing/sorting-editing.mock.ts:5,8` |
| FLIP turned on for this story only | `libs/table/src/stories/row-edit/sorting-editing/sorting-editing-flip.css:1` |
| Story filed under the Row Editing title | `libs/table/src/stories/row-edit/sorting-editing/sorting-editing.stories.ts:7,22` |
| `live-table` composes `withSorting()` + `withOptimistic()` bare | `libs/table/src/stories/row-edit/live-table/live-table-story-host.component.ts:77` |
| `toAriaSort` and the two sortable columns | `libs/table/src/stories/row-edit/live-table/live-table-story-host.component.ts:33-44,100-101` |
| `filtering-selection` composes `withSorting()` bare | `libs/table/src/stories/selection/filtering-selection/filtering-selection-story-host.component.ts:40,87-89` |
| Generic `@for` sort header | `libs/table/src/stories/selection/filtering-selection/filtering-selection-story-host.component.html:49-56` |
