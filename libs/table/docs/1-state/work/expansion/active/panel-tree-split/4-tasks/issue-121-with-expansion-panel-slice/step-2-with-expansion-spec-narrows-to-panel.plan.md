# Step 2 — `with-expansion.spec.ts` narrows to the panel

**PR scope:** ships alone. **Depends on: Step 1** — every assertion
here targets the `expansion` slice Step 1 introduces.

**Task type:** test

**Skills used:** unit-test

**Scaffolding agent:** test-implementer

## Files

- `libs/table/src/api/features/with-expansion.spec.ts` (rewrite)

## Why This Step Exists

`2-spec.md` §"Testing Decisions" is explicit: `with-expansion.spec.ts`
"keeps the open-id state, event, silent-write and prune cases; loses
every tree case." The tree cases already have a home —
`with-tree.spec.ts`, shipped whole in #119, already inherits every
tree assertion this file currently carries (`r1 → c1 → g1`, depth,
`parentId`, `hasChildren`, custom `childrenAccessor`, the lazy-children
case, the `withGrouping()` + tree composition). Leaving them here too
would be the exact "a spec asserts its own domain" violation the
maintainer docs call out — duplicated assertions that drift the moment
one copy changes and the other doesn't.

## What To Do

Start from the current file (631 lines) and cut it down to panel-only
assertions against the new `table.expansion` slice from Step 1.

### Delete entirely

- Every `expandAll`/`toggleExpanded` case whose assertion is about
  **tree shape** — depth, `parentId`, `hasChildren`, nested/grandchild
  visibility, `renderRows()` composition (lines ~220-434 of the current
  file: everything from `"renderRows() excludes a row's children..."`
  through `"custom childrenAccessor is honored..."`).
- The C1 grouping+tree composition case (lines 533-577) — it belongs
  to `with-tree.spec.ts`'s `[withGrouping(), withTree()]` cases now.
- `Row`/`CustomChildrenRow` interfaces and `makeRows()`'s nested
  `children` shape — the panel doesn't read row shape at all anymore.
  Replace with a flat row fixture (no `children` field needed).
- The `childrenAccessor`/`isExpandable` config parameter from every
  remaining test call.

### Keep, re-expressed against the new slice

Translate call sites 1:1 — same behavior, new spelling:

| Old | New |
|---|---|
| `store.toggleExpanded(id)` | `store.expansion.toggle(id)` |
| `store.expandedRows()` | `store.expansion()` |
| `store.everExpanded()` | `store.expansion.everExpanded()` |
| `store.expandAll()` | `store.expansion.expand()` |
| `store.expandAll(ids)` | `store.expansion.expand(ids)` |
| `store.collapseAll()` | `store.expansion.collapse()` |
| `store.rowExpanded.subscribe(...)` | `store.expansion.changed.subscribe(...)` — payload is now `{ added, removed }`, not a bare `RowId`; update every assertion that read individual emitted ids to read the change's `added`/`removed` arrays instead (see "Gains" below for the exact shape) |

Cases to keep, re-expressed:
- toggle flips collapsed → expanded → collapsed (multi-expand: A does
  not collapse B).
- `expand()` with no ids expands every row in `rows()` (was: every row
  with children — now every row, since there's no children concept on
  the panel).
- `expand(explicitIds)` unions explicit ids with what's already open.
- `collapse()` clears everything; `collapse(ids)` removes only those.
- `changed` emits on toggle/expand/collapse, completes on destroy
  (`TestBed.resetTestingModule()`).
- `{ emitEvent: false }` suppresses the emission on every write verb,
  state still changes.
- Pruning: removing an open row from `data` clears it from
  `expansion()` but not `expansion.everExpanded()`, via both write
  paths (`data.update()` directly, and `store.value.update(removeRow(id))`)
  — ADR-0006.
- Composes alone, end-to-end.
- `initial` seeds both `expansion()` and `expansion.everExpanded()` at
  construction, emitting nothing on `changed`.

### New cases (gains, per `2-spec.md` and the issue's acceptance criteria)

- **No stage claimed.** `withExpansion()` alone: `renderRows()` is 1:1
  with `rows()` (no row gets nested/duplicated), every row's `depth`
  is `0`, and `isExpanded` is unstamped (`undefined`) on every row —
  there's no contributor to the union, so `flattenVisible` never
  stamps it.
- **Composed with `withTree()`, isolation.** `createTable(data, config,
  withExpansion(), withTree({ childrenAccessor }))` (and the reverse
  argument order) on a row set where some rows have children: opening
  a panel on a row (`store.expansion.toggle(rowId)`) does **not**
  reveal that row's children in `renderRows()` — only
  `store.tree.toggle(rowId)` does. This is the direct test of the
  ADR-0012 correction (D8/E12) — the union collision the original ADR
  feared cannot happen because the panel contributes nothing.
- **`changed` payload shape.** One emission per write carrying the
  full symmetric difference: `expand([a, b])` on an empty set emits
  exactly one `{ added: ['a','b'], removed: [] }`, not two
  single-id emissions. Mirror `with-tree.spec.ts`'s equivalent
  assertions for `changed` (search that file for `ExpansionChange`
  usage) rather than inventing a new shape.
- **The deferred type-level case.** `with-tree.spec.ts` lines 1270-1276
  explicitly flag this as belonging here: "a trailing derive on
  grouping sees `s.expansion` only when `withExpansion()` is composed
  first (D25 — types stricter than runtime)." Copy that test's
  structure (lines 1277-1312) exactly, swapping `withTree`/`tree`/
  `TreeSlice` for `withExpansion`/`expansion`/`ExpansionSlice`: compose
  `withExpansion()` before `withGrouping(..., withComputed((s) => { expectTypeOf(s.expansion)... }))`
  — compiles; reverse the order — `@ts-expect-error`.

### `describe('types')` block

Rewrite the existing block (lines 584-630) against the new shape:
- `keyof typeof store` equals `keyof TableStore<Row> | keyof ExpansionMembers`.
- `store.expansion` matches `ExpansionSlice`; `store.expansion()` is
  `ReadonlySet<RowId>`.
- The `withComputed()` trailing-derive and derive-first compile cases
  (currently reading `s.expandedRows().size` in the derive block) —
  re-express reading `s.expansion().size`, keep both call-order forms.

## Implementation Notes

- `with-tree.spec.ts` is the sibling file — its `inContext()` helper,
  `makeColumns()`, and general fixture style are the pattern; its
  `describe('types')` block (starting ~line 1216) is the direct
  template for this file's equivalent block.
- Fixture rows no longer need a `children` field for the panel's own
  cases — only the isolation-with-`withTree()` case needs a row shape
  with `children`, and that can reuse (or lightly adapt) the existing
  `makeRows()` tree fixture, imported for that one test group only if
  it's simpler to keep than to duplicate.
- `expectTypeOf` blocks are inert at the vitest runtime — the real
  verification is `tsc -p libs/table/tsconfig.spec.json --noEmit`
  (or `nx run shared-table:typecheck-spec`), same caveat the file's
  existing header comment already states.

## Risks / Watchouts

- **Don't leave a stale tree case behind "just in case."** Every case
  this step deletes already exists, asserting the same behavior, in
  `with-tree.spec.ts`. A leftover duplicate here is coupling this
  spec to `withTree()`'s internals again, which is exactly what the
  split is undoing.
- **The `changed` re-expression is not a search-and-replace on
  `rowExpanded`.** The old member emitted once per affected id; the
  new one emits once per write with the full diff. A naive rename
  (`rowExpanded` → `changed`, subscriber still pushing into a flat
  `RowId[]`) will pass for single-id toggles and silently mis-assert
  for `expand()`/`collapse()` batch writes. Assert on `.added`/
  `.removed` arrays per emission, not a flattened id list.

## Non-Goals

- No changes to `with-tree.spec.ts` — it already owns every case this
  step's deletions rely on.
- No changes to `with-grouping/feature.spec.ts` — #120 already moved
  its collapse-dependent cases out.

## Acceptance Checks

- [ ] `nx run shared-table:typecheck-spec` clean.
- [ ] `nx test shared-table --testFile=with-expansion.spec.ts` —
      note for the user: this repo does not run tests unprompted: state
      this check is pending a manual/CI run rather than running it here.
- [ ] Every tree-shape assertion (depth, `parentId`, `hasChildren`,
      `childrenAccessor`) is gone from this file.
- [ ] A case asserts `withExpansion()` alone claims no render stage:
      `renderRows()` 1:1 with `rows()`, every `depth === 0`,
      `isExpanded` `undefined` on every row.
- [ ] A case asserts composing `withExpansion()` with `withTree()` in
      either order keeps panel-open and tree-open independent —
      opening a panel never reveals children.
- [ ] The deferred D25 type-level case (`s.expansion` typed only when
      `withExpansion()` precedes `withGrouping()`) is present.

---
← [Step 1: `withExpansion()` narrows to the detail panel](step-1-with-expansion-narrows-to-panel.plan.md) | [Step 3: Docs and ADRs catch up](step-3-docs-and-adrs-catch-up.plan.md) →
