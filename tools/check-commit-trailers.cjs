#!/usr/bin/env node
// Lints commit messages and PR titles — see tools/commit-trailers.cjs.
//   node tools/check-commit-trailers.cjs --file .git/COMMIT_EDITMSG
//   node tools/check-commit-trailers.cjs --range <base>..<head>
//   node tools/check-commit-trailers.cjs --title "<PR title>"

const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { lintMessage, lintTitle } = require('./commit-trailers.cjs');

const RECORD_SEP = '\x1e';
const FIELD_SEP = '\x1f';

// In GitHub Actions, also emit an `::error` annotation so the reason
// shows on the check summary, not only in the raw log.
function annotate(title, lines) {
  if (process.env.GITHUB_ACTIONS !== 'true') return;
  const data = lines.join('\n')
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A');
  console.log(`::error title=${title}::${data}`);
}

function git(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

// Merge commits are an error in their own right: main is linear, PR
// branches rebase onto origin/main instead of merging it in.
function mergeCommitsInRange(range) {
  return git(['log', '--merges', '--format=%h %s', range])
    .split('\n')
    .filter(Boolean);
}

function commitsInRange(range) {
  return git(['log', '--no-merges', `--format=%H${FIELD_SEP}%B${RECORD_SEP}`, range])
    .split(RECORD_SEP)
    .map((record) => record.replace(/^\s+/, ''))
    .filter(Boolean)
    .map((record) => {
      const [sha, message] = record.split(FIELD_SEP);
      return { label: sha.slice(0, 7), message, lint: lintMessage };
    });
}

function readTargets(argv) {
  const [flag, value] = argv;
  if (flag === '--file' && value) {
    const message = readFileSync(value, 'utf8');
    return {
      targets: [{
        label: 'commit message',
        message,
        lint: (m) => lintMessage(m, { stripComments: true }),
      }],
      merges: [],
    };
  }
  if (flag === '--range' && value) {
    return { targets: commitsInRange(value), merges: mergeCommitsInRange(value) };
  }
  if (flag === '--title' && value !== undefined) {
    return {
      targets: [{ label: 'PR title', message: value, lint: lintTitle }],
      merges: [],
    };
  }
  console.error(
    'usage: check-commit-trailers.cjs --file <path> | --range <a>..<b> | --title <text>',
  );
  process.exit(2);
}

const { targets, merges } = readTargets(process.argv.slice(2));
let failed = 0;
for (const merge of merges) {
  failed++;
  console.error(`✗ ${merge}`);
  console.error('    Merge commit — rebase onto origin/main instead of merging.');
  annotate('Merge commit', [
    merge,
    'Rebase onto origin/main instead of merging.',
  ]);
}
for (const { label, message, lint } of targets) {
  const problems = lint(message);
  if (problems.length === 0) continue;
  failed++;
  const subject = message.split(/\r?\n/)[0];
  console.error(`✗ ${label}  ${subject}`);
  for (const problem of problems) console.error(`    ${problem}`);
  annotate(`Rejected ${label}`, [subject, ...problems]);
}

if (failed > 0) {
  console.error(
    `\n${failed} message(s) rejected. ` +
    'Contract: docs/agents/issue-tracker.md#issue-references',
  );
  process.exit(1);
}
console.log(`✓ ${targets.length} message(s) checked.`);
