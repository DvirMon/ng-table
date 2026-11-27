# Does DocSearch have a "search hits footer", and does dropping ours for padding lose anything?

**Date:** 2026-11-27 · **Depth:** standard

## Answer

DocSearch does have a `section.DocSearch-HitsFooter`, but it is not a spacer. It is an
optional content slot, rendered only when `resultsFooterComponent` is passed. Docusaurus
uses it for a "See all N results" link. It is not sticky and has no background. [S2][S3][S5]

The gap between the last hit and the modal footer comes from somewhere else:
`.DocSearch-Hits:last-of-type{margin-block-end:24px}`. That margin sits at the end of the
content, so you only see it when you scroll to the bottom. [S1]

So DocSearch has no always-visible band above the footer. Rows scroll right up to the
footer's 1px top border. [S1][S4]

Replacing our sticky `.search-hits-footer` with `padding-block-end` on `.search-results`
loses one thing only: the 24px band that stays visible while rows scroll. DocSearch does
not have that band, so you lose nothing compared with the reference. [S1][R1]

## Method

- Pinned versions:
  - `@docsearch/css@5.2.0` and `@docsearch/react@5.2.0` (gitHead `db33379`), both from
    `registry.npmjs.org/<pkg>/latest`, which is also the docs site's "Stable (v5.x)".
  - `@docusaurus/theme-search-algolia@3.10.2` (gitHead `f37f903`), from the registry.
  - `@docsearch/css@3.9.0`, read only to check the history.
- How sources were read:
  - CSS: the published `dist/modal.scss` from unpkg. It is minified, so the rules below
    were grepped out of the saved copy and are exact.
  - Markup: the published `dist/esm/normalizeDocSearchIndexes-BW-QYGAy.js` bundle (it
    holds `ModalShell` and `ResultsScreen`). Cross-checked against the GitHub source at
    gitHead for `ResultsScreen.tsx`.
  - Docusaurus: GitHub source at the gitHead.
- Reliability: `--docsearch-spacing` and `--docsearch-footer-height` change by viewport.
  The defaults are `1rem` / `52px`, and below 768px they become `10px` / `48px`. [S1][S6]

## Evidence

Markup (published bundle) [S2]:

```js
React.createElement("div", { className: "DocSearch-Dropdown", ref: dropdownRef }, screenState),
React.createElement("footer", { className: "DocSearch-Footer" }, footer)
// ResultsScreen:
React.createElement("div", { className: "DocSearch-Dropdown-Container" },
  props.state.collections.map(...),             // each -> section.DocSearch-Hits
  props.resultsFooterComponent && React.createElement("section", { className: "DocSearch-HitsFooter" },
    React.createElement(props.resultsFooterComponent, { state: props.state })))
```

- `.DocSearch-Dropdown` is the scroll area. `footer.DocSearch-Footer` is its sibling,
  outside the scroll area. This is the same shape as our `.search-results` and
  `.search-footer`. [S2]
- The hits footer is the last child of `.DocSearch-Dropdown-Container`, inside the scroll
  area, after every `section.DocSearch-Hits`. [S2][S3]
- It renders only when `resultsFooterComponent` is set. The docs say: "Renders below
  result collections… By default, DocSearch doesn't render a footer." [S2][S5]
- Its job is content. Docusaurus renders `<Link to={createSearchLink(state.query)}>`
  "See all {count} results" (`state.context.nbHits`), and only when `searchPagePath` is
  set. [S4]

CSS (`@docsearch/css@5.2.0`, verbatim) [S1]:

```css
.DocSearch-Dropdown{height:var(--docsearch-modal-variable-height);max-height:calc(var(--docsearch-modal-height) - var(--docsearch-spacing) - var(--docsearch-footer-height));min-height:var(--docsearch-spacing);padding:0 var(--docsearch-spacing);scrollbar-color:var(--docsearch-muted-color) var(--docsearch-modal-background);scrollbar-width:thin;scrollbar-gutter:stable;overflow-y:auto}
.DocSearch-Hits:last-of-type{margin-block-end:24px}
.DocSearch-HitsFooter{color:var(--docsearch-muted-color);padding:var(--docsearch-spacing);justify-content:center;margin-block-end:var(--docsearch-spacing);font-size:.85em;display:flex}
.DocSearch-HitsFooter a{color:inherit;border-block-end:1px solid}
.DocSearch-Hit{border-radius:4px;padding-block-end:4px;scroll-margin-block-start:40px;display:flex;position:relative}
.DocSearch-Hit-source{...;z-index:10;...;padding:8px 4px 4px;...;position:sticky;inset-block-start:0}
.DocSearch-Footer{background:var(--docsearch-footer-background);border-block-start:1px solid var(--docsearch-subtle-color);border-radius:0 0 var(--docsearch-modal-radius) var(--docsearch-modal-radius);height:var(--docsearch-footer-height);padding:0 var(--docsearch-spacing);-webkit-user-select:none;user-select:none;z-index:300;flex-shrink:0;justify-content:space-between;align-items:center;width:100%;display:flex;position:relative}
```

- The scroll area has no block padding (`padding:0 var(--docsearch-spacing)` is inline
  only). The end gap is a margin on the last child. [S1]
- The hits footer adds no gap of its own. Its `padding` and `margin-block-end` are both
  `--docsearch-spacing` (`1rem`), so it brings its own spacing. [S1][S6]
- The only sticky element in the results is the group header (`.DocSearch-Hit-source`,
  sticky to the top). `scroll-margin-block-start:40px` on each hit keeps a scrolled-to hit
  from landing under that header. Nothing is sticky at the bottom, and no hit has a
  `scroll-margin-block-end`. [S1]
- The separator is the footer's `border-block-start` plus its `z-index:300`. There is no
  gradient, mask or fade selector in `modal.css`. [S1]
- v3.9.0 has the same structure: `.DocSearch-Hits:last-of-type{margin-bottom:24px}` and
  the same `.DocSearch-HitsFooter` rule. This shape has not changed since v3. [S7]
- Ours: an empty sticky `section.search-hits-footer` with `aria-hidden="true"`, height
  `--ngpt-sys-space-600`, a negative inline margin, and the panel background. It is placed
  after the groups in both branches (results and recent searches). [R1][R2]

## Comparison

| Responsibility                             | DocSearch 5.2.0                                            | Our `.search-hits-footer`               | `padding-block-end` on `.search-results` |
| ------------------------------------------ | ---------------------------------------------------------- | --------------------------------------- | ---------------------------------------- |
| Gap after the last hit, seen at scroll end | `margin-block-end:24px` on the last `.DocSearch-Hits` [S1] | yes, 24px [R1]                          | yes                                      |
| Gap always visible while scrolling         | no, nothing sticky at the bottom [S1]                      | yes, sticky with a background [R1]      | no                                       |
| Content slot ("See all N results")         | `.DocSearch-HitsFooter`, opt-in [S2][S4]                   | no, it is empty [R2]                    | no                                       |
| Accessibility                              | no role or ARIA on the section [S2]                        | `aria-hidden`, nothing to announce [R2] | none needed                              |
| Separation from the modal footer           | footer `border-block-start` + `z-index:300` [S1]           | panel background band [R1]              | whatever `.search-footer` provides       |

## Synthesis

- Our class name borrows DocSearch's name, but the job is different. DocSearch's hits
  footer holds content. Ours is an always-visible spacer, and DocSearch has no equivalent
  of that. [S1][S2]
- DocSearch puts the end gap on the last child, not on the scroll container. Adding
  `padding-block-end` to `.search-results` gives the same visual result.
- If you ever add a "See all results" row, follow DocSearch: put a `section` after the
  groups, inside the scroll area, not sticky, with its own padding.

## Against

- Keep the sticky band only if you want rows to never touch the footer's top edge while
  scrolling. That is a design choice; DocSearch does not do it. [S1][R1]
- The sticky band covers the last 24px of the visible scroll area. Keyboard navigation
  that scrolls a row into view at the bottom can leave the row partly under the band,
  unless `scroll-padding-block-end` is set (none is set in `search-overlay.css`). Removing
  the band removes that risk. This is an inference; it was not tested. [R1]
- Watch the `:last-of-type` trap if you copy DocSearch's margin approach. It is a CSS
  inference, not tested:
  - `.DocSearch-Hits:last-of-type` matches the last `section` among its siblings, not the
    last `.DocSearch-Hits`.
  - When `.DocSearch-HitsFooter` (also a `section`) is present, the 24px margin matches
    nothing, and the hits footer's own spacing takes over.
  - Our `.search-hits` and `.search-hits-footer` are both `section`, so the same trap
    applies. [S1][S2][R2]

## Not researched

- ng-primitives: it has no search or command-palette overlay that clearly relates, so it
  was skipped.
- Other palettes (cmdk, kbar, Raycast-style UIs), the `@docsearch/js` wrapper (it renders
  the same React tree), and the sidepanel/Ask AI CSS (`sidepanel.css`, `_askai.css`).

## Unverified

- Whether `padding-block-end` on a flex-column `overflow-y:auto` container is kept at the
  end of the scroll in every browser this site targets. Modern engines include it in the
  scrollable area, but this was not checked here (no MDN or webstatus lookup). To confirm,
  check MDN/webstatus, or put a margin on the last `.search-hits` the way DocSearch does.
- Where our overlay calls `scrollIntoView` and with which `block` option. A grep found
  only comments, so the occlusion point under **Against** is unconfirmed.

## Sources

|     | Source                                                                                                                                                                | Version        | Verified                                                                                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | https://unpkg.com/@docsearch/css@5.2.0/dist/modal.scss                                                                                                                | 5.2.0          | yes. Published minified CSS, rules grepped verbatim. Found that the gap is a margin on the last child, not padding or a sticky element. |
| S2  | https://unpkg.com/@docsearch/react@5.2.0/dist/esm/normalizeDocSearchIndexes-BW-QYGAy.js                                                                               | 5.2.0          | yes. Published bundle: `ModalShell` nesting, and the hits footer as a child of `Dropdown-Container`.                                    |
| S3  | https://raw.githubusercontent.com/algolia/docsearch/db3337978a2c9be6ec9187e73105a94dc0b1bbf3/packages/docsearch-react/src/ResultsScreen.tsx                           | 5.2.0 gitHead  | yes. Source matches the bundle.                                                                                                         |
| S4  | https://raw.githubusercontent.com/facebook/docusaurus/f37f9035584917a97a260b91fc2842cba4f8b94f/packages/docusaurus-theme-search-algolia/src/theme/SearchBar/index.tsx | 3.10.2 gitHead | yes. Source: the "See all {count} results" link, gated on `searchPagePath`.                                                             |
| S5  | https://docsearch.algolia.com/docs/packages/react/api-reference                                                                                                       | Stable (v5.x)  | yes. Docs: the `resultsFooterComponent` description and type.                                                                           |
| S6  | https://unpkg.com/@docsearch/css@5.2.0/dist/_variables.css                                                                                                            | 5.2.0          | yes. `--docsearch-spacing:1rem`, `--docsearch-footer-height:52px`, `--docsearch-modal-height:600px`.                                    |
| S7  | https://unpkg.com/@docsearch/css@3.9.0/dist/style.css                                                                                                                 | 3.9.0          | yes. Same last-of-type margin and the same hits-footer rule.                                                                            |
| R1  | apps/site/src/app/design-system/search/search-overlay.css:108                                                                                                         | —              | yes. Read `.search-results` and `.search-hits-footer` (lines 126-135).                                                                  |
| R2  | apps/site/src/app/design-system/search/search-overlay.html:68                                                                                                         | —              | yes. Read. A second instance is at line 108.                                                                                            |
