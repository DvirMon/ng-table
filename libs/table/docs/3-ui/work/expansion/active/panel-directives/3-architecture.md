---
title: Architecture — detail panel a11y directives (#199)
ticket: "#199"
capability: expansion
date: 2026-10-01
grounded-against: Angular 22.1.2 (installed), libs/table/src @ docs/199-panel-directives
---

# Architecture — detail panel a11y directives

Consumed by `/to-tasks`. Paths and snippets are current as of the date above.

## Settled — not open for relitigation

| # | Decision | Source |
|---|---|---|
| 1 | Toggle↔panel link: internal registry provided by `ngpTable`, keyed by `RowId` | D1 / E44 |
| 2 | Names `ngpTablePanelToggle`, `ngpTablePanel` | D2 / E45 |
| 3 | `[ngpTablePanel]` takes a `RowId` | D3 / E46 |
| 4 | `id`/`inert` by host binding; leaving panel gets `inert` via `Renderer2.setAttribute` in `DestroyRef.onDestroy` | D4 / E47 |
| 5 | Focus return only to a connected toggle; row-gone is #201 | D5 / E48 |
| 6 | Esc: `(keydown.escape)` host listener → `close()`, skipped on `defaultPrevented` | D6 / E49 |
| 7 | `inert`, not `until-found` | D7 / E50 |
| 8 | Focus return from `close()` (exportAs) + `onDestroy`; never an effect | D8 / E51 |
| 9 | Dev throws: missing `withExpansion()` (per directive), duplicate panel | D9 / E52, #209 D9 |
| 10 | Toggle click = `toggle(id)`; single-open is `withExpansion({ multi })` (#210) | D10 / E53, E54 |
| 11 | Names consumer-owned: no label input/default/warning | D11 / E55, ADR-0029 #3 |
| 12 | Id = per-table prefix + escaped `RowId` | D13 / E56 |
| 13 | Toggle slice builds on #209's core; panel slice independent | D14, #209 D6 |

## Verified framework facts (Angular 22.1.2, `node_modules/@angular/core/fesm2022/`)

- `@if` → false: `ɵɵconditional` (`_debug_node-chunk.mjs:14463`) calls
  `removeLViewFromLContainer` → `detachView` + `destroyLView` synchronously in the
  parent's update pass. `refreshView` (`:6007`) returns early on a destroyed view, so the
  panel's `[inert]` host binding never re-evaluates on a leaving panel.
- Destroy hooks (`ngOnDestroy`, `DestroyRef.onDestroy` via `storeLViewOnDestroy`) run
  synchronously in `cleanUpView` (`:4783`, `:4812-4880`) **before** leave classes are
  applied (queued to `afterNextRender`, `scheduleAnimationQueue` `:4513`) and before
  `nativeRemoveNode` (`runAfterLeaveAnimations` `:4666`). The element is connected at
  `onDestroy`.
- Destroy is per-LView: a directive on a `<div>` inside a leaving `<tr>` in the same
  embedded view is destroyed at the same instant.
- Host listener vs template listener on one element: merged into one native listener,
  host first (`listenToDomEvent` `:8197-8213`, `wrapListener` `:8162-8178`).
  `stopImmediatePropagation` does not stop the chain.
- None of this ordering is documented on angular.dev (guide/animations); the spec test
  pins it.

## Current source this builds on

- `libs/table/src/directives/ngp-table.directive.ts` — `providers: [{ provide:
  NGP_TABLE_STORE, useExisting: NgpTableDirective }]`. The registry provider is added here.
- `libs/table/src/directives/table.tokens.ts` — `NGP_TABLE_STORE`, `NGP_TABLE_ROW`
  (DI types erased to `unknown`). It is `export *`'d from `index.ts:8`, so the internal
  registry token does **not** go here — it lives in its own unexported file (see layout).
- `libs/table/src/directives/ngp-table-row.directive.ts` — `ngpTableRow:
  InputSignal<RenderRow<TRow>>`; the toggle reads `row.ngpTableRow().id`.
- `libs/table/src/directives/ngp-table-tree-toggle.directive.ts` — precedent: type guard
  `hasTree()` over `unknown`, `assertTreeComposed()` dev throw, `button[...]` selector.
- `libs/table/src/api/features/with-expansion.ts` — `ExpansionSlice`: `()`,
  `everExpanded`, `changed`, `toggle(id)`, `expand(ids?)`, `collapse(ids?)`, `set(ids)`;
  `ExpansionMembers { expansion }`.
- #209's core (branch `docs/collapsible-core`, D2/D4/D7): contract `isOpen(): boolean` +
  `toggle(): void`; binds `aria-expanded`, `data-expanded`, `(click)`, `type="button"`.
  Wiring mechanism (`hostDirectives` / base class / function) is #209's architecture call.

## Types and contracts

```ts
// internal — directives/panel-registry.ts (not exported from index.ts)
interface PanelRegistry {
  registerPanel(id: RowId, host: HTMLElement): string;   // returns minted DOM id; throws on duplicate (dev)
  unregisterPanel(id: RowId): void;
  registerToggle(id: RowId, host: HTMLElement): void;
  unregisterToggle(id: RowId, host: HTMLElement): void;  // host-checked: a remounted row's new toggle isn't removed by the old one
  panelId(id: RowId): Signal<string | null>;             // null while unmounted → no aria-controls
  toggleOf(id: RowId): HTMLElement | null;
}
export const NGP_TABLE_PANEL_REGISTRY = new InjectionToken<PanelRegistry>(...);
```

- `panelId` must be reactive (a signal per id, or one `signal<ReadonlyMap>`), because the
  toggle's `aria-controls` must appear/disappear as the panel mounts/unmounts.
- Id minting: `` `ngp-t${tableSeq}-panel-${escape(String(rowId))}` ``. `escape` must
  produce a valid id token (no whitespace; `aria-controls` is an IDREF list):
  `encodeURIComponent` suffices. `tableSeq` is a per-app counter assigned once per
  `ngpTable` instance (stable across hydration as long as table construction order
  matches).

```ts
// public — directives/ngp-table-panel.directive.ts
@Directive({
  selector: '[ngpTablePanel]',
  exportAs: 'ngpTablePanel',
  host: {
    '[id]': 'panelId',
    '[inert]': '!isOpen()',
    '(keydown.escape)': 'onEscape($event)',
  },
})
export class NgpTablePanelDirective {
  readonly ngpTablePanel = input.required<RowId>();
  close(): void;                         // collapse([id]); returnFocus({ allowBody: true })
}
```

- `onDestroy`: `returnFocus({ allowBody: false })` **then**
  `renderer.setAttribute(host, 'inert', '')` — order matters (setting `inert` first would
  drop focus to `<body>` before the check).
- `returnFocus(allowBody)`: `const a = document.activeElement`; inside = `host.contains(a)`;
  allowed = inside || (allowBody && (a === null || a === document.body)); then
  `toggleOf(id)?.isConnected && toggle.focus()`.
- Registration timing: the `RowId` is a required input, unset in the constructor. Register
  in `ngOnInit` (no effect). A panel's row id changing after mount is out of scope.

```ts
// public — directives/ngp-table-panel-toggle.directive.ts
@Directive({
  selector: 'button[ngpTablePanelToggle]',
  host: { '[attr.aria-controls]': 'panelId()' },
  // + #209 core wiring supplying isOpen/toggle
})
export class NgpTablePanelToggleDirective {}
```

- `isOpen = computed(() => expansion().has(row.ngpTableRow().id))`;
  `toggle = () => expansion.toggle(row.ngpTableRow().id)`.
- Dev throw when the table lacks `withExpansion()`: a `hasExpansion(table: unknown): table
  is ExpansionMembers` guard, mirroring `hasTree()`; message names `withExpansion()`.

## File layout

| File | Change |
|---|---|
| `libs/table/src/directives/panel-registry.ts` | new, internal: registry factory + token |
| `libs/table/src/directives/ngp-table.directive.ts` | add registry provider |
| `libs/table/src/directives/ngp-table-panel.directive.ts` | new |
| `libs/table/src/directives/ngp-table-panel-toggle.directive.ts` | new (after #209 core) |
| `libs/table/src/directives/ngp-table-panel.directive.spec.ts` | new: the one test seam (both directives) |
| `libs/table/src/index.ts` | export both directives |
| `libs/table/docs/3-ui/directives/expansion.md` | rewrite in place per D12 |
| `libs/table/docs/0-product/expansion.md` | §6.2 U2–U4 point at the new spec |

## Slicing hint

1. Panel slice (independent): registry + provider, `ngpTablePanel`, its spec cases that
   don't need the toggle (id, `inert` binding, `inert` at destroy, Esc, `close()` from
   `<body>`, duplicate throw, missing-feature throw).
2. Toggle slice (after #209 core): `ngpTablePanelToggle`, `aria-controls`, focus-return
   target, remaining spec cases.
3. Docs slice: UI spec rewrite (D12) — can run alongside 1.

## Open questions

- **Panel outside the table host** (story 1.6 side drawer). No `ngpTable` ancestor → no
  registry, no store via DI. D3's side-panel rationale assumed it would work. Needs a way
  to name the table (an input taking the table, or a registry reachable another way).
  Not decided; v1 = inside the table host.
- **Registration hook without an effect.** The required `RowId` input is unavailable in
  the constructor; `ngOnInit` is the plain option. Confirm it fits the lib's directive
  style (no lifecycle interfaces used today in `directives/`).
- **`tableSeq` and hydration.** Stable only if table construction order is the same on
  server and client. Acceptable for v1 (no stated SSR target); revisit with an SSR target.
- **jsdom and `animate.leave`.** Whether TestBed runs leave animations (or removes
  immediately / after the 4 s fallback) decides how the "inert during leave" test holds
  the element; assert right after the closing `detectChanges()` either way.
