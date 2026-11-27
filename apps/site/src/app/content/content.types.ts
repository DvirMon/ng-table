/** Page archetypes a content entry may name — `docs/design-handoff/specs/pages/`. */
export type ContentArchetype =
  'Doc Article' | 'Section Landing' | 'API Reference' | 'Examples Gallery';

/** One H2 or H3 on a page — the TOC item and the target of a heading search record. */
export interface ContentHeading {
  /** From `toHeadingAnchor` / `createPageAnchors` — the heading's `id` on the rendered page. */
  readonly anchor: string;
  readonly level: 2 | 3;
  readonly text: string;
}

/** One routable page, resolved from its Markdown frontmatter and its place in `nav.yml`. */
export interface ContentPage {
  /** Absolute route, leading slash, no trailing slash — `Content Model.md` § Entry fields. */
  readonly slug: string;
  /** Sidebar item, H1 and pagination card text. */
  readonly label: string;
  /** Parent section label; `null` for the docs root, which sits outside any section. */
  readonly section: string | null;
  readonly archetype: ContentArchetype;
  /** Category badge text: frontmatter `eyebrow`, else the section label, else `null`. */
  readonly eyebrow: string | null;
  /** No sidebar item, skipped by prev/next, not searched — still routable. */
  readonly hidden: boolean;
  /** Position in the flattened tree, hidden pages included. */
  readonly order: number;
  /** Slugs of the nearest non-hidden pages either side, in tree order. */
  readonly prev: string | null;
  readonly next: string | null;
  readonly headings: readonly ContentHeading[];
}

/** A sidebar group. `label: null` is the docs-root group rendered above the first section label. */
export interface ContentSection {
  readonly label: string | null;
  /** Page slugs in tree order. */
  readonly entries: readonly string[];
}

/** The generated `content.manifest.ts` — the only source for sidebar, TOC, routes and prev/next. */
export interface ContentManifest {
  readonly tree: readonly ContentSection[];
  /** Every page, in tree order. */
  readonly pages: readonly ContentPage[];
}
