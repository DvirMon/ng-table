# Step 3 test plan — Tree row ARIA and keys

Step: [step-3-tree-row-aria-keys.plan.md](step-3-tree-row-aria-keys.plan.md)
Spec file: `libs/table/src/directives/ngp-table-tree-row.directive.spec.ts`

## Behaviour coverage
| Id | Behaviour | Source | Tested by |
|---|---|---|---|
| US21 | Each tree row announces its level and expanded state | spec § User stories 21; issue AC4 | A, B, C |
| US14 | → on a collapsed row expands it | spec § User stories 14; issue AC2 | D |
| US16 | ← on an expanded row collapses it | spec § User stories 16; issue AC2 | D |
| US19 | Enter on an expandable row toggles it | spec § User stories 19; K5b; issue AC2 | E |
| US20 | Enter on a leaf row does nothing | spec § User stories 20; K5b; issue AC2 | F |
| US15/US17 (this step's part) | → on an expanded or leaf row and ← on a collapsed or leaf row go unhandled by the row, so the host key map can enter the first cell or move to the parent | spec § User stories 15, 17; K14b; outline Do | F |
| K14b | The row handles only keys whose target is the row element itself, then calls `preventDefault()` | spec § Key handling; outline Do | D, G |
| US12/AC8 | RTL swaps expand and collapse | spec § User stories 12; issue AC8 | H |
| K5c | Core row keeps `role`, `aria-rowindex`, `data-*` | spec § Role and ARIA; issue AC4 | Not tested |

## Stubs (red phase)
- None. The step adds host bindings and a host `(keydown)` listener to the existing `NgpTableTreeRowDirective`. It creates no symbol that a test imports. In red, every seam fails on an assertion, not on `not implemented`.

## Seams — in red-green order
### A. Row `depth` → `aria-level` = depth + 1
- Test: `it.each([[0, '1'], [2, '3']])('binds aria-level %s as "%s"')`
- Asserts: with the existing `setup({ depth })`, `rowEl().getAttribute('aria-level')` is `'1'` for depth 0 and `'3'` for depth 2.
- Covers: US21
- Risk: damage high, likelihood high
- Why this seam: catches an off-by-one. `depth` is 0-based and `aria-level` is 1-based, so binding `depth` directly gives level 0, which is invalid ARIA. The depth-2 case catches a hard-coded `1`.
- Order reason: independent; the base case. It uses the existing mock-row host.

### B. Expandable row → `aria-expanded` follows `isExpanded`
- Test: `it.each([[true, 'true'], [false, 'false'], [undefined, 'false']])('binds aria-expanded "%s" on an expandable row when isExpanded is %s')`
- Asserts: `setup({ hasChildren: true, isExpanded })` gives `rowEl().getAttribute('aria-expanded')` equal to the expected string. A collapsed row has the attribute with value `"false"`; the attribute is not missing.
- Covers: US21
- Risk: damage high, likelihood high
- Why this seam: a collapsed row must say `"false"`. If the binding copies the `data-expanded` pattern (`'' : null`), a collapsed parent announces nothing, and screen-reader users cannot tell it has children.
- Order reason: independent of A. Same host.

### C. Leaf row → no `aria-expanded`
- Test: `it.each([false, undefined])('omits aria-expanded on a leaf row when hasChildren is %s')`
- Asserts: `setup({ hasChildren: value, isExpanded: true })` gives `rowEl().hasAttribute('aria-expanded') === false`. `isExpanded: true` makes sure the guard reads `hasChildren`, not `isExpanded`.
- Covers: US21
- Risk: damage high, likelihood high
- Why this seam: catches a binding that sets `aria-expanded` on every row. A leaf would then announce as a collapsible branch.
- Order reason: builds on B (same binding, adds the leaf guard).

### D. → on a focused collapsed row expands it; ← on an expanded row collapses it
- Test: `it.each(['ArrowRight', 'ArrowLeft'])('handles %s on the row itself: toggles toward the key and prevents default')`
- Asserts: a new host uses a real `createTable(mockTaskTreeRows, …, withTree(...))` under `[ngpTable]`, with `ngpTableTreeRow` on each row. ArrowRight is dispatched on row `t1` (collapsed); ArrowLeft is dispatched on `t1` after `table.tree.expand('t1')`. Each is a bubbling, cancelable `KeyboardEvent`. After `detectChanges`, `t1a` is rendered for → and gone for ←, and `t1`'s `aria-expanded` is `'true'` / `'false'`. A probe `keydown` listener, added on the row element after the directive, records `defaultPrevented === true`.
- Covers: US14, US16, K14b
- Risk: damage high, likelihood high
- Why this seam: catches a missing or reversed key mapping, and a missing `preventDefault()`. Without `preventDefault()`, the host key map also acts on the same press, e.g. → expands and also moves into the first cell.
- Order reason: builds on B, which supplies the `aria-expanded` the assertion reads. It adds the real-table host that E–H reuse.

### E. Enter on an expandable row toggles both ways
- Test: `it('toggles an expandable row open and closed on Enter and prevents default')`
- Asserts: Enter on collapsed `t1` renders `t1a`. A second Enter removes `t1a`. Both presses are `defaultPrevented` at the row probe.
- Covers: US19
- Risk: damage high, likelihood low
- Why this seam: catches Enter wired to `expand` only (the second press does nothing), or Enter missing from the handled keys.
- Order reason: builds on D (same host and probe).

### F. Keys the row does not own are left to the host
- Test: `it.each([...])('leaves %s unhandled on a %s row')`, with the cases: `ArrowRight` on expanded `t1`; `ArrowLeft` on collapsed `t1`; `ArrowRight`, `ArrowLeft` and `Enter` on leaf `t2`.
- Asserts: at the row probe `defaultPrevented === false`, and the rendered row ids are the same before and after.
- Covers: US15, US17, US20
- Risk: damage high, likelihood high
- Why this seam: catches a handler that calls `preventDefault()` on every arrow or Enter press. The host then skips the event (K6b), so ← to parent and → into the first cell stop working. It also catches Enter or ← changing a leaf's expansion. The probe reads `defaultPrevented` on the row, before the event reaches the host, so a host key map from step 2 cannot change the result.
- Order reason: builds on D. It is the negative side of the same key guard.

### G. A key from a cell or widget inside the row is ignored
- Test: `it.each(['cell', 'button'])('ignores Enter and ArrowRight whose target is a %s inside the row')`
- Asserts: in the D host template, the row holds `<td><button>…</button></td><td>{{ row.id }}</td>`. Enter and ArrowRight are dispatched on the `<td>` or `<button>` inside `t1`'s row. `t1a` is not rendered, and the row probe sees `defaultPrevented === false`.
- Covers: K14b
- Risk: damage high, likelihood high
- Why this seam: catches a missing `event.target === host` check. Without it, Enter on a consumer button inside the row toggles the row, and arrows in cell mode expand and collapse instead of moving cell to cell.
- Order reason: builds on D (same keys; adds the target guard).

### H. RTL swaps expand and collapse
- Test: `it('expands on ArrowLeft and collapses on ArrowRight under RTL')`
- Asserts: with `direction: rtl` set on the `<table>` host (the way `ngp-table.directive.spec.ts` does it), ArrowLeft on collapsed `t1` renders `t1a`, and ArrowRight then removes it. Both presses are prevented.
- Covers: US12/AC8
- Risk: damage low, likelihood low
- Why this seam: catches a row handler that reads `event.key` directly instead of going through the same direction swap as the host key map (`isRtlAt`, `swapHorizontal`).
- Order reason: builds on D.

## Types phase (after green)
None — no public type surface in this step.

## Not tested
- Core row keeps `role`, `aria-rowindex`, `data-*` (K5c): covered by the existing `ngp-table-row.directive.spec.ts` tests for those bindings. Step 3 adds none of these attributes to the tree row, so a test here would only re-check the core row.
- Unchanged `data-context-row` / `data-expandable` / `data-expanded`: covered by the existing tests in this spec file ('marks an expandable row…', 'omits data-expanded…', etc.). They are read-only.
- Spying on `table.tree.expand/collapse/toggle` calls: tested through rendered rows and `aria-expanded` instead. A spy would tie the tests to which method is called, not to the result.
- Dynamic update of `aria-level` when the same row's depth changes: it is the same binding as A, so it fails on the same bug. One seam.
- Re-reading RTL at keypress (host switched mid-session): covered for the host by `ngp-table.directive.spec.ts` — 'reads the host direction at keypress, so ArrowRight follows RTL once the host switches'. Over budget for the row: damage low, likelihood low.
- ← to parent, → into the first cell, and ↑ from the first row to the header: owned by step 2 (key map). This step only leaves those keys unhandled (F).
- Group header rows (K8a →/← in treegrid): no outline line asks the tree row to handle group headers. Their expandable or leaf behaviour follows the same `hasChildren`/`isExpanded` fields, so D–F cover the logic.

## Decisions applied
- `NGP_TABLE_STORE` is injected with `{ optional: true }`; the keys do nothing without it, so the existing specs stay untouched.
- `ngpTable` exposes an RTL reader that the row uses, not the private host.
- `aria-level` and `aria-expanded` are always bound, like the `data-*` attributes.
