---
title: Render-row cell values — decisions
type: decisions
date: 2026-09-18
status: grilling
ticket: https://github.com/DvirMon/ng-table/issues/80
---

# Render-row cell values — decisions

Grill log for [#80](https://github.com/DvirMon/ng-table/issues/80) — exposing a resolved
cell value on `RenderRow` so templates stop calling `ColumnDef.accessor`.

## Dependency ranking (2026-09-18)

Sub-features in #80's Scope, edges mapped between nodes:

- **Core** — C1 the cell-value surface on `RenderRow`. Everything else reads its shape.
- **Dependent** — C2 the ADR-0014 `accessor` wrap (its wrap site is C1's build pass);
  C4 documenting `accessor` as the value/label contract (states what C1/C2 settled);
  C5 migrating `src/stories/grouping/*` off `column.accessor(rowData)` (needs C1 shipped).
- **Independent** — C3 whether a non-primitive reaching `toGroupKey` reports (S8/OQ-5).
  Touches `engine/grouping.ts` only; no edge to C1's shape.

Grilled in that order: C1 first, C2 alongside it (shared wrap site), C3/C4/C5 after.

## Decisions

- **2026-09-18 — D1. Cells are built eagerly, inside the existing `renderRows` computed.**
  Not a `computed()` per row or per cell: `renderRows` already is the memo boundary, so
  per-cell signals would add N×M graph nodes and buy no extra memoization. Built in the same
  `.map()` pass that stamps `index`/`sourceIndex` today, per ADR-0011/ADR-0005 precedent.

- **2026-09-18 — D2. Rejected: lazy `cellsOf(row)`.** Cannot live on `RenderRow` — that
  would allocate a closure per row and break the "`rows()` never returns wrapper objects"
  invariant — so it would have to be a store method. Uncached it is a per-CD-pass call, the
  same cost shape as today's template `accessor` call, so it does not solve the problem.
  Cached it needs a `Map<RowId, Cell[]>` plus a second computed to build the same eager
  array and hand out slices — strictly more machinery for an identical result.

- **2026-09-18 — D3. `cells` is a record keyed by `columnId`, not an ordered array.**
  `readonly cells: Readonly<Record<string, unknown>>`. The engine owns *resolving the value*;
  the consumer keeps owning which columns render and in what order. An ordered array would
  make the engine own a column render order it does not have today and would promote every
  story host's local `visibleColumns` computed into core — a much larger migration than #80's
  stated goal. Same shape as the existing `aggregates`, so a `kind: 'group'` row and a data
  row read identically.
  - Settles #80's Q1 (eager, not lazy) and Q2 (cells do **not** follow visibility/order —
    the consumer's own `visibleColumns()` loop stays).
  - Note: `renderRows` gains a `columns()` dependency either way, and `columns()` changes
    identity on any visibility toggle, so "hiding a column recomputes every row" is a cost of
    building values in `renderRows` at all — not a cost of filtering. Q2's stated tradeoff
    dissolves.

- **2026-09-18 — D4. `cells` carries bare values, not a forms-like cell object.**
  A richer cell mimicking a Signal Forms field (value + dirty/touched/valid/disabled) is
  rejected. Row editing already binds to Signal Forms directly — an `applyEach` array form
  over `data()` — and per-cell readonly/disabled is the consumer's forms schema, with
  `1-state/features/row-editing.md:93` stating no `ColumnDef` field for it exists or is
  planned. The render-row → field-node bridge is already shipped as `RenderRow.sourceIndex`
  (D23). A cell object would be a second field model kept in sync with the real one by hand.
  - **Structural reason it cannot merge:** `accessor` is an arbitrary read-only derivation
    with no inverse (`row => row.owner.name`, `row => a * b`). A form field is a writable
    source with a path; a cell is a projection with no path back, and a computed column has
    no field at all. Mapping is field → cell only, never cell → field.
  - **Extension path if cell-level state is ever wanted:** a feature contributes its own
    optional `RenderRow` field, the way `isExpanded`/`hasChildren`/`aggregates` already do —
    not by thickening `cells`. Matches `2-columns/reference/signal-forms-techniques.md`
    §4/§5, both deferred until a real consumer needs them.

- **2026-09-18 — D5. A `kind: 'group'` row's `cells` carries its aggregates only.**
  `cells = { ...aggregates }`. The group's own label is `groupKey.label`, never a `cells` entry.
  - **Amended 2026-09-19, superseding the original "aggregates plus the group value under
    `groupKey.columnId`" form.** That version merged two key spaces. `aggregates` is keyed by
    *declared column id* (`aggregates[column.id]` in `computeAggregates`), while
    `groupKey.columnId` has held a *row field* key since D7 — `node.columnId` comes from
    `readGroupFieldValue(row, key)`, bracket access on the row, and the field name is a leftover
    from before that change. `resolveGroupLabel` treating "a column whose id matches" as a
    *fallback tier* is the proof the match is coincidental. Consequences of the merged form:
    grouping by a field with no matching column writes an entry no template loops over, and a
    column id colliding with an unrelated field puts the group value in the wrong column.
    ADR-0021 makes the separation of the two vocabularies an accepted rule.
  - **The label never needs to enter `cells`.** `groupKey` is now
    `{ columnId, value, label }`, and `label` already resolves explicit → a column whose id
    matches → the raw field name (D7a). A group header renders `row.groupKey.label`.
  - So `cells` stays wholly column-keyed on both row kinds — `accessor` output for a data row,
    aggregates for a group row. One vocabulary, no coincidental matches.
  - `engine/grouping.ts` still needs no change: `cells` is stamped centrally in `renderRows`
    alongside `index`/`sourceIndex` (ADR-0011 precedent).

- **2026-09-18 — D6. Values are raw; formatting stays in pipes.** `{{ row.cells[column.id] |
  dealAmount }}`. One pure pipe per formatting concern, as `grouping-story.pipes.ts` already
  does. Settles #80's Q3; formatting was already out of scope there.

- **2026-09-18 — D7. `accessor` defines, `cells` reads.** Not two ways to one value: `accessor`
  is the input (how a value is derived), `cells` the output (what it resolved to). Settles
  #80's Q4. `docs/2-columns/reference/` documents `accessor` as the value/label contract (C4).

- **2026-09-18 — D8. `cells` stays `Readonly<Record<string, unknown>>`; no value generic on
  `ColumnDef`.** Settles #80's Q5.
  - Precedent already in the repo: `grouping-story.pipes.ts:7-9` — *"Each takes `unknown`
    because a cell reads through `ColumnDef.accessor`, whose return type is erased."*
  - A per-column value type would not help in this template shape anyway: `row.cells[column.id]`
    indexes by a runtime `string`, so a mapped type collapses to the union of every column's
    value type. Narrowing only pays when indexing by a literal, which a loop over columns never
    does. Generifying `ColumnDef` would ripple through the columns config, `columnSchema()`, the
    `ColumnsPath` proxy, `setColumns` and the generated overloads for no gain
    (`simplest-signature-first`).
  - Narrowing seam stays the consumer's own pipes taking `unknown`, as `groupKey.value` is
    handled today.

- **2026-09-19 — D9. #80 wraps the new cells site only; the one remaining legacy site is a
  follow-up.** #80 introduces `readAccessor(column, row, reportedColumns)` — one wrap, one dedup
  Set per evaluation, matching `computeAggregates`' shape — and uses it from `buildDataCells`.
  - **Corrected site count.** An earlier pass in this grill cited three unguarded `accessor`
    sites. Two of them (`grouping.ts:281`, `grouping.ts:417`) no longer exist: grouping reads
    `row[key]` via `readGroupFieldValue`, not `column.accessor`, since D7. The only legacy site
    left is `with-sorting.ts:117-118`.
  - **Why it is not folded in here.** `accessor` throwing inside the sort comparator has no
    fallback ADR-0014 settles: its `accessor` row says "the cell reads `undefined`", which in
    the empty-check would sort the row into the empty bucket — *silently mis-sorted*, the exact
    outcome the ADR's `sortFn` row rejects in favour of "that column's sort does not apply".
    Two of the ADR's own fallbacks collide, and picking one quietly inside a cell-value issue is
    how the wrong one ships. The follow-up issue settles it explicitly.

- **2026-09-19 — D10. Duplicate column ids throw at construction, guarded by `ngDevMode`.**
  Keying `cells` by column id makes uniqueness load-bearing: two columns sharing an id collapse
  to last-wins in the record, and *both* table cells then render the same value. That is not
  hypothetical — TanStack v8 keys `Row._valuesCache` by column id, the same
  `Record<columnId, unknown>` shape, ships no check, and produces exactly that. Nothing
  validates uniqueness today; `resolveColumnDefs` (`engine/columns.ts`) just `.map()`s.
  - **Scope: the `id`, never the `accessor`.** Two columns reading one field under different
    headers is an endorsed pattern — TanStack's maintainer ("same `accessorKey`, unique `id`",
    discussion #5148) and AG Grid (`field`, `field_1`). An id-scoped throw keeps it legal.
  - **Placement: `resolveColumnDefs`, construction time.** Unanimous across every library that
    checks at all — Angular CDK in `_cacheColumnDefs()`, AG Grid in `buildColumnTree`. Never
    per row, never at first paint. Matches ADR-0014's construction class: deterministic, fires
    on first run, and no sane degraded reading of "which of these two is the value".
  - **Message**, blending CDK's recognisable shape with AG Grid's habit of stating the rule
    inside the text:
    `[createTable] Duplicate column id provided: "name" — ensure all column ids are unique.`
  - **Guard: `ngDevMode`, matching Angular CDK.** Accepted consequence: in a production build
    the throw is stripped and the duplicate silently resolves last-wins. Accepted cost:
    a config error does not take down a production app. **Noted inconsistency** — this is the
    only dev-guarded construction throw in the library; every other one is unconditional.
    Whether they should all be guarded is an ADR, not this issue.
  - **Rejected: AG Grid's auto-suffix** (`id`, `id_1`). Its own docs say "It is not recommended
    to rely on IDs generated with this behaviour", and its warning fires only when an explicit
    `colId` was rewritten — a collision between two duplicate `field`s is suffixed silently.
    A remedy the vendor tells you not to depend on has a documentation cost and no correctness
    gain over a throw.
  - Survey backing this: Angular CDK throws; TanStack v8 and MUI X ship no check (MUI X has an
    open issue since 2022 asking for exactly this throw, current symptom a stack overflow);
    AG Grid rewrites; PrimeNG and Handsontable are positional and have no id to collide.

- **2026-09-19 — D11 (closes C3). A non-primitive group value with no `valueOf` reports via
  `console.error`.** One report per field per evaluation, matching the dedup granularity of
  `computeAggregates` and `evaluateGroupWhen`. `toGroupKey` collapses every distinct object
  into `"object:[object Object]"`, so without a report the grouping is silently wrong while the
  table renders fine. The fix already exists (`GroupingRule.valueOf`, D7), which is what makes
  the report actionable — it names the missing declaration.
  - Extends ADR-0014's reasoning rather than applying it: the ADR covers a callback *throwing*,
    this is a silent collapse. Same principle — a failure must be visible.
  - `console.error` matches the two existing report sites in `engine/grouping.ts` and the ADR's
    own "for now" scoping. A real diagnostics channel (injectable reporter, or a
    `table.diagnostics()` signal needing no DI) is its own ADR covering every site at once —
    `engine/` is pure, so an injected `ErrorHandler` cannot be reached from where these fire.
  - The S8/OQ-5 framing ("a column with no `accessor`") is obsolete: since D7, `accessor` is
    not in the grouping path at all.

## Forked out of this grill

- **Per-cell reactive granularity** — whether a cell should be its own signal/computed
  (Signal-Forms-field-shaped) rather than a plain value on the row. Moved to its own session
  2026-09-18. Not settled here; D1's eager plain-value build stands unless that thread
  overturns it.
  - **Correction 2026-09-18 (supersedes the original framing).** The argument this thread forked
    on was *"`TableDataInput<TRow> = WritableSignal<TRow[]>` is one signal for the whole array,
    so leaves cannot be finer-grained than the root."* That is **wrong as stated** and must not
    be carried forward. Angular's `computed` recomputes on any dependency change but only
    *propagates* when its own result differs by `Object.is` — so a fine-grained leaf over a
    coarse root does work, and that is exactly how a Signal Forms field reads a single
    `WritableSignal` model and still behaves per field. A coarse `data` signal does not by
    itself rule out per-cell nodes.
  - **What actually separates a form field from a cell** — three differences, none about the
    root signal's shape:
    1. **A field is a write target holding state that is not derived from the model.**
       `touched`, `dirty`, validation errors have no other home, which is why `FieldTree`
       nodes exist (`row-editing/active/with-row-editing/2-decisions.md`: *"`FieldState.reset()`
       clears touched/dirty only"*). A cell is a read-only projection and `accessor` has no
       inverse (D4), so a cell node would hold one already-present derived value and no state
       of its own — the node earns nothing.
    2. **The field tree is structural; render rows are pipeline output.** `form(model)` builds
       nodes from the model's *shape*, once, and the tree survives model changes. Render rows
       are the result of filter → group → sort → expand, with rows synthesized (`kind: 'group'`,
       backing no `TRow`) and destroyed per evaluation — and columns mutate too (visibility,
       reorder, `setColumns`). Per-cell nodes would be an N×M grid dynamic on **both** axes,
       rebuilt by a pipeline rather than mirroring a type.
    3. **Signal Forms already handles the easier one-axis version imperfectly.** For `applyEach`
       over `data()`, the same decisions doc records as accepted costs: *"N field nodes for N
       rows, independent of pagination or virtual scroll"* and *"structural mutation
       (`addRow`/`removeRow`) misattributing dirty/touched, since Signal Forms arrays are
       index-keyed with no identity hook. Both are upstream limits with no local fix."* Nodes
       keyed to `renderRows()` inherit that and add a second dynamic axis.
  - **The question to actually answer in that session** is not whether per-cell granularity is
    achievable — it is — but: a cell node would hold one derived value and no state of its own,
    and `{{ }}` interpolation already skips unchanged DOM writes. What does the extra
    propagation precision buy, weighed against an N×M node set keyed to a row set the pipeline
    rebuilds, plus the `(rowId, columnId)` cache and pruning contract that set would need
    alongside ADR-0006?
  - **Verify from source before deciding:** how `FieldState.value` actually reads and propagates
    in Signal Forms (pinned version, not `main`). The claims above about *why* field nodes exist
    are grounded in this repo's own docs; the propagation mechanism is assumed from `computed`
    semantics and should be confirmed against `packages/forms/signals/src/`.
  - Revisit condition: a granular *source* — per-row signals from the consumer, or the library
    wrapping rows internally. The latter is an internal row copy, which the locked invariants
    forbid, so reopening is an ADR on the data-input shape, not a cell-model change.

## Open

- C5 — which of the six `src/stories/grouping/*` hosts move off `column.accessor(rowData)` in
  #80 vs. follow-ups. Not a design question; `/to-tasks` decides it while writing step files.
