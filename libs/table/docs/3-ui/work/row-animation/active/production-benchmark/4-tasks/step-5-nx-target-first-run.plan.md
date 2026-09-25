# Step 5 — Nx target and first run

**PR scope:** Wire `nx run table-bench:bench` (build, then driver) and record the first real
numbers. The run itself is the user's.
**Depends on:** Step 4.
**Task type:** `code`
**Skills used:** —
**Scaffolding agent:** `general-purpose`

## Files

| File | Action |
|---|---|
| `apps/table-bench/project.json` | edit — `bench` target (`nx:run-commands`, `dependsOn: ["build"]`, `cache: false`) |
| `package.json` | edit — `table:bench:prod` script, mirroring `table:bench`'s `Tee-Object` log |
| `.gitignore` | edit — `dist/table-bench/` traces are already under `dist/`; add the log file |

## What To Do

- `bench` command: `node --experimental-strip-types apps/table-bench/driver/bench.ts`, passing
  through extra args (`--rows`, `--headless`, `--cpu-throttle`).
- Check the two open inferences from discovery § Unverified with the first traces, and write the
  answers into the progress file:
  1. Does the `reorder` window end before the 300 ms glide's frames (it should — the measure
     ends after one frame)?
  2. Dev-mode cost on this reorder: compare `plainMs` here with the old Vitest `plainMs`.

## Acceptance Checks

- [ ] User runs `npx nx run table-bench:bench` on a quiet machine (Storybook and other heavy
  apps closed) and pastes the report.
- [ ] Verdict and interval at N=1000 recorded in `progress.md`.
