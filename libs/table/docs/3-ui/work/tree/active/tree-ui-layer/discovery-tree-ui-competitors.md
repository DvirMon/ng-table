# Tree rows in a data table: what does a person click, see and hear?

**Date:** 2026-10-01 · **Mode:** competitor-capabilities

Scope: toggle, indentation, leaf alignment, keyboard, screen reader,
context-row styling, orphan display. Filter semantics and
grouping-vs-tree are out of scope. They are covered in
[`discovery-tree-filter-competitors.md`][prior-filter] and
[`discovery-tree-grouping-competitors.md`][prior-group].
Decision ids (D2, D4, …) refer to [`1-decisions.md`](1-decisions.md).

## Answer

- **Every grid vendor takes the toggle out of the tab order.**
  AG Grid uses a `<span>`, MUI X and the CDK use `tabindex="-1"`.
  Focus sits on a cell or row, and a key on that cell or row
  expands it. Only TanStack, which is headless, leaves a native
  button that you can Tab to. D4 matches TanStack. That holds only
  while ng-table has no roving focus.
- **No vendor puts `aria-expanded` on a button.** AG Grid puts it
  on the row and the cell, MUI X on the row, the CDK on the
  `treeitem`. All of them use `treegrid` or `tree`. PrimeNG keeps
  `role="table"` and still puts `aria-expanded`/`aria-level` on
  rows, which MDN says is invalid. D2's disclosure button is the
  only valid shape under `role="table"`, and no vendor ships it.
- **Three keys expand a row:** Enter (AG Grid), Space (MUI X),
  ArrowRight (PrimeNG, CDK, APG). There is no shared default.
- **Indentation through a CSS variable has one precedent: AG
  Grid.** It uses `--ag-indentation-level` × indent size. MUI X,
  the CDK and TanStack's example write inline px or rem per row.
  This backs D9.
- **Orphans:** AG Grid moves them to the root and logs warning
  #271. MUI X creates the missing ancestors. TanStack, PrimeNG and
  the CDK nested tree cannot produce an orphan, because their
  input is nested.

## Method and source reliability

Read 2026-10-01 over WebFetch, plus local reads of installed
packages. Nothing was installed and nothing was run.

| Library                          | Pin                                                    | Pin source                                           | What was read                                                                                                                                 |
| -------------------------------- | ------------------------------------------------------ | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| AG Grid Enterprise               | 36.2.0                                                 | `registry.npmjs.org/ag-grid-community/latest`        | docs `.mdoc` and source at tag `b36.2.0`                                                                                                      |
| MUI X Data Grid Pro              | 9.14.0                                                 | `registry.npmjs.org/@mui/x-data-grid-pro/latest`     | docs `.md` and source at tag `v9.14.0`                                                                                                        |
| TanStack Table                   | 8.21.3 (guide, example, source); registry latest 9.2.4 | `registry.npmjs.org/@tanstack/table-core/latest`     | v8 docs/example at tag `v8.21.3`, v8 `src/` on unpkg. Only `package.json` was read for v9                                                     |
| PrimeNG TreeTable                | 22.1.2                                                 | registry `latest`, and the docs page shows 22.1.2    | docs page, `types/*.d.ts` on unpkg, style file on **`master` (unpinned)**                                                                     |
| Angular CDK tree / Material tree | 22.1.7                                                 | `node_modules/@angular/cdk/package.json` (installed) | `fesm2022/tree.mjs` and `_tree-key-manager-chunk.mjs` from **node_modules**; docs and examples from branch **`22.1.x`** (a branch, not a tag) |

Reliability notes:

- **PrimeNG pin moved.** The sibling docs pinned 22.1.1. Registry
  latest is now 22.1.2. Claims here are from 22.1.2.
- **PrimeNG source could not be read past truncation.**
  `primeng-treetable.mjs` and `treetable.ts` (151 KB) both cut off
  before `TreeTableToggler`/`TTRow`. Those cells cite the 22.1.2
  `.d.ts` member names plus the docs page. A member's _name and
  type_ are confirmed. Its _body_ is not, and that is marked
  Unverified.
- **A WebFetch summary is not the artifact.** Every source quote
  below was requested verbatim. One summary said MUI renders "no
  placeholder" for leaves. The verbatim JSX contradicted it: the
  wrapper div always renders. The JSX is what is cited.
- **The CDK was read from `node_modules`, not unpkg.** Line numbers
  are from the installed `22.1.7` files. The unpkg URLs in Sources
  point at the same published artifact.
- **Line numbers are cited only for local reads.** For remote
  source, the method name is cited.
- **Angular Material has no tree table.** Its row is a `mat-tree`
  node, not a table row. It is in the survey as the Angular
  reference for toggle, padding and keyboard, not as a
  table-with-tree competitor.

## Synthesis — where they disagree

### 1. Is the toggle a tab stop?

|                | Tab stop?                               | Element                                           | Cite                  |
| -------------- | --------------------------------------- | ------------------------------------------------- | --------------------- |
| AG Grid        | **No.** A `<span>` icon                 | `span.ag-group-expanded` / `.ag-group-contracted` | [ag-gcr]              |
| MUI X          | **No.** `tabIndex={-1}`                 | `baseIconButton` (a real button)                  | [mui-cell]            |
| CDK / Material | **No.** Host attribute `tabindex: "-1"` | any host, `[cdkTreeNodeToggle]`                   | [cdk-tree] L1456-1464 |
| PrimeNG        | Unverified                              | `p-treetable-toggler`                             | [png-dts]             |
| TanStack       | **Yes.** The consumer's `<button>`      | plain `<button>` in the guide                     | [ts-guide]            |

- The three libraries with a roving-focus model all keep the
  toggle out of Tab. Focus goes to the cell (AG Grid, MUI X) or
  the tree item (CDK). Because of that, the toggle never needs its
  own focus stop.
- **Implication for D4:** a native, tabbable
  `button[ngpTableTreeToggle]` is right while ng-table's table has
  no roving focus. The treegrid follow-up (D2) changes that. Every
  vendor that adopted a grid/tree focus model set the toggle to
  `tabindex="-1"`. Record that now as a consequence of the
  treegrid ADR.

### 2. Where does the expanded state live, and what is the role?

|           | Container role                          | `aria-expanded` on                         | `aria-level`                                          | Cite                                   |
| --------- | --------------------------------------- | ------------------------------------------ | ----------------------------------------------------- | -------------------------------------- |
| AG Grid   | `treegrid` (tree data and row grouping) | row **and** group cell                     | stated in docs; setter not found                      | [ag-a11y], [ag-rowctrl], [ag-gcr-ctrl] |
| MUI X Pro | `treegrid` only when `treeData`         | row, only when `filteredChildrenCount > 0` | row, `depth + 1`; plus `aria-setsize`/`aria-posinset` | [mui-aria], [mui-row-aria]             |
| PrimeNG   | **`table`**                             | row (`ttRow`)                              | row (`ttRow`)                                         | [png-doc]                              |
| CDK tree  | `tree`                                  | `treeitem`, `null` when not expandable     | `level + 1`; plus setsize/posinset                    | [cdk-tree] L1123-1127, L1005-1010      |
| TanStack  | — (headless)                            | —                                          | —                                                     | [ts-guide]                             |

- APG allows either one: "aria-expanded state set on either the
  row element or on a cell contained in the row" [apg-tg]. AG Grid
  sets both.
- **PrimeNG is the counter-example D2 avoided.** It keeps
  `role="table"` and still puts `aria-expanded` on rows. MDN: "This
  is not the case for an ordinary table or grid, in which the
  `aria-expanded` attribute is not present" [mdn-row].
- **No vendor uses a disclosure button.** D2 (`aria-expanded` on
  the toggle button, `role="table"` kept) has no shipped
  precedent. It is the only shape that is valid ARIA without
  taking on treegrid's keyboard contract. That makes it a reasoned
  outlier, not a copy of anyone.
- **What a screen-reader user loses under D2:** depth. MUI X and
  the CDK announce level and position ("level 2, 3 of 5") through
  `aria-level`/`aria-setsize`/`aria-posinset`. D2 sends depth out
  as `data-depth` only, so nothing announces it. This is an
  inference from the attribute sets, not a screen-reader test.

### 3. Who names the toggle, and does the name carry state?

|                  | Name                                                               | Supplied by                                             | Cite                     |
| ---------------- | ------------------------------------------------------------------ | ------------------------------------------------------- | ------------------------ |
| MUI X            | "see children" / "hide children" (changes with state)              | library locale keys `treeDataExpand`/`treeDataCollapse` | [mui-cell], [mui-locale] |
| PrimeNG          | `toggleButtonAriaLabel` getter                                     | library (text unverified)                               | [png-dts]                |
| Material example | `'Toggle ' + node.name` (does not change)                          | consumer                                                | [mat-ex]                 |
| AG Grid          | none on the icon (not focusable); the cell carries `aria-expanded` | —                                                       | [ag-gcr], [ag-gcr-ctrl]  |
| TanStack         | consumer; the guide uses emoji `👇`/`👉`                           | consumer                                                | [ts-guide]               |

- MUI X's label changes with state. On MUI X this does not double
  the announcement, because the button itself carries no
  `aria-expanded` (it is on the row).
- **D7 (consumer-owned name) matches the Material example.** D7's
  reason (state is announced twice) applies because D2 puts
  `aria-expanded` on the same button. MUI X's state-changing label
  would be wrong there.

### 4. Which key expands a row?

|              | Expand / collapse key                                                                     | Other                                                                 | Cite                    |
| ------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------- |
| AG Grid      | **Enter** on the focused group cell (`suppressEnterExpand`)                               | double-click on the cell, on by default (`suppressDoubleClickExpand`) | [ag-kbd], [ag-gcr-ctrl] |
| MUI X        | **Space** on the focused grouping cell                                                    | Ctrl+Enter is the detail panel, not the tree                          | [mui-a11y]              |
| PrimeNG      | **ArrowRight / ArrowLeft** on the row                                                     | Up/Down/Home/End; Enter/Space select the row                          | [png-doc], [png-dts]    |
| CDK tree     | **ArrowRight / ArrowLeft** (swapped in RTL)                                               | `*` expands siblings; Enter/Space _activate_ the item; typeahead      | [cdk-tkm] L73-110       |
| CDK toggle   | Enter / Space on the toggle host                                                          | `preventDefault` on both                                              | [cdk-tree] L1456-1464   |
| APG treegrid | ArrowRight on a collapsed row; Enter on the first `aria-expanded` cell in cell-only focus | —                                                                     | [apg-tg]                |

- Three libraries, three different expand keys. The APG answer
  (arrows) is the one the two tree-shaped libraries use (PrimeNG,
  CDK). The two grids, AG Grid and MUI X, picked an activation key
  instead, because ArrowRight already moves between cells there.
- **Implication:** under D4 a native button gives Enter **and**
  Space for free, which covers both grid conventions. Arrow keys
  belong to the treegrid follow-up.

### 5. Whole-row click and event propagation

|            | Whole-row / whole-cell trigger                                           | Does the toggle stop propagation?                       | Cite                            |
| ---------- | ------------------------------------------------------------------------ | ------------------------------------------------------- | ------------------------------- |
| AG Grid    | double-click on the group cell (default on)                              | double-clicks on the icons themselves are ignored       | [ag-gcr-ctrl]                   |
| MUI X      | none shipped                                                             | **yes**: `event.stopPropagation()`, then `setCellFocus` | [mui-cell]                      |
| CDK toggle | the example puts `matTreeNodeToggle` on **both** the node and the button | **yes**: `event.stopPropagation()`, then `focusItem`    | [cdk-tree] L1434-1438, [mat-ex] |
| TanStack   | consumer                                                                 | consumer                                                | [ts-guide]                      |

- **D12 disagrees with both MUI X and the CDK.** D12 leaves the
  bubble to the consumer. Both vendors that ship a toggle stop it.
  The Material example stacks a whole-node toggle with a button
  toggle and relies on that stop to avoid the double toggle D12
  describes.
- Both vendors also **move focus back to the row or cell** after
  a click. That only matters with roving focus, so it belongs with
  the treegrid follow-up.

### 6. Indentation: mechanism and step

|                  | Mechanism                                                                                             | Step                                                                                                        | Applied to                        | Cite                                |
| ---------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------- | ----------------------------------- |
| AG Grid          | **CSS variable**: `padding-left: calc(var(--ag-indentation-level) * var(--ag-row-group-indent-size))` | `--ag-row-group-indent-size: calc(var(--ag-cell-widget-spacing) + var(--ag-icon-size))`, one toggle's width | cell wrapper (`.ag-cell-wrapper`) | [ag-css], [ag-theme], [ag-gcr-ctrl] |
| MUI X            | inline `marginLeft: vars.spacing(rowNode.depth * offsetMultiplier)`, `offsetMultiplier` default 2     | 2 spacing units                                                                                             | grouping cell root                | [mui-cell]                          |
| CDK              | inline `paddingLeft`/`paddingRight` (follows `dir`)                                                   | `_indent = 40`, `px`, settable with `cdkTreeNodePaddingIndent`                                              | tree node                         | [cdk-tree] L1340-1365               |
| PrimeNG          | `togglerMarginStart` getter (string)                                                                  | unverified                                                                                                  | the toggler                       | [png-dts]                           |
| TanStack example | inline `paddingLeft: \`${row.depth \* 2}rem\``                                                        | 2rem                                                                                                        | first cell                        | [ts-ex]                             |

- **Only AG Grid indents through a CSS variable.** It also sets an
  `ag-row-level-N` class per row [ag-rowctrl]. That is the same
  pair as D9's `--ngp-table-row-depth` plus `data-depth`. The
  other three write an inline style, which ng-table's
  no-inline-styles invariant rules out.
- **AG Grid's step equals the toggle's width.** So each child's
  toggle starts where its parent's label starts. That is a
  ready-made default for the Styling recipe (D10).
- Only the CDK switches sides for RTL in code [cdk-tree] L1359.
  AG Grid's rule is written as `padding-left`. Whether AG Grid
  overrides it for RTL was not read (see Unverified).

### 7. Leaf alignment: what fills the toggle's space on a leaf?

|                  | Leaf mechanism                                                                                                                                  | In the accessibility tree?                     | Cite                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------ |
| AG Grid          | icons hidden; a **margin spacer** class `.ag-row-group-leaf-indent { margin-left: calc(var(--ag-cell-widget-spacing) + var(--ag-icon-size)) }`  | no element                                     | [ag-gcr-ctrl], [ag-css]  |
| MUI X            | a **fixed-width empty wrapper**: `flex: '0 0 28px'`, `marginRight: vars.spacing(2)`; the button renders only when `filteredDescendantCount > 0` | no element                                     | [mui-cell], [mui-styles] |
| PrimeNG          | the toggler stays, `togglerVisibility: "hidden" \| "visible"`                                                                                   | hidden by `visibility` (inference)             | [png-dts]                |
| Material example | a **visible disabled button**: "use a disabled button to provide padding for tree leaf"                                                         | yes, as a disabled, unnamed button (inference) | [mat-ex]                 |
| TanStack example | a glyph `'🔵'`                                                                                                                                  | as text                                        | [ts-ex]                  |

- Four answers. **D6 matches PrimeNG** (keep the element, hide it
  with `visibility`), plus `aria-hidden` and `disabled`. AG Grid
  and MUI X render nothing focusable on a leaf. The Material
  example leaves an unnamed disabled button in the accessibility
  tree, which D6 avoids.
- `visibility: hidden` already removes an element from the
  accessibility tree. So D6's `aria-hidden` is redundant if the
  recipe's rule applies, and it protects the case where the
  consumer's CSS does not apply. That is an inference.

### 8. A parent with no visible children

- **MUI X turns it into a leaf.** The toggle renders only when
  `filteredDescendantCount > 0` [mui-cell]. The row's
  `aria-expanded` also needs `filteredChildrenCount > 0`
  [mui-row-aria]. A parent whose children are all filtered out
  loses both.
- **AG Grid keys on `isExpandable()`** of the displayed node, not
  on visible children [ag-gcr-ctrl]. How that resolves under a
  filter was not traced.
- **Lazy "expandable but not loaded":** PrimeNG
  `leaf?: boolean`, "Specifies if the node has children. Used in
  lazy loading" [png-api]. TanStack `getRowCanExpand` overrides
  the `subRows` check [ts-guide]. CDK `isExpandable` is an input
  [cdk-tree]. All three separate "can expand" from "has children",
  the same split D3 makes with `data-expandable`.

### 9. Context (ancestor-of-match) rows

- **No new evidence. Still no vendor styles them.** See the
  sibling doc's Axis 6 [prior-filter]. Nothing read for this
  survey (toggle, row and cell source in all five libraries) sets
  a context-specific class, attribute or ARIA state.
- ng-table's `data-context-row` hook has no vendor counterpart in
  the DOM. Syncfusion's `hasFilteredChildRecords` is a data flag,
  not an attribute [prior-filter].

### 10. Orphans (`parentId` points at nothing)

|                                   | What a person sees                                                                                                                                                                                                                                              | Cite                             |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| AG Grid (`treeDataParentIdField`) | **Row at the root**, plus a console warning: "Parent row not found for row with id=… and parent id=…. Showing row with id=… as a root-level node." (#271). A cycle also moves rows to the root (#270). The docs only say "missing parent rows are not allowed". | [ag-tgs], [ag-err], [ag-selfref] |
| MUI X (`getTreeDataPath`)         | **The missing ancestors are created:** "the Data Grid Pro will automatically create the rows needed to fill the gaps"                                                                                                                                           | [mui-td]                         |
| TanStack                          | Cannot occur. `getSubRows` nests, and the parent is passed by reference, never looked up by id                                                                                                                                                                  | [ts-core]                        |
| PrimeNG                           | Cannot occur. `TreeNode.children` nests                                                                                                                                                                                                                         | [png-api]                        |
| CDK tree (`childrenAccessor`)     | Cannot occur in the nested form. The `levelAccessor` flat form was not read                                                                                                                                                                                     | [cdk-tree]                       |

- **Two answers where input is flat.** AG Grid says "not allowed"
  in its docs but then promotes the row to the root and warns.
  MUI X invents the parent. Neither hides the row.
- AG Grid's code and docs disagree. The docs say "not allowed",
  the code degrades and reports. The code matches ng-table's
  runtime-error rule (degrade, keep the row visible, report).
- Compare the sibling doc's filter orphans [prior-filter]:
  Syncfusion promotes them to the root as well. So "show at root"
  is the most common answer to both kinds of orphan.

### 11. Paywall

|                | Tree UI tier                                                                                                    | Cite                                     |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| AG Grid        | Enterprise. Tree data and self-referential data are marked enterprise                                           | [ag-selfref], [prior-filter] (ag-td)     |
| MUI X          | **Pro.** The `treegrid` role and the row `aria-level`/`aria-expanded` live in the `x-data-grid-pro` package     | [mui-td], [mui-aria], [mui-row-aria]     |
| TanStack       | MIT                                                                                                             | [ts-lic]                                 |
| PrimeNG 22.1.2 | Whole package. PrimeUI "Community License (Free)" under $1M revenue, <5 developers, <10 employees, <$3M funding | [png-lic]                                |
| Angular CDK    | MIT                                                                                                             | `node_modules/@angular/cdk/package.json` |

- **On MUI X, tree accessibility is a paid feature.** The ARIA
  hooks sit in the Pro package next to tree data, so the free grid
  has no tree semantics to turn on. AG Grid meters the same way,
  by feature. PrimeNG meters the whole package by company size.

## Findings — matrix

Each cell carries its own citation. Detail and quotes are in the
Synthesis tables above.

| Axis                        | AG Grid 36.2.0                              | MUI X Pro 9.14.0                      | TanStack 8.21.3                  | PrimeNG 22.1.2                  | CDK/Material 22.1.7                          |
| --------------------------- | ------------------------------------------- | ------------------------------------- | -------------------------------- | ------------------------------- | -------------------------------------------- |
| Toggle element              | `<span>` icon [ag-gcr]                      | IconButton [mui-cell]                 | consumer `<button>` [ts-guide]   | `p-treetable-toggler` [png-dts] | `[cdkTreeNodeToggle]` on any host [cdk-tree] |
| Toggle tab stop             | no [ag-gcr]                                 | no, `-1` [mui-cell]                   | yes [ts-guide]                   | unverified                      | no, `-1` [cdk-tree]                          |
| Container role              | `treegrid` [ag-a11y]                        | `treegrid` [mui-aria]                 | —                                | `table` [png-doc]               | `tree` [cdk-tree]                            |
| `aria-expanded` on          | row + cell [ag-rowctrl], [ag-gcr-ctrl]      | row [mui-row-aria]                    | —                                | row [png-doc]                   | treeitem [cdk-tree]                          |
| `aria-level`                | yes (docs) [ag-a11y]                        | `depth+1` [mui-row-aria]              | —                                | row [png-doc]                   | `level+1` [cdk-tree]                         |
| Toggle name                 | none [ag-gcr-ctrl]                          | "see/hide children" [mui-locale]      | consumer [ts-guide]              | library getter [png-dts]        | consumer [mat-ex]                            |
| Expand key                  | Enter [ag-kbd]                              | Space [mui-a11y]                      | consumer                         | ArrowRight [png-doc]            | ArrowRight [cdk-tkm]                         |
| Mouse                       | icon click, cell double-click [ag-gcr-ctrl] | button click, stops bubble [mui-cell] | consumer [ts-guide]              | toggler click [png-dts]         | toggle click, stops bubble [cdk-tree]        |
| Indent mechanism            | CSS var × size [ag-css]                     | inline margin [mui-cell]              | inline padding (example) [ts-ex] | toggler margin [png-dts]        | inline padding, 40px [cdk-tree]              |
| Leaf alignment              | margin spacer [ag-css]                      | 28px empty wrapper [mui-styles]       | glyph (example) [ts-ex]          | `visibility` [png-dts]          | disabled button (example) [mat-ex]           |
| Parent, no visible children | `isExpandable()` [ag-gcr-ctrl]              | toggle hidden [mui-cell]              | `getRowCanExpand` [ts-guide]     | `leaf` flag [png-api]           | `isExpandable` input [cdk-tree]              |
| Context-row style           | none [prior-filter]                         | none (count only) [prior-filter]      | —                                | none [prior-filter]             | n/a                                          |
| Orphan                      | root + warn [ag-tgs], [ag-err]              | ancestors created [mui-td]            | impossible [ts-core]             | impossible [png-api]            | impossible (nested) [cdk-tree]               |
| Tier                        | Enterprise [ag-selfref]                     | Pro [mui-td]                          | MIT [ts-lic]                     | PrimeUI licence [png-lic]       | MIT (local `package.json`)                   |

## Not researched

- Screen-reader output (NVDA/JAWS/VoiceOver). Every announcement
  claim comes from attribute sets, not from listening.
- Community pain on any of these axes. That is the sibling
  `community-pain` node.
- AG Grid server-side tree data (`isServerSideGroup`), MUI X
  `dataSource` lazy children.
- CDK `levelAccessor` flat-tree behavior when a level skips (the
  flat-input orphan case).
- Kendo, DevExtreme and Syncfusion tree UI. They are outside the
  requested set.
- RTL beyond the CDK.
- Touch: hit-area sizes, swipe.
- Angular Material demand for a tree table. One web search found
  no relevant `angular/components` issue (the two hits were
  unrelated), and it was not pursued.

## Unverified

- **PrimeNG toggler body:** the `togglerMarginStart` value
  (px per level), the `togglerVisibility` condition, the
  `toggleButtonAriaLabel` text and locale key, and the toggler's
  `tabindex`. Only the names and types are confirmed [png-dts].
  Would confirm: the `TreeTableToggler` template in
  `primeng@22.1.2/fesm2022/primeng-treetable.mjs`, read locally
  or by a non-truncating fetch.
- **PrimeNG row focus:** whether ArrowRight moves focus into the
  toggler. `focusSiblingToggler` exists [png-dts]; its body was not
  read.
- **AG Grid `aria-level`:** the docs say it is announced
  [ag-a11y], but neither `rowCtrl.ts` nor `rowComp.ts` sets it
  [ag-rowctrl]. The setter was not found.
- **AG Grid warning #271 in production:** whether it prints
  without the validation module was not checked.
- **AG Grid RTL indentation:** the rule is `padding-left`. An RTL
  override was not searched for.
- **MUI X default spacing unit:** `vars.spacing(2)` is "16px" only
  under the default 8px theme spacing. That is not read from
  source here.
- **TanStack v9:** the guide and example are v8.21.3. v9
  equivalents were not read.
- **Material example as intended pattern:** `components-examples`
  is citable evidence of intended usage (sources file note). Read
  from branch `22.1.x`, so it is unpinned.

## Sources

| Ref          | Claim it supports                                                                                                                             | URL                                                                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| ag-gcr-ctrl  | indent class/var, leaf-indent condition, `isExpandable()`, Enter + double-click defaults, cell `aria-expanded`, child count                   | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-enterprise/src/rowHierarchy/rendering/groupCellRendererCtrl.ts            |
| ag-gcr       | toggle icons are `<span>`, no tabindex/role/label                                                                                             | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-enterprise/src/rowHierarchy/rendering/groupCellRenderer.ts                |
| ag-css       | `padding-left: calc(var(--ag-indentation-level) * …)`, `.ag-row-group-leaf-indent`                                                            | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/theming/core/css/_grid-layout.css                           |
| ag-theme     | `--ag-row-group-indent-size` = spacing + icon size                                                                                            | https://unpkg.com/ag-grid-community@36.2.0/styles/ag-grid.css                                                                                        |
| ag-rowctrl   | row `aria-expanded` when expandable; `ag-row-level-N`; no `aria-level`                                                                        | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/rendering/row/rowCtrl.ts                                    |
| ag-a11y      | `treegrid` for tree data/grouping; `aria-expanded`, `aria-level`                                                                              | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/accessibility/index.mdoc                       |
| ag-kbd       | "Hitting the Enter key will expand or collapse the group"                                                                                     | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/keyboard-navigation/index.mdoc                 |
| ag-selfref   | "Cycles and missing parent rows are not allowed"; enterprise                                                                                  | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/tree-data-self-referential/index.mdoc          |
| ag-tgs       | `loadSelfRef`: `treeParent = newParent ?? rootNode`, `warn(271)`; `handleCycles` → 270                                                        | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-enterprise/src/treeData/treeGroupStrategy.ts                              |
| ag-err       | text of warnings 270, 271                                                                                                                     | https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/validation/errorMessages/errorText.ts                       |
| mui-cell     | inline `marginLeft` by depth, `tabIndex={-1}`, label keys, button only when `filteredDescendantCount > 0`, `stopPropagation` + `setCellFocus` | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid-pro/src/components/GridTreeDataGroupingCell.tsx                             |
| mui-styles   | toggle wrapper `flex: '0 0 28px'`                                                                                                             | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid/src/components/containers/GridRootStyles.ts                                 |
| mui-row-aria | row `aria-level`, `aria-expanded`, `aria-setsize`, `aria-posinset`                                                                            | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid-pro/src/hooks/features/rows/useGridRowAriaAttributes.tsx                    |
| mui-aria     | `role: 'treegrid'` when `treeData`                                                                                                            | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid-pro/src/hooks/utils/useGridAriaAttributes.tsx                               |
| mui-a11y     | Space toggles children on the grouping cell; roving tabindex                                                                                  | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/docs/data/data-grid/accessibility/accessibility.md                                               |
| mui-locale   | "see children" / "hide children"                                                                                                              | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid/src/constants/localeTextConstants.ts                                        |
| mui-td       | Pro plan; gap rows auto-created                                                                                                               | https://raw.githubusercontent.com/mui/mui-x/v9.14.0/docs/data/data-grid/tree-data/tree-data.md                                                       |
| ts-guide     | consumer `<button onClick={row.getToggleExpandedHandler()}>`, `getRowCanExpand`                                                               | https://raw.githubusercontent.com/TanStack/table/v8.21.3/docs/guide/expanding.md                                                                     |
| ts-ex        | `paddingLeft: ${row.depth * 2}rem`, leaf `'🔵'`                                                                                               | https://raw.githubusercontent.com/TanStack/table/v8.21.3/examples/react/expanding/src/main.tsx                                                       |
| ts-core      | `getSubRows`, parent passed by reference                                                                                                      | https://unpkg.com/@tanstack/table-core@8.21.3/src/utils/getCoreRowModel.ts                                                                           |
| ts-lic       | MIT                                                                                                                                           | https://unpkg.com/@tanstack/table-core@9.2.4/package.json                                                                                            |
| png-doc      | role `table`; `ttRow` manages `aria-expanded`/`aria-level`; keyboard table; version 22.1.2                                                    | https://primeng.dev/treetable                                                                                                                        |
| png-dts      | `TreeTableToggler` (`togglerVisibility`, `togglerMarginStart`, `toggleButtonAriaLabel`); `TTRow` key handlers, `focusSiblingToggler`          | https://unpkg.com/primeng@22.1.2/types/primeng-treetable.d.ts                                                                                        |
| png-api      | `TreeNode.children`, `leaf` "Used in lazy loading"                                                                                            | https://unpkg.com/primeng@22.1.2/types/primeng-api.d.ts                                                                                              |
| png-lic      | Community License thresholds                                                                                                                  | https://unpkg.com/primeng@22.1.2/LICENSE.md                                                                                                          |
| cdk-tree     | `treeitem` aria bindings L1123-1127; `_getAriaExpanded` L1005-1010; padding L1340-1365; toggle L1430-1464 (read from `node_modules`, 22.1.7)  | https://unpkg.com/@angular/cdk@22.1.7/fesm2022/tree.mjs                                                                                              |
| cdk-tkm      | `TreeKeyManager.onKeydown` L73-110 (read from `node_modules`)                                                                                 | https://unpkg.com/@angular/cdk@22.1.7/fesm2022/_tree-key-manager-chunk.mjs                                                                           |
| cdk-doc      | implements the APG tree widget; `cdkTreeNodePadding` for flat trees                                                                           | https://raw.githubusercontent.com/angular/components/22.1.x/src/cdk/tree/tree.md                                                                     |
| mat-ex       | leaf "disabled button to provide padding"; `'Toggle ' + node.name`; toggle on node and button                                                 | https://raw.githubusercontent.com/angular/components/22.1.x/src/components-examples/material/tree/tree-flat-overview/tree-flat-overview-example.html |
| apg-tg       | treegrid keys; `aria-expanded` on row or cell                                                                                                 | https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/                                                                                                   |
| mdn-row      | `aria-expanded` on a row only inside `treegrid`                                                                                               | https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/row_role                                                             |
| prior-filter | context-row styling, filter orphans, AG Grid enterprise (ag-td)                                                                               | ../../../../../1-state/work/tree/active/tree-flat-data/discovery-tree-filter-competitors.md                                                          |
| prior-group  | grouping-vs-tree (out of scope here)                                                                                                          | ../../../../../1-state/work/tree/active/tree-flat-data/discovery-tree-grouping-competitors.md                                                        |

[ag-gcr-ctrl]: https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-enterprise/src/rowHierarchy/rendering/groupCellRendererCtrl.ts
[ag-gcr]: https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-enterprise/src/rowHierarchy/rendering/groupCellRenderer.ts
[ag-css]: https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/theming/core/css/_grid-layout.css
[ag-theme]: https://unpkg.com/ag-grid-community@36.2.0/styles/ag-grid.css
[ag-rowctrl]: https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/rendering/row/rowCtrl.ts
[ag-a11y]: https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/accessibility/index.mdoc
[ag-kbd]: https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/keyboard-navigation/index.mdoc
[ag-selfref]: https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/documentation/ag-grid-docs/src/content/docs/tree-data-self-referential/index.mdoc
[ag-tgs]: https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-enterprise/src/treeData/treeGroupStrategy.ts
[ag-err]: https://raw.githubusercontent.com/ag-grid/ag-grid/b36.2.0/packages/ag-grid-community/src/validation/errorMessages/errorText.ts
[mui-cell]: https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid-pro/src/components/GridTreeDataGroupingCell.tsx
[mui-styles]: https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid/src/components/containers/GridRootStyles.ts
[mui-row-aria]: https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid-pro/src/hooks/features/rows/useGridRowAriaAttributes.tsx
[mui-aria]: https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid-pro/src/hooks/utils/useGridAriaAttributes.tsx
[mui-a11y]: https://raw.githubusercontent.com/mui/mui-x/v9.14.0/docs/data/data-grid/accessibility/accessibility.md
[mui-locale]: https://raw.githubusercontent.com/mui/mui-x/v9.14.0/packages/x-data-grid/src/constants/localeTextConstants.ts
[mui-td]: https://raw.githubusercontent.com/mui/mui-x/v9.14.0/docs/data/data-grid/tree-data/tree-data.md
[ts-guide]: https://raw.githubusercontent.com/TanStack/table/v8.21.3/docs/guide/expanding.md
[ts-ex]: https://raw.githubusercontent.com/TanStack/table/v8.21.3/examples/react/expanding/src/main.tsx
[ts-core]: https://unpkg.com/@tanstack/table-core@8.21.3/src/utils/getCoreRowModel.ts
[ts-lic]: https://unpkg.com/@tanstack/table-core@9.2.4/package.json
[png-doc]: https://primeng.dev/treetable
[png-dts]: https://unpkg.com/primeng@22.1.2/types/primeng-treetable.d.ts
[png-api]: https://unpkg.com/primeng@22.1.2/types/primeng-api.d.ts
[png-lic]: https://unpkg.com/primeng@22.1.2/LICENSE.md
[cdk-tree]: https://unpkg.com/@angular/cdk@22.1.7/fesm2022/tree.mjs
[cdk-tkm]: https://unpkg.com/@angular/cdk@22.1.7/fesm2022/_tree-key-manager-chunk.mjs
[cdk-doc]: https://raw.githubusercontent.com/angular/components/22.1.x/src/cdk/tree/tree.md
[mat-ex]: https://raw.githubusercontent.com/angular/components/22.1.x/src/components-examples/material/tree/tree-flat-overview/tree-flat-overview-example.html
[apg-tg]: https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/
[mdn-row]: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/row_role
[prior-filter]: ../../../../../1-state/work/tree/active/tree-flat-data/discovery-tree-filter-competitors.md
[prior-group]: ../../../../../1-state/work/tree/active/tree-flat-data/discovery-tree-grouping-competitors.md
