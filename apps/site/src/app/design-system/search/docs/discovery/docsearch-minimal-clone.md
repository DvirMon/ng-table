# How does Algolia DocSearch work end to end, and what is the smallest faithful local version of it for the NGP Table docs site?

**Date:** 2026-11-27 · **Depth:** standard

Builds on `search-engine-options.md` (same folder), which already rejected hosted
DocSearch and chose a build-time JSON plus `groupSearchResults` [R9]. This file does not
compare engines again. It copies DocSearch's _model_ into that pipeline.

## Answer

Two parts of the question's framing are wrong:

- DocSearch does **not** apply `distinct` on `url_without_anchor`. Both the legacy
  scraper and the v5 template apply it on `url`, and `url` carries the anchor. So the
  index keeps one record per heading section, not one per page [S4][S9][S2].
- The "page row, then its sub-headings" display is built in the **browser**, not by an
  index setting. The modal groups hits by `hierarchy.lvl0`, keeps at most 5 per group,
  regroups each group by `hierarchy.lvl1`, and marks every non-`lvl1` hit as a child of the
  `lvl1` hit in the same group [S15][S16][S18].

**The smallest faithful copy** is our current pipeline, with three additions:

1. A build script walks the nav tree in order, reads each slug's Markdown, and emits one
   page record plus one record per H2/H3. Each heading record carries the prose under it.
   That folds DocSearch's `aggregateContent` and `distinct: url` into the record itself,
   so no query-time distinct is needed [S11][S4][R6].
2. The query keeps `groupSearchResults`, adding diacritic folding [R2][S30].
3. Nesting a page's headings under that page (`nestHeadingsUnderPages`) and drawing the
   tree lines (`getTreeConnector`) already reproduce the modal's regroup-by-`lvl1` step
   and its tree icons [R4][R5][S15][S18].

**Kept from the spec where DocSearch differs:** no typo tolerance, start-of-title ranked
above inside-title, groups in tree order, cap of 5 overall [R6][S9][S26][S16].

## Method

- Versions pinned:
  - `@docsearch/react@5.2.0`, from `registry.npmjs.org`. Its gitHead is
    `db33379` [S14]. The source was read at that commit, which is exactly what was
    published. The repo's `tags` list stops at `v4.7.1`, so no v5 tag exists to read
    against.
  - `docsearch-scraper` at tag `v1.15.0`. That is the newest tag, and the repo was last
    pushed 2024-04-24 [S8]. It is the legacy, self-hosted scraper.
  - The v5 Algolia Crawler (`helpers.docsearch`) is closed source. Its behaviour comes
    only from docs pages and templates [S9][S10][S11].
- How sources were read:
  - Python and TSX source: `raw.githubusercontent.com` at the pins above.
  - Algolia API-parameter pages and DocSearch docs: live pages, read 2026-11-27. They
    carry no version marker.
  - Repo files: working tree, uncommitted changes included.
- Reliability:
  - The record-building algorithm (anchor lookup, hierarchy reset, `weight.level`
    formula, `objectID` hash) is confirmed only for the legacy scraper. The v5 crawler
    produces the same hit shape [S22], but its internals cannot be read.
  - WebFetch would not return the `searchable_attributes` builder or
    `get_hierarchy_radio` verbatim. Both are described from a paraphrase of the
    source [S4][S6].

## Evidence

### 1. Record model

- A hit carries the following fields [S22]:
  - `objectID`, `content: string | null`, `url`, `url_without_anchor`
  - `anchor: string | null`
  - `type`: `'lvl0'`…`'lvl6' | 'content' | 'askAI'`
  - `hierarchy`: `lvl0` and `lvl1` are `string`; `lvl2`-`lvl6` are `string | null`
- `weight` is not part of the client hit type. It exists only in the index, where
  `customRanking` reads it [S22][S4].
- The scraper builds one combined XPath over every level selector plus `text`, and walks
  the matched nodes in document order. Each heading node and each content node becomes one
  record [S2].
- Hierarchy path: copy the previous record's hierarchy, set the current level, then set
  every deeper level to `None`. A record therefore carries all of its ancestors [S2].
- A heading record has `content = None`. A content record takes its text and inherits the
  hierarchy as it stands. Empty content and empty headings are skipped [S2].
- `type` = the level of the matched node (`lvlN` or `content`) [S2].
- `weight.level` = `100 - N*10` for `lvlN`, and `0` for `content` (lvl0 100, lvl1 90,
  lvl2 80, lvl3 70) [S3].
- `weight.position` = the node's index in document order [S2].
- `weight.page_rank` = the value from the first matching `start_urls` pattern, default
  `0` [S7].
- `url_without_anchor` = the page URL. `url` = page URL + `#` + anchor, when an anchor
  exists [S2].
- `objectID` = the SHA-1 of `{non-null hierarchy levels, url, position}` [S2].
- `hierarchy_radio` keeps only the record's own deepest heading level and sets every other
  level to null. A content record gets all-null [S6].
- v5 `helpers.docsearch` has `aggregateContent: true` by default. It merges sibling
  content (`<p>Foo</p><p>Bar</p>`) into one record [S11].
- v5 `helpers.docsearch` has `indexHeadings: true` by default. It creates records for
  headings, and accepts `false` or `{from, to}` [S11][S10].
- v5 `recordVersion: 'v3'` drops fields that only the v2 UI used [S10].

### 2. Crawler / scraper config

- Legacy `selectors` support `lvl0`-`lvl5` plus `text`, and `text` is mandatory [S1].
- A legacy selector can be `global` (matches the whole page) or have a `default_value`
  used when it matches nothing [S1].
- Legacy `selectors_exclude` deletes matching elements before extraction [S1].
- Legacy `stop_urls` skips URLs. `min_indexed_level` skips records with too few levels.
  `only_content_level` emits content records only [S1][S2].
- v5 `recordProps` requires `lvl0`, `lvl1` and `content`; `lvl2`-`lvl6` are optional.
  `pageRank` and custom attributes are optional [S11].
- In v5, a selector array is a fallback chain: the first selector that matches wins.
  `defaultValue` works only on `lvl0` and custom attributes [S10].
- v5 exclusion is done by hand: call `$(…).remove()` inside `recordExtractor` [S10].
- Default v5 template [S9]:
  - `lvl0` = `''` with `defaultValue: 'Documentation'`, so every hit lands in one group
  - `lvl1` = the page `h1`
  - `content` = `p` / `li`
- Docusaurus template [S9]:
  - `lvl0` = the active navbar item plus the breadcrumb text, joined with `/`. So `lvl0`
    is the site _section_.
  - `content` adds `article td:last-child`
- Anchor lookup, in order [S5]:
  1. the element's own `name`, then its `id`
  2. the last descendant carrying `[name],[id]`
  3. its previous siblings, nearest first
  4. its parent, then repeat steps 3-4 one level up
  - An anchor is rejected if it is empty or starts with `__`.
- A content record uses the anchor of its deepest heading ancestor that has one, scanning
  `lvl6` down to `lvl0` [S2].
- Markup rules [S12]:
  - every `lvlX` element needs a unique `id`/`name`
  - levels must be in increasing document order
  - matching elements must not be nested, which creates duplicate records
- The crawler writes index settings only when it creates the index. After that the
  dashboard is the source of truth. Crawls run weekly [S13].

### 3. Index settings

- Legacy `searchableAttributes` order [S4]:
  1. `hierarchy_radio` (and its camelCase twin) for every level
  2. then `hierarchy` for every level
  3. then `content`
  - Effect: a match on the record's own heading outranks a match on an ancestor heading.
- v5 default `searchableAttributes` [S9]:
  `unordered(hierarchy.lvl0)` … `unordered(hierarchy.lvl6)`, then `content`. There is no
  `hierarchy_radio`.
- `unordered()` "Ignores the position of a match within the attribute" [S26].
- `ranking` (legacy and v5 are identical) [S4][S9]:
  `words, filters, typo, attribute, proximity, exact, custom`. The source comment explains
  why `words` was moved ahead of `typo` [S4].
- `customRanking` [S4][S9]:
  - legacy: `desc(weight.page_rank)`, `desc(weight.level)`, `asc(weight.position)`
  - v5: `desc(weight.pageRank)`, `desc(weight.level)`, `asc(weight.position)`
- `distinct: true`, `attributeForDistinct: 'url'`. `distinct` "Returns only the most
  relevant record from each group" [S4][S9][S25].
- `attributesForFaceting` [S4][S9]:
  - legacy: `tags`, `no_variables`, `extra_attributes`
  - v5: `type`, `lang`
- Index-level `attributesToHighlight`: `hierarchy`, `content`. Index-level
  `attributesToSnippet`: `content:10` [S9].
- Typo settings [S4][S9][S28]:
  - `minWordSizefor1Typo: 3`. The Algolia default is 4.
  - `minWordSizefor2Typos: 7`, `allowTyposOnNumericTokens: false`
  - `ignorePlurals: true`, `removeWordsIfNoResults: 'allOptional'`
- `queryType` is left at the Algolia default, `prefixLast`: "Only the last word in the
  query is treated as a prefix" [S24].

### 4. Query-time behaviour (stock modal, `@docsearch/react@5.2.0`)

- Request defaults [S15]:
  - `hitsPerPage: 20`
  - `highlightPreTag: '<mark>'`, `highlightPostTag: '</mark>'`, `snippetEllipsisText: '…'`
  - `attributesToSnippet`: `hierarchy.lvl1`-`lvl6` and `content`, each at
    `SNIPPET_LENGTH`, which is 15 words [S20]
- The query does not set `distinct`. The index setting applies [S15].
- The first group-by key is `removeHighlightTags(hit)`. That returns `hierarchy.lvl0`,
  stripped of `<mark>`, taken from the parent's highlight result when the hit has a
  parent [S15][S17].
- `groupBy` keeps groups in insertion order, which follows the order of each group's
  best-ranked hit, and caps each group at `maxResultsPerGroup || 5`. Its code comment:
  "This acts as a frontend alternative to `distinct`" [S16].
- Inside each group, the modal groups again by `hierarchy.lvl1` and flattens with
  `.flat()` [S15].
- Any non-`lvl1` hit whose group contains a `lvl1` hit with the same `hierarchy.lvl1`
  gets `__docsearch_parent` = that hit [S15].
- The parent is **not** moved to the front of its group. It comes first only because
  `weight.level` ranked it first [S15].
- Each group's title = `removeHighlightTags(collection.items[0])` [S18].
- A row with a parent gets a tree icon [S18]:
  - path `M8 6v21…` (closing) when the next item's parent differs
  - path `M8 6v42…` (continuing) otherwise
- Icons by `type`: `lvl1` gets a page icon, `content` a paragraph icon, anything else a
  `#` icon [S21].
- Row title [S19]:
  - for `lvl1`+ hits: the snippet of `hierarchy[type]`
  - for `content` hits: the snippet of `content`
  - the second line shows the breadcrumbs
- Algolia ranking tie-breaks criterion by criterion. Each criterion applies only when all
  earlier ones tie [S23].
- `attribute` prefers a match in an attribute listed earlier, and a match closer to the
  start of that attribute. `unordered()` turns off the second part [S23][S26].
- `exact` treats a one-word query as exact only when it matches a single-word attribute
  [S23].

### Repo constraints

- `SearchResultRecord` = `{id, kind: 'page'|'heading', title, section, breadcrumb, body,
entryOrder}` [R1].
- The spec [R6]:
  - H2/H3 only, plus one page record per entry
  - inline code indexed; code blocks, demo markup, nav labels and Home are not
  - substring/prefix matching, case- and diacritic-insensitive, no fuzzy
  - tiers: title > body; title start > title inside; page > heading; `entryOrder`
  - groups in tree order; cap of 5 overall
- Current matcher [R2][R3]:
  - matches `title.startsWith` (tier 0), then `title.includes` (tier 1), then
    `body.includes` (tier 2)
  - folds case only (`toLowerCase`), not diacritics
  - slices to 5, then groups by `section` in `entryOrder`
- `nestHeadingsUnderPages` puts the page record first inside its family, and families keep
  the order of their best-ranked member [R4].
- `getTreeConnector` returns `none` / `continue` / `close` by comparing the next row's
  page id [R5].
- Content [R7]:
  - path is `content/<slug>.md`
  - "the tree is the index, the file is the body"
  - a tree entry with no file is a build error
  - the H1 comes from `entry.label`, so content files hold H2/H3 only
- The nav tree has a root entry (`Overview`) plus 4 sections. Section labels carry number
  prefixes (`'1. State Layer'`), and one entry is `hidden: true` [R8].
- No spec states how heading anchors are turned into slugs [R10].
- `Array.prototype.sort` is stable since ES2019. So records in emit order act as
  `weight.position` [S29].
- `normalize('NFD')` splits an accented letter into the base letter plus combining marks
  [S30].

## Comparison

DocSearch field to local record. Every DocSearch cell is sourced; local cells cite the repo.

| DocSearch                         | What it is                                          | Local `SearchResultRecord`                           | Decision                                                         |
| --------------------------------- | --------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------- |
| `objectID`                        | SHA-1 of hierarchy + url + position [S2]            | `id` = `slug#anchor` or `slug` [R1][R6]              | Keep ours: it is deterministic and is also the navigation target |
| `url`                             | page URL + `#anchor` [S2]                           | `id` [R6]                                            | Same thing                                                       |
| `url_without_anchor`              | page URL [S2]                                       | `getPageId(record)` = `id` before `#` [R4]           | Derived, not stored                                              |
| `anchor`                          | from `id`/`name` lookup [S5]                        | part of `id` after `#`                               | Build script uses the same slug function as the renderer         |
| `type: 'lvl1'`                    | page title record [S9][S21]                         | `kind: 'page'` [R1]                                  | Same                                                             |
| `type: 'lvl2'`/`'lvl3'`           | heading record [S2]                                 | `kind: 'heading'` [R1]                               | Same; H4+ dropped by spec [R6]                                   |
| `type: 'content'`                 | one record per paragraph run [S2][S11]              | none; prose goes to `body` of the heading above [R6] | Dropped: `aggregateContent` + `distinct: url` done at build time |
| `hierarchy.lvl0`                  | site section; Docusaurus = navbar + breadcrumb [S9] | `section` [R1]                                       | Same; root entry uses its own label [R6]                         |
| `hierarchy.lvl1`                  | page `h1` [S9]                                      | `entry.label` [R7]                                   | Same                                                             |
| `hierarchy.lvl2/lvl3`             | H2/H3 text [S9]                                     | `title` of a heading record [R1]                     | Same                                                             |
| `hierarchy_radio` (deepest level) | own heading only [S6]                               | `title` [R1]                                         | Same idea; only `title` is matched, never ancestors              |
| breadcrumbs (`hierarchy` joined)  | modal subtitle [S19]                                | `breadcrumb` = `section › entry › heading` [R6]      | Spec omits the parent H2 on an H3; see Unverified                |
| `content`                         | paragraph text [S2]                                 | `body`, matched only, never shown [R6]               | Same, minus snippet display                                      |
| `weight.level`                    | 90 lvl1 / 80 lvl2 / 70 lvl3 / 0 content [S3]        | `kind` tier (page above heading) [R2]                | Same intent                                                      |
| `weight.position`                 | document order [S2]                                 | emit order + stable sort [S29]                       | Implicit; no field                                               |
| `weight.pageRank`                 | per-URL boost, default 0 [S7]                       | `entryOrder` [R1]                                    | Spec uses tree order instead of a hand-set boost                 |

Behaviour, DocSearch vs spec:

| Axis                      | DocSearch                                                            | Spec / current code                     | Kept                  |
| ------------------------- | -------------------------------------------------------------------- | --------------------------------------- | --------------------- |
| Typo tolerance            | on; 1 typo from 3 chars [S4][S9]                                     | none [R6]                               | **Spec**              |
| Prefix                    | last word only (`prefixLast`) [S24]                                  | substring of the whole query [R2]       | **Spec**              |
| Multi-word                | words matched separately; `removeWordsIfNoResults: allOptional` [S4] | the query as one string [R2]            | **Spec**; see Against |
| Match in ancestor heading | matches (`hierarchy.*` searchable) [S9]                              | not matched; title + body only [R2]     | **Spec**              |
| Position inside title     | ignored (`unordered`) [S9][S26]                                      | start-of-title beats inside [R6]        | **Spec**              |
| Title vs body             | `attribute`: hierarchy before `content` [S9][S23]                    | tier 1 [R6]                             | Same                  |
| Page vs heading           | `desc(weight.level)` [S9]                                            | tier 3 [R6]                             | Same                  |
| Tie-break                 | `asc(weight.position)` [S9]                                          | `entryOrder`, then emit order [R6][S29] | Same                  |
| Distinct                  | per `url` (per anchor) [S9][S25]                                     | built in: one record per heading [R6]   | Same effect           |
| Group key                 | `hierarchy.lvl0` [S17]                                               | `section` [R3]                          | Same                  |
| Group order               | best hit first (insertion) [S16]                                     | tree order [R6]                         | **Spec**              |
| Cap                       | 5 per group, 20 hits [S16][S15]                                      | 5 overall [R6]                          | **Spec**              |
| Nest under page           | regroup by `lvl1`, parent not moved [S15]                            | page moved first in family [R4]         | Ours; stricter        |
| Tree lines                | continue/close by next parent [S18]                                  | `getTreeConnector` [R5]                 | Same                  |
| Highlight                 | every matched word, `<mark>`, title + snippets [S15]                 | matched run in title only [R6]          | **Spec**              |
| Snippet                   | 15 words of content [S15][S20]                                       | body never shown [R6]                   | **Spec**; dropped     |

## Synthesis

- **Where the "page then sub-headings" view comes from.** Three pieces combine:
  - the index ranks a page's `lvl1` record above its headings (`weight.level`) [S9]
  - the modal sorts hits into groups by `lvl0` [S16]
  - within a group it sorts again by `lvl1`, makes every other hit a child, and draws
    tree lines [S15][S18]
  - `distinct` plays no part in it.
    Our code already has all three: `compareRank` handles page vs heading, `groupSearchResults`
    groups by `section`, and `nestHeadingsUnderPages` plus `getTreeConnector` do the
    nesting [R2][R3][R4][R5].
- **One page can look like a single result in DocSearch.** A query that matches a page
  title matches every record of that page, because each record carries `hierarchy.lvl1`
  [S2][S9]. The per-group cap of 5 then shows the page's best records [S16].
  Our spec matches each record's own title only, so the same query returns the page
  record and only those headings whose own title or body matches [R2]. The legacy scraper
  sits between the two: `hierarchy_radio` comes first, so own-heading matches outrank
  ancestor matches [S4]. We are the strict form of that rule. If "show the page's headings
  when the page title matches" is wanted later, the change is to add `breadcrumb` as a
  lowest tier. Do not adopt DocSearch's unordered all-levels match.
- **Distinct moves to build time.** DocSearch emits paragraph records and dedups them per
  anchor at query time [S2][S4]. Its v5 crawler already merges sibling paragraphs at
  extraction [S11]. Writing one `body` per heading finishes that move. Query-time distinct
  becomes unnecessary, and the record count stays about the number of headings plus the
  number of pages [R6].
- **The ranking disagreements are deliberate on both sides.** DocSearch turns off position
  inside a title (`unordered`) because doc matches "are not necessarily at the start" [S4].
  Our spec ranks start-of-title higher for type-ahead [R6]. Algolia's `exact` criterion
  rewards one-word attributes [S23]. That is close to "title starts with" for short
  titles, but not the same rule. The spec wins, as briefed.
- **Group order.** DocSearch orders groups by best hit, because `groupBy` keeps the order
  in which hits arrive [S16]. The spec chose tree order, on purpose ("a stable, learnable
  order") [R6]. It is the single largest visible difference from the
  angularprimitives.com modal.
- **Build script (proposal, not sourced behaviour):**
  ```ts
  // tools/search-index: tree-ordered walk, one page record + one per H2/H3
  for (const [entryOrder, { entry, section }] of flattenTree(DOCS_NAV_ROOT, DOCS_NAV_SECTIONS)) {
    const md = readContent(entry.slug); // missing file = build error [R7]
    emit({
      id: entry.slug,
      kind: 'page',
      title: entry.label,
      section,
      breadcrumb: `${section} › ${entry.label}`,
      body: introProse(md),
      entryOrder,
    });
    for (const h of headings(md, [2, 3]))
      // code fences + demo blocks stripped,
      emit({
        id: `${entry.slug}#${slug(h.text)}`, // inline code kept [R6]
        kind: 'heading',
        title: h.text,
        section,
        breadcrumb: `${section} › ${entry.label} › ${h.text}`,
        body: proseUntilNextHeading(h),
        entryOrder,
      });
  }
  ```
  `slug()` must be the same function the Markdown renderer uses for heading `id`s. That is
  the local version of DocSearch's rule "unique `id` on every `lvlX`" [S12]. Without it,
  `id` navigates to an anchor that does not exist [R10].
- **Query change:** fold the query, `title` and `body` with
  `normalize('NFD').replace(/[̀-ͯ]/g, '')` before `toLowerCase()`. Fold the
  stored records once at load time, not on every keystroke [S30][R2]. Nothing else in
  `groupSearchResults` needs to change.
- **To/from DocSearch:** `toDocSearchHit(r)` and `fromDocSearchHit(h)` are a column swap
  over the Comparison table:
  - `type` = `r.kind === 'page' ? 'lvl1' : 'lvl2'`
  - `hierarchy` = `{ lvl0: section, lvl1: entryLabel, lvl2: title | null }`
  - `url` = `id`; `content` = `body`
  - The one lossy point: `entryLabel` is not a field. Parse it from `breadcrumb`, or add
    it to the record if the conversion is ever needed. Nothing needs it today.

## Against

- DocSearch matches each query word separately, in any order, and drops words when nothing
  matches (`allOptional`) [S4]. Our whole-string `includes` returns nothing for
  "editing row" against "Row Editing" [R2]. This is the one DocSearch rule worth proposing
  as a spec change, if it bites. It is not adopted here.
- Without typo tolerance, `selction` returns no result, where DocSearch would find
  Selection [S4][R6]. The spec accepts that trade on purpose.
- Matching only a record's own title hides the headings of a page whose title matched,
  which DocSearch would show [S9][R2].

## Not researched

- Which Markdown parser the build script should use, or how to strip fenced code and
  `Preview Window` blocks while keeping inline code.
- The Algolia Crawler's own source (closed). No v5 internals.
- angularprimitives.com's crawler config. Its `lvl0` selector is not public.
- Docusaurus, VitePress and Starlight local-search plugins as other prior art.

## Unverified

- v5 `weight.level` values and the v5 anchor lookup. They are assumed equal to the legacy
  `100 - 10N` formula [S3] and the legacy lookup [S5]. Only the hit shape is confirmed to
  match [S22].
- That v5 `url` includes the anchor, so that `distinct: url` means per-section. This is
  confirmed in the legacy source [S2]. For v5 it is inferred from the `url` /
  `url_without_anchor` pair in the hit type [S22].
- The exact `searchable_attributes` build order and the body of `get_hierarchy_radio`
  (paraphrased, see Method) [S4][S6]. Read the raw files at `v1.15.0` to confirm.
- Breadcrumb of an H3 record. The spec says `section › entry › heading` [R6]. DocSearch
  would put the parent H2 in between [S2]. The spec is ambiguous; ask before building.
- Whether a `hidden: true` entry (`/ui-layer/row-animation`) is indexed. The content
  source says only that a file with no tree entry is not indexed [R7][R8].
- What `introProse` covers on a page record, meaning the text before the first H2. The
  spec does not say; this is an inference.
- The spec's "on whole words" against the current raw-substring code. This is carried
  over unresolved from the prior discovery [R9].

## Sources

|     | Source                                                                                                                                                    | Version     | Verified                                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| S1  | https://docsearch.algolia.com/docs/legacy/config-file                                                                                                     | legacy docs | yes, page fetch. Lists `lvl0`-`lvl5` only; the scraper source resets up to `lvl6`                                                 |
| S2  | https://raw.githubusercontent.com/algolia/docsearch-scraper/v1.15.0/scraper/src/strategies/default_strategy.py                                            | v1.15.0     | yes, source read. Showed that `url` is rebuilt _with_ the anchor, which overturned the brief's "distinct on `url_without_anchor`" |
| S3  | https://raw.githubusercontent.com/algolia/docsearch-scraper/v1.15.0/scraper/src/strategies/abstract_strategy.py                                           | v1.15.0     | yes, source read (`get_level_weight`)                                                                                             |
| S4  | https://raw.githubusercontent.com/algolia/docsearch-scraper/v1.15.0/scraper/src/strategies/algolia_settings.py                                            | v1.15.0     | yes, settings dict read; `searchable_attributes` builder paraphrased                                                              |
| S5  | https://raw.githubusercontent.com/algolia/docsearch-scraper/v1.15.0/scraper/src/strategies/anchor.py                                                      | v1.15.0     | yes, read verbatim. No doc page describes this lookup                                                                             |
| S6  | https://raw.githubusercontent.com/algolia/docsearch-scraper/v1.15.0/scraper/src/strategies/hierarchy.py                                                   | v1.15.0     | partly, paraphrase only                                                                                                           |
| S7  | https://raw.githubusercontent.com/algolia/docsearch-scraper/v1.15.0/scraper/src/config/urls_parser.py                                                     | v1.15.0     | yes, `get_page_rank` read                                                                                                         |
| S8  | https://api.github.com/repos/algolia/docsearch-scraper/tags?per_page=5                                                                                    | v1.15.0     | yes, API. Repo `pushed_at` 2024-04-24 (from https://api.github.com/repos/algolia/docsearch-scraper)                               |
| S9  | https://docsearch.algolia.com/docs/templates                                                                                                              | v5 docs     | yes, page fetch. Default, Docusaurus and VitePress templates                                                                      |
| S10 | https://docsearch.algolia.com/docs/record-extractor                                                                                                       | v5 docs     | yes, page fetch. Silent on anchors                                                                                                |
| S11 | https://www.algolia.com/doc/tools/crawler/apis/configuration/actions.md                                                                                   | live        | yes, page fetch. `aggregateContent` / `indexHeadings` / `recordVersion` defaults                                                  |
| S12 | https://docsearch.algolia.com/docs/required-configuration                                                                                                 | v5 docs     | yes, page fetch                                                                                                                   |
| S13 | https://docsearch.algolia.com/docs/crawler                                                                                                                | v5 docs     | yes, page fetch                                                                                                                   |
| S14 | https://registry.npmjs.org/@docsearch/react/5.2.0                                                                                                         | 5.2.0       | yes, registry. gitHead `db3337978a2c9be6ec9187e73105a94dc0b1bbf3`                                                                 |
| S15 | https://raw.githubusercontent.com/algolia/docsearch/db3337978a2c9be6ec9187e73105a94dc0b1bbf3/packages/docsearch-react/src/utils/createDocSearchSources.ts | 5.2.0       | yes, source read. Grouping is client-side; no query `distinct`                                                                    |
| S16 | https://raw.githubusercontent.com/algolia/docsearch/db3337978a2c9be6ec9187e73105a94dc0b1bbf3/packages/docsearch-react/src/utils/groupBy.ts                | 5.2.0       | yes, read verbatim                                                                                                                |
| S17 | https://raw.githubusercontent.com/algolia/docsearch/db3337978a2c9be6ec9187e73105a94dc0b1bbf3/packages/docsearch-react/src/utils/removeHighlightTags.ts    | 5.2.0       | yes, read verbatim. The group key is `lvl0`, which is not obvious from the call site                                              |
| S18 | https://raw.githubusercontent.com/algolia/docsearch/db3337978a2c9be6ec9187e73105a94dc0b1bbf3/packages/docsearch-react/src/ResultsScreen.tsx               | 5.2.0       | yes, source read                                                                                                                  |
| S19 | https://raw.githubusercontent.com/algolia/docsearch/db3337978a2c9be6ec9187e73105a94dc0b1bbf3/packages/docsearch-react/src/Results.tsx                     | 5.2.0       | yes, source read                                                                                                                  |
| S20 | https://raw.githubusercontent.com/algolia/docsearch/db3337978a2c9be6ec9187e73105a94dc0b1bbf3/packages/docsearch-react/src/constants.ts                    | 5.2.0       | yes, `SNIPPET_LENGTH = 15`; the template's `content:10` is overridden per query                                                   |
| S21 | https://raw.githubusercontent.com/algolia/docsearch/db3337978a2c9be6ec9187e73105a94dc0b1bbf3/packages/docsearch-react/src/icons/SourceIcon.tsx            | 5.2.0       | yes, read                                                                                                                         |
| S22 | https://raw.githubusercontent.com/algolia/docsearch/db3337978a2c9be6ec9187e73105a94dc0b1bbf3/packages/docsearch-react/src/types/DocSearchHit.ts           | 5.2.0       | yes, read verbatim. No `weight` on the client type                                                                                |
| S23 | https://www.algolia.com/doc/guides/managing-results/relevance-overview/in-depth/ranking-criteria                                                          | live        | yes, page fetch                                                                                                                   |
| S24 | https://www.algolia.com/doc/api-reference/api-parameters/queryType                                                                                        | live        | yes, page fetch                                                                                                                   |
| S25 | https://www.algolia.com/doc/api-reference/api-parameters/distinct                                                                                         | live        | yes, page fetch                                                                                                                   |
| S26 | https://www.algolia.com/doc/api-reference/api-parameters/searchableAttributes                                                                             | live        | yes, page fetch                                                                                                                   |
| S27 | https://www.algolia.com/doc/api-reference/api-parameters/attributesToSnippet                                                                              | live        | yes, page fetch. Snippet window rule is not documented                                                                            |
| S28 | https://www.algolia.com/doc/api-reference/api-parameters/minWordSizefor1Typo                                                                              | live        | yes, page fetch. Default 4                                                                                                        |
| S29 | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort                                                               | live        | yes, page fetch                                                                                                                   |
| S30 | https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize                                                         | live        | yes, page fetch. The combining-mark regex is the fetch tool's example, not MDN text                                               |
| R1  | apps/site/src/app/design-system/search/search.types.ts:10-25                                                                                              | —           | yes, read                                                                                                                         |
| R2  | apps/site/src/app/design-system/search/search-overlay.utils.ts:47-69                                                                                      | —           | yes, read                                                                                                                         |
| R3  | apps/site/src/app/design-system/search/search-overlay.utils.ts:76-107                                                                                     | —           | yes, read                                                                                                                         |
| R4  | apps/site/src/app/design-system/search/search-overlay.utils.ts:109-128                                                                                    | —           | yes, read                                                                                                                         |
| R5  | apps/site/src/app/design-system/search/search-overlay.utils.ts:134-146                                                                                    | —           | yes, read                                                                                                                         |
| R6  | apps/site/docs/design-handoff/specs/Search Index.md:34-95                                                                                                 | —           | yes, read                                                                                                                         |
| R7  | apps/site/docs/design-handoff/specs/Assets and Content Source.md:85-100                                                                                   | —           | yes, read                                                                                                                         |
| R8  | apps/site/src/app/layout/sidebar-navigation/sidebar-navigation.mock.ts:7-68                                                                               | —           | yes, read                                                                                                                         |
| R9  | apps/site/src/app/design-system/search/docs/discovery/search-engine-options.md                                                                            | —           | yes, read                                                                                                                         |
| R10 | apps/site/docs/design-handoff/specs/ (grep `anchor\|slugif`)                                                                                              | —           | yes, no rule for turning a heading into an anchor slug                                                                            |
