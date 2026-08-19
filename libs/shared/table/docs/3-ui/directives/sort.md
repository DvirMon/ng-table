---
title: UI Layer — Sort (ngpTableSort)
type: architecture
version: 0.3
date: 2026-07-31
status: draft — revised (directive owns activation handling); diverges from shipped withSorting(), see note
audience: developers
---

# UI Layer — Sort (`ngpTableSort`)

## Executive Summary

Opt-in directive on `<th>` that reflects sort state via `aria-sort` **and now owns activation handling** — reading the configured modifier key off the triggering event and calling `store.toggleSort(columnId, { accumulate })`. **This revises the prior session's decision** that the directive was purely display-only with the consumer wiring `(click)` directly to the store; see "Why This Reverses the Prior Decision" below.

**Compile-time dependency:** requires `ngpTableColumn` on the same element (reads `columnId()` from it via sibling DI) — unchanged.

---

## Why This Reverses the Prior Decision

**Prior decision (last session):** `ngpTableSort` was display-only (`aria-sort` binding only); the consumer's own `<button>` called `store.toggleSort(col.id)` directly via `(click)`. That was the right call *at the time* because the call was a single trivial forward — no per-click context needed, and routing it through the directive would have been indirection with no payoff.

**What changed:** modifier-key detection is genuine per-activation logic — reading `event.shiftKey`/`ctrlKey`/`metaKey` (mapped from a configurable choice of which key means "accumulate") and translating that into `{ accumulate: boolean }`. This is exactly the kind of interaction logic directives exist to own. If it stayed in the consumer's template as `(click)="store.toggleSort(col.id, { accumulate: $event.shiftKey })"`, the modifier-key choice would be hardcoded per call site — the "configurable modifier key" user story couldn't be satisfied without either duplicating a config lookup in every consumer's template or centralizing it in the directive. Centralizing it is the directive's job.

**Not a return to the earlier-rejected antipattern:** the previously-rejected version had the directive guessing whether a bubbled click "really" came from an interactive child (`event.target.closest('button')`) to decide *whether* to act at all. This version doesn't guess anything — the button is the sole clickable content inside the `<th>` (per the locked button-inside-header markup), so a bubbled click reliably means "the button was activated." The directive isn't inferring intent, just reading modifier flags off an event it's genuinely meant to own.

---

## Implementation

```ts
@Directive({
  selector: 'th[ngpTableSort]',
  host: {
    '[attr.aria-sort]': 'ariaSort()',
    '(click)': 'onActivate($event)',
    '(keydown.enter)': 'onActivate($event)',
    '(keydown.space)': 'onActivate($event)',
  },
})
export class NgpTableSortDirective {
  private readonly table = inject(NGP_TABLE_STORE);          // see core.md — resolves to NgpTableDirective
  private readonly column = inject(NgpTableColumnDirective); // same-element DI, sibling directive

  private get store() { return this.table.store(); }

  // Scope not yet decided (table-wide vs per-directive) — shown here as a per-directive
  // input pending that decision. See Open Questions.
  readonly modifierKey = input<'shift' | 'ctrl' | 'meta'>('shift');

  private readonly isSortable = computed(() => {
    const col = this.store.columns().find(c => c.id === this.column.columnId());
    // `enableSorting` is optional and opt-*out*: only an explicit `false` disables.
    return !!col && col.enableSorting !== false;
  });

  readonly ariaSort = computed(() => {
    if (!this.isSortable()) return null; // enableSorting:false → no aria-sort at all
    // No `sortDirectionFor()` helper on the store — `sorting` is the raw SortRule[].
    const rule = this.store.sorting().find(r => r.columnId === this.column.columnId());
    return rule?.direction === 'asc' ? 'ascending'
         : rule?.direction === 'desc' ? 'descending'
         : 'none';
  });

  onActivate(event: MouseEvent | KeyboardEvent): void {
    if (!this.isSortable()) return; // disabled column: no-op

    const accumulate = this.isModifierHeld(event);
    this.store.toggleSort(this.column.columnId(), { accumulate }); // ⚠️ not yet implemented — see note below
  }

  private isModifierHeld(event: MouseEvent | KeyboardEvent): boolean {
    switch (this.modifierKey()) {
      case 'shift': return event.shiftKey;
      case 'ctrl': return event.ctrlKey;
      case 'meta': return event.metaKey;
    }
  }
}
```

```html
@for (col of visibleColumns(); track col.id) {   <!-- see columns.md — columns() is unfiltered -->
  <th [ngpTableColumn]="col.id" ngpTableSort>
    <button type="button">…</button>
  </th>
}
```

**Note the button no longer has a `(click)` handler at all.** The directive's host listener on `<th>` catches the bubbled click (and, per the explicit implementation decision, also listens to `keydown.enter`/`keydown.space` directly rather than relying solely on the browser's native click-synthesis from keyboard-activated buttons — belt-and-suspenders for any future markup variant that doesn't use a native `<button>`).

**Reading the modifier off the triggering event, never inferred after the fact:** `onActivate` reads `event.shiftKey`/`ctrlKey`/`metaKey` directly from whichever event fired it (`MouseEvent` for click, `KeyboardEvent` for the keydown handlers) — there's no separate "was a modifier held recently" state tracked across events.

**Disabled columns:** the `enableSorting` guard now runs at the directive level (`onActivate` returns early) in addition to the store's own internal guard (`with-sorting.md` — `toggleSort` no-ops on disabled columns regardless of caller). Belt-and-suspenders, not a new source of truth — the store's guard remains authoritative if this directive-level check is ever bypassed by a future custom trigger.

---

## ⚠️ Divergence From the Shipped `withSorting()`

This file specs a per-activation modifier key. The **implemented** `api/features/with-sorting.ts` does not support it yet:

| This spec | Shipped today |
|---|---|
| `toggleSort(columnId, { accumulate })` | `toggleSort(columnId)` — single argument |
| Accumulation decided **per click**, from the modifier | Accumulation decided **once at construction**: `withSorting({ multi: true })` |
| `store.sortDirectionFor(id)` (v0.1 of this file) | No such helper — read `store.sorting(): Signal<SortRule[]>` |
| `col.sortable` (v0.1 of this file) | `col.enableSorting?: boolean`, opt-*out* (only explicit `false` disables) |

The last two rows are corrected inline above. The first two are a **genuine open state-layer change this UI decision requires** — `toggleSort` must grow an options argument and `multi` must move from construction config to per-call, or this directive design can't be built. Not yet ticketed.

---

## Styling Hook (Unchanged)

No default icon or animation shipped. `data-sort-direction` remains the intended hook — unaffected by this revision.

---

## Open Questions

- [ ] **Input name/shape for the configurable modifier key** — shown above as `modifierKey` on `ngpTableSort` directly; not finalized.
- [ ] **Modifier config scope** — table-wide (`ngpTable` provides a default all `ngpTableSort` instances inherit) vs. per-`ngpTableSort` (shown above, each column configured independently). Table-wide seems the more likely fit (a consumer almost certainly wants one consistent modifier across all sortable columns, not a different key per column), but not decided this session.
- [ ] **Multi-sort priority visual indicator** — carried over from `with-sorting.md`, now flagged as more load-bearing: since single-column-replace is the default action, the moment a user successfully accumulates a second column via modifier+click is the only feedback confirming the modifier registered at all. Previously deferred as lower-stakes; no longer safe to defer indefinitely.
- [ ] Should `ngpTableSort` expose `data-sort-direction` as a host binding itself, or leave it fully to consumer-authored logic reading `ariaSort()`? (Carried over, unrelated to this revision.)
