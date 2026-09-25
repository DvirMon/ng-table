# Correctness review — schema, mutations, directives

**Date:** 2026-09-24 · Read-only pass. Scope excluding `*.spec.ts`:
`columns-schema/`, `schema/`, `mutations/`, `directives/`.
Criteria: `libs/table/CLAUDE.md` locked invariants + ADR-0014
including its 2026-09-24 amendment. Ranked most severe first;
each verified by reading the path end to end.

---

## F1 — `setColumns()` silently corrupts the table on a duplicate id in a production build

`mutations/update-columns.ts:17` (guard at `engine/columns.ts:51`,
collision at `engine/cells.ts:46`)

`setColumns` delegates to `resolveColumnDefs`, whose duplicate-id
check sits behind `if (typeof ngDevMode === 'undefined' || ngDevMode)`.
In a production build the check is stripped and two `ColumnDef`s with
the same `id` reach `baseColumns`. `buildDataCells` writes
`cells[column.id] = …` in a loop, so the second column's accessor
overwrites the first for every row; `toggleColumnVisible` and
`applyColumnOrder` both match by id and hit both entries.

The dev-only gate is justified in ADR-0014's amendment by *"a check has
already done its job by the time an app ships"*. That holds for
`createTable()`'s static `columns` config. It does not hold for
`setColumns()`, a **runtime write path** taking a list built from user
or server data — the #127 case the amendment lists as accepted risk,
except already reachable.

**Scenario**

```ts
// layout restored from localStorage, written by an older app
// version that emitted `total` twice
const saved: ColumnDefInput<Order>[] = JSON.parse(
  localStorage.getItem('cols') ?? '[]',
);            // [{id:'id'},{id:'total'},{id:'total'}]

table.columns.update(setColumns(saved));
```

Dev throws and the developer fixes the payload. Production does not.
Three header cells render, but `renderRows()[n].cells.total` holds only
the *second* `total` column's accessor output, and a column picker's
`toggleColumnVisibility('total')` flips both entries at once — so the
checkbox and the rendered table disagree.

---

## F2 — `reorderColumns()` with a partial id list produces duplicate `order` values, and the move silently does not happen

`mutations/update-columns.ts:24` → `engine/columns.ts:65-74`

`applyColumnOrder` assigns `orderById.get(column.id) ?? column.order`.
The doc comment says absent ids "keep their current order", but both
numbering schemes live in the same 0-based space, so a partial list
collides with the untouched columns' indices instead of sitting beside
them.

Consumers sort with `.sort((a, b) => a.order - b.order)` — every
grouping story host does, e.g.
`stories/grouping/grouping-basic/grouping-basic-story-host.component.ts:47`
— and `Array.prototype.sort` is stable, so the earlier array position
wins a tie.

**Scenario**

```ts
// columns declared [id, name, total] → order 0, 1, 2
// drag-to-front on "total" emits only the moved id
table.columns.update(reorderColumns(['total']));
```

Result: `total.order = 0`, `id.order = 0`, `name.order = 1`. `total`
and `id` tie at 0; `id` is earlier in the array, so the stable sort
keeps it first — the dragged column does not move. Only a full
permutation of every id behaves, and nothing in the signature or the
check path enforces that.

---

## F3 — a consumer-declared `ColumnDef.meta` map is discarded the moment any non-`VISIBLE` rule targets that column

`mutations/update-columns.ts:17` / `columns-schema/metadata.ts:85`,
mechanism at `engine/columns.ts:168-176`

`ColumnDefInput` is `Pick<ColumnDef,'id'> & Partial<Omit<…>>`
(`api/types.ts:106`), so `meta` is accepted on both `createTable()`'s
`columns` and `setColumns()`. `foldColumnRules` builds a **fresh**
`meta` map from rule entries only and returns `{ ...withVisible, meta }`,
replacing whatever the base column carried instead of merging.

The branch is asymmetric, which is what makes it a bug rather than a
policy: a column with no rules, or with only `VISIBLE` rules, keeps its
declared `meta` (the `meta` local stays `undefined`, spread skipped at
line 176). One `metadata()` call on any other key wipes it.

**Scenario**

```ts
const WIDTH = createColumnMetaKey<number>();
const ALIGN = createColumnMetaKey<'start' | 'end'>();

const table = createTable(data, {
  trackBy: 'id',
  columns: [{ id: 'total', meta: new Map([[ALIGN, 'end']]) }],
  columnsSchema: (p) => { metadata(p.total, WIDTH, 120); },
});

readColumnMeta(table.columns()[0], ALIGN); // undefined — was 'end'
```

Deleting the `metadata(p.total, WIDTH, 120)` line makes `ALIGN` read
back correctly — an inverted relationship no consumer will guess. A
header template branching on `ALIGN` renders left-aligned currency.
Fix direction: seed the merge from `column.meta` rather than a fresh
map; single-writer per `(columnId, key)` still holds because
`resolve.ts:37` rejects a second *rule* on the pair, and a declared
`meta` entry is not a rule.

---

## F4 — `assertDeclarationsAreKnown` throws in production builds, contrary to ADR-0014's 2026-09-24 amendment

`schema/validate.ts:16`

The amendment states plainly that construction-time checks are gated to
dev builds and stripped from production. `resolveColumnDefs`
(`engine/columns.ts:51`) complies. `assertDeclarationsAreKnown` does
not — no `ngDevMode` guard — and neither do its callers' wrappers
(`engine/columns-schema/resolve.ts:23`, and `:37`'s
`assertMetadataKeysAreUnique`). This reaches all four declaring
surfaces named in the file's own docstring: `columnsSchema`,
`withGrouping` (`api/features/with-grouping/feature.ts:112,169`),
`withFiltering`, `withSorting`.

**Scenario**

```ts
// grouping levels restored from a shareable URL
const levels = new URLSearchParams(location.search)
  .get('groupBy')?.split(',') ?? [];   // ['region','legacy_tier']

createTable(data, { trackBy: 'id', columns }, withGrouping({ levels }));
```

`legacy_tier` was removed from `columns` in a later release. In
production the throw is not stripped, so `createTable()` raises during
component construction and the route renders nothing — a blank screen
from a stale bookmark. Under the amendment's stated policy the check is
absent in that build and the unknown level degrades through paths that
already exist for it (`feature.ts:196` degrades rather than throws for
exactly this class).

Whether the fix is gating these three sites or carving them out of the
amendment is a decision, not a change the reviewer could make — the
amendment's closing paragraph names #127 as the place to reopen it.
Recorded because today the code and the ADR disagree, and the gate is
applied inconsistently across construction checks *within the same fold*.

> **Caller's note (2026-09-24).** The amendment landed earlier the same
> day as decision R7 and is not yet implemented — the gating rides with
> #129's N2. So F4 is owed work, not a latent bug. It stands as
> evidence that the gate must be applied to the *whole* fold at once,
> and it is the same asymmetry F1 exploits from the other side.

---

## F5 — `NgpTableRowDirective` registers its element in an `effect()` with no cleanup

`directives/ngp-table-row.directive.ts:48-54`

```ts
effect(() => { this.rowAnimation?.registerRowElement(this.rowId(), element); });
inject(DestroyRef).onDestroy(() => {
  this.rowAnimation?.unregisterRowElement(this.rowId(), element);
});
```

No `onCleanup`, so a re-run registers under the new id without
unregistering the old, and the `DestroyRef` hook only ever unregisters
the *last* id the instance held. The inline comment justifies this with
"`@for` tracks by row id" — a claim about the **consumer's** template.
Nothing enforces it: `docs/3-ui/directives/row-animation.md` states no
`track` requirement, and neither does the directive's contract.

**Scenario**

```html
@for (row of table.renderRows(); track $index) {
  <tr [ngpTableRow]="row"> … </tr>
}
```

Delete a row from the middle. Angular reuses the DOM instances and
destroys only the tail, so every surviving instance re-runs its effect
under a new id while the deleted row's id keeps its entry in
`NgpTableRowAnimationDirective.rowElements`, holding a live
`HTMLElement` for the table's whole lifetime. On a table with churn
(live feed, paginated list re-keyed per page) the map grows without
bound.

`measureMoves` iterates only current `renderRows()` ids, so stale
entries are never *read* — the observable defect is retention, not a
wrong animation. `effect((onCleanup) => { … onCleanup(() =>
unregister(id, el)); })` closes it without depending on the consumer's
`track`.

---

## Checked and clean

- **`columns-schema/schema.ts`** — pass-throughs; `columnSchema()` runs
  the fn once, eagerly, through its own session.
- **`columns-schema/rules.ts`** — `applyVisible`/`applyVisibleAsync`
  target the exempted `VISIBLE` key, matching `resolve.ts:41`'s skip and
  the AND-combine. `applySortNulls` targets `SORT_NULLS`, which is *not*
  skipped at `resolve.ts:41`, so its "single-writer, throws at resolve
  time" docstring is true.
- **`columns-schema/metadata.ts`** — both record functions resolve the
  recorder off the handle they were given, never a session-wide one; a
  rule cannot be recorded against another schema's session.
- **`schema/path-proxy.ts`** — one session per schema-fn run; `record()`
  re-checks `assertOpen()` on every call, so a stashed handle used in a
  later async callback throws rather than leaking into the wrong rule
  set. The handle cache is per-proxy, therefore per-session.
- **`mutations/row-mutations.ts`** — copies before splicing, array form
  inserts one contiguous block in order, `at` clamped;
  `removeRow`/`patchRow` go through `resolveIndex`, which re-verifies an
  `indexById` hit with one `trackBy` call before trusting it. No updater
  loses or duplicates a row.
- **`mutations/update-grouping.ts`** — `addGroupLevel` no-ops on a
  present id, `removeGroupLevel` filters, `reorderGroupLevels`
  bounds-checks both indices.
- **`mutations/optimistic-mutations.ts`**, **`row-edit-mutations.ts`** —
  every updater returns a complete `EditingState` (`swapRowId:226`,
  `createRow:143` return all three fields, not a partial spread);
  `open ⊆ snapshots` preserved on each path; `beginEdit`'s `{ insert }`
  and `createRow`'s array form resolve the inserted index against the
  *newly written* array, and the stale `indexById` they pass cannot
  produce a false hit because `resolveIndex` verifies it.
- **`ngp-table.directive.ts`**, **`ngp-table-cell.directive.ts`**,
  **`ngp-table-header-cell.directive.ts`**, **`table.tokens.ts`** — no
  inline styles, no attribute duplicated for styling and data, no
  subscriptions.
- **`ngp-table-row-animation.directive.ts`** — `afterRenderEffect` is
  destroy-scoped by Angular; `unregisterRowElement` identity-checks
  before deleting, so a re-entering row with the same id is not
  unregistered by the leaving instance; `element.animate()` sets no
  `fill`, so no inline style is left behind; `previousRowTops` is
  replaced each measure with only currently-rendered ids.
- **No `hostDirectives` anywhere in `src/`** — that rule cannot be
  violated today.

---

## Considered, not reported as defects

**`ngp-table-row.directive.ts:28` binds `isExpanded` from a core
directive.** This is the letter of the "which `RenderRow` fields a
directive may bind" rule, but the reviewer could not construct the lie
it warns about. `flattenVisible` (`engine/flatten.ts:30,40`) stamps
`isExpanded` only when `expanded !== undefined` **and** the row has
children, so it is `undefined` both with no expansion feature composed
and on every leaf row; the binding's `?? null` then removes the
attribute. `aria-expanded` lands on exactly the expandable rows. The
coupling is real; the defect is not demonstrable.

**`toggleColumnVisibility()` is inert on a column governed by
`applyVisible()`.** `foldColumnRules:166` reads
`visibleValues ? isEveryVisibleValueTrue : column.visible`, so once any
`VISIBLE` entry resolves the base flag the mutation flipped is never
consulted. Documented intent
(`docs/2-columns/reference/column-metadata.md:92`), but a column picker
wired to `toggleColumnVisibility` does nothing on rule-governed
columns, with no error and no signal. Worth a line in the mutation's
doc.

**`schema/run.ts:19` does not `close()` in a `finally`.** If the schema
fn throws, the session stays open and a handle stashed before the throw
could still record into the discarded rules array. No scenario reaches
a live table — `columnSchema()` propagates the throw and returns
nothing.

**`ngp-table-row-field.directive.ts` is a structural directive that
creates and clears embedded views**, against the attribute-only locked
invariant. Its docstring declares the intent openly and it ships from a
separate `@ngp/table/forms` entry point, so it reads as a deliberate
carve-out. No correctness failure found: the view is created once and
its context mutated in place, `viewRef` is nulled alongside `clear()`,
`ViewContainerRef` tears down on destroy. Flagged only because the
exception is not recorded in `CLAUDE.md` or an ADR.
