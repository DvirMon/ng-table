---
kind: page
archetype: Examples Gallery
frame: pages/Examples Gallery.dc.html
composes_only: true
rule: >
  This file assigns components to slots and sets page-only decisions.
  It never restates styling. If a value is missing here, it lives in the component spec.
---

# Page — Examples Gallery

A page whose body is a sequence of live examples.

## Differences from Doc Article

| Slot          | Change                                                                                                                                  |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| main › body   | Repeating unit: H2 → one paragraph → `preview-window`                                                                                   |
| main › body   | No bare `code-block` — code lives in the Source tab of the `preview-window`                                                             |
| right (`toc`) | Always renders — one entry per example. **Overrides** Doc Article's 2-H2 minimum: a gallery with a single example still gets the column |

## Page-only rules

- One `preview-window` per H2. Never two adjacent.
- Every window opens on the Preview tab.
- Prose between examples is one paragraph maximum. If it needs more, it is a Doc Article.

## Frame notes

`pages/Examples Gallery.dc.html` shows two examples, each H2 → one paragraph → `preview-window` opening on
the Preview tab. The canvases are **reserved boxes**: there is no NGP Table source in this project to render
inside them. **No sidebar item is active** — this archetype has no tree entry yet.
