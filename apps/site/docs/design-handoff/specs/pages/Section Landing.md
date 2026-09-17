---
kind: page
archetype: Section Landing
frame: pages/Section Landing.dc.html
composes_only: true
rule: >
  This file assigns components to slots and sets page-only decisions.
  It never restates styling. If a value is missing here, it lives in the component spec.
---

# Page — Section Landing

The first page of a sidebar section (e.g. "Overview" of *1. State Layer*). Orients, then routes onward.

## Differences from Doc Article

| Slot | Change |
| --- | --- |
| main › body | Leads with a short lede and a link list to the section's pages, not a `preview-window` |
| main › body | No `code-block` above the first H2 |
| right (`toc`) | Usually absent — landing pages are short |
| main › end | `pagination` prev points to the previous *section's* last page |

## Page-only rules

- The link list uses `inline-link` inside a `prose` list. Do not invent a card grid.
- Landing pages are one screen where possible. If it needs a TOC, it is a Doc Article, not a landing page.

## Frame notes

`pages/Section Landing.dc.html` renders the docs root (`/docs`, "Overview"): the one entry with no parent
section, so the `category-badge` resolves to `null` and is **absent**, and pagination is **next-only** with
the empty half left empty. All prose is `MOCK`.
