---
title: Tree story plan (#189)
type: story-plan
date: 2026-10-01
issue: '#189'
---

# Tree story plan — #189

Which Storybook stories the **tree** capability needs, derived from the product doc against the
story-host code (not the `.mdx`), and grounded in the peer discovery. First plan for this
capability; no prior story plan exists in this work folder.

## Inputs read

| Input                  | Path                                                                                                                                                                                              | Used for                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Product user stories   | [`0-product/tree.md`](../../../../../../../0-product/tree.md) (refreshed 2026-10-01)                                                                                                              | which stories must exist, coverage marks               |
| Peer libraries (UI)    | [`discovery-tree-ui-competitors.md`](../../discovery-tree-ui-competitors.md)                                                                                                                      | what the toggle, indent, leaf look like                |
| End-user products (UI) | [`discovery-tree-ui-products.md`](../../discovery-tree-ui-products.md)                                                                                                                            | chevron placement, bulk control, context parents       |
| Internal coverage      | [`discovery-tree-internal-coverage.md`](../../discovery-tree-internal-coverage.md)                                                                                                                | what `src/` ships, stale marks                         |
| State discovery (#163) | [`tree-flat-data/discovery-*.md`](../../../../../../../1-state/work/tree/active/tree-flat-data/) (filter community, filter competitors, filter internal, grouping competitors, grouping products) | filter retention, descendants, grouping × tree         |
| Tree UI spec           | [`3-ui/directives/tree.md`](../../../../../../directives/tree.md)                                                                                                                                 | directive pair, styling recipe, whole-row click        |
| Story conventions      | [`3-ui/stories.md`](../../../../../../stories.md)                                                                                                                                                 | host shape, "What a host may not contain", mdx, layout |
| State contract         | `src/api/features/with-tree/types.ts`                                                                                                                                                             | `WithTreeConfig`, `TreeSlice` member names             |

## Binding rulings applied

- A story teaches API usage. Degraded-data / error-marking UI is not story content: 4.1 and 4.2
  are left out, and no fixture row carries a broken link, a self-parent or a cycle. (#189's
  issue title still says "broken link"; the title/body should drop it.)
- E-T1 and the panel half of E-G1 belong to #190's planned `expansion/panel-in-groups/`. Link
  only; no tree story composes `withExpansion()`.
- E-1 is left out: tree-owned and closed by #163 (OQ-7, resolved 2026-10-01).
- Fewest stories; extend before adding. Where the settled design deviates from peers (TR44
  bubbling click, TR36 toggle as a Tab stop), the story shows the settled design.

## Conventions from peer libraries

What a person clicks in shipped implementations, and what the stories adopt.

| Affordance                  | Peers                                                                                                                               | Story does                                                                                        | Why                                                              |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Toggle position             | Chevron left of the name, inside the name column (monday, ClickUp, Smartsheet; products §1, synthesis 2)                            | Same — toggle in the `name` cell, before the text                                                 | converged                                                        |
| Indentation                 | One column only (Smartsheet "Primary Column only"; products §2). AG Grid indents via a CSS variable, others inline (competitors §6) | Recipe: toggle's `margin-inline-start` off `--ngp-table-row-depth`, so only the name cell indents | converged + TR41                                                 |
| Leaf alignment              | Four answers; PrimeNG keeps the toggle, `visibility: hidden` (competitors §7)                                                       | Toggle rendered on every row; directive disables a leaf's, recipe hides it                        | TR38 = PrimeNG                                                   |
| Bulk open/close             | Every product ships one (monday ⋯ menu, ClickUp view menu, Smartsheet header menu; products §1)                                     | Toolbar `Expand all` / `Collapse all` + tri-state readout                                         | converged; no table gesture covers it, so not a rule-5 duplicate |
| Toggle as Tab stop          | Grid vendors take it out of Tab (`<span>` / `tabindex=-1`); TanStack keeps a button (competitors §1)                                | Native `<button>`, a Tab stop; leaf skipped                                                       | **deviates — TR36**, no roving focus yet                         |
| `aria-expanded` location    | Row/cell under `treegrid` everywhere (competitors §2)                                                                               | On the button; table stays `role="table"`                                                         | **deviates — TR34**                                              |
| Toggle name                 | Consumer-owned in Material/TanStack; library text in MUI X (competitors §3)                                                         | Page names it: `'Children of ' + name`                                                            | TR39                                                             |
| Toggle click propagation    | MUI X and CDK stop propagation (competitors §5)                                                                                     | Click bubbles; the page's row handler skips the button                                            | **deviates — TR44**                                              |
| Context-parent style        | No primary source styles one (competitors §9, products §5)                                                                          | Recipe dims `[data-context-row]` (`opacity: 0.6`)                                                 | TR42; no peer to follow                                          |
| Match under closed ancestor | Only DevExtreme auto-expands by default (filter competitors)                                                                        | Reveal on by default (#169)                                                                       | TR22                                                             |

## 1. Inventory — what exists

Read from host `.ts`/`.html`. Grep for `withTree(` in `src/stories` hits one host.

| Story                                                                | Composes / configured with                                                                                                                                                                    | Actually demonstrates                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `grouping/grouping-collapsible/` (`Table / Grouping`, `Collapsible`) | `withGrouping({ initial: COLLAPSIBLE_GROUPING_LEVELS })` + `withTree({ parentId: row => row.parentId })` over `GROUPING_ROWS_MOCK`; `httpResource` refetch; `forceFailure` / `latencyMs` args | Group headers open/close via `ngpTableTreeRow` + `ngpTableTreeToggle`, named by the page. One data row (`d4`) with two flat children, one level deep, opened by a **hand-written** `<button>` with its own `aria-expanded` calling `table.tree.toggle(row.id)`. Expand all passes `table.groupIds()` only, so it never opens `d4`; no tri-state. Collapse state survives refetch (success and failure) and resets on regroup. Indentation by per-depth `[data-depth='N']` rules in `grouping-story.css`, not `--ngp-table-row-depth` |
| `filtering/client-filtering/` (`Table / Filtering`, `Client`)        | `withFiltering({ schema: clientInvoiceFilters })` over flat invoices                                                                                                                          | No tree. Reference only: layout of `<story>.filters.ts` beside the host, toolbar component, `form(table.filters().value)`, `totalRowCount()` readout                                                                                                                                                                                                                                                                                                                                                                                 |

No host composes `withTree()` with `withFiltering()`, `withSorting()` or `withSelection()`. No
host renders `ngpTableTreeRow` on a data row, a leaf toggle, or `--ngp-table-row-depth`.

## 2. Cross-reference against the product doc

Mark = canvas today. "→" = the target story below.

| Product story                                | Today                                  | Gap                                                         | →                                                                                                |
| -------------------------------------------- | -------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1.1 Rows under their parent, any depth       | 🟡 — one level, under groups           | Depth ≥ 3, no grouping, flat fixture                        | **Basic**                                                                                        |
| 1.2 Open/close one parent                    | 🟡 — hand-written chevron              | Shipped toggle; deep restore (reopen restores descendants)  | **Basic**                                                                                        |
| 1.3 Open/close everything, tri-state         | ❌ — group-only Expand all             | Row bulk control + `state()` readout                        | **Basic** (failure path "nothing expandable reads none" needs empty data — spec case, not shown) |
| 1.4 Lazy parent                              | ❌                                     | —                                                           | left out                                                                                         |
| 1.5 Labels line up, leaf or not              | ❌                                     | Leaf toggle on canvas at every depth                        | **Basic**                                                                                        |
| 1.6 Groups and rows open/indent the same     | ❌ — `grouping-collapsible/` breaks it | U6 fix in the grouping host                                 | left out → #202                                                                                  |
| 1.7 Keyboard + screen reader                 | 🟡 — group headers only                | Tree rows; leaf not a Tab stop; page-named toggle           | **Basic** (depth announcement unmet by design, TR34/OQ-8)                                        |
| 1.8 Whole-row click, when the page offers it | ❌                                     | Row handler + the skip-the-button guard                     | **RowClick**                                                                                     |
| 1.9 Reduced motion                           | ❌                                     | Recipe's `prefers-reduced-motion` branch on canvas          | **Basic** (via `tree-story.css`; every host loads it)                                            |
| 2.1 Match never hidden under a closed parent | ❌                                     | Filter + default reveal                                     | **Filtered**                                                                                     |
| 2.2 Close a revealed parent mid-filter       | ❌                                     | The same toggle on a context row                            | **Filtered** (no extra code)                                                                     |
| 2.3 Tell a match from a context row          | ❌                                     | `ngpTableTreeRow` + `[data-context-row]` dim                | **Filtered**                                                                                     |
| 2.4 State back when the filter clears        | ❌                                     | Open branches, filter, clear                                | **Filtered** (Clear button + hint)                                                               |
| 2.5 Matched parent's whole branch (F-T2)     | ❌                                     | `includeDescendants` is construction-time                   | left out (filtering)                                                                             |
| 2.6 Toggle only when it shows something      | ❌                                     | A matching parent whose children all miss renders as a leaf | **Filtered** (fixture row)                                                                       |
| 3.1 Count every row                          | ❌                                     | `totalRowCount()` readout unchanged by open/close           | **Filtered** (readout, as in `client-filtering/`)                                                |
| 3.2 Sort siblings, families together         | ❌                                     | —                                                           | left out                                                                                         |
| 4.1 Parent doesn't exist                     | not a story concern                    | —                                                           | left out (ruling)                                                                                |
| 4.2 Self-parent / cycle                      | not a story concern                    | —                                                           | left out (ruling)                                                                                |
| 4.3 Delete a parent                          | ❌                                     | —                                                           | left out                                                                                         |
| 4.4 Filter can't see unloaded children       | ❌ (a limit)                           | —                                                           | left out (with 1.4)                                                                              |
| F-T1 Matching child keeps its path           | ❌ (filtering owns the mark)           | —                                                           | **Filtered** shows it; re-mark in `filtering.md`                                                 |
| F-T2                                         | ❌                                     | —                                                           | left out (= 2.5)                                                                                 |
| G-T1, G-T2                                   | 🟡 on `grouping-collapsible/`          | —                                                           | left out (grouping owns)                                                                         |
| G-T3                                         | ❌                                     | —                                                           | left out (grouping owns)                                                                         |
| S-T1 "Select all" includes children          | ❌                                     | —                                                           | left out (selection owns)                                                                        |
| E-T1, E-G1 panel half                        | ❌                                     | —                                                           | left out → #190 `expansion/panel-in-groups/`                                                     |
| E-1 Editing a child row                      | ❌                                     | —                                                           | left out (tree-owned, closed by #163; OQ-7 resolved)                                             |
| P-T1                                         | ❌                                     | —                                                           | left out (pagination unbuilt)                                                                    |

**Redundancy:** none — there is one tree host. The overlap to avoid is the reverse: the Tree
entry must not re-demonstrate group headers, which `grouping-collapsible/` owns (TR43).

## 3. Target story set

New feature folder `src/stories/tree/`, sidebar `Table / Tree`, separate from Grouping.

```
src/stories/tree/
├── fixtures/
│   ├── types.ts        ← TaskRow { id, parentId: string | null, name, owner, status }
│   ├── mock.ts         ← TREE_ROWS_MOCK (flat, parentId-linked)
│   └── schema.ts       ← treeColumns (createColumns, `name` first) + treeConfig (trackBy 'id')
├── tree-story.css      ← the tree UI spec's styling recipe, verbatim; imported by all three hosts
├── tree.mdx            ← one docs page, `<Meta title="Table / Tree" name="Docs" />`
├── tree-basic/         ← host .ts/.html, tree-basic-toolbar.component.{ts,html}, .stories.ts
├── tree-filtering/     ← host .ts/.html, tree-filtering-toolbar.component.{ts,html},
│                         tree-filtering.filters.ts, .stories.ts
└── tree-row-click/     ← host .ts/.html, tree-row-click.css, .stories.ts
```

Every host: `styleUrls: ['../../styles/story-host.css', '../tree-story.css']` (+ local css for
RowClick); `<tr [ngpTableRow]="row" ngpTableTreeRow>`; the toggle
`<button type="button" ngpTableTreeToggle [attr.aria-label]="'Children of ' + …name">▸</button>`
on **every** row, in the `name` cell, keyed by `column.id === 'name'` (not `$first`). No
hand-written `aria-expanded`, no per-depth CSS, no `@if (row.hasChildren)` around the toggle — the
leaf case is the directive's and the recipe's job (1.5, 2.6).

**Fixture plan.** One flat project plan, ~22 rows, `parentId: string | null`, depth 0–3:
three roots (one a root leaf), a leaf beside a parent at every depth (1.5), siblings at each
level. For **Filtered**, one search term (e.g. "review") that hits (a) a depth-3 leaf under two
non-matching ancestors (2.1, 2.3), (b) a second leaf in another branch (2.2: close one, the other
stays), (c) a parent whose own name matches but none of its children's do (2.6). One branch with
no match exists for the 2.4 "open it first" step. No broken links, self-parents or cycles
(ruling). Plain string cells — no pipes file.

### Basic — `tree-basic/` (export `Basic`)

`createTable(data, treeConfig, withTree({ parentId: (row) => row.parentId, initial: [...] }))`
and nothing else. `initial` seeds one branch open to depth 3 so depth is visible on load. The
one to copy — no second feature, no row handler.

| Product story covered | Covered by                                                                                                                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1                   | **new** — flat fixture nested by `parentId`, depth 0–3, indentation from the recipe                                                                                                                       |
| 1.2                   | **new** — `ngpTableTreeToggle`; hint: open a child, close its parent, reopen → child still open                                                                                                           |
| 1.3                   | **new** — `tree-basic-toolbar` with `expandAll`/`collapseAll` outputs → `table.tree.expand()` / `table.tree.collapse()`; host readout `@switch (table.tree.state())` → "All open / Some open / None open" |
| 1.5                   | **new** — leaf toggles present, `data-disabled`, hidden by the recipe, width kept                                                                                                                         |
| 1.7                   | **new** — native button: Tab reaches parents only, Enter/Space toggle; page-named; hint states the TR34 limit (no depth announced)                                                                        |
| 1.9                   | **new** — `tree-story.css` carries the recipe's reduced-motion branch; mdx says so (OS setting, no control)                                                                                               |

### Filtered — `tree-filtering/` (export `Filtered`)

`withFiltering({ schema: treeFilters })` + `withTree({ parentId })`. `tree-filtering.filters.ts`
beside the host: `name: contains(path.name)`, annotated
`FiltersPath<TaskRow, ColumnValues<TaskRow, typeof treeColumns.columns>>`. Toolbar takes the
Signal Forms field `filterForm.name` and emits `clearFilter` → `table.filters().reset(null)`.
Default reveal only — no `revealContextRow`, no `includeDescendants`. Standalone because it
composes two features and its lesson (context rows) has states a person walks in sequence.

| Product story covered | Covered by                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| 2.1 / F-T1            | **new** — type the term; ancestors of each match are kept and shown open (reveal)                           |
| 2.2                   | **new** — close one revealed parent; keep typing; it stays closed                                           |
| 2.3                   | **new** — recipe's `[ngpTableTreeRow][data-context-row] { opacity: 0.6 }`; matches stay full                |
| 2.4                   | **new** — hint: open a non-matching branch, filter, Clear → that branch is open again, revealed ones closed |
| 2.6                   | **new** — the matching parent with no matching children shows a hidden, inert toggle                        |
| 3.1                   | **new** — host readout `{{ table.totalRowCount() }} rows`; closing a revealed parent does not change it     |

### RowClick — `tree-row-click/` (export `RowClick`, `name: 'Whole-row click'`)

`withTree({ parentId })` only, no toolbar. `<tr … (click)="toggleFromRowClick(row, $event)">`.
The handler is the tree UI spec's guard written out with named booleans: skip when the target is
inside `[ngpTableTreeToggle]` (an `instanceof Element` guard, no `as`), skip a row without
children, else `table.tree.toggle(row.id)`. `tree-row-click.css`: `cursor: pointer` on
`[ngpTableTreeRow][data-expandable]`.

Standalone because the spec's default is **toggle-only**: folding a row handler into `Basic`
would make the opt-in the copied baseline (the "wrong distinction" test, same reason
`grouping.mdx` keeps `Basic` free of scenery). Its lesson is TR44 — the toggle's click bubbles,
so the page guards — which `Basic` cannot show without carrying the handler.

| Product story covered | Covered by                                                                                                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.8                   | **new** — click anywhere on a parent row opens it; the chevron still toggles exactly once; the row handler itself receiving the chevron's click is the proof that other row listeners get it (TR44) |

### `tree.mdx`

`## Basic`, `## Filtered`, `## Whole-row click`, then `## Shared across the three`
(`fixtures/schema.ts`). Each section: one-paragraph _why_, `<Canvas>`, code tabs `TS`, `HTML`,
`CSS` (= `tree-story.css`, as `grouping.mdx` uses `grouping-story.css`), then toolbar `.ts`/`.html`
and `tree-filtering.filters.ts` as filename-labelled extras; RowClick's `CSS` slot is its local
file with `tree-story.css` as an extra. Intro links the tree UI spec
(`3-ui/directives/tree.md`), `grouping-collapsible/` for group headers (1.6), and #190's
`expansion/panel-in-groups/` for a tree chevron beside a panel chevron (E-T1). Check how existing
mdx pages link repo docs before choosing a relative path or a GitHub URL.

## Left out on purpose

| Item                                                   | Why not a story (here)                                                                                                                                                                                                           |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.4 lazy parent, 4.4                                   | Not in #189's floor. Needs a fetch-on-open transport (MSW + resource) and a per-row loading indicator that is still undecided (OQ-4). A standalone candidate later: its states (closed → loading → loaded/failed) are a sequence |
| 1.6 groups vs rows (U6)                                | A fix to `grouping-collapsible/` (hand-written `d4` chevron, per-depth CSS) — grouping's host, not a Tree entry. Tracked as #202                                                                                                 |
| 1.3, filtered half + `includeHidden`                   | Under reveal every visible parent that matters is already open; `expand()`'s filtered-view scope (TR12) is a spec case. Adding the toolbar to `Filtered` would be a second lesson                                                |
| 2.5 / F-T2 `includeDescendants`                        | Filtering owns it; the option is construction-time, so showing it needs a second host (stories.md fixed-mode rule) — a filtering story, not #189                                                                                 |
| `revealContextRow`, `contextRowIds()` rebuild          | Non-default reveal policy (TR22(e)); no product story asks for it. Default reveal only                                                                                                                                           |
| 3.2 sort siblings                                      | Touches no tree API (the tree stage nests over sorted input); composing `withSorting()` adds a second lesson. Same precedent that moved `grouping-crud/` to the spec                                                             |
| 4.1 broken parent, 4.2 cycle                           | Ruled not a story concern (2026-10-01, OQ-9). No fixture rows                                                                                                                                                                    |
| 4.3 delete a parent                                    | Outside the floor; a row-mutation lesson (`removeRow`) whose tree half is one read (`descendantsOf`) — recipe in `1-state/features/tree.md`                                                                                      |
| S-T1 select all                                        | Selection owns it (`selection.md` §6); would compose `withSelection()`                                                                                                                                                           |
| G-T1, G-T2, G-T3                                       | Grouping owns them; G-T1/G-T2 already 🟡 on `grouping-collapsible/`                                                                                                                                                              |
| E-T1, E-G1 panel half                                  | #190's `expansion/panel-in-groups/`. Link from `tree.mdx`; no `withExpansion()` here                                                                                                                                             |
| E-1 edit a child row                                   | Tree-owned, closed by #163 (OQ-7 resolved 2026-10-01)                                                                                                                                                                            |
| P-T1                                                   | Pagination unbuilt (OQ-3)                                                                                                                                                                                                        |
| Depth announcement, arrow keys (1.7 unmet half)        | Treegrid work (TR34), no issue yet                                                                                                                                                                                               |
| Reveal announcement (U4), server-filter context (OQ-5) | Accepted cost / undecided; nothing to show                                                                                                                                                                                       |

## Summary

| Story                                      | Status           | Product stories                    | Why standalone                                                                                    |
| ------------------------------------------ | ---------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| `tree/tree-basic/` — `Basic`               | new              | 1.1, 1.2, 1.3, 1.5, 1.7, 1.9       | Feature baseline; first tree entry, must stay free of a second feature                            |
| `tree/tree-filtering/` — `Filtered`        | new              | 2.1, 2.2, 2.3, 2.4, 2.6, 3.1, F-T1 | Composes `withFiltering()` + `withTree()`; context-row lesson is a sequence of states             |
| `tree/tree-row-click/` — `Whole-row click` | new              | 1.8                                | Opt-in page pattern that contradicts the toggle-only default; bundling would teach it as baseline |
| `grouping/grouping-collapsible/`           | unchanged (here) | G-T1, G-T2, group half of 1.2/1.7  | —                                                                                                 |

**Doc edits this plan owes once the stories ship:** `3-ui/stories.md` (file layout, shared-file
table, reference implementations; also its stale "`grouping-collapsible/` … `withExpansion()`"
line), and re-marks in `0-product/tree.md` (1.1–1.3, 1.5, 1.7–1.9, 2.1–2.4, 2.6, 3.1) and
`0-product/filtering.md` (F-T1).

## Rulings (2026-10-01)

- **`tree-row-click/`** stays its own story (user-approved).
- **OQ-8** — the toggle name carries no level: `'Children of ' + row.data.name`. Depth
  announcement stays treegrid territory (`0-product/tree.md` §9).
- **U6 / 1.6** — the `grouping-collapsible/` fix is
  [#202](https://github.com/DvirMon/ng-table/issues/202) "grouping-collapsible data rows use the
  tree pair + depth variable" (sub of #165), not #189.
- **E-1** — resolved: tree-owned, closed by #163 (OQ-7). Out of #189.
