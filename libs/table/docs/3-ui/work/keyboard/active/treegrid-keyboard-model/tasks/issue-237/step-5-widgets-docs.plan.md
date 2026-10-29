---
step: 5
type: docs
commit: docs
depends_on: [4]
files:
  - libs/table/docs/3-ui/directives/core.md
  - libs/table/docs/3-ui/directives/sort.md
  - libs/table/CONTEXT.md
---

# Step 5 — Docs: widgets in cells

Documents the shipped widget behaviour in the directive specs and the glossary.

Decisions: K6a, K6b, K6c, K32, K34–K38

## Do

- `core.md`, Grid navigation section: add "Widgets in cells".
  - Single-widget cells focus the widget; it holds the Tab stop.
  - Composite cells: Enter/F2 in, Esc/F2 out, click in, focus out.
  - Cell descendants stay `-1`; one Tab stop per table.
  - Editable targets never navigate; `preventDefault()` keeps any key.
  - A nested grid is a composite cell's content.
- `core.md` cell row: replace "No behavior logic yet" only where it now contradicts this.
- `sort.md`: the sort button is a single-widget header cell (header stops arrive with #236).
- `CONTEXT.md`: add terms for single-widget cell and composite cell.

## Out of scope

- Header filter inputs and header stops (#236).
- Panel arrow stop (#241).

## Done when

- `npm run llms:check` clean (run `npm run llms` if the docs changed what it generates).
