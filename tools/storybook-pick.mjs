// Asks which checkout to serve Storybook from (main or a worktree), then starts it there.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, symlinkSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { join, resolve } from 'node:path';

function listCheckouts() {
  const out = execFileSync('git', ['worktree', 'list', '--porcelain'], { encoding: 'utf8' });
  return out
    .split(/\r?\n\r?\n/)
    .map((block) => {
      const path = /^worktree (.+)$/m.exec(block)?.[1];
      const branch = /^branch refs\/heads\/(.+)$/m.exec(block)?.[1];
      const isBare = /^bare$/m.test(block);
      return path && !isBare ? { path: resolve(path), branch: branch ?? '(detached)' } : null;
    })
    .filter(Boolean);
}

const checkouts = listCheckouts();
checkouts.forEach((c, i) => console.log(`  ${i + 1}) ${c.branch}  —  ${c.path}`));

const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question(`\nServe which checkout? [1-${checkouts.length}] (default 1): `);
rl.close();

const index = answer.trim() === '' ? 0 : Number(answer) - 1;
const chosen = checkouts[index];
if (!chosen) {
  console.error('No such checkout.');
  process.exit(1);
}
// A fresh worktree has no node_modules: link the main checkout's (junction, no admin needed).
const modulesPath = join(chosen.path, 'node_modules');
const mainModulesPath = join(checkouts[0].path, 'node_modules');
if (!existsSync(modulesPath)) {
  if (!existsSync(mainModulesPath)) {
    console.error(`No node_modules in ${chosen.path} or ${checkouts[0].path} — run npm install in main.`);
    process.exit(1);
  }
  symlinkSync(mainModulesPath, modulesPath, 'junction');
  console.log(`Linked node_modules → ${mainModulesPath}`);
}

console.log(`\nStorybook from ${chosen.branch} → http://localhost:4403\n`);
const child = spawn('npx nx run shared-table:storybook', {
  cwd: chosen.path,
  stdio: 'inherit',
  shell: true,
});
child.on('exit', (code) => process.exit(code ?? 0));
