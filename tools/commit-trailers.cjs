// Issue-reference trailers for commit messages. Shared by the commit-msg
// hook, the CI trailer check, and close-linked-issue-on-ci-green.yml, so
// all three read a message the same way. Contract:
// docs/agents/issue-tracker.md#closing-trailer.

const TRAILER_LINE = /^(Ships|Refs):[ \t]*(.+?)[ \t]*$/gim;
const ISSUE_LIST = /^#\d+(?:[ \t]*,[ \t]*#\d+)*$/;

// Same verbs GitHub acts on at push time. Matched anywhere in the message,
// because that is where GitHub matches them.
const GITHUB_CLOSING_KEYWORD =
  /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\b:?[ \t]+(?:[\w.-]+\/[\w.-]+)?#\d+/gi;

const TYPES_NEEDING_TRAILER = new Set([
  'feat', 'fix', 'refactor', 'ref', 'perf', 'test', 'docs',
]);

function toIssueNumbers(value) {
  return value.split(',').map((part) => Number(part.trim().slice(1)));
}

/**
 * @returns {{ ships: number[], refs: number[], refsNone: boolean,
 *   malformed: string[] }}
 */
function parseTrailers(message) {
  const result = { ships: [], refs: [], refsNone: false, malformed: [] };
  for (const [line, key, value] of (message ?? '').matchAll(TRAILER_LINE)) {
    const isShips = key.toLowerCase() === 'ships';
    const isRefsNone = !isShips && value.toLowerCase() === 'none';
    if (isRefsNone) {
      result.refsNone = true;
      continue;
    }
    if (!ISSUE_LIST.test(value)) {
      result.malformed.push(line.trim());
      continue;
    }
    const target = isShips ? result.ships : result.refs;
    for (const n of toIssueNumbers(value)) {
      if (!target.includes(n)) target.push(n);
    }
  }
  return result;
}

function findGithubClosingKeywords(message) {
  return [...(message ?? '').matchAll(GITHUB_CLOSING_KEYWORD)].map(
    ([match]) => match,
  );
}

// Tolerates a leading emoji and a scope: "✅ test(table/x)!: ..." -> "test".
function commitType(subject) {
  const match = /^[^A-Za-z]*([a-z]+)(?:\([^)]*\))?!?:/.exec(subject ?? '');
  return match ? match[1] : null;
}

function isExemptSubject(subject) {
  const isMerge = /^Merge\b/.test(subject);
  const isRevert = /^Revert\b/.test(subject);
  const isAutosquash = /^(?:fixup|squash|amend)!/.test(subject);
  return isMerge || isRevert || isAutosquash;
}

/**
 * @param {{ stripComments?: boolean }} [opts] strip git's "#" comment lines
 *   — only for a message still in the editor file (the commit-msg hook).
 *   A committed message may legitimately start a line with "#141".
 * @returns {string[]} one line per problem; empty when the message is fine
 */
function lintMessage(message, opts = {}) {
  const allLines = (message ?? '').split(/\r?\n/);
  const lines = opts.stripComments
    ? allLines.filter((line) => !line.startsWith('#'))
    : allLines;
  const cleaned = lines.join('\n');
  const subject = lines.find((line) => line.trim() !== '') ?? '';
  if (isExemptSubject(subject)) return [];

  const problems = [];
  for (const keyword of findGithubClosingKeywords(cleaned)) {
    problems.push(
      `GitHub closing keyword "${keyword}" closes the issue at push ` +
      'time, before CI. Use a "Ships: #N" trailer line instead.',
    );
  }

  const trailers = parseTrailers(cleaned);
  for (const line of trailers.malformed) {
    problems.push(
      `Malformed trailer "${line}". Expected "Ships: #1, #2", ` +
      '"Refs: #3" or "Refs: none".',
    );
  }

  const type = commitType(subject);
  const hasIssueTrailer =
    trailers.ships.length > 0 || trailers.refs.length > 0 ||
    trailers.refsNone;
  const needsTrailer = TYPES_NEEDING_TRAILER.has(type);
  if (needsTrailer && !hasIssueTrailer) {
    problems.push(
      `"${type}" commits need a trailer line: "Ships: #N" (completes ` +
      'the issue), "Refs: #N" (part of it) or "Refs: none".',
    );
  }
  return problems;
}

module.exports = {
  parseTrailers,
  findGithubClosingKeywords,
  commitType,
  lintMessage,
};
