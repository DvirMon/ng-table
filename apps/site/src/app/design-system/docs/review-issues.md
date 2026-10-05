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

- [x] C1 HIGH `dropdown-pill.ts:38` / `select-trigger.ts:41` duplicate menu-trigger wiring (viewChild+injectMenuTriggerState+effect) — extract shared `withMenuTriggerPanel()` helper
- [x] C2 MED `inline-link.html:3` / `search-overlay.html:83` / `copy-confirm.announcer.ts:56` three different sr-only mechanisms — converge on one pattern
- [x] C3 MED `select-trigger.html:2` hardcodes `size="12px"` on chevron, siblings use icon-size token — use `--ngpt-sys-icon-size-*`
- [x] C4 MED `tab-switcher.ts:29` `tabs` input has no default + extra `items` computed, unlike sibling list-taking components — default input to `[]`, drop computed
- [x] C5 MED `search-overlay.ts:82` constructor effect mixes scroll-lock + focus-restore + query-reset lifecycles — extract focus-lock helper
- [x] C6 LOW `dropdown-menu.ts:24` / `select-trigger.ts:35` same concept named `items` vs `options` — pick one name
- [x] C7 LOW `search-overlay.ts:52` `index` signal never `.set()`, permanently mock constant — use constant directly or comment as seam

## Styles

- [x] S1 HIGH `dropdown-pill.css:14` vs `pill-button.css:6` different border tokens for claimed-same variant — reconcile or document
- [x] S2 HIGH `dropdown-pill.css:16` vs `pill-button.css:8` different text-color tokens for claimed-same default variant — reconcile
- [x] S3 HIGH `search-overlay.css:154` hardcoded `font: 400 11px Inter` duplicates `--ngpt-sys-typescale-label-small-alt` at wrong weight — use token + weight override
- [x] S4 MED `search-overlay.css:115,141` raw `12px` font-size, `--ngpt-sys-typescale-label-small-2` (12.5px) undocumented near-match — use token or comment deviation
- [x] S5 MED `search-field.css:38` / `search-overlay.css:161` `.kbd` padding raw `5px`, no matching space token, undocumented — snap to 4px/6px token or comment
- [x] S6 MED `pill-button.css:41,49,64` / `search-field.css:48-60` hand-computed on-band hover oklch literals repeated across components — promote to `--ngpt-onband-fill-hover` etc. tokens
- [x] S7 MED physical properties instead of logical, repeated pattern: `prose.css:63,80,100,108-109`, `nav-item.css:8,27`, `pagination-link.css:15-16,46-51`, `search-field.css:29`, `search-overlay.css:100,104,122` — convert to inline-start/end equivalents
- [x] S8 LOW `select-trigger.css:12` uses `--ngpt-border-strong` vs sibling controls' `--ngpt-comp-control-border-default` — reconcile or note in decisions.md

## Gaps (not violations — missing coverage)

- [x] G1 `preview-window/` has only `docs/spec.md`, no implementation — scaffold or drop from DS

## Dismissed

<!-- issue-id: reason -->

- A11: WCAG 2.2 AA (2.5.8) forward-looking, not a 2.1 AA defect
- C8: `code-block.html:6` state class confirmed intentional — wrapper component targeting inner `<pre>`, not `:host`
- S9: `search-overlay.css` centering via physical `left`+`translate(-50%)` is functionally RTL-neutral at exact 50% — low priority, skipped

## Fixed

<!-- populated as issues are resolved -->

- [x] A1-A10: a11y pass — search trigger aria-expanded/haspopup/keyshortcuts wiring, select-trigger role fix, search-overlay listbox/combobox markup fix, decorative icons hidden (2026-08-23)
- [x] C1-C7: code pass — extracted `withMenuTriggerPanel()` (dropdown-menu/with-menu-trigger-panel.ts), converged sr-only mechanism on `.visually-hidden`, select-trigger chevron token, tab-switcher default input, extracted search-overlay focus-lock helper, renamed select-trigger `options`→`items`, dropped dead `index` signal (2026-08-23)
- [x] G1: `preview-window` built to `docs/CONVENTIONS.md`'s fixed contract (2026-08-23) — two
      deltas it could not close from inside its own domain are recorded in its `docs/decisions.md`
      and belong to whoever next edits `code-block`: the duplicate copy button, and the Source
      panel's 12px-vs-10px radius
- [x] S1-S8: styles pass — reconciled dropdown-pill/pill-button tokens, tokenized search-overlay font/spacing hardcodes, added onband hover/text tokens (color.css) and applied to pill-button, converted physical→logical properties across prose/nav-item/pagination-link/search-field/search-overlay, select-trigger border token reconciled (2026-08-23)
