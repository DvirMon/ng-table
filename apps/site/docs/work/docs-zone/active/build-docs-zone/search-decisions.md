# Search decisions for the docs-zone plan (D2, steps A, C, F)

Written 2026-11-27 by the search session, in answer to four questions about whether the planned
`content.manifest.ts` is enough for search. `plan.md` is not edited; apply these when the plan is next
touched.

Sources: `apps/site/docs/design-handoff/specs/Search Index.md` (record shape and rules),
`apps/site/src/app/design-system/search/search.types.ts`, and the discovery notes in
`apps/site/src/app/design-system/search/docs/discovery/`
(`search-engine-options.md`, `docsearch-minimal-clone.md`).

## Decided (confirmed by the user)

- **One generator, two outputs.** The generator parses each Markdown page once and writes:
  - `content.manifest.ts`: nav tree, routes, prev/next and per-page headings for the TOC.
  - `search-index.json`: the search records, loaded lazily when the search overlay first opens.
    Reason: body text would bloat a manifest that the sidebar and routes bundle eagerly, and two
    generators parsing separately could disagree on heading anchors.
- **No second source.** The Markdown files are the only source. Tree order, section labels and slugs come
  from `nav.yml` and the frontmatter. Heading anchors and body text come from the same parse pass.
- **No search library for now.** The existing `groupSearchResults` does the matching and ranking.
  Algolia DocSearch was evaluated and rejected; see the discovery notes.
- **Hidden pages are not indexed** (2026-11-27). Search shows only what the sidebar shows; a draft page
  about unbuilt behavior never appears in results. `Content Model.md` updated to match.
- **An H3's breadcrumb includes its parent H2** (2026-11-27): `section › entry › H2 › H3`. The generator
  tracks the last H2 while lexing; no new record field.
- **Matches start only at a word start** (2026-11-27), as Algolia's prefix matching does. A word starts
  at the text start, after a non-letter/digit, or at a camelCase hump. Never mid-word.
- **Parser: `marked` 18.3.0** (2026-11-27), a build-time devDependency. Its configuration lives in
  `apps/site/tools/content/markdown.mts`, shared with the step B renderer. Chosen over an own script:
  the renderer needs full Markdown, and two parsers could disagree on which lines are headings.

## What the plan needs to change

1. **Search records are not just entries.** A "search entry" in the manifest plan becomes one page record
   per entry plus one record per H2/H3 under it (id `slug#anchor`). Sections are the groups, in tree
   order. Entries alone would give page-level results only.
2. **Manifest fields needed for search:**
   - per page: `slug`, `label`, section label, flattened tree order, `hidden`;
   - per heading: `anchor`, `level` (2 or 3) and `text`.
3. **Body text is not in the manifest.** It goes only into `search-index.json`: the prose under each
   heading, including list items, table cell text, callout body and inline code, plus the intro prose
   before the first heading for a page record.
4. **Shared slug function.** The heading-to-anchor function must be one named function used by both the
   generator and the page renderer. No spec defines it yet.
5. **Check script.** `npm run site:content`'s check should also fail when a search record's anchor has no
   matching heading on its page.

## Not needed for search

Scores, keywords or a separate API-name list. Ranking is computed at query time from title position and
body matches, and inline code such as `ngpTableSort` is already found through body text.

## Open (not decided)

- Should API names generated from `libs/table/src` become their own search rows? That would be additive
  (a new record kind and an anchor on each API table row). It is not required now.
