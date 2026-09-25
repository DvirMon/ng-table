# Step 6 — Retire the old timing surfaces

**PR scope:** Remove every timing measurement outside `apps/table-bench`; keep the Vitest bench's
deterministic gates.
**Depends on:** Step 5 (the replacement has produced numbers).
**Task type:** `code`
**Skills used:** `angular-developer`
**Scaffolding agent:** `angular-implementer`

## Files

| File | Action |
|---|---|
| `libs/table/src/directives/ngp-table-row-animation.bench.spec.ts` | edit — drop timing, keep counts |
| `libs/table/src/directives/ngp-table-row-animation.trace.bench.spec.ts` | delete |
| `libs/table/project.json` | edit — delete `bench-trace` target; keep `bench` (counts only) |
| `libs/table/tsconfig.bench.json` | keep — still isolates the bench from other specs |
| `libs/table/src/stories/row-animation/` | delete (profile story, host, CSS) |
| `libs/table/.storybook/main.ts` | edit — remove the `profile` tag option |
| `.gitignore` | edit — remove `bench-trace.json` |
| `package.json` | edit — `table:bench` keeps pointing at the counts-only Vitest bench |

## What To Do

- **Keep in the Vitest bench** (discovery § What it replaces): per size, animations started > 0
  and ≤ on-screen glides; settle to 0; mid-glide peak ≤ 2× and back to ≤ 1×; plain starts 0.
  Keep the plain re-attach + `isConnected` asserts (the TestBed root-removal trap still applies).
- **Remove:** `overhead*`/`reorderFrame*`/`*MinMs` fields, the timing gates, `forceLayout()`, the
  dropped-frame and long-frame sampling, the scaling test, the per-step cost probes, and the
  results-table timing columns. Rename the file's describe to say it checks animation counts.
- Delete now-unused helpers rather than leaving them.

## Acceptance Checks

- [ ] `npx ngc -p libs/table/tsconfig.bench.json --noEmit` clean.
- [ ] `nx run shared-table:typecheck` shows no errors in touched files.
- [ ] User runs `npx nx run shared-table:bench` — all count gates green.
