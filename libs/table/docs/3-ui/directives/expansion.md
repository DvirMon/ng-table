---
title: UI Layer — Expansion (ngpTablePanelToggle, ngpTablePanel)
type: architecture
version: 1.0
date: 2026-10-05
capability: expansion
spec: drilled
code: none
audience: developers
---

# UI Layer — Expansion

Two directives for **detail panels only**. `withExpansion()` owns all state; these own the accessibility: relations, `inert`, focus return, Esc. The consumer keeps writing native markup and its own `@if`.

> Tree rows — including collapsible group headers — use `ngpTableTreeRow` + `ngpTableTreeToggle` ([`tree.md`](tree.md)). After ADR-0012 the tree and the panel share no store.

Decisions: [`../../decisions/expansion.md`](../../decisions/expansion.md) E39–E58. Rationale: the #199 work folder (`../work/expansion/active/panel-directives/`). "Detail panel" is the glossary term.

| Directive             | Host                                   | Owns                                                     |
| --------------------- | -------------------------------------- | -------------------------------------------------------- |
| `ngpTablePanelToggle` | the consumer's `<button>` inside a row | click, `aria-expanded`, `data-expanded`, `aria-controls` |
| `ngpTablePanel`       | the element holding the panel content  | `id`, `inert`, Esc, `close()`, focus return              |

Distinct concerns: the toggle _causes_ the change, the panel _keeps its content safe_ while closed or closing. Both work whether the panel unmounts on close (default) or stays mounted.

## Why directives and not consumer markup

`table.expansion.toggle(id)` is one call. What the consumer would also have to write, correctly, every time: `aria-expanded`, the button-to-panel link, keeping a closing panel out of the Tab order, focus return, Esc. That is the loudest complaint in every peer library (Angular Material's keyboard-only failure, MUI's VoiceOver and Tab-order bugs); ADR-0029 makes it the directives' job.

---

## `ngpTablePanelToggle`

```html
<button ngpTablePanelToggle aria-label="Show details for {{ row.data.name }}">▸</button>
```

- **Row id from DI**, via the enclosing row directive — never an input.
- **Click:** a host `(click)` calls `table.expansion.toggle(id)`. No outputs (E53), same as `ngpTableTreeToggle`. Enter and Space come from the native `<button>`.
- **Shared core:** `isOpen`, `toggle`, `type="button"`, `aria-expanded` and `data-expanded` come from the shared collapsible trigger core (#209); this directive supplies `isOpen = expansion().has(id)` and adds `aria-controls`.
- **`aria-controls`** is bound only while the row's panel is mounted, so it never points at a missing id.
- **Opening does not move focus** (APG disclosure); the next Tab lands inside the panel.

## `ngpTablePanel`

```html
@if (table.expansion().has(row.id)) {
<tr>
  <td [attr.colspan]="visibleColumnCount()">
    <div
      [ngpTablePanel]="row.id"
      role="region"
      aria-label="Details"
      (animate.leave)="'panel-leave'"
    >
      <app-detail [row]="row.data" />
      <button (click)="panel.close()" aria-label="Close details" #panel="ngpTablePanel">×</button>
    </div>
  </td>
</tr>
}
```

- **Input:** the `RowId` (`[ngpTablePanel]="row.id"`), not a `RenderRow` (E46). Works wherever an id is held.
- **Host bindings:** `id`, and `inert` while the row is not open (covers a kept-mounted closed panel).
- **`exportAs: 'ngpTablePanel'`**, public `close()`: `collapse([id])`, then focus return.
- The panel is consumer markup, never a `renderRows()` entry (E12, E42).

### Registry and ids

An internal registry, provided by the table host (`ngpTable`) and keyed by `RowId` (E44):

- the panel registers on mount and unregisters on destroy; the toggle registers its element;
- it answers "panel id for this row, or none" and "toggle element for this row";
- it mints the DOM id: a per-table prefix + the escaped `RowId` (e.g. `ngp-t1-panel-r42`). Same row, same id on every mount and across server and client, so hydration cannot mismatch `aria-controls` (E56). `RowId` is `string | number`, hence the escaping.

**v1 scope:** a panel inside the table host only. A panel outside it (a page-level drawer) reaches neither the registry nor the store through DI — open, not decided (E57).

### `inert`

A host binding `inert = !isOpen` covers a panel that stays mounted. It cannot cover a _leaving_ panel: Angular destroys the `@if` view in the parent's update pass, before the view's own bindings refresh, so `[inert]` never turns `true` on it. The panel therefore writes `inert` once with `Renderer2.setAttribute` in its destroy hook, after focus return (E47). Destroy hooks run while the element is still connected; leave classes and removal come later. Verified against Angular 22.1.2; a spec test pins the ordering. No `effect()` writes the DOM.

A kept-mounted closed panel stays `inert` (E50). `hidden="until-found"` (find-in-page) is additive and left to #209; it cannot replace `inert` during the exit animation.

### Focus return

Runs only from owned close paths, never from an effect (E51):

| Path         | Returns focus to the toggle when                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| `close()`    | focus is inside the panel, on `<body>` (Safari does not focus a clicked button), or nowhere            |
| destroy hook | focus is **strictly inside** the panel — so a toolbar collapse-all never pulls focus to a row's toggle |

Only a connected toggle is focused. When the row itself disappears with focus inside (deleted, filtered out), panel and toggle unmount together; that is core row navigation's job (E48, #201). Not covered: something other than the panel (toolbar, API) closing a kept-mounted panel while focus is inside — the same limit as CDK Menu. Plain `.focus()`; `@angular/cdk` is not a dependency.

### Esc

A `(keydown.escape)` host listener calls `close()` and then `event.preventDefault()`, so an enclosing dialog does not also close (E49, E58). It does nothing when `event.defaultPrevented` is already set — an inner widget that handles Esc (select, combobox) opts out by handling it first; there is no input. A consumer `(keydown.escape)` **on the `ngpTablePanel` element itself** cannot opt out: Angular merges the host and template listeners into one native listener and runs the host's first. Only a handler on an element inside the panel can.

Goes beyond APG disclosure (Enter/Space only); the product doc asks for "Esc closes".

### Click and `multi`

The toggle always calls `toggle(id)`. Single-open is not the directive's job: it is state, `withExpansion({ multi?: boolean | (() => boolean) })`, default `true` ([#210](https://github.com/DvirMon/ng-table/issues/210), E54). Every writer — toggle, Esc, API, row stepping — then follows it.

### Accessible names

Consumer-owned (E55, ADR-0029 category 3). No label input, no default text, no warning: the consumer writes `aria-label` or text on the native `<button>`. The library owns relations only (`aria-expanded`, `aria-controls`, the panel `id`).

---

## A11y contract (ADR-0029 categories)

| #   | Category                         | Here                                                                                                   |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | Semantics and roles              | native `<button>` toggle; the panel's role and label are the consumer's                                |
| 2   | States and properties            | `aria-expanded` on the button (never on a row), `aria-controls`; `data-expanded` for styling           |
| 3   | Accessible names                 | consumer-owned                                                                                         |
| 4   | Keyboard operation of triggers   | native button: Enter, Space                                                                            |
| 5   | Keyboard navigation between rows | not here — core row/table directives (#201, E43); the panel plugs in                                   |
| 6   | Focus management                 | returns to the toggle on close from inside; never lost to `<body>`; opening leaves focus on the button |
| 7   | Hidden and inert content         | `inert` while closed or closing, including mid-leave                                                   |
| 8   | Live announcements               | not applicable — nothing announced beyond state changes                                                |
| 9   | Reduced motion                   | no motion shipped; the slide recipe honours `prefers-reduced-motion`                                   |

---

## Mount lifetime

**Default: unmount on close** (E40). Gate on the open set and animate with Angular's native `animate.enter` / `animate.leave`. Collapse-all frees everything; no `inert` handling in the consumer, because the directive writes it. This replaces the old keep-mounted default (E7), whose reason — "collapse animation fights teardown" — predates `animate.leave`.

```html
@if (table.expansion().has(row.id)) { …
<div [ngpTablePanel]="row.id">…</div>
}
```

**Keep-mounted** is a per-row consumer opt-in, for panels with expensive inner state:

```html
@if (table.expansion().has(row.id) || (keepMounted(row) &&
table.expansion.everExpanded().has(row.id))) { … }
```

A kept panel is `inert` while closed. `table.expansion.release(ids?)` removes ids from `everExpanded` (none = clear), never touches the open set, emits nothing (E39). Collapse-all then `release()` frees every kept panel. Memory otherwise grows with rows the user has opened.

Tree children stay gated by `renderRows()`; different cost profile — a tree can reveal thousands of rows at once, a panel is one row someone opened.

## Recipes

No stylesheet ships (ADR-0026, OQ-exp-6). Both are consumer code.

**Slide.** A `<tr>` cannot slide: on `display: table-row`, `height` is a minimum and `overflow: hidden` has no effect. The technique that works everywhere is a block wrapper inside the `<td>` animating `grid-template-rows: 0fr → 1fr`, with the wrapper's single child `overflow: hidden`. Pair it with `animate.enter` / `animate.leave` for the unmount default, and wrap the transition in `@media (prefers-reduced-motion: no-preference)`.

```css
.panel-body {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 200ms ease;
}
.panel-body.panel-leave {
  grid-template-rows: 0fr;
}
.panel-body > * {
  overflow: hidden;
}
@starting-style {
  .panel-body {
    grid-template-rows: 0fr;
  }
}
```

**Keep-mounted.** The `@if` above plus the per-row predicate; the closed state is `grid-template-rows: 0fr` keyed on `[inert]`, so a closed kept panel is also invisible. Paint-hide (`visibility: hidden`) delayed to the end of the transition, if wanted, is the consumer's.

**Expand all / collapse all.** Stay consumer-called (`table.expansion.expand()` / `collapse()`), as in the demo toolbar — no directive (OQ-exp-4).

---

## Dev-mode assertions

Both `ngDevMode`-guarded, stripped in production. They are construction checks (ADR-0014): the wiring is wrong on first run, there is no degraded reading, so they throw.

- `ngpTablePanelToggle` or `ngpTablePanel` on a table without `withExpansion()` → **throw**, naming the missing feature. The check lives in each feature's directive, not the shared core.
- A second `ngpTablePanel` mounted for a `RowId` that already has one → **throw**, naming the id. One panel per row. It fires when the row opens, not on first render, because the ids can arrive at runtime (ADR-0014's accepted risk).
- No warning for a nameless toggle (E55), none for a toggle whose panel is not mounted (that is "closed"), none for a toggle outside `ngpTableRow` (Angular's own DI error).

## Composition

Directives stay fine-grained; imports stay coarse:

```ts
export const NGP_TABLE_PANEL = [NgpTablePanelToggleDirective, NgpTablePanelDirective] as const;
imports: [NGP_TABLE, NGP_TABLE_PANEL];
```

Per-directive imports remain available. Directives never register with `createTable()`; they read the store and call its methods. Store composition and template composition are independent, and both explicit.

---

## Rejected alternatives

**A container directive for the whole table** (the `cdkDropList` shape). `cdkDropList` exists because nothing else owns list membership and ordering. Here `withExpansion()` already owns the open set, and owns it better — it survives virtual scrolling and is serializable. A container directive would be a second source of truth. Drag and drop is a different call: drop-zone geometry has no owner.

**Composing expansion into `ngpTableRow` via `hostDirectives`.** `hostDirectives` is statically resolved; expansion is runtime-optional:

- it would apply to every row of every table, including those without `withExpansion()`, where `isExpanded` is `undefined` — `aria-expanded` on a non-expandable table is an a11y lie;
- tree-shaking dies: a hard static reference puts expansion code in every bundle importing `ngpTableRow`;
- inputs are not forwarded automatically, so each is re-declared inside `ngpTableRow`'s metadata and every new expansion input edits a core directive;
- it does not scale: eight features make `hostDirectives` the god-directive, moved into metadata.

`hostDirectives` stays correct for unconditional behavior and for mechanism shared between feature directives (the shared collapsible trigger core, never exported from `index.ts`).

**Copy patterns, no dependency.** Neither ng-primitives nor `@angular/cdk` is a dependency, and the library does not add one for this. Their disclosure and accordion primitives own open state internally (conflicting with the open set as the single source of truth) and assume a trigger plus a contiguous content region. The table's patterns are copied where they fit: ng-primitives' collapsible trigger binding only `aria-controls` / `aria-expanded`, CDK Menu's focus return from its own close path. Where they fall short, the directives go further: ng-primitives sets `until-found` only once closed and at zero height, leaving its exit animation focusable, with no `inert` or focus handling. `ngp` is also ng-primitives' own selector prefix; the overlap is incidental. Whether to adopt the primitives wholesale is #209's question.

**Rejected inside the design** (full list in the #199 decisions): derived or consumer-passed panel ids; `Expansion*` / `Detail*` names; a panel falling back to the table host for focus; a `closeOthers` recipe or single-open logic inside the directive; a label input with a default; an effect reacting to open→closed for focus.

**Folding the toggle into `core.md`.** `core.md` covers always-present directives; expansion is opt-in and composes only with `withExpansion()` — same shape as sort and selection, so it gets its own file.

## Closed questions

- **Accordion mode** → `withExpansion({ multi })`, [#210](https://github.com/DvirMon/ng-table/issues/210) (E54).
- **`expandAll()` / `collapseAll()` directive** → stays a consumer recipe (OQ-exp-4).
- **Where a detail panel lives** → consumer markup, never a `renderRows()` entry (E12).
- **`aria-expanded` / `aria-level` on the detail `<tr>`** → gone: `aria-expanded` is on the button, nothing on the row.
