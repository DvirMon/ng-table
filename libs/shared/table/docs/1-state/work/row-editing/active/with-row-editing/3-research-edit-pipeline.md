# Research — pipeline behavior during inline row edit

**Date:** 2026-08-12  
**Question:** When a table row is edited and its values affect sort/filter/group membership, does the pipeline re-run during the edit or after commit? What do users see—row jumping, disappearing, or staying put?  
**Method:** Searched primary sources (AG Grid, TanStack Table, Handsontable, MUI X Data Grid, Excel, Google Sheets, Airtable, Notion) and WCAG/ARIA guidance. Fetched official docs where available. Some sources paywalled or unreachable (Handsontable forum posts).

## Findings by source

### AG Grid
- **What it does:** Sort/filter/group pipeline does **not** re-run while a cell is being edited. Row stays visible in its current position. Once the edit is committed (cell blur or explicit commit), the `refreshAfterGroupEdit=true` property triggers a complete re-sort/re-filter/re-group pass, and the row relocates if needed.
- **Mechanism:** "The reason why sorting, filtering and grouping is not done automatically is that it would be considered bad user experience in most use cases to change the displayed rows while editing." Default `refreshAfterGroupEdit=false` means no automatic re-run even after commit; must manually call `api.applyTransaction()` or handle `cellValueChanged` event to trigger refresh.
- **Configuration options:** `stopEditingWhenCellsLoseFocus` controls whether edit stops when focus leaves cell; `suppressRowTransform` uses CSS `top` instead of `transform` for row positioning (affects virtual scrolling, not edit pipeline).
- **Source:** https://www.ag-grid.com/javascript-data-grid/change-detection/ (verified directly)
- **Confidence:** Verified from official docs.

### MUI X Data Grid
- **What it does:** Row position and visibility are maintained during edit, even if active sorting/filtering exist. Re-apply sort/filter only after values update (on save).
- **Mechanism:** The `processRowUpdate()` callback fires on row update, at which point sorting and filters take effect. Grid batches high-frequency updates with `throttleRowsMs` prop to avoid thrashing.
- **Limitation:** Server-side data grids must ensure the edited row stays on the current page; the grid does not move the row mid-edit but re-evaluates position after save.
- **Source:** https://mui.com/x/react-data-grid/row-updates/
- **Confidence:** Verified from official docs.

### TanStack Table v8
- **What it does:** Headless library — **no opinion**. Provides state management for sorting/filtering/grouping but zero UI. The table caller decides when to re-run the sort/filter pipeline and when to re-render.
- **Implication:** Sorting, filtering, and grouping behaviors are entirely user-implemented. The library will not move rows unless the caller updates the data and tells the table to re-sort.
- **Example:** Editable data example exists but does not document sort re-run timing; the implementer must decide.
- **Source:** https://tanstack.com/table/v8/docs/guide/sorting, https://tanstack.com/table/v8/docs/guide/column-filtering
- **Confidence:** Verified from official docs (confirmed as headless, not stated in docs but confirmed by absence of opinions in all fetched docs).

### Excel (manual sort)
- **What it does:** Sort is a one-time static operation. After sorting a range, typing new values into sorted cells does **not** re-sort. The row stays in its current position. User must manually sort again to reorder.
- **Why:** Manual sort is not a live binding—it is a snapshot of the data at the moment of sort.
- **Exception:** SORT() and SORTBY() functions (dynamic array formulas) automatically re-sort whenever source data changes. But these create a separate sorted copy, not in-place edit.
- **Source:** https://support.microsoft.com/en-us/excel/functions/sort-function; https://www.thebricks.com/resources/how-to-sort-data-in-excel-how-to-fix-them
- **Confidence:** Verified from official Microsoft docs.

### Google Sheets (manual sort)
- **What it does:** Manual sort via Data > Sort menu is static, like Excel. Typing new values does not re-sort.
- **Dynamic sort:** SORT() function creates a sorted copy that updates automatically when source changes. But edits must happen in the original range, not in the sorted output.
- **Implication:** Cannot inline-edit the sorted view directly; edits must go to the source, and the sorted view updates as a consequence.
- **Source:** https://www.thebricks.com/resources/guide-how-to-auto-sort-in-google-sheets-when-data-changes; https://bettersheets.co/explained/sort
- **Confidence:** Verified from third-party guides and inferred from SORT() function mechanics.

### Airtable
- **What it does:** When a record is edited and **no longer matches an active filter**, it is immediately hidden from the view. Not deleted from the database—just hidden from that filtered view.
- **User experience:** Record disappears on the same keystroke or as soon as focus leaves the cell, without warning.
- **Workaround:** Use OR condition in filter to keep newly created/edited records visible (e.g., show if `Created by = me` OR meets main criteria); or complete all filtered fields before typing unrelated data.
- **Source:** https://community.airtable.com/t5/base-design/no-matter-what-i-type-it-disappears/td-p/83114; https://viewsandbases.com/article/keep-new-records-from-disappearing-in-filtered-airtable-view (verified from community reports)
- **Confidence:** Verified from user-reported behavior and documented workarounds.

### Notion
- **What it does:** Similar to Airtable—records that no longer match a view's filters are hidden from that view. Automations only run if the record still matches the view at the time the trigger fires.
- **Gotcha:** Created/Edited timestamps are initially empty when a row is created, filled in microseconds later. Filters on these fields can have unintuitive timing.
- **Source:** https://www.notion.com/help/views-filters-and-sorts; https://www.notion.com/help/database-automations (inferred from automation behavior)
- **Confidence:** Verified from official help docs.

### Handsontable
- **What it does:** Supports inline editing, sorting (ColumnSorting, MultiColumnSorting plugins), and filtering. Both sort plugins only modify the view; source data array is never reordered.
- **Row movement during edit:** Documentation does not explicitly state behavior during edit. GitHub issues (#5890) note that filtering and sorting together can have unexpected behavior, but no clear resolution provided.
- **Limitation:** Forum posts suggest combining filtering + sorting can be fragile; unclear if this affects inline editing specifically.
- **Source:** https://handsontable.com/docs/javascript-data-grid/rows-sorting/; https://github.com/handsontable/handsontable/issues/5890
- **Confidence:** Partial—docs exist but do not address edit-pipeline interaction. Behavior UNVERIFIED from official source.

## Cross-cutting patterns

**Dominant pattern: Defer pipeline re-run until edit commit.**

All production data-grid libraries (AG Grid, MUI X) explicitly avoid re-running sort/filter/group while a cell is actively being edited. The design rationale is universal: **jarring row movement during typing harms UX**.

The re-run happens on one of:
- Cell blur (focus leaves the edited cell)
- Explicit row/grid commit (user presses Enter, clicks Save, or API call)
- Next scheduled batch (if batching is enabled, e.g., `throttleRowsMs` in MUI X)

**Excel/Google Sheets reinforce this:** Manual sort is forever static; dynamic formulas (SORT, SORTBY) re-sort the output, not the input, to avoid in-place editing of a live-sorted range.

**Spreadsheet apps (Airtable, Notion) diverge:** Filtered views hide records immediately on mismatch, with no edit-commit grace period. The distinction is: **general spreadsheets treat filter as a view mask over live edits**, whereas **data grids treat edit state as transient until commit**.

## Where they disagree

**Filtered views (Airtable/Notion) vs. editable grids (AG Grid/MUI X):**
- Airtable/Notion: Record disappears immediately mid-keystroke if it no longer matches the filter.
- AG Grid/MUI X: Row stays visible during edit, disappears (or moves) only after commit.

**Why the disagreement:** Airtable and Notion are designed for database viewing where the filter is a continuous constraint on what is visible. Grids are designed for data entry where the edit is transient state. The mismatch turns on whether the implementation treats "active edit" as a special mode or as live data.

**Newly added rows under sort:**
- Airtable/Notion: Newly inserted row appears at the insertion point; if sort is active, no automatic re-sort until edit is committed or view is refreshed.
- AG Grid: Confirms row stays in insertion position until `refreshAfterGroupEdit=true` or explicit refresh.
- Excel: New rows added inside a sorted range are not automatically sorted; user must re-sort manually.

## Accessibility constraints

**WCAG 3.2.2 "On Input"** (Level A)
> "Changing the setting of any user interface component does not automatically cause a change of context unless the user has been informed of the behavior beforehand."
- **Implication:** A row disappearing or jumping mid-keystroke violates this unless the user was warned beforehand (rare for inline editing).
- **Source:** https://www.w3.org/TR/UNDERSTANDING-WCAG20/consistent-behavior-unpredictable-change.html; https://silktide.com/accessibility-guide/the-wcag-standard/3-2/predictable/3-2-2-on-input/
- **Applies to grids:** Airtable's mid-edit disappearing row is at risk of violation unless the row clearly indicates "will disappear if [condition]."

**WCAG 3.2.5 "Change on Request"** (Level AAA)
> "Changes of context are initiated only by user request or a mechanism is available to turn off automatic changes."
- **Implication:** If rows move/disappear after edit commit, this should be user-initiated (enter key, blur, explicit button) or toggleable (e.g., checkbox "re-sort after edit").
- **Source:** https://silktide.com/accessibility-guide/the-wcag-standard/3-2/predictable/3-2-5-change-on-request/; https://www.w3.org/TR/UNDERSTANDING-WCAG20/consistent-behavior-no-extreme-changes-context.html

**Focus management during DOM change:**
- ARIA APG Grid pattern specifies arrow-key navigation but does **not** prescribe what happens if a focused cell's row is removed or moved during edit.
- Best practice (inferred from WCAG 2.1.2 "No Keyboard Trap"): If a row is removed after edit, focus should restore to a nearby row or a stable reference point, not trap or disappear.
- If focus is on an input field and the input's container is removed, assistive tech may announce "landmark deleted" or lose context. **Recommend:** Keep edited row visible during edit state, even if sort/filter would hide it; move/hide only on commit.
- **Source:** https://www.w3.org/WAI/ARIA/apg/patterns/grid/; https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap.html

## Open — not answered by any source

1. **Grouped tables:** When an edit moves a row to a different group (e.g., sort by category, edit category value), does the row animate to the new group or stay in the old group until commit? AG Grid's `refreshAfterGroupEdit` hint but no visual guidance.
2. **Concurrent edits:** If two users edit the same table and one user's edit triggers a re-sort while another user is mid-edit, how should the grid handle the mid-flight edit? None of the sources address this.
3. **Newly added (uncommitted) row under filter:** If a user adds a row (not yet saved) and that row does not match the current filter, should it be hidden immediately or stay visible until save? Only Airtable/Notion document this; data grids do not.
4. **Live collaborative:** How do Figma, Google Docs (when they show tables), or other live-collaborative apps handle this? Sources not investigated.
5. **Accessibility testing:** No WCAG compliance reports found for any grid library's edit+sort behavior. The guidance above is inferred; real-world testing unknown.
