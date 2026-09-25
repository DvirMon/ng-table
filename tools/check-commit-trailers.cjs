#!/usr/bin/env node
// Lints issue-reference trailers — see tools/commit-trailers.cjs.
//   node tools/check-commit-trailers.cjs --file .git/COMMIT_EDITMSG
//   node tools/check-commit-trailers.cjs --range <base>..<head>

const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { lintMessage } = require('./commit-trailers.cjs');

const RECORD_SEP = '\x1e';
const FIELD_SEP = '\x1f';

function commitsInRange(range) {
  const log = execFileSync(
    'git',
    ['log', '--no-merges', `--format=%H${FIELD_SEP}%B${RECORD_SEP}`, range],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  return log
    .split(RECORD_SEP)
    .map((record) => record.replace(/^\s+/, ''))
    .filter(Boolean)
    .map((record) => {
      const [sha, message] = record.split(FIELD_SEP);
      return { label: sha.slice(0, 7), message };
    });
}

function readTargets(argv) {
  const [flag, value] = argv;
  if (flag === '--file' && value) {
    return {
      targets: [{ label: 'commit message', message: readFileSync(value, 'utf8') }],
      stripComments: true,
    };
  }
  if (flag === '--range' && value) {
    return { targets: commitsInRange(value), stripComments: false };
  }
  console.error('usage: check-commit-trailers.cjs --file <path> | --range <a>..<b>');
  process.exit(2);
}

const { targets, stripComments } = readTargets(process.argv.slice(2));
let failed = 0;
for (const { label, message } of targets) {
  const problems = lintMessage(message, { stripComments });
  if (problems.length === 0) continue;
  failed++;
  const subject = message.split(/\r?\n/)[0];
  console.error(`✗ ${label}  ${subject}`);
  for (const problem of problems) console.error(`    ${problem}`);
}

if (failed > 0) {
  console.error(
    `\n${failed} commit message(s) rejected. ` +
    'Contract: docs/agents/issue-tracker.md#closing-trailer',
  );
  process.exit(1);
}
console.log(`✓ ${targets.length} commit message(s) checked.`);
