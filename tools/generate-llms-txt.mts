/**
 * Generates the repo-root `llms.txt` — the agent entry point, per ADR-0001.
 *
 * Run: `npm run llms`. Flags: `--check` fails on drift instead of writing, `--dry-run` prints the
 * file to stdout, `--verbose`/`-v` adds the context inventory, `--no-color` forces plain output.
 *
 * Default output is one line — whether the map changed, and what changed if it did. Everything
 * else is behind `--verbose`: a developer already knows their own contexts, so listing them on
 * every run is noise.
 *
 * Inputs, all machine-readable — this generator authors no prose of its own:
 *   - `package.json` `name` / `description` — the H1 and the blockquote summary.
 *   - every `CONTEXT.md` beneath `apps/` and `libs/` — its frontmatter supplies `title`,
 *     `summary` and `depends-on`; the ADR path is derived from the context folder.
 *   - `AGENT.md`, `docs/agents/knowledge-base/*.md` — the `## Optional` list, titled by each
 *     file's H1.
 *
 * Format: https://llmstxt.org/ — H1, blockquote, optional body prose, then H2 sections that
 * are pure link lists. `## Optional` is the spec's reserved "skippable under context pressure"
 * section.
 *
 * Terminal output follows https://clig.dev/: color only on a TTY and never under `NO_COLOR`,
 * `TERM=dumb` or `--no-color`; every expected failure is rewritten for a human with the file
 * that caused it and the fix, instead of a stack trace.
 *
 * `llms.txt` is not run through Prettier: `.txt` is outside its default globs, so there is no
 * formatter to fight and the drift check compares exactly what this file emits.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, posix, relative, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const OUTPUT_FILE = join(REPO_ROOT, 'llms.txt');
const GENERATOR_PATH = 'tools/generate-llms-txt.mts';

/** Roots searched for contexts. A context is any folder beneath one of these holding a `CONTEXT.md`. */
const CONTEXT_SEARCH_ROOTS = ['apps', 'libs'];

/** Repo-level agent conventions and cross-context ADRs, listed under `## Optional`. */
const OPTIONAL_SOURCES = ['AGENT.md', 'docs/agents/knowledge-base'];

const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git', '.nx']);

interface Context {
  /** Repo-relative posix path of the context folder, e.g. `libs/table`. */
  dir: string;
  title: string;
  summary: string;
  dependsOn: readonly string[];
}

interface OptionalEntry {
  /** Repo-relative posix path of the file. */
  path: string;
  title: string;
  /** The `: detail` half of the llms.txt link line; `null` when the file supplies none. */
  detail: string | null;
}

// --- presentation --------------------------------------------------------------------------

/**
 * Colour is off unless stdout is a real terminal — piping, CI logs and `NO_COLOR` all get plain
 * text, per clig.dev. Also drives the symbol set: a terminal that refused colour is the same
 * terminal likely to mangle `✓`.
 */
const isRich =
  process.stdout.isTTY === true &&
  process.env['NO_COLOR'] === undefined &&
  process.env['TERM'] !== 'dumb' &&
  !process.argv.includes('--no-color');

type Style = 'bold' | 'dim' | 'red' | 'green' | 'yellow' | 'cyan';

const ANSI: Record<Style, readonly [string, string]> = {
  bold: ['[1m', '[22m'],
  dim: ['[2m', '[22m'],
  red: ['[31m', '[39m'],
  green: ['[32m', '[39m'],
  yellow: ['[33m', '[39m'],
  cyan: ['[36m', '[39m'],
};

function paint(style: Style, text: string): string {
  if (!isRich) {
    return text;
  }
  const [open, close] = ANSI[style];
  return `${open}${text}${close}`;
}

const SYMBOL = {
  pass: isRich ? '✓' : 'OK',
  fail: isRich ? '✗' : 'FAIL',
  bullet: isRich ? '·' : '-',
};

function out(line = ''): void {
  process.stdout.write(`${line}\n`);
}

function err(line = ''): void {
  process.stderr.write(`${line}\n`);
}

/** Left-pads a column so the context list reads as a table without a table library. */
function pad(text: string, width: number): string {
  return text + ' '.repeat(Math.max(0, width - text.length));
}

// --- errors --------------------------------------------------------------------------------

/**
 * A failure the user can act on: bad or missing frontmatter, an unknown `depends-on`, a missing
 * `package.json` field. Carries the file that caused it and the fix, so `main` can print three
 * readable lines instead of a stack trace. Anything *not* thrown as one of these is a bug in
 * this generator and keeps its traceback.
 */
class GeneratorError extends Error {
  // Plain fields, not constructor parameter properties: `node --experimental-strip-types` erases
  // types but never synthesizes code, and a parameter property is a code transform.
  readonly file: string | null;
  readonly hint: string;

  constructor(message: string, file: string | null, hint: string) {
    super(message);
    this.name = 'GeneratorError';
    this.file = file;
    this.hint = hint;
  }
}

// --- reading -------------------------------------------------------------------------------

function toHref(absolutePath: string): string {
  return posix.join(...relative(REPO_ROOT, absolutePath).split(/[\\/]/));
}

function readText(absolutePath: string): string {
  return readFileSync(absolutePath, 'utf8');
}

function readIfPresent(absolutePath: string): string | null {
  try {
    return readFileSync(absolutePath, 'utf8');
  } catch {
    return null;
  }
}

function listDirs(absolutePath: string): string[] {
  return readdirSync(absolutePath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !SKIP_DIRS.has(entry.name))
    .map((entry) => entry.name);
}

// --- frontmatter ---------------------------------------------------------------------------

/**
 * Deliberately not a YAML parser — it accepts exactly the three keys ADR-0001 defines and
 * throws on anything else. A context whose frontmatter this cannot read must fail the build,
 * not silently vanish from the map: silent omission is the one failure mode a generated index
 * cannot have.
 */
function parseFrontmatter(source: string, href: string): Map<string, string> {
  const lines = source.split(/\r?\n/);
  if (lines[0] !== '---') {
    throw new GeneratorError(
      'no frontmatter',
      href,
      'Add a block with title, summary and depends-on (ADR-0001), then rerun.'
    );
  }

  const closing = lines.indexOf('---', 1);
  if (closing === -1) {
    throw new GeneratorError(
      'frontmatter is never closed',
      href,
      "Add a second '---' line below the last key."
    );
  }

  const fields = new Map<string, string>();
  for (let index = 1; index < closing; index += 1) {
    const line = lines[index];
    if (line.trim() === '') {
      continue;
    }

    const separator = line.indexOf(':');
    if (separator === -1) {
      throw new GeneratorError(
        `frontmatter line ${index + 1} is not 'key: value'`,
        href,
        `Rewrite it as 'key: value' — got: ${line.trim()}`
      );
    }

    const key = line.slice(0, separator).trim();
    if (fields.has(key)) {
      throw new GeneratorError(`duplicate frontmatter key '${key}'`, href, 'Keep one, drop the other.');
    }
    fields.set(key, line.slice(separator + 1).trim());
  }

  return fields;
}

function unquote(value: string): string {
  const isQuoted =
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")));
  return isQuoted ? value.slice(1, -1) : value;
}

/** Accepts inline flow sequences only (`[]`, `[a, b]`) — the shape ADR-0001 specifies. */
function parseList(value: string, href: string, key: string): readonly string[] {
  if (!value.startsWith('[') || !value.endsWith(']')) {
    throw new GeneratorError(
      `'${key}' is not an inline list`,
      href,
      `Write it as [] or [Title, Other Title] — got: ${value}`
    );
  }

  const inner = value.slice(1, -1).trim();
  if (inner === '') {
    return [];
  }

  return inner.split(',').map((entry) => unquote(entry.trim()));
}

function requireField(fields: Map<string, string>, key: string, href: string): string {
  const value = fields.get(key);
  if (value === undefined || unquote(value) === '') {
    throw new GeneratorError(
      `frontmatter is missing '${key}'`,
      href,
      'ADR-0001 requires title, summary and depends-on on every CONTEXT.md.'
    );
  }
  return unquote(value);
}

// --- discovery -----------------------------------------------------------------------------

function collectContextDirs(): string[] {
  const found: string[] = [];

  const walk = (absoluteDir: string): void => {
    if (readIfPresent(join(absoluteDir, 'CONTEXT.md')) !== null) {
      found.push(toHref(absoluteDir));
      return; // a context is not searched for nested contexts — it owns everything beneath it
    }
    for (const name of listDirs(absoluteDir)) {
      walk(join(absoluteDir, name));
    }
  };

  for (const root of CONTEXT_SEARCH_ROOTS) {
    const absoluteRoot = join(REPO_ROOT, root);
    try {
      listDirs(absoluteRoot);
    } catch {
      continue; // search root absent — not an error, this repo may not have it
    }
    walk(absoluteRoot);
  }

  return found.sort();
}

function readContext(dir: string): Context {
  const href = posix.join(dir, 'CONTEXT.md');
  const fields = parseFrontmatter(readText(join(REPO_ROOT, dir, 'CONTEXT.md')), href);

  return {
    dir,
    title: requireField(fields, 'title', href),
    summary: requireField(fields, 'summary', href),
    dependsOn: parseList(fields.get('depends-on') ?? '[]', href, 'depends-on'),
  };
}

/**
 * Reads an `## Optional` entry's title and detail.
 *
 * Detail comes from `summary:` frontmatter, except for ADRs, which carry `**Status:**` instead —
 * their house format has no frontmatter and this generator does not get to change it. Detail is
 * genuinely optional: a file without one still lists, it just gives a reader less to go on.
 */
function readOptionalEntry(fileHref: string): OptionalEntry {
  const lines = readText(join(REPO_ROOT, fileHref)).split(/\r?\n/);

  const heading = lines.find((line) => line.startsWith('# '));
  if (heading === undefined) {
    throw new GeneratorError(
      'no H1 heading',
      fileHref,
      'Its llms.txt entry is titled by the H1 — add one, or drop the file from OPTIONAL_SOURCES.'
    );
  }

  const status = lines.find((line) => line.startsWith('**Status:**'));
  const isAdr = fileHref.startsWith('docs/adr/');
  if (isAdr && status !== undefined) {
    return {
      path: fileHref,
      title: heading.slice(2).trim(),
      detail: `Status: ${status.slice('**Status:**'.length).trim()}.`,
    };
  }

  const summary = lines[0] === '---' ? parseFrontmatter(lines.join('\n'), fileHref).get('summary') : undefined;

  return {
    path: fileHref,
    title: heading.slice(2).trim(),
    detail: summary === undefined ? null : unquote(summary),
  };
}

function collectOptional(): OptionalEntry[] {
  const files: string[] = [];

  for (const source of OPTIONAL_SOURCES) {
    const absolute = join(REPO_ROOT, source);
    let names: string[] | null = null;
    try {
      names = readdirSync(absolute, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
        .map((entry) => posix.join(source, entry.name));
    } catch {
      names = null; // not a directory — treat as a single file below
    }

    if (names === null) {
      if (readIfPresent(absolute) === null) {
        throw new GeneratorError(
          'listed in OPTIONAL_SOURCES but not found',
          source,
          `Restore the file, or remove it from OPTIONAL_SOURCES in ${GENERATOR_PATH}.`
        );
      }
      files.push(source);
    } else {
      files.push(...names);
    }
  }

  return files.sort().map(readOptionalEntry);
}

// --- rendering -----------------------------------------------------------------------------

function renderRelationships(contexts: readonly Context[]): string {
  const edges = contexts.flatMap((context) =>
    context.dependsOn.map((target) => `${context.title} → ${target}`)
  );

  return edges.length === 0
    ? 'No context depends on another — none declares `depends-on`.'
    : `Dependencies between contexts: ${edges.join('; ')}.`;
}

function renderContextEntry(context: Context): string {
  return `- [${context.title}](${posix.join(context.dir, 'CONTEXT.md')}): ${context.summary} ADRs: \`${posix.join(context.dir, 'docs/adr')}/\`.`;
}

function render(
  name: string,
  description: string,
  contexts: readonly Context[],
  optional: readonly OptionalEntry[]
): string {
  const lines = [
    `# ${name}`,
    '',
    `> ${description}`,
    '',
    `Generated by \`${GENERATOR_PATH}\` (\`npm run llms\`) — do not edit by hand; \`npm run llms:check\` fails on drift.`,
    '',
    'Multi-context repo: each app/lib below owns its own `CONTEXT.md` (glossary) and `docs/adr/`',
    '(architectural decisions). There is no repo-root `CONTEXT.md`.',
    '',
    renderRelationships(contexts),
    '',
    '## Contexts',
    '',
    ...contexts.map(renderContextEntry),
    '',
    '## Optional',
    '',
    ...optional.map(
      (entry) => `- [${entry.title}](${entry.path})${entry.detail === null ? '' : `: ${entry.detail}`}`
    ),
    '',
  ];

  return lines.join('\n');
}

// --- terminal reports ----------------------------------------------------------------------

/**
 * What changed, as `-`/`+` lines. The delta is the only part of a regeneration a developer
 * cannot already guess: they know their own contexts, so listing them every run is noise, but
 * "this line left the map" is news. Capped — past a handful of lines the file itself is the
 * better read.
 */
function describeDelta(current: string | null, expected: string): string[] {
  const currentLines = new Set((current ?? '').split('\n'));
  const expectedLines = new Set(expected.split('\n'));

  const added = [...expectedLines].filter((line) => line !== '' && !currentLines.has(line));
  const removed = [...currentLines].filter((line) => line !== '' && !expectedLines.has(line));

  const shown = [
    ...removed.slice(0, 3).map((line) => `${paint('red', '-')} ${truncate(line)}`),
    ...added.slice(0, 3).map((line) => `${paint('green', '+')} ${truncate(line)}`),
  ];

  const hidden = added.length + removed.length - shown.length;
  if (hidden > 0) {
    shown.push(paint('dim', `… ${hidden} more line${hidden === 1 ? '' : 's'}`));
  }
  return shown;
}

/** One map line is far wider than a terminal; the identifying half is at the front. */
function truncate(line: string): string {
  const limit = Math.min((process.stdout.columns ?? 80) - 6, 96);
  return line.length > limit ? `${line.slice(0, limit - 1)}…` : line;
}

/**
 * A missing detail degrades rather than fails — the entry still lists. But it is worth one dim
 * line, because nothing else would ever tell you the map got less useful.
 */
function reportMissingDetail(optional: readonly OptionalEntry[]): void {
  const bare = optional.filter((entry) => entry.detail === null);
  if (bare.length === 0) {
    return;
  }
  out(
    paint(
      'dim',
      `  ${bare.length} optional ${bare.length === 1 ? 'entry has' : 'entries have'} no summary: ${bare.map((entry) => entry.path).join(', ')}`
    )
  );
}

/** `--verbose` only: the inventory. Useful when auditing the map, noise on every other run. */
function reportInventory(contexts: readonly Context[], optional: readonly OptionalEntry[]): void {
  const width = Math.max(...contexts.map((context) => context.title.length));
  for (const context of contexts) {
    out(
      `  ${paint('dim', SYMBOL.bullet)} ${pad(context.title, width)}  ${paint('dim', context.dir)}`
    );
  }
  out(paint('dim', `  ${contexts.length} contexts, ${optional.length} optional entries`));
}

function reportFailure(error: GeneratorError): void {
  const where = error.file === null ? '' : ` ${paint('dim', 'in')} ${paint('cyan', error.file)}`;
  err(`${paint('red', SYMBOL.fail)} ${error.message}${where}`);
  err(`  ${paint('dim', error.hint)}`);
}

// --- main ----------------------------------------------------------------------------------

interface PackageIdentity {
  name: string;
  description: string;
}

function readPackageIdentity(): PackageIdentity {
  const raw: unknown = JSON.parse(readText(join(REPO_ROOT, 'package.json')));
  if (typeof raw !== 'object' || raw === null) {
    throw new GeneratorError('package.json did not parse to an object', 'package.json', 'Fix the JSON.');
  }

  const fields: Record<string, unknown> = { ...raw };
  const name = fields['name'];
  const description = fields['description'];

  if (typeof name !== 'string' || name === '') {
    throw new GeneratorError(
      'package.json has no "name"',
      'package.json',
      'It is the llms.txt H1 — add it, then rerun.'
    );
  }
  if (typeof description !== 'string' || description === '') {
    throw new GeneratorError(
      'package.json has no "description"',
      'package.json',
      'It is the llms.txt blockquote summary — one sentence describing the repo.'
    );
  }

  return { name: name.replace(/^@/, '').replace(/\/source$/, ''), description };
}

function main(): void {
  // `--check` wins: printing and comparing are mutually exclusive, and silently reporting
  // "up to date" after skipping the comparison is the worse failure.
  const isCheck = process.argv.includes('--check');
  const isDryRun = !isCheck && process.argv.includes('--dry-run');
  const isVerbose = process.argv.includes('--verbose') || process.argv.includes('-v');

  const identity = readPackageIdentity();
  const contexts = collectContextDirs().map(readContext);

  if (contexts.length === 0) {
    throw new GeneratorError(
      `no CONTEXT.md found under ${CONTEXT_SEARCH_ROOTS.join(' or ')}`,
      null,
      'An empty map is never correct — check the search roots in ' + GENERATOR_PATH + '.'
    );
  }

  const known = new Set(contexts.map((context) => context.title));
  for (const context of contexts) {
    for (const target of context.dependsOn) {
      if (!known.has(target)) {
        throw new GeneratorError(
          `depends-on names '${target}', which is not a known context`,
          posix.join(context.dir, 'CONTEXT.md'),
          `Known context titles: ${[...known].join(', ')}.`
        );
      }
    }
  }

  const optional = collectOptional();
  const output = render(identity.name, identity.description, contexts, optional);

  if (isDryRun) {
    process.stdout.write(output);
    return;
  }

  const current = readIfPresent(OUTPUT_FILE);
  const isUnchanged = current === output;

  if (isCheck) {
    if (isUnchanged) {
      out(`${paint('green', SYMBOL.pass)} llms.txt up to date`);
      reportMissingDetail(optional);
      if (isVerbose) {
        reportInventory(contexts, optional);
      }
      return;
    }

    err(`${paint('red', SYMBOL.fail)} llms.txt is stale`);
    for (const line of describeDelta(current, output)) {
      err(`  ${line}`);
    }
    err(`  ${paint('dim', 'run')} ${paint('cyan', 'npm run llms')}`);
    process.exitCode = 1;
    return;
  }

  // Skip the write when nothing changed: an untouched mtime keeps this off `git status` and out
  // of every watcher that would otherwise rebuild.
  if (isUnchanged) {
    out(`${paint('green', SYMBOL.pass)} llms.txt unchanged`);
    reportMissingDetail(optional);
    if (isVerbose) {
      reportInventory(contexts, optional);
    }
    return;
  }

  writeFileSync(OUTPUT_FILE, output, 'utf8');

  if (current === null) {
    out(`${paint('green', SYMBOL.pass)} llms.txt created ${paint('dim', `— ${contexts.length} contexts`)}`);
  } else {
    out(`${paint('green', SYMBOL.pass)} llms.txt updated`);
    for (const line of describeDelta(current, output)) {
      out(`  ${line}`);
    }
  }

  reportMissingDetail(optional);

  if (isVerbose) {
    reportInventory(contexts, optional);
  }
}

try {
  main();
} catch (error) {
  if (error instanceof GeneratorError) {
    reportFailure(error);
    process.exitCode = 1;
  } else {
    // Not a failure this generator anticipated — keep the traceback, it is the bug report.
    throw error;
  }
}
