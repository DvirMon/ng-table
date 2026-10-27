# Step 3 test plan — Keys, click and DOM focus

Step: [step-3-keys-click-dom-focus.plan.md](step-3-keys-click-dom-focus.plan.md)
Spec file: `libs/table/src/directives/ngp-table.directive.spec.ts` (new `describe('keyboard and DOM focus')` block with its own `GridHost`; step 2 creates the file)

## Behaviour coverage

| Id   | Behaviour                                                                                | Source                                                              | Tested by                                   |
| ---- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------- |
| AC2  | The one `tabindex="0"` follows the last focused cell (click, key, `moveTo`)              | issue AC2 (moving half; binding + first-entry default are step 2's) | F, H                                        |
| AC3  | Arrows, Home/End, Ctrl+Home/End move as in APG; no wrap at an edge                       | issue AC3; spec stories 7–9, 11                                     | A (host wiring); edge handling → Not tested |
| AC4  | Next target comes from `renderRows()` / `renderColumns()` order, never DOM siblings      | issue AC4; K13                                                      | E                                           |
| AC5  | A pointer click on a cell moves the stored position                                      | issue AC5; K3b; story 5                                             | F                                           |
| AC5b | Mouse clicks show no focus ring                                                          | issue AC5; story 6                                                  | Not tested                                  |
| AC6  | `moveTo` moves DOM focus only when focus is inside the grid or `focusElement: true`      | issue AC6; K9d, K12c, K15; stories 54–55                            | J, K, I, H                                  |
| AC7  | A key event with `defaultPrevented` is ignored                                           | issue AC7; K6b; stories 30–31                                       | B                                           |
| D1   | An unhandled key (`nextBodyTarget` → null) is left alone: no move, no `preventDefault()` | outline Do                                                          | C                                           |
| AC8  | Directive host specs (S2) cover the native table and the key map                         | issue AC8                                                           | Not tested (deliverable)                    |

## Stubs (red phase)

None. Every test goes through the existing directives
(`NgpTableDirective`, `NgpTableRowDirective`, `NgpTableCellDirective`)
and the shipped `table.focus` member. `focus-registry.ts` is
internal: the spec's Testing Decisions say "never internal
registries", so no test imports it. `nextBodyTarget` comes from
step 1.

Red-phase note: B, C and H check _negative_ cases. Against today's
code, which has no listeners and no sync effect, they would pass.
That breaks test-first's "must fail" rule. So each one ends with a
**positive control** that must fail before green; it is listed in
the seam's Asserts.

## Seams — in red-green order

Shared setup:

- Host component `GridHost`. An `<button>Outside</button>` sits
  next to `<table [ngpTable]="table"><tbody>`, then
  `@for (row of table.renderRows(); track row.id)`
  `<tr [ngpTableRow]="row">`, then
  `@for (col of table.renderColumns(); track col.id; let i = $index)`
  `<td [ngpTableCell]="i">`.
- Table: `createTable(data, { trackBy: mockTrackBy, columns:
createColumns(noData<MockRow>(), (col) => [col('id'),
col('name')]) })`, with `data = signal<MockRow[]>(mockRows)`
  (3 rows × 2 columns, ids 1–3).
- `setup()` returns:
  - `cell(rowId, columnId)`, found by `aria-rowindex` /
    `aria-colindex`, never by tag path;
  - `outside()`;
  - `press(target, init)`, which dispatches a `KeyboardEvent('keydown',
{ bubbles: true, cancelable: true, ...init })` and returns the event;
  - `flush()` = `TestBed.tick()` (effects, change detection,
    `afterNextRender`).
- `tabStops()` = every element in the host with `tabindex="0"`.

### A. Focused default cell + ArrowDown / ArrowRight / End / Ctrl+End → store, DOM focus and tab stop all move to the next cell

- Test: `it.each` over `[ArrowDown → (2,'id')]`, `[ArrowRight → (1,'name')]`, `[End → (1,'name')]`, `[Ctrl+End → (3,'name')]`, named `it('moves to the next cell on %s')`
- Asserts: `cell(1,'id').focus()`, flush. `press(cell(1,'id'), key)`, flush. Then:
  - `table.focus()` equals `{ area: 'body', rowId, columnId }`;
  - `document.activeElement` is that cell;
  - `tabStops()` is exactly `[that cell]`;
  - `event.defaultPrevented` is `true`.
- Covers: AC3
- Risk: damage high, likelihood high
- Why this seam: the base case. It catches:
  - a missing or unbound `(keydown)` listener;
  - order built from the wrong source (e.g. `rows()`, or columns by index rather than id);
  - `ctrlKey` not reaching `nextBodyTarget` (Ctrl+End would act as End);
  - a sync effect that never calls `.focus()`.

  It starts with `focus()` still `null`, so it also proves `current = activeTarget` (the first-entry default) and not `focus()`.

- Order reason: independent. It builds the listener, the cell registration and the inside-the-grid branch of the sync effect.

### B. Event already `defaultPrevented` → grid ignores it

- Test: `it('ignores a key event a consumer already prevented')`
- Asserts: `cell(1,'id').focus()`, flush. Build an ArrowDown event, call `event.preventDefault()`, dispatch it on `cell(1,'id')`, flush. Then `table.focus()` is `null` and `activeElement` is still `cell(1,'id')`. Control: an unprevented ArrowDown, flush → `table.focus()` is row 2.
- Covers: AC7
- Risk: damage high, likelihood high
- Why this seam: catches a missing `defaultPrevented` guard. Without it, every consumer override is broken: `(keydown.escape)` cancel-edit, nested grids (K6c) and feature keys (K14b) all double-handle the key.
- Order reason: builds on A (a guard at the top of A's listener).

### C. Unhandled key (Tab, a letter) → event untouched, store unchanged

- Test: `it.each(['Tab', 'a'])('leaves an unhandled %s key alone')`
- Asserts: `cell(1,'id').focus()`, flush. `press(cell(1,'id'), { key })`, flush. Then `event.defaultPrevented` is `false` and `table.focus()` is `null`. Control: ArrowDown, flush → row 2.
- Covers: D1
- Risk: damage high, likelihood high
- Why this seam: catches an unconditional `preventDefault()` or a `moveTo` on a `null` result. A prevented Tab traps keyboard users inside the grid: one Tab stop in, no way out, a WCAG 2.1.2 failure.
- Order reason: builds on A (the `null` branch of A's listener).

### E. DOM rows rendered in reverse → ArrowDown follows `renderRows()`, not the next DOM sibling

- Test: `it('takes the next row from renderRows() order, not DOM order')`
- Asserts: `ReversedRowsHost` is `GridHost` with `@for` over `[...table.renderRows()].reverse()`. `cell(1,'id').focus()` (last in the DOM), flush. ArrowDown, flush. Then `table.focus()` is row 2 and `activeElement` is `cell(2,'id')`, which sits _above_ row 1 in the DOM.
- Covers: AC4
- Risk: damage high, likelihood low
- Why this seam: catches a DOM-walk implementation (`nextElementSibling`, `querySelectorAll` index). It would match render order in every ordinary template and then break under virtual scroll (K13) or any consumer reordering. This is the only seam where the two orders disagree.
- Order reason: builds on A (order construction).

### F. Focus lands on a cell, or on a focusable element inside a cell → store points at that cell, tab stop moves, DOM focus stays where the user put it

- Test: `it.each` over `[the cell itself]` and `[a <button> inside the cell]`, named `it('writes the focused cell to the store on focusin (%s)')`
- Asserts: `GridHost`'s row-2 `name` cell also contains `<button type="button">Act</button>`. Call `.focus()` on the target, flush. Then:
  - `table.focus()` equals `{ area: 'body', rowId: 2, columnId: 'name' }`;
  - `tabStops()` is exactly `[cell(2,'name')]`;
  - `activeElement` is still the focused target (the button stays focused).
- Covers: AC5, AC2
- Risk: damage high, likelihood high
- Why this seam: jsdom has no click-to-focus, so `.focus()` stands in for the browser's native focus of a `tabindex="-1"` cell (K3b). The seam catches three bugs:
  - a missing `(focusin)` listener: keyboard input continues from the old cell;
  - an exact-match lookup instead of closest registered ancestor: the button case writes nothing;
  - the sync effect re-focusing the cell after the focusin write. That pulls focus off a button the user just clicked. It is high damage: every in-cell button becomes unusable by mouse.
- Order reason: builds on A (cell registration); independent of the keydown listener.

### J. Focus inside the grid, `moveTo(other)` without `focusElement` → DOM focus follows

- Test: `it('moves DOM focus with a moveTo while focus is inside the grid')`
- Asserts: `cell(1,'id').focus()`, flush. `table.focus.moveTo({ area: 'body', rowId: 3, columnId: 'name' })`, flush. Then `activeElement` is `cell(3,'name')`.
- Covers: AC6
- Risk: damage high, likelihood low
- Why this seam: catches DOM focus done inside the keydown handler instead of the sync effect. A would still pass, but every store-side write would leave DOM focus on the old cell while `tabindex="0"` moved elsewhere. That covers consumer `moveTo`, #233 recovery and #234 follow, and leaves two elements disagreeing on "focused".
- Order reason: builds on A (same sync effect, reached by a non-key write).

### K. Focused cell's row removed, then `moveTo(other)` without `focusElement` → DOM focus follows (focus-within is remembered)

- Test: `it('still moves DOM focus after the focused cell was removed from the DOM')`
- Asserts: `cell(2,'id').focus()`, flush. `data.update((rows) => rows.filter((r) => r.id !== 2))`, flush (the focused cell is gone; `activeElement` is `document.body`). `table.focus.moveTo({ area: 'body', rowId: 3, columnId: 'id' })`, flush. Then `activeElement` is `cell(3,'id')`.
- Covers: AC6 (K9d — focus was inside the grid)
- Risk: damage high, likelihood high
- Why this seam: catches a sync effect gated on a live `host.contains(document.activeElement)` check. Removing the focused element drops focus to `<body>` without a `focusout` inside the host, so the live check says "outside" and the next write (a consumer `moveTo` now, #233 recovery later) never restores DOM focus — the keyboard user is stranded on `<body>`. The remembered focus-within flag is the fix.
- Order reason: builds on J (same sync branch, reached after the focused element disappeared).

### I. Focus outside, add a row, `moveTo(newRow, { focusElement: true })` before render → its cell gets DOM focus after render

- Test: `it('focuses a just-added row on a focusElement request once it renders')`
- Asserts: `outside().focus()`, flush. In one synchronous block:
  - `data.update((rows) => [...rows, { id: 4, name: 'Dee' }])`;
  - `table.focus.moveTo({ area: 'body', rowId: 4, columnId: 'name' }, { focusElement: true })`.

  Then flush. `activeElement` is `cell(4,'name')`.

- Covers: AC6 (story 55)
- Risk: damage high, likelihood high
- Why this seam: the K15 case, the reason the counter exists. It catches a sync effect that:
  - ignores `focusRequests()`;
  - focuses synchronously, before the new cell is registered;
  - looks the element up once and drops the request when it is missing.

  In each case the "add row, then focus it" toolbar flow focuses nothing.

- Order reason: builds on J (adds the request branch to the same effect).

### H. Focus outside, `moveTo` without a request → no DOM focus steal, ever; only the tab stop moves

- Test: `it('never moves DOM focus from outside the grid without a focusElement request')`
- Asserts:
  1. After setup's first render: `activeElement` is `document.body`.
  2. `outside().focus()`, then `moveTo` row 3 `name`, flush → `activeElement` is `outside()` and `tabStops()` is `[cell(3,'name')]`.
  3. Control: `moveTo` row 2 `name` with `{ focusElement: true }`, flush → `activeElement` is `cell(2,'name')`.
  4. `outside().focus()`, then `moveTo` row 1 `id` without a flag, flush → `activeElement` is `outside()` again.
- Covers: AC6 (story 54), AC2
- Risk: damage high, likelihood high
- Why this seam: catches three bugs:
  - an always-focus sync effect, rejected in K9d because it pulls the caret out of an outside search box on every keystroke;
  - a first-run steal: the effect treats the initial counter read as a new request and focuses on page load (step 1);
  - a stale-counter comparison (against `0`, or a value never updated), which turns every later write into a request (step 4).

  Step 4 also proves focusout to an outside element clears the remembered focus-within. The tab-stop check proves the position still moves when DOM focus does not.

- Order reason: builds on I (its control is I's request path, and step 4 checks the last-seen counter I introduces).

## Types phase (after green)

None — no public type surface in this step. The new members are
private directive fields and host bindings. `focus-registry.ts` is
internal and is not re-exported from `index.ts`.

## Not tested

- Every key's target and every edge case (Home, Ctrl+Home, first/last row, first/last column) is covered by step 1's pure `keyboard-nav.ts` spec. Here A checks only that the host passes the key and modifiers through.
- A handled key at an edge (`nextBodyTarget` returns the same position) is still `preventDefault()`ed, so the page does not scroll: over budget — damage low, likelihood high.
- `focusin` on an element inside the host but outside any registered cell (a header sort button, a caption control) writes nothing and does not throw: over budget — damage low, likelihood high. Likely in practice until #236 registers header cells.
- Mouse clicks show no focus ring: `:focus-visible` is browser behaviour; ring styling is the consumer's (ADR-0026, K3b). Not our logic.
- Cell register on render / unregister on destroy: an internal registry, which the spec's Testing Decisions bar from assertions. Its observable effects are exercised through A, F, I and K.
- Group rows excluded from the order: a stopgap filter that #240 replaces with group-header stops; a test pinning the skip would be deleted there.
- Host `role="grid"`, cell `gridcell`, `tabindex` binding, first-entry default: owned by step 2.
- `moveTo` rejecting an unrendered target: covered by `create-table.spec.ts` — `describe('focus.moveTo — unrendered target (#232)')`.
- `focusRequests()` counting: covered by `create-table.spec.ts` — 'increments focusRequests on an accepted moveTo with focusElement: true' and siblings.
- Editable-target skip and widget mode (#237); header row, Page Up/Down, RTL (#236); treegrid (#239); group headers (#240); div-host parity (#238); recovery rules (#233): out of this step's scope.
- AC8 ("S2 specs cover native table and key map"): a deliverable, satisfied by A–K existing. Not a behaviour.

## Resolved

- The sync effect skips `.focus()` when `document.activeElement` is already inside the target element (F; also in step 3's Watch out).
- This step owns a remembered focus-within flag: set on `focusin`, cleared on `focusout` whose `relatedTarget` is outside the host (seam K added).
- Step 3 adds its own describe block and `GridHost` in the shared spec file, not step 2's `setup()`.
