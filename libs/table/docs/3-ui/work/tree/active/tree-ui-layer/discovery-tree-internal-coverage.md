# Tree — what main already covers, decides and demonstrates (for #189)

**Date:** 2026-10-01 · **Mode:** internal-coverage

> ⚠ **Supersedes in part** [`0-product/tree.md`](../../../../../0-product/tree.md) (2026-09-27).
> Its story text and acceptance criteria still hold. Its "Covered by" lines, §7 OQ-6 "still
> open", §8 gap tables and §9 are overturned by #166–#170 and #182–#184. Where the two disagree,
> this file and [`decisions/tree.md`](../../../../../decisions/tree.md) TR7–TR46 win.

## Answer

- **Code moved, canvas did not.** All 16 stories in §1–§4 now have shipped code behind them, or
  hold by construction (4.4). The canvas count is still 0 ✅, 2 🟡, 14 ❌, because no story
  composes the new code.
- **One host composes `withTree()`.** That host is `grouping-collapsible/`, with one parent
  (`d4`) and two flat children. Its data-row chevron is written by hand, not
  `ngpTableTreeToggle`. No story has a Tree title, and no host composes `withTree()` with
  `withFiltering()`.
- **Cross-feature.** G-T1 and G-T2 are now visible on that canvas, happy path only (🟡). F-T1,
  F-T2, S-T1 and E-1 are shipped in code with no canvas (❌). G-T3 is ❌: its fixture fix
  landed, but the aggregates host does not compose `withTree()`.
- **#190 overlap.** #190's planned `panel-in-groups/` story would demonstrate E-T1 and the
  panel half of E-G1, so a Tree story should link to it. Its docs carry three stale tree claims
  (§7).
- **Gaps.** 13 of the 17 rows in §8.1/§8.2 are closed in code. The UI layer adds 8
  product-visible stories that `tree.md` has no entry for. A minimal Tree story needs no new
  library work.

## Method and source reliability

- Read on 2026-10-01, in the worktree `feat-189-tree-stories` (fresh `origin/main`, top commit
  `9b036f6`). No git commands were run (no shell available), so "shipped" means **present in
  `src/` on this tree**. It does not mean a merge commit was traced.
- I read the story hosts as `.ts` and `.html`, not their names or `.mdx` files. I listed every
  `*story-host.component.ts` (26) and searched `src/stories` for `withTree(`, `ngpTableTree`,
  `--ngp-table-row-depth` and `data-context-row`.
- Decisions were read from [`decisions/tree.md`](../../../../../decisions/tree.md) (TR1–TR46),
  [`tree-ui-layer/1-decisions.md`](1-decisions.md) (D1–D13),
  [`tree-flat-data/1-decisions.md`](../../../../../1-state/work/tree/active/tree-flat-data/1-decisions.md)
  (D1–D28), and [`decisions/grouping.md`](../../../../../decisions/grouping.md) G78–G80.
- **#190 docs are uncommitted work in another worktree**
  (`feat-190-expansion-detail-panel-story`). I read them read-only on 2026-10-01. Their line
  numbers moved between two of my reads (the file was being edited), so §7 cites sections, not
  lines.
- **Mark vocabulary is ambiguous, so I followed the doc's own example.** `tree.md`'s 🟡 means
  "the mechanism exists but the person's experience of it does not", which describes most rows
  below. But `tree.md` §1.3 already marks a shipped mechanism with no canvas as ❌
  ("`table.tree.state()` ships, but no host renders…"). I followed that example, so a mark here
  is a **canvas** mark. The Code column carries what is built. #190's `expansion.md` uses the
  same convention ("shipped, never shown" stays ❌).
- `docs/status.md` is generated. Its `tree` row (line 39) already reads state
  `drilled/shipped`, UI `drilled/shipped`. Nothing there needs a hand edit.

## Findings

### 1. Story-by-story state on main (§1–§4)

Canvas = something a person can see in Storybook today.

| Story                                        | Code on main                                                                                                                                                                                                     | Decision               | Canvas today                                                                                                                                                                                                                              | Mark (canvas)                          |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 1.1 Rows under their parent, any depth       | Flat-data nesting: `with-tree/nest.ts:99-146` (`nestFlatPool`), depth from `engine/flatten.ts:27-44`                                                                                                             | TR7, TR8               | `grouping-collapsible`: `d4` with `d4-a` and `d4-b`, **flat** `parentId` rows (`fixtures/mock.ts:49-78`), one level deep, nested under three group levels                                                                                 | 🟡 (premise changed: flat, not nested) |
| 1.2 Open/close one parent                    | `toggle` at `with-tree/feature.ts:146-158`; descendants hide in `flatten.ts:42-44`                                                                                                                               | TR33, TR34, TR45       | `grouping-collapsible-story-host.component.html:103-112`: a hand-written button calls `table.tree.toggle(row.id)` with its own `aria-expanded`, **not** `ngpTableTreeToggle`. One level only; restoring a descendant's state is not shown | 🟡                                     |
| 1.3 Open/close everything, tri-state         | `expand()`/`state()` at `feature.ts:169-174`, `207-229`; tri-state `'none'` when nothing is expandable (`feature.ts:212-214`)                                                                                    | TR3, TR12, TR30        | `grouping-collapsible` has Expand all / Collapse all (`grouping-collapsible-toolbar.component.html:2-3`), but Expand all passes `groupIds()` only (`…story-host.component.ts:92-94`), so it never opens `d4`. No tri-state display        | ❌                                     |
| 1.4 Lazy parent                              | `isExpandable` overrides `hasChildren` (`nest.ts:132-134`); appended rows nest on the next evaluation                                                                                                            | TR13, TR35             | none                                                                                                                                                                                                                                      | ❌                                     |
| 2.1 Match never hidden under a closed parent | Derived reveal: `with-tree/reveal.ts:9-37`, folded into `expandedRows` at `feature.ts:259-267` (#169)                                                                                                            | TR22, TR32             | none                                                                                                                                                                                                                                      | ❌                                     |
| 2.2 Close a revealed parent mid-filter       | `feature.ts:146-156` and `reveal.ts:41-49` (`createClosedWhileRevealed`, a `linkedSignal` over context ids)                                                                                                      | TR22(c), TR32          | none                                                                                                                                                                                                                                      | ❌                                     |
| 2.3 Tell a match from a context row          | `RenderRow.isContextRow` stamped at `engine/core.ts:131`; `data-context-row` at `ngp-table-tree-row.directive.ts:16`; dim recipe at [`3-ui/directives/tree.md`](../../../../directives/tree.md) "Styling recipe" | TR21, TR23, TR24, TR42 | none (no story uses `ngpTableTreeRow` on a data row, and no story CSS mentions `data-context-row`)                                                                                                                                        | ❌                                     |
| 2.4 State comes back when the filter clears  | Reveal never writes the open set (`feature.ts:259-267`); the closed set drops ids that stop being context (`reveal.ts:44-48`)                                                                                    | TR22(a)                | none                                                                                                                                                                                                                                      | ❌                                     |
| 2.5 / F-T2 Matched parent's whole branch     | `includeDescendants` at `with-filtering/feature.ts:30`, `96`; `with-filtering/tree-retention.ts:41-54`                                                                                                           | TR10                   | none                                                                                                                                                                                                                                      | ❌                                     |
| 2.6 Toggle only when it shows something      | `hasChildren` counts children in the filtered pool (`nest.ts:132-134`, run over `rows()` at `core.ts:121`); leaf toggle disabled and hidden (`ngp-table-tree-toggle.directive.ts:60-62`)                         | TR13, TR38             | none                                                                                                                                                                                                                                      | ❌                                     |
| 3.1 Count every row                          | `totalRowCount = rows().length` (`engine/compose-table.ts:56`), so collapsed children count; `aria-rowcount` reads it (`ngp-table.directive.ts:22`)                                                              | TR14                   | none (`grouping-collapsible` shows no row count)                                                                                                                                                                                          | ❌                                     |
| 3.2 Sort siblings, families together         | The tree stage nests over its already-sorted input (`nest.ts:94-98`)                                                                                                                                             | TR29, D19              | none (no host composes `withTree()` + `withSorting()`)                                                                                                                                                                                    | ❌                                     |
| 4.1 Parent doesn't exist                     | `engine/tree-links.ts:58-65` (absent → root); reported once per kind by `console.error` (`nest.ts:60-75`)                                                                                                        | TR9                    | none                                                                                                                                                                                                                                      | ❌                                     |
| 4.2 Self-parent / cycle                      | `tree-links.ts:60-62`, `108-128` (the first cycle row in input order becomes the root)                                                                                                                           | TR9                    | none                                                                                                                                                                                                                                      | ❌                                     |
| 4.3 Delete a parent                          | `descendantsOf` at `feature.ts:198-205`; `removeRow(ids[])` at `mutations/row-mutations.ts:45-49`                                                                                                                | TR15                   | none                                                                                                                                                                                                                                      | ❌                                     |
| 4.4 Filter can't see unloaded children       | A limit, true by construction: the filter runs over `data()` only (`tree-retention.ts:13-23`)                                                                                                                    | follows TR13, D19      | none                                                                                                                                                                                                                                      | ❌                                     |

**Tally:** canvas 0 ✅ / 2 🟡 / 14 ❌ (unchanged from `tree.md`). Code: 15 shipped, plus 1 that
holds by construction (4.4).

### 2. Cross-feature stories, owned by other product docs (linked, not restated)

| Id   | Owner doc (current mark there)                                                                                         | Code on main                                                                                                                                                                                      | Canvas today                                                                                                                                                                                                                                 | Proposed mark                   |
| ---- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| F-T1 | [`filtering.md` §5 "Owned by tree"](../../../../../0-product/filtering.md) — ❌, heading still says "(unbuilt — #163)" | `with-filtering/feature.ts:113-125` → `tree-retention.ts:13-69` (#168)                                                                                                                            | none (`client-filtering` and `grouping-selection` do not compose `withTree()`)                                                                                                                                                               | ❌                              |
| F-T2 | same — ❌                                                                                                              | `tree-retention.ts:41-54`                                                                                                                                                                         | none                                                                                                                                                                                                                                         | ❌                              |
| G-T1 | [`grouping.md` §5 "Owned by tree"](../../../../../0-product/grouping.md) — ❌                                          | `with-grouping/feature.ts:168-170` (`treeLinks` getter) → `engine/grouping/clusters.ts:150-156` (root lookup)                                                                                     | **Visible**: in `grouping-collapsible` (levels region/category/rep, `fixtures/schema.ts:71-75`), `d4-b` (rep Ada) sits in `d4`'s Grace group (`fixtures/mock.ts:45-48`). Not called out on canvas; the broken-link failure path is not shown | 🟡                              |
| G-T2 | same — ❌                                                                                                              | buckets include descendants (G78, TR17); the count pill reads `rowsOf` (`grouping-story.pipes.ts:41-48`)                                                                                          | **Visible**: NE / Services / Grace counts 3 in `grouping-collapsible`. Group select-all is not on that canvas                                                                                                                                | 🟡                              |
| G-T3 | same — ❌                                                                                                              | `aggregateFn` gets every node (TR18); fixture `d4` now carries its own amount, 8000 (`fixtures/mock.ts:54`)                                                                                       | none: `grouping-aggregates` does not compose `withTree()`                                                                                                                                                                                    | ❌                              |
| S-T1 | [`selection.md` §6 "Owned by tree"](../../../../../0-product/selection.md) — ❌                                        | `with-selection/utils.ts:14-15` reads `rows()`, which includes children and context rows                                                                                                          | none                                                                                                                                                                                                                                         | ❌                              |
| E-1  | [`row-editing.md` §5 "Owned by expansion"](../../../../../0-product/row-editing.md) — ❌ (ownership disputed, see §7)  | `sourceIndex` resolves from `indexById` over `data()` (`core.ts:102-106`, `130`); G6 closed as impossible ([`1-state/features/tree.md`](../../../../../1-state/features/tree.md) "G6 is closed…") | none (no row-edit host composes `withTree()`)                                                                                                                                                                                                | ❌                              |
| P-T1 | `tree.md` §5 only — ❌                                                                                                 | pagination unbuilt                                                                                                                                                                                | none                                                                                                                                                                                                                                         | ❌                              |
| E-G1 | [`grouping.md` §5 "Owned by expansion"](../../../../../0-product/grouping.md) — ✅                                     | —                                                                                                                                                                                                 | `grouping-collapsible` shows the tree half only; #190 argues the mark should drop to ❌ until a panel story exists (§7)                                                                                                                      | tree half ✅; panel half → #190 |
| E-T1 | #190 `0-product/expansion.md` §4 "Owned by expansion" (uncommitted) — ❌                                               | panel + tree compose with separate state (cited by #190 as `with-expansion.spec.ts:370-398`, not re-read here)                                                                                    | none; planned in #190 `panel-in-groups/`                                                                                                                                                                                                     | ❌ → #190                       |

### 3. Settled decisions since 2026-09-27, one line each

**P** = product-visible (a person can perceive it). **I** = internal-only.

| Id                  | Decision                                                                                                                  | Tag                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| TR7 / TFD D1        | Tree built from flat rows by `parentId`; `null`/`undefined` = root                                                        | P                                                         |
| TR8 / D3            | `childrenAccessor` removed; no flatten helper                                                                             | I                                                         |
| TR9 / D4            | Broken link → row at root, subtree intact, reported once per evaluation                                                   | P (placement) · I (report)                                |
| TR10 / D5           | Filter keeps matches + ancestors; `includeDescendants` keeps branches                                                     | P                                                         |
| TR11 / D6           | Parent link is an engine slot read by filter                                                                              | I                                                         |
| TR12 / D8           | `expand()`/`state()` scan the filtered view; `includeHidden` scans everything                                             | P                                                         |
| TR13 / D9           | Default toggle follows the filtered view; `isExpandable` overrides                                                        | P                                                         |
| TR14 / D11          | Every node counts: `totalRowCount`, `aria-rowcount`, `selectAllIds()`                                                     | P                                                         |
| TR15 / D12          | `descendantsOf` is a read; deletion never cascades on its own                                                             | P                                                         |
| TR16 / D13          | Grouping a tree groups roots only                                                                                         | P                                                         |
| TR17 / D14          | Group count includes descendants                                                                                          | P                                                         |
| TR18 / D15          | `aggregateFn` receives descendants; roll-up vs own value is the consumer's choice                                         | P                                                         |
| TR19, TR20          | Superseded by TR22                                                                                                        | —                                                         |
| TR21 / D18          | `RenderRow.isContextRow`; directive amended by TR23                                                                       | P                                                         |
| TR22 / D20          | Reveal is derived; `revealContextRow`; closed-while-context memory; `contextRowIds()` read                                | P                                                         |
| TR23 / D21          | `data-context-row` lives on `ngpTableTreeRow`, not core                                                                   | I                                                         |
| TR24 / A2           | Context ids are an accumulating engine slot from `withFiltering()`                                                        | I                                                         |
| TR25                | A second `parentLink` claim throws, in production too                                                                     | I                                                         |
| TR26–TR28 / D22–D24 | `ctx` as the factory's second argument; `treeLinks` on `ClusterOpts`                                                      | I                                                         |
| TR29 / D25          | Rows keep input order inside a bucket; the tree stage owns hierarchy order                                                | P (order)                                                 |
| TR30 / D26          | `state(options?)` is a method                                                                                             | I                                                         |
| TR31 / D27          | `StageContext.contextRows?()`                                                                                             | I                                                         |
| TR32 / D28          | `expand`/`set` reopen closed-revealed ids; `collapse` does not; a throwing `revealContextRow` reveals                     | P                                                         |
| TR33 / TUI D1       | Tree UI = `ngpTableTreeRow` + `ngpTableTreeToggle`; the expansion pair narrows to panels                                  | I                                                         |
| TR34 / D2           | Table stays `role="table"`; `aria-expanded` on the button; no row `aria-level`/`aria-expanded`; treegrid is its own issue | P (screen reader)                                         |
| TR35 / D3           | Row hooks `data-expandable`, `data-expanded`                                                                              | I (hook) · P via the recipe                               |
| TR36 / D4           | Toggle is `button` only; whole-row click is consumer `(click)`                                                            | P (keyboard: native Enter/Space, one tab stop per parent) |
| TR37 / D5           | No attribute bound by two directives                                                                                      | I                                                         |
| TR38 / D6           | Leaf toggle: `disabled`, `aria-hidden`, `data-disabled`; width kept                                                       | P                                                         |
| TR39 / D7           | Accessible name is consumer-owned; dev warning when missing                                                               | P (what a screen reader says) · I (warning)               |
| TR40 / D8           | Toggle without `withTree()` throws in dev; inert in production                                                            | I                                                         |
| TR41 / D9           | Core row binds `--ngp-table-row-depth`                                                                                    | P (indentation)                                           |
| TR42 / D10          | No stylesheet; a consumer CSS recipe                                                                                      | P (no default look)                                       |
| TR43 / D11, G80     | Group headers use the tree pair                                                                                           | P (one chevron behavior for groups and rows)              |
| TR44 / D12          | Toggle neither prevents default nor stops propagation; whole-row double-toggle is the consumer's                          | P (if mishandled: click does nothing)                     |
| TR45                | Disabled toggle omits `aria-expanded`                                                                                     | P (screen reader)                                         |
| TR46 / D13          | Nameless warning skips a disabled leaf                                                                                    | I                                                         |
| G78                 | Grouping-side mirror of TR16–TR18, TR26–TR29                                                                              | P                                                         |
| G79                 | Group indentation reads `--ngp-table-row-depth`                                                                           | P                                                         |

### 4. What `tree.md` (and its sibling docs) still say that newer decisions contradict

**Flagged in `tree.md` itself.** These are safe:

- §8.1 S1, S8, S9 struck as "closed by #167".
- §7 OQ-2 and OQ-6 (the directive half) marked resolved.
- §9's decisions-log item struck.

**Not flagged. These are the dangerous half:**

1. **Frontmatter `status`** says "nearly every story depends on the flat-data tree #163 builds".
   It is built. Only the "no host composes `withTree()` with `withFiltering()`" half still holds.
2. **The banner** says `features/tree.md` "describes a tree built from nested children". Now
   `features/tree.md` v1.1 (2026-09-29) describes `parentId`, with a migration section.
3. **§1.1 "Covered by"** says the children come "from **nested** `children` arrays… not rows in
   the table's data… never filtered, never sorted and cannot be edited". The fixture is flat
   (`fixtures/mock.ts:57-77`, `fixtures/types.ts:21`). This also contradicts `tree.md`'s own
   coverage table, which already says "flat children linked by `parentId`".
4. **§2.3 and §7 OQ-6** say `ngpTableTreeRow` "binds only `data-context-row`". TR35 added
   `data-expandable` and `data-expanded` (`ngp-table-tree-row.directive.ts:16-18`).
5. **§3.1 "Covered by"**: "Today children are not rows, so they are missing from every count."
   That is false since #167 (`compose-table.ts:56`).
6. **§3.2 "Covered by"**: "Today children are never sorted (they bypass the pipeline)." Also
   false (`nest.ts:94-98`).
7. **§4.3** names `removeRows([id, …])`. The shipped API is `removeRow(ids[])`
   (`row-mutations.ts:45`). `decisions/tree.md` TR15 repeats the wrong name, while
   `features/tree.md` uses `removeRow`.
8. **§7 OQ-6 "Still open: `aria-level`, indentation, the row toggle → #165"**. All three are
   settled: `aria-level` was **rejected** (TR34), indentation is TR41, the toggle is TR33/TR36.
9. **§8.1 S2–S7 and S10** are still listed as gaps. All are in `src/`. S2: `feature.ts:269`.
   S3: `tree-retention.ts`. S4: `clusters.ts:150-156`. S5: `reveal.ts`. S6: `core.ts:131`,
   `feature.ts:138-140`. S7: `nest.ts:132-134`. S10: `feature.ts:169-174`, `224-229`.
10. **§8.2 intro**: "No UI directive doc covers the tree: `docs/status.md` shows `tree` with no
    UI spec." [`3-ui/directives/tree.md`](../../../../directives/tree.md) exists
    (`spec: drilled`, `code: shipped`), and `status.md:39` shows it.
11. **§8.2 U3**: "No tree UI spec: indentation, `aria-level`, the row toggle". Closed by #182 to
    #184, with `aria-level` rejected rather than built.
12. **§8.2 U5**: "No `ngpTableTreeRow`". Shipped.
13. **§8.2 U1**: "No expand-all / collapse-all control on any canvas". Only partly true:
    `grouping-collapsible` has one for groups (no tri-state, and it never opens `d4`).
14. **§8.2 U2**: "Fixtures (`DealRow.children`, MSW handler, HTTP reviver) are nested and must
    flatten". `stories/**/fixtures/**` contains no `children` at all. The "no tree story" half
    still holds.
15. **§8.3** context-row marking: both the state half and the UI half are shipped.
16. **§9 "Tree UI has no spec"**: closed.
17. **§10 has no entry** for the UI layer's integrator-only behavior: the dev throw (TR40), the
    nameless warning (TR39/TR46), and the broken-link `console.error` (TR9).
18. **§5 "Owned by row editing"** files E-1 under row editing. `row-editing.md` files it under
    "Owned by expansion", and #190's `expansion.md` calls it tree-owned. Three docs give three
    different owners (§7).

**The same staleness in sibling docs (also unflagged):**

- `filtering.md`, `grouping.md` and `selection.md` all head their tree section
  "_(unbuilt — #163)_".
- `filtering.md` F-T1 "Covered by": "Today the filter sees top-level rows only". This is false.
- `grouping.md` G-T1 "Covered by": "today's clustering would place each child by its own value".
  This is false.
- `grouping.md` G-T3: "`d4` (42000 = 25000 + 17000) is a roll-up and would double-count". The
  fixture is now 8000 (`fixtures/mock.ts:54`).
- `grouping.md` E-G1: "the fixture's Services deal carries `children`". It carries flat
  `parentId` children. E-G1's last line still calls the ADR-0012 re-homing "unresolved". It is
  resolved: the data-row chevron is `table.tree.toggle`.
- `selection.md` S-T1 and `row-editing.md` E-1: "Today children are not rows" / "a nested child
  renders no editable field (G6)". Both are false since #167.

**Doc-versus-code drift found along the way (internal-only):**

- `decisions/tree.md` TR7–TR32 still carry Status "decided (#163/#166/#169/#170)", while the
  code is shipped. Only TR1–TR6 say "shipped in".
- `3-ui/directives/tree.md` "Dev checks" and TUI D8 say the missing-`withTree()` throw fires "on
  first render". The code runs `assertTreeComposed` in the **constructor**
  (`ngp-table-tree-toggle.directive.ts:81-83`).
- G79 says group indentation reads `--ngp-table-row-depth`. The story CSS still indents with one
  `[data-depth='N']` selector per depth, 0–5 (`grouping-story.css:12-19`). Its comment (lines
  16-17) still says "a leaf carrying `children`". No file under `src/stories` mentions
  `--ngp-table-row-depth`.

### 5. Stories the UI layer surfaces that `tree.md` has no entry for

All of these are product-visible unless tagged otherwise. Each is decided and shipped, and
none is on a canvas.

| New story                              | What a person experiences                                                                                                                               | Decision · code                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Leaf rows keep alignment               | A leaf's label lines up with its parent's label at the same depth, because the toggle keeps its width but is invisible                                  | TR38 · `ngp-table-tree-toggle.directive.ts:60-62`; recipe `visibility: hidden` |
| No dead tab stops                      | Keyboard users never tab onto a leaf toggle; Enter/Space work on parent toggles (native button)                                                         | TR36, TR38 · same file, `55`, `60`                                             |
| Toggle says what it opens              | A screen reader hears the page's own name for the row ("Children of Engineering, collapsed button"). The library adds no words                          | TR39 · same file, `26-40`                                                      |
| An ordinary table, not a treegrid      | A screen reader announces a table. Rows say nothing about level or open state; only the toggle reports expanded/collapsed. No arrow-key tree navigation | TR34, TR45 · `ngp-table-row.directive.ts:22-29` (no `aria-expanded`)           |
| Indentation at any depth               | Each level is indented by one step, with no per-depth CSS                                                                                               | TR41 · `ngp-table-row.directive.ts:28`                                         |
| Click anywhere on the row (opt-in)     | The page may make the whole row a toggle. If it forgets to skip the button, one click opens and closes again, which looks like nothing happened         | TR36, TR44 · tree UI spec "Whole-row click"                                    |
| Context rows look different            | Dimmed ancestors (the recipe uses `opacity: 0.6`). Closes the UI half of 2.3                                                                            | TR35, TR42 · `ngp-table-tree-row.directive.ts:16`                              |
| Chevron motion respects reduced motion | The rotation animates, except under `prefers-reduced-motion`                                                                                            | TR42 · tree UI spec "Styling recipe"                                           |
| _Not user-facing_ (goes in §10)        | Dev throw without `withTree()`; nameless warning; broken-link `console.error`                                                                           | TR40, TR39/TR46, TR9 — **I**                                                   |

### 6. What shipped code gives a minimal Tree story for free, and what it does not

**Shipped code alone is enough. This is new story work, not library work:**

- **A new flat fixture.** It needs depth ≥ 3, siblings to sort, one absent parent, one
  self-parent and one cycle. The grouping fixture has one parent and no broken links, so it
  cannot carry §4. Put it in `<feature>.mock.ts` per file-organization.
- **The basic tree, with `ngpTableTreeRow` + `ngpTableTreeToggle` and the spec's recipe CSS:**
  1.1, 1.2 (deep restore), 2.6, leaf alignment, indentation, and the a11y rows in §5.
- **A toolbar** with `expand()` / `collapse()` and a tri-state label from `state()`: 1.3. Add
  an `includeHidden` toggle to show D8.
- **`withFiltering()` composed with a text criterion:** 2.1–2.4, F-T1, and the `data-context-row`
  dimming. Add an `includeDescendants` switch for 2.5/F-T2, and a `revealContextRow` example.
- **`withSorting()`:** 3.2. **`totalRowCount()`** shown beside the table: 3.1.
  **`withSelection()` + `selectAllIds()`:** S-T1.
- **Broken-link rows rendered at the top level:** 4.1, 4.2. The page can label them itself,
  because a row whose own `parentId` field is non-null but whose `table.tree.parentOf(id)` is
  `null` is broken. No library read is needed. The library's own report reaches only the
  console.
- **Delete a parent vs delete its branch** via `removeRow(id)` /
  `removeRow([id, ...descendantsOf(id)])`: 4.3.
- **A lazy parent:** `isExpandable` plus appending rows on open: 1.4. The 4.4 limit can be stated
  in the story copy. Repo memory says story hosts orchestrate fetches through
  `injectRowEditApi()`, never a raw fetch. Check that before you write the lazy-load host.

**Leave to #190. Link to it, do not duplicate (§7):** E-T1 (a tree chevron and a panel chevron
on one row), and the panel half of E-G1.

**Needs library or decision work, out of a minimal entry:**

- A per-row "loading children" indicator: OQ-4. Recommended as page-owned, so it is a recipe
  only. This is a decision, not code.
- A screen-reader announcement when a filter reveals rows: U4, an accepted cost.
- Treegrid: row `aria-level`/`aria-expanded`, arrow-key focus (TR34). Its issue is "not yet
  opened" ([`1-decisions.md`](1-decisions.md) Follow-up).
- Pagination counts: P-T1, OQ-3. Pagination is unbuilt.
- Selecting a parent selects its children: OQ-1. A recipe is possible today
  (`select([id, ...descendantsOf(id)])`). A tri-state parent checkbox would need an undecided
  state signal.
- Context marking under server filtering: OQ-5. Undecided.
- Editing a child row (E-1) needs no library work, but it is a heavy composition with
  `withRowEdit()`. It probably belongs in a row-editing story.

### 7. Overlap with #190 (expansion stories): uncommitted, read-only

Sources: #190 worktree `libs/table/docs/0-product/expansion.md` §4, and
`libs/table/docs/3-ui/work/expansion-stories/1-gap-analysis.md` Steps 1–3. Neither file was
edited.

**(a) Tree cross-feature items #190 will demonstrate. Tree stories should link to these, not
repeat them.**

| Item                                                                      | Owner                                                                                                                           | #190 vehicle                                                                                                                   | What it shows                                                                    | Tree story's job                                                                                                                                                                                                   |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| E-T1: panel and child rows on one row, two controls that are not confused | expansion (`expansion.md` §4 "Owned by expansion")                                                                              | Story C `expansion/panel-in-groups/`: `withGrouping()` + `withTree({ parentId })` + `withExpansion()` over `grouping/fixtures` | Tree chevron in the name cell with indent; panel chevron in a leading column     | Link only. No tree story should compose `withExpansion()`                                                                                                                                                          |
| E-G1: panel under a collapsed group (panel half)                          | grouping (`grouping.md` §5)                                                                                                     | same Story C                                                                                                                   | Open a deal's panel, collapse its group: the panel goes with it, then comes back | None. The tree half is already ✅ on `grouping-collapsible`                                                                                                                                                        |
| E-1: editing a child row                                                  | **disputed**: `row-editing.md` says expansion; `tree.md` §5 says row editing; #190 `expansion.md` §4 "Not owned here" says tree | not in #190                                                                                                                    | —                                                                                | Ownership needs one ruling before any story claims it. #190's reason ("filed under expansion only because the heading predates ADR-0012") is right about `row-editing.md`. But `tree.md` does not claim E-1 either |

The chevron placement convention (tree chevron in the name cell, panel chevron in a leading
column) is **#190's convention, not a tree decision**. It does fit the tree recipe: the
toggle's own `margin-inline-start: calc(var(--ngp-table-row-depth) * step)` puts the tree
chevron in a content cell. A Tree story using the recipe will match it without extra work.

**(b) Claims in #190's docs that are stale against main, for tree:**

1. **`1-gap-analysis.md` Step 3**: "No toggle directive ships, so every host binds
   `aria-expanded`/`aria-controls` by hand … the same precedent `grouping-collapsible/` set for
   the tree chevron." This is half stale.
   - It is true **for the panel**: `src/directives/` has no expansion directive.
   - It is false as a description of the tree precedent. `ngpTableTreeToggle` ships
     (`ngp-table-tree-toggle.directive.ts`, exported at `index.ts:12`), and
     `grouping-collapsible` group headers use it (`…story-host.component.html:63-82`) with no
     hand-written `aria-expanded`.
   - Only the **data-row** line-item chevron is still hand-written (`html:103-112`). #183 step 4
     left it out of scope.
   - **Consequence for Story C:** its tree chevron should be `ngpTableTreeToggle` inside
     `ngpTableTreeRow`, not a hand-written copy of the data-row chevron.
2. **`1-gap-analysis.md` Story C** twice says "the deal rows, including the one carrying
   `children`" and "the deal with `children`". The fixture has no `children`. `d4` has flat
   `parentId` children `d4-a` and `d4-b` (`fixtures/mock.ts:49-78`).
3. **`expansion.md` §1.2 Coverage** says the core row's `aria-expanded` binding "is being
   deleted (#182)". It is already deleted on main (`ngp-table-row.directive.ts:22-29` binds no
   `aria-expanded`).
4. **Minor, inside `1-gap-analysis.md`**: the conventions table says the panel chevron goes
   "Leading … matches the tree chevron in `grouping-collapsible/`". Story C then says the tree
   chevron goes in the name cell, apart from the leading panel column. In `grouping-collapsible`
   both chevrons sit in the first rendered column (`isFirst`), which is Region, a content cell
   and not a dedicated leading column. So "matches" overstates it.

Not stale, and consistent with tree: `expansion.md` §4 E-G1 ("evidence is a tree chevron, not a
panel") and OQ-exp-2 (row `aria-expanded` is treegrid-only), which agrees with TR34.

## Synthesis — where the record disagrees with itself

- **Code against canvas.** Every tree decision through TR46 is in `src/`, yet the canvas marks
  are where the 09-27 doc left them. The gap is now one story entry (#189), not library work. A
  re-mark of `tree.md` that changes ❌ to 🟡 on "code shipped" alone would break the doc's own
  §1.3 example and #190's "shipped, never shown" convention. Keep canvas marks, and add a Code
  column.
- **The one tree canvas is behind its own decisions.** `grouping-collapsible` uses the tree pair
  on group headers (TR43). Its data-row chevron is still written by hand, its indentation
  ignores G79/TR41, and its Expand all cannot open `d4`. A person meets two toggle
  implementations in one table. #190 then copies the hand-written one as "precedent".
- **E-1 has three owners on paper.** `row-editing.md` says expansion, `tree.md` says row
  editing, and #190 says tree. Pick one, then link from the other two.
- **Status columns disagree.** `decisions/tree.md` says "decided" for TR7–TR32, while
  `status.md` and the specs say "shipped". The log's Status column is the one that went stale.
- **Product docs disagree with each other.** `tree.md`'s coverage table says flat; its §1.1,
  `grouping.md` E-G1/G-T3 and #190's Story C say nested or roll-up. Re-marking `tree.md` alone
  leaves four sibling docs saying "unbuilt — #163".
- **`aria-level` flipped.** `tree.md` still treats `aria-level` as a gap to fill (U3, OQ-6).
  TR34 rejected it for a `role="table"` disclosure pattern, and #190's OQ-exp-2 agrees. A story
  that tests screen-reader output must assert the TR34 shape.

## Not researched

- Git history and PR state for #166–#170 and #182–#184. No shell was available, so "shipped" =
  present in `src/` on this tree.
- Spec files (`*.spec.ts`). Behavior was read from source only; I did not check whether each TR
  has a test. #190's citation `with-expansion.spec.ts:370-398` was not re-read.
- `apps/site` and any demo app outside `libs/table/src/stories`.
- `.mdx` wrappers, beyond confirming that `grouping.mdx:420-453` describes the collapsible host.
- ADR-0028 has no `Status:` line that I could find. I did not dig further.
- The rest of #190's docs beyond `expansion.md` §1.2, §4 and the header, and gap-analysis
  Steps 1–3.

## Unverified

- **Whether `assertTreeComposed` in the constructor sees the table input as already set.** It
  reads `this.table.ngpTable()` (`ngp-table-tree-toggle.directive.ts:82`). This matters for
  whether the dev throw fires reliably "on first render". I did not run it; a directive spec or
  one manual Storybook check would confirm it.
- **Whether `[style.--ngp-table-row-depth]` renders in a browser.** TUI D9 asked for proof by a
  test, and seam 2 in [`2-spec.md`](2-spec.md) names one. I did not read that spec.
- **G-T1 and G-T2 "visible" on canvas** is inferred from the fixture, the group levels and the
  `rowsOf`-based pipe. It was not observed in a running Storybook.
- **Whether `selectAllIds()` + context rows match `totalRowCount` under a filter.** Both read
  `rows()` (`utils.ts:14`, `compose-table.ts:56`), so they agree by construction. This is an
  inference, not a test.
- **#190 content may still change.** It was uncommitted and being edited while I read it.

## Sources

| Claim                                                                              | Source                                                                                                                                                     |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product doc under review                                                           | `libs/table/docs/0-product/tree.md`                                                                                                                        |
| Tree decision log TR1–TR46                                                         | `libs/table/docs/decisions/tree.md`                                                                                                                        |
| UI decisions D1–D13                                                                | `libs/table/docs/3-ui/work/tree/active/tree-ui-layer/1-decisions.md`                                                                                       |
| UI spec (#165)                                                                     | `libs/table/docs/3-ui/work/tree/active/tree-ui-layer/2-spec.md`                                                                                            |
| #189 placement in the epic                                                         | `libs/table/docs/3-ui/work/tree/active/tree-ui-layer/issue-graph.md`                                                                                       |
| Step 4 left data-row chevron hand-written                                          | `libs/table/docs/3-ui/work/tree/active/tree-ui-layer/4-tasks/issue-183/step-4-grouping-story-host.plan.md`                                                 |
| Flat-data decisions D1–D28                                                         | `libs/table/docs/1-state/work/tree/active/tree-flat-data/1-decisions.md`                                                                                   |
| State spec v1.1                                                                    | `libs/table/docs/1-state/features/tree.md`                                                                                                                 |
| UI directive spec + recipe                                                         | `libs/table/docs/3-ui/directives/tree.md`                                                                                                                  |
| G78–G80                                                                            | `libs/table/docs/decisions/grouping.md`                                                                                                                    |
| Generated status row                                                               | `libs/table/docs/status.md:39`                                                                                                                             |
| F-T1/F-T2 marks                                                                    | `libs/table/docs/0-product/filtering.md:508-557`                                                                                                           |
| G-T1–G-T3 marks                                                                    | `libs/table/docs/0-product/grouping.md:834-900`                                                                                                            |
| E-G1 mark and stale fixture text                                                   | `libs/table/docs/0-product/grouping.md:943-968`                                                                                                            |
| S-T1 mark                                                                          | `libs/table/docs/0-product/selection.md:604-627`                                                                                                           |
| E-1 mark, filed under expansion                                                    | `libs/table/docs/0-product/row-editing.md:701-712`                                                                                                         |
| E-T1, E-1 "tree-owned", E-G1 critique (#190, uncommitted)                          | `C:/Users/dmena/git/ng-table/.claude/worktrees/feat-190-expansion-detail-panel-story/libs/table/docs/0-product/expansion.md` §4                            |
| "#182 is deleting row aria-expanded" (#190)                                        | same file, §1.2 Coverage                                                                                                                                   |
| Story C `panel-in-groups/`, chevron convention, "no toggle directive ships" (#190) | `C:/Users/dmena/git/ng-table/.claude/worktrees/feat-190-expansion-detail-panel-story/libs/table/docs/3-ui/work/expansion-stories/1-gap-analysis.md` Step 3 |
| "Leading … matches the tree chevron" (#190)                                        | same file, "Conventions from peer libraries"                                                                                                               |
| No expansion directive on main                                                     | `libs/table/src/directives/` (glob `*expan*`: no match)                                                                                                    |
| `withTree` toggle/expand/state/reveal/parentLink                                   | `libs/table/src/api/features/with-tree/feature.ts`                                                                                                         |
| Flat nesting, `hasChildren`, reports                                               | `libs/table/src/api/features/with-tree/nest.ts`                                                                                                            |
| Reveal + closed-while-revealed                                                     | `libs/table/src/api/features/with-tree/reveal.ts`                                                                                                          |
| Public tree types                                                                  | `libs/table/src/api/features/with-tree/types.ts`                                                                                                           |
| Broken-link resolution                                                             | `libs/table/src/engine/tree-links.ts`                                                                                                                      |
| Ancestor / descendant retention                                                    | `libs/table/src/api/features/with-filtering/tree-retention.ts`                                                                                             |
| Filter stage wiring, `includeDescendants`, `contextRows`                           | `libs/table/src/api/features/with-filtering/feature.ts`                                                                                                    |
| Grouping reads the parent link                                                     | `libs/table/src/api/features/with-grouping/feature.ts:168-170`                                                                                             |
| Root lookup for grouping                                                           | `libs/table/src/engine/grouping/clusters.ts:150-156`                                                                                                       |
| `isContextRow` stamp, `sourceIndex`                                                | `libs/table/src/engine/core.ts`                                                                                                                            |
| Depth / visibility walk                                                            | `libs/table/src/engine/flatten.ts`                                                                                                                         |
| `totalRowCount`                                                                    | `libs/table/src/engine/compose-table.ts:56`                                                                                                                |
| `aria-rowcount`                                                                    | `libs/table/src/directives/ngp-table.directive.ts:22`                                                                                                      |
| Core row bindings, `--ngp-table-row-depth`, no `aria-expanded`                     | `libs/table/src/directives/ngp-table-row.directive.ts`                                                                                                     |
| Tree row hooks                                                                     | `libs/table/src/directives/ngp-table-tree-row.directive.ts`                                                                                                |
| Tree toggle                                                                        | `libs/table/src/directives/ngp-table-tree-toggle.directive.ts`                                                                                             |
| `selectAllIds`                                                                     | `libs/table/src/api/features/with-selection/utils.ts`                                                                                                      |
| `removeRow(ids[])`                                                                 | `libs/table/src/mutations/row-mutations.ts:44-49`                                                                                                          |
| Public exports                                                                     | `libs/table/src/index.ts:11-12`, `44-47`                                                                                                                   |
| Only tree host                                                                     | `libs/table/src/stories/grouping/grouping-collapsible/grouping-collapsible-story-host.component.ts`                                                        |
| Its template (group pair, hand-written data chevron)                               | `libs/table/src/stories/grouping/grouping-collapsible/grouping-collapsible-story-host.component.html`                                                      |
| Expand/Collapse all buttons                                                        | `libs/table/src/stories/grouping/grouping-collapsible/grouping-collapsible-toolbar.component.html`                                                         |
| Flat fixture, `d4` amounts                                                         | `libs/table/src/stories/grouping/fixtures/mock.ts`                                                                                                         |
| `DealRow.parentId`                                                                 | `libs/table/src/stories/grouping/fixtures/types.ts`                                                                                                        |
| Group levels                                                                       | `libs/table/src/stories/grouping/fixtures/schema.ts:71-79`                                                                                                 |
| Group count pipe                                                                   | `libs/table/src/stories/grouping/grouping-story.pipes.ts:41-48`                                                                                            |
| Per-depth indentation in story CSS                                                 | `libs/table/src/stories/grouping/grouping-story.css:12-19`                                                                                                 |
| Story titles (no Tree entry)                                                       | `title:` lines across `libs/table/src/stories/**/*.stories.ts`                                                                                             |
