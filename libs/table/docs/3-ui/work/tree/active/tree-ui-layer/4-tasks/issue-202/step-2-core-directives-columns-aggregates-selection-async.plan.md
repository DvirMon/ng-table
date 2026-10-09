---
step: 2
type: story
commit: ref
depends_on: []
files:
  - libs/table/src/stories/grouping/grouping-columns/grouping-columns-story-host.component.html
  - libs/table/src/stories/grouping/grouping-columns/grouping-columns-story-host.component.ts
  - libs/table/src/stories/grouping/grouping-aggregates/grouping-aggregates-story-host.component.html
  - libs/table/src/stories/grouping/grouping-aggregates/grouping-aggregates-story-host.component.ts
  - libs/table/src/stories/grouping/grouping-selection/grouping-selection-story-host.component.html
  - libs/table/src/stories/grouping/grouping-selection/grouping-selection-story-host.component.ts
  - libs/table/src/stories/grouping/grouping-async-rule/grouping-async-rule-story-host.component.html
  - libs/table/src/stories/grouping/grouping-async-rule/grouping-async-rule-story-host.component.ts
---

# Step 2 — Four more grouping hosts bind the core directives

The columns, aggregates, selection and async-rule hosts bind `ngpTable` and `ngpTableRow` instead of hand-written depth and kind attributes.
The first four hosts are left to Step 1, and the shared CSS to Step 4.

Decisions: [G79](../../../../../../../decisions/grouping.md)

## Do

```html
<table [ngpTable]="table" class="story-host__table grouping-story__table">
  ...
  <tr [ngpTableRow]="row"></tr>
</table>
```

- Add `[ngpTable]="table"` to the `<table>` and `[ngpTableRow]="row"` to every body `<tr>`.
- Remove the hand-written `[attr.data-row-kind]` and `[attr.data-depth]` bindings. `ngpTableRow` emits both, plus `--ngp-table-row-depth`.
- Import `NgpTableDirective` and `NgpTableRowDirective` from `../../../index` into each host's `imports`.

## Watch out

- Keep `[class.grouping-story__cell--label]` on label cells. Step 4 rewires the rule it reads.
- grouping-selection and grouping-aggregates each have two label-cell branches. Both keep the class.
- Existing per-depth CSS keeps working. It keys on `data-depth`, which `ngpTableRow` now emits.

## Out of scope

- `grouping-story.css`.
- The basic, keys, when and order hosts (Step 1).
- `grouping-collapsible` (Step 3).

## Done when

- [ ] No `[attr.data-depth]` or `[attr.data-row-kind]` binding remains in these four hosts.
- [ ] Each body `<tr>` binds `[ngpTableRow]="row"` with no bare `ngpTableRow` attribute beside it.

---

← [Step 1: Four grouping hosts bind the core directives](step-1-core-directives-basic-keys-when-order.plan.md) | [Step 3: Collapsible data rows use the tree pair](step-3-collapsible-data-row-tree-pair.plan.md) →
