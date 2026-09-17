---
kind: page
archetype: Not Found
frame: pages/Not Found.dc.html
composes_only: true
rule: >
  This file assigns components to slots and sets page-only decisions.
  It never restates styling. If a value is missing here, it lives in the component spec.
---

# Page — Not Found

404. Keeps the chrome so the user can navigate out.

## Slots

| Order | Slot | Component | Page-only decision |
| --- | --- | --- | --- |
| 1 | shell | `page-shell` | — |
| 2 | header | `navbar` | Search slot present and is the primary recovery path |
| 3 | left | `sidebar` | Rendered, no item active |
| 4 | main | `content-column` | Centered block, not top-aligned |
| 4.1 | main › eyebrow | `category-badge` | Text: "404" |
| 4.2 | main › title | `prose` H1 | "Page not found" |
| 4.3 | main › body | `prose` paragraph + `pill-button` | One paragraph, one button back to the docs root |
| 5 | right | — | No TOC |
| 6 | below grid | `page-footer` | — |

## Page-only rules

- No `pagination` — there is no previous or next.
- Do not illustrate. Text and one button.
- Response must be a real HTTP 404.

## Frame notes

`pages/Not Found.dc.html` keeps the navbar, the sidebar (no active item) and the footer, drops the TOC and
the pagination, and centres the block. The copy in it is the specified copy, not a placeholder.
