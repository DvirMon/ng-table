---
step: 4
type: code
commit: feat
depends_on: [3]
files:
  - libs/table/src/directives/ngp-table.directive.ts
  - libs/table/src/directives/cell-widgets.ts
  - libs/table/src/directives/focus-registry.ts
  - libs/table/src/directives/ngp-table.directive.spec.ts
---

# Step 4 — A nested grid is ordinary content of a multi-widget cell

Treats an inner `ngpTable` inside an outer cell as that cell's widgets, so the page keeps one Tab stop until the user enters.
Detail panels inherit this in #241.

Decisions: K6c, K36, K37, K38

## Do

- No nested-host set and no nested-host check. The outer cell holding an inner grid is `composite` (K38 role rule).
- While the outer cell is not entered, the outer marks the inner grid's focusables `-1`, including its roving `tabindex="0"`.
- Entering the outer cell restores the inner grid's latest originals; exit re-marks with a fresh snapshot.
- Keys inside the entered outer cell are already left alone (step 3). An inner Esc/F2 left unhandled exits the outer cell, one level per press.
- Focus landing inside the inner grid enters the outer cell and moves the outer position to it. The K9d focus-within flag stays set.
- The host observer also watches `tabindex` attribute changes (`attributes: true, attributeFilter: ['tabindex']`) inside non-entered registered cells. It records the inner grid's new value as the original and re-marks `-1`.
- Write only when the value differs, so the observer never loops on its own writes.

## Watch out

- The inner grid's binding never rewrites an unchanged value — a stale saved original leaves the inner Tab stop and inner store disagreeing.
- Do not strip `0` from the inner cell the user is on (entered outer cell).

## Out of scope

- Detail panels (#241) — a panel in a plain `<td>` is ignored today.
- Three-level nesting beyond what the same rule gives.

## Done when

- AC6: a nested grid in an outer cell owns its keys, with one Tab stop per outermost grid until the user enters.
- `npx nx run-many -t typecheck typecheck-spec -p shared-table` clean.
