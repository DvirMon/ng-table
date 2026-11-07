---
step: 3
type: code
commit: feat
depends_on: [1, 2]
files:
  - libs/table/src/directives/ngp-table-tree-row.directive.ts
  - libs/table/src/directives/ngp-table.directive.ts
  - libs/table/src/directives/ngp-table-tree-row.directive.spec.ts
---

# Step 3 — Tree row ARIA and keys

Gives the tree row `aria-level`, `aria-expanded` and the keys that expand, collapse and toggle it.
The key map and the toggle button are left to other steps.

Decisions: K5, K5b, K5c, K14b

## Do

All source paths are under `libs/table/src/directives/`.

In `ngp-table-tree-row.directive.ts`:

- Bind `aria-level` = `depth + 1` always, like the `data-*` bindings.
- Bind `aria-expanded` = `"true"` / `"false"` only when the row has children. A leaf has no `aria-expanded`.
- Add a host `(keydown)`. Act only when `event.target` is the row element itself:
  - → expands a collapsed expandable row.
  - ← collapses an expanded row.
  - Enter toggles an expandable row. It does nothing on a leaf.
  - Each calls `table.tree.expand` / `collapse` / `toggle` and `event.preventDefault()`.
  - RTL swaps → and ←.
- Other keys and other targets are left alone.
- Inject `NGP_TABLE_STORE` with `{ optional: true }`. With no store the keys do nothing (the 10 existing specs have no `ngpTable`).

In `ngp-table.directive.ts`, expose a small reader for RTL (for example `isRtl()`, using `isRtlAt(host)`) instead of reading the private host. The tree row reads it through the store token.

## Watch out

- Do not touch `aria-level` or `aria-expanded` on the core `ngpTableRow` (K5c).
- The existing tree-row specs are read-only.

## Out of scope

- Toggle button ([step 4](./step-4-pointer-only-toggle.plan.md)).
- Key map ([step 2](./step-2-treegrid-key-map.plan.md)).

## Done when

- The approved test plan [step-3-tree-row-aria-keys.test-plan.md](./step-3-tree-row-aria-keys.test-plan.md) passes.
- `nx run shared-table:typecheck` clean.
- `nx run shared-table:typecheck-spec` clean.
