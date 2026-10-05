---
step: 1
type: story
commit: ref
depends_on: []
files:
  - libs/table/src/stories/grouping/grouping-basic/grouping-basic-story-host.component.html
  - libs/table/src/stories/grouping/grouping-basic/grouping-basic-story-host.component.ts
  - libs/table/src/stories/grouping/grouping-keys/grouping-keys-story-host.component.html
  - libs/table/src/stories/grouping/grouping-keys/grouping-keys-story-host.component.ts
  - libs/table/src/stories/grouping/grouping-when/grouping-when-story-host.component.html
  - libs/table/src/stories/grouping/grouping-when/grouping-when-story-host.component.ts
  - libs/table/src/stories/grouping/grouping-order/grouping-order-story-host.component.html
  - libs/table/src/stories/grouping/grouping-order/grouping-order-story-host.component.ts
---
# Step 1 — Four grouping hosts bind the core directives

The basic, keys, when and order hosts bind `ngpTable` and `ngpTableRow` instead of hand-written depth and kind attributes.
The other four hosts are left for Step 2, and the shared CSS for Step 4.

Decisions: [G79](../../../../../../../decisions/grouping.md)

## Do

```html
<table [ngpTable]="table" class="story-host__table grouping-story__table">
  ...
  <tr [ngpTableRow]="row">
```

- Add `[ngpTable]="table"` to the `<table>` and `[ngpTableRow]="row"` to every body `<tr>`.
- Remove the hand-written `[attr.data-row-kind]` and `[attr.data-depth]` bindings. `ngpTableRow` emits both, plus `--ngp-table-row-depth`.
- Import `NgpTableDirective` and `NgpTableRowDirective` from `../../../index` into each host's `imports`.

## Watch out
- Keep `[class.grouping-story__cell--label]` on label cells. Step 4 rewires the rule it reads.
- Existing per-depth CSS keeps working. It keys on `data-depth`, which `ngpTableRow` now emits.
- The `<table>` in grouping-basic spans several lines and has other bindings. Keep them.

## Out of scope
- `grouping-story.css`.
- The other four hosts (Step 2).
- `grouping-collapsible` (Step 3).

## Done when
- [ ] No `[attr.data-depth]` or `[attr.data-row-kind]` binding remains in these four hosts.
- [ ] Each body `<tr>` binds `[ngpTableRow]="row"` with no bare `ngpTableRow` attribute beside it.

---
[Step 2: Four more grouping hosts bind the core directives](step-2-core-directives-columns-aggregates-selection-async.plan.md) →
