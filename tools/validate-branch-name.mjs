#!/usr/bin/env node
// Single source for the branch-name rule — called by the pre-push hook and
// by pr-conventions.yml. Issue branches: <type>/<issue#>-<slug>; planning
// and chore branches may omit the number (docs/<epic-slug>).
import { execSync } from 'node:child_process';

const ALLOWED_TYPES = ['feat', 'fix', 'docs', 'ci', 'chore', 'ref', 'test', 'perf', 'build', 'revert', 'style'];
// Still accepted, never suggested: the long form `ref` replaced, matching
// LEGACY_TYPES in commit-trailers.cjs.
const LEGACY_TYPES = ['refactor'];
const PATTERN = new RegExp(`^(${[...ALLOWED_TYPES, ...LEGACY_TYPES].join('|')})/[a-z0-9][a-z0-9-]*$`);

const branch = process.argv[2] || execSync('git rev-parse --abbrev-ref HEAD').toString().trim();

if (PATTERN.test(branch)) {
  process.exit(0);
}

console.error(`Branch name "${branch}" doesn't match required pattern: <type>/<slug>`);
console.error(`Allowed types: ${ALLOWED_TYPES.join(', ')}`);
console.error('Example: feat/105-delete-coupled-surface, docs/table-filtering');
process.exit(1);
