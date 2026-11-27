# Plan: build the `/docs` zone of the NGP Table site

Goal: a documentation website for `@ngp/table`, in the style of the ng-primitives site.
Markdown is the source of truth; the site renders it.

## Where things stand

- Built: tokens, 16 DS components, Home (`/`), sidebar-navigation + toc-column (mock data), `doc-placeholder` page.
- Not built: content loader, Markdown rendering, routing/page state, doc shell, pagination wiring, real search index, Shiki, 5 of 6 archetypes (only Doc Article is in the first cut), real content.
- Specs for all of the above already exist in `docs/design-handoff/specs/` (Content Model, Routing and Page State, Search Index, pages/_, layout/_).

## Decisions to settle first

| #   | Decide                                | Recommendation                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Where the consumer-facing `.md` lives | `apps/site/content/**.md`, not `libs/table/docs/`. Lib docs are contributor specs (`spec:`/`code:` frontmatter, "drafted ahead of code"). Site pages need `label`/`slug`/`eyebrow` frontmatter and must only describe shipped behavior.                                                                                                                                                                                |
| D2  | How the loader runs                   | Build-time script (`tools/` or a Vite plugin) → one generated manifest: tree, per-page headings, search index. Never hand-edited.                                                                                                                                                                                                                                                                                      |
| D3  | Markdown renderer                     | `marked` or `markdown-it` at build time → HTML string rendered inside `ngptProse`; fenced code → `ngpt-code-block`; `:::note/tip/warning` → `ngptCallout`.                                                                                                                                                                                                                                                             |
| D4  | Syntax highlighting                   | Shiki at build time (the `.line` split in `code-block` is the slot).                                                                                                                                                                                                                                                                                                                                                   |
| D5  | Live demos in pages                   | **Decided:** the docs app is the source, not Storybook. Each recipe's Preview tab mounts a real standalone demo component from `apps/site/src/app/demos/<feature>/<recipe>/` (imports `@ngp/table` directly); the Source tab shows that component's own files. Existing Storybook hosts are ported, with MSW replaced by in-memory fake services. Open: how Source reads the files (raw import vs build step).         |
| D6  | Sections with no source               | Drop `Architecture`/`PRD` (already decided). Confirm "2. Columns" section (inferred, per Content Model).                                                                                                                                                                                                                                                                                                               |
| D7  | Doc shell design                      | **Decided: Doc Article v3** (design project "NGP Table Primitive", `pages/Doc Article v3.dc.html`): floating sidebar/content/TOC panels at 18px radius, pill nav items, wider gutters (see `APPLE-2026-REVIEW.md` in that project). Open: v3's pill nav item overrides `Sidebar Nav Item.md` (flush 2px border); the site's `nav-item` and the spec need updating. Read `APPLE-2026-REVIEW.md` before building step D. |

## Dependency graph

```
A content format + loader ──┬─> B markdown renderer ──┐
                            ├─> C routing/page state ─┼─> E Doc Article page ─> H other archetypes
                            ├─> F real search index   │
                            └─> D docs shell ─────────┘
G author content (parallel after A's frontmatter contract)
J brand assets / SEO / prerender (independent leaf)
I live demos (deferred, after E)
```

Parallel-safe: [G, J] after A's contract; [B, C, F] after A; D after C.
Dependency: A → C → D → E → H.

## Steps

1. **A. Content contract + loader.** Frontmatter schema (`label`, `slug`, `archetype`, `eyebrow?`, `hidden?`), one `nav.yml` for tree order, generator script → `content.manifest.ts`. `npm run site:content` + a check that fails on a slug/tree mismatch. Acceptance: tree, headings and search entries all come from the manifest.
2. **B. Markdown renderer.** MD → HTML with heading ids/anchors, callout directives, code fences via Shiki.
3. **C. Routing and page state.** Replace `doc-placeholder` routes with tree-driven routes; one `PageState` resolver (`entry`, `section`, `eyebrow`, `h1`, prev/next, headings, title); Not Found for unmatched paths.
4. **D. Docs shell.** Sidebar from tree (replace `sidebar-navigation.mock.ts`), TOC from page headings, content column, pagination footer, `docs` navbar variant.
5. **E. Doc Article archetype.** Eyebrow, H1, prose, pagination. Replaces the placeholder.
6. **F. Search.** Replace `search.mock.ts` with the generated index (sections = groups, entries = items); persist recents.
7. **G. Author content** (parallel). Getting Started (new: Introduction, Installation, First Table, Custom Feature), then State Layer, Columns, UI Layer from the lib docs, shipped capabilities first (tree, grouping, sorting, filtering, selection, row-editing, expansion).
8. **H. Other archetypes.** Section Landing (Overview), API Reference, Examples Gallery.
9. **J. Leaf work.** Logo/favicon/OG assets, per-page `<title>`/meta, prerender + deploy, `npm run llms` integration.
10. **I. Live demos** (deferred, see D5).

## Constraints that carry over

- Follow `docs/CONVENTIONS.md`: `ngpt` attribute-hosted components, `data-*` state, no barrels, local icons, `docs/decisions.md` per new domain.
- Typecheck with `nx run <project>:typecheck`, never bare `tsc`.
- Never hand-edit generated files (manifest, `llms.txt`).
