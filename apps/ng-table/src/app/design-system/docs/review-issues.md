# Review Issues — ngp design-system (all components)
<!-- 2026-08-23 | a11y, code, styles | 15 components reviewed, preview-window skipped (no impl) -->

Not built via ds-wayfinder pipeline (no phase-state.json/spec per component) — reviewed
against WCAG 2.1 AA + ARIA APG patterns (a11y), this repo's file-organization/signal
conventions (code), and `--ngpt-*` token vocabulary (styles), instead of a per-component spec.

## A11y

- [x] A1 HIGH `search-field.ts:20` trigger button missing `aria-haspopup="dialog"`/`aria-expanded` — add `open` input, bind attrs
- [x] A2 HIGH `select-trigger.ts:26` `role="combobox"` popup is `role="menu"` (invalid pairing, needs listbox/dialog) — drop combobox role or swap popup to listbox
- [x] A3 HIGH `search-overlay.html:39` `role="option"` rows are `tabindex="0"` while using `aria-activedescendant` — remove tabindex, keep focus on input
- [x] A4 MED `search-overlay.html:39` result rows are `<a>` with no `href` — swap to `<div role="option">`
- [x] A5 MED `search-overlay.html:14` combobox input missing `aria-autocomplete="list"`
- [x] A6 MED `search-overlay.ts:158` arrow-key nav skips "Recent" list, Tab-only there — unify or document dual model
- [x] A7 LOW `search-field.html:1` ⌘K hint dropped for SR users — consider `aria-keyshortcuts="Meta+K"`
- [x] A8 LOW `select-trigger.html:2` chevron icon missing `aria-hidden="true"`
- [x] A9 LOW `dropdown-pill.html:2` chevron icon missing `aria-hidden="true"`
- [x] A10 LOW `dropdown-menu.html:26` selected-check icon missing `aria-hidden="true"`

## Code

- [ ] C1 HIGH `dropdown-pill.ts:38` / `select-trigger.ts:41` duplicate menu-trigger wiring (viewChild+injectMenuTriggerState+effect) — extract shared `withMenuTriggerPanel()` helper
- [ ] C2 MED `inline-link.html:3` / `search-overlay.html:83` / `copy-confirm.announcer.ts:56` three different sr-only mechanisms — converge on one pattern
- [ ] C3 MED `select-trigger.html:2` hardcodes `size="12px"` on chevron, siblings use icon-size token — use `--ngpt-sys-icon-size-*`
- [ ] C4 MED `tab-switcher.ts:29` `tabs` input has no default + extra `items` computed, unlike sibling list-taking components — default input to `[]`, drop computed
- [ ] C5 MED `search-overlay.ts:82` constructor effect mixes scroll-lock + focus-restore + query-reset lifecycles — extract focus-lock helper
- [ ] C6 LOW `dropdown-menu.ts:24` / `select-trigger.ts:35` same concept named `items` vs `options` — pick one name
- [ ] C7 LOW `search-overlay.ts:52` `index` signal never `.set()`, permanently mock constant — use constant directly or comment as seam
- [ ] C8 LOW `code-block.html:6` state class bound in template, not host — confirm intentional (wrapper component, targets inner `<pre>`)

## Styles

- [ ] S1 HIGH `dropdown-pill.css:14` vs `pill-button.css:6` different border tokens for claimed-same variant — reconcile or document
- [ ] S2 HIGH `dropdown-pill.css:16` vs `pill-button.css:8` different text-color tokens for claimed-same default variant — reconcile
- [ ] S3 HIGH `search-overlay.css:154` hardcoded `font: 400 11px Inter` duplicates `--ngpt-sys-typescale-label-small-alt` at wrong weight — use token + weight override
- [ ] S4 MED `search-overlay.css:115,141` raw `12px` font-size, `--ngpt-sys-typescale-label-small-2` (12.5px) undocumented near-match — use token or comment deviation
- [ ] S5 MED `search-field.css:38` / `search-overlay.css:161` `.kbd` padding raw `5px`, no matching space token, undocumented — snap to 4px/6px token or comment
- [ ] S6 MED `pill-button.css:41,49,64` / `search-field.css:48-60` hand-computed on-band hover oklch literals repeated across components — promote to `--ngpt-onband-fill-hover` etc. tokens
- [ ] S7 MED physical properties instead of logical, repeated pattern: `prose.css:63,80,100,108-109`, `nav-item.css:8,27`, `pagination-link.css:15-16,46-51`, `search-field.css:29`, `search-overlay.css:100,104,122` — convert to inline-start/end equivalents
- [ ] S8 LOW `select-trigger.css:12` uses `--ngpt-border-strong` vs sibling controls' `--ngpt-comp-control-border-default` — reconcile or note in decisions.md
- [ ] S9 LOW `search-overlay.css:19,31,45,196` centers via physical `left`+`translate(-50%)` — stylistically inconsistent with logical-properties mandate, functionally RTL-neutral

## Gaps (not violations — missing coverage)

- [ ] G1 `preview-window/` has only `docs/spec.md`, no implementation — scaffold or drop from DS

## Dismissed
<!-- issue-id: reason -->
- A11: WCAG 2.2 AA (2.5.8) forward-looking, not a 2.1 AA defect

## Fixed
<!-- populated as issues are resolved -->
- [x] A1-A10: a11y pass — search trigger aria-expanded/haspopup/keyshortcuts wiring, select-trigger role fix, search-overlay listbox/combobox markup fix, decorative icons hidden (2026-08-23)
