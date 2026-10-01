# In end-user work-management products, what does a person see and do with hierarchical rows — the expand control, depth, leaf alignment, keyboard/screen reader, filter-context parents, and orphans?

**Date:** 2026-10-01 · **Mode:** product-ux

Sibling of [`discovery-tree-grouping-products.md`](../../../../../1-state/work/tree/active/tree-flat-data/discovery-tree-grouping-products.md)
(state-layer: tree × grouping/filter/sort placement, read 2026-09-27).
That doc is not repeated here; its source IDs are cited as `[G-Sn]` where reused.

## Answer

- **The control is a chevron immediately left of the name, inside the
  name column** — monday [M1], ClickUp [C1], Smartsheet [S1]. Notion
  makes the column configurable (`toggle_column_id`) [N2]. monday and
  ClickUp add a **second** toggle: the child-count badge [M1][C2].
- **Depth is indentation in one column only** — Smartsheet says so
  outright [S1][S3]. monday is the outlier: a nested sub-table with its
  own column headers [M1][M3]. Every flat mode replaces indentation with
  a **parent label** on the child row [N2][C2][AS5].
- **Keyboard is the gap of the category.** No product documents a key
  that expands one row; the keyboard story is indent/outdent while
  editing [S3][C3][N4]. Only monday documents a screen-reader model, and
  it rejected `role="grid"` for headings + lists [M3][M4].
- **Filter-context parents: three answers, one paywall.** monday shows
  the ancestor chain by default [M2]; Smartsheet makes it a checkbox on
  paid plans [S4]; Jira flattens and has 73 + 42 votes asking otherwise
  [J9][J8]. No primary source documents how a context-only parent is
  *styled* — Notion "gray" is secondary only [N5].
- **Orphans never come from deletion — every product cascades** [M2][N1][S1][S2].
  They come from *visibility* (other project, permissions, filters). The
  expectation set by Jira's own bug reports and by ClickUp is: **render
  as a root row, marked as a child** [J3][C4] — never hide it.

## Method and source reliability

- Every page read on **2026-10-01**. SaaS has no versions; the read date
  and, where exposed, the article `updated_at` are the pin.
- **Zendesk help centers (monday, ClickUp)** read via
  `https://<host>/api/v2/help_center/en-us/articles/<id>.json` — returns
  body + `updated_at`. Search via `/api/v2/help_center/articles/search.json?query=`.
  Method inherited from the grouping doc; reconfirmed this run.
- **Asana Help Center is JS-rendered** (`help.asana.com/s/article/keyboard-shortcuts`
  returned the shell only). Asana claims come from Discourse JSON
  (`/t/<id>.json`, `/t/<id>/last.json`).
- **Asana Discourse `staff: true` includes partner Forum Leaders**, who
  are not Asana employees — treated as user-grade. Only "Community
  Manager" / "Asana Staff" posts are vendor statements.
- **Smartsheet and Notion help pages carry no "updated" date** — flagged
  per row in Sources. Airtable says "Last updated 1 month ago" only.
- **Jira help vs Jira tracker disagree** on cross-space parents (see
  theme 6). The help page is undated; the tracker and the 2026-07-27
  launch note are dated. Dated sources win.
- **Vote counts are not comparable across portals.** Jira "votes",
  ClickUp "voters", Smartsheet idea "score", Asana post counts are four
  mechanics. Read age and state, not magnitude across products. Within
  Jira, votes are comparable to each other.
- **Asana topic `like_count` came back as a non-integer (50,408.6)** from
  the fetch — discarded as a parse artifact; post count used instead.
- **WebFetch is a summarizing reader.** Quotes below are what it returned
  as verbatim; any claim that came only from a search-engine summary was
  re-fetched or moved to Unverified.
- Product set: Monday.com, Jira (List / All work), Asana, ClickUp,
  Notion, Airtable, Smartsheet — the caller's set. Linear, Wrike and MS
  Project are covered in the grouping doc and not re-read.

## Findings

### 1. Expand/collapse control — what it is and where it sits

| Product | Control | Position | Bulk | Evidence |
|---|---|---|---|---|
| monday | "small arrow" **and** the subitem-count number, both toggle | "to the left of the item name" | item ⋯ menu → "Collapse all items" / "Expand all items" | [M1] |
| ClickUp | "dropdown arrow" (Collapse-all mode: "Click the **subtask** icon to expand them in place") | "to the left of the task" | view-level "Subtasks" menu: Collapse all / Expand all / As separate tasks | [C1][C2] |
| Smartsheet | arrow "▶ / ▼" | "next to the parent row's name in the Primary Column" | right-click Primary Column header → Expand All / Collapse All | [S1][S2] |
| Notion | toggle "on the left side of the row" | column is configurable: `toggle_column_id` = "Property ID of the column showing the expand/collapse toggle" | `cmd/ctrl+option/alt+T` toggles all in a *toggle list* (database scope unverified) | [N2][N3][N4] |
| Airtable List | right-click record → "expand, collapse" | arrow position undocumented | — | [A1] |
| Jira List | "expand to drill into details or collapse to focus" | undocumented | — | [J2] |
| Asana list | "triangles" / "twisties" next to tasks with subtasks (users' words) | undocumented by Asana | "Expand all subtasks" — requested 2020-02-03, staff "started rolling out" 2025-10-15 | [AS6][AS1] |

**Expand state persistence (pain, dated):**

| Source | Opened | State (read 2026-10-01) | What was said |
|---|---|---|---|
| Jira JRACLOUD-99126 [J10] | 2026-08-07 | Gathering Interest, 1 vote | expanded parents "collapse when returning via the browser Back button"; scroll position lost |
| Asana forum 384263 [AS4] | 2023-03-29 | merged by Forum Leader | "when I go to a different board and then return … the arrow collapses my subtasks" |
| ClickUp feedback [C7] | 2026-09-19 | open, 1 voter | "I constantly need to switch between collapsed and expanded subtask views" — asks for a shortcut **and** saved expand state |
| Asana forum 883527 [AS3] | 2024-08-06 | staff "checking internally" 2024-08-09 | expand arrow disappears under custom group-by/sort; Forum Leader workaround: group by Sections, drop sorts/filters |

### 2. How depth is shown

| Product | Depth cue | Max depth | Plan | Evidence |
|---|---|---|---|---|
| Smartsheet | indent, **Primary Column only** — "Indents are displayed only in the sheet's Primary Column, but the relationship is applied to the entire row" | not read | Smartsheet, Pro, Business, Enterprise | [S1][S3] |
| Notion | indent in "Nested in toggle"; "Flattened list": "sub-items won't be indented" | not read | not read | [N1] |
| monday | nested sub-table: subitems "can have their own column structure"; screen reader: "Subitems have their own column headers list" | "up to **four levels** beneath the level-zero item" | all plans (boards); Enterprise for projects | [M1][M2][M3] |
| ClickUp | "directly beneath their parent tasks" (indent not stated) | default 3, "up to seven levels"; 1,000 subtasks per task | all plans (Nested Subtasks ClickApp) | [C1][C3] |
| Airtable List | levels can be different tables (3) + 7 same-table nested layers; drag shows "blue highlight" at a valid level | 10 layers | all plans | [A1] |
| Asana list | first level only expandable; staff 2026-02-07: all levels "coming in ~3months"; still asked for 2026-09-18 | 1 in list | — | [AS2][G-S23] |

**Flat modes replace depth with a parent label:**

- Notion `flattened` = "sub-items with a parent indicator" [N2].
- ClickUp "Show subtask parent names: Show parent task names directly
  above their subtasks' names" [C2].
- Asana: a subtask added to its parent's project shows "as a top-level
  task in addition to also appearing as a subtask", parent name next to
  it (Forum Leader + user, 2026-08) [AS5].

### 3. Rows without children (leaf alignment)

- Notion: "Hover over any database row, and then click on the toggle on
  the left side of the row to add a new sub-item" [N3] — the toggle slot
  exists on **every** row, surfacing on hover as an *add* affordance.
- No other product documents leaf rendering. See Unverified.

### 4. Keyboard and screen reader

| Product | Expand one row by key | Indent/outdent | Screen reader | Evidence |
|---|---|---|---|---|
| Smartsheet | **none in grid**; Spacebar expands a *card* in card view | Ctrl/Cmd+] / Ctrl/Cmd+[ | not documented by Smartsheet | [S3] |
| ClickUp | none listed; "Control + Shift + Left/Right" navigates between tasks | Tab / Shift+Tab while quick-creating | not documented | [C6][C3] |
| monday | none listed; arrow keys move between cells; Ctrl+G collapses/expands all **groups** | — | subitem names are "headings (level 4)"; "Press 4" jumps between them; "Expand and collapse groups and subitems" (keys unstated) | [M5][M3] |
| Notion | cmd/ctrl+option/alt+T for toggle lists (databases unverified) | Tab / Shift+Tab "to indent and nest content" (blocks) | not read | [N4] |
| Jira, Asana, Airtable | not documented in any page read | — | — | — |

**monday's engineering post (2026-02-16)** is the only first-party
account of an a11y model for a hierarchical board [M4]:
- chose region → group headings → item lists → cells as list items;
- tried `role="grid"`, which "didn't hold up consistently on VoiceOver for iOS";
- principle: "don't cosplay semantics";
- monday's own accessibility page still says it is "currently working
  on making … boards … compatible with major assistive technologies" [M6].

### 5. A parent shown only because a child matched

| Product | Behavior | Styling of the context parent | Plan | Evidence |
|---|---|---|---|---|
| monday | child matches → "the matching subitem **together with its parent chain**", non-matching siblings hidden; parent matches → parent "without displaying its subitems" | undocumented | all plans | [M2] |
| Smartsheet | "**Include parent rows** to keep parent rows visible even when they don't match the filter conditions" — a checkbox, off unless chosen | undocumented | Pro, Business, Enterprise | [S4] |
| Notion | filter scope: "Parents only" (with sub-item count) / "Parents and sub-items" / "Sub-items only"; board/calendar/gallery: Parents only | flattened list: parents "in a subtle gray color", clickable — **secondary source** | not read | [N1][N2][N5] |
| ClickUp | subtasks filterable only "As separate tasks"; they "stay connected to the parent task" | n/a (flat) | — | [C9][G-S5] |
| Jira List | hierarchy drops under any filter | n/a (flat) | — | [J8][J9] |
| Airtable List | filters "for each of the levels"; toggle "showing or hiding empty parents" | n/a | all plans | [A1] |

**Demand, dated:**

| Source | Opened | State (read 2026-10-01) | What was said |
|---|---|---|---|
| Jira JWMCLOUD-140 [J9] | 2021-11-29 | Gathering Interest, 73 votes, 27 support refs, updated 2026-04-02 | "applying a filter by label will make the parent/Sub-task relation disappear from the list" |
| Jira JRACLOUD-94328 [J8] | 2025-05-01 | Gathering Interest, 42 votes | keep nesting "provided both the parent and child issues satisfy the filter" — asks only for the *both-match* case |
| Smartsheet idea 109147 [S5] | 2023-08-18 | Idea Submitted, score 18, last comment 2026-07-23 | "Include Children" checkbox, mirror of "Include Parent Rows" |
| ClickUp feedback (from grouping doc) [G-S6] | 2020-10-08 | open, 65 voters (read 2026-09-27) | "show subtasks under their parent task expanded, even if the parent task does not match the filter" |

### 6. An item whose parent is missing or deleted

**Deletion — every product cascades, so a deleted parent leaves no orphan:**

- monday: "If you delete a parent subitem that contains its own
  subitems, those subitems will be deleted as well" [M2].
- Notion: "When you delete an item with sub-items, all of the sub-items
  will be deleted as well" [N1].
- Smartsheet: "If you delete a parent row, all its child rows are
  deleted too. To delete a parent row without deleting the child rows,
  remove the parent-child relationship first" [S2][S1].
- ClickUp Trash: a subtask deleted before its parent "becomes nested
  under the parent task in the Trash" [C5].

**Visibility — the parent exists but is not in the view:**

| Product | Behavior | Evidence |
|---|---|---|
| ClickUp | subtask in a secondary List "will show up … like a top-level parent task"; "We'll always show the subtask icon next to the task name"; parent in task breadcrumbs | [C4] |
| Asana | subtask in the project shows top-level **and** under its parent, parent name beside it | [AS5] |
| Jira List (help, undated) | "If a child work item has a parent that belongs to a different space, it won't display in the list view" | [J1] |
| Jira List (tracker) | JWMCLOUD-392 "does not show issues belonging to a parent from a different project" — **Closed / Fixed**, 26 votes, 2023-01-18 → 2025-05-28 | [J5] |
| Jira All work + Show hierarchy | JRACLOUD-95341 (2025-07-11): items "completely hidden" when parent is in another project or security-restricted; **expected: "display as root-level entries"**; workaround: hierarchy off, or List view "following a previous fix (JWMCLOUD-392)" | [J3] |
| Jira (same bug, again) | JRACLOUD-97044 (2025-12-18, dup) → JRACLOUD-93901 "Improve 'Show Hierarchy' Toggle Result Set": **In Progress**, 14 votes, updated 2026-09-23 | [J6][J4] |
| Jira (inverse bug) | JRACLOUD-99329 (2026-08-27): child "nested under their parent **and** as independent standalone entries"; 5 linked duplicates | [J7] |
| Jira launch 2026-07-27 | "cross-space parent visibility is now supported" — **Premium and Enterprise** | [J2] |

## Synthesis — where they disagree

**1. Is the child count a toggle?**
- Yes: monday (number toggles) [M1], ClickUp (subtask icon expands in
  Collapse-all mode) [C2].
- No: Smartsheet (arrow only) [S1]; Notion "Parents only" shows a count
  as information, the toggle is separate [N1][N2].
- Implication: two hit targets for one action is a product choice, not a
  convention. A primitive that exposes `hasChildren` + a child count lets
  a consumer build either.

**2. Which column holds the control.**
- Fixed to the name/primary column: Smartsheet [S1], monday [M1], ClickUp [C1].
- Configurable: Notion `toggle_column_id` [N2].
- **Everyday expectation:** inside the name column, left of the text,
  never a dedicated leading column. Notion making it configurable is the
  one signal that "which column" is a real consumer choice.

**3. One table with indentation, or a table per level.**
- Indent in one column: Smartsheet [S1][S3], Notion [N1].
- Sub-table with its own headers: monday [M1][M3].
- Different-table levels inside one list: Airtable [A1].
- Implication: indentation is the shared default; monday's model only
  pays off when children have different columns from parents — a
  heterogeneous-row requirement, not a depth one.

**4. Keyboard: nobody sets the bar.**
- No product documents single-row expand by key [S3][C6][M5]. The
  keyboard investment is in *structure editing* (indent/outdent)
  [S3][C3][N4].
- monday — the only product to publish an SR model — chose headings and
  lists over a grid role [M4]. That is a disagreement with ARIA APG's
  treegrid, made for VoiceOver-iOS reliability.
- Implication: products give no "everyday expectation" to lean on here.
  The bar must come from APG (not researched in this doc), and anything
  shipped is above the category's documented floor.

**5. Context parents: default, opt-in, or absent — and metered.**
- Default on: monday, all plans [M2].
- Opt-in checkbox, paid plans: Smartsheet Pro+ [S4].
- Absent (flattens): Jira List [J8][J9], ClickUp tree modes [C9].
- Mode switch: Notion, three scopes [N1].
- **Tier split:** monday gives the ancestor chain away; Smartsheet
  meters the same thing. Same capability, opposite sides of the paywall
  — "chosen to meter", not "expensive to build".
- Jira's 42-vote ask is narrower than monday's behavior: nest only when
  **both** match [J8]. The 73-vote ask is unqualified [J9].
- **Styling is the hole:** no primary source documents a dimmed or
  labelled context-only parent. Notion gray is secondary [N5].

**6. Orphans: show as root, hide, or duplicate.**
- Show as root + mark as child: ClickUp (subtask icon) [C4], Asana
  (parent name) [AS5], Notion flattened (parent indicator) [N2].
- Hide: Jira All work with hierarchy on — filed as a bug three times
  since 2025 and still In Progress [J3][J6][J4].
- Duplicate: Jira 2026-08 regression [J7]; Asana by design [AS5].
- **Paywall on context:** Jira sells showing a missing parent across
  spaces (Premium/Enterprise) [J2]. The free fallback is the orphan
  rendered alone.
- **Everyday expectation:** the orphan is never hidden. Jira's own bug
  text names the expected behavior — "display as root-level entries"
  [J3]. Hiding is the reported-as-broken direction.
- Deletion is not a source of orphans in any product read — all cascade
  or nest in trash [M2][N1][S1][C5]. Orphans in these products are a
  *view* concept (parent not in this view), which maps to a flat-data
  `parentId` pointing at an absent row.

## Not researched

- Linear, Wrike, MS Project, Height, Coda (Linear/Wrike/MS Project
  covered in the grouping doc for state concerns only).
- Mobile apps of any product.
- ARIA APG treegrid pattern and WCAG criteria — outside product-ux;
  needed for theme 4's bar.
- Jira accessibility statement; Asana, ClickUp, Airtable, Notion a11y pages.
- Third-party video walkthroughs (pointers only per brief; none used).
- Atlassian Community and Asana Help Center articles (JS-rendered).

## Unverified

- **Leaf alignment** in monday, ClickUp, Smartsheet, Jira, Asana,
  Airtable: whether leaf rows reserve the chevron's width so names align
  with parents. No help page states it. Confirm by opening a board.
- **monday: arrow on items with no subitems** (hover add-affordance, as
  in Notion [N3]) — not stated in [M1].
- **Styling of filter-context parents** — Notion "subtle gray" is from a
  third-party site [N5], undated, no link to a Notion release. A search
  summary attributed it to Notion; the Notion help page [N1] does not say it.
- **Asana arrow keys**: a search summary said Right/Left arrow
  expand/collapse subtasks in list view; no forum post read contains it
  (threads 81089, 598457, 384263, 883527 checked). Asana's shortcuts page
  is JS-rendered.
- **Smartsheet expand/collapse not exposed to screen readers**: a search
  summary claimed the toggle is not focusable or announced; neither
  UW–Madison's review (kb.wisc.edu/113134) nor Boise State's guide says so.
- **Jira: deleting a parent deletes its subtasks.** Search summaries
  point to a REST `deleteSubtasks` parameter; the REST page truncated in
  fetch and the help page [J-del] does not say. Confirm on
  developer.atlassian.com "Delete issue".
- **Jira List help vs tracker** on cross-space parents: [J1] (undated)
  says not displayed; [J5] closed Fixed; [J2] says supported on
  Premium/Enterprise. Reasonable inference: the help sentence predates
  the 2026-07-27 launch and now applies to Free/Standard only.
- **Notion `cmd/ctrl+option/alt+T` and Tab on database rows** — the
  shortcut page scopes them to toggle lists and blocks.
- **Asana expand-all reached all customers** — staff said "started
  rolling out" 2025-10-15 [AS1]; no completion post read.
- **Smartsheet collapse state shared with collaborators** — a search
  summary said saved collapse changes the sheet for everyone; [S1][S2]
  do not say.

## Sources

| ID | Claim | URL | Read |
|---|---|---|---|
| M1 | monday: arrow left of item name; count toggles; ⋯ Collapse/Expand all items; subitems own column structure (updated 2026-09-15) | https://support.monday.com/api/v2/help_center/en-us/articles/360011905480.json | 2026-10-01 |
| M2 | monday multi-level: parent chain on match, siblings hidden; parent match without subitems; delete cascades; 4 levels; all plans / Enterprise projects (updated 2026-09-25) | https://support.monday.com/api/v2/help_center/en-us/articles/29810815287570.json | 2026-10-01 |
| M3 | monday screen readers: subitem names H4; own column headers list; expand/collapse groups and subitems (updated 2026-04-08) | https://support.monday.com/api/v2/help_center/en-us/articles/33660661840530.json | 2026-10-01 |
| M4 | monday engineering 2026-02-16: headings+lists model; `role="grid"` failed on VoiceOver iOS; "don't cosplay semantics" | https://engineering.monday.com/how-we-fixed-monday-coms-board-a11y-without-a-table-rewrite/ | 2026-10-01 |
| M5 | monday shortcuts: arrow-key cell navigation; Ctrl+G groups; no subitem shortcut (updated 2026-08-20) | https://support.monday.com/api/v2/help_center/en-us/articles/115005339905.json | 2026-10-01 |
| M6 | monday accessibility: boards still being made AT-compatible (updated 2026-05-21) | https://support.monday.com/api/v2/help_center/en-us/articles/360000571925.json | 2026-10-01 |
| C1 | ClickUp: "dropdown arrow to the left of the task"; Expand all "directly beneath their parent tasks"; 1,000 subtasks | https://help.clickup.com/api/v2/help_center/en-us/articles/6310382044567.json | 2026-10-01 |
| C2 | ClickUp Customize List view: subtask icon expands in place; "Show subtask parent names" above subtask names (updated 2026-09-22) | https://help.clickup.com/api/v2/help_center/en-us/articles/7255389296919.json | 2026-10-01 |
| C3 | ClickUp nested subtasks: default 3, up to 7 levels; all plans; Tab / Shift+Tab indent (updated 2026-09-28) | https://help.clickup.com/api/v2/help_center/en-us/articles/6304431740055.json | 2026-10-01 |
| C4 | ClickUp: subtask in secondary List shown like top-level, subtask icon always shown, parent in breadcrumbs (updated 2026-09-30) | https://help.clickup.com/api/v2/help_center/en-us/articles/6309521498263.json | 2026-10-01 |
| C5 | ClickUp Trash: subtask nests under deleted parent (updated 2026-09-29) | https://help.clickup.com/api/v2/help_center/en-us/articles/6311742742423.json | 2026-10-01 |
| C6 | ClickUp shortcuts: no expand shortcut; Ctrl+Shift+Left/Right between tasks (updated 2026-09-28) | https://help.clickup.com/api/v2/help_center/en-us/articles/6309030550167.json | 2026-10-01 |
| C7 | ClickUp feedback: shortcut + saved expand state for subtask modes (2026-09-19, 1 voter) | https://feedback.clickup.com/feature-requests/p/keyboard-shortcut-for-subtask-display-toggle-in-list-view | 2026-10-01 |
| C9 | ClickUp filters: separate subtasks "stay connected to the parent task" (updated 2026-09-18) | https://help.clickup.com/api/v2/help_center/en-us/articles/6308875427223.json | 2026-10-01 |
| N1 | Notion: Nested in toggle / Flattened (not indented); three filter scopes; Parents only shows count; delete cascades (undated) | https://www.notion.com/help/tasks-and-dependencies | 2026-10-01 |
| N2 | Notion API views: `show`/`hidden`/`flattened` ("sub-items with a parent indicator")/`disabled`; filter scopes; `toggle_column_id` (undated) | https://developers.notion.com/guides/data-apis/working-with-views | 2026-10-01 |
| N3 | Notion 2.19 release 2022-12-15: hover any row, toggle on left side adds a sub-item | https://www.notion.com/releases/2022-12-15 | 2026-10-01 |
| N4 | Notion shortcuts: cmd/ctrl+option/alt+T toggle lists; Tab / Shift+Tab nest (undated) | https://www.notion.com/help/keyboard-shortcuts | 2026-10-01 |
| N5 | Notion flattened view: parents "in a subtle gray color", clickable — **secondary**, undated | https://matthiasfrank.de/en/notion-updates/clickable-parent-items-in-flattened-sub-items-view/ | 2026-10-01 |
| S1 | Smartsheet: ▶/▼ next to parent name in Primary Column; indents Primary Column only; Ctrl+]/[; delete cascades; plans (undated) | https://help.smartsheet.com/articles/504734-hierarchy-indenting-outdenting-rows | 2026-10-01 |
| S2 | Smartsheet learning track: Expand All / Collapse All from Primary Column header; delete parent deletes children (undated) | https://help.smartsheet.com/learning-track/level-1-foundations/rows-and-hierarchy | 2026-10-01 |
| S3 | Smartsheet shortcuts: no grid expand/collapse key; Spacebar in card view; "indent level is only in the Primary column" (undated) | https://help.smartsheet.com/articles/522200-keyboard-shortcuts | 2026-10-01 |
| S4 | Smartsheet filters: "Include parent rows" even when they don't match; Pro, Business, Enterprise (undated) | https://help.smartsheet.com/articles/504659-using-filters-to-show-or-hide-sheet-data | 2026-10-01 |
| S5 | Smartsheet idea "Option to Include Children on Filter" (2023-08-18, Idea Submitted, score 18) | https://community.smartsheet.com/api/v2/discussions/109147 | 2026-10-01 |
| A1 | Airtable List: 10 layers; all plans; per-level filters; show/hide empty parents; right-click expand/collapse; blue drag highlight ("Last updated 1 month ago") | https://support.airtable.com/docs/list-view-overview | 2026-10-01 |
| J1 | Jira List help: 500 children max; cross-space parent → child not displayed (undated) | https://support.atlassian.com/jira-software-cloud/docs/create-and-edit-work-items-from-your-list/ | 2026-10-01 |
| J2 | Jira launch 2026-07-27: expand/collapse hierarchy; cross-space parent visibility Premium/Enterprise | https://jirareleases.atlassian.com/announcements/a-more-powerful-list-view-for-the-way-your-team-actually-works | 2026-10-01 |
| J3 | JRACLOUD-95341: hidden when parent outside results; expected root-level (2025-07-11, Closed/Duplicate) | https://jira.atlassian.com/browse/JRACLOUD-95341 | 2026-10-01 |
| J4 | JRACLOUD-93901: Show Hierarchy result set (2025-04-02, In Progress, 14 votes, updated 2026-09-23) | https://jira.atlassian.com/browse/JRACLOUD-93901 | 2026-10-01 |
| J5 | JWMCLOUD-392: list omits issues with cross-project parent (2023-01-18, Closed/Fixed, 26 votes) | https://jira.atlassian.com/browse/JWMCLOUD-392 | 2026-10-01 |
| J6 | JRACLOUD-97044: same, All work (2025-12-18, Closed/Duplicate) | https://jira.atlassian.com/browse/JRACLOUD-97044 | 2026-10-01 |
| J7 | JRACLOUD-99329: child shown nested and standalone (2026-08-27, Closed/Duplicate) | https://jira.atlassian.com/browse/JRACLOUD-99329 | 2026-10-01 |
| J8 | JRACLOUD-94328: nesting lost under filter (2025-05-01, Gathering Interest, 42 votes) | https://jira.atlassian.com/browse/JRACLOUD-94328 | 2026-10-01 |
| J9 | JWMCLOUD-140: nesting lost under filter (2021-11-29, Gathering Interest, 73 votes) | https://jira.atlassian.com/browse/JWMCLOUD-140 | 2026-10-01 |
| J10 | JRACLOUD-99126: expand state lost on Back (2026-08-07, 1 vote) | https://jira.atlassian.com/browse/JRACLOUD-99126 | 2026-10-01 |
| J-del | Jira delete help: no statement on subtasks (negative result) | https://support.atlassian.com/jira-software-cloud/docs/delete-a-work-item-from-your-list/ | 2026-10-01 |
| AS1 | Asana expand/collapse all subtasks: opened 2020-02-03, 199 posts, staff "started rolling out" 2025-10-15 | https://forum.asana.com/t/73143/last.json | 2026-10-01 |
| AS2 | Asana all subtask levels in List: opened 2020-04-28, staff 2026-02-07 "~3months", latest post 2026-09-18 | https://forum.asana.com/t/81902/last.json | 2026-10-01 |
| AS3 | Asana expand arrow lost under custom group/sort (2024-08-06; staff 2024-08-09) | https://forum.asana.com/t/883527.json | 2026-10-01 |
| AS4 | Asana expand state collapses on navigation (2023-03-29) | https://forum.asana.com/t/384263.json | 2026-10-01 |
| AS5 | Asana subtask top-level + under parent, parent name shown (user + Forum Leader, 2026-08-20/21) | https://forum.asana.com/t/showing-parent-tasks-on-a-subtask-row-in-list-view/1152944.json | 2026-10-01 |
| AS6 | Asana My Tasks twisties request (2021-04-06, 63 posts; staff concern same day) | https://forum.asana.com/t/116555.json | 2026-10-01 |
| G-S5 | ClickUp: subtasks filterable only as separate tasks | see grouping doc S5 | 2026-09-27 |
| G-S6 | ClickUp feedback: subtasks under non-matching parent (2020-10-08, 65 voters) | see grouping doc S6 | 2026-09-27 |
| G-S23 | Asana staff 2026-05-25: My Tasks grid expands first-level subtasks | see grouping doc S23 | 2026-09-27 |
