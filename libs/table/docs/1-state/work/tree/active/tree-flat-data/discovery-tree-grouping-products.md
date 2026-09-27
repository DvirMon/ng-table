# In end-user work-management products, when a task/subtask tree is grouped by Status, where does a subtask whose status differs from its parent's render?

**Date:** 2026-09-27 · **Mode:** product-ux (end-user products, not grid libraries)

Feeds the tree × grouping decision in [`1-decisions.md`](1-decisions.md).
Sibling of [`discovery-tree-filter-competitors.md`](discovery-tree-filter-competitors.md)
(grid libraries) — this doc is about what a *person* sees in a SaaS table.

## Answer

- **The everyday expectation is candidate (1): the tree is never split.**
  Group-by places top-level rows only; children ride with their parent.
  Wrike states it outright ("Only the first level of items are grouped.
  Subitems remain ungrouped and live under parent items") [S1].
  ClickUp's default display modes (Collapse all / Expand all) keep subtasks
  "directly beneath their parent tasks" [S4]. Asana's group/sort/filter act
  on parents only, per a Forum Leader [S21] — Asana's own 2024 announcement [S19] does not say.
- **Candidate (2) exists as an opt-in flat mode, never as the tree default.**
  ClickUp "As separate tasks" [S4], monday List View widget "subitems alongside items" [S12],
  Notion "Flattened list" [S7]. Linear is the one product whose *default* list is
  flat (sub-issues are ordinary rows, toggle on/off) [S25] — it offers
  "Group by: parent issue" as the way to see hierarchy [S25].
- **Only MS Project (desktop) does (2) with context**: "Maintain Hierarchy in
  Current Group" repeats the summary (parent) tasks inside every group a
  child lands in [S30]. No SaaS product surveyed documents a parent breadcrumb row in a group.
- **Candidate (3) — the two are mutually exclusive — is real too**: Smartsheet
  groups only in reports, and reports drop sheet hierarchy [S27][S28];
  Airtable groups only the bottom level of a hierarchy [S29, user report];
  Jira List flattens the tree whenever a filter is on [S16].
- **Group header counts**: the only product that documents it (Wrike) counts
  **top-level rows only** and excludes subitems from numeric subtotals unless
  rolled up [S1]. Everyone else: unverified.

## Method and source reliability

- Every page read on **2026-09-27**. SaaS has no versions; the read date and,
  where exposed, the article `updated_at` are the pin.
- Zendesk-hosted help centers (ClickUp, monday, Wrike) return **HTTP 403** to a
  page fetch; read through the public Help Center API instead —
  `https://<host>/api/v2/help_center/en-us/articles/<id>.json`. That returns
  the article body plus `updated_at`. Discourse forums (Asana) read via
  `/t/<id>.json` and `/t/<id>/last.json`. Smartsheet community (Vanilla) via
  `/api/v2/discussions/<id>` and `/api/v2/comments?discussionID=<id>`.
- **Atlassian Community and the Asana Help Center are JS-rendered** — WebFetch
  returned only the title. Claims that exist only there are in **Unverified**.
- **Staff vs user.** Asana Discourse sets `staff: true` for **Forum Leaders who
  are partners, not Asana employees** (Phil Seeman, "Partner - Forum Leader").
  Treated as user-grade evidence here. Asana employee posts carry the
  "Community Manager" / Asana Staff badge.
- **Vote counts are not comparable across portals.** ClickUp "voters", Asana
  Discourse likes-on-first-post, Jira "votes" and monday "I want this too" are
  four different mechanics; a 65 on ClickUp and a 7 on Jira say nothing
  relative to each other. Age is the more portable signal.
- A search-engine summary is a pointer only; every row below was re-read on the page itself.

## Findings

### Matrix — core question: grouped by Status, where does a differing subtask go?

| Product | Default placement | Opt-in alternative | Evidence |
|---|---|---|---|
| Wrike (Table view) | (1) under parent; only first level grouped | — | [S1] |
| ClickUp (List/Board) | (1) collapsed or expanded "directly beneath their parent tasks" | (2) "As separate tasks" — "stay connected to the parent task" | [S4][S5] |
| Asana (project list) | (1) likely — group/sort/filter act on parents only (Forum Leader) | (4) a subtask also added to the project shows **twice**: top-level row + under parent | [S19][S21][S22] |
| monday.com main table | unverified (group-by column list names no subitem column) | List View widget: "only subitems / subitems alongside items / subitems attached to the parent item" | [S9][S12] |
| Notion (table/list/timeline) | "Nested in toggle" — group interaction undocumented | "Flattened list" | [S7] |
| Linear (list/board) | (2) sub-issues are ordinary rows; board cards "scattered", "no visual cue" | Group by parent issue; sub-issues toggle off | [S25][S26] |
| Jira (List) | "Show hierarchy" toggle; grouping + hierarchy together unverified | flat list (hierarchy off) | [S15][S17] |
| Jira (team-managed board) | Group by Subtask → one swimlane per parent, subtask cards beneath | — | [S14] |
| Smartsheet | (3) grouping is reports-only; reports drop hierarchy | — | [S27][S28] |
| Airtable (List view / Interface) | (3) grouping applies only to the bottom-most level | — | [S29] |
| MS Project (desktop) | hierarchy hidden in groups when off | (2 + context) "Maintain Hierarchy in Current Group" repeats summary tasks per group | [S30] |

### Filter — does a matching child keep its parent visible?

| Product | Behavior | Evidence |
|---|---|---|
| monday.com | Yes, whole parent chain shown; non-matching siblings hidden | [S10][S11] |
| Notion | Three modes: "Parents only" (with sub-item count), "Parents and sub-items", "Sub-items only"; board/calendar/gallery support only "Parents only" | [S7] |
| ClickUp | Subtasks are filterable **only** in "As separate tasks" mode; in tree modes the filter does not reach them | [S4][S5] |
| Jira List | Hierarchy "disappears" under any filter — suggestion JRACLOUD-90536, Gathering Interest | [S16] |
| Jira Plans | "Show full hierarchy" shows all children of filtered parents even if they don't match — Premium/Enterprise | [S18] |
| Wrike | Grouping by assignee shows "all users assigned to the filtered tasks, even if some weren't included in your filter" | [S1] |
| Asana, Linear, Airtable | unverified | — |

### Sort — are siblings ordered within their parent?

| Product | Behavior | Evidence |
|---|---|---|
| Jira List | "When you sort your list view, child work items will stay with their parent." | [S15] |
| Linear | Sub-issues under one issue sort via "Order by" — per-user, not global | [S24] |
| Airtable List view | No manual reorder within the same parent (PM, 2023) | [S29b] |
| Wrike | Groups sort ascending/descending; within-parent sort undocumented | [S1] |
| ClickUp, monday, Notion, Asana | unverified | — |

### Group header counts and aggregates

| Product | Behavior | Evidence |
|---|---|---|
| Wrike | Count "doesn't include subitems"; numeric subtotals exclude sub-items "unless they are rolled up to the parent items" | [S1] |
| Linear | Header shows total issue count or total estimate, user-toggleable; whether sub-issues count is undocumented | [S25] |
| Notion | Group header shows a summary value, count by default; sub-item treatment undocumented (secondary source) | [S8] |
| monday.com | Parent summarizes subitem columns; rollups pull "from the lowest-level subitems in each branch" | [S9b][S10] |

### Plan gating

- Jira "Show full hierarchy" (filter keeps whole subtree): **Premium/Enterprise only** [S18].
- Smartsheet report grouping: Smartsheet, Business, Enterprise plans [S27].
- monday multi-level subitems: "Available on all plans" [S10].
- Wrike Table-view grouping: all plans including Free [S1].
- Nobody meters the tree × group combination itself. The one paywall is Jira's filter-context mode.

### Community pain (user-grade, dated)

| Source | Opened | State (read 2026-09-27) | What was said |
|---|---|---|---|
| ClickUp feedback: filter subtasks by parent status [S6] | 2020-10-08 | open, 65 voters, no staff reply | "show subtasks under their parent task expanded, even if the parent task does not match the filter but the subtask does" |
| ClickUp feedback: filter subtask assignees keeping parents collapsed [S5b] | 2026-02-11 | open, 7 voters | "When I expand the parent task, ClickUp shows all subtasks, including those assigned to other people"; separate mode "divorces them from context" |
| Asana forum 71920 [S19] | 2020-01-22 | launched 2024-10-11 (staff), 179 posts | 4.7 years from request to "see subtasks in project list view when using filters, sorts, and grouping by" |
| Jira JRACLOUD-90536 [S16] | 2024-09-16 | Gathering Interest, 7 votes | keep parent/child nesting when a filter is applied |
| Jira JWMCLOUD-81 [S17b] | 2021-08-12 | Closed / Fixed, updated 2023-05-05 | nested subtasks in list view, citing Asana and ClickUp |
| Linear #1192 [S26] | 2026-06-17 | open, no staff reply | "The only way to visually relate sub-issues to their parent on a board is to use swim-lane grouping by parent/sub-issue." |
| monday feature request [S13] | ~2026-07 ("2 months ago") | Gathering Feedback, 1 vote | flat subitem list filters wrongly, while "Group By works like you would expect" |
| Airtable community [S29] | 2024-04-30 | answered by user, not staff | "Grouping appears to only apply to the bottom most level of a Hierarchy list." |
| Smartsheet community 88174 [S28] | 2022-02-18 | employee reply 2022-02-21 | "Hierarchy is specific to sheets, so the Parent/Child relationship won't be visible in the Report" |

## Synthesis — where they disagree

**1. Which dimension wins: the tree or the grouping key.**
- Tree wins: Wrike [S1], ClickUp default [S4], Asana (likely) [S21], Jira board swimlanes [S14].
- Key wins: Linear [S25], and every product's flat opt-in mode [S4][S7][S12].
- Both at once: only MS Project desktop, by **duplicating ancestors** into each group [S30].
- Implication: no SaaS product found puts a lone subtask in a foreign group
  *and* keeps its parent visible there. The ancestor-repeat shape is a
  desktop-PM idea; its absence in SaaS is one data point about convention,
  not proof it is unwanted.

**2. The flat mode is how products escape the conflict, and it costs filtering in the tree.**
- ClickUp makes subtask filtering conditional on the flat mode [S5] — tree and
  per-row predicate are mutually exclusive there. Users call it
  "divorces them from context" [S5b].
- monday keeps both: tree display, per-subitem filter, parent chain shown [S10].
- The request that has stayed open longest (ClickUp, 2020) is for the monday
  behavior: matching child under its non-matching parent [S6].

**3. Is the hierarchy a *view mode* or a *grouping key*?**
- Notion [S7], ClickUp [S4], Jira List [S17], Airtable [S29]: a view mode (nested / flat).
- Linear: a grouping key ("Group by parent issue") [S25]; Jira board: a swimlane key [S14].
- Implication (inference): treating "parent" as one more group dimension gives
  candidate (1) when it is the outer group, and candidate (2) when it is absent.

**4. Counts follow placement.**
- Wrike counts what the group places — top-level rows — and says so [S1].
- Nobody documents counting a child that sits in a group only by inheritance.
  Consistent rule to infer (not documented): count what the grouping *key* placed.

**5. Asana dual-membership is the odd one out.**
- A subtask added to the parent's project shows as a top-level row **and**
  under its parent [S22]. That is candidate (4): the same record in two places,
  driven by project membership, not by the grouping.

## Not researched

- Jira Timeline and ClickUp/Asana timeline/Gantt views (grouping there not examined).
- monday Kanban grouping of subitems into columns (docs only say subitem columns can show on cards) [S14b].
- Mobile apps of any product.
- Reddit and third-party video walkthroughs (pointers only per the brief; none used).
- Zoho Projects, Workfront, Height, Coda, Basecamp.

## Unverified

- **monday main-table Group by with subitems**: the column list [S9] names no
  subitem column; a community thread "Group by Subitem"
  (`community.monday.com/t/group-by-subitem/118671`) surfaced in search but
  returned 404. Confirm by opening a board in the app.
- **Jira List: can hierarchy and grouping be on together?** A search summary
  attributed "hierarchy doesn't work when grouping or filtering because
  hierarchy and grouping/filtering use different data structures" to the
  Atlassian Community post "Introducing hierarchy in the All work view" —
  the page is JS-rendered and returned only its title. The launch note [S17]
  names both features but not their interaction.
- **Asana placement under grouping**: the staff launch post [S19] confirms subtasks
  are visible with grouping on but not *where*. "Only parent tasks are visible
  using the Group, Sort & Filter buttons" is a Forum Leader, dated 2025-01-21,
  *after* the launch [S21] — possibly stale. Help Center article is JS-rendered.
- **Linear sub-issue placement when grouped by status in a list**: inferred
  from sub-issues being ordinary rows [S25] and board cards being "standalone"
  (user issue [S26]). No Linear doc states the list case.
- **Notion flattened list shows a parent reference inline**, and the extra
  "only parent" / "disabled" display modes: search summary only; the help page
  read here lists "Nested in toggle" and "Flattened list" only [S7].
- **ClickUp**: group header counts and sibling sort order — not in any article read.
- **Jira board**: that a subtask card sits in its own status column inside
  the parent's swimlane — the swimlane page [S14c] defers to "Configure
  columns", not read.

## Sources

| ID | Claim | URL | Read |
|---|---|---|---|
| S1 | Wrike: only first level grouped; count and subtotals exclude subitems; filter/assignee note; all plans (updated 2026-09-24) | https://help.wrike.com/api/v2/help_center/en-us/articles/23627106993943.json | 2026-09-27 |
| S2 | Wrike Table view expand/collapse subitems (updated 2026-09-24) | https://help.wrike.com/api/v2/help_center/en-us/articles/360005778794.json | 2026-09-27 |
| S4 | ClickUp: Collapse all / Expand all / As separate tasks (updated 2026-09-26) | https://help.clickup.com/api/v2/help_center/en-us/articles/6310382044567.json | 2026-09-27 |
| S4b | ClickUp Customize List view: same three modes (updated 2026-09-22) | https://help.clickup.com/api/v2/help_center/en-us/articles/7255389296919.json | 2026-09-27 |
| S5 | ClickUp: "To include subtasks in search or filtered results, subtasks must be displayed As separate tasks"; separate subtasks "stay connected to the parent task" (updated 2026-09-18) | https://help.clickup.com/api/v2/help_center/en-us/articles/6308875427223.json | 2026-09-27 |
| S5b | ClickUp feedback: filter subtask assignees keeping parent collapsed (2026-02-11, 7 voters) | https://feedback.clickup.com/feature-requests/p/filtering-subtask-assignees-while-keeping-parent-tasks-collapsed-in-list-view | 2026-09-27 |
| S6 | ClickUp feedback: filter subtasks by parent status (2020-10-08, 65 voters) | https://feedback.clickup.com/feature-requests/p/filter-subtasks-based-on-the-status-of-their-parent-task | 2026-09-27 |
| S7 | Notion: sub-item display modes and three filter modes | https://www.notion.com/help/tasks-and-dependencies | 2026-09-27 |
| S8 | Notion grouping: group header summarizes items, count by default (third-party, secondary) | https://www.notion.vip/insights/the-grouping-guide | 2026-09-27 |
| S9 | monday Group by: supported column list, 500 groups (updated 2025-03-18) | https://support.monday.com/api/v2/help_center/en-us/articles/4452237638546.json | 2026-09-27 |
| S9b | monday: parent summarizes subitem columns (updated 2026-09-15) | https://support.monday.com/api/v2/help_center/en-us/articles/360011905480.json | 2026-09-27 |
| S10 | monday multi-level subitems: results "with context", parent chain, siblings hidden, rollups, all plans (updated 2026-09-25) | https://support.monday.com/api/v2/help_center/en-us/articles/29810815287570.json | 2026-09-27 |
| S11 | monday advanced filters: subitem match shown "along with their parent item"; AND/OR across levels (updated 2026-04-19) | https://support.monday.com/api/v2/help_center/en-us/articles/25722908508946.json | 2026-09-27 |
| S12 | monday List View widget: three subitem display modes + Group By (updated 2026-08-18) | https://support.monday.com/api/v2/help_center/en-us/articles/26334467738898.json | 2026-09-27 |
| S13 | monday feature request: fix List View filtering (user) | https://community.monday.com/feature-requests/post/fix-list-view-filtering-IRmI8X4VR3BEKWk | 2026-09-27 |
| S14 | Jira team-managed board: Group by Subtask, parent in swimlane header | https://support.atlassian.com/jira-software-cloud/docs/manage-subtasks-in-team-managed-projects/ | 2026-09-27 |
| S14b | monday Kanban: subitem columns on card (updated 2026-09-23) | https://support.monday.com/api/v2/help_center/en-us/articles/360000661379.json | 2026-09-27 |
| S14c | Jira swimlanes "Stories": one parent per swimlane | https://support.atlassian.com/jira-software-cloud/docs/configure-swimlanes/ | 2026-09-27 |
| S15 | Jira List: "child work items will stay with their parent" when sorting | https://support.atlassian.com/jira-software-cloud/docs/filter-sort-copy-and-rank-work-items-in-the-list/ | 2026-09-27 |
| S15b | Jira List: groupable fields list | https://support.atlassian.com/jira-software-cloud/docs/organize-the-list-view/ | 2026-09-27 |
| S16 | JRACLOUD-90536: keep nesting under filter (2024-09-16, Gathering Interest, 7 votes) | https://jira.atlassian.com/browse/JRACLOUD-90536 | 2026-09-27 |
| S17 | Jira launch note: List hierarchy toggle, grouping, saved views (2026-07-27) | https://jirareleases.atlassian.com/announcements/a-more-powerful-list-view-for-the-way-your-team-actually-works | 2026-09-27 |
| S17b | JWMCLOUD-81: nested subtasks in list view (Closed/Fixed) | https://jira.atlassian.com/browse/JWMCLOUD-81 | 2026-09-27 |
| S18 | Jira Plans "Show full hierarchy" — Premium/Enterprise | https://support.atlassian.com/jira-software-cloud/docs/show-full-hierarchy-while-filtering-issues-on-your-timeline/ | 2026-09-27 |
| S18b | Jira Plans groupable fields (status not in the list) | https://support.atlassian.com/jira-software-cloud/docs/group-issues-on-your-advanced-roadmaps-timeline/ | 2026-09-27 |
| S19 | Asana forum 71920: staff launch 2024-10-11, 179 posts | https://forum.asana.com/t/71920/last.json | 2026-09-27 |
| S20 | Asana staff 2024-02-26: group-by options introduced | https://forum.asana.com/t/introducing-flexible-ways-to-organize-your-tasks-in-list-and-board-views/698744.json | 2026-09-27 |
| S21 | Asana Forum Leader 2025-01-21: only parents in Group/Sort/Filter | https://forum.asana.com/t/including-subtasks-in-filtering-or-grouping-in-an-asana-project/1015761.json | 2026-09-27 |
| S22 | Asana Forum Leader 2026-08-21: subtask added to project appears top-level and as subtask | https://forum.asana.com/t/showing-parent-tasks-on-a-subtask-row-in-list-view/1152944.json | 2026-09-27 |
| S23 | Asana staff 2026-05-25: expand parent in My Tasks grid to first-level subtasks | https://forum.asana.com/t/see-your-subtasks-directly-in-my-tasks-grid/1142232.json | 2026-09-27 |
| S24 | Linear: sub-issue "Order by" per user; filters for top-level / sub-issues only | https://linear.app/docs/parent-and-sub-issues | 2026-09-27 |
| S25 | Linear: sub-issues toggle; group-by options incl. parent issue; header count/estimate toggle | https://linear.app/docs/display-options | 2026-09-27 |
| S25b | Linear changelog 2023-07-20: "Parent issue: " tooltip prefix in lists | https://linear.app/changelog/page/10 | 2026-09-27 |
| S26 | linear/linear #1192 (user, 2026-06-17): board sub-issues have no visual link to parent | https://github.com/linear/linear/issues/1192 | 2026-09-27 |
| S27 | Smartsheet: grouping is a report feature, up to three groups, plan list | https://help.smartsheet.com/articles/2482082-group-data-your-report | 2026-09-27 |
| S28 | Smartsheet employee 2022-02-21: hierarchy not visible in reports | https://community.smartsheet.com/api/v2/comments?discussionID=88174 | 2026-09-27 |
| S29 | Airtable community 2024: grouping applies to bottom-most hierarchy level (user) | https://community.airtable.com/interface-designer-12/grouping-list-view-by-status-if-showing-nested-records-levels-39106 | 2026-09-27 |
| S29b | Airtable List view launch 2023-02-07 (PM): four levels; no reorder within same parent | https://community.airtable.com/announcements-6/new-list-view-1470 | 2026-09-27 |
| S30 | MS Project: GroupMaintainHierarchy — summary tasks shown in each group when on | https://learn.microsoft.com/en-us/office/vba/api/project.application.groupmaintainhierarchy | 2026-09-27 |
