// Commit-message and PR-title rules. Shared by the commit-msg hook and
// pr-conventions.yml, so both read a message the same way. Contract:
// docs/agents/issue-tracker.md#issue-references.

// "<emoji> <type>(<scope>)!: <subject>" — emoji required, scope optional.
// Types: @commitlint/config-conventional's list.
const TYPES = [
  'feat', 'fix', 'refactor', 'perf', 'test', 'docs',
  'chore', 'build', 'ci', 'style', 'revert',
];
const HEADER = new RegExp(
  `^(\\p{Extended_Pictographic}[\\u{FE0F}\\u{200D}\\p{Extended_Pictographic}]*) ` +
  `(${TYPES.join('|')})(?:\\(([a-z0-9][a-z0-9/._-]*)\\))?(!)?: (\\S.*)$`,
  'u',
);
const PR_ISSUE_SUFFIX = / \(#\d+\)$/;

const TRAILER_LINE = /^(Ships|Refs|Epic):[ \t]*(.+?)[ \t]*$/gim;
const ISSUE_LIST = /^#\d+(?:[ \t]*,[ \t]*#\d+)*$/;

// Same verbs GitHub acts on. Matched anywhere in the message, because that
// is where GitHub matches them. Closing belongs in the PR body only.
const GITHUB_CLOSING_KEYWORD =
  /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\b:?[ \t]+(?:[\w.-]+\/[\w.-]+)?#\d+/gi;

function toIssueNumbers(value) {
  return value.split(',').map((part) => Number(part.trim().slice(1)));
}

/**
 * @returns {{ refs: number[], refsNone: boolean, epic: number[],
 *   ships: string[], malformed: string[] }}
 */
function parseTrailers(message) {
  const result = { refs: [], refsNone: false, epic: [], ships: [], malformed: [] };
  for (const [line, key, value] of (message ?? '').matchAll(TRAILER_LINE)) {
    const name = key.toLowerCase();
    if (name === 'ships') {
      result.ships.push(line.trim());
      continue;
    }
    const isRefsNone = name === 'refs' && value.toLowerCase() === 'none';
    if (isRefsNone) {
      result.refsNone = true;
      continue;
    }
    if (!ISSUE_LIST.test(value)) {
      result.malformed.push(line.trim());
      continue;
    }
    const target = name === 'epic' ? result.epic : result.refs;
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

/** @returns {{ emoji: string, type: string, scope?: string } | null} */
function parseHeader(subject) {
  const match = HEADER.exec(subject ?? '');
  if (!match) return null;
  const [, emoji, type, scope] = match;
  return { emoji, type, scope };
}

// Kept for callers that only need the type: "✅ test(table/x)!: ..." -> "test".
function commitType(subject) {
  return parseHeader(subject)?.type ?? null;
}

function headerProblem(subject, what) {
  return (
    `${what} "${subject}" must match "<emoji> <type>(<scope>): <subject>" ` +
    `— types: ${TYPES.join(', ')}. See the atomic-commit skill.`
  );
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

  const problems = [];
  const isAutosquash = /^(?:fixup|squash|amend)!/.test(subject);
  if (isAutosquash) {
    problems.push(
      `"${subject}" is an unsquashed autosquash commit — fold it with ` +
      '`git rebase -i --autosquash` before opening the PR.',
    );
    return problems;
  }

  const hasValidHeader = parseHeader(subject) !== null;
  if (!hasValidHeader) problems.push(headerProblem(subject, 'Subject'));

  for (const keyword of findGithubClosingKeywords(cleaned)) {
    problems.push(
      `Closing keyword "${keyword}" in a commit. Commits carry ` +
      '"Refs: #N"; "Closes #N" belongs in the PR body.',
    );
  }

  const trailers = parseTrailers(cleaned);
  for (const line of trailers.ships) {
    problems.push(
      `"${line}" is retired. Use "Refs: #N"; the PR body carries "Closes #N".`,
    );
  }
  for (const line of trailers.malformed) {
    problems.push(
      `Malformed trailer "${line}". Expected "Refs: #1, #2", ` +
      '"Refs: none" or "Epic: #3".',
    );
  }

  const hasRefs = trailers.refs.length > 0 || trailers.refsNone;
  if (!hasRefs) {
    problems.push(
      'Every commit needs a trailer line "Refs: #N" (the issue it belongs ' +
      'to) or "Refs: none".',
    );
  }
  return problems;
}

/** PR title: the commit header rule, optionally suffixed with " (#N)". */
function lintTitle(title) {
  const withoutIssue = (title ?? '').replace(PR_ISSUE_SUFFIX, '');
  const hasValidHeader = parseHeader(withoutIssue) !== null;
  return hasValidHeader ? [] : [headerProblem(title, 'PR title')];
}

module.exports = {
  TYPES,
  parseTrailers,
  parseHeader,
  findGithubClosingKeywords,
  commitType,
  lintMessage,
  lintTitle,
};
