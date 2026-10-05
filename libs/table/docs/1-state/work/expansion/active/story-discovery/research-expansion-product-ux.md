# How do shipped products let a person open one row's detail without leaving the list?

**Date:** 2026-09-30 · **Mode:** product-ux

## Answer

- The everyday expectation is a **right-side panel** next to a list that stays visible.
  Notion (default for Table), Jira (GA 2026-09-15), monday.com, GitHub Projects, and
  Smartsheet table view all work this way. A **centered modal** is the main alternative
  (Airtable, Smartsheet grid, plus an opt-in mode in Notion, ClickUp and Jira).
- **No product surveyed documents detail opening inline, under the row.** Every inline
  expand/collapse in these products is sub-items, which is the tree feature, not this one.
  An inline detail panel is a data-grid library pattern, not an end-user product pattern.
- **Space opens and Esc closes** in Airtable, Linear and GitHub Projects. Arrow keys
  move to the next or previous row while the panel stays open (Jira, Linear, Airtable,
  Notion). The documented model is **one panel open at a time, and you step through rows**.
- The biggest pain is **losing a person's chosen mode**. Jira's removal of its detail view
  drew a 221-vote suggestion ticket and a public apology. Notion, ClickUp and Jira all ended
  up letting the person pick the mode.
- No product documents what happens when detail fails to load. Only Airtable documents
  what happens when the open row stops matching the filter.

## Method and source reliability

- Every page was read on **2026-09-30** with WebFetch. Search-engine summaries were used only
  to find pages. A claim that rests on a summary alone is listed under Unverified.
- **Product set.** Uses the caller's set: Jira, Airtable, Notion, Linear, monday.com,
  ClickUp, Smartsheet, GitHub Projects. Asana was left out because the caller's set did not
  include it.
- **Version drift.** SaaS products carry no version numbers, so the read date is the pin.
  - Airtable pages show only a relative date ("Last updated: 1 month ago"), which means
    about 2026-08. The keyboard-shortcut page's date came from a search summary
    ("August 7, 2026"), not from the page itself.
  - These pages showed **no updated date**: Notion help (views, keyboard shortcuts), Linear
    docs (peek), GitHub keyboard-shortcut docs, Jira preview-panel doc (footer year 2026
    only), Jira scrum backlog doc, and the Smartsheet keyboard-shortcut page.
- **Blocked pages.** support.monday.com and help.clickup.com returned **HTTP 403**. The
  Atlassian community article pages render with JavaScript and returned only their titles.
  monday.com and ClickUp behavior therefore rests on community and feedback posts plus one
  third-party tutorial, and is flagged below.
- **Reliability of counts. The numbers do not compare across trackers.**
  - `jira.atlassian.com` **votes** are logged-in votes on a Suggestion ticket, which
    Atlassian uses for prioritisation. 221 is strong signal on that tracker.
  - `feedback.clickup.com` **voters** are listed by name. 4 voters is weak signal, but the
    comment wording is usable evidence.
  - `community.monday.com` **upvotes/replies**: 1 upvote and 5 replies is weak signal. The
    only exact date is a screenshot timestamp (2025-04-07).
  - `community.airtable.com` "115 replies" counts **replies, not votes**, so it measures
    engagement rather than demand.
- The staff/user split follows the source-protocol note: an Atlassian update on a
  JRACLOUD ticket is staff. The Airtable filter explanation came from a **user**
  (kuovonne), not staff.

## Findings

### F1. Where detail opens

| Product                    | Opens as                                                                                                    | Opened by                       | List visible and usable?                                                                    | Plan                                                    | Source                                                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Notion                     | **Side peek** by default for Table, Board, List and Timeline. Center peek or full page can be set per view. | Click a page/row                | Yes: "The rest of the database view continues to be interactive on the left."               | No gate found                                           | [notion-views](https://www.notion.com/help/views-filters-and-sorts)                                                                    |
| Notion                     | Side peek default since 2022-07-20                                                                          | —                               | "keep your database items visible and interactive"                                          | —                                                       | [notion-rel-2022](https://www.notion.com/releases/2022-07-20)                                                                          |
| Jira (List, global search) | **Preview panel on the right**, resizable. Full-screen icon. Modal option.                                  | "select the work item"          | Implied (resizable side panel). Not stated.                                                 | No gate found                                           | [jira-preview-doc](https://support.atlassian.com/jira-software-cloud/docs/preview-work-items-in-jira-search-and-the-list-view/)        |
| Jira (List)                | Modal as a second mode. The choice persists within the session.                                             | —                               | —                                                                                           | —                                                       | [JRACLOUD-96809](https://jira.atlassian.com/browse/JRACLOUD-96809)                                                                     |
| Jira (backlog)             | "work item detail view"                                                                                     | "Select a work item"            | Not stated                                                                                  | —                                                       | [jira-backlog-doc](https://support.atlassian.com/jira-software-cloud/docs/use-your-scrum-backlog/)                                     |
| Airtable (grid)            | **Expanded record** (not described as a panel on the pages read; see Unverified)                            | Click a cell, then Space        | "use Esc to return to table"                                                                | No gate found                                           | [airtable-grid](https://support.airtable.com/docs/airtable-grid-view)                                                                  |
| Linear                     | **Peek**: a Quicklook-style preview of the focused issue                                                    | Space (toggle), or hold Space   | Yes: ↑/↓ moves through the list while peek updates                                          | "available on many issue and project views"             | [linear-peek](https://linear.app/docs/peek.md)                                                                                         |
| GitHub Projects (table)    | **Item side panel**, which can be deep-linked by URL                                                        | Space ("Open selected item")    | Not stated                                                                                  | No gate found                                           | [gh-shortcuts](https://docs.github.com/en/get-started/accessibility/keyboard-shortcuts)                                                |
| GitHub Projects            | Deep link opens "the item side-panel" (2023-01-05)                                                          | URL                             | —                                                                                           | —                                                       | [gh-changelog-2023](https://github.blog/changelog/2023-01-05-github-issues-january-5th-update/)                                        |
| Smartsheet (table view)    | **Right panel** with details, conversations and attachments                                                 | **Double-click the row number** | Not stated                                                                                  | **Pro, Business, Enterprise, Advanced Work Management** | [ss-table-view](https://www.smartsheet.com/content-center/expanded-row-details-attachments-and-conversations-table-view-now-generally) |
| Smartsheet (grid)          | "**Edit Row** dialog"                                                                                       | Ctrl+E / Cmd+E                  | Dialog (list blocked, inferred)                                                             | "Smartsheet"                                            | [ss-shortcuts](https://help.smartsheet.com/articles/522200-keyboard-shortcuts)                                                         |
| monday.com                 | Sliding window on the right. Replaced a centered pop-up in about April 2025.                                | Click the item name             | "can no longer see both the item columns and card updates"                                  | Not found                                               | [monday-community](https://community.monday.com/t/item-card-layout-change-is-terrible/112766) (user post)                              |
| monday.com                 | Item view with the Updates section in the right panel                                                       | "click the item's name"         | —                                                                                           | —                                                       | [guideflow-monday](https://www.guideflow.com/tutorial/how-to-post-a-new-update-to-an-item-in-mondaycom) (**secondary, third-party**)   |
| ClickUp                    | Modal pop-up replaced (Nov 2024, "With the chat update")                                                    | —                               | The modal let you "still see the List below it, quickly click out, then click another task" | —                                                       | [clickup-fb-modal](https://feedback.clickup.com/feature-requests/p/bring-back-modal-pop-up-as-a-task-view)                             |

### F2. Keyboard

| Product           | Open                                             | Close               | Next / previous while open                                             | Source                                                                                                                          |
| ----------------- | ------------------------------------------------ | ------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Airtable          | Space (record). Shift+Space (cell).              | Esc                 | Ctrl/Cmd+Shift+`<` / `>` (also `,` / `.`)                              | [airtable-kbd](https://support.airtable.com/docs/airtable-keyboard-shortcuts)                                                   |
| Linear            | Space (toggle), hold Space (temporary)           | Esc, or Space again | ↑ / ↓                                                                  | [linear-peek](https://linear.app/docs/peek.md)                                                                                  |
| Linear            | Shortcut changed from Alt to Space on 2019-09-24 | —                   | —                                                                      | [linear-changelog-2019](https://linear.app/changelog/2019-09-23-improved-peek)                                                  |
| GitHub Projects   | Space                                            | Not documented      | Arrow keys move focus (grid navigation)                                | [gh-shortcuts](https://docs.github.com/en/get-started/accessibility/keyboard-shortcuts)                                         |
| Jira              | Not documented                                   | Not documented      | ↑ / ↓                                                                  | [jira-preview-doc](https://support.atlassian.com/jira-software-cloud/docs/preview-work-items-in-jira-search-and-the-list-view/) |
| Notion            | No database-specific opener documented           | Not documented      | Ctrl+Shift+K / J (Mac), Ctrl+K / J (Win) "while in database peek view" | [notion-kbd](https://www.notion.com/help/keyboard-shortcuts)                                                                    |
| Smartsheet (grid) | Ctrl/Cmd+E (Edit Row dialog)                     | —                   | —                                                                      | [ss-shortcuts](https://help.smartsheet.com/articles/522200-keyboard-shortcuts)                                                  |

### F3. Several open at once

- No page read documents opening two rows' details at the same time. Every product that
  documents navigation lets you **step through rows in one panel** instead: Jira ↑/↓
  ([jira-preview-doc](https://support.atlassian.com/jira-software-cloud/docs/preview-work-items-in-jira-search-and-the-list-view/)),
  Linear ↑/↓ ([linear-peek](https://linear.app/docs/peek.md)), Airtable next/prev record
  ([airtable-kbd](https://support.airtable.com/docs/airtable-keyboard-shortcuts)), Notion
  next/prev page ([notion-kbd](https://www.notion.com/help/keyboard-shortcuts)).
- Atlassian names stepping through as a core need: "the ability to open a work item with
  enough space to see the necessary context, and to quickly step through your list of work
  items" (update of 2026-06-17,
  [JRACLOUD-96809](https://jira.atlassian.com/browse/JRACLOUD-96809)).

### F4. Staying open across sort and filter

- **Airtable is the only documented case.** A record edited so that it no longer matches
  the view's filter **stays open**. The message reads: "Record filtered: no longer visible
  on this views filter and will be hidden when you select another record". Quoted verbatim
  by the reporter, 2020-11-12. A user answer explains it: "it is hidden as soon as you move
  away from that record" (kuovonne, **user, not staff**, 2020-11-13)
  ([airtable-community-filter](https://community.airtable.com/t5/base-design/no-matter-what-i-type-it-disappears/m-p/83116)).
  The thread is from **2020**, so current behavior is unconfirmed.
- An end user hit this as data loss. Reporter's own words: "any data I input is now gone"
  (same thread).
- Jira persists the **open mode** (modal or panel) within a session: "once you've opened a
  work item in the modal, clicking another opens it in the modal too" (update of 2026-06-30,
  [JRACLOUD-96809](https://jira.atlassian.com/browse/JRACLOUD-96809)). This is the mode, not
  which row is open.
- No other product documents whether an open panel survives a sort or a filter change.

### F5. Load failure

- None of the pages read documents a loading state, an error state, or a retry for the
  detail panel.

### F6. Pain: who complained, and about what

| Source                                                                                                                | Opened                                        | State (read 2026-09-30)                               | What was said                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [JRACLOUD-96809](https://jira.atlassian.com/browse/JRACLOUD-96809)                                                    | 2025-11-26                                    | Suggestion, **In Progress**. 221 votes, 157 watchers. | Panel "can feel cramped, especially on smaller screens". Atlassian, 2026-06-17: "We removed something that mattered to your daily workflows". GA 2026-09-15. They offered a modal plus navigation arrows instead of an admin toggle. |
| [monday-community](https://community.monday.com/t/item-card-layout-change-is-terrible/112766)                         | about April 2025 (screenshot date 2025-04-07) | 1 upvote, 5 replies                                   | "you can no longer see both the item columns and card updates at the same time" (user).                                                                                                                                              |
| [clickup-fb-modal](https://feedback.clickup.com/feature-requests/p/bring-back-modal-pop-up-as-a-task-view)            | 2024-11-11                                    | 4 voters, no staff reply                              | "I'd like to see the modal pop-up for tasks brought back". A comment on 2024-11-14 says the modal let you "still see the List below it, quickly click out, then click another task".                                                 |
| [airtable-announce-2022](https://community.airtable.com/announcements-6/improvements-to-expand-and-edit-records-1436) | 2022-01-26 (staff post)                       | 115 replies, mostly negative                          | Expanded-record redesign. A reply says it produced "900 questions and complaints" from five team members.                                                                                                                            |

## Synthesis: where they disagree

**Surface (panel, modal, peek or inline).**

- Split: side panel (Notion, Jira, monday.com, GitHub, Smartsheet table view) versus modal
  (Airtable, Smartsheet grid).
- **Three vendors stopped choosing and let the person decide:** Notion per view, Jira per
  session, and ClickUp per user (ClickUp from a search summary only; see Unverified).
- Disagreement that ends in "let the person choose" means no mode wins for everyone.
- **Inline-under-the-row appears in none of them.** That does not make it wrong. It means
  the product set sets **no everyday expectation** for its layout, so this repo's inline
  panel can set its own. It inherits expectations only on the other axes: keyboard, one
  open at a time, and stepping through rows.

**Keyboard.**

- Space to open is the majority (Airtable, Linear, GitHub). Smartsheet uses Ctrl/Cmd+E.
  Notion documents no database-specific opener.
- Everyone who documents it agrees on Esc to close and on next/previous while open.
  They disagree on the keys: plain arrows (Jira, Linear) versus modified keys (Airtable,
  Notion).
- Plain arrows only work where the panel does not take focus from the list.

**One open versus many.**

- There is no disagreement: nobody documents more than one open. That silence is one data
  point about convention, not proof that multiple-open is wrong.
- Note for an inline panel: inline layout makes several open panels physically possible,
  which a side panel does not. Whether to allow it is a decision this survey cannot borrow.

**Survival across filter.**

- Only Airtable speaks. It keeps the open row visible until the person moves away, and
  shows a message saying so.
- The complaint that thread records is the failure to avoid: the row vanished silently
  after an edit, and the person read it as data loss.

**Plan gating.**

- Only Smartsheet gates this: the table-view right panel requires Pro and up. In the same
  product, grid view's Edit Row dialog is ungated.
- No other vendor gates row detail. Detail-on-demand is baseline, not a paid feature.

**Everyday expectation to lean on.**

- Opening a row's detail must not lose your place in the list.
- Space opens, Esc closes, arrows step to the next row.
- Only one row's detail is open at a time.
- Once a person picks a mode, it stays picked.

## Not researched

- Asana, Wrike, MS Project, Google Sheets and Excel (outside the caller's set).
- Mobile apps for every product.
- Screen-reader and focus behavior when a panel opens (where focus goes, focus return on
  close).
- Template galleries and public demo boards. Video walkthroughs were not used.
- Forums beyond one or two threads per product. No systematic count of complaints.

## Unverified

- **ClickUp's three modes** (Full screen, Modal, Sidebar), the per-user preferred mode, and
  "Clicking outside the task modal will close the task". This came from a search summary
  of `help.clickup.com/.../29665520762647-Task-layouts`, and the page returned 403. To
  confirm, read the page in a browser.
- **monday.com's official help** on item view and item card (403). The side-window behavior
  rests on one user post plus a third-party tutorial. A Monday Labs toggle "Disable new item
  page experience" appeared only in a search summary.
- **Whether Airtable's expanded record is a modal or a side sheet.** The pages read say
  "expand" and "return to table" without naming the surface. That it is a centered modal is
  a reasonable inference, not doc-confirmed.
- **Whether the Airtable "Record filtered" behavior is current.** The thread is from 2020.
- **The Airtable shortcut page's exact date** (2026-08-07) came from a search summary. The
  page itself says "1 month ago".
- **Whether Jira's list stays interactive** while the preview panel is open. The doc does
  not say.
- **Whether any product allows two details open at once.** Nothing documents it; confirming
  absence needs hands-on use.
- **Load-failure behavior** in every product. Only observing a real failure (for example,
  throttling the network) would confirm it.
- **The Smartsheet table-view post's date** (2025-05-28) is as reported by WebFetch from a
  content-center page.

## Sources

| Id                        | URL                                                                                                                   | Read       | Page date              |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------- |
| notion-views              | https://www.notion.com/help/views-filters-and-sorts                                                                   | 2026-09-30 | none shown             |
| notion-rel-2022           | https://www.notion.com/releases/2022-07-20                                                                            | 2026-09-30 | 2022-07-20             |
| notion-kbd                | https://www.notion.com/help/keyboard-shortcuts                                                                        | 2026-09-30 | none shown             |
| jira-preview-doc          | https://support.atlassian.com/jira-software-cloud/docs/preview-work-items-in-jira-search-and-the-list-view/           | 2026-09-30 | footer 2026 only       |
| jira-backlog-doc          | https://support.atlassian.com/jira-software-cloud/docs/use-your-scrum-backlog/                                        | 2026-09-30 | none shown             |
| JRACLOUD-96809            | https://jira.atlassian.com/browse/JRACLOUD-96809                                                                      | 2026-09-30 | created 2025-11-26     |
| airtable-grid             | https://support.airtable.com/docs/airtable-grid-view                                                                  | 2026-09-30 | "1 month ago"          |
| airtable-kbd              | https://support.airtable.com/docs/airtable-keyboard-shortcuts                                                         | 2026-09-30 | "1 month ago"          |
| airtable-community-filter | https://community.airtable.com/t5/base-design/no-matter-what-i-type-it-disappears/m-p/83116                           | 2026-09-30 | 2020-11-12             |
| airtable-announce-2022    | https://community.airtable.com/announcements-6/improvements-to-expand-and-edit-records-1436                           | 2026-09-30 | 2022-01-26             |
| linear-peek               | https://linear.app/docs/peek.md                                                                                       | 2026-09-30 | none shown             |
| linear-changelog-2019     | https://linear.app/changelog/2019-09-23-improved-peek                                                                 | 2026-09-30 | 2019-09-24             |
| gh-shortcuts              | https://docs.github.com/en/get-started/accessibility/keyboard-shortcuts                                               | 2026-09-30 | none shown             |
| gh-changelog-2023         | https://github.blog/changelog/2023-01-05-github-issues-january-5th-update/                                            | 2026-09-30 | 2023-01-05             |
| ss-table-view             | https://www.smartsheet.com/content-center/expanded-row-details-attachments-and-conversations-table-view-now-generally | 2026-09-30 | 2025-05-28             |
| ss-shortcuts              | https://help.smartsheet.com/articles/522200-keyboard-shortcuts                                                        | 2026-09-30 | none shown             |
| monday-community          | https://community.monday.com/t/item-card-layout-change-is-terrible/112766                                             | 2026-09-30 | about 2025-04          |
| guideflow-monday          | https://www.guideflow.com/tutorial/how-to-post-a-new-update-to-an-item-in-mondaycom                                   | 2026-09-30 | none shown (secondary) |
| clickup-fb-modal          | https://feedback.clickup.com/feature-requests/p/bring-back-modal-pop-up-as-a-task-view                                | 2026-09-30 | 2024-11-11             |
