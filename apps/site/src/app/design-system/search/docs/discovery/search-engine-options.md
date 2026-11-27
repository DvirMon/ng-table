# How should the NGP Table docs site replace its mock search with real search?

**Date:** 2026-11-27 · **Depth:** standard

## Answer

The question asks which engine to pick. The real question is where the records come from.
`Search Index.md` already fixes the matcher: substring matching, no fuzzy, four
deterministic ranking tiers, cap at 5. `groupSearchResults` already implements that matcher
[R1][R2]. Every engine surveyed ranks by BM25, TF-IDF or Algolia's own rules. So each one
would have to be overridden to meet the spec, and none adds matching the spec allows
[S20][S25][S30][S35][S41].

**Recommendation:** use no search library.

- At build time, a Node script reads the content tree and the per-slug Markdown files.
- It writes the `SearchResultRecord[]` array to a static JSON file.
- The overlay loads that file and keeps using `groupSearchResults` (add diacritic folding).

**Fallback, when a linear scan stops being fast enough:** MiniSearch 7.2.0 (5.7 kB gzip).
Use it with fuzzy off, `prefix: true` and a title boost, and keep the tier sort on top
[S20][S21][S22].

**Rejected: Algolia DocSearch.**

- angularprimitives.com mounts the stock `@docsearch/js` modal [S1]. It is not headless.
- The only headless layer, `@docsearch/core`, is a React provider [S5][S6].
- Our site has no prerendered HTML, so the crawler would have to run JavaScript.
  Algolia warns that this can give inconsistent records [R4][S14].

## Method

- Versions pinned from `registry.npmjs.org/<pkg>/latest`, read 2026-11-27:
  - `@docsearch/js@5.2.0` and `@docsearch/core@5.2.0` [S4][S5]
  - `algoliasearch@5.65.0` [S7]
  - `pagefind@1.6.0` [S16]
  - `minisearch@7.2.0` [S19]
  - `@orama/orama@3.1.18` [S28]
  - `flexsearch@0.8.212` [S32]
  - `lunr@2.3.9` [S36]
  - `ng-primitives@0.132.0`, gitHead `c6a35b3`, used to pin the angularprimitives.com source [S1].
- How sources were read:
  - Type declarations: from unpkg at the pinned version.
  - Pagefind docs: from GitHub raw at tag `v1.6.0`.
  - DocSearch and Algolia docs: live pages, which carry no version marker.
  - Gzip sizes: bundlephobia's API.
- Reliability notes:
  - Bundlephobia measures the whole package entry. It does not measure a tree-shaken import.
    `@docsearch/js` comes out at 170 kB because Ask AI and Preact are bundled in [S9].
  - Two Algolia pages give different record caps:
    - the DocSearch program page says 10,000 records [S12]
    - the plan terms effective 2026-07-24 say 5,000,000 records [S13]
- The repo was read at the working tree as it stood, uncommitted changes included.

## Evidence

### Our constraints (repo)

- Each heading is one record. Only H2 and H3 are indexed, plus one page record per entry [R2].
- Matching is prefix and substring, case-insensitive and diacritic-insensitive. No fuzzy [R2].
- Ranking order within a group [R2]:
  1. a title match beats a body match
  2. a match at the start of a title beats a match inside it
  3. a page record beats a heading record
  4. then `entryOrder`
- Groups follow nav-tree order. Results are capped at 5 overall [R2].
- The spec requires the record count to be known before first render, so the live region
  can announce it [R2].
- `groupSearchResults` already does tiers 1-4, the cap and section grouping.
  It uses raw `includes`, so substring matching works [R1].
- It does not fold diacritics: it only calls `toLowerCase()` [R1].
- Content source: one Markdown file per tree entry, keyed by slug, H2/H3 only.
  "the tree is the index, the file is the body" [R3].
- No `content/` folder exists yet [R5].
- The build is browser-only: `@angular/build:application` with no `server`, `ssr` or
  `prerender` option. So the deployed HTML is an empty shell [R4].

### Algolia DocSearch (as on angularprimitives.com)

- angularprimitives.com wires it like this:
  - `await import('@docsearch/js')` inside `ngOnInit`, guarded by `isPlatformBrowser`
  - then `docsearch({ appId, apiKey, indexName: 'angularprimitives', container: '#docsearch' })` [S1]
  - That is the stock DocSearch modal. They do not call `algoliasearch` directly and do not
    use their own UI [S1].
- Their root `package.json` depends on `"@docsearch/js": "^3.6.0"`. Registry latest is 5.2.0 [S2][S4].
- Packages: `@docsearch/core` holds the shared state and keyboard handling for the
  "Composable API". `@docsearch/modal` holds the button and modal [S3].
- `@docsearch/core@5.2.0` exports a React provider (`DocSearch`, `useDocSearch()`) and has
  React as a peer dependency (marked optional). Nothing in it can be used from Angular [S5][S6].
- The own-UI path is `algoliasearch/lite`:
  `liteClient(appId, apiKey, options?)`, which exposes `searchForHits` and `searchForFacets` [S7][S8].
- Hit shape (`DocSearchHit` in `@docsearch/react@5.2.0`) [S10]:
  - `hierarchy`: `lvl0` and `lvl1` are `string`; `lvl2` to `lvl6` are `string | null`
  - `content: string | null`, `anchor: string | null`
  - `url`, `url_without_anchor`, `objectID`
  - `type`: `'askAI' | 'content' | 'lvl0'` to `'lvl6'`
- Record extraction uses `helpers.docsearch({ recordProps: { lvl0, lvl1, content, lvl2-lvl6 } })`.
  It also supports custom attributes, `pageRank`, `aggregateContent` (default true) and
  `recordVersion: 'v3'` [S11].
- Default template settings [S15]:
  - `lvl1` comes from `h1`
  - `lvl0` falls back to the value `'Documentation'`
  - `distinct: true` on `url`
  - `customRanking: ['desc(weight.pageRank)', 'desc(weight.level)', 'asc(weight.position)']`
  - typo tolerance is on: `minWordSizefor1Typo: 3`
- Algolia's `typoTolerance` defaults to `true`. Setting `false` returns "Only exact matches" [S17].
- Crawls run "at a random time once a week" [S18].
- `renderJavaScript` defaults to `false`. Enabling it "can lead to inconsistent records across crawls" [S14].
- Eligibility [S12][S13][S23]:
  - open to "developer documentation and technical blogs"
  - "not production ready" sites are usually turned down
  - the domain must be verified within 7 days
  - manual review takes 1-2 business days
  - the program page says "open source projects"; Algolia may end the plan "at its sole discretion"
- The "Search by Algolia" logo must sit next to the results. Removing it makes the project
  ineligible [S12][S13].

### Pagefind

- `pagefind@1.6.0` was released 2026-11-01 and ships native binaries per platform as
  optional dependencies [S16][S24].
- The CLI indexes built HTML. Our build emits none, so the Node API is needed [R4][S25].
  - `addHTMLFile` takes virtual HTML.
  - `addCustomRecord` takes `{url, content, language, meta?, filters?, sort?}`. Its docs say
    nothing about sub-results [S25].
- Sub-results split a page "on headings (`h1` → `h6`) that have `id` attributes". Each one
  has `title`, `url`, `excerpt`, and `anchor` (which holds `element`, `id`, `location`) [S26][S27].
- Search returns `{results:[{id, data()}]}`. You fetch each result's data with its own async
  `data()` call [S29].
- Ranking parameters: `termFrequency`, `termSimilarity`, `pageLength`, `termSaturation`,
  `diacriticSimilarity`, `metaWeights` (title defaults to 5.0) [S30].
- Default heading weights are h1 7.0, h2 6.0, h3 5.0. `data-pagefind-weight` takes 0-10 on a
  quadratic scale [S31].
- The index is split into chunks. A 10,000-page site stays under 300 kB of total payload,
  "closer to 100kB" for most sites [S33].
- It loads through a runtime URL import: `await import("/pagefind/pagefind.js")` [S29].

### MiniSearch

- Features: "Exact match, prefix search, fuzzy match, field boosting"; terms are lowercased;
  "No stemming" [S20].
- `SearchOptions` includes `prefix`, `fuzzy`, `boost`, `boostDocument`, `combineWith`
  (default `"OR"`), `processTerm`, `filter` and `weights` [S21].
- `storeFields` returns fields with each result. `toJSON` / `loadJSON` / `loadJSONAsync`
  let you build the index ahead of time [S21].
- Size: 17.7 kB minified, 5.7 kB gzip [S22].
- The latest commit is the v7.2.0 release on 2025-09-16 [S34].

### Orama

- `@orama/orama@3.1.18`, released 2025-12-19 [S28][S38].
- Search parameters: `term`, `properties`, `exact`, `tolerance` (Levenshtein distance),
  `threshold`, `boost`, `relevance` ("BM25 parameters"), `where` [S35].
- It exports `save` / `load` for prebuilt indexes, plus vector and hybrid search [S39][S40].
- Size: 77 kB minified, 24.4 kB gzip [S37].

### FlexSearch

- Tokenizers: `strict` (the default), `forward` (prefix), `reverse`, `full`, and `tolerant`
  (typos). `suggest: true` allows partial matches [S41].
- Encoders range from `normalize` to `soundex`, which is phonetic and fuzzy [S41].
- Export and import are async. They are missing from the light build [S41].
- Gzip sizes [S41]:
  - light: 4.5 kB
  - compact: 11.4 kB
  - bundle: 16.3 kB
  - bundlephobia measures 16.8 kB for the default entry [S42]
- `0.8.212`, published 2025-09-06 [S43].

### Lunr

- Query syntax: `foo*` wildcard, `foo~1` fuzzy, `title:foo` field scope, `^10` boost [S44].
- The default pipeline is `trimmer, stopWordFilter, stemmer`. Stemming is on by default [S45].
- Field boost is set at build time. To prebuild, run `JSON.stringify(idx)` and load it with
  `lunr.Index.load` [S46][S47].
- Size: 8.4 kB gzip [S48].
- `2.3.9` was published 2020-08-19, the last release [S36].

## Comparison

Scores: 2 = meets the requirement as-is, 1 = meets it with work, 0 = conflicts.

| Requirement                        | Own JSON + `groupSearchResults` | MiniSearch@7.2.0                                       | Pagefind@1.6.0                                                             | Orama@3.1.18                         | FlexSearch@0.8.212                    | Lunr@2.3.9                                      | DocSearch@5.2.0                                                |
| ---------------------------------- | ------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------- |
| Static site, no backend            | 2: JSON asset [R4]              | 2: `loadJSON` [S21]                                    | 2: static chunks [S33]                                                     | 2: `load` [S39]                      | 2: export/import [S41]                | 2: `Index.load` [S46]                           | 0: hosted SaaS + crawler [S18]                                 |
| Own overlay UI                     | 2: already in use [R1]          | 2: returns plain results [S21]                         | 2: JS API [S29]                                                            | 2: plain hits [S35]                  | 2 [S41]                               | 2 [S44]                                         | 1: `liteClient`, logo required [S8][S12]                       |
| Heading-level records with anchors | 2: `id` = `slug#anchor` [R2]    | 2: one doc per heading [S21]                           | 1: sub-results need HTML with `id`s, not custom records [S25][S26]         | 2: one doc per heading [S35]         | 2 [S41]                               | 2 [S46]                                         | 1: needs JS-rendered crawl [S11][S14]                          |
| No fuzzy, substring, tiers 1-4     | 2: implemented [R1]             | 1: fuzzy off; prefix only, no substring; re-sort [S21] | 0: own ranking; tiers re-applied after a `data()` fetch per hit [S29][S30] | 1: `tolerance` 0; BM25 re-sort [S35] | 1: `forward` tokenizer; re-sort [S41] | 0: stemming on by default changes matches [S45] | 0: typo on by default, Algolia tie-break [S15][S17]            |
| Diacritic-insensitive              | 1: add `normalize('NFD')` [R1]  | 1: `processTerm` [S21]                                 | 2: `diacriticSimilarity` [S30]                                             | ? (unverified)                       | 2: encoders [S41]                     | ? (unverified)                                  | ? (unverified)                                                 |
| Count known before render          | 2: synchronous [R1][R2]         | 2: synchronous after load [S21]                        | 1: async per query [S29]                                                   | 2 [S35]                              | 1: async export/import [S41]          | 2 [S46]                                         | 0: network round-trip [S8]                                     |
| Minimal payload                    | 2: JSON only                    | 2: +5.7 kB [S22]                                       | 2: ~100 kB typical [S33]                                                   | 1: +24.4 kB [S37]                    | 2: +16.8 kB [S42]                     | 2: +8.4 kB [S48]                                | 0: 170 kB with the stock UI [S9]; `liteClient` size unverified |
| Low maintenance                    | 2: no dependency                | 1: last release 2025-09 [S34]                          | 1: native binary in the build [S16]                                        | 1: 2025-12 [S38]                     | 1: 0.x versions [S43]                 | 0: last release 2020 [S36]                      | 0: weekly crawl, approval, terms [S13][S18]                    |
| **Total (of 16)**                  | **15**                          | **13**                                                 | **11**                                                                     | **11** (plus 1 unverified)           | **13**                                | **10** (plus 1 unverified)                      | **2** (plus 1 unverified)                                      |

## Synthesis

- **Engines vs the spec, on ranking.** Every engine sorts by relevance score: BM25 in Orama
  [S35], Pagefind's own parameters [S30], Algolia's `customRanking` [S15]. The spec sorts by
  tiers, then `entryOrder`, and wants "the same query always gives the same order" [R2].
  Keeping an engine means re-sorting its hits, so the engine only speeds up candidate lookup.
  On a small corpus a linear scan already does that job.
- **Token prefix vs substring.** MiniSearch, FlexSearch `forward`, Lunr `*` and Algolia's prefix
  mode all match from the start of a token [S21][S41][S44]. The current code matches any
  substring (`includes`) [R1]. The spec says "prefix and substring matching on whole words",
  which can be read either way [R2]. If substring inside a word is intended, only the
  hand-written matcher (or FlexSearch `full`) gives it [S41].
- **Pagefind vs a client-only SPA.** Pagefind's strong default is indexing built HTML [S25].
  We have none [R4]. Its heading sub-results come only from HTML with heading `id`s [S26].
  So we would render Markdown to HTML at build time just to feed it. That is the same pipeline
  as the JSON script, plus a native binary.
- **DocSearch vs our UI.** angularprimitives.com accepts the stock modal [S1]. We own the
  overlay. The headless layer is React-only [S6]. Driving `liteClient` ourselves still requires
  the logo and an index we do not control [S12].
- **The general mechanism is the record producer, not the engine.** A build step from tree +
  Markdown to `SearchResultRecord[]` feeds every option above [R2][R3]. So the engine stays
  replaceable behind `groupSearchResults`, and changing it later touches one function.
- **How the result tree maps, per option.** Page record = DocSearch `type: 'lvl1'`; heading =
  `lvl2`/`lvl3` plus `anchor`; `section` = `hierarchy.lvl0` [S10][S11]. Pagefind: page result
  plus `sub_results[].anchor` [S27]. In MiniSearch, Orama, FlexSearch and Lunr, each record is
  one document, so `kind`, `section`, `breadcrumb` and `entryOrder` ride along as stored
  fields [S21]. `getTreeConnector` nests by the `slug#` prefix, so it works unchanged with every
  option [R1].

## Against

- With an engine, query time stays flat as the corpus grows, and token-based scoring is
  better tested. A hand-written matcher must keep diacritic folding and whole-word rules
  correct on its own [S20][R1].
- Pagefind's chunked loading caps payload no matter how large the corpus gets [S33]. A
  single JSON file grows linearly with the body text.
- DocSearch indexes the deployed site. A record can never drift from the rendered page, while
  the JSON script reads the Markdown source [S11][R3].

## Not researched

- Fuse.js, Stork (archived), and Meilisearch / Typesense (both need a server).
- Starlight, VitePress and Docusaurus local-search plugins as prior art.
- Measured index size for the real corpus. No content exists yet [R5].

## Unverified

- Pagefind and Orama prefix behaviour. Neither the docs nor the types state it [S27][S35].
- Diacritic handling in Orama, Lunr and Algolia.
- The gzip size of `algoliasearch/lite` alone. Bundlephobia measured the full entry at 22.3 kB [S49].
- Whether Angular's esbuild builder leaves `import('/pagefind/pagefind.js')` alone or tries to
  resolve it. A variable path would likely avoid the problem. Not tested, since no build was run.
- Whether DocSearch's weekly crawl can be triggered on deploy. The dashboard allows triggering
  crawls by hand [S18]; an automatic hook was not confirmed.
- Algolia's record cap: 10,000 [S12] or 5,000,000 [S13]. The terms page is newer.
- JSON payload estimate. About 30 pages × 7 records × ~1 kB of body is ~200 kB raw, and
  maybe 50 kB gzip. This is an inference, not a measurement.

## Sources

|     | Source                                                                                                                                                        | Version               | Verified                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------- |
| S1  | https://raw.githubusercontent.com/ng-primitives/ng-primitives/c6a35b3cae45e36146ee021a6851c0da94410858/apps/documentation/src/app/components/navbar/navbar.ts | ng-primitives 0.132.0 | yes, source read. Shows the stock modal, not their own UI                           |
| S2  | https://raw.githubusercontent.com/ng-primitives/ng-primitives/c6a35b3cae45e36146ee021a6851c0da94410858/package.json                                           | 0.132.0               | yes, read. `^3.6.0`, two majors behind                                              |
| S3  | https://docsearch.algolia.com/docs/packages/overview                                                                                                          | v5 docs               | yes, page fetch                                                                     |
| S4  | https://registry.npmjs.org/@docsearch/js/latest                                                                                                               | 5.2.0                 | yes, registry                                                                       |
| S5  | https://registry.npmjs.org/@docsearch/core/latest                                                                                                             | 5.2.0                 | yes, registry. React peer dependency                                                |
| S6  | https://unpkg.com/@docsearch/core@5.2.0/dist/esm/index.d.ts                                                                                                   | 5.2.0                 | yes, types read. Showed that "core" is a React provider, not headless               |
| S7  | https://unpkg.com/algoliasearch@5.65.0/package.json                                                                                                           | 5.65.0                | yes, `./lite` export                                                                |
| S8  | https://unpkg.com/algoliasearch@5.65.0/dist/lite/browser.d.ts                                                                                                 | 5.65.0                | yes, types read                                                                     |
| S9  | https://bundlephobia.com/api/size?package=@docsearch/js@5.2.0                                                                                                 | 5.2.0                 | yes, API                                                                            |
| S10 | https://unpkg.com/@docsearch/react@5.2.0/dist/esm/index-BijiN4hK.d.ts                                                                                         | 5.2.0                 | yes, types read                                                                     |
| S11 | https://docsearch.algolia.com/docs/record-extractor                                                                                                           | v5 docs               | yes, page fetch                                                                     |
| S12 | https://docsearch.algolia.com/docs/docsearch-program                                                                                                          | v5 docs               | yes, page fetch                                                                     |
| S13 | https://www.algolia.com/policies/docsearch-plan-specific-terms                                                                                                | effective 2026-07-24  | yes, page fetch. Its record cap contradicts S12                                     |
| S14 | https://www.algolia.com/doc/tools/crawler/apis/configuration/render-java-script                                                                               | —                     | yes, page fetch                                                                     |
| S15 | https://docsearch.algolia.com/docs/templates                                                                                                                  | v5 docs               | yes, page fetch                                                                     |
| S16 | https://registry.npmjs.org/pagefind/latest                                                                                                                    | 1.6.0                 | yes, registry                                                                       |
| S17 | https://www.algolia.com/doc/api-reference/api-parameters/typoTolerance                                                                                        | —                     | yes, page fetch                                                                     |
| S18 | https://docsearch.algolia.com/docs/crawler                                                                                                                    | v5 docs               | yes, page fetch                                                                     |
| S19 | https://registry.npmjs.org/minisearch/latest                                                                                                                  | 7.2.0                 | yes, registry                                                                       |
| S20 | https://raw.githubusercontent.com/lucaong/minisearch/v7.2.0/README.md                                                                                         | 7.2.0                 | yes, read                                                                           |
| S21 | https://unpkg.com/minisearch@7.2.0/dist/es/index.d.ts                                                                                                         | 7.2.0                 | yes, types read                                                                     |
| S22 | https://bundlephobia.com/api/size?package=minisearch@7.2.0                                                                                                    | 7.2.0                 | yes, API                                                                            |
| S23 | https://docsearch.algolia.com/docs/who-can-apply                                                                                                              | v5 docs               | yes, page fetch. Does not say open source is required, unlike S12                   |
| S24 | https://api.github.com/repos/Pagefind/pagefind/releases?per_page=2                                                                                            | v1.6.0                | yes, API                                                                            |
| S25 | https://pagefind.app/docs/node-api/                                                                                                                           | live (1.6.0)          | yes, page fetch                                                                     |
| S26 | https://pagefind.app/docs/sub-results/                                                                                                                        | live (1.6.0)          | yes, page fetch                                                                     |
| S27 | https://raw.githubusercontent.com/Pagefind/pagefind/v1.6.0/pagefind_web_js/types/index.d.ts                                                                   | 1.6.0                 | yes, types read                                                                     |
| S28 | https://registry.npmjs.org/@orama/orama/latest                                                                                                                | 3.1.18                | yes, registry                                                                       |
| S29 | https://pagefind.app/docs/api/                                                                                                                                | live (1.6.0)          | yes, page fetch                                                                     |
| S30 | https://pagefind.app/docs/ranking/                                                                                                                            | live (1.6.0)          | yes, page fetch                                                                     |
| S31 | https://raw.githubusercontent.com/Pagefind/pagefind/v1.6.0/docs/content/docs/weighting.md                                                                     | 1.6.0                 | yes, read                                                                           |
| S32 | https://registry.npmjs.org/flexsearch/latest                                                                                                                  | 0.8.212               | yes, registry                                                                       |
| S33 | https://pagefind.app/                                                                                                                                         | live                  | yes, page fetch. A marketing claim                                                  |
| S34 | https://api.github.com/repos/lucaong/minisearch/commits?per_page=2                                                                                            | —                     | yes, API                                                                            |
| S35 | https://unpkg.com/@orama/orama@3.1.18/dist/esm/types.d.ts                                                                                                     | 3.1.18                | yes, types read                                                                     |
| S36 | https://registry.npmjs.org/lunr                                                                                                                               | 2.3.9                 | yes, registry `time`                                                                |
| S37 | https://bundlephobia.com/api/size?package=@orama/orama@3.1.18                                                                                                 | 3.1.18                | yes, API                                                                            |
| S38 | https://api.github.com/repos/oramasearch/orama/releases?per_page=2                                                                                            | v3.1.18               | yes, API                                                                            |
| S39 | https://unpkg.com/@orama/orama@3.1.18/dist/esm/index.d.ts                                                                                                     | 3.1.18                | yes, export list                                                                    |
| S40 | https://unpkg.com/@orama/orama@3.1.18/README.md                                                                                                               | 3.1.18                | yes, read                                                                           |
| S41 | https://unpkg.com/flexsearch@0.8.212/README.md                                                                                                                | 0.8.212               | yes, read. Field boost is not documented there                                      |
| S42 | https://bundlephobia.com/api/size?package=flexsearch@0.8.212                                                                                                  | 0.8.212               | yes, API                                                                            |
| S43 | https://registry.npmjs.org/flexsearch                                                                                                                         | 0.8.212               | yes, registry `time`                                                                |
| S44 | https://lunrjs.com/guides/searching.html                                                                                                                      | 2.x                   | yes, page fetch                                                                     |
| S45 | https://unpkg.com/lunr@2.3.9/lunr.js                                                                                                                          | 2.3.9                 | yes, source read. The guide page did not state the default pipeline; the source did |
| S46 | https://lunrjs.com/guides/index_prebuilding.html                                                                                                              | 2.x                   | yes, page fetch                                                                     |
| S47 | https://lunrjs.com/docs/lunr.Builder.html                                                                                                                     | 2.3.9                 | yes, page fetch                                                                     |
| S48 | https://bundlephobia.com/api/size?package=lunr@2.3.9                                                                                                          | 2.3.9                 | yes, API                                                                            |
| S49 | https://bundlephobia.com/api/size?package=algoliasearch@5.65.0                                                                                                | 5.65.0                | yes, API (full entry, not `/lite`)                                                  |
| R1  | apps/site/src/app/design-system/search/search-overlay.utils.ts:45-146                                                                                         | —                     | yes, read                                                                           |
| R2  | apps/site/docs/design-handoff/specs/Search Index.md:36-114                                                                                                    | —                     | yes, read                                                                           |
| R3  | apps/site/docs/design-handoff/specs/Assets and Content Source.md:85-100                                                                                       | —                     | yes, read                                                                           |
| R4  | apps/site/project.json:9-48                                                                                                                                   | —                     | yes, read. No server or prerender option                                            |
| R5  | apps/site/**/content/** (glob)                                                                                                                                | —                     | yes, no matches                                                                     |
