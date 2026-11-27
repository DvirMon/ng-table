/**
 * Generates the docs zone's two derived files from `apps/site/content/`:
 *
 *   - `src/app/content/content.manifest.ts` — nav tree, pages, prev/next, per-page headings.
 *     Bundled eagerly by the sidebar and routes, so it carries no body text.
 *   - `public/search-index.json` — one record per page plus one per H2/H3, with body text.
 *     Fetched lazily the first time the search overlay opens.
 *
 * Run: `npm run site:content`. `--check` writes nothing and fails when either file is stale.
 *
 * Inputs: `content/nav.yml` (order and sections) and every `content/**\/*.md` (frontmatter +
 * prose). Each page is lexed once, so the TOC headings and the search anchors come from the same
 * pass and the same anchor function (`toHeadingAnchor`, shared with the page renderer).
 *
 * Specs: `docs/design-handoff/specs/Content Model.md`, `Search Index.md`; decisions in
 * `docs/work/docs-zone/active/build-docs-zone/search-decisions.md`.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { Token, Tokens } from 'marked';
import { parse as parseYaml } from 'yaml';
import { createPageAnchors } from '../src/app/content/heading-anchor.ts';
import { decodeEntities, hasChildTokens, inlineText } from '../src/app/content/inline-text.ts';
import type {
  ContentArchetype,
  ContentHeading,
  ContentManifest,
  ContentPage,
  ContentSection,
} from '../src/app/content/content.types.ts';
import type { SearchResultRecord } from '../src/app/design-system/search/search.types.ts';
import { createMarkdown } from './content/markdown.mts';

const SITE_ROOT = resolve(import.meta.dirname, '..');
const CONTENT_DIR = join(SITE_ROOT, 'content');
const NAV_FILE = join(CONTENT_DIR, 'nav.yml');
const MANIFEST_FILE = join(SITE_ROOT, 'src/app/content/content.manifest.ts');
const SEARCH_INDEX_FILE = join(SITE_ROOT, 'public/search-index.json');
const GENERATOR_PATH = 'apps/site/tools/generate-content.mts';

const ARCHETYPES: readonly ContentArchetype[] = [
  'Doc Article',
  'Section Landing',
  'API Reference',
  'Examples Gallery',
];
const FRONTMATTER_KEYS = new Set(['label', 'slug', 'archetype', 'eyebrow', 'hidden']);
const SLUG_PATTERN = /^(\/[a-z0-9]+(-[a-z0-9]+)*)+$/;
const BREADCRUMB_SEPARATOR = ' › ';

/** Every problem found in one run; reported together so one run shows the whole list. */
const problems: string[] = [];

/** Site-relative, forward slashes on every OS. */
function displayPath(file: string): string {
  return relative(SITE_ROOT, file).replaceAll('\\', '/');
}

function report(file: string, message: string): void {
  problems.push(`${displayPath(file)}: ${message}`);
}

// ── Reading the sources ─────────────────────────────────────────────────────────────────

interface Frontmatter {
  label: string;
  slug: string;
  archetype: ContentArchetype;
  eyebrow: string | null;
  hidden: boolean;
}

interface SourcePage {
  file: string;
  frontmatter: Frontmatter;
  body: string;
}

function listMarkdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((dirent) => {
    const path = join(dir, dirent.name);
    if (dirent.isDirectory()) {
      return listMarkdownFiles(path);
    }
    return dirent.name.endsWith('.md') ? [path] : [];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isArchetype(value: unknown): value is ContentArchetype {
  return ARCHETYPES.some((archetype) => archetype === value);
}

function splitFrontmatter(file: string, source: string): { data: unknown; body: string } | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  if (!match) {
    report(file, 'missing frontmatter (a `---` block with label, slug, archetype)');
    return null;
  }
  return { data: parseYaml(match[1]), body: source.slice(match[0].length) };
}

function toFrontmatter(file: string, data: unknown): Frontmatter | null {
  if (!isRecord(data)) {
    report(file, 'frontmatter is not a YAML mapping');
    return null;
  }
  for (const key of Object.keys(data)) {
    if (!FRONTMATTER_KEYS.has(key)) {
      report(file, `unknown frontmatter key \`${key}\``);
    }
  }
  const { label, slug, archetype, eyebrow, hidden } = data;
  const hasValidLabel = typeof label === 'string' && label.trim().length > 0;
  const hasValidSlug = typeof slug === 'string' && SLUG_PATTERN.test(slug);
  const hasValidEyebrow = eyebrow === undefined || typeof eyebrow === 'string';
  const hasValidHidden = hidden === undefined || typeof hidden === 'boolean';
  if (!hasValidLabel) report(file, '`label` must be a non-empty string');
  if (!hasValidSlug) {
    report(file, '`slug` must be absolute, lowercase and hyphenated, with no trailing slash');
  }
  if (!isArchetype(archetype)) report(file, `\`archetype\` must be one of: ${ARCHETYPES.join(', ')}`);
  if (!hasValidEyebrow) report(file, '`eyebrow` must be a string');
  if (!hasValidHidden) report(file, '`hidden` must be true or false');

  const isValid = hasValidLabel && hasValidSlug && isArchetype(archetype);
  if (!isValid || !hasValidEyebrow || !hasValidHidden) {
    return null;
  }
  return {
    label: label.trim(),
    slug,
    archetype,
    eyebrow: typeof eyebrow === 'string' ? eyebrow : null,
    hidden: hidden === true,
  };
}

function readPages(): Map<string, SourcePage> {
  const pages = new Map<string, SourcePage>();
  for (const file of listMarkdownFiles(CONTENT_DIR)) {
    const split = splitFrontmatter(file, readFileSync(file, 'utf8'));
    const frontmatter = split && toFrontmatter(file, split.data);
    if (!split || !frontmatter) {
      continue;
    }
    const duplicate = pages.get(frontmatter.slug);
    if (duplicate) {
      report(file, `slug \`${frontmatter.slug}\` is also used by ${displayPath(duplicate.file)}`);
      continue;
    }
    pages.set(frontmatter.slug, { file, frontmatter, body: split.body });
  }
  return pages;
}

/** `nav.yml`: a list of `{ entry: slug }` (root entries) and `{ section, entries: slug[] }`. */
function readNav(): ContentSection[] {
  const data: unknown = parseYaml(readFileSync(NAV_FILE, 'utf8'));
  if (!Array.isArray(data)) {
    report(NAV_FILE, 'must be a YAML list of `entry:` and `section:` items');
    return [];
  }
  return data.flatMap((item: unknown, index): ContentSection[] => {
    const section = toNavSection(item);
    if (!section) {
      report(NAV_FILE, `item ${index + 1} is neither \`entry: <slug>\` nor \`section\` + \`entries\``);
      return [];
    }
    return [section];
  });
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function toNavSection(item: unknown): ContentSection | null {
  if (!isRecord(item)) {
    return null;
  }
  const { entry, section, entries } = item;
  if (typeof entry === 'string') {
    return { label: null, entries: [entry] };
  }
  if (typeof section === 'string' && isStringList(entries)) {
    return { label: section, entries };
  }
  return null;
}

function checkTreeMatchesPages(tree: readonly ContentSection[], pages: Map<string, SourcePage>): void {
  const treeSlugs = tree.flatMap((section) => section.entries);
  const seen = new Set<string>();
  for (const slug of treeSlugs) {
    if (seen.has(slug)) report(NAV_FILE, `\`${slug}\` is listed more than once`);
    if (!pages.has(slug)) report(NAV_FILE, `\`${slug}\` has no page (no .md with that slug)`);
    seen.add(slug);
  }
  for (const [slug, page] of pages) {
    if (!seen.has(slug)) report(page.file, `slug \`${slug}\` is not listed in nav.yml`);
  }
}

// ── Lexing one page ─────────────────────────────────────────────────────────────────────

const markdown = createMarkdown();

/**
 * Block tokens → the searchable prose they hold: paragraphs, list items, table cells, quote and
 * callout bodies. Code blocks and raw HTML are never indexed (`Search Index.md` § What is indexed).
 */
function blockText(token: Token): string[] {
  switch (token.type) {
    case 'code':
    case 'html':
    case 'space':
    case 'hr':
    case 'def':
      return [];
    case 'paragraph':
      return [inlineText(token.tokens)];
    case 'text':
      return [hasChildTokens(token) ? inlineText(token.tokens) : decodeEntities(token.text)];
    case 'list':
      return token.items.flatMap((item: Tokens.ListItem) => item.tokens.flatMap(blockText));
    case 'table':
      return [...token.header, ...token.rows.flat()].map((cell: Tokens.TableCell) =>
        inlineText(cell.tokens),
      );
    default:
      return hasChildTokens(token) ? token.tokens.flatMap(blockText) : [];
  }
}

/** A run of prose with the heading that owns it; `heading: null` is the intro before any H2. */
interface PageRegion {
  heading: ContentHeading | null;
  /** The H2 an H3 sits under, for its breadcrumb. */
  parent: ContentHeading | null;
  text: string[];
}

function isIndexedLevel(depth: number): depth is 2 | 3 {
  return depth === 2 || depth === 3;
}

/**
 * Splits a page into regions at each H2/H3. An H4+ is not its own region (`Search Index.md`
 * § Granularity); its text and prose stay with the enclosing H2/H3 so nothing goes unsearched.
 */
function lexPage(page: SourcePage): PageRegion[] {
  const anchorFor = createPageAnchors();
  const regions: PageRegion[] = [{ heading: null, parent: null, text: [] }];
  let currentH2: ContentHeading | null = null;

  for (const token of markdown.lexer(page.body)) {
    if (token.type !== 'heading') {
      regions[regions.length - 1].text.push(...blockText(token));
      continue;
    }
    const text = inlineText(token.tokens).trim();
    if (token.depth === 1) {
      report(page.file, `H1 "${text}" — the page H1 is the frontmatter \`label\`; start at ##`);
      continue;
    }
    if (!isIndexedLevel(token.depth)) {
      regions[regions.length - 1].text.push(text);
      continue;
    }
    if (token.depth === 3 && currentH2 === null) {
      report(page.file, `H3 "${text}" has no H2 above it`);
    }
    const heading: ContentHeading = { anchor: anchorFor(text), level: token.depth, text };
    regions.push({ heading, parent: token.depth === 3 ? currentH2 : null, text: [] });
    if (token.depth === 2) {
      currentH2 = heading;
    }
  }
  return regions;
}

// ── Building the outputs ────────────────────────────────────────────────────────────────

interface LexedPage {
  source: SourcePage;
  section: string | null;
  order: number;
  regions: PageRegion[];
}

function toHeadings(regions: readonly PageRegion[]): ContentHeading[] {
  return regions.flatMap((region) => (region.heading ? [region.heading] : []));
}

function buildManifest(tree: readonly ContentSection[], lexed: readonly LexedPage[]): ContentManifest {
  // Prev/next skip hidden pages and cross section boundaries (`Content Model.md` § Order).
  const visible = lexed.filter((page) => !page.source.frontmatter.hidden);
  const slugOf = (page: LexedPage | undefined): string | null =>
    page?.source.frontmatter.slug ?? null;
  const prevOf = (page: LexedPage): string | null =>
    slugOf(visible.findLast((other) => other.order < page.order));
  const nextOf = (page: LexedPage): string | null =>
    slugOf(visible.find((other) => other.order > page.order));
  const pages: ContentPage[] = lexed.map((page) => {
    const { label, slug, archetype, eyebrow, hidden } = page.source.frontmatter;
    return {
      slug,
      label,
      section: page.section,
      archetype,
      eyebrow: eyebrow ?? page.section,
      hidden,
      order: page.order,
      prev: prevOf(page),
      next: nextOf(page),
      headings: toHeadings(page.regions),
    };
  });
  return { tree, pages };
}

function joinBody(text: readonly string[]): string {
  return text.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * One page record plus one record per H2/H3. Hidden pages are skipped (decided 2026-11-27).
 * The docs root has no section, so it groups under its own label (`Search Index.md` § Groups).
 * An H3's breadcrumb includes its parent H2 (decided 2026-11-27).
 */
function buildSearchIndex(lexed: readonly LexedPage[]): SearchResultRecord[] {
  return lexed
    .filter((page) => !page.source.frontmatter.hidden)
    .flatMap((page) => {
      const { label, slug } = page.source.frontmatter;
      const section = page.section ?? label;
      const pageCrumb = page.section ? [page.section, label] : [label];
      return page.regions.map((region): SearchResultRecord => {
        const { heading, parent } = region;
        const crumb = heading
          ? [...pageCrumb, ...(parent ? [parent.text] : []), heading.text]
          : pageCrumb;
        return {
          id: heading ? `${slug}#${heading.anchor}` : slug,
          kind: heading ? 'heading' : 'page',
          title: heading ? heading.text : label,
          section,
          breadcrumb: crumb.join(BREADCRUMB_SEPARATOR),
          body: joinBody(region.text),
          entryOrder: page.order,
        };
      });
    });
}

/** Every heading record must point at a heading the manifest lists for that page. */
function checkAnchors(manifest: ContentManifest, records: readonly SearchResultRecord[]): void {
  const anchorsBySlug = new Map(
    manifest.pages.map((page) => [page.slug, new Set(page.headings.map((h) => h.anchor))]),
  );
  const seenIds = new Set<string>();
  for (const record of records) {
    const [slug, anchor] = record.id.split('#');
    if (seenIds.has(record.id)) report(SEARCH_INDEX_FILE, `duplicate record id \`${record.id}\``);
    seenIds.add(record.id);
    const hasHeading = anchor === undefined || anchorsBySlug.get(slug)?.has(anchor) === true;
    if (!hasHeading) report(SEARCH_INDEX_FILE, `\`${record.id}\` has no matching heading on its page`);
  }
}

function serializeManifest(manifest: ContentManifest): string {
  return [
    `// GENERATED by ${GENERATOR_PATH} (\`npm run site:content\`) from apps/site/content/.`,
    '// Never edit by hand — edit the Markdown or nav.yml and regenerate.',
    '',
    "import type { ContentManifest } from './content.types';",
    '',
    `export const CONTENT_MANIFEST: ContentManifest = ${JSON.stringify(manifest, null, 2)};`,
    '',
  ].join('\n');
}

function serializeSearchIndex(records: readonly SearchResultRecord[]): string {
  return `${JSON.stringify(records, null, 2)}\n`;
}

// ── Main ────────────────────────────────────────────────────────────────────────────────

function readIfExists(file: string): string | null {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function main(): void {
  const isCheck = process.argv.includes('--check');
  const pages = readPages();
  const tree = readNav();
  checkTreeMatchesPages(tree, pages);

  const lexed: LexedPage[] = [];
  for (const section of tree) {
    for (const slug of section.entries) {
      const source = pages.get(slug);
      if (source) {
        lexed.push({ source, section: section.label, order: lexed.length, regions: lexPage(source) });
      }
    }
  }

  // Pages missing from nav.yml are already reported; lex them anyway so their heading problems
  // show in the same run instead of only after they are added to the tree.
  const lexedSources = new Set(lexed.map((page) => page.source));
  for (const source of pages.values()) {
    if (!lexedSources.has(source)) {
      lexPage(source);
    }
  }

  const manifest = buildManifest(tree, lexed);
  const records = buildSearchIndex(lexed);
  checkAnchors(manifest, records);

  if (problems.length > 0) {
    console.error(`site:content — ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
    process.exitCode = 1;
    return;
  }

  const outputs = [
    { file: MANIFEST_FILE, text: serializeManifest(manifest) },
    { file: SEARCH_INDEX_FILE, text: serializeSearchIndex(records) },
  ];
  const stale = outputs.filter((output) => readIfExists(output.file) !== output.text);
  const summary = `${lexed.length} pages, ${records.length} search records`;

  if (isCheck) {
    if (stale.length > 0) {
      const names = stale.map((output) => displayPath(output.file)).join(', ');
      console.error(`site:content — stale: ${names}. Run \`npm run site:content\`.`);
      process.exitCode = 1;
      return;
    }
    console.log(`site:content — up to date (${summary}).`);
    return;
  }

  for (const output of stale) {
    writeFileSync(output.file, output.text);
  }
  console.log(
    stale.length > 0
      ? `site:content — wrote ${stale.map((output) => displayPath(output.file)).join(', ')} (${summary}).`
      : `site:content — no change (${summary}).`,
  );
}

main();
