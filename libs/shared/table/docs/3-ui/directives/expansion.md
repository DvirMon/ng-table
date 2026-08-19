---
title: UI Layer — Expansion (ngpTableExpandable, ngpTableExpandToggle, ngpTableExpandContent)
type: architecture
version: 0.4
date: 2026-08-07
status: drilled — API contract decided, not yet implemented
audience: developers
---

# UI Layer — Expansion

Three directives. `withExpansion()` owns all state; these own semantics, activation, and default presentation.

| Directive | Host | Owns |
|---|---|---|
| `ngpTableExpandable` | `<tr>` | state reflection (`aria-expanded`, `aria-level`, `data-*`) + enter/leave motion for the row itself |
| `ngpTableExpandToggle` | `<tr>` or `<button>` inside it | activation only (click, keyboard, disabled) |
| `ngpTableExpandContent` | element inside a detail row's `<td>` | the accordion slide — height collapse/reveal |

Not a split of one concern — distinct concerns that resemble one. The row *reflects* expansion; the toggle *causes* it; the content directive *hides and reveals* it. Same shape as `cdkDrag` / `cdkDragHandle`: the toggle on the row itself makes the whole row the trigger; moving it to a nested `<button>` narrows the trigger to that button.

## Prerequisites

`ngpTableExpandable` and `ngpTableExpandToggle` inject `NGP_TABLE_ROW`, so they depend on `ngpTableRow`, which depended on `RenderRow`/`renderRows()`. Landed 2026-08-07 via [#39](https://github.com/DvirMon/acme/issues/39).

**Outstanding:** the detail-panel path needs `everExpanded` on `withExpansion()` — see "Detail Panels Are Lazy and Persistent" below. Tier 0–2 (tree children) can be built without it; tier 3 cannot.

## Why Directives and Not Consumer Markup

`toggleExpanded(rowId)` is a one-line call any consumer could write — the current demo does exactly that (`apps/demo/src/app/table-expansion-demo/table-expansion-demo.html`). What the consumer would *also* have to write, correctly, every time: `aria-expanded` reflecting store state, `aria-level` from `depth`, keyboard activation on a non-interactive host, the `data-*` attributes `../cross-cutting/styling-tokens.md` expects, and enter/leave motion for rows that `renderRows()` adds and removes.

---

## Three Tiers

Each tier is additive and opted into by placing a directive. This is the granularity of "use the directive if you want the default behavior" — per directive, not one all-or-nothing switch.

| Tier | Consumer writes | Gets |
|---|---|---|
| 0 | store only | `toggleExpanded()`, `expandedRows`, `renderRows()`. Zero DOM opinion. Consumer owns all a11y and motion. |
| 1 | `+ ngpTableExpandToggle` | activation, `aria-expanded`, keyboard, `data-expanded` / `data-disabled` on the trigger, disabled derivation |
| 2 | `+ ngpTableExpandable` on the `<tr>` | `aria-level` from `depth`, `data-depth` / `data-expanded` on the row, and default enter/leave motion for the row |
| 3 | `+ ngpTableExpandContent` on a wrapper inside the detail `<td>` | the accordion slide — height collapse/reveal of the panel's content |

Tier 0 stays fully supported. A consumer maintaining their own animation logic uses the state layer and stops — that is not a degraded path, it is the contract.

---

## `ngpTableExpandable`

```ts
@Directive({
  selector: 'tr[ngpTableExpandable]',
  providers: [{ provide: NGP_TABLE_EXPANDABLE, useExisting: NgpTableExpandableDirective }],
  host: {
    '[attr.aria-expanded]': 'isExpanded()',
    '[attr.aria-level]': 'depth() + 1',
    '[attr.data-expanded]': 'isExpanded()',
    '[attr.data-depth]': 'depth()',
    '[attr.data-has-children]': 'hasChildren()',
  },
})
export class NgpTableExpandableDirective {
  // Detail-panel path only. Omitted for tree rows, where the id comes from NGP_TABLE_ROW.
  readonly rowId = input<RowId | undefined>(undefined, { alias: 'ngpTableExpandableFor' });
}
```

**Two paths to row identity**, and exactly one applies per usage:

- **Tree rows** — the `<tr>` is a `renderRows()` entry carrying `ngpTableRow`, so state comes from `NGP_TABLE_ROW` via DI. No input.
- **Detail rows** — the `<tr>` is consumer markup with no `RenderRow`, so `[ngpTableExpandableFor]="row.id"` supplies the id and state is resolved against `NGP_TABLE_STORE`. See "Detail Panels Are Lazy and Persistent".

The input wins when both are available.

**Motion.** Owns `animate.enter` / `animate.leave` (Angular 21 native — no `@angular/animations` dependency), timed by `--ngp-table-expand-duration`. This directive sits on the element that enters and leaves, which is why motion belongs here and not on the toggle: expanded rows are **added to and removed from `renderRows()`** (`../../1-state/features/expansion.md`, "Render Layer"), so `@for` creates and destroys them and the toggle does not own the rows that appear.

What it animates is **opacity and a small `translateY`**, not height — see "The Accordion Slide" below for why a `<tr>` cannot slide and what does.

`aria-level` is `depth() + 1` — ARIA levels are 1-based, `RenderRow.depth` is 0-based.

## `ngpTableExpandToggle`

```ts
@Directive({
  selector: '[ngpTableExpandToggle]',
  providers: [{ provide: NGP_TABLE_EXPAND_TOGGLE, useExisting: NgpTableExpandToggleDirective }],
})
export class NgpTableExpandToggleDirective {
  private readonly row = inject(NGP_TABLE_ROW);
  private readonly table = inject(NGP_TABLE_STORE);

  readonly disabled = input(undefined, {
    alias: 'ngpTableExpandToggleDisabled',
    transform: booleanAttribute,
  });

  onActivate(): void {
    this.table.store().toggleExpanded(this.row.rowId()); // RowId — real or synthetic
  }
}
```

Row identity comes from DI, never a duplicate input. The same directive serves group-header collapse, because `withGrouping()` delegates its collapse state to `withExpansion()`'s `expandedRows` and group ids are synthetic `RowId`s (see `../../1-state/features/grouping.md`).

### One directive for both hosts

Not split into a row variant and a button variant. Every host difference derives from a single check:

```ts
const isNativelyInteractive = /^(BUTTON|A)$/.test(host.tagName);
```

| | native host (`<button>`, `<a>`) | `<tr>` host |
|---|---|---|
| activation | native `click` only | `click` + `keydown.enter` + `keydown.space` |
| `tabindex` | none added | `0` |

The keydown bindings are **conditional on purpose**: on a `<button>`, Space and Enter already synthesize a `click`, so binding both handlers double-toggles to a net no-op.

### Nesting guard

A toggle on the `<tr>` plus a toggle on a `<button>` inside it would both fire on one click. Solved the way `cdkDragHandle` registers against `CDK_DRAG_PARENT`: the directive provides `NGP_TABLE_EXPAND_TOGGLE` and injects the same token with `{ skipSelf: true, optional: true }`. When an ancestor toggle is found, the inner one calls `stopPropagation()` on its own activation.

### Disabled

`[ngpTableExpandToggleDisabled]`, `booleanAttribute` transform, matching `cdkDragDisabled`. Defaults to `!row.hasChildren` when the input is not set; an explicit value always wins. Emits `data-disabled` and `aria-disabled`.

---

## The Accordion Slide (`ngpTableExpandContent`)

**Decided 2026-08-07:** the DS ships a real accordion slide, and it needs one element of consumer-authored markup to attach to.

### Why the row itself cannot slide

- On `display: table-row`, `height` is treated as a **minimum**, not a settable box dimension, and `overflow: hidden` has no effect on table-row and table-cell boxes. There is nothing to clip, so there is no slide.
- `interpolate-size: allow-keywords` (transitioning to `height: auto`) is Chrome/Edge/Opera 129+ only — Firefox unimplemented ([bugzil.la/1945962](https://bugzil.la/1945962)), Safari unimplemented ([webkit.org/b/295132](https://webkit.org/b/295132)). Not a DS baseline.
- The technique that works everywhere is a wrapper element with `grid-template-rows: 0fr → 1fr`, which requires a **block-level box inside the `<td>`**. The directive may not create it (`../../overview.md`, locked invariant).

### The contract

The consumer authors the wrapper; the directive drives it. One element of markup, in exchange for a slide that works in every browser without an ADR exception.

```html
<tr ngpTableExpandable [ngpTableExpandableFor]="row.id">
  <td [attr.colspan]="visibleColumnCount()">
    <div ngpTableExpandContent>…detail panel content…</div>
  </td>
</tr>
```

```ts
@Directive({
  selector: '[ngpTableExpandContent]',
  host: {
    '[attr.data-expanded]': 'isExpanded()',
    '[attr.inert]': 'isExpanded() ? null : ""',
  },
})
export class NgpTableExpandContentDirective { /* reads NGP_TABLE_EXPANDABLE */ }
```

### "Hidden properly" is three things, not one

Collapsing to zero height leaves a box that is still focusable and still read by screen readers. The full contract:

| Concern | Mechanism |
|---|---|
| Size | `grid-template-rows: 0fr → 1fr` |
| Paint | `visibility: hidden`, **delayed until the slide finishes** |
| Focus + a11y tree | `inert` while collapsed |

`inert` is safe to rely on — Chrome 102, Firefox 112, Safari 15.5, all shipped 2022. It removes the subtree from tab order and the accessibility tree in one attribute, which `visibility: hidden` alone does not guarantee across engines.

Shipped CSS, overridable through the same tokens as the rest of the feature:

```css
[ngpTableExpandContent] {
  display: grid;
  grid-template-rows: 0fr;
  visibility: hidden;
  content-visibility: auto;
  transition:
    grid-template-rows var(--ngp-table-expand-duration, 200ms) var(--ngp-table-expand-easing, ease),
    visibility 0s linear var(--ngp-table-expand-duration, 200ms);
}

[ngpTableExpandContent][data-expanded='true'] {
  grid-template-rows: 1fr;
  visibility: visible;
  transition-delay: 0s;   /* visible immediately on the way open */
}

[ngpTableExpandContent] > * { overflow: hidden; }

/* First open: the element is born expanded, so give it a state to animate from. */
@starting-style {
  [ngpTableExpandContent][data-expanded='true'] { grid-template-rows: 0fr; }
}

@media (prefers-reduced-motion: reduce) {
  [ngpTableExpandContent] { transition: none; }
}
```

The `visibility` delay is the detail that is easy to get wrong: set it without the delay and content vanishes before it has finished sliding.

`@starting-style` is shipped everywhere — Chrome 117, Safari 17.5, Firefox 129. It is what makes the first open animate; without it the element mounts already at `1fr` and simply appears.

State comes from `NGP_TABLE_EXPANDABLE` on the ancestor `<tr>` — no input, no duplicate row id.

### Scope limit — detail panels only

A slide needs one collapsible box. **Tree-child expansion reveals N sibling `<tr>`s**, which have no common box to collapse, so `ngpTableExpandContent` does not apply there; tree children get tier 2's fade + `translateY`, optionally staggered.

This makes the shipped motion asymmetric by construction: detail panels slide, tree children fade in. Consumers wanting a uniform feel across both use tier 0 or 1 and animate themselves.

---

## Detail Panels Are Lazy and Persistent

**Decided 2026-08-07.** Three candidate models; the third is the default.

| Model | Behavior | Verdict |
|---|---|---|
| `@if (row.isExpanded)` | create + destroy on every toggle | rejected — collapse animation fights teardown on every close |
| Always rendered | mounted from first paint | rejected — N panels constructed and N fetch-on-init calls at page load |
| **Lazy-then-persist** | mounts on *first* expand, stays mounted after | **default** |

The whole mechanism is one predicate. Gate on **has ever been expanded**, not on **is expanded**:

```html
@if (table.everExpanded().has(row.id)) {
  <tr ngpTableExpandable [ngpTableExpandableFor]="row.id">
    <td [attr.colspan]="visibleColumnCount()">
      <div ngpTableExpandContent>
        <app-department-detail [department]="row.data!" />
      </div>
    </td>
  </tr>
}
```

A never-opened row costs **zero nodes**. First open mounts it and `@starting-style` animates it. Every toggle after that is a class flip on a stable box — full-quality animation in both directions.

**No `ng-template` / `ngTemplateOutlet` is required.** Angular's `@if` over a signal already gives lazy-then-persist, so the structural-directive route (and the ADR exception it would need against `../../overview.md`) is avoided entirely. This is the same shape as Material's `matExpansionPanelContent` — which defers the *initial* mount and does not destroy on collapse — reached with native control flow instead of a template outlet.

### What this requires

1. **State layer — `withExpansion()` gains `everExpanded`.** A `Set<RowId>`, additive-only, written by `toggleExpanded()` / `expandAll()`, reset with the data source. Specced in `../../1-state/features/expansion.md`.
2. **Row identity without a `RenderRow`.** The detail `<tr>` is consumer markup, not a `renderRows()` entry, so `ngpTableExpandable` cannot get its id from `NGP_TABLE_ROW` via DI. Hence the `[ngpTableExpandableFor]="row.id"` input, which resolves against `NGP_TABLE_STORE`. DI stays the path for tree rows; the input is the detail-panel path.
3. **`content-visibility: auto`** on the content wrapper, so opened-but-scrolled-away panels skip layout and paint.

### Why the two mechanisms differ

Tree children stay gated by `renderRows()` (destroy on collapse); detail panels are lazy-persistent. Not an inconsistency — different cost profiles. A tree can reveal thousands of child rows at once, so keeping them mounted is unaffordable. A detail panel is one row the user deliberately opened, so keeping it is cheap and buys the animation quality.

### Known cost

Memory grows monotonically with rows the user has *opened*, and never shrinks. A session that expands 5,000 rows holds 5,000 mounted panels. Bounded by human clicking rather than by data size, so it is slow rather than pathological. An LRU cap on `everExpanded` would fix it; not worth v1 unless asked for.

---

## Default Presentation, and Its Limit

The DS ships a real default look, per `../cross-cutting/styling-tokens.md`'s rejection of a wholesale headless model. For expansion that means CSS keyed on the emitted attributes plus `--ngp-table-expand-toggle-*` and `--ngp-table-expand-duration` tokens: chevron rotation, transition, focus ring, cursor.

**No glyph is injected.** The chevron character or icon stays consumer content. Injecting one would insert DOM, which the locked invariant forbids (`../../overview.md`). The DS ships the rotation and timing; the consumer ships the mark.

> Unresolved, deferred by explicit instruction: `../cross-cutting/styling-tokens.md` records that sort ships **no** default visual, "100% consumer-authored CSS from day one." Expansion shipping defaults makes sort an exception rather than the rule. Needs a cross-cutting decision before a second feature is drilled.

## Resulting DX

Measured against the two existing state-layer-only demos.

### Tree children, button toggle

`apps/demo/src/app/table-expansion-demo/table-expansion-demo.html` today:

```html
<td [style.paddingLeft.px]="first ? row.depth * 16 : null">
  @if (first && row.hasChildren) {
    <button type="button" class="…__toggle" (click)="table.toggleExpanded(row.id)">
      {{ row.isExpanded ? '▾' : '▸' }}
    </button>
  }
  {{ column.accessor(row.data!) }}
</td>
```

With directives:

```html
<td [ngpTableCell]="column.id">
  @if (first && row.hasChildren) {
    <button type="button" ngpTableExpandToggle>▸</button>
  }
  {{ column.accessor(row.data!) }}
</td>
```

| Leaves the template | Where it went |
|---|---|
| `(click)="table.toggleExpanded(row.id)"` | directive, id from DI |
| `{{ row.isExpanded ? '▾' : '▸' }}` | one static glyph; rotation is CSS on `[data-expanded]` |
| `[style.paddingLeft.px]="row.depth * 16"` | `data-depth` on the row + CSS |
| `row.hasChildren &&` guard | disabled derivation |

Gained, and absent from the demo today: `aria-expanded`, `aria-level`, keyboard activation, focus ring, `prefers-reduced-motion`.

### Whole row as trigger

`table-expansion-row-demo.html` today:

```html
<tr
  [class.…__row--expandable]="row.hasChildren"
  (click)="row.hasChildren && table.toggleExpanded(row.id)"
  animate.enter="…__row-enter"
  animate.leave="…__row-leave"
>
```

With directives:

```html
<tr ngpTableExpandable ngpTableExpandToggle>
```

Both directives on one element — the `cdkDrag`-without-a-handle shape. The hand-written enter/leave class strings and their keyframes are what the DS ships.

### Honest read

Tree children get shorter *and* more accessible — a clear win. Detail panels get **longer** than a naive `@if (row.isExpanded)` version, by one wrapper `<div>` and a less obvious predicate. That extra buys the slide plus lazy mounting; a consumer wanting neither stays on tier 0 and writes the naive version.

No current demo covers the detail-panel case. Worth adding `table-detail-panel-demo` once the directives exist.

## Dev-Mode Assertions

Both `ngDevMode`-guarded, stripped in production. They cover the one real cost of keeping these directives public and separate — a consumer can compose half the feature and get silent degradation.

- `ngpTableExpandToggle` with no ancestor `ngpTableExpandable` → warn (a11y and motion silently absent).
- `row.isExpanded === undefined` → warn that `withExpansion()` is not composed on the store. The field is optional (`api/types.ts`), so this is a runtime no-op rather than a compile error — the store type is structural.
- `ngpTableExpandContent` whose host has more than one element child → warn. The `grid-template-rows` technique requires `overflow: hidden` on a single child box; extra children escape the clip and the slide visibly breaks.
- `ngpTableExpandable` with neither `NGP_TABLE_ROW` in scope nor `[ngpTableExpandableFor]` set → warn. It has no way to resolve a row id, so every binding would be inert.
- A detail row gated on `isExpanded` rather than `everExpanded` cannot be detected from inside the directive — the directive is simply destroyed. Call it out in docs and the demo instead of trying to assert it.

## Composition

Directives stay fine-grained. Imports stay coarse:

```ts
export const NGP_TABLE_EXPANSION = [
  NgpTableExpandableDirective,
  NgpTableExpandToggleDirective,
  NgpTableExpandContentDirective,
] as const;
```

```ts
imports: [NGP_TABLE, NGP_TABLE_EXPANSION]
```

Standalone `imports` accepts nested arrays; per-directive imports remain available. Mirrors how `DragDropModule` bundles without merging directives.

Directives never register with `createTable()` — they read optional `RenderRow` fields and call store methods. Store composition and template composition are independent, and both are explicit.

---

## Rejected Alternatives

**A container directive for the whole table** (the `cdkDropList` shape). `cdkDropList` exists because nothing else owns list membership and ordering. Here `withExpansion()` already owns `expandedRows`, and owns it better — the set survives virtual scrolling, is shared with `withGrouping()`, and is serializable. A container directive would be a second source of truth for state that already has one. Different verdict is likely for drag & drop, where drop-zone geometry has no owner: this is a per-feature call, not a global one.

**Composing expansion into `ngpTableRow` via `hostDirectives`**, keeping `ngpTable` as the only public surface. Rejected — `hostDirectives` is statically resolved, and expansion is a runtime-optional feature:

- It would apply to every row of every table, including those composed without `withExpansion()`, where `isExpanded`/`hasChildren` are `undefined`. `aria-expanded` on rows of a non-expandable table is an a11y lie, and every binding turns defensive.
- Tree-shaking dies. `hostDirectives` is a hard static reference, so expansion code lands in every bundle importing `ngpTableRow` — giving back exactly what opt-in `with-*()` composition was built to save.
- Inputs are not forwarded automatically; each would have to be re-declared and aliased inside `ngpTableRow`'s metadata, so adding an expansion input becomes an edit to a core directive.
- It does not scale: with eight features, `ngpTableRow`'s `hostDirectives` becomes the god-directive, relocated into metadata where it is harder to see.
- The testability it was meant to buy comes from the separate directive *class*, not from how it is wired.

`hostDirectives` remains correct for behavior that is unconditional (extracting always-present core bindings) and for sharing mechanism between feature directives — e.g. a private `NgpActivation` directive holding the `isNativelyInteractive` click/keyboard normalization, host-composed into both this toggle and `ngpTableSort`, never exported from `index.ts`.

**Reusing ng-primitives' disclosure/accordion primitives.** Neither ng-primitives nor `@angular/cdk` is installed — dependencies are `@angular/*` and `rxjs` only, so this is a new dependency rather than reuse. Beyond that: those primitives own their open state internally, conflicting with `expandedRows` as the single source of truth shared with grouping; they assume a trigger plus a toggled content region, which the table has neither of (`<tr>` must be a direct child of `<tbody>`, and the "content" is other `<tr>`s the store already removed from the list); and the disclosure ARIA pattern (`aria-controls` on a region) is not the grid/treegrid pattern expandable rows need. `ngp` is also ng-primitives' own selector prefix.

**Folding the toggle into `core.md`.** `core.md` covers always-present directives; expansion is opt-in and composes only when `withExpansion()` is in the feature list — same shape as sort and selection, so it gets its own file.

## To Drill

- [x] Where a non-tree **detail panel**'s content lives — resolved 2026-08-07. It is consumer markup, gated on `everExpanded`, never a `renderRows()` entry and never its own `RowKind`. `ngpTableExpandable` therefore takes a `[ngpTableExpandableFor]` input for this path instead of resolving through `NGP_TABLE_ROW`. See "Detail Panels Are Lazy and Persistent".
- [ ] Per-row "loading children" state for the lazy-load contract — `../../1-state/features/expansion.md` flags this as unassigned to any feature; while it stays unassigned, neither directive can render a loading affordance.
- [ ] Single-open **accordion mode**. `withExpansion()` is multi-only by construction (`expandedRows: Set<RowId>`); CDK's accordion `multi` flag has no counterpart here. If wanted, it is config on the state feature, not a directive.
- [ ] Whether `expandAll()` / `collapseAll()` get a directive at all, or stay consumer-called as in the demo toolbar.
