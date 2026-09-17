/**
 * Generates `docs/status.md` — one row per `capability:`, pairing a feature's
 * state-layer spec, UI-layer spec, and story-discovery (`docs/0-product/`) doc.
 *
 * Run: `npm run table:status` (add `-- --dry-run` to print without writing).
 * Contract for the frontmatter fields it reads:
 * `docs/1-state/work/state-feature-competitive-audit/decisions.md` (D1–D3).
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, posix, relative, resolve } from 'node:path';

const DOCS_ROOT = resolve(import.meta.dirname, '..', 'docs');
const OUTPUT_FILE = join(DOCS_ROOT, 'status.md');
const GENERATOR_PATH = 'libs/table/tools/generate-status.ts';

/** D3: only these carry `capability:`/`spec:`/`code:`. Everything else keeps free-text `status:`. */
const STATE_FEATURES_DIR = join(DOCS_ROOT, '1-state', 'features');
const UI_DIRECTIVES_DIR = join(DOCS_ROOT, '3-ui', 'directives');
const CROSS_FEATURE_FILES = [
  join(DOCS_ROOT, '1-state', 'state-persistence.md'),
  join(DOCS_ROOT, '1-state', 'filters.md'),
];

/**
 * `docs/0-product/*.md` (story-discovery output) carry `capability:` only — no `spec:`/`code:`,
 * since maturity there isn't spec/code, it's "does a user-stories doc exist". A cross-cutting
 * doc (e.g. `performance.md`) has no `capability:` and is silently excluded, not diagnosed.
 */
const PRODUCT_DOCS_DIR = join(DOCS_ROOT, '0-product');

const SPEC_VALUES = ['none', 'stub', 'drafted', 'drilled'] as const;
const CODE_VALUES = ['none', 'partial', 'shipped'] as const;

const MISSING_LAYER_CELL = '—';
const INVALID_VALUE_CELL = '`?`';

type SpecStatus = (typeof SPEC_VALUES)[number];
type CodeStatus = (typeof CODE_VALUES)[number];
type Layer = 'state' | 'ui' | 'product';

interface SpecDoc {
  /** Path relative to `docs/`, posix-separated — usable directly as a link href. */
  href: string;
  layer: Layer;
  capability: string;
  spec: SpecStatus | null;
  code: CodeStatus | null;
}

interface CapabilityRow {
  capability: string;
  state: SpecDoc | null;
  ui: SpecDoc | null;
  product: SpecDoc | null;
}

function isSpecStatus(value: string): value is SpecStatus {
  return SPEC_VALUES.some((candidate) => candidate === value);
}

function isCodeStatus(value: string): value is CodeStatus {
  return CODE_VALUES.some((candidate) => candidate === value);
}

const diagnostics: string[] = [];

function reportDiagnostic(href: string, message: string): void {
  diagnostics.push(`${href}: ${message}`);
}

/**
 * Hand-parsed rather than YAML-parsed: the frontmatter is flat `key: value`
 * with no nesting, and the repo has no frontmatter parser as a direct dependency.
 * Returns null when the file has no frontmatter block at all.
 */
function parseFrontmatter(raw: string): Map<string, string> | null {
  const lines = raw.split(/\r?\n/);
  const hasOpeningFence = lines[0]?.trim() === '---';
  if (!hasOpeningFence) {
    return null;
  }

  const fields = new Map<string, string>();
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const isClosingFence = line.trim() === '---';
    if (isClosingFence) {
      return fields;
    }

    const separator = line.indexOf(':');
    const isKeyValueLine = separator > 0;
    if (isKeyValueLine) {
      const key = line.slice(0, separator).trim();
      const value = line
        .slice(separator + 1)
        .trim()
        .replace(/^['"]|['"]$/g, '');
      fields.set(key, value);
    }
  }

  return null; // unterminated block — treated as absent
}

function toHref(absolutePath: string): string {
  return relative(DOCS_ROOT, absolutePath).split(/[\\/]/).join(posix.sep);
}

function readSpecDoc(absolutePath: string, layer: Layer): SpecDoc | null {
  const href = toHref(absolutePath);
  const fields = parseFrontmatter(readFileSync(absolutePath, 'utf8'));

  if (fields === null) {
    reportDiagnostic(href, 'no YAML frontmatter block — expected capability:, spec:, code:');
    return null;
  }

  const capability = fields.get('capability') ?? '';
  if (capability === '') {
    reportDiagnostic(href, 'missing `capability:` — excluded from the roll-up');
    return null;
  }

  return {
    href,
    layer,
    capability,
    spec: readEnumField(href, fields, 'spec', isSpecStatus, SPEC_VALUES),
    code: readEnumField(href, fields, 'code', isCodeStatus, CODE_VALUES),
  };
}

function readEnumField<TValue extends string>(
  href: string,
  fields: Map<string, string>,
  key: string,
  isValid: (value: string) => value is TValue,
  allowed: readonly TValue[],
): TValue | null {
  const raw = fields.get(key);
  if (raw === undefined || raw === '') {
    reportDiagnostic(href, `missing \`${key}:\` — expected one of ${allowed.join(' | ')}`);
    return null;
  }
  if (!isValid(raw)) {
    reportDiagnostic(href, `unrecognised \`${key}: ${raw}\` — expected one of ${allowed.join(' | ')}`);
    return null;
  }
  return raw;
}

function readProductDoc(absolutePath: string): SpecDoc | null {
  const href = toHref(absolutePath);
  const fields = parseFrontmatter(readFileSync(absolutePath, 'utf8'));

  if (fields === null) {
    reportDiagnostic(href, 'no YAML frontmatter block — expected capability:');
    return null;
  }

  const capability = fields.get('capability') ?? '';
  if (capability === '') {
    return null; // cross-cutting doc (e.g. performance.md) — not per-capability, excluded silently
  }

  return { href, layer: 'product', capability, spec: null, code: null };
}

function listMarkdownFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => join(directory, name));
}

function collectSpecDocs(): SpecDoc[] {
  const stateFiles = [...listMarkdownFiles(STATE_FEATURES_DIR), ...CROSS_FEATURE_FILES.filter(existsSync)];
  const uiFiles = listMarkdownFiles(UI_DIRECTIVES_DIR);
  const productFiles = listMarkdownFiles(PRODUCT_DOCS_DIR);

  const stateDocs = stateFiles.map((file) => readSpecDoc(file, 'state'));
  const uiDocs = uiFiles.map((file) => readSpecDoc(file, 'ui'));
  const productDocs = productFiles.map((file) => readProductDoc(file));

  return [...stateDocs, ...uiDocs, ...productDocs].filter((doc): doc is SpecDoc => doc !== null);
}

function groupByCapability(docs: SpecDoc[]): CapabilityRow[] {
  const rows = new Map<string, CapabilityRow>();

  for (const doc of docs) {
    const row = rows.get(doc.capability) ?? { capability: doc.capability, state: null, ui: null, product: null };
    const occupant = row[doc.layer];

    if (occupant !== null) {
      reportDiagnostic(
        doc.href,
        `duplicate ${doc.layer}-layer doc for \`capability: ${doc.capability}\` (also ${occupant.href}) — kept the first`,
      );
    } else {
      row[doc.layer] = doc;
    }

    rows.set(doc.capability, row);
  }

  return [...rows.values()].sort((a, b) => a.capability.localeCompare(b.capability));
}

function renderStatusCell(doc: SpecDoc | null, field: 'spec' | 'code'): string {
  if (doc === null) {
    return MISSING_LAYER_CELL;
  }
  return doc[field] ?? INVALID_VALUE_CELL;
}

function renderDocsCell(row: CapabilityRow): string {
  const links: string[] = [];
  if (row.state !== null) {
    links.push(`[state](${row.state.href})`);
  }
  if (row.ui !== null) {
    links.push(`[ui](${row.ui.href})`);
  }
  if (row.product !== null) {
    links.push(`[product](${row.product.href})`);
  }
  return links.length > 0 ? links.join(' · ') : MISSING_LAYER_CELL;
}

function renderStoryResearchCell(row: CapabilityRow): string {
  return row.product !== null ? `[✅](${row.product.href})` : MISSING_LAYER_CELL;
}

function renderRow(row: CapabilityRow): string {
  const cells = [
    `\`${row.capability}\``,
    renderStatusCell(row.state, 'spec'),
    renderStatusCell(row.state, 'code'),
    renderStatusCell(row.ui, 'spec'),
    renderStatusCell(row.ui, 'code'),
    renderStoryResearchCell(row),
    renderDocsCell(row),
  ];
  return `| ${cells.join(' | ')} |`;
}

function renderHeader(): string {
  return [
    '<!-- GENERATED FILE — DO NOT EDIT BY HAND -->',
    '',
    '# Table docs status',
    '',
    `> **This file is generated by \`${GENERATOR_PATH}\` (\`npm run table:status\`).**`,
    '> Any hand edit is lost the next time it is regenerated.',
    '>',
    '> The specs are the single source of truth; this page is only a derived view of',
    '> their `capability:` / `spec:` / `code:` frontmatter. To change a value here,',
    "> edit the owning spec's frontmatter and regenerate — never edit this table.",
    '>',
    '> Field vocabulary: [decisions.md](1-state/work/state-feature-competitive-audit/decisions.md) (D1–D3).',
    '',
  ].join('\n');
}

function renderStatusDoc(rows: CapabilityRow[]): string {
  const table = [
    '| Capability | State spec | State code | UI spec | UI code | Story research | Docs |',
    '|---|---|---|---|---|---|---|',
    ...rows.map(renderRow),
  ].join('\n');

  const legend = [
    '',
    `\`${MISSING_LAYER_CELL}\` — that layer has no doc for this capability.`,
    `${INVALID_VALUE_CELL} — the doc exists but its field is missing or unrecognised; the generator logged a diagnostic.`,
    '',
  ].join('\n');

  return `${renderHeader()}\n${table}\n${legend}`;
}

function main(): void {
  const isDryRun = process.argv.includes('--dry-run');
  const rows = groupByCapability(collectSpecDocs());
  const output = renderStatusDoc(rows);

  if (isDryRun) {
    process.stdout.write(output);
  } else {
    writeFileSync(OUTPUT_FILE, output, 'utf8');
    process.stdout.write(`Wrote ${toHref(OUTPUT_FILE)} — ${rows.length} capabilities.\n`);
  }

  if (diagnostics.length > 0) {
    process.stderr.write(`\n${diagnostics.length} frontmatter problem(s):\n`);
    for (const diagnostic of diagnostics) {
      process.stderr.write(`  ${diagnostic}\n`);
    }
    process.exitCode = 1;
  }
}

main();
