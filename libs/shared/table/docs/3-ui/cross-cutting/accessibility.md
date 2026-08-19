---
title: UI Layer — Accessibility (Cross-Cutting)
type: architecture
version: 0.2
date: 2026-07-31
status: draft — drilled; aria-live region ownership unresolved
audience: developers
---

# UI Layer — Accessibility (Cross-Cutting)

## Executive Summary

General ARIA-wiring principles applying across all NGP Table directives. Feature-specific accessibility detail (e.g. sort's `aria-sort`/keyboard pattern) lives in that feature's own reference file (`sort.md`); this document covers what's shared.

---

## Core Principle

Directives wire ARIA only where native semantics + text content don't already cover it. Native `<table>`/`<thead>`/`<tr>`/`<th>`/`<td>` already provide implicit table/row/cell roles and row-column relationships for free — no `role` attributes needed for static structure. This follows the project's own `accessibility.md` rule (*"never use a `<div>`/`<span>` for an interactive element when a semantic element exists"*) extended to its underlying WAI-ARIA "first rule of ARIA use" principle, though that rule's literal wording covers div/span, not `<th>` specifically — see `sort.md` for how the `<th>`-vs-inner-`<button>` question was actually resolved (via direct verification against `MatSortHeader`, not by extending this rule).

**What native markup does *not* give you for free** — directives still own dynamic/interactive ARIA:
- `aria-sort` on sortable `<th>` (see `sort.md`)
- Keyboard operability of interactive triggers (see `sort.md`)
- `aria-live` announcements for dynamic state changes (below)
- Explicit `scope="col"` on header `<th>` — technically inferable by browsers, but best practice for reliability across screen readers

---

## `aria-label`

**Decision:** Conditional only, never a default, on both `<th>` and `<td>`.

- **`<th>`:** text content is the accessible name in the common case (plain text header) — matches "semantic HTML first." Only needs `aria-label` for icon-only or non-text header content (e.g. a checkbox-select-all column header).
- **`<td>`:** almost never needs one. Its accessible name is its text content, and column context comes from native table row/column structure, not `aria-label` — screen readers in table-navigation mode announce the associated `<th>` automatically. A generic `aria-label` on every `<td>` can actually override/shadow the natural text-content accessible name in some screen-reader table-navigation modes, and is redundant for plain text cells. Only needed when cell content is non-textual (icon-only status, unlabeled inline checkbox).

**Pattern:** directive conditionally sets `aria-label` based on whether the header/cell slot contains text or not — never unconditionally.

---

## `aria-live`

**Decision:** One table-level status region, driven by store events — not per-cell.

```html
<!-- sibling of the table, not a child — a <div> is not valid table content -->
<div class="sr-only" aria-live="polite">{{ statusMessage() }}</div>
<table [ngpTable]="table">…</table>
```

`statusMessage()` is a derived signal reacting to store events — one announcement per meaningful state change, not one per cell.

**Ownership is undecided and nothing implements it today.** The store exposes the raw event streams a message would be derived *from* (`withSorting()` publishes `sortChanged: Observable<SortRule[]>`; the not-yet-built pagination/infinite-scroll features would publish their own), but there is no `statusMessage` on `TableStore` and no UI-layer directive producing one. Earlier drafts of this file wrote `store.statusMessage()`, implying a store API that does not exist. See Open Questions.

**Why not per-cell (two independent reasons):**
1. **Virtual scroll:** CDK recycles `<td>` DOM nodes as the user scrolls (see `virtual-scroll.md`) — per-cell `aria-live` would fire spurious "changed" announcements on every scroll-recycle, flooding screen reader users with noise for cells they never watched change.
2. **Announcement volume:** a single sort/filter/page action can change many cell values in one tick — per-cell live regions would fire dozens of simultaneous announcements, drowning out the one meaningful change.

This decision was made in this UI-layer session *before* virtual scroll was drilled, and turned out to be a direct prerequisite for `virtual-scroll.md`'s design working cleanly — locking it early avoided having to revisit it once virtualization's DOM-recycling behavior was considered.

**Deferred, not decided:** per-cell `aria-live` scoped to inline-edit validation errors is a legitimate future exception — genuinely local, user-triggered, low-frequency, unlike bulk state changes. Reserved for a future `ngpTableCellEdit` directive, out of scope for base `ngpTableCell`.

---

## Open Questions

- [ ] **Who owns `statusMessage()`?** **Deferred by decision (2026-07-31)** — blocks nothing, revisit before shipping to users. Three options: (a) consumer-authored `computed()` over the store's event streams — zero DS surface, every consumer reinvents wording; (b) a `TableStore` member contributed by each feature — puts user-facing English inside the state layer; (c) a dedicated `ngpTableStatus` directive in the UI layer that subscribes to the streams and renders the region itself — keeps copy in the UI layer where it belongs, adds one directive. Blocks this file from being more than a sketch.

See `sort.md` for the one known limitation carried forward (screen readers not reliably announcing `aria-sort` value changes on their own).
