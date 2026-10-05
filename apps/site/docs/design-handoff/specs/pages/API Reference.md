---
kind: page
archetype: API Reference
frame: pages/API Reference.dc.html
composes_only: true
rule: >
  This file assigns components to slots and sets page-only decisions.
  It never restates styling. If a value is missing here, it lives in the component spec.
---

# Page — API Reference

Table-dense reference page. Same shell, different body composition.

## Differences from Doc Article

| Slot          | Change                                                                                                                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| main › body   | Dominated by `table-row` groups, one table per API surface, each under its own H2                                                                                                                   |
| main › body   | `code-chip` used heavily in name/type cells                                                                                                                                                         |
| main › body   | `callout` variant `warning` for deprecations                                                                                                                                                        |
| right (`toc`) | Always renders — one TOC entry per H2 (API surface). **Overrides** Doc Article's 2-H2 minimum: a lookup page with one table still gets the column. A page with no H2 at all is not an API Reference |

## Page-only rules

- Every table has the same column set within a page. Do not vary columns table to table.
- Type values are `code-chip`, not plain text.
- Long prose belongs in a Doc Article; this page is lookup-optimized.
- Below `--ngpt-sys-breakpoint-md`, tables scroll horizontally in a focusable container rather than wrapping cells.

## Frame notes

`pages/API Reference.dc.html` shows three surfaces, one table each, same three columns throughout, with a
`warning` callout carrying a deprecation. Every identifier and type in it is `MOCK`. **No sidebar item is
active** — this archetype has no entry in the tree yet (`Content Model.md` § Seed tree), and the frame
shows that rather than inventing one.
